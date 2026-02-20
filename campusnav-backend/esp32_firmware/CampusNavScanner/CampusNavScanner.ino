/*
 * CampusNav BLE Scanner Firmware — MQTT Cloud + WiFi Captive Portal
 * 
 * Scans for faculty BLE tags → publishes JSON to HiveMQ Cloud via TLS MQTT
 * Fully wireless — no USB data connection to backend required
 * 
 * WiFi Provisioning:
 *   - On first boot (or after credential reset), creates a hotspot "CampusNav_Config"
 *   - User connects to hotspot and opens 192.168.4.1 in browser
 *   - User enters WiFi SSID and password via web form
 *   - Credentials are saved to ESP32 flash (NVS) — persist across power cycles
 *   - ESP32 reboots and connects automatically to the configured WiFi
 *   - If WiFi fails 5 consecutive cycles → credentials are erased → re-enters portal
 *   - No firmware reflash needed to change WiFi — ever
 * 
 * Architecture:
 *   ESP32 → WiFi (provisioned) → HiveMQ Cloud (TLS 8883) → Node.js Backend → MongoDB Atlas
 * 
 * Required Libraries (install via Arduino Library Manager):
 *   - WiFiManager           (by tzapu, version >= 2.0.0)
 *   - PubSubClient          (by Nick O'Leary)
 *   - ArduinoJson           (by Benoit Blanchon)
 *   - WiFiClientSecure      (built-in with ESP32 Arduino core)
 * 
 * Configuration:
 *   Scanner identity and MQTT credentials are in config.h (gitignored)
 *   WiFi credentials are managed via captive portal — NOT in config.h
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "config.h"

// ===== MQTT TOPIC =====
// Publishes to: campusnav/faculty/{SCANNER_ID}
// Backend subscribes to: campusnav/faculty/+
static char mqttTopic[64];

// ===== TLS Configuration =====
// Using setInsecure() — traffic is still fully encrypted via TLS,
// but we skip pinning to a specific root CA certificate.
// This avoids CA mismatch failures with HiveMQ Cloud's rotating cert chain.
// Authentication is enforced via MQTT username/password.

// ===== GLOBALS =====
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
WiFiManager wifiManager;
Preferences prefs;
BLEScan* pBLEScan;

// WiFi failure tracking — stored in NVS to survive reboots
int wifiFailCount = 0;

// Detection buffer — stores up to 10 faculty per scan cycle
#define MAX_DETECTIONS 10

struct Detection {
  String facultyId;
  String tagId;
  int rssi;
};

Detection detections[MAX_DETECTIONS];
int detectionCount = 0;

// ===== BLE SCAN CALLBACK =====
// (Unchanged from previous version — BLE logic is not modified)
class ScanCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice device) override {
    if (!device.haveManufacturerData()) return;

    String payload = String(device.getManufacturerData().c_str());

    // Filter: only CampusNav faculty tags (format: FAC_xxx|TAG_xxx)
    if (!payload.startsWith("FAC_")) return;

    int sep = payload.indexOf('|');
    if (sep == -1) return;

    String facId = payload.substring(0, sep);
    String tagId = payload.substring(sep + 1);
    int rssi     = device.getRSSI();

    // Avoid duplicates in same scan cycle
    for (int i = 0; i < detectionCount; i++) {
      if (detections[i].facultyId == facId) {
        // Keep the stronger RSSI reading
        if (rssi > detections[i].rssi) {
          detections[i].rssi  = rssi;
          detections[i].tagId = tagId;
        }
        return;
      }
    }

    // Add new detection if buffer has space
    if (detectionCount < MAX_DETECTIONS) {
      detections[detectionCount].facultyId = facId;
      detections[detectionCount].tagId     = tagId;
      detections[detectionCount].rssi      = rssi;
      detectionCount++;
    }
  }
};

// ================================================================
//  WiFi PROVISIONING VIA CAPTIVE PORTAL
// ================================================================

/**
 * Load the WiFi failure counter from NVS flash.
 * This persists across power cycles so the device can accumulate
 * failures even if it reboots between attempts.
 */
void loadFailCount() {
  prefs.begin("campusnav", false);
  wifiFailCount = prefs.getInt("wifiFails", 0);
  prefs.end();
}

/**
 * Save the WiFi failure counter to NVS flash.
 */
void saveFailCount(int count) {
  prefs.begin("campusnav", false);
  prefs.putInt("wifiFails", count);
  prefs.end();
}

/**
 * Erase saved WiFi credentials and reset failure counter.
 * After this, the next boot will enter captive portal mode.
 */
