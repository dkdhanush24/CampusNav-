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

// ===== ISRG Root X1 CA Certificate (Let's Encrypt) =====
// Required to verify HiveMQ Cloud's TLS certificate
static const char* ROOT_CA PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogZiUvsIJKiZhmn3eMfSArSAePr7iDNEFt0aP+KlLFghAFm
1SUSiIWgHTivJWJSAjDPiUuT7lx4MNO7DDIcQAZTSUVBPALGOPFGqyRkjJOFhG5h
Y9cFAVOlYYSq3JKlf9yt+TTUPM+RAojdALHmVOXD2RVGF4bqeKgXNjGUEYhYGaH
vCSKdO/GBRKERw3pl08uOQlGarAztiF5IDQOG2FLPnHEV4qOhl4AsPsaJ1RJGCKT
qJGSaGcGFGUG7+jlKCa0z7r+0qnJoAmhxh/cKyqiFZ0cNRWwUXdqxBgVLBdseLCe
eH6nTjGGd/LFGxGJkSBiligqkQkJULMwJ8N20EoFRLbxItEBaShIlSmdPd0gV1KX
nGnCQxEF6FmpJK4GqLKTPGqvRYfMD/3LOoV7d6TQgC6j9hN1e+Eiq5dN3mI3AISV
YGVkzQFGfhTPnDJWN3YqarWFGjR/JM6jk2lqJM0jhWCTo4eLJMSLqcNMMD4=
-----END CERTIFICATE-----
)EOF";

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

  // TLS setup — load root CA for HiveMQ Cloud certificate verification
  espClient.setCACert(ROOT_CA);

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
      publishDetection(detections[i]);
      delay(50);  // Small gap between publishes to avoid flooding
    }
  }

  sleepPhase:
  // ── Step 5: Sleep until next cycle ───────────────────────────
  Serial.println("[SLEEP] Next scan in ~55 seconds\n");
  delay(SCAN_DELAY_MS);
}
