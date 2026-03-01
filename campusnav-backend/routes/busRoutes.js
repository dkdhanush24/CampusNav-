/**
 * Bus Routes — REST API for bus tracking
 * 
 * GET /api/bus/all         — All buses with status
 * GET /api/bus/status/:id  — Single bus by bus_id
 * GET /api/bus/eta/:id     — ETA to destination (query: destLat, destLng)
 */

const express = require("express");
const router = express.Router();
const { getBusStatus, getAllBuses, calculateETA } = require("../services/busService");

// ── GET /api/bus/all ──────────────────────────────────────────────
router.get("/all", async (req, res) => {
    try {
        const buses = await getAllBuses();
        res.json({
            success: true,
            count: buses.length,
            buses,
        });
    } catch (error) {
        console.error("[BusRoute] /all error:", error.message);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// ── GET /api/bus/status/:id ───────────────────────────────────────
router.get("/status/:id", async (req, res) => {
    try {
        const bus = await getBusStatus(req.params.id);

        if (!bus) {
            return res.status(404).json({
                success: false,
                error: `Bus '${req.params.id}' not found`,
            });
        }

        res.json({ success: true, bus });
    } catch (error) {
        console.error("[BusRoute] /status error:", error.message);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// ── GET /api/bus/eta/:id?destLat=x&destLng=y ─────────────────────
router.get("/eta/:id", async (req, res) => {
    try {
        const { destLat, destLng } = req.query;

        if (!destLat || !destLng) {
            return res.status(400).json({
                success: false,
                error: "Missing query params: destLat, destLng",
            });
        }

        const bus = await getBusStatus(req.params.id);

        if (!bus) {
            return res.status(404).json({
                success: false,
                error: `Bus '${req.params.id}' not found`,
            });
        }

        if (bus.status === "NOT_IN_SERVICE") {
            return res.json({
                success: true,
                bus_id: bus.bus_id,
                status: "NOT_IN_SERVICE",
                eta: null,
                eta_text: "Bus Not In Service",
            });
        }

        const eta = calculateETA(
            bus.latitude,
            bus.longitude,
            parseFloat(destLat),
            parseFloat(destLng),
            bus.speed
        );

        res.json({
            success: true,
            bus_id: bus.bus_id,
            status: bus.status,
            ...eta,
        });
    } catch (error) {
        console.error("[BusRoute] /eta error:", error.message);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

module.exports = router;
