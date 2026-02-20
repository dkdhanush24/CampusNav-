/**
 * LLM Service — Gemini Function-Calling Mode
 *
 * Single responsibility: Accept user message → return tool selection.
 *
 * Uses Gemini's native function-calling API:
 *   - Tool schemas are declared to the model
 *   - Model returns structured function_call objects
 *   - No JSON parsing, no regex, no prompt engineering for structure
 *
 * The LLM NEVER:
 *   - Sees database results
 *   - Formats responses
 *   - Decides MongoDB operations
 *
 * Tools (10):
 *   get_faculty_email, get_faculty_location, get_faculty_designation,
 *   get_hod, count_faculty, list_faculty_by_department,
 *   get_faculty_phone, get_faculty_by_designation,
 *   get_faculty_room_number, get_department_info
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

// ── System Instruction ───────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are CampusNav AI, a campus assistant for a college.

Your ONLY job is to select the correct tool and extract parameters from the user's query.

Rules:
1. ALWAYS call a tool if the query is about faculty, departments, or campus.
2. Strip honorifics (Sir, Madam, Dr, Mr, Mrs, Miss, Ma'am, Mam) from faculty names before passing them.
3. If the user greets you (hi, hello, hey, good morning, good afternoon, good evening, howdy, sup, yo, etc.), call the "none" tool with reason "greeting".
4. If the query is not campus-related (e.g., general knowledge, math, politics), call the "none" tool with reason "off_topic".
5. If the query is too vague to determine a tool, call the "none" tool with reason "unclear".
6. NEVER fabricate information. Only select from available tools.
7. For "where is [name]" or "find [name]" → use get_faculty_location.
8. For "who is the HOD of [dept]" → use get_hod.
9. For "how many faculty in [dept]" → use count_faculty.
10. For "list all faculty in [dept]" → use list_faculty_by_department.
11. For "tell me about [dept] department" → use get_department_info.
12. For "email of [name]" → use get_faculty_email.
13. For "designation of [name]" or "who is [name]" → use get_faculty_designation.
14. For "room of [name]" or "office of [name]" → use get_faculty_room_number.
15. For "phone of [name]" or "contact of [name]" → use get_faculty_phone.
16. For "professors in [dept]" or "[designation] in [dept]" → use get_faculty_by_designation.`;

// ── Tool Declarations (Gemini function-calling format) ───────────

const TOOL_DECLARATIONS = [
    {
        name: "get_faculty_email",
        description: "Get the email address of a specific faculty member.",
        parameters: {
            type: "object",
            properties: {
                faculty_name: { type: "string", description: "Faculty member name (no honorifics)" },
            },
            required: ["faculty_name"],
        },
    },
    {
        name: "get_faculty_location",
        description: "Get current real-time BLE location of a faculty member (which room they are in right now).",
        parameters: {
            type: "object",
            properties: {
                faculty_name: { type: "string", description: "Faculty member name (no honorifics)" },
            },
            required: ["faculty_name"],
        },
    },
    {
        name: "get_faculty_designation",
        description: "Get the designation/title/position of a specific faculty member, or general info about who a faculty member is.",
        parameters: {
            type: "object",
            properties: {
                faculty_name: { type: "string", description: "Faculty member name (no honorifics)" },
            },
            required: ["faculty_name"],
        },
    },
    {
        name: "get_hod",
        description: "Get the Head of Department (HOD) for a specific department.",
        parameters: {
            type: "object",
            properties: {
                department: { type: "string", description: "Department name or abbreviation (e.g., CSE, ECE, ME, BME)" },
            },
            required: ["department"],
        },
    },
    {
        name: "count_faculty",
        description: "Count the total number of faculty members, optionally filtered by department.",
        parameters: {
            type: "object",
            properties: {
                department: { type: "string", description: "Optional department name to filter the count" },
            },
            required: [],
        },
    },
    {
        name: "list_faculty_by_department",
        description: "List all faculty members in a specific department with their names and designations.",
        parameters: {
            type: "object",
            properties: {
                department: { type: "string", description: "Department name or abbreviation" },
            },
            required: ["department"],
        },
    },
    {
        name: "get_faculty_phone",
        description: "Get the phone/contact number of a faculty member.",
        parameters: {
            type: "object",
            properties: {
                faculty_name: { type: "string", description: "Faculty member name (no honorifics)" },
            },
            required: ["faculty_name"],
        },
    },
    {
        name: "get_faculty_by_designation",
        description: "Find faculty members with a specific designation in a department (e.g., all Professors in CSE, Assistant Professors in ECE).",
        parameters: {
            type: "object",
            properties: {
                department: { type: "string", description: "Department name or abbreviation" },
                designation: { type: "string", description: "Designation to search for (e.g., Professor, Assistant Professor, Associate Professor)" },
            },
            required: ["department", "designation"],
        },
    },
    {
        name: "get_faculty_room_number",
        description: "Get the assigned room/office number of a faculty member.",
        parameters: {
            type: "object",
            properties: {
                faculty_name: { type: "string", description: "Faculty member name (no honorifics)" },
            },
            required: ["faculty_name"],
        },
    },
    {
        name: "get_department_info",
        description: "Get information about a department including HOD, total faculty count, and faculty list.",
        parameters: {
            type: "object",
            properties: {
                department: { type: "string", description: "Department name or abbreviation (e.g., CSE, ECE, ME, BME)" },
            },
            required: ["department"],
        },
    },
    {
        name: "none",
        description: "Use when the query is a greeting, off-topic (not campus-related), or too unclear to determine a campus tool.",
        parameters: {
            type: "object",
            properties: {
                reason: {
                    type: "string",
                    enum: ["greeting", "off_topic", "unclear"],
                    description: "Why no campus tool applies",
                },
            },
            required: ["reason"],
        },
    },
];

// ── selectTool (single LLM call) ────────────────────────────────

async function selectTool(userMessage) {
    if (!API_KEY) {
        throw new Error("CHATBOT_API_KEY is not configured");
    }

    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 100,
        },
        // Force the model to always call a function
        toolConfig: {
            functionCallingConfig: { mode: "ANY" },
        },
    });

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const result = await model.generateContent(userMessage);
            const response = result.response;
            const candidate = response.candidates?.[0];
            const part = candidate?.content?.parts?.[0];

            if (part?.functionCall) {
                const { name, args } = part.functionCall;
                console.log(`[LLM] Function call: ${name}(${JSON.stringify(args)})`);
                return { tool: name, args: args || {} };
            }

            // Model returned text instead of function call — treat as unclear
            console.warn("[LLM] Model returned text instead of function call");
            return { tool: "none", args: { reason: "unclear" } };

        } catch (error) {
            if (error.status === 429 && attempt === 0) {
                console.log("[LLM] Rate limited, retrying in 3s...");
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }
            console.error(`[LLM] Gemini error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = { selectTool };
