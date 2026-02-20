/**
 * LLM Service — GPT-4o Mini via GitHub Models (Function-Calling Mode)
 *
 * Single responsibility: Accept user message → return tool selection.
 *
 * Uses OpenAI-compatible function-calling API via GitHub Models:
 *   - Endpoint: https://models.inference.ai.azure.com
 *   - Model: gpt-4o-mini
 *   - Auth: GitHub Personal Access Token
 *
 * The LLM NEVER:
 *   - Sees database results
 *   - Formats responses
 *   - Decides MongoDB operations
 */

const OpenAI = require("openai");

// ── Configuration ─────────────────────────────────────────────────
const MODEL_NAME = "gpt-4o-mini";
const API_KEY = process.env.CHATBOT_API_KEY;

if (!API_KEY) {
    console.error("[LLM] FATAL: CHATBOT_API_KEY is not set in .env");
} else {
    const masked = API_KEY.slice(0, 15) + "..." + API_KEY.slice(-4);
    console.log(`[LLM] API key loaded: ${masked}`);
    console.log(`[LLM] Model: ${MODEL_NAME}`);
}

const client = new OpenAI({
    baseURL: "https://models.inference.ai.azure.com",
    apiKey: API_KEY || "",
});

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

// ── Tool Declarations (OpenAI function-calling format) ───────────

const TOOLS = [
    {
        type: "function",
        function: {
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
    },
    {
        type: "function",
        function: {
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
    },
    {
        type: "function",
        function: {
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
    },
    {
        type: "function",
        function: {
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
    },
    {
        type: "function",
        function: {
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
    },
    {
        type: "function",
        function: {
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
    },
    {
        type: "function",
        function: {
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
    },
    {
        type: "function",
        function: {
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
    },
    {
        type: "function",
        function: {
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
    },
    {
        type: "function",
        function: {
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
    },
    {
        type: "function",
        function: {
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
    },
];

// ── selectTool (single LLM call) ────────────────────────────────

async function selectTool(userMessage) {
    if (!API_KEY) {
        throw new Error("CHATBOT_API_KEY is not configured");
    }

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await client.chat.completions.create({
                model: MODEL_NAME,
                messages: [
                    { role: "system", content: SYSTEM_INSTRUCTION },
                    { role: "user", content: userMessage },
                ],
                tools: TOOLS,
                tool_choice: "required",
                temperature: 0.0,
                max_tokens: 100,
            });

            const choice = response.choices?.[0];
            const toolCall = choice?.message?.tool_calls?.[0];

            if (toolCall?.function) {
                const name = toolCall.function.name;
                let args = {};
                try {
                    args = JSON.parse(toolCall.function.arguments || "{}");
                } catch {
                    args = {};
                }
                console.log(`[LLM] Function call: ${name}(${JSON.stringify(args)})`);
                return { tool: name, args };
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
            console.error(`[LLM] GPT error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = { selectTool };
