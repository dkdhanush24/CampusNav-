/**
 * Database Service — Dynamic Query Layer
 * 
 * Maps LLM-extracted intents + entities to MongoDB queries.
 * Auto-discovers collections at startup.
 * Uses safe parameterized queries (no SQL/NoSQL injection).
 * 
 * All queries go through the shared Mongoose connection (Atlas).
 */

const mongoose = require("mongoose");

// Import known models
const Faculty = require("../models/faculty");
const FacultyLocation = require("../models/facultylocation");

// ── Intent → Collection Mapping ───────────────────────────────────
// Maps each intent to the collection(s) and query strategy to use.
// This is the ONLY place where intent-to-table routing is defined.

const INTENT_HANDLERS = {
    faculty_info: queryFacultyInfo,
    faculty_location: queryFacultyLocation,
    faculty_presence: queryFacultyPresence,
    department_info: queryDepartmentInfo,
    bus_route_query: queryGenericCollection,
    bus_live_status: queryGenericCollection,
    navigation_query: queryGenericCollection,
    attendance_query: queryGenericCollection,
    general_info: queryGeneralInfo,
    greeting: handleGreeting,
    unknown: handleUnknown,
};

// ── Cache for discovered collections ──────────────────────────────
let discoveredCollections = [];

/**
 * Discover all collections in the current MongoDB database.
 * Called once at startup and cached. Refreshable.
 */
async function discoverCollections() {
    try {
        // Wait for connection if not ready yet
        if (mongoose.connection.readyState !== 1) {
            console.log("[DB] Waiting for MongoDB connection before discovering collections...");
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("Connection timeout")), 10000);
                mongoose.connection.once("open", () => {
                    clearTimeout(timeout);
                    resolve();
                });
                // If already connected, resolve immediately
                if (mongoose.connection.readyState === 1) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        }

        const collections = await mongoose.connection.db.listCollections().toArray();
        discoveredCollections = collections.map(c => c.name);
        console.log("[DB] Discovered collections:", discoveredCollections);
        return discoveredCollections;
    } catch (error) {
        console.error("[DB] Collection discovery error:", error.message);
        return [];
    }
}

// ── Main Query Dispatcher ─────────────────────────────────────────

/**
 * Route an intent + entities to the correct DB query.
 * 
 * @param {string} intent - LLM-classified intent
 * @param {Object} entities - LLM-extracted entities
 * @returns {Object} - { collection, results, count }
 */
async function queryDatabase(intent, entities) {
    console.log(`[DB] ───── Query Start ─────`);
    console.log(`[DB] Intent: "${intent}"`);
    console.log(`[DB] Entities:`, JSON.stringify(entities, null, 2));

    // Ensure collections are discovered
    if (discoveredCollections.length === 0) {
        await discoverCollections();
    }

    const handler = INTENT_HANDLERS[intent];

    let result;
    if (handler) {
        console.log(`[DB] Using handler: ${handler.name}`);
        result = await handler(intent, entities);
    } else {
        console.log(`[DB] No specific handler for "${intent}", using generic`);
        result = await queryGenericCollection(intent, entities);
    }

    // Debug log the result
    console.log(`[DB] Result: collection="${result.collection}", count=${result.count}`);
    if (result.results && result.results.length > 0) {
        console.log(`[DB] First result:`, JSON.stringify(result.results[0], null, 2).substring(0, 500));
    } else {
        console.log(`[DB] ⚠️  No results returned from database query`);
    }
    console.log(`[DB] ───── Query End ───────`);

    return result;
}

// ── Intent-Specific Query Functions ───────────────────────────────

/**
 * Query faculty info by name, department, designation, or subject.
 */
async function queryFacultyInfo(intent, entities) {
    const query = buildFacultyQuery(entities);
    console.log(`[DB] Faculty query:`, JSON.stringify(query));

    const results = await Faculty.find(query).limit(5).lean();
    console.log(`[DB] Faculty query returned ${results.length} document(s)`);

    return {
        collection: "faculties",
        results,
        count: results.length,
    };
}

/**
 * Query faculty location from BLE tracking data.
 */
