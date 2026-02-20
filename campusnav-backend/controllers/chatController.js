/**
 * Chat Controller — Function-Calling Architecture
 *
 * Pipeline:
 *   1. Validate input
 *   2. LLM selects tool + extracts parameters (single Gemini call)
 *   3. Backend executes tool deterministically
 *   4. Static formatter produces response
 *   5. Return reply
 *
 * Rules:
 *   - No regex intent detection
 *   - No fallback NLP
 *   - No LLM response formatting
 *   - Single LLM call per request (tool selection only)
 *   - databaseService security layer is untouched
 */

const { selectTool } = require("../services/llmService");
const { executeTool } = require("../services/toolExecutor");
const { formatToolResult } = require("../services/responseFormatter");

// ── Static Replies for Non-Tool Responses ─────────────────────────

const NON_TOOL_REPLIES = {
    greeting: "Hello! I'm your Campus Assistant. Ask me about faculty, departments, or campus navigation!",
    off_topic: "I can only help with campus-related questions — faculty, departments, or navigation.",
    unclear: "Could you be more specific? Try asking about a faculty member, department, or campus location.",
};

// ── Main Chat Handler ─────────────────────────────────────────────

async function handleChat(req, res) {
    try {
        // ── Step 1: Validate input ──────────────────────────────
        const message = (req.body.message || "").trim();

        if (!message) {
            return res.json({
                reply: "Please type a question about the campus — faculty, departments, or navigation!",
            });
        }

        console.log(`\n[Chat] ════════════════════════════════════════`);
        console.log(`[Chat] Query: "${message}"`);

        // ── Step 2: LLM selects tool ────────────────────────────
        const toolCall = await selectTool(message);
        console.log(`[Chat] Tool: ${toolCall.tool}`, JSON.stringify(toolCall.args || {}));

        // ── Step 3: Handle non-tool responses ───────────────────
        if (toolCall.tool === "none") {
            const reason = toolCall.args?.reason || "unclear";
            console.log(`[Chat] Non-tool response: ${reason}`);
            return res.json({ reply: NON_TOOL_REPLIES[reason] || NON_TOOL_REPLIES.unclear });
        }

        // ── Step 4: Execute tool deterministically ──────────────
        const result = await executeTool(toolCall.tool, toolCall.args);

        // ── Step 5: Format and return ───────────────────────────
        const reply = formatToolResult(toolCall.tool, result);
        console.log(`[Chat] Reply: "${reply}"`);
        return res.json({ reply });

    } catch (error) {
        console.error("[Chat] Error:", error.message);
        return res.json({
            reply: "I'm having trouble processing your request. Please try again.",
        });
    }
}

module.exports = { handleChat };
