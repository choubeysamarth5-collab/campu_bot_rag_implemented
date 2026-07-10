// =====================================================================
// routes/developer.js  –  Developer / System Diagnostics API
// ---------------------------------------------------------------------
// Powers a hidden developer page (developer.html) that is NOT linked
// from the admin sidebar — reached only by typing the URL directly.
// Every route here is restricted to SUPERADMIN accounts only
// (adminProtect + requireSuperAdmin), because it exposes system
// internals (whether secrets are configured, DB connection state,
// storage stats) and destructive "clear everything" actions.
// =====================================================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const mongoose = require("mongoose");

const router = express.Router();
const { adminProtect, requireSuperAdmin } = require("../middleware/adminAuth");
const logger = require("../utils/logger");
const faqCache = require("../utils/faqCache");
const geminiModel = require("../rag/config/gemini");
const {
    getVectorStore,
    getVectorCollection,
    COLLECTION_NAME,
} = require("../rag/config/mongoVectorStore");
const { getBucket } = require("../rag/config/gridfs");

const UPLOADS_PATH = path.join(__dirname, "../uploads");

// Recorded once when this module first loads (i.e. when the server
// starts), used to show "server started at" in Server Information.
const SERVER_STARTED_AT = new Date().toISOString();


// ── Helper: total size + file count of GridFS-stored PDFs (replaces
// the old local-disk folder stats, since PDFs now live in MongoDB
// Atlas via GridFS instead of the ephemeral local disk) ────────────
async function getUploadsStats() {
    try {
        const bucket = getBucket();
        const files = await bucket.find({}).toArray();

        const totalBytes = files.reduce((sum, f) => sum + f.length, 0);

        return {
            sizeKB: Math.round(totalBytes / 1024),
            fileCount: files.length,
        };
    } catch (err) {
        return { sizeKB: 0, fileCount: 0, error: err.message };
    }
}

// ── Helper: real disk space stats for the drive the uploads folder
// lives on (Node's fs.statfsSync works on Windows/Mac/Linux since
// Node 18.15+) ────────────────────────────────────────────────────
function getDiskStats(folderPath = __dirname) {
    try {
        const target = fs.existsSync(folderPath) ? folderPath : __dirname;
        const stats = fs.statfsSync(target);

        const totalBytes = stats.blocks * stats.bsize;
        const freeBytes = stats.bfree * stats.bsize;
        const usedBytes = totalBytes - freeBytes;

        return {
            totalGB: +(totalBytes / (1024 ** 3)).toFixed(1),
            usedGB: +(usedBytes / (1024 ** 3)).toFixed(1),
            freeGB: +(freeBytes / (1024 ** 3)).toFixed(1),
            usedPercent: Math.round((usedBytes / totalBytes) * 100),
        };
    } catch (err) {
        return { error: err.message };
    }
}

// ── Helper: how many chunks are indexed in MongoDB Atlas Vector
// Search, and how are they broken down per source document? ────────
async function getVectorStats() {
    try {
        const collection = getVectorCollection();

        const totalChunks = await collection.countDocuments();

        // Group by source document so "Vector DB Management" can show
        // e.g. "Library.pdf — 4 chunks", "time table.pdf — 2 chunks".
        const bySource = await collection.aggregate([
            { $group: { _id: "$source", chunkCount: { $sum: 1 } } },
            { $sort: { chunkCount: -1 } },
        ]).toArray();

        return {
            connected: true,
            totalChunks,
            documents: bySource.map(d => ({
                source: d._id || "(unknown)",
                chunkCount: d.chunkCount,
            })),
        };

    } catch (err) {
        return { connected: false, totalChunks: 0, documents: [], error: err.message };
    }
}


