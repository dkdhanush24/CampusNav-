const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Faculty = require("../models/faculty");
const FacultyLocation = require("../models/facultylocation");
const authMiddleware = require("../middleware/authMiddleware");

const JWT_SECRET = process.env.JWT_SECRET || "campusnav_jwt_secret_2026";

// ── GET all faculty ──────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const faculty = await Faculty.find().sort({ name: 1 });
    res.json(faculty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/faculty/login ──────────────────────────────────────
// Optional login — only for faculty who want to control their status.
// Not required to use the app.
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Username and password are required."
      });
    }

    const faculty = await Faculty.findOne({ username });
    if (!faculty) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials."
      });
    }

    const isMatch = await bcrypt.compare(password, faculty.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials."
      });
    }

    // Generate JWT (expires in 24 hours)
    const token = jwt.sign(
      {
        id: faculty._id.toString(),
        facultyId: faculty.facultyId,
        name: faculty.name
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log(`[Faculty Auth] Login success: ${faculty.name}`);

    return res.json({
      success: true,
      token,
      faculty: {
        id: faculty._id,
        name: faculty.name,
        department: faculty.department,
        status: faculty.status || "available"
      }
    });
  } catch (err) {
    console.error("[Faculty Auth] Login error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/faculty/status ─────────────────────────────────────
// JWT-protected — update faculty status (available/busy/private_break)
router.post("/status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["available", "busy", "private_break"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      });
    }

    const faculty = await Faculty.findByIdAndUpdate(
      req.faculty.id,
      {
        $set: {
          status,
          statusUpdatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!faculty) {
      return res.status(404).json({
        success: false,
        error: "Faculty not found."
      });
    }

    console.log(`[Faculty Status] ${faculty.name} → ${status}`);

    return res.json({
      success: true,
      status: faculty.status,
      statusUpdatedAt: faculty.statusUpdatedAt
    });
  } catch (err) {
    console.error("[Faculty Status] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/faculty/logout ─────────────────────────────────────
// JWT-protected — reset status to available on logout
router.post("/logout", authMiddleware, async (req, res) => {
  try {
    await Faculty.findByIdAndUpdate(req.faculty.id, {
      $set: {
        status: "available",
        statusUpdatedAt: new Date()
      }
    });

    console.log(`[Faculty Auth] Logout: ${req.faculty.name} → status reset to available`);

    return res.json({ success: true, message: "Logged out. Status reset to available." });
  } catch (err) {
    console.error("[Faculty Auth] Logout error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/faculty/:id/status ──────────────────────────────────
// Public endpoint — students can view faculty status.
// Applies privacy logic: if private_break, room is hidden.
router.get("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;

    // Find the faculty document
    let faculty;
    if (mongoose.Types.ObjectId.isValid(id)) {
      faculty = await Faculty.findById(id);
    }
    if (!faculty) {
      faculty = await Faculty.findOne({ facultyId: id });
    }

    if (!faculty) {
      return res.status(404).json({
        success: false,
        error: "Faculty not found"
      });
    }

    const status = faculty.status || "available";

    // Get live BLE location
    let room = null;
    if (status !== "private_break") {
      let location;
      if (faculty.facultyId) {
        location = await FacultyLocation.findOne({ facultyId: faculty.facultyId });
      }
      if (!location) {
        location = await FacultyLocation.findOne({ facultyId: faculty._id.toString() });
      }
      room = location ? location.room : null;
    }

    return res.json({
      success: true,
      facultyId: faculty.facultyId || faculty._id.toString(),
      name: faculty.name,
      status,
      room
    });
  } catch (err) {
    console.error("[Faculty Status] Fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/faculty/location/:id
 *
 * Get current location of a faculty member.
 * Now applies privacy logic: if private_break, room is hidden.
 *
 * Accepts either:
 *   - A custom facultyId (e.g. "FAC_101") stored in facultyLocations
 *   - A MongoDB _id from the faculties collection
 *
 * Lookup order:
 *   1. Direct match in facultyLocations by facultyId
 *   2. If param is a valid ObjectId → find faculty doc → use its facultyId field
 */
router.get("/location/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Faculty ID is required"
      });
    }

    // ── Check faculty status for privacy ─────────────────────────
    let faculty;
    if (mongoose.Types.ObjectId.isValid(id)) {
      faculty = await Faculty.findById(id);
    }
    if (!faculty) {
      faculty = await Faculty.findOne({ facultyId: id });
    }

    // If faculty found and is on private_break, hide location
    if (faculty && faculty.status === "private_break") {
      return res.json({
        facultyId: faculty.facultyId || id,
        room: null,
        status: "private_break",
        lastSeen: null,
        hidden: true
      });
    }

    // ── Normal location lookup ───────────────────────────────────
    // 1. Try direct lookup (handles old-style IDs like FAC_101)
    let location = await FacultyLocation.findOne({ facultyId: id });

    // 2. If not found and looks like a MongoDB ObjectId, resolve via faculty document
    if (!location && mongoose.Types.ObjectId.isValid(id)) {
      const fac = faculty || await Faculty.findById(id);
      if (fac && fac.facultyId) {
        location = await FacultyLocation.findOne({ facultyId: fac.facultyId });
      }
    }

    if (!location) {
      return res.status(404).json({
        success: false,
        error: "Faculty location not found"
      });
    }

    return res.json({
      facultyId: location.facultyId,
      room: location.room,
      scannerId: location.scannerId,
      lastSeen: location.lastSeen,
      status: faculty ? (faculty.status || "available") : "available",
      hidden: false
    });

  } catch (err) {
    console.error("[Faculty Route] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
