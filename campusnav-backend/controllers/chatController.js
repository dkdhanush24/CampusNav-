/**
 * Chat Controller — Hybrid Query Planner Architecture (FINAL)
 *
 * Pipeline:
 *   1. Greeting check (instant, no LLM)
 *   2. generateQueryPlan(rawMessage) — detects operation + builds filter
 *   3. If intent !== "database_query" → reject or clarify
 *   4. If isLocationQuery → handleLocationQuery()
 *   5. Else executeQueryPlan()
 *   6. count/exists → direct format (no LLM)
 *      findOne/findMany → Gemini formats naturally
 *   7. Fallback NLP only if Gemini is completely down
 *
 * Rules:
 *   - Controller does NOT detect operation
 *   - Controller does NOT mutate queryPlan.operation
 *   - Controller trusts generateQueryPlan() fully
 */

const { generateQueryPlan, formatResponse } = require("../services/llmService");
const { executeQueryPlan } = require("../services/databaseService");

// Backend NLP fallback (used only when Gemini is completely down)
const { normalize } = require("../utils/textUtils");
const { detectIntent } = require("../utils/intentDetector");
const { extractAllEntities } = require("../utils/entityExtractor");

// ── Greeting Detection ────────────────────────────────────────────

const GREETING_PATTERNS = new Set([
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
    "hola", "greetings", "sup", "yo", "howdy",
]);

function isGreeting(message) {
    const cleaned = message.toLowerCase().trim().replace(/[^a-z\s]/g, "").trim();
    return GREETING_PATTERNS.has(cleaned) || cleaned.length < 4;
}

// ── Direct Formatters (no LLM needed) ────────────────────────────

function formatCount(dbResult, queryPlan) {
    const countData = dbResult.results[0];
    const n = countData.count;

    const filter = queryPlan.filter || {};
    const parts = [];
    if (filter.department) parts.push(`in the ${filter.department["$regex"] || filter.department} department`);
    if (filter.designation) parts.push(`with designation matching "${filter.designation["$regex"] || filter.designation}"`);

    const context = parts.length > 0 ? ` ${parts.join(" and ")}` : "";
    return `There are ${n} faculty member${n !== 1 ? "s" : ""}${context}.`;
}

function formatExists(dbResult) {
    const existsData = dbResult.results[0];
    return existsData.exists
        ? "Yes, that record exists in the campus database."
        : "No, that record was not found in the campus database.";
}

function formatManually(results, operation) {
    if (!results || results.length === 0) return "No information available.";
    if (operation === "count") return `There are ${results[0].count} matching records.`;
    if (operation === "exists") return results[0].exists ? "Yes, it exists." : "No, it does not exist.";

    if (results.length === 1) {
        const doc = results[0];
        if (doc.name && doc.designation) {
            return `${doc.name} is ${doc.designation} in the ${doc.department || "unknown"} department.${doc.email ? ` Email: ${doc.email}` : ""}`;
        }
        if (doc.name) return `${doc.name} — ${doc.department || "Faculty"} department.`;
        const keys = Object.keys(doc).filter(k => k !== "_id");
        return keys.slice(0, 4).map(k => `${k}: ${doc[k]}`).join(", ");
    }

    return results.slice(0, 5).map(doc => {
        if (doc.name) return `${doc.name} — ${doc.designation || "Faculty"}, ${doc.department || ""}`;
        const keys = Object.keys(doc).filter(k => k !== "_id");
        return keys.slice(0, 3).map(k => `${k}: ${doc[k]}`).join(", ");
    }).join(". ") + ".";
}

// ── Backend NLP Fallback ───────────────────────────────────────────

