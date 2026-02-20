/*
 * CampusNav Scanner — Configuration
 * 
 * ⚠️  This file contains sensitive credentials.
 * ⚠️  It MUST be listed in .gitignore and NEVER committed to version control.
 * 
 * WiFi credentials are NO LONGER stored here.
 * WiFi is configured via the captive portal (192.168.4.1) at first boot.
 * Credentials persist in ESP32 flash across power cycles.
 */

#ifndef CONFIG_H
#define CONFIG_H

// ===== SCANNER IDENTITY =====
// Change these per-scanner to match the deployed room
#define SCANNER_ID  "SC_D103"
#define ROOM_NAME   "D103"

// ===== CAPTIVE PORTAL SETTINGS =====
// AP name and password for the configuration hotspot
#define AP_NAME     "CampusNav_Config"
#define AP_PASS     "CampusNav123"

// ===== MQTT BROKER (HiveMQ Cloud) =====
#define MQTT_HOST   "3c60f8b503484291b63dbddddff36f60.s1.eu.hivemq.cloud"
#define MQTT_PORT   8883
#define MQTT_USER   "campusnav"
#define MQTT_PASS   "Campusnav123"

// ===== TIMING =====
#define SCAN_TIME           5       // BLE scan duration in seconds
#define SCAN_DELAY_MS       55000   // Sleep after scan (scan + sleep ≈ 60s cycle)
#define MQTT_RETRY_MAX      5       // Max MQTT reconnect attempts per cycle
#define WIFI_FAIL_LIMIT     5       // Consecutive WiFi failures before credential reset
#define PORTAL_TIMEOUT_SEC  180     // Captive portal auto-close timeout (3 minutes)

#endif
