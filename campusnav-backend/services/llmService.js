/**
 * LLM Service — Gemini 2.0 Flash (Hybrid Query Pipeline)
 *
 * Hybrid approach for reliability:
 *   - Backend regex detects operation type (count, exists, findMany, findOne)
 *   - Gemini ONLY determines: collection + filter + projection
 *   - This eliminates the #1 failure mode: Gemini picking wrong operation
 *
 * Stage 1: detectOperation()    — regex-based, deterministic, instant
 * Stage 2: generateQueryPlan()  — Gemini builds collection + filter only
 * Stage 3: formatResponse()     — Gemini formats DB result into natural language
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Configuration ─────────────────────────────────────────────────
const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = process.env.CHATBOT_API_KEY;

if (!API_KEY) {
    console.error("[LLM] FATAL: CHATBOT_API_KEY is not set in .env");
} else {
    const masked = API_KEY.slice(0, 8) + "..." + API_KEY.slice(-4);
    console.log(`[LLM] API key loaded: ${masked}`);
    console.log(`[LLM] Model: ${MODEL_NAME}`);
}

const genAI = new GoogleGenerativeAI(API_KEY || "");

// ── Step 1: Backend Operation Detector ───────────────────────────
//
// Detect what the user wants to DO — not what they want to FIND.
// This is deterministic and never wrong.

const COUNT_PATTERNS = [
    /how many/i,
    /count of/i,
    /total (number|count|faculty|staff)/i,
    /number of (faculty|staff|professors|teachers|departments)/i,
    /\bcount\b/i,
];

const EXISTS_PATTERNS = [
    /is there (a|an|any)?\s*(faculty|teacher|professor|department|staff)/i,
    /does .*(exist|work|teach)/i,
    /do (they|you) have/i,
    /is .*(available|here|present)/i,
    /are there any/i,
    /\bexist/i,
];

const LIST_PATTERNS = [
    /list (all|the|every)/i,
    /show (all|me all|the list|every)/i,
    /give me (all|a list|the list)/i,
    /all (faculty|professors|teachers|staff|departments)/i,
    /who (all|are the|are all)/i,
];

const LOCATION_PATTERNS = [
    /where is/i,
    /which room/i,
    /location of/i,
    /find .*(sir|madam|professor|dr|faculty)/i,
    /where can i find/i,
];

/**
 * Detect the operation type from the user's message.
 * Returns one of: 'count' | 'exists' | 'findMany' | 'findOne' | 'location' | null
 * null means "let Gemini decide" (used for ambiguous questions)
 */
function detectOperation(message) {
    if (COUNT_PATTERNS.some(p => p.test(message))) return "count";
    if (EXISTS_PATTERNS.some(p => p.test(message))) return "exists";
    if (LIST_PATTERNS.some(p => p.test(message))) return "findMany";
    if (LOCATION_PATTERNS.some(p => p.test(message))) return "location";
    return null; // Gemini decides
}

// ── Step 2: Gemini Filter Builder Prompt ─────────────────────────
//
// Gemini's ONLY job here: figure out WHAT to search for (collection + filter).
// The operation has already been decided by backend regex above.

const FILTER_BUILDER_PROMPT = `You are CampusNav Filter Builder.

Your task is to build a MongoDB filter for the campusnav database.

You DO NOT decide the operation.
The backend has already decided the operation.
Your job is ONLY to determine:

- collection
- filter
- projection (if needed)

Database Collections:

1. faculties
   Fields:
   - name
   - designation
   - email
   - department
   - subjects
   - specialization
   - room_id
   - availability
   - facultyId

2. facultyLocations
   Fields:
   - facultyId
   - room
   - rssi
   - lastSeen
   - scannerId

STRICT RULES:

1. You MUST choose the correct collection.
   - Person queries → faculties
   - Location queries (where is / which room) → facultyLocations
   - Department existence queries → faculties (check department field)

2. ALWAYS use case-insensitive regex:
   { "$regex": "value", "$options": "i" }

3. Strip honorifics from names:
   sir, madam, ma'am, mam, miss, mr, dr
   Do NOT include them in the filter.

4. For HOD / Head:
   Use designation:
   { "$regex": "head|hod", "$options": "i" }

5. For department:
   Use department field:
   { "$regex": "CSE|ECE|ME|BME|etc", "$options": "i" }

6. NEVER return an empty collection.
7. NEVER default to faculties unless the query is clearly about a person.
8. NEVER invent fields that are not listed above.
9. If the query is not about database information, return:

{"error":"non_database_query"}

10. If you cannot determine the collection confidently, return:

{"error":"insufficient_information"}

Return ONLY valid JSON.
Do NOT include markdown.
Do NOT explain anything.
Do NOT include extra text.

Correct JSON format:

{
  "collection": "faculties | facultyLocations",
  "filter": {},
  "projection": {}
}

EXAMPLES:

Q: "how many faculty in CSE"
A: {"collection":"faculties","filter":{"department":{"$regex":"CSE","$options":"i"}},"projection":{}}

Q: "who is nijil sir"
A: {"collection":"faculties","filter":{"name":{"$regex":"nijil","$options":"i"}},"projection":{}}

Q: "HOD of CSE"
A: {"collection":"faculties","filter":{"designation":{"$regex":"head|hod","$options":"i"},"department":{"$regex":"CSE","$options":"i"}},"projection":{}}

Q: "is there a faculty named jomy in CSE"
A: {"collection":"faculties","filter":{"name":{"$regex":"jomy","$options":"i"},"department":{"$regex":"CSE","$options":"i"}},"projection":{}}

Q: "list professors in mechanical"
A: {"collection":"faculties","filter":{"department":{"$regex":"ME|mechanical","$options":"i"},"designation":{"$regex":"professor","$options":"i"}},"projection":{}}

Q: "where is nijil raj"
A: {"collection":"facultyLocations","filter":{"facultyId":{"$regex":"nijil","$options":"i"}},"projection":{}}

Q: "what is the email of mubarak"
A: {"collection":"faculties","filter":{"name":{"$regex":"mubarak","$options":"i"}},"projection":{"email":1,"name":1}}

Q: "is there a CSE department"
A: {"collection":"faculties","filter":{"department":{"$regex":"CSE","$options":"i"}},"projection":{}}

Q: "how many total faculty"
A: {"collection":"faculties","filter":{},"projection":{}}

Q: "what is the capital of France"
A: {"error":"non_database_query"}

Q: "tell me something"
A: {"error":"insufficient_information"}

Now answer:
`;

