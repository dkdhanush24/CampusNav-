/**
 * Serial Scanner Listener
 * 
 * Reads ESP32 BLE scanner data from USB Serial (COM port)
 * Forwards to existing /api/scanner/update endpoint
 * 
 * FULLY OFFLINE - No WiFi required
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { upsertFacultyLocation } = require('./locationService');

// COM port configuration - UPDATE THIS TO YOUR ESP32 PORT
const COM_PORT = process.env.ESP32_PORT || 'COM5';
const BAUD_RATE = 115200;

let serialPort = null;
let isConnected = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

/**
 * Initialize and start the serial listener
 */
function startSerialListener() {
    console.log('\n========================================');
    console.log('  CampusNav Serial Scanner Gateway');
    console.log('========================================');
    console.log(`Attempting to connect to ESP32 on ${COM_PORT}...`);

    try {
        serialPort = new SerialPort({
            path: COM_PORT,
            baudRate: BAUD_RATE,
            autoOpen: false
        });

        // Create line parser for reading JSON lines
        const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        // Handle successful connection
        serialPort.on('open', () => {
            isConnected = true;
            console.log(`✓ Connected to ESP32 on ${COM_PORT}`);
            console.log('Listening for BLE scan data...\n');

            // Clear any pending reconnect
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        });

        // Handle incoming data
        parser.on('data', async (line) => {
            await processSerialData(line);
        });

        // Handle errors
        serialPort.on('error', (err) => {
            console.error(`[Serial] Error: ${err.message}`);
            handleDisconnect();
        });

        // Handle close
        serialPort.on('close', () => {
            console.log('[Serial] Connection closed');
            handleDisconnect();
        });

        // Open the port
        serialPort.open((err) => {
            if (err) {
                console.error(`[Serial] Failed to open ${COM_PORT}: ${err.message}`);
                console.log('Make sure ESP32 is connected and port is correct.');
                console.log('Backend will continue running. Serial listener will retry...\n');
                scheduleReconnect();
            }
        });

    } catch (error) {
        console.error(`[Serial] Initialization error: ${error.message}`);
        scheduleReconnect();
    }
}

/**
 * Process incoming serial data line
 */
async function processSerialData(line) {
    // Skip empty lines
    if (!line || line.trim().length === 0) return;

    // Skip non-JSON lines (like "Scanning..." or "Scan complete...")
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith('{')) {
        // Log status messages for visibility
        if (trimmedLine.includes('Faculty') || trimmedLine.includes('Scan')) {
            console.log(`[ESP32] ${trimmedLine}`);
        }
        return;
    }

    try {
        // Parse JSON payload
        const data = JSON.parse(trimmedLine);

        // Validate required fields
        if (!data.facultyId || !data.scannerId || !data.room || data.rssi === undefined) {
            console.log(`[Serial] Invalid payload (missing fields): ${trimmedLine}`);
            return;
        }

        // Log received data
        console.log('\n----- Received from ESP32 -----');
        console.log(`Faculty ID : ${data.facultyId}`);
        console.log(`Tag ID     : ${data.tagId || 'N/A'}`);
        console.log(`Scanner ID : ${data.scannerId}`);
        console.log(`Room       : ${data.room}`);
        console.log(`RSSI       : ${data.rssi}`);
        console.log('-------------------------------');

        // Forward to existing backend logic
        const result = await upsertFacultyLocation({
            facultyId: data.facultyId,
            tagId: data.tagId || null,
            scannerId: data.scannerId,
            room: data.room,
            rssi: data.rssi
        });

        if (result.success) {
            console.log(`✓ Database updated: ${data.facultyId} → ${data.room}\n`);
        } else {
            console.log(`✗ Database update failed: ${result.error}\n`);
        }

    } catch (parseError) {
        // Ignore parse errors for non-JSON lines
        if (trimmedLine.length > 50) {
            console.log(`[Serial] Parse error: ${parseError.message}`);
        }
    }
}

/**
 * Handle disconnection and schedule reconnect
 */
function handleDisconnect() {
    isConnected = false;

    if (serialPort) {
        try {
            serialPort.close();
        } catch (e) {
            // Ignore close errors
        }
        serialPort = null;
    }

    scheduleReconnect();
}

/**
 * Schedule automatic reconnection
 */
function scheduleReconnect() {
    if (reconnectTimer) return;

    reconnectAttempts++;
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        console.log(`[Serial] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. ESP32 not available.`);
        console.log('[Serial] Chatbot and all other services will continue working normally.\n');
        return;
    }

    console.log(`[Serial] Will attempt reconnect in 5 seconds... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startSerialListener();
    }, 5000);
}

/**
 * Stop the serial listener
 */
function stopSerialListener() {
    console.log('[Serial] Stopping listener...');

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (serialPort && serialPort.isOpen) {
        serialPort.close();
    }

    isConnected = false;
}

/**
 * Check if serial is connected
 */
function isSerialConnected() {
    return isConnected;
}

module.exports = {
    startSerialListener,
    stopSerialListener,
    isSerialConnected
};
