/**
 * One-time migration script
 * Adds bus_id: "BUS_01" to all bus_stops documents that are missing it.
 *
 * Usage:
 *   node scripts/add-bus-id-to-stops.js
 *
 * Reads MONGO_URI from .env (same as the main server).
 */

require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error("❌  MONGO_URI not set in .env");
    process.exit(1);
}

const BUS_ID = "BUS_01"; // Change this if your bus ID is different

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log("✅  Connected to MongoDB Atlas");

    const collection = mongoose.connection.db.collection("bus_stops");

    // Find docs missing bus_id
    const missing = await collection.find({ bus_id: { $exists: false } }).toArray();
    console.log(`Found ${missing.length} document(s) without bus_id`);

    if (missing.length === 0) {
        console.log("Nothing to update — all stops already have bus_id.");
        await mongoose.disconnect();
        return;
    }

    // Update all missing docs at once
    const result = await collection.updateMany(
        { bus_id: { $exists: false } },
        { $set: { bus_id: BUS_ID } }
    );

    console.log(`✅  Updated ${result.modifiedCount} document(s) → bus_id: "${BUS_ID}"`);

    // Verify
    const updated = await collection.find({ bus_id: BUS_ID }).toArray();
    console.log(`\nFinal state of bus_stops collection (${updated.length} stops for ${BUS_ID}):`);
    updated.forEach((s, i) =>
        console.log(`  ${i + 1}. ${s.stop_name}  (${s.latitude}, ${s.longitude})`)
    );

    await mongoose.disconnect();
    console.log("\nDone. You can delete this script after running it.");
}

run().catch(err => {
    console.error("❌ Migration failed:", err.message);
    mongoose.disconnect();
    process.exit(1);
});
