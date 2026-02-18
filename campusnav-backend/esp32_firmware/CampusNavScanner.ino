/*
 * CampusNav BLE Scanner Firmware
 * 
 * Scans for faculty BLE tags and outputs JSON to Serial
 * Node.js backend reads Serial via USB and updates MongoDB
 * 
 * FULLY OFFLINE - No WiFi required
 */

#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <ArduinoJson.h>

// ===== SCANNER IDENTITY =====
#define SCANNER_ID "SC_D103"
#define ROOM_NAME  "D103"

// Scan duration (seconds)
#define SCAN_TIME 5

// Scan interval (1 minute for testing)
#define SCAN_DELAY 60000  // 60,000 ms = 1 minute

BLEScan* pBLEScan;

// Store detected faculty for JSON output
String detectedFacultyId = "";
String detectedTagId = "";
int detectedRSSI = 0;
bool facultyDetected = false;

// Callback class for detected BLE devices
class CampusNavScannerCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice device) {
    
    // We only care about manufacturer data
    if (!device.haveManufacturerData()) return;

    String payload = String(device.getManufacturerData().c_str());

    // Filter only CampusNav faculty tags
    // Expected format: FAC_xxx|TAG_xxx
    if (!payload.startsWith("FAC_")) return;

    int separatorIndex = payload.indexOf('|');
    if (separatorIndex == -1) return;

    String facultyId = payload.substring(0, separatorIndex);
    String tagId     = payload.substring(separatorIndex + 1);

    int rssi = device.getRSSI();

    // Store for JSON output
    detectedFacultyId = facultyId;
    detectedTagId = tagId;
    detectedRSSI = rssi;
    facultyDetected = true;

    // Print human-readable for debugging
    Serial.println("----- Faculty Detected -----");
    Serial.print("Faculty ID : "); Serial.println(facultyId);
    Serial.print("Tag ID     : "); Serial.println(tagId);
    Serial.print("Room       : "); Serial.println(ROOM_NAME);
    Serial.print("RSSI       : "); Serial.println(rssi);
    Serial.println("----------------------------");
  }
};

// Send JSON payload for Node.js to parse
void sendJsonPayload() {
  StaticJsonDocument<256> doc;
  
  doc["facultyId"] = detectedFacultyId;
  doc["tagId"] = detectedTagId;
  doc["scannerId"] = SCANNER_ID;
  doc["room"] = ROOM_NAME;
  doc["rssi"] = detectedRSSI;

  // Output as single-line JSON
  serializeJson(doc, Serial);
  Serial.println();  // Newline for parser
}

void setup() {
  Serial.begin(115200);
  
  Serial.println();
  Serial.println("=============================");
  Serial.println("CampusNav BLE Scanner");
  Serial.println("USB Serial Mode (Offline)");
  Serial.println("=============================");
  Serial.print("Scanner ID: "); Serial.println(SCANNER_ID);
  Serial.print("Room: "); Serial.println(ROOM_NAME);
  Serial.println();

  BLEDevice::init("");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new CampusNavScannerCallbacks());
  pBLEScan->setActiveScan(true);
}

void loop() {
  // Reset detection flag
  facultyDetected = false;

  Serial.println("Scanning for faculty tags...");
  pBLEScan->start(SCAN_TIME, false);
  pBLEScan->clearResults();

  // If faculty was detected, send JSON to Serial
  if (facultyDetected) {
    sendJsonPayload();
    Serial.println("JSON sent to backend via USB");
  } else {
    Serial.println("No faculty detected this scan.");
  }

  Serial.println("Scan complete. Sleeping 1 minute...\n");
  delay(SCAN_DELAY);
}
