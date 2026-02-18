/**
 * Location Service — DEMO MODE
 * 
 * Simplified for demo/prototype:
 * - Always updates DB on every scan
 * - No RSSI comparison (RSSI stored but not used for filtering)
 * - Every API call results in DB update
 */

const FacultyLocation = require("../models/facultylocation");

/**
 * Upsert faculty location — ALWAYS UPDATES
 * 
 * DEMO MODE: Every scan updates the database, regardless of RSSI
 * 
 * @param {Object} data - Scanner payload
 * @param {string} data.facultyId - Faculty identifier (unique key)
 * @param {string} data.tagId - BLE tag ID
 * @param {string} data.scannerId - Scanner identifier
 * @param {string} data.room - Room name
 * @param {number} data.rssi - Signal strength (stored, not compared)
 * @returns {Object} - { success: boolean, updated: boolean, location?: Object }
 */
async function upsertFacultyLocation(data) {
    const { facultyId, tagId, scannerId, room, rssi } = data;

    try {
        // DEMO MODE: Always upsert — no RSSI comparison
        const updatedLocation = await FacultyLocation.findOneAndUpdate(
            { facultyId },  // Find by facultyId
            {
                $set: {
                    tagId,
                    scannerId,
                    room,
                    rssi,
                    lastSeen: new Date()
                }
            },
            {
                upsert: true,      // Create if doesn't exist
                new: true,         // Return updated document
                runValidators: true
            }
        );

        console.log(`[LocationService] Updated: ${facultyId} → ${room} (RSSI: ${rssi})`);

        return {
            success: true,
            updated: true,
            location: updatedLocation.toObject()
        };

    } catch (error) {
        console.error("[LocationService] Error:", error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get faculty location by facultyId
 * 
 * @param {string} facultyId - Faculty identifier
 * @returns {Object|null} - Location record or null
 */
async function getFacultyLocation(facultyId) {
    try {
        return await FacultyLocation.findOne({ facultyId });
    } catch (error) {
        console.error("[LocationService] Error:", error.message);
        return null;
    }
}

/**
 * Get faculty location by faculty name (for chatbot)
 * Requires joining with faculty collection
 * 
 * @param {string} name - Faculty name (partial match)
 * @returns {Object|null} - Location with faculty info or null
 */
async function getFacultyLocationByName(name) {
    const Faculty = require("../models/faculty");

    try {
        // Find faculty by name
        const faculty = await Faculty.findOne({
            name: { $regex: name, $options: "i" }
        });

        if (!faculty) {
            return null;
        }

        // Find location using faculty's _id as string or name-based ID
        let location = await FacultyLocation.findOne({
            facultyId: faculty._id.toString()
        });

        // If not found by _id, try by name pattern
        if (!location) {
            location = await FacultyLocation.findOne({
                facultyId: { $regex: faculty.name.split(' ')[0], $options: "i" }
            });
        }

        if (!location) {
            return null;
        }

        return {
            facultyName: faculty.name,
            room: location.room,
            scannerId: location.scannerId,
            lastSeen: location.lastSeen
        };

    } catch (error) {
        console.error("[LocationService] Error:", error.message);
        return null;
    }
}

module.exports = {
    upsertFacultyLocation,
    getFacultyLocation,
    getFacultyLocationByName
};
