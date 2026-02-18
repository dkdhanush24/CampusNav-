/**
 * Scanner Routes — DEMO MODE
 * REST API for ESP32 BLE scanner updates
 * 
 * Every update is stored — no RSSI filtering
 * 
 * Endpoint: POST /api/scanner/update
 */

const express = require("express");
const router = express.Router();
const { upsertFacultyLocation } = require("../services/locationService");

/**
 * POST /api/scanner/update
 * 
 * Receives BLE scan data from ESP32 scanners
 * DEMO MODE: Always updates DB, no RSSI comparison
 * 
 * Payload:
 * {
 *   "facultyId": "FAC_101",
 *   "tagId": "TAG_001",
 *   "scannerId": "SC_CSE_103",
 *   "room": "D103",
 *   "rssi": -60
 * }
 */
router.post("/update", async (req, res) => {
    try {
        const { scannerId, room, facultyId, tagId, rssi } = req.body;

        // Validate required fields
        const errors = [];
        if (!facultyId) errors.push("facultyId is required");
        if (!scannerId) errors.push("scannerId is required");
        if (!room) errors.push("room is required");
        if (rssi === undefined || rssi === null) errors.push("rssi is required");
        if (typeof rssi !== "number") errors.push("rssi must be a number");

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors
            });
        }

        // Process update via location service (ALWAYS UPDATES)
        const result = await upsertFacultyLocation({
            facultyId,
            tagId: tagId || null,
            scannerId,
            room,
            rssi
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || "Failed to update location"
            });
        }

        // DEMO MODE: Always return success with updated=true
        return res.json({
            success: true,
            updated: true,
            facultyId,
            room,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("[Scanner Route] Error:", error.message);
        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
});

/**
 * GET /api/scanner/health
 * 
 * Health check for scanner connectivity
 */
router.get("/health", (req, res) => {
    res.json({
        status: "ok",
        mode: "DEMO",
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
