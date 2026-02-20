/**
 * MQTT Service — HiveMQ Cloud Subscriber (v2.0 — Production)
 * 
 * Connects to HiveMQ Cloud via TLS (mqtts://)
 * Subscribes to: campusnav/faculty/+ (wildcard — all scanners)
 * On message → validates → sanitizes → upserts into MongoDB facultyLocations
 * 
 * Never crashes the server — all errors are caught and logged.
 */

const mqtt = require("mqtt");
const { upsertFacultyLocation } = require("./locationService");

// ── Configuration ─────────────────────────────────────────────────
const MQTT_URL = process.env.MQTT_URL;
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;

// Wildcard subscription — receives from all scanners
// Topic pattern: campusnav/faculty/{scannerId}
const TOPIC = "campusnav/faculty/+";

let client = null;
let connected = false;
let messageCount = 0;
let errorCount = 0;

/**
 * Start the MQTT client and subscribe to topics.
 * Call this AFTER MongoDB is connected.
 */
function startMqttClient() {
    if (!MQTT_URL) {
        console.log("[MQTT] MQTT_URL not set in .env — skipping MQTT. REST APIs will work normally.");
        return;
    }

    if (!MQTT_USER || !MQTT_PASS) {
        console.log("[MQTT] MQTT_USER or MQTT_PASS not set — skipping MQTT.");
        return;
    }

    // Extract bare hostname (strip protocol and port if present)
    const bareHost = MQTT_URL
        .replace(/^mqtts?:\/\//, "")
        .replace(/:\d+$/, "");

    console.log(`[MQTT] Connecting to mqtts://${bareHost}:8883 ...`);

    client = mqtt.connect({
        host: bareHost,
        port: 8883,
        protocol: "mqtts",
        username: MQTT_USER,
        password: MQTT_PASS,
        rejectUnauthorized: true,   // Validate HiveMQ TLS certificate
        reconnectPeriod: 10000,     // Auto-reconnect every 10 seconds
        connectTimeout: 30000,      // 30-second connection timeout
        clean: true,                // Clean session — no queued messages
        clientId: `campusnav_backend_${Date.now()}`,
    });

    // ── Event Handlers ────────────────────────────────────────────

    client.on("connect", () => {
        connected = true;
        console.log("[MQTT] ✅ Connected to HiveMQ Cloud");

        // Subscribe to faculty location topic (wildcard for all scanners)
        client.subscribe(TOPIC, { qos: 1 }, (err, granted) => {
            if (err) {
                console.error(`[MQTT] Subscribe error: ${err.message}`);
            } else {
                console.log(`[MQTT] Subscribed to topic: ${TOPIC}`);
                if (granted && granted.length > 0) {
                    console.log(`[MQTT] Granted QoS: ${granted[0].qos}`);
                }
            }
        });
    });

    client.on("message", async (topic, payload) => {
        await handleMessage(topic, payload);
    });

    client.on("error", (err) => {
        console.error(`[MQTT] Connection error: ${err.message}`);
        // Do NOT crash — mqtt.js will auto-reconnect
    });

    client.on("reconnect", () => {
        connected = false;
        console.log("[MQTT] Reconnecting...");
    });

    client.on("close", () => {
        connected = false;
        console.log("[MQTT] Connection closed");
    });

    client.on("offline", () => {
        connected = false;
        console.log("[MQTT] Client offline");
    });
}

/**
 * Handle incoming MQTT message.
 * 4-stage pipeline: Parse → Validate → Sanitize → Upsert
 * 
 * @param {string} topic - MQTT topic (e.g., campusnav/faculty/SC_D103)
 * @param {Buffer} payload - Raw message buffer
 */
async function handleMessage(topic, payload) {
    let data;

    // ── Stage 1: JSON Parse ────────────────────────────────────
    try {
        data = JSON.parse(payload.toString("utf-8"));
    } catch (parseError) {
        errorCount++;
        console.error(`[MQTT] ❌ Invalid JSON on ${topic}: ${parseError.message}`);
        return;
    }

    // ── Stage 2: Field Validation ──────────────────────────────
    const { facultyId, room, rssi, scannerId, tagId } = data;

    if (!facultyId || !room || rssi === undefined || !scannerId) {
        errorCount++;
        console.error(`[MQTT] ❌ Missing required fields on ${topic}:`, {
            facultyId: !!facultyId,
            room: !!room,
            rssi: rssi !== undefined,
            scannerId: !!scannerId,
        });
        return;
    }

    // Type checks
    if (typeof facultyId !== "string" || typeof room !== "string" || typeof scannerId !== "string") {
        errorCount++;
        console.error(`[MQTT] ❌ Invalid field types on ${topic} — facultyId, room, scannerId must be strings`);
        return;
    }

    // ── Stage 3: Sanitization ──────────────────────────────────
    const cleanFacultyId = String(facultyId).trim();
    const cleanRoom = String(room).trim();
    const cleanScannerId = String(scannerId).trim();
    const cleanTagId = tagId ? String(tagId).trim() : null;
    const numericRssi = Number(rssi);

    // Validate RSSI range (valid BLE range: -120 to 0 dBm)
    if (isNaN(numericRssi) || numericRssi < -120 || numericRssi > 0) {
        errorCount++;
        console.error(`[MQTT] ❌ Invalid RSSI value (${rssi}) on ${topic} — must be between -120 and 0`);
        return;
    }

    // Validate facultyId format (must start with FAC_)
    if (!cleanFacultyId.startsWith("FAC_")) {
        errorCount++;
        console.error(`[MQTT] ❌ Invalid facultyId format: "${cleanFacultyId}" — must start with FAC_`);
        return;
    }

    // Validate scannerId format (must start with SC_)
    if (!cleanScannerId.startsWith("SC_")) {
        errorCount++;
        console.error(`[MQTT] ❌ Invalid scannerId format: "${cleanScannerId}" — must start with SC_`);
        return;
    }

    messageCount++;
    console.log(`[MQTT] 📡 #${messageCount} Received: ${cleanFacultyId} → ${cleanRoom} (RSSI: ${numericRssi}) via ${cleanScannerId}`);

    // ── Stage 4: Database Upsert ───────────────────────────────
    try {
        const result = await upsertFacultyLocation({
            facultyId: cleanFacultyId,
            tagId: cleanTagId,
            scannerId: cleanScannerId,
            room: cleanRoom,
            rssi: numericRssi,
        });

        if (result.success) {
            console.log(`[MQTT] ✅ DB updated: ${cleanFacultyId} → ${cleanRoom}`);
        } else {
            errorCount++;
            console.error(`[MQTT] ❌ DB update failed: ${result.error}`);
        }
    } catch (dbError) {
        errorCount++;
        console.error(`[MQTT] ❌ DB error: ${dbError.message}`);
    }
}

/**
 * Check if MQTT client is currently connected.
 * @returns {boolean}
 */
function isMqttConnected() {
    return connected;
}

/**
 * Get MQTT service stats for health checks.
 * @returns {Object}
 */
function getMqttStats() {
    return {
        connected,
        messagesProcessed: messageCount,
        errors: errorCount,
    };
}

/**
 * Gracefully disconnect MQTT client.
 */
function stopMqttClient() {
    if (client) {
        client.end(true);
        connected = false;
        console.log("[MQTT] Client stopped");
    }
}

module.exports = {
    startMqttClient,
    isMqttConnected,
    getMqttStats,
    stopMqttClient,
};
