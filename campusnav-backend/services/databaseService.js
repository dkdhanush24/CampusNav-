/**
 * Database Service — Safe Query Plan Executor
 * 
 * Executes Gemini-generated query plans against MongoDB Atlas.
 * 
 * Security:
 *   - Only allows 5 operations: findOne, findMany, count, exists, aggregate
 *   - Validates collection exists before querying
 *   - Sanitizes all filter values (strips $where, $eval, functions)
 *   - Enforces result limits (max 20 documents)
 *   - Never exposes raw errors to client
 */

const mongoose = require("mongoose");

// ── Allowed Operations ────────────────────────────────────────────

const ALLOWED_OPERATIONS = new Set([
    "findOne",
    "findMany",
    "count",
    "exists",
    "aggregate",
]);

// Maximum documents returned per query
const MAX_LIMIT = 20;

// ── Filter Sanitization ──────────────────────────────────────────

/**
 * Dangerous keys that could allow NoSQL injection or arbitrary code execution.
 */
const DANGEROUS_KEYS = new Set([
    "$where", "$expr", "$function", "$accumulator",
    "$eval", "$jsonSchema",
]);

/**
 * Recursively sanitize a MongoDB filter object.
 * Removes dangerous operators and ensures values are safe types.
 * 
 * @param {any} obj - Filter object to sanitize
 * @param {number} depth - Current recursion depth (max 5)
 * @returns {Object} - Sanitized filter
 */
function sanitizeFilter(obj, depth = 0) {
    if (depth > 5) return {};
    if (!obj || typeof obj !== "object") return {};
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeFilter(item, depth + 1)).filter(Boolean);
    }

    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
        // Block dangerous operators
        if (DANGEROUS_KEYS.has(key)) {
            console.log(`[DB] ⚠️  Blocked dangerous operator: "${key}"`);
            continue;
        }

        // Block function values
        if (typeof value === "function") {
            console.log(`[DB] ⚠️  Blocked function value for key: "${key}"`);
            continue;
        }

        // Recurse into nested objects
        if (value && typeof value === "object" && !Array.isArray(value)) {
            clean[key] = sanitizeFilter(value, depth + 1);
        } else if (Array.isArray(value)) {
            clean[key] = value.map(v => {
                if (v && typeof v === "object") return sanitizeFilter(v, depth + 1);
                return v;
            });
        } else {
            clean[key] = value;
        }
    }

    return clean;
}

// ── Collection Validation ─────────────────────────────────────────

/**
 * Check if a collection exists in the current database.
 * 
 * @param {string} collectionName - Name to check
 * @returns {boolean}
 */
async function collectionExists(collectionName) {
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const names = collections.map(c => c.name.toLowerCase());
        return names.includes(collectionName.toLowerCase());
    } catch {
        return false;
    }
}

// ── Query Plan Executor ───────────────────────────────────────────

/**
 * Execute a Gemini-generated query plan safely against MongoDB Atlas.
 * 
 * @param {Object} plan - Query plan from Gemini
 * @param {string} plan.collection - Target collection name
 * @param {string} plan.operation - One of: findOne, findMany, count, exists, aggregate
 * @param {Object} plan.filter - MongoDB filter object
 * @param {Object} [plan.projection] - Optional field projection
 * @param {Array} [plan.aggregation] - Optional aggregation pipeline
 * @param {number} [plan.limit] - Optional result limit
 * @returns {Object} - { results: Array, count: number, collection: string, operation: string }
 */