void resetWiFiCredentials() {
  Serial.println("[WIFI] ⚠️  Erasing saved WiFi credentials...");
  wifiManager.resetSettings();
  saveFailCount(0);
  Serial.println("[WIFI] Credentials erased. Rebooting into portal mode...");
  delay(1000);
  ESP.restart();
}

/**
 * Connect to WiFi using WiFiManager.
 * 
 * Flow:
 *   1. WiFiManager checks if credentials are saved in flash (NVS)
 *   2. If saved → attempts connection with saved SSID/password
 *   3. If connection succeeds → returns true immediately
 *   4. If no saved credentials OR connection fails:
 *      a. Starts AP hotspot "CampusNav_Config" (password: "CampusNav123")
 *      b. Launches captive portal web server on 192.168.4.1
 *      c. User connects to AP from phone/laptop, enters new WiFi credentials
 *      d. WiFiManager saves credentials to flash and connects to new network
 *      e. On success → returns true
 *      f. On timeout → returns false (device will retry next cycle)
 * 
 * @return true if WiFi is connected, false if portal timed out
 */
bool provisionWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  // Configure WiFiManager
  wifiManager.setConfigPortalTimeout(PORTAL_TIMEOUT_SEC);
  wifiManager.setConnectTimeout(15);       // 15 seconds per connection attempt
  wifiManager.setMinimumSignalQuality(15); // Ignore very weak networks in scan list

  // Custom portal page title
  wifiManager.setTitle("CampusNav Scanner WiFi Setup");

  Serial.println("[WIFI] Attempting connection with saved credentials...");

  // autoConnect() does all the heavy lifting:
  //   - If saved credentials exist and work → connects silently
  //   - If not → starts AP + captive portal and blocks until configured or timeout
  bool connected = wifiManager.autoConnect(AP_NAME, AP_PASS);

  if (connected) {
    Serial.println("[WIFI] ✅ Connected!");
    Serial.print("[WIFI] SSID: ");
    Serial.println(WiFi.SSID());
    Serial.print("[WIFI] IP:   ");
    Serial.println(WiFi.localIP());

    // Reset failure counter on success
    wifiFailCount = 0;
    saveFailCount(0);
    return true;
  }

  // Connection failed (portal timed out without user input)
  Serial.println("[WIFI] ❌ Connection failed (portal timed out)");

  wifiFailCount++;
  saveFailCount(wifiFailCount);

  Serial.print("[WIFI] Consecutive failures: ");
  Serial.print(wifiFailCount);
  Serial.print("/");
  Serial.println(WIFI_FAIL_LIMIT);

  // After WIFI_FAIL_LIMIT consecutive failures, erase credentials
  // so next boot starts fresh portal
  if (wifiFailCount >= WIFI_FAIL_LIMIT) {
    Serial.println("[WIFI] 🔄 Failure limit reached — erasing stale credentials");
    resetWiFiCredentials();  // This reboots the device
  }

  return false;
}

// ===== MQTT CONNECTION =====
// (Logic unchanged — only WiFi layer was modified)
bool connectMQTT() {
  if (mqttClient.connected()) return true;

  Serial.print("[MQTT] Connecting to HiveMQ Cloud... ");

  String clientId = "CampusNav_" + String(SCANNER_ID);

  for (int attempt = 1; attempt <= MQTT_RETRY_MAX; attempt++) {
    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println("OK");
      // Let PubSubClient process the CONNACK and stabilize
      mqttClient.loop();
      delay(100);
      mqttClient.loop();
      return true;
    }

    Serial.print("retry ");
    Serial.print(attempt);
    Serial.print("/");
    Serial.print(MQTT_RETRY_MAX);
    Serial.print(" (rc=");
    Serial.print(mqttClient.state());
    Serial.println(")");
    delay(2000);
  }

  Serial.println("[MQTT] Connection FAILED");
  return false;
}

// ===== PUBLISH DETECTION =====
// (Unchanged — only WiFi layer was modified)
void publishDetection(Detection& det) {
  StaticJsonDocument<256> doc;

  doc["facultyId"] = det.facultyId;
  doc["tagId"]     = det.tagId;
  doc["scannerId"] = SCANNER_ID;
  doc["room"]      = ROOM_NAME;
  doc["rssi"]      = det.rssi;

  char buffer[256];
  size_t len = serializeJson(doc, buffer);

  if (mqttClient.publish(mqttTopic, buffer, false)) {
    Serial.print("[MQTT] Published: ");
    Serial.print(det.facultyId);
    Serial.print(" -> ");
    Serial.println(ROOM_NAME);
  } else {
    Serial.print("[MQTT] Publish FAILED for ");
    Serial.println(det.facultyId);
  }
}

