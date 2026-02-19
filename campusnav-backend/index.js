require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Route imports
const chatRoute = require("./routes/chatRoute");         // LLM-powered chatbot
const facultyRoutes = require("./routes/facultyRoutes");
const scannerRoutes = require("./routes/scannerRoutes");

// MQTT service for HiveMQ Cloud
const { startMqttClient, isMqttConnected } = require("./services/mqttService");

const app = express();
app.use(cors());
app.use(express.json());

// ── MongoDB Atlas Connection ─────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;

// Startup validation
if (!MONGO_URI) {
  console.error("[STARTUP] FATAL: MONGO_URI is not set in .env — cannot start.");
  process.exit(1);
}

// Log masked connection string for debugging
const maskedURI = MONGO_URI.replace(
  /\/\/([^:]+):([^@]+)@/,
  (_, user) => `//${user}:****@`
);
console.log(`[STARTUP] MONGO_URI: ${maskedURI}`);

// Validate it's an Atlas URI (not local)
if (MONGO_URI.includes("localhost") || MONGO_URI.includes("127.0.0.1")) {
  console.error("[STARTUP] FATAL: Local MongoDB URI detected! Must use Atlas.");
  console.error("[STARTUP] Update MONGO_URI in .env to your Atlas connection string.");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    const dbName = mongoose.connection.db.databaseName;
    console.log(`[STARTUP] ✅ Connected to MongoDB Atlas successfully`);
    console.log(`[STARTUP] Database name: "${dbName}"`);

    // Verify we have data — count faculty documents as sanity check
    try {
      const Faculty = require("./models/faculty");
      const facultyCount = await Faculty.countDocuments();
      console.log(`[STARTUP] Faculty documents in Atlas: ${facultyCount}`);

      if (facultyCount === 0) {
        console.warn("[STARTUP] ⚠️  Atlas database connected but 'faculties' collection is EMPTY.");
        console.warn("[STARTUP]     Chatbot will return 'No information available' for faculty queries.");
      } else {
        // Log a sample document to confirm correct data
        const sample = await Faculty.findOne().lean();
        console.log(`[STARTUP] Sample faculty: "${sample.name}" — ${sample.designation || "N/A"} in ${sample.department || "N/A"}`);
      }

      // List all collections for verification
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collNames = collections.map(c => c.name);
      console.log(`[STARTUP] Available collections: [${collNames.join(", ")}]`);
    } catch (verifyError) {
      console.error("[STARTUP] ⚠️  Faculty verification failed:", verifyError.message);
    }

    // Start MQTT client after DB is ready
    startMqttClient();
  })
  .catch(err => {
    console.error("[STARTUP] ❌ MongoDB Atlas connection FAILED:", err.message);
    console.error("[STARTUP] Check your MONGO_URI, network, and Atlas IP whitelist (0.0.0.0/0 for testing).");
    process.exit(1);
  });

// ── Route Registration ────────────────────────────────────────────
app.use("/api/chat", chatRoute);           // Gemini LLM-powered chatbot
app.use("/api/chatbot", chatRoute);        // Alias for backward compat
app.use("/api/faculty", facultyRoutes);
app.use("/api/scanner", scannerRoutes);    // HTTP scanner endpoint (kept for backward compat)

app.get("/", (req, res) => {
  res.send("CampusNav Backend Running");
});

// ── Health Check ──────────────────────────────────────────────────
app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbName = dbState === 1 ? mongoose.connection.db.databaseName : "disconnected";

  res.json({
    server: "ok",
    mongo: dbState === 1,
    mongoDatabase: dbName,
    mongoURI: maskedURI,
    mqtt: isMqttConnected(),
    timestamp: new Date().toISOString(),
  });
});

// ── Start Server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[STARTUP] Server running on port ${PORT}`);
});