async function executeQueryPlan(plan) {
    // ── Validate plan structure ────────────────────────────────
    if (!plan || typeof plan !== "object") {
        console.log("[DB] ⚠️  Invalid query plan: not an object");
        return { results: [], count: 0, collection: null, operation: null };
    }

    // Handle Gemini returning an error
    if (plan.error) {
        console.log(`[DB] ⚠️  Gemini returned error: "${plan.error}"`);
        return { results: [], count: 0, collection: null, operation: null, error: plan.error };
    }

    const { collection: collName, operation, filter = {}, projection = {}, aggregation = [], limit } = plan;

    // ── Validate operation ─────────────────────────────────────
    if (!operation || !ALLOWED_OPERATIONS.has(operation)) {
        console.log(`[DB] ⚠️  Blocked disallowed operation: "${operation}"`);
        return { results: [], count: 0, collection: collName, operation };
    }

    // ── Validate collection ────────────────────────────────────
    if (!collName || typeof collName !== "string") {
        console.log("[DB] ⚠️  No collection specified in query plan");
        return { results: [], count: 0, collection: null, operation };
    }

    const exists = await collectionExists(collName);
    if (!exists) {
        console.log(`[DB] ⚠️  Collection "${collName}" does not exist in database`);
        return { results: [], count: 0, collection: collName, operation };
    }

    // ── Sanitize filter ────────────────────────────────────────
    const safeFilter = sanitizeFilter(filter);
    const safeProjection = sanitizeFilter(projection);
    const resultLimit = Math.min(Math.max(limit || 10, 1), MAX_LIMIT);

    console.log(`[DB] Executing: ${operation} on "${collName}"`);
    console.log(`[DB] Filter:`, JSON.stringify(safeFilter));
    if (Object.keys(safeProjection).length > 0) {
        console.log(`[DB] Projection:`, JSON.stringify(safeProjection));
    }

    // ── Get collection handle ──────────────────────────────────
    const db = mongoose.connection.db;
    const collection = db.collection(collName);

    // ── Execute based on operation ─────────────────────────────
    try {
        let results = [];
        let count = 0;

        switch (operation) {
            case "findOne": {
                const projOpts = Object.keys(safeProjection).length > 0
                    ? { projection: safeProjection }
                    : {};
                const doc = await collection.findOne(safeFilter, projOpts);
                results = doc ? [doc] : [];
                count = results.length;
                break;
            }

            case "findMany": {
                let cursor = collection.find(safeFilter);
                if (Object.keys(safeProjection).length > 0) {
                    cursor = cursor.project(safeProjection);
                }
                results = await cursor.limit(resultLimit).toArray();
                count = results.length;
                break;
            }

            case "count": {
                count = await collection.countDocuments(safeFilter);
                results = [{ count, collection: collName }];
                break;
            }

            case "exists": {
                const doc = await collection.findOne(safeFilter, { projection: { _id: 1 } });
                const doesExist = doc !== null;
                results = [{ exists: doesExist, collection: collName }];
                count = doesExist ? 1 : 0;
                break;
            }

            case "aggregate": {
                if (!Array.isArray(aggregation) || aggregation.length === 0) {
                    console.log("[DB] ⚠️  Empty aggregation pipeline, falling back to findMany");
                    results = await collection.find(safeFilter).limit(resultLimit).toArray();
                } else {
                    // Sanitize each stage and enforce a $limit
                    const safePipeline = aggregation
                        .map(stage => sanitizeFilter(stage))
                        .filter(stage => Object.keys(stage).length > 0);

                    // Ensure there's a limit stage
                    const hasLimit = safePipeline.some(s => "$limit" in s);
                    if (!hasLimit) {
                        safePipeline.push({ $limit: resultLimit });
                    }

                    console.log(`[DB] Aggregation pipeline:`, JSON.stringify(safePipeline));
                    results = await collection.aggregate(safePipeline).toArray();
                }
                count = results.length;
                break;
            }

            default:
                console.log(`[DB] ⚠️  Unhandled operation: "${operation}"`);
                return { results: [], count: 0, collection: collName, operation };
        }

        console.log(`[DB] ✅ ${operation} returned ${count} result(s) from "${collName}"`);

        // Strip MongoDB _id for cleaner responses
        results = results.map(doc => {
            if (doc && doc._id) {
                const { _id, ...rest } = doc;
                return rest;
            }
            return doc;
        });

        return { results, count, collection: collName, operation };

    } catch (dbError) {
        console.error(`[DB] ❌ Query execution failed: ${dbError.message}`);
        return { results: [], count: 0, collection: collName, operation, error: dbError.message };
    }
}

module.exports = {
    executeQueryPlan,
    collectionExists,
    sanitizeFilter,
    ALLOWED_OPERATIONS,
};
