/**
 * Response Formatter — Static Template-Based Formatting
 *
 * No LLM involvement. Every response is deterministic and instant.
 * Each tool has a dedicated formatter that produces clean text.
 *
 * Tools (10):
 *   get_faculty_email, get_faculty_location, get_faculty_designation,
 *   get_hod, count_faculty, list_faculty_by_department,
 *   get_faculty_phone, get_faculty_by_designation,
 *   get_faculty_room_number, get_department_info
 */

// ── Individual Formatters ────────────────────────────────────────

const FORMATTERS = {

    get_faculty_email(result) {
        if (result.count === 0) return "Faculty member not found.";
        const f = result.results[0];
        if (!f.email) return `${f.name || "That faculty member"}'s email is not available.`;
        return `${f.name}'s email is ${f.email}.`;
    },

    get_faculty_location(result) {
        const meta = result._meta || {};

        if (meta.type === "location_not_found") {
            return "Faculty member not found in our records.";
        }
        if (meta.type === "location_no_tracking") {
            const fac = meta.faculty;
            return `${fac.name} is in the ${fac.department} department, but no location tracking is set up for them.`;
        }
        if (result.count === 0) {
            const fac = meta.faculty;
            return `${fac.name} is registered but their current location is not available.`;
        }

        const loc = result.results[0];
        const fac = meta.faculty;
        const lastSeen = loc.lastSeen
            ? new Date(loc.lastSeen).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
            : "unknown time";
        return `${fac.name} was last seen in ${loc.room || "unknown room"} at ${lastSeen}.`;
    },

    get_faculty_designation(result) {
        if (result.count === 0) return "Faculty member not found.";
        const f = result.results[0];
        if (!f.designation) return `${f.name || "That faculty member"}'s designation is not available.`;
        return `${f.name} is ${f.designation} in the ${f.department || "unknown"} department.`;
    },

    get_hod(result) {
        if (result.count === 0) return "HOD information not found for that department.";
        const f = result.results[0];
        return `${f.name} is the ${f.designation || "Head"} of ${f.department || "that"} department.${f.email ? ` Email: ${f.email}.` : ""}`;
    },

    count_faculty(result) {
        if (result.count === 0) return "No faculty records found.";
        const data = result.results[0];
        const n = data.count;
        return `There ${n === 1 ? "is" : "are"} ${n} faculty member${n !== 1 ? "s" : ""}.`;
    },

    list_faculty_by_department(result) {
        if (result.count === 0) return "No faculty found in that department.";
        const list = result.results
            .map(f => `${f.name} — ${f.designation || "Faculty"}`)
            .join(". ");
        return `Found ${result.count} faculty member${result.count !== 1 ? "s" : ""}: ${list}.`;
    },

    get_faculty_phone(result) {
        if (result.count === 0) return "Faculty member not found.";
        const f = result.results[0];
        if (!f.phone) return `${f.name || "That faculty member"}'s phone number is not available.`;
        return `${f.name}'s phone number is ${f.phone}.`;
    },

    get_faculty_by_designation(result) {
        if (result.count === 0) return "No faculty found with that designation in the specified department.";
        const list = result.results
            .map(f => `${f.name} — ${f.department || ""}`)
            .join(". ");
        return `Found ${result.count}: ${list}.`;
    },

    get_faculty_room_number(result) {
        if (result.count === 0) return "Faculty member not found.";
        const f = result.results[0];
        if (!f.room_id) return `${f.name || "That faculty member"}'s room number is not available.`;
        return `${f.name}'s room number is ${f.room_id}.`;
    },

    get_department_info(result) {
        const meta = result._meta || {};
        if (result.count === 0) return "No information found for that department.";

        const dept = meta.department || "the requested";
        const total = meta.totalFaculty || result.count;
        const hod = meta.hod;

        let response = `${dept} department has ${total} faculty member${total !== 1 ? "s" : ""}.`;

        if (hod) {
            response += ` The HOD is ${hod.name}.`;
        }

        if (result.results.length > 0) {
            const names = result.results
                .slice(0, 10)
                .map(f => `${f.name} (${f.designation || "Faculty"})`)
                .join(", ");
            response += ` Faculty: ${names}.`;
        }

        return response;
    },
};

// ── Public API ───────────────────────────────────────────────────

function formatToolResult(toolName, result) {
    // Handle tool-level errors
    if (result.error) {
        return result.error;
    }

    const formatter = FORMATTERS[toolName];
    if (!formatter) {
        console.warn(`[Formatter] No formatter for tool: ${toolName}`);
        return "No information available.";
    }

    try {
        return formatter(result);
    } catch (err) {
        console.error(`[Formatter] Error formatting ${toolName}: ${err.message}`);
        return "No information available.";
    }
}

module.exports = { formatToolResult };
