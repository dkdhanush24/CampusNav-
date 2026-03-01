/**
 * Bus MQTT Subscriber — HiveMQ Cloud
 * 
 * Subscribes to: campusnav/bus/+ (wildcard — all buses)
 * On message → validates device_key → upserts into MongoDB bus_locations
 * Runs timeout checker every 30 seconds via setInterval
 * 
 * Separate from faculty mqttService.js — clean module isolation.
 */

const mqtt = require("mqtt");
const { upsertBusLocation, checkBusTimeouts } = require("./busService");

// ── Configuration (from existing .env) ────────────────────────────
const MQTT_URL = process.env.MQTT_URL;
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const BUS_DEVICE_KEY = process.env.BUS_DEVICE_KEY;

const TOPIC = "campusnav/bus/+";
const TIMEOUT_CHECK_INTERVAL = 30000; // 30 seconds

let client = null;
let connected = false;
let messageCount = 0;
let errorCount = 0;
let timeoutInterval = null;

/**
 * Start the bus MQTT subscriber.
 * Call AFTER MongoDB is connected.
 */
function startBusMqttClient() {
    if (!MQTT_URL) {
        console.log("[BUS-MQTT] MQTT_URL not set — skipping bus MQTT subscriber.");
        return;
    }

    if (!MQTT_USER || !MQTT_PASS) {
        console.log("[BUS-MQTT] MQTT credentials not set — skipping.");
        return;
    }

    if (!BUS_DEVICE_KEY) {
        console.warn("[BUS-MQTT] ⚠️  BUS_DEVICE_KEY not set — all bus messages will be REJECTED.");
    }

    // Extract bare hostname
    const bareHost = MQTT_URL
        .replace(/^mqtts?:\/\//, "")
        .replace(/:\d+$/, "");

    console.log(`[BUS-MQTT] Connecting to mqtts://${bareHost}:8883 ...`);

    client = mqtt.connect({
        host: bareHost,
        port: 8883,
        protocol: "mqtts",
        username: MQTT_USER,
        password: MQTT_PASS,
        rejectUnauthorized: true,
        reconnectPeriod: 10000,
        connectTimeout: 30000,
        clean: true,
        clientId: `campusnav_bus_backend_${Date.now()}`,
    });

    // ── Event Handlers ────────────────────────────────────────────

    client.on("connect", () => {
        connected = true;
        console.log("[BUS-MQTT] ✅ Connected to HiveMQ Cloud");

        client.subscribe(TOPIC, { qos: 1 }, (err, granted) => {
            if (err) {
                console.error(`[BUS-MQTT] Subscribe error: ${err.message}`);
            } else {
                console.log(`[BUS-MQTT] Subscribed to: ${TOPIC}`);
                if (granted && granted.length > 0) {
                    console.log(`[BUS-MQTT] Granted QoS: ${granted[0].qos}`);
                }
            }
        });
    });

    client.on("message", async (topic, payload) => {
        await handleBusMessage(topic, payload);
    });

    client.on("error", (err) => {
        console.error(`[BUS-MQTT] Connection error: ${err.message}`);
    });

    client.on("reconnect", () => {
        connected = false;
        console.log("[BUS-MQTT] Reconnecting...");
    });

    client.on("close", () => {
        connected = false;
        console.log("[BUS-MQTT] Connection closed");
    });

    client.on("offline", () => {
        connected = false;
        console.log("[BUS-MQTT] Client offline");
    });

    // ── Timeout Checker ───────────────────────────────────────────
    timeoutInterval = setInterval(async () => {
        try {
            await checkBusTimeouts();
        } catch (err) {
            console.error("[BUS-MQTT] Timeout check error:", err.message);
        }
    }, TIMEOUT_CHECK_INTERVAL);

    console.log(`[BUS-MQTT] Timeout checker running every ${TIMEOUT_CHECK_INTERVAL / 1000}s`);
}

/**
 * Handle incoming bus MQTT message.
 * Pipeline: Parse → Validate device_key → Validate fields → Upsert
 */
async function handleBusMessage(topic, payload) {
    let data;

    // ── Stage 1: JSON Parse ───────────────────────────────────────
    try {
        data = JSON.parse(payload.toString("utf-8"));
    } catch (parseError) {
        errorCount++;
        console.error(`[BUS-MQTT] ❌ Invalid JSON on ${topic}: ${parseError.message}`);
        return;
    }

    // ── Stage 2: Device Key Validation ────────────────────────────
    if (!BUS_DEVICE_KEY) {
        errorCount++;
        console.error("[BUS-MQTT] ❌ BUS_DEVICE_KEY not configured — rejecting message");
        return;
    }

    if (data.device_key !== BUS_DEVICE_KEY) {
        errorCount++;
        console.error(`[BUS-MQTT] ❌ Invalid device_key on ${topic} — message rejected`);
        return;
    }

    // ── Stage 3: Field Validation ─────────────────────────────────
    const { bus_id, latitude, longitude, speed, satellites } = data;

    if (!bus_id || latitude === undefined || longitude === undefined) {
        errorCount++;
        console.error(`[BUS-MQTT] ❌ Missing required fields on ${topic}:`, {
            bus_id: !!bus_id,
            latitude: latitude !== undefined,
            longitude: longitude !== undefined,
        });
        return;
    }

    if (typeof bus_id !== "string") {
        errorCount++;
        console.error(`[BUS-MQTT] ❌ bus_id must be a string on ${topic}`);
        return;
    }

    const numLat = Number(latitude);
    const numLng = Number(longitude);
    const numSpeed = Number(speed) || 0;
    const numSats = Number(satellites) || 0;

    if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
        errorCount++;
        console.error(`[BUS-MQTT] ❌ Invalid coordinates on ${topic}: lat=${latitude} lng=${longitude}`);
        return;
    }

    messageCount++;
    console.log(
        `[BUS-MQTT] 📡 #${messageCount} ${bus_id} → lat=${numLat.toFixed(6)} lng=${numLng.toFixed(6)} spd=${numSpeed.toFixed(1)} sats=${numSats}`
    );

    // ── Stage 4: Database Upsert ──────────────────────────────────
    try {
        const result = await upsertBusLocation({
            bus_id: bus_id.trim(),
            latitude: numLat,
            longitude: numLng,
            speed: numSpeed,
            satellites: numSats,
        });

        if (result.success) {
            console.log(`[BUS-MQTT] ✅ DB updated: ${bus_id} → IN_SERVICE`);
        } else {
            errorCount++;
            console.error(`[BUS-MQTT] ❌ DB update failed: ${result.error}`);
        }
    } catch (dbError) {
        errorCount++;
        console.error(`[BUS-MQTT] ❌ DB error: ${dbError.message}`);
    }
}

/**
 * Check if bus MQTT client is connected.
 */
function isBusMqttConnected() {
    return connected;
}

/**
 * Get bus MQTT service stats.
 */
function getBusMqttStats() {
    return {
        connected,
        messagesProcessed: messageCount,
        errors: errorCount,
    };
}

/**
 * Gracefully stop the bus MQTT client.
 */
function stopBusMqttClient() {
    if (timeoutInterval) {
        clearInterval(timeoutInterval);
        timeoutInterval = null;
    }
    if (client) {
        client.end(true);
        connected = false;
        console.log("[BUS-MQTT] Client stopped");
    }
}

module.exports = {
    startBusMqttClient,
    isBusMqttConnected,
    getBusMqttStats,
    stopBusMqttClient,
};
