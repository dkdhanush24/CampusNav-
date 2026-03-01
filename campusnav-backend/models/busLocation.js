/**
 * Bus Location Model — MongoDB Schema
 * Collection: bus_locations
 */

const mongoose = require("mongoose");

const busLocationSchema = new mongoose.Schema(
    {
        bus_id: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        latitude: {
            type: Number,
            required: true,
        },
        longitude: {
            type: Number,
            required: true,
        },
        speed: {
            type: Number,
            default: 0,
        },
        satellites: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ["IN_SERVICE", "NOT_IN_SERVICE"],
            default: "NOT_IN_SERVICE",
        },
        last_updated: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: false,
        collection: "bus_locations",
    }
);

module.exports = mongoose.model("BusLocation", busLocationSchema);