async function fallbackNLP(rawMessage) {
    try {
        const normalizedMessage = normalize(rawMessage);
        const entities = extractAllEntities(normalizedMessage);
        const { intent } = detectIntent(normalizedMessage);
        console.log(`[Chat] Fallback NLP — intent: ${intent}, entities:`, JSON.stringify(entities));

        const Faculty = require("../models/faculty");

        if (entities.name && entities.name.length >= 2) {
            const doc = await Faculty.findOne({
                name: { $regex: entities.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
            }).lean();
            if (doc) {
                return `${doc.name} is ${doc.designation || "a faculty member"} in the ${doc.department} department.${doc.email ? ` Email: ${doc.email}` : ""}`;
            }
        }

        if (entities.designation) {
            const query = { designation: { $regex: entities.designation === "hod" ? "head|hod" : entities.designation, $options: "i" } };
            if (entities.department) query.department = { $regex: entities.department, $options: "i" };
            const doc = await Faculty.findOne(query).lean();
            if (doc) return `${doc.name} is the ${doc.designation} of ${doc.department} department.`;
        }

        if (entities.department) {
            const docs = await Faculty.find({ department: { $regex: entities.department, $options: "i" } }).limit(5).lean();
            if (docs.length > 0) {
                return docs.map(d => `${d.name} — ${d.designation || "Faculty"}`).join(". ") + ".";
            }
        }

        return "No information available.";
    } catch (err) {
        console.error(`[Chat] Fallback NLP error: ${err.message}`);
        return "No information available.";
    }
}

// ── Main Chat Handler ─────────────────────────────────────────────

async function handleChat(req, res) {
    try {
        // ── Step 1: Validate input ──────────────────────────────────
        const rawMessage = (req.body.message || "").trim();

        if (!rawMessage || rawMessage.length < 1) {
            return res.json({ reply: "Please type a question about the campus — faculty, departments, or navigation!" });
        }

        console.log(`\n[Chat] ════════════════════════════════════════`);
        console.log(`[Chat] Query: "${rawMessage}"`);

        // ── Step 2: Greeting check ──────────────────────────────────
        if (isGreeting(rawMessage)) {
            console.log(`[Chat] → Greeting`);
            return res.json({
                reply: "Hello! I'm your Campus Assistant. Ask me about faculty, departments, or campus navigation!",
            });
        }

        // ── Step 3: Generate query plan (operation + filter) ─────────
        let queryPlan;
        try {
            queryPlan = await generateQueryPlan(rawMessage);
        } catch (planError) {
            console.error(`[Chat] ⚠️  Gemini failed: ${planError.message} → NLP fallback`);
            return res.json({ reply: await fallbackNLP(rawMessage) });
        }

        // ── Step 4: Handle non-database intents ──────────────────────
        if (queryPlan.intent === "non_database_query" || queryPlan.intent === "non_campus_query") {
            return res.json({
                reply: "I can only help with campus-related questions — faculty, departments, or navigation.",
            });
        }
        if (queryPlan.intent === "insufficient_information") {
            return res.json({
                reply: "Could you be more specific? Try asking about a faculty member, department, or location.",
            });
        }

        console.log(`[Chat] Query plan: ${queryPlan.operation} on "${queryPlan.collection}" filter:`, JSON.stringify(queryPlan.filter));

        // ── Step 5: Route location queries to dedicated handler ──────
        if (queryPlan.isLocationQuery) {
            console.log(`[Chat] → Location query, routing to handleLocationQuery`);
            return res.json({ reply: await handleLocationQuery(queryPlan, rawMessage) });
        }

        // ── Step 6: Execute query plan safely ────────────────────────
        const dbResult = await executeQueryPlan(queryPlan);
        console.log(`[Chat] DB result: ${dbResult.count} record(s) from "${dbResult.collection}"`);

        // ── Step 7: Handle no results ─────────────────────────────────
        if (!dbResult.results || dbResult.results.length === 0) {
            if (queryPlan.operation === "findOne" || queryPlan.operation === "findMany") {
                const nlpReply = await fallbackNLP(rawMessage);
                if (nlpReply !== "No information available.") {
                    return res.json({ reply: nlpReply });
                }
            }
            return res.json({ reply: "No information available." });
        }

        // ── Step 8: Format the response ───────────────────────────────

        // count and exists: formatted directly (always correct, no LLM)
        if (dbResult.operation === "count") {
            return res.json({ reply: formatCount(dbResult, queryPlan) });
        }
        if (dbResult.operation === "exists") {
            return res.json({ reply: formatExists(dbResult) });
        }

        // findOne / findMany / aggregate: Gemini formats naturally
        let reply;
        try {
            reply = await formatResponse(rawMessage, dbResult.results);
        } catch (fmtErr) {
            console.error(`[Chat] ⚠️  Gemini formatter failed: ${fmtErr.message}`);
            reply = formatManually(dbResult.results, dbResult.operation);
        }

        return res.json({ reply });

    } catch (error) {
        console.error("[Chat] Unexpected error:", error.message);
        try {
            const raw = (req.body.message || "").trim();
            if (raw) return res.json({ reply: await fallbackNLP(raw) });
        } catch { }
        return res.json({ reply: "No information available." });
    }
}

// ── Location Query Handler ────────────────────────────────────────

async function handleLocationQuery(queryPlan, rawMessage) {
    try {
        // Step 1: Find the faculty by name to get their facultyId
        const facultyPlan = {
            collection: "faculties",
            operation: "findOne",
            filter: queryPlan.filter,
            projection: { name: 1, facultyId: 1, department: 1 },
            limit: 1,
        };
        const facultyResult = await executeQueryPlan(facultyPlan);
        if (!facultyResult.results || facultyResult.results.length === 0) {
            return "Faculty not found in our records.";
        }

        const faculty = facultyResult.results[0];
        const facultyId = faculty.facultyId;

        if (!facultyId) {
            return `${faculty.name} is in the ${faculty.department} department, but no location tracking is set up for them.`;
        }

        // Step 2: Look up location
        const locationPlan = {
            collection: "facultyLocations",
            operation: "findOne",
            filter: { facultyId: facultyId },
            projection: { room: 1, lastSeen: 1 },
            limit: 1,
        };
        const locationResult = await executeQueryPlan(locationPlan);

        if (!locationResult.results || locationResult.results.length === 0) {
            return `${faculty.name} is registered in the ${faculty.department} department, but their current location is not available.`;
        }

        const loc = locationResult.results[0];
        const lastSeen = loc.lastSeen
            ? new Date(loc.lastSeen).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
            : "unknown time";

        return `${faculty.name} was last seen in ${loc.room || "unknown room"} at ${lastSeen}.`;

    } catch (err) {
        console.error(`[Chat] Location query error: ${err.message}`);
        return "Location information is currently unavailable.";
    }
}

module.exports = { handleChat };
