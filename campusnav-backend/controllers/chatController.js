/**
 * Chat Controller — Final Stable Pipeline
 * 
 * Architecture:
 *   1. Backend NLP extracts intent + entities (NO LLM)
 *   2. Query MongoDB Atlas directly
 *   3. If results found → Gemini formats answer (ONLY job)
 *   4. If Gemini fails → manual formatting from DB data  
 *   5. If no results → "No information available."
 * 
 * Gemini NEVER searches, extracts, or guesses. Backend NLP is king.
 */

const { normalize, preprocess } = require("../utils/textUtils");
const { detectIntent } = require("../utils/intentDetector");
const { extractAllEntities } = require("../utils/entityExtractor");
const { formatResponse } = require("../services/llmService");
const {
    queryFacultyByName,
    queryFacultyByDesignation,
    queryFacultyByDepartment,
    queryFacultyBySubject,
    queryFacultyLocation,
    countFaculty,
    queryAllFaculty,
} = require("../services/databaseService");

// ── Greeting Detection ────────────────────────────────────────────

const GREETING_PATTERNS = new Set([
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
    "hola", "greetings", "sup", "yo", "howdy",
]);

function isGreeting(message) {
    const cleaned = message.toLowerCase().trim().replace(/[^a-z\s]/g, "").trim();
    return GREETING_PATTERNS.has(cleaned) || cleaned.length < 4;
}

// ── Manual Fallback Formatter ─────────────────────────────────────

/**
 * Format DB results without LLM. Used when Gemini is down.
 * NEVER returns placeholder text — always formats real data.
 */
function formatManually(intent, results) {
    if (!results || results.length === 0) {
        return "No information available.";
    }

    const f = results[0]; // Primary result

    switch (intent) {
        case "HOD_QUERY":
            return `${f.name} is the ${f.designation || "Head"} of ${f.department} department.${f.email ? ` Email: ${f.email}` : ""}`;

        case "DEAN_QUERY":
            return `${f.name} is the ${f.designation} in ${f.department} department.`;

        case "FACULTY_LOOKUP":
        case "DESIGNATION_QUERY":
            return `${f.name} is ${f.designation || "a faculty member"} in the ${f.department} department.${f.email ? ` Email: ${f.email}` : ""}`;

        case "SUBJECT_QUERY":
            return `${f.name} teaches ${f.subjects || "the specified subject"}.`;

        case "FACULTY_LOCATION":
            if (f.room) {
                return `${f.name} is currently in ${f.room}.`;
            }
            return `${f.name} is in the ${f.department} department. Current location is not available.`;

        case "LIST_FACULTY":
            return results.slice(0, 5).map(r => `${r.name} — ${r.designation || "Faculty"}, ${r.department}`).join(". ");

        case "COUNT_QUERY":
            return `There are ${results.length} faculty members.`;

        default:
            return `${f.name} — ${f.designation || "Faculty"} in ${f.department} department.`;
    }
}

// ── Main Chat Handler ─────────────────────────────────────────────

async function handleChat(req, res) {
    try {
        // ── Step 1: Validate and normalize ──────────────────────────
        const rawMessage = (req.body.message || "").trim();

        if (!rawMessage || rawMessage.length < 1) {
            return res.json({
                reply: "Please type a question about the campus — faculty, departments, bus routes, or navigation!",
            });
        }

        console.log(`\n[Chat] ════════════════════════════════════════`);
        console.log(`[Chat] Query: "${rawMessage}"`);

        // ── Step 2: Handle greetings (no DB needed) ─────────────────
        if (isGreeting(rawMessage)) {
            console.log(`[Chat] → Greeting detected`);
            return res.json({
                reply: "Hello! I'm CampusNav assistant. Ask me about faculty, departments, bus routes, or campus navigation!",
            });
        }

        // ── Step 3: Backend NLP — extract entities + intent ─────────
        const normalizedMessage = normalize(rawMessage);
        const entities = extractAllEntities(normalizedMessage);
        const intentResult = detectIntent(normalizedMessage);
        const { intent, confidence } = intentResult;

        console.log(`[Chat] Normalized: "${normalizedMessage}"`);
        console.log(`[Chat] Intent: ${intent} (confidence: ${confidence})`);
        console.log(`[Chat] Entities:`, JSON.stringify(entities));

        // ── Step 4: Query MongoDB Atlas based on intent ──────────────
        let dbResult = { results: [], count: 0 };

        if (intent === "HOD_QUERY" || entities.designation === "hod") {
            dbResult = await queryFacultyByDesignation("hod", entities.department);

        } else if (intent === "DEAN_QUERY" || entities.designation === "dean" || entities.designation === "dean_academics") {
            dbResult = await queryFacultyByDesignation(entities.designation || "dean", null);

        } else if (intent === "FACULTY_LOCATION") {
            if (entities.name) {
                dbResult = await queryFacultyLocation(entities.name);
            }

        } else if (intent === "SUBJECT_QUERY" || entities.subject) {
            const subject = entities.subject;
            if (subject) {
                dbResult = await queryFacultyBySubject(subject);
            }

        } else if (intent === "COUNT_QUERY") {
            const countResult = await countFaculty(entities.department);
            dbResult = {
                results: [{ count: countResult.count, department: entities.department || "all" }],
                count: countResult.count > 0 ? 1 : 0,
            };

        } else if (intent === "LIST_FACULTY") {
            dbResult = await queryAllFaculty(entities.department);

        } else if ((intent === "FACULTY_LOOKUP" || intent === "DESIGNATION_QUERY") && entities.name) {
            dbResult = await queryFacultyByName(entities.name);

        } else if (entities.name) {
            // Fallback: if we have a name, try to find the faculty
            dbResult = await queryFacultyByName(entities.name);

        } else if (entities.department && entities.designation) {
            dbResult = await queryFacultyByDesignation(entities.designation, entities.department);

        } else if (entities.department) {
            dbResult = await queryFacultyByDepartment(entities.department);
        }

        console.log(`[Chat] DB result: ${dbResult.count} record(s)`);

        // ── Step 5: Handle empty results ─────────────────────────────
        if (!dbResult.results || dbResult.results.length === 0 || dbResult.count === 0) {
            console.log(`[Chat] ⚠️  No data found`);
            return res.json({ reply: "No information available." });
        }

        // ── Step 6: Format response (Gemini with manual fallback) ────
        let reply;
        try {
            reply = await formatResponse(rawMessage, dbResult.results);
            console.log(`[Chat] ✅ Gemini formatted: "${reply}"`);
        } catch (llmError) {
            console.error(`[Chat] ⚠️  Gemini failed: ${llmError.message} — using manual format`);
            reply = formatManually(intent, dbResult.results);
            console.log(`[Chat] ✅ Manual formatted: "${reply}"`);
        }

        return res.json({ reply });

    } catch (error) {
        console.error("[Chat] Unexpected error:", error.message);
        console.error("[Chat] Stack:", error.stack);
        // Even on error, return something useful — never "AI unavailable"
        return res.json({
            reply: "No information available.",
        });
    }
}

module.exports = { handleChat };
