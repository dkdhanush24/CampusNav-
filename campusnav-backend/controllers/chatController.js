/**
 * Chat Controller — Gemini Query Planner Architecture
 * 
 * Pipeline:
 *   1. User message → greeting check
 *   2. User message → Gemini Query Planner → JSON query plan
 *   3. Backend validates & executes query plan on MongoDB Atlas
 *   4. DB results → Gemini Formatter → natural language answer
 *   5. If Gemini fails at any stage → backend NLP fallback
 * 
 * Gemini drives the intelligence. Backend enforces safety.
 */

const { generateQueryPlan, formatResponse } = require("../services/llmService");
const { executeQueryPlan } = require("../services/databaseService");

// Backend NLP fallback (used only when Gemini is completely down)
const { normalize } = require("../utils/textUtils");
const { detectIntent } = require("../utils/intentDetector");
const { extractAllEntities } = require("../utils/entityExtractor");
const mongoose = require("mongoose");

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
 * Format DB results without LLM. Used when Gemini formatting fails.
 * Always returns something useful — never placeholder text.
 */
function formatManually(results, operation) {
    if (!results || results.length === 0) {
        return "No information available.";
    }

    // Handle count results
    if (operation === "count") {
        const r = results[0];
        return `There are ${r.count} record(s) in the ${r.collection} collection.`;
    }

    // Handle exists results
    if (operation === "exists") {
        const r = results[0];
        return r.exists ? "Yes, that record exists." : "No, that record was not found.";
    }

    // Handle single document
    if (results.length === 1) {
        const doc = results[0];
        if (doc.name && doc.designation) {
            return `${doc.name} is ${doc.designation} in the ${doc.department || "unknown"} department.${doc.email ? ` Email: ${doc.email}` : ""}`;
        }
        if (doc.name) {
            return `${doc.name} — ${doc.department || ""} department.`;
        }
        // Generic single doc
        const keys = Object.keys(doc).filter(k => k !== "_id");
        const summary = keys.slice(0, 4).map(k => `${k}: ${doc[k]}`).join(", ");
        return summary || "Record found but no displayable fields.";
    }

    // Handle multiple documents
    return results.slice(0, 5).map(doc => {
        if (doc.name) return `${doc.name} — ${doc.designation || "Faculty"}, ${doc.department || ""}`;
        const keys = Object.keys(doc).filter(k => k !== "_id");
        return keys.slice(0, 3).map(k => `${k}: ${doc[k]}`).join(", ");
    }).join(". ") + ".";
}

// ── Backend NLP Fallback Pipeline ─────────────────────────────────

/**
 * When Gemini Query Planner is completely unreachable,
 * fall back to the backend NLP pipeline (keyword/regex extraction).
 * This ensures the chatbot NEVER goes silent.
 */
