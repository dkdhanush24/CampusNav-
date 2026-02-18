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

// ── MongoDB Connection ────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    // Start MQTT client after DB is ready
    startMqttClient();
  })
  .catch(err => console.error("MongoDB connection error:", err));

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
  res.json({
    server: "ok",
    mongo: mongoose.connection.readyState === 1,
    mqtt: isMqttConnected(),
    timestamp: new Date().toISOString(),
  });
});

// ── Start Server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
