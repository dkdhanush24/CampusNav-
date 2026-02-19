/**
 * LLM Service — Gemini 2.0 Flash (Two-Stage Pipeline)
 * 
 * Stage 1: generateQueryPlan() → Converts user question into structured MongoDB query plan
 * Stage 2: formatResponse()    → Converts raw DB results into natural language answer
 * 
 * If Gemini fails at any stage → caller handles fallback.
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

// ── Stage 1: Query Planner Prompt ─────────────────────────────────

const QUERY_PLANNER_PROMPT = `You are the CampusNav Query Planner.

Your job is to convert a user question into a structured database query plan.

Database Name: campusnav

You may access ANY collection inside the campusnav database.
Do not assume only specific collections.
If needed, infer the correct collection based on the question.

Known collections (but not limited to these):
- faculties (faculty members: name, designation, email, department, subjects, specialization, room_id, availability, facultyId)
- facultylocations (BLE tracking: facultyId, room, rssi, lastSeen, scannerId)
- departments
- bus_routes
- attendance

Allowed Operations (ONLY these 5):
- findOne
- findMany
- count
- exists
- aggregate

Rules:
1. Understand natural language and paraphrasing.
2. Use case-insensitive regex for name and text matching: {"$regex": "value", "$options": "i"}
3. For partial name matching, use regex (e.g., "nijil" should match "Dr. Nijil Raj N").
4. Strip honorifics like "sir", "madam", "ma'am" from names before building the filter.
5. If counting is required, use operation: "count".
6. If checking availability/existence, use operation: "exists".
7. If grouping or summarizing is required, use operation: "aggregate".
8. For questions about HOD/Head of Department, search designation field with regex for "head" or "hod".
9. For questions about who teaches a subject, search the subjects field.
10. For location queries, first find the faculty in "faculties", then look up "facultylocations".

STRICT RULES:
- Return ONLY valid JSON. No explanation. No markdown. No code fences.
- Do NOT hallucinate fields that are unlikely to exist.
- If gramar teem "sir" or "madam" just is for respect, do not include in search.
- If information is insufficient, return: {"error": "insufficient_information"}

JSON FORMAT:
{
  "collection": "collection_name",
  "operation": "findOne | findMany | count | exists | aggregate",
  "filter": {},
  "projection": {},
  "aggregation": [],
  "limit": 10
}

If a field is not required, use an empty object {}.
If aggregation is not required, use an empty array [].
If limit is not specified, default to 10.`;

// ── Stage 2: Response Formatter Prompt ────────────────────────────

const FORMAT_PROMPT = `You are CampusNav AI.
You are NOT allowed to guess.
You are NOT allowed to fabricate.
You must answer strictly using the database result provided.
If database result is empty or null, respond exactly: 'No information available.'
Keep answer under 3 sentences.
Do not introduce yourself.
Do not add extra context.
Do not use markdown formatting.`;

// ── Gemini Call Helper ────────────────────────────────────────────

/**
 * Call Gemini with a prompt. Single retry for 429 only.
 * 
 * @param {string} prompt - Full prompt text
 * @param {Object} [configOverrides] - Optional generation config overrides
 * @returns {string} - Raw text response
 * @throws {Error} - If call fails
 */
async function callGemini(prompt, configOverrides = {}) {
    if (!API_KEY) {
        throw new Error("CHATBOT_API_KEY is not configured");
    }

    const config = { ...{ temperature: 0.1, maxOutputTokens: 300 }, ...configOverrides };

    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: config,
    });

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
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

// ── Stage 1: Generate Query Plan ──────────────────────────────────

/**
 * Send user query to Gemini → receive a structured JSON query plan.
 * 
 * @param {string} userQuery - Raw user message
 * @returns {Object} - Parsed query plan { collection, operation, filter, projection, aggregation, limit }
 * @throws {Error} - If Gemini fails or returns invalid JSON
 */
async function generateQueryPlan(userQuery) {
    const prompt = `${QUERY_PLANNER_PROMPT}

User question: "${userQuery}"`;

    const rawText = await callGemini(prompt, { temperature: 0.05, maxOutputTokens: 400 });

    console.log(`[LLM] Query plan raw: ${rawText}`);

    // Strip markdown fences if present
    const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    const plan = JSON.parse(cleaned);
    console.log(`[LLM] Query plan parsed:`, JSON.stringify(plan));
    return plan;
}

// ── Stage 2: Format Response ──────────────────────────────────────

/**
 * Send user query + DB results to Gemini → receive natural language answer.
 * 
 * @param {string} userQuery - Original user question
 * @param {Array|Object|null} dbResults - Raw database results
 * @returns {string} - Formatted natural language response
 * @throws {Error} - If Gemini fails
 */
async function formatResponse(userQuery, dbResults) {
    if (!dbResults || (Array.isArray(dbResults) && dbResults.length === 0)) {
        return "No information available.";
    }

    const prompt = `${FORMAT_PROMPT}

USER QUERY:
${userQuery}

DATABASE RESULT:
${JSON.stringify(dbResults, null, 2)}

Generate a concise answer:`;

    const reply = await callGemini(prompt, { temperature: 0.1, maxOutputTokens: 200 });
    console.log(`[LLM] Formatted response: ${reply}`);
    return reply;
}

module.exports = {
    generateQueryPlan,
    formatResponse,
};