async function fallbackNLP(rawMessage) {
    try {
        const normalizedMessage = normalize(rawMessage);
        const entities = extractAllEntities(normalizedMessage);
        const { intent } = detectIntent(normalizedMessage);

        console.log(`[Chat] Fallback NLP — intent: ${intent}, entities:`, JSON.stringify(entities));

        const Faculty = require("../models/faculty");

        // Try name-based search
        if (entities.name && entities.name.length >= 2) {
            const doc = await Faculty.findOne({
                name: { $regex: entities.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
            }).lean();
            if (doc) {
                return `${doc.name} is ${doc.designation || "a faculty member"} in the ${doc.department} department.${doc.email ? ` Email: ${doc.email}` : ""}`;
            }
        }

        // Try designation search (HOD, Dean)
        if (entities.designation) {
            const query = { designation: { $regex: entities.designation === "hod" ? "head|hod" : entities.designation, $options: "i" } };
            if (entities.department) query.department = { $regex: entities.department, $options: "i" };

            const doc = await Faculty.findOne(query).lean();
            if (doc) {
                return `${doc.name} is the ${doc.designation} of ${doc.department} department.`;
            }
        }

        // Try department listing
        if (entities.department) {
            const docs = await Faculty.find({ department: { $regex: entities.department, $options: "i" } }).limit(5).lean();
            if (docs.length > 0) {
                return docs.map(d => `${d.name} — ${d.designation || "Faculty"}`).join(". ") + ".";
            }
        }

        return "No information available.";
    } catch (fallbackError) {
        console.error(`[Chat] Fallback NLP error: ${fallbackError.message}`);
        return "No information available.";
    }
}

// ── Main Chat Handler ─────────────────────────────────────────────

async function handleChat(req, res) {
    try {
        // ── Step 1: Validate input ──────────────────────────────────
        const rawMessage = (req.body.message || "").trim();

        if (!rawMessage || rawMessage.length < 1) {
            return res.json({
                reply: "Please type a question about the campus — faculty, departments, bus routes, or navigation!",
            });
        }

        console.log(`\n[Chat] ════════════════════════════════════════`);
        console.log(`[Chat] Query: "${rawMessage}"`);
        console.log(`[Chat] ════════════════════════════════════════`);

        // ── Step 2: Handle greetings (no LLM needed) ────────────────
        if (isGreeting(rawMessage)) {
            console.log(`[Chat] → Greeting detected`);
            return res.json({
                reply: "Hello! I'm CampusNav assistant. Ask me about faculty, departments, bus routes, or campus navigation!",
            });
        }

        // ── Step 3: Gemini Query Planner ─────────────────────────────
        let queryPlan;
        try {
            queryPlan = await generateQueryPlan(rawMessage);
        } catch (planError) {
            console.error(`[Chat] ⚠️  Gemini Query Planner failed: ${planError.message}`);
            console.log(`[Chat] Falling back to backend NLP pipeline`);
            const fallbackReply = await fallbackNLP(rawMessage);
            return res.json({ reply: fallbackReply });
        }

        // Handle Gemini returning insufficient_information
        if (queryPlan.error === "insufficient_information") {
            console.log(`[Chat] Gemini says: insufficient information`);
            return res.json({
                reply: "I can help with campus-related questions — faculty info, departments, bus routes, and navigation. Could you be more specific?",
            });
        }

        console.log(`[Chat] Query plan: ${queryPlan.operation} on "${queryPlan.collection}" with filter:`, JSON.stringify(queryPlan.filter));

        // ── Step 4: Execute query plan safely ────────────────────────
        const dbResult = await executeQueryPlan(queryPlan);

        console.log(`[Chat] DB result: ${dbResult.count} record(s) from "${dbResult.collection}"`);

        // ── Step 5: Handle empty results ─────────────────────────────
        if (!dbResult.results || dbResult.results.length === 0 || dbResult.count === 0) {
            // If query plan targeted wrong collection, try fallback NLP
            if (!dbResult.error) {
                console.log(`[Chat] ⚠️  No data found via Gemini plan — trying NLP fallback`);
                const fallbackReply = await fallbackNLP(rawMessage);
                if (fallbackReply !== "No information available.") {
                    return res.json({ reply: fallbackReply });
                }
            }
            return res.json({ reply: "No information available." });
        }

        // ── Step 6: Format response (Gemini with manual fallback) ────
        let reply;
        try {
            reply = await formatResponse(rawMessage, dbResult.results);
            console.log(`[Chat] ✅ Gemini formatted: "${reply}"`);
        } catch (formatError) {
            console.error(`[Chat] ⚠️  Gemini formatter failed: ${formatError.message}`);
            reply = formatManually(dbResult.results, dbResult.operation);
            console.log(`[Chat] ✅ Manual formatted: "${reply}"`);
        }

        return res.json({ reply });

    } catch (error) {
        console.error("[Chat] Unexpected error:", error.message);
        console.error("[Chat] Stack:", error.stack);
        // Last resort: try NLP fallback
        try {
            const rawMessage = (req.body.message || "").trim();
            if (rawMessage) {
                const fallbackReply = await fallbackNLP(rawMessage);
                return res.json({ reply: fallbackReply });
            }
        } catch { }
        return res.json({ reply: "No information available." });
    }
}

module.exports = { handleChat };