async function queryFacultyLocation(intent, entities) {
    // First find the faculty member
    if (entities.faculty_name) {
        const NOISE_WORDS = new Set([
            "sir", "madam", "maam", "ma'am", "miss", "mrs", "mr",
            "professor", "prof", "teacher", "faculty", "staff",
            "about", "info", "details", "tell", "know", "who", "is",
            "can", "i", "me", "the", "a", "an", "of", "in",
        ]);
        const normalized = entities.faculty_name.trim().replace(/\s+/g, " ");
        const tokens = normalized.split(" ").filter(
            token => token.length > 1 && !NOISE_WORDS.has(token.toLowerCase())
        );
        console.log(`[DB] Location search — name tokens: [${tokens.join(", ")}]`);

        let faculty = null;
        if (tokens.length > 0) {
            const nameQuery = {
                $and: tokens.map(token => ({
                    name: { $regex: escapeRegex(token), $options: "i" },
                })),
            };
            faculty = await Faculty.findOne(nameQuery).lean();
        }

        if (!faculty) {
            console.log(`[DB] ⚠️  No faculty found matching name: "${entities.faculty_name}"`);
            return { collection: "faculties", results: [], count: 0 };
        }

        console.log(`[DB] Found faculty: "${faculty.name}" (ID: ${faculty._id})`);

        // Look up live location
        let location = await FacultyLocation.findOne({
            facultyId: faculty._id.toString(),
        }).lean();

        // Fallback: try matching by first name token in facultyId
        if (!location) {
            const firstName = faculty.name.split(" ")[0];
            console.log(`[DB] No location by _id, trying firstName regex: "${firstName}"`);
            location = await FacultyLocation.findOne({
                facultyId: { $regex: escapeRegex(firstName), $options: "i" },
            }).lean();
        }

        // Fallback: try matching by facultyId field on the faculty document
        if (!location && faculty.facultyId) {
            console.log(`[DB] Trying facultyId from faculty document: "${faculty.facultyId}"`);
            location = await FacultyLocation.findOne({
                facultyId: faculty.facultyId,
            }).lean();
        }

        if (location) {
            console.log(`[DB] Found location: room="${location.room}", lastSeen=${location.lastSeen}`);
            return {
                collection: "facultyLocations",
                results: [{
                    name: faculty.name,
                    department: faculty.department,
                    room: location.room,
                    lastSeen: location.lastSeen,
                }],
                count: 1,
            };
        }

        // Faculty exists but no location data
        console.log(`[DB] Faculty "${faculty.name}" found but no location data available`);
        return {
            collection: "facultyLocations",
            results: [{
                name: faculty.name,
                department: faculty.department,
                room: null,
                lastSeen: null,
                note: "Location not available. Faculty may not have been detected by any scanner recently.",
            }],
            count: 1,
        };
    }

    return { collection: "facultyLocations", results: [], count: 0 };
}

/**
 * Query faculty presence (is faculty available/on-campus?).
 */
async function queryFacultyPresence(intent, entities) {
    // Same as location query — presence is derived from BLE data
    return await queryFacultyLocation(intent, entities);
}

/**
 * Query department info (HOD, faculty list, count).
 */
async function queryDepartmentInfo(intent, entities) {
    const query = {};

    if (entities.department_name) {
        query.department = { $regex: escapeRegex(entities.department_name), $options: "i" };
    }

    if (entities.designation) {
        query.designation = { $regex: escapeRegex(entities.designation), $options: "i" };
    }

    console.log(`[DB] Department query:`, JSON.stringify(query));

    const results = await Faculty.find(query).limit(10).lean();
    console.log(`[DB] Department query returned ${results.length} document(s)`);

    return {
        collection: "faculties",
        results,
        count: results.length,
    };
}

/**
 * Query any collection generically by matching entity values
 * against all fields. Supports future/unknown collections.
 */
async function queryGenericCollection(intent, entities) {
    // Map intent to likely collection name
    const collectionMap = {
        bus_route_query: ["bus_routes", "bus", "buses"],
        bus_live_status: ["bus", "buses", "bus_routes"],
        navigation_query: ["navigation", "map", "maps", "buildings", "rooms"],
        attendance_query: ["attendance", "attendances"],
        general_info: ["faculties"],
    };

    const candidateNames = collectionMap[intent] || [];
    console.log(`[DB] Generic query — candidates: [${candidateNames.join(", ")}]`);
    console.log(`[DB] Available collections: [${discoveredCollections.join(", ")}]`);

    // Find a collection that exists
    const targetCollection = candidateNames.find(name =>
        discoveredCollections.includes(name)
    );

    if (!targetCollection) {
        console.log(`[DB] ⚠️  No matching collection found for intent "${intent}"`);
        return { collection: null, results: [], count: 0 };
    }

    console.log(`[DB] Using collection: "${targetCollection}"`);

    // Build a generic query from entities
    const db = mongoose.connection.db;
    const collection = db.collection(targetCollection);

    // Try to match any entity value against any field
    const orConditions = [];
    for (const [key, value] of Object.entries(entities)) {
        if (value && typeof value === "string" && value.trim()) {
            // Broad text search across fields
            const matchers = await buildFieldMatchers(collection, value);
            orConditions.push({
                $or: matchers,
            });
        }
    }

    let results;
    if (orConditions.length > 0) {
        console.log(`[DB] Generic query filter:`, JSON.stringify({ $and: orConditions }).substring(0, 500));
        results = await collection.find({ $and: orConditions }).limit(10).toArray();
    } else {
        // No entities to filter — return sample data
        console.log(`[DB] No entity filters, returning sample data from "${targetCollection}"`);
        results = await collection.find({}).limit(5).toArray();
    }

    console.log(`[DB] Generic query returned ${results.length} document(s)`);

    return {
        collection: targetCollection,
        results,
        count: results.length,
    };
}

