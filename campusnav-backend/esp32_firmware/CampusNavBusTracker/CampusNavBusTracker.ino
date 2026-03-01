/*
 * CampusNav Bus Tracker — ESP32 Firmware
 * 
 * Hardware: ESP32 + NEO-6M GPS
 * Communication: MQTT over TLS to HiveMQ Cloud
 * WiFi: WiFiManager (captive portal on first boot)
 * GPS: TinyGPSPlus via Serial2
 * 
 * Publishes GPS data every 60 seconds to campusnav/bus/BUS_01
 * Non-blocking architecture — no delay() calls > 100ms
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <TinyGPSPlus.h>
#include "config.h"

// ── Global Objects ────────────────────────────────────────────────
WiFiManager       wifiManager;
WiFiClientSecure  espClient;
PubSubClient      mqttClient(espClient);
TinyGPSPlus       gps;
HardwareSerial    gpsSerial(2);  // Serial2 for GPS

// ── Timing State ──────────────────────────────────────────────────
unsigned long lastPublishMs    = 0;
unsigned long lastMqttLoopMs   = 0;
unsigned long lastWifiCheckMs  = 0;

// ── MQTT Stats ────────────────────────────────────────────────────
uint32_t publishCount = 0;
uint32_t failCount    = 0;

// ── HiveMQ Root CA (ISRG Root X1) ────────────────────────────────
static const char* root_ca PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6
UA5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+s
WT8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qy
HB5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+U
CvdQl8v4SYFoVDAGEJCAKhBuuVPHbvor+kTGIROi206GeKipKGUFBT+FKGpT0vBL
nLpRpNwG0fEOfAMBMeMBl7H8rPETipb4p72iMeealNfJlB70yjOHnw0SIPjx1Ohe
VG2dkFFyRkNhMBoyEF1wueXBrQRKtUsdIOuni68cXhRWfLpGfwE67vCNJak0xJH0
MPqBTqRJKLpIsQUfEH8ZfCVJBdhThjNSQKa+w+T8S3gSGPadKXsqnMpBgbN1DroA
BO4CjbZXU+m0kOF2V4LP/tMFzQks1IueaJQPSXsP10KLtliCjL3UfJCxDPR5bVhV
ertudUkTmFFCq3HRbiqfNAhXAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogZiUwwG2fK2TN8MFz7IzPAfyMJqTR8XOs3OluJlAYPHQQP
svhYcKEMgI+NWdE3k73JGGd3cthAeABjEi0jBFpLvUzMAYrIwspJlbKShiKknEGb
J8Kf7+/GFEp3RkWEkY5XN0N5Xjwn2bR+mGRTMdZElCD23gIIa8QR6QUIkel9E0n0
Ti68fY74ixaUZIBiRPnJnEax/tnfVCpj6stEh/2R/3R4FXqKl+WHJDhEfYNK2RqC
GhFMkFk7+7dInMep2J5gEB6CmfDT0Ev9sipoHaZ/mljq4EoivECqnFOX+IqVZVRz
hCYG9+XchBjs2bmMGgPcLqhE9dJ9b3bIAqx0N5AxHhddSEqRIhEN2BnIMhPoQG5r
OqZk+HLfcDz3IQOQKAJ6giEi/Mj3jEE3PHJYUOW/wGT3v5ax31dEBltURGEjijbs
hn/mVZcR7M+3jX74jmYfCFBLyXRGsNaEuRQjViTFBKtmQh09YbpKoFBU5JE=
-----END CERTIFICATE-----
)EOF";

// ══════════════════════════════════════════════════════════════════
//  SETUP
// ══════════════════════════════════════════════════════════════════
void setup() {
    Serial.begin(115200);
    delay(50);
    Serial.println();
    Serial.println("========================================");
    Serial.println(" CampusNav Bus Tracker — Booting");
    Serial.println("========================================");

    // ── GPS Serial Init ───────────────────────────────────────────
    gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    Serial.printf("[GPS] Serial2 started on RX=%d TX=%d @ %d baud\n",
                  GPS_RX_PIN, GPS_TX_PIN, GPS_BAUD);

    // ── WiFiManager ───────────────────────────────────────────────
    setupWiFi();

    // ── MQTT ──────────────────────────────────────────────────────
    espClient.setCACert(root_ca);
    mqttClient.setServer(MQTT_HOST, MQTT_PORT);
    mqttClient.setBufferSize(512);
    mqttClient.setKeepAlive(120);

    connectMqtt();

    Serial.println("[BOOT] Setup complete — entering main loop");
    Serial.println("========================================");
}

// ══════════════════════════════════════════════════════════════════
//  MAIN LOOP (Non-blocking)
// ══════════════════════════════════════════════════════════════════
void loop() {
    unsigned long now = millis();

    // ── Feed GPS parser ───────────────────────────────────────────
    while (gpsSerial.available() > 0) {
        gps.encode(gpsSerial.read());
    }

    // ── MQTT keep-alive ───────────────────────────────────────────
    if (now - lastMqttLoopMs >= MQTT_LOOP_INTERVAL) {
        lastMqttLoopMs = now;
        if (mqttClient.connected()) {
            mqttClient.loop();
        }
    }

    // ── WiFi health check ─────────────────────────────────────────
    if (now - lastWifiCheckMs >= WIFI_CHECK_INTERVAL) {
        lastWifiCheckMs = now;
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[WIFI] Connection lost — reconnecting...");
            WiFi.reconnect();
            delay(100);
        }
    }

    // ── MQTT reconnect if needed ──────────────────────────────────
    if (!mqttClient.connected()) {
        connectMqtt();
    }

    // ── Publish on interval ───────────────────────────────────────
    if (now - lastPublishMs >= PUBLISH_INTERVAL_MS) {
        lastPublishMs = now;
        publishGpsData();
    }
}

// ══════════════════════════════════════════════════════════════════
//  WiFi Setup via WiFiManager
// ══════════════════════════════════════════════════════════════════
void setupWiFi() {
    Serial.println("[WIFI] Starting WiFiManager...");

    wifiManager.setConfigPortalTimeout(WM_TIMEOUT_SEC);
    wifiManager.setConnectTimeout(20);
    wifiManager.setMinimumSignalQuality(15);

    // Non-blocking: autoConnect tries saved creds first,
    // falls back to captive portal AP
    bool connected = wifiManager.autoConnect(WM_AP_NAME, WM_AP_PASS);

    if (connected) {
        Serial.printf("[WIFI] ✅ Connected to: %s\n", WiFi.SSID().c_str());
        Serial.printf("[WIFI] IP: %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("[WIFI] RSSI: %d dBm\n", WiFi.RSSI());
    } else {
        Serial.println("[WIFI] ❌ Failed to connect — restarting ESP32");
        ESP.restart();
    }
}

// ══════════════════════════════════════════════════════════════════
//  MQTT Connect with Retry
// ══════════════════════════════════════════════════════════════════
void connectMqtt() {
    if (mqttClient.connected()) return;

    String clientId = "CampusNavBus_" + String(BUS_ID) + "_" + String(millis() % 10000);

    Serial.printf("[MQTT] Connecting to %s:%d as %s...\n", MQTT_HOST, MQTT_PORT, clientId.c_str());

    for (int attempt = 1; attempt <= MQTT_RETRY_MAX; attempt++) {
        Serial.printf("[MQTT] Attempt %d/%d\n", attempt, MQTT_RETRY_MAX);

        if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
            Serial.println("[MQTT] ✅ Connected to HiveMQ Cloud");
            // Allow TLS handshake to fully stabilize
            delay(100);
            mqttClient.loop();
            return;
        }

        int rc = mqttClient.state();
        Serial.printf("[MQTT] ❌ Failed (rc=%d)\n", rc);

        if (attempt < MQTT_RETRY_MAX) {
            // Exponential backoff: 2s, 4s, 6s, 8s
            unsigned long backoff = attempt * 2000UL;
            Serial.printf("[MQTT] Retrying in %lu ms...\n", backoff);
            unsigned long start = millis();
            while (millis() - start < backoff) {
                // Feed GPS during wait to avoid data loss
                while (gpsSerial.available() > 0) {
                    gps.encode(gpsSerial.read());
                }
                delay(10);
            }
        }
    }

    Serial.println("[MQTT] ❌ All attempts failed — will retry next loop cycle");
}

// ══════════════════════════════════════════════════════════════════
//  GPS Data Publish
// ══════════════════════════════════════════════════════════════════
void publishGpsData() {
    // ── Check GPS fix validity ────────────────────────────────────
    if (!gps.location.isValid()) {
        Serial.printf("[GPS] No fix — Satellites: %d | Chars processed: %lu\n",
                      gps.satellites.value(), gps.charsProcessed());

        if (gps.charsProcessed() < 10) {
            Serial.println("[GPS] ⚠️  No data from GPS module — check wiring (RX/TX)");
        }
        return;
    }

    // ── Extract GPS data ──────────────────────────────────────────
    double lat  = gps.location.lat();
    double lng  = gps.location.lng();
    double spd  = gps.speed.kmph();
    int    sats = gps.satellites.value();

    // ── Build JSON payload ────────────────────────────────────────
    char payload[256];
    snprintf(payload, sizeof(payload),
        "{"
            "\"bus_id\":\"%s\","
            "\"latitude\":%.6f,"
            "\"longitude\":%.6f,"
            "\"speed\":%.1f,"
            "\"satellites\":%d,"
            "\"device_key\":\"%s\""
        "}",
        BUS_ID, lat, lng, spd, sats, DEVICE_KEY
    );

    // ── Publish ───────────────────────────────────────────────────
    if (!mqttClient.connected()) {
        Serial.println("[MQTT] Not connected — skipping publish");
        failCount++;
        return;
    }

    bool ok = mqttClient.publish(MQTT_TOPIC, payload, false);
    mqttClient.loop();

    if (ok) {
        publishCount++;
        Serial.printf("[PUB] ✅ #%u → %s\n", publishCount, MQTT_TOPIC);
        Serial.printf("[PUB]    lat=%.6f lng=%.6f spd=%.1f sats=%d\n",
                      lat, lng, spd, sats);
    } else {
        failCount++;
        Serial.printf("[PUB] ❌ Publish failed (count: %u)\n", failCount);
    }
}
