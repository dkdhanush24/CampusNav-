/**
 * ETA Service
 *
 * Fetches latest bus document, fetches all stops from bus_stops,
 * computes nearest stop via Haversine, and computes ETA based on speed/status.
 */

const BusLocation = require("../models/busLocation");
const BusStop = require("../models/busStop");
const { haversineDistance } = require("../utils/haversine");

/**
 * Format a Date as IST clock time, e.g. "10:35 AM IST"
 */
function toISTClock(date) {
    return date.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }) + " IST";
}

/**
 * Compute ETA for a given bus towards every stop and return the nearest stop info.
 *
 * @param {string} busId
 * @returns {Object} Structured ETA response
 */
async function getBusETA(busId) {
    const bus = await BusLocation.findOne({ bus_id: busId }).lean();

    if (!bus) {
        return null;
    }

    // Bus not in service → short-circuit
    if (bus.status === "NOT_IN_SERVICE") {
        return {
            bus_id: bus.bus_id,
            latitude: bus.latitude,
            longitude: bus.longitude,
            speed: bus.speed,
            status: "NOT_IN_SERVICE",
            nearest_stop: null,
            distance_km: null,
            eta_minutes: null,
            last_updated: bus.last_updated,
        };
    }

    const stops = await BusStop.find().lean();

    if (!stops || stops.length === 0) {
        return {
            bus_id: bus.bus_id,
            latitude: bus.latitude,
            longitude: bus.longitude,
            speed: bus.speed,
            status: bus.status,
            nearest_stop: null,
            distance_km: null,
            eta_minutes: null,
            last_updated: bus.last_updated,
        };
    }

    // Find nearest stop
    let nearest = null;
    let minDistance = Infinity;

    for (const stop of stops) {
        const dist = haversineDistance(
            bus.latitude,
            bus.longitude,
            stop.latitude,
            stop.longitude
        );

        if (dist < minDistance) {
            minDistance = dist;
            nearest = stop;
        }
    }

    const distanceKm = Math.round(minDistance * 1000) / 1000; // 3 decimal places

    // ETA logic
    let eta_minutes;
    let eta_arrival;

    if (bus.speed > 5) {
        eta_minutes = Math.round((minDistance / bus.speed) * 60);
        eta_arrival = toISTClock(new Date(Date.now() + eta_minutes * 60000));
    } else {
        eta_minutes = "Arriving";
        eta_arrival = "Now";
    }

    return {
        bus_id: bus.bus_id,
        latitude: bus.latitude,
        longitude: bus.longitude,
        speed: bus.speed,
        status: bus.status,
        nearest_stop: nearest.stop_name,
        distance_km: distanceKm,
        eta_minutes: eta_minutes,
        eta_arrival: eta_arrival,
        last_updated: bus.last_updated,
    };
}

module.exports = { getBusETA };