// =====================================================================
// GET /api/dev/system
// =====================================================================
router.get("/system", adminProtect, requireSuperAdmin, async (req, res) => {

    try {

        const vectorStats = await getVectorStats();

        res.json({
            success: true,

            node: process.version,
            platform: `${os.type()} ${os.release()}`,
            uptimeMinutes: Math.round(process.uptime() / 60),
            memoryUsedMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),

            server: {
                hostname: os.hostname(),
                pid: process.pid,
                port: process.env.PORT || 5000,
                cpuCores: os.cpus().length,
                totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
                freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
                startedAt: SERVER_STARTED_AT,
            },

            // We only ever report WHETHER a secret is set (true/false)
            // — never the actual value.
            env: {
                NODE_ENV: process.env.NODE_ENV || "development",
                MONGO_URI: !!process.env.MONGO_URI,
                GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
                GROQ_API_KEY: !!process.env.GROQ_API_KEY,
            },

            mongo: {
                connected: mongoose.connection.readyState === 1,
                dbName: mongoose.connection.name || null,
            },

            // "vectorDb" replaces the old ChromaDB status — embeddings
            // now live inside this same MongoDB database (collection:
            // rag_chunks), so there's no separate service to check.
            vectorDb: {
                connected: vectorStats.connected,
                totalChunks: vectorStats.totalChunks,
            },
        });

    } catch (err) {

        res.status(500).json({ success: false, error: err.message });

    }

});


// =====================================================================
// GET /api/dev/storage
// =====================================================================
router.get("/storage", adminProtect, requireSuperAdmin, async (req, res) => {

    try {

        const uploads = await getUploadsStats();
        const vectorStats = await getVectorStats();
        const disk = getDiskStats();

        const FAQ = require("../models/FAQ");
        const Log = require("../models/Log");
        const Feedback = require("../models/Feedback");
        const User = require("../models/User");
        const Admin = require("../models/Admin");

        const [faqCount, logCount, feedbackCount, userCount, adminCount] =
            await Promise.all([
                FAQ.countDocuments(),
                Log.countDocuments(),
                Feedback.countDocuments(),
                User.countDocuments(),
                Admin.countDocuments(),
            ]);

        let mongoStats = null;
        try {
            const stats = await mongoose.connection.db.stats();
            mongoStats = {
                dataSizeMB: +(stats.dataSize / (1024 ** 2)).toFixed(2),
                storageSizeMB: +(stats.storageSize / (1024 ** 2)).toFixed(2),
                indexSizeMB: +(stats.indexSize / (1024 ** 2)).toFixed(2),
            };
        } catch (err) {
            mongoStats = { error: err.message };
        }

        res.json({
            success: true,
            disk,
            uploads,
            vectorDb: vectorStats,
            mongoStats,
            mongoCollections: {
                faqs: faqCount,
                chatLogs: logCount,
                feedback: feedbackCount,
                users: userCount,
                admins: adminCount,
            },
        });

    } catch (err) {

        res.status(500).json({ success: false, error: err.message });

    }

});


// =====================================================================
// DELETE /api/dev/storage/all
// DANGER ZONE: full reset — clears uploaded PDFs, the vector store,
// chat logs, feedback, and the FAQ cache all in one action. Does NOT
// touch FAQs, Users, or Admins (those are configuration, not "data").
// =====================================================================
router.delete("/storage/all", adminProtect, requireSuperAdmin, async (req, res) => {

    const results = {};

    try {
        const bucket = getBucket();
        const files = await bucket.find({}).toArray();
        await Promise.all(files.map(f => bucket.delete(f._id)));
        results.uploads = "cleared";
    } catch (err) {
        results.uploads = `failed: ${err.message}`;
    }

    try {
        const collection = getVectorCollection();
        await collection.deleteMany({});
        results.vectorDb = "cleared";
    } catch (err) {
        results.vectorDb = `failed: ${err.message}`;
    }

    try {
        const Log = require("../models/Log");
        await Log.deleteMany({});
        results.chatLogs = "cleared";
    } catch (err) {
        results.chatLogs = `failed: ${err.message}`;
    }

    try {
        const Feedback = require("../models/Feedback");
        await Feedback.deleteMany({});
        results.feedback = "cleared";
    } catch (err) {
        results.feedback = `failed: ${err.message}`;
    }

    faqCache.clearFaqCache();
    results.faqCache = "cleared";

    logger.info(`Full storage reset performed: ${JSON.stringify(results)}`);

    res.json({
        success: true,
        message: "Storage reset complete.",
        details: results,
    });

});


// =====================================================================
// DELETE /api/dev/storage/uploads
// Wipes every uploaded PDF from disk AND every chunk in the vector
// store. Used to fully reset the RAG knowledge base.
// =====================================================================
router.delete("/storage/uploads", adminProtect, requireSuperAdmin, async (req, res) => {

    try {

        const bucket = getBucket();
        const files = await bucket.find({}).toArray();
        await Promise.all(files.map(f => bucket.delete(f._id)));

        try {
            const collection = getVectorCollection();
            await collection.deleteMany({});
        } catch (err) {
            console.log("Vector store clear skipped:", err.message);
        }

        res.json({
            success: true,
            message: "All uploaded documents and their indexed data were cleared.",
        });

    } catch (err) {

        res.status(500).json({ success: false, error: err.message });

    }

});