// ================================================================
//  SETUP
// ================================================================
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println();
  Serial.println("============================================");
  Serial.println("  CampusNav BLE Scanner — WiFi Portal Mode");
  Serial.println("============================================");
  Serial.print("Scanner ID : "); Serial.println(SCANNER_ID);
  Serial.print("Room       : "); Serial.println(ROOM_NAME);
  Serial.print("Broker     : "); Serial.println(MQTT_HOST);
  Serial.print("Portal AP  : "); Serial.println(AP_NAME);
  Serial.println();

  // Load persistent failure counter
  loadFailCount();
  Serial.print("WiFi fail count (from flash): ");
  Serial.println(wifiFailCount);
  Serial.println();

  // Build MQTT topic: campusnav/faculty/{SCANNER_ID}
  snprintf(mqttTopic, sizeof(mqttTopic), "campusnav/faculty/%s", SCANNER_ID);
  Serial.print("Topic      : "); Serial.println(mqttTopic);
  Serial.println();

  // TLS setup — use encrypted connection without certificate pinning
  espClient.setInsecure();

  // MQTT broker configuration
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(512);

  // ── WiFi Provisioning ────────────────────────────────────────
  // This either connects silently (saved creds) or starts captive portal
  if (!provisionWiFi()) {
    Serial.println("[BOOT] WiFi not available — will retry each cycle");
  }

  // Connect MQTT if WiFi succeeded
  if (WiFi.status() == WL_CONNECTED) {
    if (!connectMQTT()) {
      Serial.println("[BOOT] MQTT failed — will retry in main loop");
    }
  }

  // Initialize BLE scanner
  BLEDevice::init("");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new ScanCallbacks());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  Serial.println("[BOOT] Setup complete — entering scan loop\n");
}

// ================================================================
//  MAIN LOOP
// ================================================================
void loop() {
  // ── Step 1: BLE Scan ─────────────────────────────────────────
  detectionCount = 0;  // Reset detection buffer
  Serial.println("[SCAN] Scanning for faculty tags...");

  pBLEScan->start(SCAN_TIME, false);
  pBLEScan->clearResults();

  if (detectionCount == 0) {
    Serial.println("[SCAN] No faculty detected this cycle");
  } else {
    Serial.print("[SCAN] Detected ");
    Serial.print(detectionCount);
    Serial.println(" faculty member(s)");

    // ── Step 2: Ensure WiFi connectivity ───────────────────────
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WIFI] Connection lost — attempting reconnect...");

      // Try reconnecting to saved network (non-portal, quick attempt)
      WiFi.reconnect();
      unsigned long start = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
        delay(500);
        Serial.print(".");
      }
      Serial.println();

      if (WiFi.status() != WL_CONNECTED) {
        wifiFailCount++;
        saveFailCount(wifiFailCount);

        Serial.print("[WIFI] ❌ Reconnect failed (");
        Serial.print(wifiFailCount);
        Serial.print("/");
        Serial.print(WIFI_FAIL_LIMIT);
        Serial.println(")");

        if (wifiFailCount >= WIFI_FAIL_LIMIT) {
          Serial.println("[WIFI] 🔄 Failure limit reached — entering portal mode");
          resetWiFiCredentials();  // Erases creds and reboots
        }

        Serial.println("[SKIP] No WiFi — discarding scan data");
        goto sleepPhase;
      }

      // Reconnected successfully
      Serial.println("[WIFI] ✅ Reconnected!");
      wifiFailCount = 0;
      saveFailCount(0);
    }

    // ── Step 3: Ensure MQTT connectivity ───────────────────────
    if (!connectMQTT()) {
      Serial.println("[SKIP] No MQTT — discarding scan data");
      goto sleepPhase;
    }

    // ── Step 4: Publish each detection ─────────────────────────
    for (int i = 0; i < detectionCount; i++) {
      mqttClient.loop();  // Process incoming MQTT packets before publishing
      publishDetection(detections[i]);
      delay(50);
    }
    mqttClient.loop();  // Final loop after all publishes
  }

  sleepPhase:
  // ── Step 5: Sleep with MQTT keep-alive ────────────────────────
  // Instead of a single blocking delay(55000), loop in small chunks
  // so mqttClient.loop() keeps the broker connection alive.
  Serial.println("[SLEEP] Next scan in ~55 seconds\n");
  {
    unsigned long sleepStart = millis();
    while (millis() - sleepStart < SCAN_DELAY_MS) {
      if (mqttClient.connected()) {
        mqttClient.loop();
      }
      delay(5000);  // Check every 5 seconds
    }
  }
}
