/**
 * Chat Controller
 * 
 * Clean LLM pipeline:
 *   User message → Gemini extraction → DB query → Gemini formatting → Reply
 * 
 * No substring matching. No hardcoded names. Pure LLM + DB.
 * If Gemini fails → returns clear error, NOT a placeholder.
 * 
 * All DB queries go through the shared Mongoose connection (Atlas).
 */

const { extractIntentAndEntities, formatResponse } = require("../services/llmService");
const { queryDatabase } = require("../services/databaseService");

/**
 * Main chat handler — full LLM pipeline.
 * 
 * @param {Object} req - Express request (body.message)
 * @param {Object} res - Express response
 */
async function handleChat(req, res) {
    try {
        // ── Step 1: Validate input ──────────────────────────────────
        const userMessage = (req.body.message || "").trim();

        if (!userMessage || userMessage.length < 1) {
            return res.json({
                reply: "Please type a question about the campus — faculty, departments, bus routes, navigation, and more!",
            });
        }

        console.log(`\n[Chat] ════════════════════════════════════════`);
        console.log(`[Chat] New query: "${userMessage}"`);
        console.log(`[Chat] ════════════════════════════════════════`);

        // ── Step 2: LLM intent + entity extraction ──────────────────
        let extraction;
        try {
            extraction = await extractIntentAndEntities(userMessage);
        } catch (llmError) {
            console.error("[Chat] LLM extraction failed:", llmError.message);
            return res.json({
                reply: "AI service temporarily unavailable. Please try again in a moment.",
            });
        }

        const { intent, entities } = extraction;
        console.log(`[Chat] Intent: ${intent}`);
        console.log(`[Chat] Entities:`, JSON.stringify(entities));

        // ── Step 3: Handle greetings without DB ─────────────────────
        if (intent === "greeting") {
            return res.json({
                reply: "Hello! I'm CampusNav assistant. Ask me about faculty, departments, bus routes, or campus navigation!",
            });
        }

        // ── Step 4: Handle unknown / off-topic ──────────────────────
        if (intent === "unknown") {
            return res.json({
                reply: "I can help with campus-related questions — faculty info, departments, bus routes, and navigation. Could you rephrase your question?",
            });
        }

        // ── Step 5: Query database (Atlas) ──────────────────────────
        const dbResult = await queryDatabase(intent, entities || {});

        console.log(`[Chat] DB result: collection="${dbResult.collection}", count=${dbResult.count}`);

        // ── Step 6: Handle empty results ────────────────────────────
        // Only return "No information available" if results are genuinely empty
        const hasResults = dbResult.results
            && (Array.isArray(dbResult.results) ? dbResult.results.length > 0 : true)
            && dbResult.count > 0;

        if (!hasResults) {
            console.log(`[Chat] ⚠️  Empty DB result for intent="${intent}", entities=${JSON.stringify(entities)}`);
            console.log(`[Chat] ⚠️  This means either:`);
            console.log(`[Chat]    1. The collection is truly empty for this query`);
            console.log(`[Chat]    2. The entity name didn't match any documents (case/spelling)`);
            console.log(`[Chat]    3. The collection doesn't exist in Atlas`);

            return res.json({
                reply: "No information available.",
            });
        }

        console.log(`[Chat] ✅ Found ${dbResult.count} result(s) from "${dbResult.collection}" — sending to Gemini for formatting`);

        // ── Step 7: Format response with Gemini ─────────────────────
        let reply;
        try {
            reply = await formatResponse(userMessage, intent, dbResult.results);
        } catch (llmError) {
            console.error("[Chat] LLM formatting failed:", llmError.message);
            // Fallback: return raw data summary instead of generic error
            if (Array.isArray(dbResult.results) && dbResult.results.length > 0) {
                const first = dbResult.results[0];
                if (first.name) {
                    reply = `${first.name} — ${first.designation || ""} in ${first.department || "unknown"} department.`;
                } else {
                    reply = "I found some results but the AI formatting service is temporarily unavailable.";
                }
            } else {
                reply = "AI service temporarily unavailable.";
            }
        }

        console.log(`[Chat] Final reply: ${reply}`);
        return res.json({ reply });

    } catch (error) {
        console.error("[Chat] Unexpected error:", error.message);
        console.error("[Chat] Stack:", error.stack);
        return res.json({
            reply: "AI service temporarily unavailable. Please try again in a moment.",
        });
    }
}

module.exports = {
    handleChat,
};
