/*
 * CampusNav Scanner — Configuration
 * 
 * ⚠️  This file contains sensitive credentials.
 * ⚠️  It MUST be listed in .gitignore and NEVER committed to version control.
 * 
 * Update these values for your deployment environment.
 */

#ifndef CONFIG_H
#define CONFIG_H

// ===== SCANNER IDENTITY =====
// Change these per-scanner to match the deployed room
#define SCANNER_ID  "SC_D103"
#define ROOM_NAME   "D103"

// ===== WiFi CREDENTIALS =====
#define WIFI_SSID   "Neo 7"
#define WIFI_PASS   "12344321"

// ===== MQTT BROKER (HiveMQ Cloud) =====
#define MQTT_HOST   "3c60f8b503484291b63dbddddff36f60.s1.eu.hivemq.cloud"
#define MQTT_PORT   8883
#define MQTT_USER   "campusnav"
#define MQTT_PASS   "Campusnav123"

// ===== TIMING =====
#define SCAN_TIME       5       // BLE scan duration in seconds
#define SCAN_DELAY_MS   55000   // Sleep after scan (scan + sleep ≈ 60s cycle)
#define WIFI_TIMEOUT_MS 10000   // Max time to wait for WiFi connection
#define MQTT_RETRY_MAX  5       // Max MQTT reconnect attempts per cycle

#endif
