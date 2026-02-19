/**
 * LLM Service — Gemini 2.0 Flash (Two-Stage Pipeline)
 *
 * Stage 1: generateQueryPlan() — Understands the user's question (spelling mistakes,
 *          paraphrasing, vague phrasing) and converts it to an exact MongoDB query plan.
 *
 * Stage 2: formatResponse() — Takes the raw DB result and converts it into a
 *          natural language answer for the student.
 *
 * If either stage fails → caller uses fallback.
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

// ── Stage 1: Query Planner Prompt (Few-Shot) ──────────────────────
//
// The KEY to reliability is EXAMPLES. Gemini learns the correct
// operation (count vs findMany vs findOne) from seeing concrete
// examples of each — not from rules alone.

const QUERY_PLANNER_PROMPT = `You are the CampusNav Query Planner AI.

You are given a question from a college student about their campus.
Your ONLY job is to convert the student's question into a MongoDB query plan.

CAMPUS DATABASE (campusnav):

Collection: faculties
Fields: name, designation, email, department, subjects, specialization, room_id, availability, facultyId
Departments in DB (use exact casing): CSE, ECE, EEE, ME, CE, IT, MCA, MBA, Science, Humanities

Collection: facultyLocations
Fields: facultyId, room, rssi, lastSeen, scannerId, tagId

Rules for building the filter:
- For name matching, always use regex: { "name": { "$regex": "raw_name_here", "$options": "i" } }
- Remove honorifics from names: sir, madam, ma'am, miss, mr, mam → DO NOT include them in the filter
- For designation (HOD, Head, Dean, Professor, etc.), use regex on the designation field
- For HOD queries: { "designation": { "$regex": "head|hod", "$options": "i" } }
- For department queries, use regex on department field
- You may combine multiple filter conditions in the same object

OPERATION GUIDE (read carefully):
- use "count"   → when user asks: how many, count of, total number, number of
- use "exists"  → when user asks: is there, does X exist, is X available, do they have
- use "findOne" → when user asks: who is, tell me about, what is the email/designation of a specific person
- use "findMany"→ when user asks: list all, show all, give me all, which faculty, all professors
- use "aggregate" → when user asks: how many per department, group by, average, summary

Output ONLY valid JSON. No explanation. No markdown. No code fences.

If the question is NOT about campus information (e.g., "what is 2+2", "who is the president", "write a poem") return:
{ "intent": "non_campus_query" }

Otherwise return:
{
  "intent": "database_query",
  "collection": "faculties | facultyLocations",
  "operation": "findOne | findMany | count | exists | aggregate",
  "filter": {},
  "projection": {},
  "aggregation": [],
  "limit": 10
}

============================================================
EXAMPLES — study these carefully before answering:
============================================================

Q: "how many faculty in CSE"
A: {"intent":"database_query","collection":"faculties","operation":"count","filter":{"department":{"$regex":"CSE","$options":"i"}},"projection":{},"aggregation":[],"limit":10}

Q: "how many faculties are there in the cse department"
A: {"intent":"database_query","collection":"faculties","operation":"count","filter":{"department":{"$regex":"CSE","$options":"i"}},"projection":{},"aggregation":[],"limit":10}

Q: "total number of professors in mechanical"
A: {"intent":"database_query","collection":"faculties","operation":"count","filter":{"department":{"$regex":"ME|mechanical","$options":"i"},"designation":{"$regex":"professor","$options":"i"}},"projection":{},"aggregation":[],"limit":10}

Q: "who is nijil sir"
A: {"intent":"database_query","collection":"faculties","operation":"findOne","filter":{"name":{"$regex":"nijil","$options":"i"}},"projection":{},"aggregation":[],"limit":1}

Q: "tell me about mubarak"
A: {"intent":"database_query","collection":"faculties","operation":"findOne","filter":{"name":{"$regex":"mubarak","$options":"i"}},"projection":{},"aggregation":[],"limit":1}

Q: "who is the HOD of CSE"
A: {"intent":"database_query","collection":"faculties","operation":"findOne","filter":{"designation":{"$regex":"head|hod","$options":"i"},"department":{"$regex":"CSE","$options":"i"}},"projection":{},"aggregation":[],"limit":1}

Q: "whos the hod of computer science"
A: {"intent":"database_query","collection":"faculties","operation":"findOne","filter":{"designation":{"$regex":"head|hod","$options":"i"},"department":{"$regex":"CSE|computer","$options":"i"}},"projection":{},"aggregation":[],"limit":1}

Q: "list all faculty in ECE department"
A: {"intent":"database_query","collection":"faculties","operation":"findMany","filter":{"department":{"$regex":"ECE","$options":"i"}},"projection":{},"aggregation":[],"limit":20}

Q: "show me all professors in ME"
A: {"intent":"database_query","collection":"faculties","operation":"findMany","filter":{"department":{"$regex":"ME|mechanical","$options":"i"},"designation":{"$regex":"professor","$options":"i"}},"projection":{},"aggregation":[],"limit":20}

Q: "is there a faculty named jomy in CSE"
A: {"intent":"database_query","collection":"faculties","operation":"exists","filter":{"name":{"$regex":"jomy","$options":"i"},"department":{"$regex":"CSE","$options":"i"}},"projection":{},"aggregation":[],"limit":1}

Q: "does nijil raj teach in this college"
A: {"intent":"database_query","collection":"faculties","operation":"exists","filter":{"name":{"$regex":"nijil","$options":"i"}},"projection":{},"aggregation":[],"limit":1}

Q: "is there a CSE department"
A: {"intent":"database_query","collection":"faculties","operation":"exists","filter":{"department":{"$regex":"CSE","$options":"i"}},"projection":{},"aggregation":[],"limit":1}

Q: "where is nijil raj now"
A: {"intent":"database_query","collection":"facultyLocations","operation":"findOne","filter":{"facultyId":{"$regex":"nijil","$options":"i"}},"projection":{},"aggregation":[],"limit":1}

Q: "what is the email of mubarak"
A: {"intent":"database_query","collection":"faculties","operation":"findOne","filter":{"name":{"$regex":"mubarak","$options":"i"}},"projection":{"email":1,"name":1},"aggregation":[],"limit":1}

Q: "how many departments have faculty"
A: {"intent":"database_query","collection":"faculties","operation":"aggregate","filter":{},"projection":{},"aggregation":[{"$group":{"_id":"$department","count":{"$sum":1}}},{"$sort":{"count":-1}}],"limit":20}

Q: "hello"
A: {"intent":"non_campus_query"}

Q: "what is the capital of france"
A: {"intent":"non_campus_query"}

Q: "who is the prime minister of india"
A: {"intent":"non_campus_query"}

============================================================
Now answer the following student question:
============================================================`;

// ── Stage 2: Response Formatter Prompt ────────────────────────────

const FORMAT_PROMPT = `You are CampusNav AI, a helpful assistant for college students.

Rules:
- Answer ONLY using the data in DATABASE RESULT below.
- Do NOT guess, fabricate, or add information not in the result.
- If the result is a count, say the number clearly: "There are X faculty in the Y department."
- If the result is exists:true, confirm it exists. If exists:false, say it does not.
- If the result is a list, summarize it clearly and concisely.
- If the result is a single person, give their name, designation, and department.
- Keep the answer under 3 sentences.
- Do NOT introduce yourself.
- Do NOT add extra context.
- Do NOT use markdown formatting.
- If DATABASE RESULT is empty, respond: No information available.`;

// ── Gemini Call Helper ────────────────────────────────────────────

async function callGemini(prompt, configOverrides = {}) {
    if (!API_KEY) {
        throw new Error("CHATBOT_API_KEY is not configured");
    }

    const config = { ...{ temperature: 0.1, maxOutputTokens: 400 }, ...configOverrides };

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

async function generateQueryPlan(userQuery) {
    const prompt = `${QUERY_PLANNER_PROMPT}\n\nQ: "${userQuery}"\nA:`;

    const rawText = await callGemini(prompt, { temperature: 0.0, maxOutputTokens: 400 });

    console.log(`[LLM] Query plan raw: ${rawText}`);

    // Strip markdown fences if Gemini adds them despite instructions
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
    console.log(`[LLM] Formatted response: ${reply}`);
    return reply;
}

module.exports = {
    generateQueryPlan,
    formatResponse,
};