// =====================================================================
// DELETE /api/dev/storage/logs
// =====================================================================
router.delete("/storage/logs", adminProtect, requireSuperAdmin, async (req, res) => {

    try {

        const Log = require("../models/Log");
        await Log.deleteMany({});

        res.json({ success: true, message: "Chat logs cleared." });

    } catch (err) {

        res.status(500).json({ success: false, error: err.message });

    }

});


// =====================================================================
// VECTOR DB MANAGEMENT
// ---------------------------------------------------------------------
// With MongoDB Atlas Vector Search, there's just one collection
// (rag_chunks) instead of separate ChromaDB "collections" — so this
// shows a breakdown per SOURCE DOCUMENT instead, with the ability to
// delete all chunks belonging to one document.
// =====================================================================

// GET /api/dev/vectordb
router.get("/vectordb", adminProtect, requireSuperAdmin, async (req, res) => {

    const stats = await getVectorStats();
    res.json({ success: true, ...stats, collectionName: COLLECTION_NAME });

});

// DELETE /api/dev/vectordb/:source — delete all chunks for one
// source document (identified by its original filename).
router.delete("/vectordb/:source", adminProtect, requireSuperAdmin, async (req, res) => {

    try {

        const vectorStore = getVectorStore();
        await vectorStore.delete({ filter: { source: req.params.source } });

        logger.info(`Vector chunks deleted for source: ${req.params.source}`);

        res.json({ success: true, message: `Chunks for "${req.params.source}" deleted.` });

    } catch (err) {

        res.status(500).json({ success: false, error: err.message });

    }

});


// =====================================================================
// AI PROVIDER STATUS
// ---------------------------------------------------------------------
// Shows BOTH configured providers — Groq (primary) and Gemini
// (fallback) — since the chatbot tries Groq first and only falls back
// to Gemini if that fails.
// =====================================================================

router.get("/ai-status", adminProtect, requireSuperAdmin, async (req, res) => {

    res.json({
        success: true,
        providers: [
            {
                name: "Groq (primary)",
                apiKeyConfigured: !!process.env.GROQ_API_KEY,
            },
            {
                name: "Google Gemini (fallback)",
                apiKeyConfigured: !!process.env.GEMINI_API_KEY,
            },
        ],
    });

});

// POST /api/dev/ai-status/test — makes ONE real, tiny API call to
// Gemini to confirm the key actually works, and measures latency.
// (Groq test can be added the same way once its service module path
// is wired in — see note in the frontend.)
router.post("/ai-status/test", adminProtect, requireSuperAdmin, async (req, res) => {

    const startedAt = Date.now();

    try {

        const result = await geminiModel.generateContent("Reply with only the word OK.");
        const text = result.response.text();
        const latencyMs = Date.now() - startedAt;

        res.json({
            success: true,
            working: true,
            latencyMs,
            sampleReply: text.trim().slice(0, 50),
        });

    } catch (err) {

        logger.error(`AI provider test call failed: ${err.message}`);

        res.json({
            success: true,
            working: false,
            error: err.message,
        });

    }

});


// =====================================================================
// DEVELOPER LOGS / ERROR MONITOR
// =====================================================================

router.get("/logs", adminProtect, requireSuperAdmin, async (req, res) => {

    const { level, limit } = req.query;

    const logs = logger.getLogs({
        level: level || null,
        limit: limit ? parseInt(limit, 10) : 200,
    });

    res.json({ success: true, logs });

});

router.delete("/logs", adminProtect, requireSuperAdmin, async (req, res) => {

    logger.clearLogs();
    res.json({ success: true, message: "Logs cleared." });

});


// =====================================================================
// CACHE MANAGEMENT
// =====================================================================

router.get("/cache", adminProtect, requireSuperAdmin, async (req, res) => {

    res.json({
        success: true,
        faqCache: faqCache.getCacheStatus(),
    });

});

router.delete("/cache", adminProtect, requireSuperAdmin, async (req, res) => {

    faqCache.clearFaqCache();
    logger.info("FAQ cache cleared manually via Developer Panel.");

    res.json({ success: true, message: "FAQ cache cleared." });

});


module.exports = router;