/**
 * Chat Controller
 * 
 * Clean LLM pipeline:
 *   User message → Gemini extraction → DB query → Gemini formatting → Reply
 * 
 * No substring matching. No hardcoded names. Pure LLM + DB.
 * If Gemini fails → returns clear error, NOT a placeholder.
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

        console.log(`\n[Chat] ──── New query: "${userMessage}" ────`);

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

        // ── Step 5: Query database ──────────────────────────────────
        const dbResult = await queryDatabase(intent, entities || {});

        console.log(`[Chat] DB: collection=${dbResult.collection}, results=${dbResult.count}`);

        // ── Step 6: Handle empty results ────────────────────────────
        if (!dbResult.results || dbResult.count === 0) {
            return res.json({
                reply: "No information available.",
            });
        }

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
        return res.json({
            reply: "AI service temporarily unavailable. Please try again in a moment.",
        });
    }
}

module.exports = {
    handleChat,
};
