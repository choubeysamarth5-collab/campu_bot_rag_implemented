// =====================================================================
// utils/logger.js  –  Lightweight In-Memory Logger
// ---------------------------------------------------------------------
// The app previously only used plain console.log/console.error, which
// disappears the moment the terminal scrolls or the process restarts
// — there was no way to see "what happened recently" from the admin
// panel. This module keeps the last N log entries in memory (still
// also printing to the console as before) so the Developer Panel's
// "Developer Logs" and "Error Monitor" screens have something to show.
//
// NOTE: This is intentionally simple (in-memory, resets on restart).
// For a production deployment you'd eventually want a real logging
// library (winston/pino) writing to disk or a log service instead.
// =====================================================================

const MAX_ENTRIES = 300;

let logs = [];

function addEntry(level, message) {
    logs.push({
        level,
        message: typeof message === "string" ? message : JSON.stringify(message),
        timestamp: new Date().toISOString(),
    });

    // Keep only the most recent MAX_ENTRIES so memory doesn't grow
    // forever on a long-running server.
    if (logs.length > MAX_ENTRIES) {
        logs.shift();
    }
}

function info(message) {
    console.log(message);
    addEntry("info", message);
}

function warn(message) {
    console.warn(message);
    addEntry("warn", message);
}

function error(message) {
    console.error(message);
    addEntry("error", message);
}

// Returns the most recent entries, newest first. Pass `level` to
// filter (e.g. "error" for the Error Monitor screen).
function getLogs({ level = null, limit = 200 } = {}) {
    let result = logs;

    if (level) {
        result = result.filter(entry => entry.level === level);
    }

    return result.slice(-limit).reverse();
}

function clearLogs() {
    logs = [];
}

module.exports = { info, warn, error, getLogs, clearLogs };