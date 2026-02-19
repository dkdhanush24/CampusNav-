/**
 * MQTT Service — HiveMQ Cloud Subscriber
 * 
 * Connects to HiveMQ Cloud via TLS (mqtts://)
 * Subscribes to: campusnav/faculty
 * On message → validates → upserts into MongoDB facultyLocations
 * 
 * Never crashes the server — all errors are caught and logged.
 */

const mqtt = require("mqtt");
const { upsertFacultyLocation } = require("./locationService");

// ── Configuration ─────────────────────────────────────────────────
const MQTT_URL = process.env.MQTT_URL;
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const TOPIC = "campusnav/faculty";

let client = null;
let connected = false;

/**
 * Start the MQTT client and subscribe to topics.
 * Call this AFTER MongoDB is connected.
 */
function startMqttClient() {
    if (!MQTT_URL) {
        console.log("[MQTT] MQTT_URL not set in .env — skipping MQTT. REST APIs will work normally.");
        return;
    }

    console.log(`[MQTT] Connecting to mqtts://${MQTT_URL}:8883 ...`);

    client = mqtt.connect({
        host: MQTT_URL,
        port: 8883,
        protocol: "mqtts",
        username: MQTT_USER,
        password: MQTT_PASS,
        rejectUnauthorized: true, // Verify TLS certificate
        reconnectPeriod: 5000,    // Auto-reconnect every 5s
    });

    // ── Event Handlers ────────────────────────────────────────────

    client.on("connect", () => {
        connected = true;
        console.log("[MQTT] Connected to HiveMQ Cloud");

        // Subscribe to faculty location topic
        client.subscribe(TOPIC, { qos: 1 }, (err) => {
            if (err) {
                console.error(`[MQTT] Subscribe error: ${err.message}`);
            } else {
                console.log(`[MQTT] Subscribed to topic: ${TOPIC}`);
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
 * Parses JSON, validates fields, upserts into MongoDB.
 * 
 * @param {string} topic - MQTT topic
 * @param {Buffer} payload - Raw message buffer
 */
async function handleMessage(topic, payload) {
    let data;

    // Step 1: Parse JSON safely
    try {
        data = JSON.parse(payload.toString());
    } catch (parseError) {
        console.error(`[MQTT] Invalid JSON on ${topic}: ${parseError.message}`);
        return;
    }

    // Step 2: Validate required fields
    const { facultyId, room, rssi, scannerId, tagId } = data;

    if (!facultyId || !room || rssi === undefined || !scannerId) {
        console.error(`[MQTT] Missing required fields:`, {
            facultyId: !!facultyId,
            room: !!room,
            rssi: rssi !== undefined,
            scannerId: !!scannerId,
        });
        return;
    }

    console.log(`[MQTT] Received: ${facultyId} → ${room} (RSSI: ${rssi})`);

    // Step 3: Upsert into MongoDB via existing location service
    try {
        const result = await upsertFacultyLocation({
            facultyId,
            tagId: tagId || null,
            scannerId,
            room,
            rssi: Number(rssi),
        });

        if (result.success) {
            console.log(`[MQTT] DB updated: ${facultyId} → ${room}`);
        } else {
            console.error(`[MQTT] DB update failed: ${result.error}`);
        }
    } catch (dbError) {
        console.error(`[MQTT] DB error: ${dbError.message}`);
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
    stopMqttClient,
};