// ── Step 3: Response Formatter Prompt ────────────────────────────

const FORMAT_PROMPT = `You are CampusNav AI, a helpful assistant for college students.

Rules:
- Answer ONLY using the DATABASE RESULT provided below.
- Do NOT guess or fabricate anything.
- If result is a single person, give their name, designation, and department.
- If result is a list, summarize clearly: list each person on a new line or as a short sentence.
- Keep the answer under 3 sentences.
- Do NOT introduce yourself.
- Do NOT use markdown formatting (no **, no ##, no lists with -).
- If DATABASE RESULT is empty, respond: No information available.`;

// ── Gemini Call Helper ────────────────────────────────────────────

async function callGemini(prompt, configOverrides = {}) {
    if (!API_KEY) {
        throw new Error("CHATBOT_API_KEY is not configured");
    }

    const config = { ...{ temperature: 0.0, maxOutputTokens: 400 }, ...configOverrides };

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
                console.log("[LLM] Rate limited, retrying in 3s...");
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }
            console.error(`[LLM] Gemini error (${error.status || "unknown"}): ${error.message}`);
            throw error;
        }
    }
}

// ── Generate Query Plan (Hybrid) ──────────────────────────────────

/**
 * Build a complete query plan:
 *   - Backend detects operation type (reliable, instant)
 *   - Gemini builds the collection + filter (what to search for)
 *
 * @param {string} userQuery - Raw user message
 * @returns {Object} - { intent, collection, operation, filter, projection }
 */
async function generateQueryPlan(userQuery) {
    // Step A: Backend detects operation type
    const detectedOperation = detectOperation(userQuery);
    console.log(`[LLM] Backend detected operation: ${detectedOperation || "null (Gemini will decide)"}`);

    // Step B: Gemini builds collection + filter
    const prompt = `${FILTER_BUILDER_PROMPT}Q: "${userQuery}"\nA:`;
    const rawText = await callGemini(prompt, { temperature: 0.0, maxOutputTokens: 300 });

    console.log(`[LLM] Filter builder raw: ${rawText}`);

    const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    const filterPlan = JSON.parse(cleaned);

    // Step C: Handle error responses from filter builder
    if (filterPlan.error) {
        console.log(`[LLM] Filter builder returned error: ${filterPlan.error}`);
        return { intent: filterPlan.error };
    }

    // Step D: Validate — no silent fallback allowed
    if (!filterPlan.collection) {
        throw new Error("Filter builder did not return collection");
    }

    // Step E: Merge — backend operation takes priority
    const operation = detectedOperation || "findOne"; // default to findOne for specific questions
    const limit = (operation === "findMany") ? 20 : 10;

    const plan = {
        intent: "database_query",
        collection: filterPlan.collection,
        operation,
        filter: filterPlan.filter || {},
        projection: filterPlan.projection || {},
        aggregation: [],
        limit,
    };

    console.log(`[LLM] Final plan:`, JSON.stringify(plan));
    return plan;
}

// ── Format Response ───────────────────────────────────────────────

async function formatResponse(userQuery, dbResults) {
    if (!dbResults || (Array.isArray(dbResults) && dbResults.length === 0)) {
        return "No information available.";
    }

    const prompt = `${FORMAT_PROMPT}

USER QUERY: ${userQuery}

DATABASE RESULT:
${JSON.stringify(dbResults, null, 2)}

Answer:`;

    const reply = await callGemini(prompt, { temperature: 0.1, maxOutputTokens: 200 });
    console.log(`[LLM] Formatted: ${reply}`);
    return reply;
}

module.exports = {
    generateQueryPlan,
    formatResponse,
    detectOperation,
};
