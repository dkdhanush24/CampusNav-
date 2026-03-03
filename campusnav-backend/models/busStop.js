/**
 * Bus Stop Model — MongoDB Schema
 * Collection: bus_stops
 */

const mongoose = require("mongoose");

const busStopSchema = new mongoose.Schema(
    {
        bus_id: {
            type: String,
            required: true,
            index: true,
        },
        stop_name: {
            type: String,
            required: true,
            trim: true,
        },
        latitude: {
            type: Number,
            required: true,
        },
        longitude: {
            type: Number,
            required: true,
        },
    },
    {
        timestamps: false,
        collection: "bus_stops",
    }
);

module.exports = mongoose.model("BusStop", busStopSchema);
