/**
 * Seed Script — bus_stops collection
 *
 * Run once to insert predefined campus stops:
 *   node scripts/seedStops.js
 *
 * Uses MONGODB_URI from .env (same as the main app).
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const BusStop = require("../models/busStop");

const STOPS = [
    {
        stop_name: "Stop 1",
        latitude: 8.929889339125966,
        longitude: 76.90235980296764,
    },
    {
        stop_name: "Stop 2",
        latitude: 8.932878186253102,
        longitude: 76.90543897889822,
    },
    {
        stop_name: "Stop 3",
        latitude: 8.933980449952452,
        longitude: 76.90946229242441,
    },
    {
        stop_name: "Stop 4",
        latitude: 8.93393805526587,
        longitude: 76.91529877920193,
    },
];

(async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error("MONGO_URI not set in .env");

        await mongoose.connect(uri);
        console.log("[SeedStops] Connected to MongoDB Atlas");

        // Drop existing stops so we don't duplicate on re-runs
        await BusStop.deleteMany({});
        console.log("[SeedStops] Cleared existing bus_stops");

        const inserted = await BusStop.insertMany(STOPS);
        console.log(`[SeedStops] Inserted ${inserted.length} stops:`);
        inserted.forEach((s) =>
            console.log(`  • ${s.stop_name} (${s.latitude}, ${s.longitude})`)
        );
    } catch (err) {
        console.error("[SeedStops] Error:", err.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log("[SeedStops] Done. Disconnected.");
    }
})();
