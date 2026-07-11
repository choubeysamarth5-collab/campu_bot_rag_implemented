// =====================================================================
// utils/apiUsageTracker.js  –  Groq & Gemini Usage/Limit Tracker
// ---------------------------------------------------------------------
// Groq's API returns real rate-limit info in response headers on every
// call (x-ratelimit-remaining-requests, etc.) — we capture that here
// so the Developer Panel can show live, accurate numbers.
//
// Gemini's API does NOT expose remaining-quota headers, so for Gemini
// we can only track what WE'VE sent (a running request counter) —
// this is an approximation, not an official quota reading.
//
// Same in-memory pattern as faqCache.js / logger.js: resets on server
// restart. Good enough for a single-instance deployment.
// =====================================================================

// ── Groq: real data from response headers ───────────────────────────
let groq = {
    limitRequests: null,
    remainingRequests: null,
    limitTokens: null,
    remainingTokens: null,
    resetRequests: null,   // e.g. "2m59.56s" — Groq's raw string, shown as-is
    resetTokens: null,
    lastUpdatedAt: null,
};

function recordGroqHeaders(headers) {
    // `headers` here is a Fetch-style Headers object (from
    // groq-sdk's .withResponse()), so we use .get(...).
    groq = {
        limitRequests: headers.get("x-ratelimit-limit-requests"),
        remainingRequests: headers.get("x-ratelimit-remaining-requests"),
        limitTokens: headers.get("x-ratelimit-limit-tokens"),
        remainingTokens: headers.get("x-ratelimit-remaining-tokens"),
        resetRequests: headers.get("x-ratelimit-reset-requests"),
        resetTokens: headers.get("x-ratelimit-reset-tokens"),
        lastUpdatedAt: new Date().toISOString(),
    };
}

function getGroqUsage() {
    return { ...groq };
}


// ── Gemini: we track our own call count, since Gemini's API gives us
// no way to read remaining quota directly ──────────────────────────
let gemini = {
    callsToday: 0,
    callsAllTime: 0,
    lastCallAt: null,
    dayStarted: new Date().toDateString(),
};

function recordGeminiCall() {
    // Reset the daily counter if we've crossed into a new day.
    const today = new Date().toDateString();
    if (gemini.dayStarted !== today) {
        gemini.callsToday = 0;
        gemini.dayStarted = today;
    }

    gemini.callsToday += 1;
    gemini.callsAllTime += 1;
    gemini.lastCallAt = new Date().toISOString();
}

function getGeminiUsage() {
    // Same day-rollover check on read, in case no calls have been
    // made yet today (so the panel doesn't show yesterday's count).
    const today = new Date().toDateString();
    if (gemini.dayStarted !== today) {
        gemini.callsToday = 0;
        gemini.dayStarted = today;
    }
    return { ...gemini };
}


module.exports = {
    recordGroqHeaders,
    getGroqUsage,
    recordGeminiCall,
    getGeminiUsage,
};