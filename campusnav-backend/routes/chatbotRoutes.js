/**
 * Chatbot Routes
 * Stage 4: Score-Based Routing with Graceful Fallbacks
 * 
 * Uses NLP pipeline: Normalize → Extract Entities → Score Intents → Route
 */

const express = require("express");
const router = express.Router();
const Faculty = require("../models/faculty");

// Import NLP pipeline components
const { normalize, preprocess } = require("../utils/textUtils");
const { detectIntent, getClarificationMessage } = require("../utils/intentDetector");
const {
  extractDepartment,
  extractDesignation,
  extractName,
  extractSubject,
  extractAllEntities
} = require("../utils/entityExtractor");

// Location service for faculty tracking (READ-ONLY)
const { getFacultyLocationByName } = require("../services/locationService");

/**
 * Helper: Format relative time for last seen
 * @param {Date} date - Last seen timestamp
 * @returns {string} - Human readable time ago
 */
function getTimeAgo(date) {
  if (!date) return "unknown";

  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000); // seconds

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

// ============================================
// MAIN CHATBOT ENDPOINT
// ============================================

router.post("/", async (req, res) => {
  try {
    // Step 1: Normalize input (null-safe)
    const rawMessage = req.body.message || '';
    const normalizedMessage = normalize(rawMessage);

    // Handle empty messages
    if (!normalizedMessage || normalizedMessage.length < 2) {
      return res.json({
        reply: "Please type a question about faculty, departments, or academic staff."
      });
    }

    // Step 2: Extract entities
    const entities = extractAllEntities(normalizedMessage);

    // Step 3: Detect intent with scoring
    const intentResult = detectIntent(normalizedMessage);
    const { intent, confidence, isAmbiguous, needsClarification } = intentResult;

    // Step 4: Handle low confidence (ask for clarification)
    if (needsClarification && !entities.name && !entities.designation) {
      return res.json({
        reply: getClarificationMessage(intentResult.scores, entities)
      });
    }

    // Step 5: Route based on intent

    // ─────────────────────────────────────────
    // HOD QUERY
    // ─────────────────────────────────────────
    if (intent === 'HOD_QUERY' || entities.designation === 'hod') {
      const query = { designation: { $regex: "hod", $options: "i" } };

      // Filter by department if specified
      if (entities.department) {
        query.department = entities.department;
      }

      const hod = await Faculty.findOne(query);

      if (!hod) {
        const deptMsg = entities.department ? ` for ${entities.department}` : "";
        return res.json({
          reply: `Sorry, I couldn't find HOD information${deptMsg}. Please check the department name.`
        });
      }

      return res.json({
        reply: `${hod.name} is the HOD of ${hod.department} department.`
      });
    }

    // ─────────────────────────────────────────
    // DEAN QUERY
    // ─────────────────────────────────────────
    if (intent === 'DEAN_QUERY' || entities.designation === 'dean' || entities.designation === 'dean_academics') {
      const query = { designation: { $regex: "dean", $options: "i" } };

      const dean = await Faculty.findOne(query);

      if (!dean) {
        return res.json({
          reply: "Sorry, I couldn't find Dean information in the database."
        });
      }

      return res.json({
        reply: `${dean.name} is the ${dean.designation} in ${dean.department} department.`
      });
    }

    // ─────────────────────────────────────────
    // SUBJECT QUERY
    // ─────────────────────────────────────────
    if (intent === 'SUBJECT_QUERY' || entities.subject) {
      const subject = entities.subject || extractSubject(normalizedMessage);

      if (!subject) {
        return res.json({ reply: "Which subject are you asking about?" });
      }

      const faculty = await Faculty.findOne({
        subjects: { $regex: subject, $options: "i" }
      });

      if (!faculty) {
        return res.json({
          reply: `Sorry, I couldn't find a faculty teaching ${subject}.`
        });
      }

      return res.json({
        reply: `${faculty.name} teaches ${faculty.subjects || subject}.`
      });
    }

    // ─────────────────────────────────────────
    // FACULTY LOCATION (Phase-2: BLE Tracking)
    // READ-ONLY: Just query and format, no RSSI computation
    // ─────────────────────────────────────────
    if (intent === 'FACULTY_LOCATION') {
      const name = entities.name;

      if (!name || name.length < 2) {
        return res.json({
          reply: "Please specify which faculty member's location you want to find."
        });
      }

      // Query location from tracking data
      const locationData = await getFacultyLocationByName(name);

      if (!locationData) {
        // Fallback: check if faculty exists but has no location data
        const faculty = await Faculty.findOne({
          name: { $regex: name, $options: "i" }
        });

        if (faculty) {
          return res.json({
            reply: `${faculty.name}'s current location is not available. They may not have been detected by any scanner recently.`
          });
        }

        return res.json({
          reply: `Sorry, I couldn't find a faculty member matching "${name}".`
        });
      }

      // Format human-readable response
      const timeAgo = getTimeAgo(locationData.lastSeen);
      return res.json({
        reply: `${locationData.facultyName} is currently in ${locationData.room}. (Last seen: ${timeAgo})`
      });
    }

    // ─────────────────────────────────────────
    // FACULTY LOOKUP (by name)
    // ─────────────────────────────────────────
    if (intent === 'FACULTY_LOOKUP' || entities.name) {
      const name = entities.name;

      if (!name || name.length < 2) {
        return res.json({
          reply: "Please provide a faculty name to search."
        });
      }

      // Search by partial name match
      const faculty = await Faculty.findOne({
        name: { $regex: name, $options: "i" }
      });

      if (!faculty) {
        return res.json({
          reply: `Sorry, I couldn't find a faculty member matching "${name}". Please check the spelling.`
        });
      }

      // Build comprehensive response
      let response = `${faculty.name} is ${faculty.designation} in the ${faculty.department} department.`;
      if (faculty.email) {
        response += ` Email: ${faculty.email}`;
      }

      return res.json({ reply: response });
    }

    // ─────────────────────────────────────────
    // DESIGNATION QUERY
    // ─────────────────────────────────────────
    if (intent === 'DESIGNATION_QUERY') {
      const name = entities.name;

      if (name) {
        // Get designation of specific faculty
        const faculty = await Faculty.findOne({
          name: { $regex: name, $options: "i" }
        });

        if (!faculty) {
          return res.json({ reply: "Faculty not found." });
        }

        return res.json({
          reply: `${faculty.name} is working as ${faculty.designation} in the ${faculty.department} department.`
        });
      }

      // List all designations
      const faculties = await Faculty.find({}).limit(10);
      if (faculties.length === 0) {
        return res.json({ reply: "No faculty data available." });
      }

      return res.json({
        reply: faculties.map(f => ({
          name: f.name,
          designation: f.designation,
          department: f.department
        }))
      });
    }

    // ─────────────────────────────────────────
    // LIST FACULTY
    // ─────────────────────────────────────────
    if (intent === 'LIST_FACULTY') {
      const query = entities.department ? { department: entities.department } : {};
      const faculties = await Faculty.find(query).limit(20);

      if (!faculties.length) {
        const deptMsg = entities.department ? ` in ${entities.department}` : "";
        return res.json({ reply: `No faculty found${deptMsg}.` });
      }

      return res.json({ reply: faculties });
    }

    // ─────────────────────────────────────────
    // COUNT QUERY
    // ─────────────────────────────────────────
    if (intent === 'COUNT_QUERY') {
      const query = entities.department ? { department: entities.department } : {};
      const count = await Faculty.countDocuments(query);

      const deptMsg = entities.department ? ` in ${entities.department} department` : " in the database";
      return res.json({ reply: `There are ${count} faculty members${deptMsg}.` });
    }

    // ─────────────────────────────────────────
    // FALLBACK: Unknown or Ambiguous
    // ─────────────────────────────────────────

    // If we have some entities but no clear intent, try to help
    if (entities.department && !entities.name && !entities.designation) {
      // User mentioned a department but nothing else
      return res.json({
        reply: `You mentioned ${entities.department}. Would you like to know about the HOD, see the faculty list, or find a specific faculty member?`
      });
    }

    // Generic fallback
    return res.json({
      reply: "I'm not sure what you're looking for. You can ask me about:\n• HOD of a department (e.g., 'Who is HOD of CSE?')\n• Faculty member details (e.g., 'Tell me about Dr. Nijil Raj')\n• Dean or other designations"
    });

  } catch (err) {
    // Log error for debugging
    console.error('[Chatbot Error]', err.message);

    // NEVER return 500 for user input issues
    return res.json({
      reply: "Sorry, I encountered an issue processing your request. Please try rephrasing your question."
    });
  }
});

module.exports = router;
