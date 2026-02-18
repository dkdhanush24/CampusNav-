/**
 * FacultyLocation Model
 * Stores real-time faculty location from ESP32 BLE scanners
 * 
 * Rule: One document per faculty, always stores latest strongest RSSI
 */

const mongoose = require("mongoose");

const FacultyLocationSchema = new mongoose.Schema({
    // Unique identifier for faculty (indexed for fast lookup)
    facultyId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // BLE tag ID worn by faculty
    tagId: {
        type: String,
        default: null
    },

    // Scanner that detected the faculty
    scannerId: {
        type: String,
        required: true
    },

    // Room name from scanner configuration
    room: {
        type: String,
        required: true
    },

    // RSSI value (closer to 0 = stronger signal)
    rssi: {
        type: Number,
        required: true
    },

    // Timestamp of last detection
    lastSeen: {
        type: Date,
        default: Date.now
    }
});

module.exports =
    mongoose.models.FacultyLocation ||
    mongoose.model("FacultyLocation", FacultyLocationSchema, "facultyLocations");
