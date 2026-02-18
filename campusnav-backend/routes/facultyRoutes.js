const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Faculty = require("../models/faculty");
const FacultyLocation = require("../models/facultylocation");

// GET all faculty
router.get("/", async (req, res) => {
  try {
    const faculty = await Faculty.find();
    res.json(faculty);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/faculty/location/:id
 * 
 * Get current location of a faculty member.
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

    // 1. Try direct lookup (handles old-style IDs like FAC_101)
    let location = await FacultyLocation.findOne({ facultyId: id });

    // 2. If not found and looks like a MongoDB ObjectId, resolve via faculty document
    if (!location && mongoose.Types.ObjectId.isValid(id)) {
      const faculty = await Faculty.findById(id);
      if (faculty && faculty.facultyId) {
        // Use the faculty's BLE tag ID to look up location
        location = await FacultyLocation.findOne({ facultyId: faculty.facultyId });
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
      lastSeen: location.lastSeen
    });

  } catch (err) {
    console.error("[Faculty Route] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
