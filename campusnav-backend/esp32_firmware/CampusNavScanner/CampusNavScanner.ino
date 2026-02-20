/*
 * CampusNav BLE Scanner Firmware — MQTT Cloud Edition
 * 
 * Scans for faculty BLE tags → publishes JSON to HiveMQ Cloud via TLS MQTT
 * Fully wireless — no USB data connection to backend required
 * 
 * Architecture:
 *   ESP32 → WiFi → HiveMQ Cloud (TLS port 8883) → Node.js Backend Subscriber → MongoDB Atlas
 * 
 * Requires Libraries:
 *   - PubSubClient (by Nick O'Leary)
 *   - ArduinoJson (by Benoit Blanchon)
 *   - WiFiClientSecure (built-in with ESP32 Arduino core)
 * 
 * Configuration:
 *   All credentials and constants are in config.h (gitignored)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <ArduinoJson.h>
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
BLEScan* pBLEScan;

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

// ===== WiFi CONNECTION =====
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);
  Serial.print(" ");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > WIFI_TIMEOUT_MS) {
      Serial.println(" FAILED (timeout)");
      return false;
    }
    Serial.print(".");
    delay(500);
  }

  Serial.println(" OK");
  Serial.print("[WiFi] IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

// ===== MQTT CONNECTION =====
bool connectMQTT() {
  if (mqttClient.connected()) return true;

  Serial.print("[MQTT] Connecting to HiveMQ Cloud... ");

  // Generate a unique client ID using chip MAC
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

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println();
  Serial.println("======================================");
  Serial.println("  CampusNav BLE Scanner — MQTT Cloud");
  Serial.println("======================================");
  Serial.print("Scanner ID : "); Serial.println(SCANNER_ID);
  Serial.print("Room       : "); Serial.println(ROOM_NAME);
  Serial.print("Broker     : "); Serial.println(MQTT_HOST);
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

  // Connect WiFi
  if (!connectWiFi()) {
    Serial.println("[BOOT] WiFi failed — will retry in main loop");
  }

  // Connect MQTT
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

// ===== MAIN LOOP =====
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

    // ── Step 2: Ensure connectivity ────────────────────────────
    if (!connectWiFi()) {
      Serial.println("[SKIP] No WiFi — discarding scan data");
    } else if (!connectMQTT()) {
      Serial.println("[SKIP] No MQTT — discarding scan data");
    } else {
      // ── Step 3: Publish each detection ───────────────────────
      for (int i = 0; i < detectionCount; i++) {
        publishDetection(detections[i]);
        delay(50);  // Small gap between publishes to avoid flooding
      }
    }
  }

  // ── Step 4: Sleep until next cycle ───────────────────────────
  Serial.println("[SLEEP] Next scan in ~55 seconds\n");
  delay(SCAN_DELAY_MS);
}
