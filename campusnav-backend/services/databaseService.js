/**
 * Database Service — Direct MongoDB Atlas Queries
 * 
 * Clean, focused query functions for each intent type.
 * All queries use the shared Mongoose connection (Atlas).
 * No collection discovery, no generic queries — direct and predictable.
 */

const Faculty = require("../models/faculty");
const FacultyLocation = require("../models/facultylocation");

// ── Regex Escape ──────────────────────────────────────────────────

function escapeRegex(str) {
    if (!str || typeof str !== "string") return "";
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Token-Based Name Search ───────────────────────────────────────

/**
 * Build a MongoDB query that matches each name token independently.
 * "Nijil" matches "Dr. Nijil Raj N", "nijil raj" also matches.
 * 
 * @param {string} name - Extracted name (may have multiple words)
 * @returns {Object|null} - MongoDB query object or null
 */
function buildNameQuery(name) {
    if (!name || name.trim().length < 2) return null;

    const tokens = name.trim().split(/\s+/).filter(t => t.length >= 2);
    if (tokens.length === 0) return null;

    if (tokens.length === 1) {
        return { name: { $regex: escapeRegex(tokens[0]), $options: "i" } };
    }

    return {
        $and: tokens.map(token => ({
            name: { $regex: escapeRegex(token), $options: "i" },
        })),
    };
}

// ── Query Functions ───────────────────────────────────────────────

/**
 * Find faculty by name (partial/fuzzy match).
 */
async function queryFacultyByName(name) {
    const query = buildNameQuery(name);
    if (!query) return { results: [], count: 0 };

    console.log(`[DB] Faculty name query:`, JSON.stringify(query));
    const results = await Faculty.find(query).limit(5).lean();
    console.log(`[DB] Found ${results.length} faculty matching "${name}"`);
    return { results, count: results.length };
}

/**
 * Find faculty by designation, optionally filtered by department.
 * Used for HOD, Dean, Principal queries.
 */
async function queryFacultyByDesignation(designation, department) {
    const query = {};

    // Map canonical designations to regex patterns
    const designationPatterns = {
        hod: "head|hod",
        dean: "dean",
        dean_academics: "dean.*academic|academic.*dean",
        principal: "principal",
        professor: "professor",
        associate_professor: "associate.*professor",
        assistant_professor: "assistant.*professor",
        lecturer: "lecturer",
    };

    const pattern = designationPatterns[designation] || escapeRegex(designation);
    query.designation = { $regex: pattern, $options: "i" };

    if (department) {
        query.department = { $regex: `^${escapeRegex(department)}$`, $options: "i" };
    }

    console.log(`[DB] Designation query:`, JSON.stringify(query));
    const results = await Faculty.find(query).limit(10).lean();
    console.log(`[DB] Found ${results.length} faculty with designation "${designation}"`);
    return { results, count: results.length };
}

/**
 * List faculty in a department.
 */
async function queryFacultyByDepartment(department) {
    const query = {
        department: { $regex: `^${escapeRegex(department)}$`, $options: "i" },
    };

    console.log(`[DB] Department query:`, JSON.stringify(query));
    const results = await Faculty.find(query).limit(20).lean();
    console.log(`[DB] Found ${results.length} faculty in "${department}"`);
    return { results, count: results.length };
}

/**
 * Find faculty by subject.
 */
async function queryFacultyBySubject(subject) {
    const query = {
        subjects: { $regex: escapeRegex(subject), $options: "i" },
    };

    console.log(`[DB] Subject query:`, JSON.stringify(query));
    const results = await Faculty.find(query).limit(5).lean();
    console.log(`[DB] Found ${results.length} faculty teaching "${subject}"`);
    return { results, count: results.length };
}

/**
 * Get faculty location (BLE tracking data).
 */
async function queryFacultyLocation(name) {
    const nameQuery = buildNameQuery(name);
    if (!nameQuery) return { results: [], count: 0 };

    const faculty = await Faculty.findOne(nameQuery).lean();
    if (!faculty) {
        console.log(`[DB] No faculty found matching "${name}" for location`);
        return { results: [], count: 0 };
    }

    console.log(`[DB] Found faculty "${faculty.name}" — looking up location`);

    // Try by _id, then by facultyId field, then by first name
    let location = await FacultyLocation.findOne({
        facultyId: faculty._id.toString(),
    }).lean();

    if (!location && faculty.facultyId) {
        location = await FacultyLocation.findOne({
            facultyId: faculty.facultyId,
        }).lean();
    }

    if (!location) {
        const firstName = faculty.name.split(" ")[0];
        location = await FacultyLocation.findOne({
            facultyId: { $regex: escapeRegex(firstName), $options: "i" },
        }).lean();
    }

    if (location) {
        console.log(`[DB] Location found: room="${location.room}"`);
        return {
            results: [{
                name: faculty.name,
                department: faculty.department,
                room: location.room,
                lastSeen: location.lastSeen,
            }],
            count: 1,
        };
    }

    // Faculty exists but no location data
    console.log(`[DB] Faculty "${faculty.name}" found but no location tracking data`);
    return {
        results: [{
            name: faculty.name,
            department: faculty.department,
            room: null,
            lastSeen: null,
            note: "Location not available. Faculty may not have been detected by any scanner recently.",
        }],
        count: 1,
    };
}

/**
 * Count faculty, optionally filtered by department.
 */
async function countFaculty(department) {
    const query = department
        ? { department: { $regex: `^${escapeRegex(department)}$`, $options: "i" } }
        : {};

    const count = await Faculty.countDocuments(query);
    console.log(`[DB] Faculty count${department ? ` in ${department}` : ""}: ${count}`);
    return { count };
}

/**
 * Get all faculty (optionally filtered by department).
 */
async function queryAllFaculty(department) {
    const query = department
        ? { department: { $regex: `^${escapeRegex(department)}$`, $options: "i" } }
        : {};

    const results = await Faculty.find(query).limit(20).lean();
    return { results, count: results.length };
}

module.exports = {
    queryFacultyByName,
    queryFacultyByDesignation,
    queryFacultyByDepartment,
    queryFacultyBySubject,
    queryFacultyLocation,
    countFaculty,
    queryAllFaculty,
    escapeRegex,
};
