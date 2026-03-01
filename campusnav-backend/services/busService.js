/**
 * Bus Service — Business Logic
 * 
 * Handles:
 * - Upserting bus location data from MQTT
 * - Querying bus status
 * - Timeout detection (NOT_IN_SERVICE after 120s)
 * - ETA calculation
 */

const BusLocation = require("../models/busLocation");

// Timeout threshold: 120 seconds
const TIMEOUT_MS = 120 * 1000;

/**
 * Upsert bus location — called on every valid MQTT message.
 * Sets status to IN_SERVICE and updates last_updated.
 *
 * @param {Object} data - Validated MQTT payload
 * @returns {Object} - { success, location? , error? }
 */
async function upsertBusLocation(data) {
    const { bus_id, latitude, longitude, speed, satellites } = data;

    try {
        const location = await BusLocation.findOneAndUpdate(
            { bus_id },
            {
                $set: {
                    latitude,
                    longitude,
                    speed,
                    satellites,
                    status: "IN_SERVICE",
                    last_updated: new Date(),
                },
            },
            {
                upsert: true,
                new: true,
                runValidators: true,
            }
        );

        return { success: true, location: location.toObject() };
    } catch (error) {
        console.error("[BusService] Upsert error:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get a single bus by bus_id.
 *
 * @param {string} busId
 * @returns {Object|null}
 */
async function getBusStatus(busId) {
    try {
        return await BusLocation.findOne({ bus_id: busId }).lean();
    } catch (error) {
        console.error("[BusService] getBusStatus error:", error.message);
        return null;
    }
}

/**
 * Get all buses.
 *
 * @returns {Array}
 */
async function getAllBuses() {
    try {
        return await BusLocation.find().lean();
    } catch (error) {
        console.error("[BusService] getAllBuses error:", error.message);
        return [];
    }
}

/**
 * Timeout check — mark buses as NOT_IN_SERVICE
 * if last_updated is older than TIMEOUT_MS (120s).
 * Called periodically via setInterval.
 */
async function checkBusTimeouts() {
    const cutoff = new Date(Date.now() - TIMEOUT_MS);

    try {
        const result = await BusLocation.updateMany(
            {
                status: "IN_SERVICE",
                last_updated: { $lt: cutoff },
            },
            {
                $set: { status: "NOT_IN_SERVICE" },
            }
        );

        if (result.modifiedCount > 0) {
            console.log(
                `[BusService] ⏱️  Timed out ${result.modifiedCount} bus(es) → NOT_IN_SERVICE`
            );
        }
    } catch (error) {
        console.error("[BusService] Timeout check error:", error.message);
    }
}

/**
 * Calculate ETA using Haversine distance and current speed.
 *
 * @param {number} busLat   - Bus latitude
 * @param {number} busLng   - Bus longitude
 * @param {number} destLat  - Destination latitude
 * @param {number} destLng  - Destination longitude
 * @param {number} speed    - Current speed in km/h
 * @returns {Object} - { eta_minutes, eta_text, distance_km }
 */
function calculateETA(busLat, busLng, destLat, destLng, speed) {
    const distanceKm = haversineDistance(busLat, busLng, destLat, destLng);

    if (speed <= 5) {
        return {
            eta_minutes: null,
            eta_text: speed <= 1 ? "Stopped" : "Arriving",
            distance_km: Math.round(distanceKm * 100) / 100,
        };
    }

    const etaHours = distanceKm / speed;
    const etaMinutes = Math.round(etaHours * 60);

    return {
        eta_minutes: etaMinutes,
        eta_text: etaMinutes <= 1 ? "Arriving" : `${etaMinutes} min`,
        distance_km: Math.round(distanceKm * 100) / 100,
    };
}

/**
 * Haversine formula — great-circle distance between two points.
 *
 * @param {number} lat1 - Point 1 latitude
 * @param {number} lng1 - Point 1 longitude
 * @param {number} lat2 - Point 2 latitude
 * @param {number} lng2 - Point 2 longitude
 * @returns {number} - Distance in kilometers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return (deg * Math.PI) / 180;
}

module.exports = {
    upsertBusLocation,
    getBusStatus,
    getAllBuses,
    checkBusTimeouts,
    calculateETA,
};
