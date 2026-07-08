// =====================================================================
// utils/faqCache.js  –  Simple In-Memory FAQ Cache
// ---------------------------------------------------------------------
// Previously, EVERY chat message triggered a fresh FAQ.find() query
// against MongoDB — even though FAQs rarely change. This caches the
// FAQ list in memory for a few minutes, cutting down on repeated DB
// round-trips, and gives the Developer Panel's "Cache Management"
// screen something concrete to inspect/clear.
// =====================================================================

let cachedFaqs = null;
let cachedAt = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Returns the FAQ list, using the cache if it's still fresh, or
// re-querying MongoDB (and refreshing the cache) if it's stale/empty.
async function getFAQsCached(FAQModel) {

    const isStale = !cachedFaqs || (Date.now() - cachedAt) > CACHE_TTL_MS;

    if (isStale) {
        cachedFaqs = await FAQModel.find({ isActive: true });
        cachedAt = Date.now();
    }

    return cachedFaqs;
}

// Call this whenever an FAQ is added/edited/deleted, so the next chat
// message re-fetches fresh data instead of serving stale cached FAQs.
function clearFaqCache() {
    cachedFaqs = null;
    cachedAt = null;
}

function getCacheStatus() {
    return {
        cached: !!cachedFaqs,
        entryCount: cachedFaqs ? cachedFaqs.length : 0,
        ageSeconds: cachedAt ? Math.round((Date.now() - cachedAt) / 1000) : null,
        ttlSeconds: CACHE_TTL_MS / 1000,
    };
}

module.exports = { getFAQsCached, clearFaqCache, getCacheStatus };