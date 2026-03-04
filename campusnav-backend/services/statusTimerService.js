/**
 * Status Timer Service — Auto-expire private_break after 5 minutes
 *
 * Runs a periodic check every 60 seconds.
 * Any faculty with status = "private_break" whose statusUpdatedAt
 * is older than 5 minutes gets auto-reset to "available".
 */

const Faculty = require("../models/faculty");

const PRIVATE_BREAK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 60 * 1000;             // Check every 60 seconds

let intervalId = null;

async function checkAndExpirePrivateBreaks() {
    try {
        const cutoff = new Date(Date.now() - PRIVATE_BREAK_TIMEOUT_MS);

        const result = await Faculty.updateMany(
            {
                status: "private_break",
                statusUpdatedAt: { $lt: cutoff }
            },
            {
                $set: {
                    status: "available",
                    statusUpdatedAt: new Date()
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`[StatusTimer] Auto-expired ${result.modifiedCount} private_break(s) → available`);
        }
    } catch (error) {
        console.error("[StatusTimer] Error checking private breaks:", error.message);
    }
}

function startStatusTimer() {
    if (intervalId) {
        console.warn("[StatusTimer] Already running, skipping duplicate start.");
        return;
    }

    console.log("[StatusTimer] Started — checking every 60s for expired private_break");
    intervalId = setInterval(checkAndExpirePrivateBreaks, CHECK_INTERVAL_MS);

    // Also run immediately on start
    checkAndExpirePrivateBreaks();
}

function stopStatusTimer() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log("[StatusTimer] Stopped.");
    }
}

module.exports = { startStatusTimer, stopStatusTimer };
