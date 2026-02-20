/**
 * Tool Executor — Deterministic Tool-to-Query Mapper
 *
 * Each tool maps to a hardcoded, deterministic query plan.
 * No dynamic query generation. No LLM involvement.
 *
 * All query plans pass through databaseService.executeQueryPlan()
 * which handles security, sanitization, and validation.
 *
 * Tools (10):
 *   get_faculty_email, get_faculty_location, get_faculty_designation,
 *   get_hod, count_faculty, list_faculty_by_department,
 *   get_faculty_phone, get_faculty_by_designation,
 *   get_faculty_room_number, get_department_info
 */

const { executeQueryPlan } = require("./databaseService");

// ── Helper: Build case-insensitive regex filter ──────────────────

function iRegex(value) {
    return { $regex: value, $options: "i" };
}

// ── Custom Error Class ───────────────────────────────────────────

class ToolError extends Error {
    constructor(message) {
        super(message);
        this.name = "ToolError";
    }
}

// ── Tool Implementations ─────────────────────────────────────────

const TOOLS = {

    // ── 1. get_faculty_email ─────────────────────────────────────
    async get_faculty_email({ faculty_name }) {
        if (!faculty_name) throw new ToolError("Faculty name is required.");

        return executeQueryPlan({
            collection: "faculties",
            operation: "findOne",
            filter: { name: iRegex(faculty_name) },
            projection: { name: 1, email: 1 },
            limit: 1,
        });
    },

    // ── 2. get_faculty_location ──────────────────────────────────
    async get_faculty_location({ faculty_name }) {
        if (!faculty_name) throw new ToolError("Faculty name is required.");

        // Step 1: Find faculty record to get facultyId
        const facultyResult = await executeQueryPlan({
            collection: "faculties",
            operation: "findOne",
            filter: { name: iRegex(faculty_name) },
            projection: { name: 1, facultyId: 1, department: 1 },
            limit: 1,
        });

        if (!facultyResult.results || facultyResult.results.length === 0) {
            return { results: [], count: 0, _meta: { type: "location_not_found" } };
        }

        const faculty = facultyResult.results[0];
        if (!faculty.facultyId) {
            return {
                results: [faculty],
                count: 1,
                _meta: { type: "location_no_tracking", faculty },
            };
        }

        // Step 2: Look up BLE location
        const locationResult = await executeQueryPlan({
            collection: "facultyLocations",
            operation: "findOne",
            filter: { facultyId: faculty.facultyId },
            projection: { room: 1, lastSeen: 1 },
            limit: 1,
        });

        return {
            results: locationResult.results,
            count: locationResult.count,
            _meta: { type: "location", faculty },
        };
    },

    // ── 3. get_faculty_designation ────────────────────────────────
    async get_faculty_designation({ faculty_name }) {
        if (!faculty_name) throw new ToolError("Faculty name is required.");

        return executeQueryPlan({
            collection: "faculties",
            operation: "findOne",
            filter: { name: iRegex(faculty_name) },
            projection: { name: 1, designation: 1, department: 1 },
            limit: 1,
        });
    },

    // ── 4. get_hod ───────────────────────────────────────────────
    async get_hod({ department }) {
        if (!department) throw new ToolError("Department is required.");

        return executeQueryPlan({
            collection: "faculties",
            operation: "findOne",
            filter: {
                designation: iRegex("head|hod"),
                department: iRegex(department),
            },
            projection: {},
            limit: 1,
        });
    },

    // ── 5. count_faculty ─────────────────────────────────────────
    async count_faculty({ department }) {
        const filter = department ? { department: iRegex(department) } : {};

        return executeQueryPlan({
            collection: "faculties",
            operation: "count",
            filter,
            projection: {},
        });
    },

    // ── 6. list_faculty_by_department ─────────────────────────────
    async list_faculty_by_department({ department }) {
        if (!department) throw new ToolError("Department is required.");

        return executeQueryPlan({
            collection: "faculties",
            operation: "findMany",
            filter: { department: iRegex(department) },
            projection: { name: 1, designation: 1, department: 1, email: 1 },
            limit: 20,
        });
    },

    // ── 7. get_faculty_phone ─────────────────────────────────────
    async get_faculty_phone({ faculty_name }) {
        if (!faculty_name) throw new ToolError("Faculty name is required.");

        return executeQueryPlan({
            collection: "faculties",
            operation: "findOne",
            filter: { name: iRegex(faculty_name) },
            projection: { name: 1, phone: 1 },
            limit: 1,
        });
    },

    // ── 8. get_faculty_by_designation ─────────────────────────────
    async get_faculty_by_designation({ department, designation }) {
        if (!department) throw new ToolError("Department is required.");
        if (!designation) throw new ToolError("Designation is required.");

        return executeQueryPlan({
            collection: "faculties",
            operation: "findMany",
            filter: {
                department: iRegex(department),
                designation: iRegex(designation),
            },
            projection: { name: 1, designation: 1, department: 1, email: 1 },
            limit: 20,
        });
    },

    // ── 9. get_faculty_room_number ────────────────────────────────
    async get_faculty_room_number({ faculty_name }) {
        if (!faculty_name) throw new ToolError("Faculty name is required.");

        return executeQueryPlan({
            collection: "faculties",
            operation: "findOne",
            filter: { name: iRegex(faculty_name) },
            projection: { name: 1, room_id: 1 },
            limit: 1,
        });
    },

    // ── 10. get_department_info ───────────────────────────────────
    async get_department_info({ department }) {
        if (!department) throw new ToolError("Department is required.");

        // Get all faculty in the department to summarize
        const facultyResult = await executeQueryPlan({
            collection: "faculties",
            operation: "findMany",
            filter: { department: iRegex(department) },
            projection: { name: 1, designation: 1, email: 1 },
            limit: 20,
        });

        // Also get HOD specifically
        const hodResult = await executeQueryPlan({
            collection: "faculties",
            operation: "findOne",
            filter: {
                department: iRegex(department),
                designation: iRegex("head|hod"),
            },
            projection: { name: 1, designation: 1 },
            limit: 1,
        });

        return {
            results: facultyResult.results,
            count: facultyResult.count,
            _meta: {
                type: "department_info",
                department,
                hod: hodResult.results.length > 0 ? hodResult.results[0] : null,
                totalFaculty: facultyResult.count,
            },
        };
    },
};

// ── Public API ───────────────────────────────────────────────────

async function executeTool(toolName, args) {
    const toolFn = TOOLS[toolName];
    if (!toolFn) {
        throw new ToolError(`Unknown tool: "${toolName}"`);
    }

    console.log(`[ToolExec] Executing: ${toolName}(${JSON.stringify(args)})`);

    try {
        const result = await toolFn(args);
        console.log(`[ToolExec] ✅ ${toolName} returned ${result.count} result(s)`);
        return result;
    } catch (error) {
        if (error instanceof ToolError) {
            console.log(`[ToolExec] ⚠️  ${toolName}: ${error.message}`);
            return { results: [], count: 0, error: error.message };
        }
        throw error;
    }
}

module.exports = { executeTool, ToolError };
