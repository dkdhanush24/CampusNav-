/**
 * Stop Controller — CampusNav
 * Handles bus stop queries from MongoDB
 */

const BusStop = require("../models/busStop");

/**
 * GET /api/bus/:busId/stops
 * Returns all stops for a given bus_id.
 */
const getStopsByBusId = async (req, res) => {
    try {
        const { busId } = req.params;

        if (!busId) {
            return res.status(400).json({ success: false, message: "busId parameter is required" });
        }

        const stops = await BusStop.find(
            { bus_id: busId },
            { _id: 0, stop_name: 1, latitude: 1, longitude: 1 }
        ).lean();

        return res.json(stops);
    } catch (error) {
        console.error("[StopController] Error fetching stops:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = { getStopsByBusId };
