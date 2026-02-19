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

const SYSTEM_PROMPT = `You are the CampusNav Query Planner.

Your job is to convert a user question into a structured database query plan.

Database Name:
campusnav

You may access ANY collection inside the campusnav database.
Do not assume only specific collections.
If needed, infer the correct collection based on the question.

Allowed Operations (ONLY these 5):
- findOne
- findMany
- count
- exists
- aggregate

You must:

1. Understand natural language and paraphrasing.
2. Determine:
   - collection name
   - operation
   - filter conditions
   - optional projection fields
3. Use only valid MongoDB-style filters.
4. If counting is required, use operation: "count".
5. If checking availability/existence, use operation: "exists".
6. If grouping or summarizing is required, use operation: "aggregate".

STRICT RULES:

- Return ONLY valid JSON.
- Do NOT explain anything.
- Do NOT include markdown.
- Do NOT hallucinate fields that are unlikely to exist.
- If information is insufficient, return:

{
  "error": "insufficient_information"
}

JSON FORMAT:

{
  "collection": "collection_name",
  "operation": "findOne | findMany | count | exists | aggregate",
  "filter": { },
  "projection": { },
  "aggregation": [ ]
}

If a field is not required, use an empty object {}.
If aggregation is not required, use an empty array [].
`;

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