/**
 * Handle greetings — no DB query needed.
 */
async function handleGreeting(intent, entities) {
    return {
        collection: null,
        results: [{ greeting: true }],
        count: 1,
        isGreeting: true,
    };
}

/**
 * Handle unknown intents — no DB query.
 */
async function handleUnknown(intent, entities) {
    return {
        collection: null,
        results: [],
        count: 0,
        isUnknown: true,
    };
}

/**
 * Query general campus info.
 */
async function queryGeneralInfo(intent, entities) {
    // Try faculty collection first, then generic
    if (entities.faculty_name || entities.designation || entities.department_name) {
        return await queryFacultyInfo(intent, entities);
    }
    return await queryGenericCollection(intent, entities);
}

// ── Query Helpers ─────────────────────────────────────────────────

/**
 * Build a faculty-specific query from entities.
 * Uses safe $regex with escaped values — NO injection possible.
 */
function buildFacultyQuery(entities) {
    const query = {};

    // Noise words that users add but are NOT part of stored faculty names
    const NOISE_WORDS = new Set([
        "sir", "madam", "maam", "ma'am", "miss", "mrs", "mr",
        "professor", "prof", "teacher", "faculty", "staff",
        "about", "info", "details", "tell", "know", "who", "is",
        "can", "i", "me", "the", "a", "an", "of", "in",
    ]);

    if (entities.faculty_name) {
        // Normalize: collapse whitespace
        const normalized = entities.faculty_name.trim().replace(/\s+/g, " ");
        // Split into tokens and filter out noise words
        const tokens = normalized.split(" ").filter(
            token => token.length > 1 && !NOISE_WORDS.has(token.toLowerCase())
        );

        console.log(`[DB] Faculty name tokens (after filtering): [${tokens.join(", ")}]`);

        if (tokens.length > 0) {
            // Each token must appear somewhere in the name field (AND logic)
            // This way "Nijil" matches "Dr. Nijil Raj N", "Dr nijil raj" also matches
            query.$and = tokens.map(token => ({
                name: { $regex: escapeRegex(token), $options: "i" },
            }));
        }
    }

    if (entities.department_name) {
        query.department = { $regex: escapeRegex(entities.department_name), $options: "i" };
    }

    if (entities.designation) {
        query.designation = { $regex: escapeRegex(entities.designation), $options: "i" };
    }

    if (entities.subject_name) {
        query.subjects = { $regex: escapeRegex(entities.subject_name), $options: "i" };
    }

    return query;
}

/**
 * Build field matchers for generic collection search.
 * Tries to match a value against all string fields in the collection.
 */
async function buildFieldMatchers(collection, value) {
    try {
        // Sample one document to discover field names
        const sample = await collection.findOne();
        if (!sample) {
            console.log(`[DB] ⚠️  Collection is empty — cannot build field matchers`);
            return [{}];
        }

        const matchers = [];
        for (const [field, fieldValue] of Object.entries(sample)) {
            if (field === "_id") continue;
            if (typeof fieldValue === "string") {
                matchers.push({ [field]: { $regex: escapeRegex(value), $options: "i" } });
            }
        }

        return matchers.length > 0 ? matchers : [{}];
    } catch {
        return [{}];
    }
}

/**
 * Escape special regex characters in a string.
 * CRITICAL for preventing NoSQL injection via regex.
 * 
 * @param {string} str - Raw string to escape
 * @returns {string} - Regex-safe string
 */
function escapeRegex(str) {
    if (!str || typeof str !== "string") return "";
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
    queryDatabase,
    discoverCollections,
    escapeRegex,
};
