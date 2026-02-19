/**
 * LLM Service — Gemini 1.5 Flash (FORMATTING ONLY)
 * 
 * Gemini's ONLY job: format database results into natural language.
 * It does NOT extract entities, classify intents, or query the DB.
 * 
 * If Gemini fails → caller handles fallback formatting.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Configuration ─────────────────────────────────────────────────
const MODEL_NAME = "gemini-2.0-flash";
const API_KEY = process.env.CHATBOT_API_KEY;

if (!API_KEY) {
    console.error("[LLM] FATAL: CHATBOT_API_KEY is not set in .env");
} else {
    const masked = API_KEY.slice(0, 8) + "..." + API_KEY.slice(-4);
    console.log(`[LLM] API key loaded: ${masked}`);
    console.log(`[LLM] Model: ${MODEL_NAME}`);
}

const genAI = new GoogleGenerativeAI(API_KEY || "");

const GENERATION_CONFIG = {
    temperature: 0.1,
    maxOutputTokens: 200,
};

// ── Strict System Prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are CampusNav AI.
You are NOT allowed to guess.
You are NOT allowed to fabricate.
You must answer strictly using the database result provided.
If database result is empty, respond exactly:
'No information available.'
Keep answer under 3 sentences.
Do not introduce yourself.
Do not add extra context.`;

/**
 * Format database results into a natural language response.
 * This is the ONLY function Gemini is used for.
 * 
 * @param {string} userQuery - Original user question
 * @param {Array|Object} dbResults - Raw database results
 * @returns {string} - Formatted response
 * @throws {Error} - If Gemini call fails (caller must handle)
 */
async function formatResponse(userQuery, dbResults) {
    if (!API_KEY) {
        throw new Error("CHATBOT_API_KEY is not configured");
    }

    if (!dbResults || (Array.isArray(dbResults) && dbResults.length === 0)) {
        return "No information available.";
    }

    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: GENERATION_CONFIG,
    });

    const prompt = `${SYSTEM_PROMPT}

USER QUERY:
${userQuery}

DATABASE RESULT:
${JSON.stringify(dbResults, null, 2)}`;

    // Single retry for rate limits (429) only
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            console.log(`[LLM] Gemini response (${text.length} chars): ${text}`);
            return text;
        } catch (error) {
            if (error.status === 429 && attempt === 0) {
                console.log("[LLM] Rate limited, retrying in 2s...");
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }
            console.error(`[LLM] Gemini error (${error.status || "unknown"}): ${error.message}`);
            throw error;
        }
    }
}

module.exports = { formatResponse };
