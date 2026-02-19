/**
 * LLM Service — Gemini 1.5 Flash
 * 
 * Clean integration with a SINGLE model: gemini-1.5-flash
 * No fallback chains, no model rotation, no placeholder responses.
 * 
 * Flow:
 *   1. extractIntentAndEntities(message) → { intent, entities }
 *   2. formatResponse(query, intent, dbResults) → string
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Configuration ─────────────────────────────────────────────────
const MODEL_NAME = "gemini-2.5-flash";
const API_KEY = process.env.CHATBOT_API_KEY;

// Startup validation
if (!API_KEY) {
    console.error("[LLM] FATAL: CHATBOT_API_KEY is not set in .env");
} else {
    const masked = API_KEY.slice(0, 8) + "..." + API_KEY.slice(-4);
    console.log(`[LLM] API key loaded: ${masked}`);
    console.log(`[LLM] Model: ${MODEL_NAME}`);
}

// ── Gemini SDK Init ───────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(API_KEY || "");

const GENERATION_CONFIG = {
    temperature: 0.2,
    maxOutputTokens: 300,
};

/**
 * Call Gemini 1.5 Flash with proper error handling.
 * No fallback models. No infinite retries. Clear errors.
 * 
 * @param {string} prompt - The prompt text
 * @returns {string} - Response text
 * @throws {Error} - If Gemini call fails
 */
async function callGemini(prompt) {
    if (!API_KEY) {
        throw new Error("CHATBOT_API_KEY is not configured");
    }

    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: GENERATION_CONFIG,
    });

    // Try up to 2 times (initial + 1 retry for rate limits only)
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();

            console.log(`[LLM] Raw Gemini response (${text.length} chars):`, text.substring(0, 200));
            return text;

        } catch (error) {
            if (error.status === 429 && attempt === 0) {
                // Rate limited on first attempt — wait and retry once
                console.log(`[LLM] Rate limited, retrying in 2s...`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            // Log the error clearly
            if (error.status === 404) {
                console.error(`[LLM] Model "${MODEL_NAME}" not found. Check model availability.`);
            } else if (error.status === 429) {
                console.error(`[LLM] Rate limited even after retry. Try again later.`);
            } else if (error.status === 403) {
                console.error(`[LLM] API key invalid or insufficient permissions.`);
            } else {
                console.error(`[LLM] Gemini error:`, error.message);
            }
            throw error;
        }
    }
}

// ── System Prompts ────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a strict intent classifier and entity extractor for a college campus assistant chatbot.

Your ONLY job is to analyze the user's message and return a JSON object. Do NOT add any explanation, markdown, or extra text.

INTENT CATEGORIES (pick exactly one):
- faculty_info        → asking about a faculty member's details, designation, email, department
- faculty_location    → asking WHERE a faculty member is, their room, office, cabin
- faculty_presence    → asking IF a faculty member is available / present on campus
- department_info     → asking about a department (HOD, faculty list, count, details)
- bus_route_query     → asking about bus routes, bus numbers, stops, timings
- bus_live_status     → asking about live bus location or current status
- navigation_query    → asking for directions, how to reach a room/building/location on campus
- attendance_query    → asking about attendance records or status
- general_info        → general campus questions (not fitting above categories)
- greeting            → casual greetings like hi, hello, hey, good morning
- unknown             → completely off-topic or cannot be classified

ENTITY EXTRACTION RULES:
- Extract ONLY entities that are explicitly mentioned or clearly implied.
- Do NOT guess or fabricate entity values.
- For faculty names: extract the full name as mentioned. Include titles like "Dr." or "Prof." if present.
- IMPORTANT: Remove casual honorifics like "sir", "madam", "ma'am", "miss" from the extracted faculty_name. For example, "Nijil sir" should extract as "Nijil", "mubarak sir" as "mubarak".
- For department names: normalize to standard codes when possible (CSE, ECE, EEE, ME, CE, IT, AIDS, MBA, MCA).
- Leave entity fields as null if not mentioned.

RETURN FORMAT (JSON only, no markdown fences):
{
  "intent": "<one of the categories above>",
  "entities": {
    "faculty_name": "<string or null>",
    "department_name": "<string or null>",
    "bus_number": "<string or null>",
    "bus_destination": "<string or null>",
    "room_name": "<string or null>",
    "building_name": "<string or null>",
    "subject_name": "<string or null>",
    "designation": "<string or null>"
  }
}

IMPORTANT:
- Output ONLY the JSON object. No extra text before or after.
- If the user says something like "hi" or "hello", classify as "greeting". Do NOT match it to any faculty name.
- Never assume a short word is a person's name unless it clearly is.`;

const RESPONSE_PROMPT = `You are CampusNav AI.
Answer strictly based on database results.
Do not introduce yourself.
Keep answers under 3 sentences.
If no data found, say: 'No information available.'`;

// ── LLM Functions ─────────────────────────────────────────────────

/**
 * Extract intent and entities from user message using Gemini.
 * Returns structured JSON — no substring matching involved.
 * 
 * If Gemini fails → throws error (caller handles it).
 * Does NOT return placeholder "unknown" intent on failure.
 * 
 * @param {string} userMessage - Raw user message
 * @returns {Object} - { intent, entities }
 * @throws {Error} - If extraction fails
 */
async function extractIntentAndEntities(userMessage) {
    const responseText = await callGemini(
        EXTRACTION_PROMPT + "\n\nUser message: " + userMessage
    );

    // Strip markdown code fences if Gemini adds them
    const cleaned = responseText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    const parsed = JSON.parse(cleaned);

    console.log("[LLM] Extracted:", JSON.stringify(parsed, null, 2));
    return parsed;
}

/**
 * Format a natural language response from DB results using Gemini.
 * 
 * @param {string} userQuery - Original user question
 * @param {string} intent - Detected intent
 * @param {Array|Object|null} dbResults - Raw database results
 * @returns {string} - Formatted response string
 * @throws {Error} - If formatting fails
 */
async function formatResponse(userQuery, intent, dbResults) {
    // Handle empty results before calling Gemini
    if (!dbResults || (Array.isArray(dbResults) && dbResults.length === 0)) {
        return "No information available.";
    }

    const dataString = JSON.stringify(dbResults, null, 2);

    const prompt = `${RESPONSE_PROMPT}

User's question: "${userQuery}"
Intent: ${intent}

Data from database:
${dataString}

Generate your response:`;

    const reply = await callGemini(prompt);
    console.log("[LLM] Final reply:", reply);
    return reply;
}

module.exports = {
    extractIntentAndEntities,
    formatResponse,
};
