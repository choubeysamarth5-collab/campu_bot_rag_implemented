const embeddings = require("../embeddings/geminiEmbeddings");

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 300;
const SIMILARITY_THRESHOLD = 0.94;
const entries = [];
let hits = 0;
let misses = 0;

function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return -1;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : -1;
}

async function embedQuery(query) {
    const started = Date.now();
    try {
        const vector = await embeddings.embedQuery(query);
        console.log("[RAG]", JSON.stringify({ stage: "query_embedding", status: "ok", durationMs: Date.now() - started }));
        return vector;
    } catch (error) {
        console.error("[RAG]", JSON.stringify({ stage: "query_embedding", status: "error", message: error.message }));
        throw error;
    }
}

function findCachedAnswer(scope, vector) {
    const now = Date.now();
    for (let i = entries.length - 1; i >= 0; i--) {
        if (now - entries[i].createdAt > CACHE_TTL_MS) entries.splice(i, 1);
    }
    let best = null;
    for (const entry of entries) {
        if (entry.scope !== scope) continue;
        const similarity = cosineSimilarity(vector, entry.vector);
        if (similarity >= SIMILARITY_THRESHOLD && (!best || similarity > best.similarity)) {
            best = { ...entry, similarity };
        }
    }
    if (best) {
        hits++;
        console.log("[RAG]", JSON.stringify({ stage: "semantic_cache", status: "HIT", scope, similarity: Number(best.similarity.toFixed(4)), ageSeconds: Math.round((now - best.createdAt) / 1000) }));
        return best.answer;
    }
    misses++;
    console.log("[RAG]", JSON.stringify({ stage: "semantic_cache", status: "MISS", scope, entries: entries.filter(entry => entry.scope === scope).length }));
    return null;
}

function storeAnswer(scope, vector, answer) {
    if (!scope || !Array.isArray(vector) || !answer) return;
    entries.push({ scope, vector, answer, createdAt: Date.now() });
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    console.log("[RAG]", JSON.stringify({ stage: "semantic_cache", status: "STORED", scope, entries: entries.filter(entry => entry.scope === scope).length }));
}

function clearSemanticCache() {
    entries.length = 0;
    hits = 0;
    misses = 0;
}

function getSemanticCacheStatus() {
    const now = Date.now();
    const active = entries.filter(entry => now - entry.createdAt <= CACHE_TTL_MS);
    return {
        enabled: true,
        entries: active.length,
        hits,
        misses,
        ttlSeconds: CACHE_TTL_MS / 1000,
        similarityThreshold: SIMILARITY_THRESHOLD,
        storage: "in-memory (clears on server restart)",
    };
}

module.exports = { embedQuery, findCachedAnswer, storeAnswer, clearSemanticCache, getSemanticCacheStatus };
