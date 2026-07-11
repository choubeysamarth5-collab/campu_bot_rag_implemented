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
const { getProviderMode, setProviderMode, VALID_MODES } = require("../utils/aiProviderConfig");
const { getGroqUsage, getGeminiUsage } = require("../utils/apiUsageTracker");
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

// (Disk-space tracking removed — with GridFS + MongoDB Atlas for
// everything, local disk usage isn't meaningful data anymore. See
// getCollectionBreakdown() below for the real storage picture.)

// ── Helper: per-collection size breakdown across the whole database
// — gives a genuinely complete "what is stored, and how big is it"
// view, instead of just document counts. ───────────────────────────
async function getCollectionBreakdown() {
    try {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        const breakdown = await Promise.all(
            collections.map(async (col) => {
                try {
                    const stats = await db.command({ collStats: col.name });
                    return {
                        name: col.name,
                        documentCount: stats.count || 0,
                        sizeKB: Math.round((stats.size || 0) / 1024),
                        storageSizeKB: Math.round((stats.storageSize || 0) / 1024),
                    };
                } catch (err) {
                    return { name: col.name, documentCount: 0, sizeKB: 0, storageSizeKB: 0 };
                }
            })
        );

        // Largest first — the admin usually cares most about what's
        // taking the most space.
        breakdown.sort((a, b) => b.storageSizeKB - a.storageSizeKB);

        return breakdown;
    } catch (err) {
        return [];
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
        const collectionBreakdown = await getCollectionBreakdown();

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

        // MongoDB Atlas's free tier (M0) caps total storage at 512MB
        // — this covers EVERYTHING in the database: FAQs, users, chat
        // logs, vector chunks, AND uploaded PDFs (via GridFS). We
        // calculate usage against that limit so the admin can see
        // how close they are to needing a paid tier.
        const ATLAS_FREE_TIER_MB = 512;

        let mongoStats = null;
        try {
            const stats = await mongoose.connection.db.stats();
            const storageSizeMB = +(stats.storageSize / (1024 ** 2)).toFixed(2);

            mongoStats = {
                dataSizeMB: +(stats.dataSize / (1024 ** 2)).toFixed(2),
                storageSizeMB,
                indexSizeMB: +(stats.indexSize / (1024 ** 2)).toFixed(2),
                freeTierLimitMB: ATLAS_FREE_TIER_MB,
                usedPercent: Math.min(100, Math.round((storageSizeMB / ATLAS_FREE_TIER_MB) * 100)),
            };
        } catch (err) {
            mongoStats = { error: err.message };
        }

        res.json({
            success: true,
            uploads,
            vectorDb: vectorStats,
            mongoStats,
            collectionBreakdown,
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

        const originalName = req.params.source;

        // 1. Delete the vector chunks (as before).
        //
        // NOTE: @langchain/mongodb's vectorStore.delete({filter}) is
        // documented as "delete by ids" and internally expects an
        // `ids` array — passing only a filter crashes with "Cannot
        // read properties of undefined (reading 'reduce')". We
        // bypass that buggy wrapper and delete directly on the
        // underlying MongoDB collection instead, which works
        // reliably.
        const collection = getVectorCollection();
        const chunkResult = await collection.deleteMany({ source: originalName });

        // 2. ALSO delete the matching GridFS file(s) — otherwise the
        // physical PDF stays in storage and keeps showing up in the
        // Admin Panel's Document Manager even though its chunks (and
        // therefore its chat answers) are gone. This keeps both
        // panels in sync no matter which one you delete from.
        const bucket = getBucket();
        const files = await bucket.find({ "metadata.originalName": originalName }).toArray();

        // Fallback: older uploads may not have metadata.originalName
        // set, so also match by stripping the timestamp prefix off
        // the stored filename.
        const allFiles = await bucket.find({}).toArray();
        const matchingByName = allFiles.filter(
            f => f.filename.replace(/^\d+-/, "") === originalName
        );

        const filesToDelete = [
            ...files,
            ...matchingByName.filter(f => !files.some(existing => existing._id.equals(f._id))),
        ];

        await Promise.all(filesToDelete.map(f => bucket.delete(f._id)));

        logger.info(
            `Deleted "${originalName}": ${chunkResult.deletedCount} chunk(s), ${filesToDelete.length} GridFS file(s)`
        );

        res.json({
            success: true,
            message: `Deleted ${chunkResult.deletedCount} chunk(s) and ${filesToDelete.length} file(s) for "${originalName}".`,
        });

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
        mode: getProviderMode(),
        providers: [
            {
                name: "Google Gemini (primary)",
                apiKeyConfigured: !!process.env.GEMINI_API_KEY,
            },
            {
                name: "Groq (fallback)",
                apiKeyConfigured: !!process.env.GROQ_API_KEY,
            },
        ],
    });

});

// GET /api/dev/ai-status/usage — live rate-limit / usage numbers for
// both providers. Groq's numbers come straight from its response
// headers (real, accurate, updated on every chat request). Gemini
// has no such headers, so its numbers are just a running count of
// calls WE'VE made — an approximation, not an official reading.
router.get("/ai-status/usage", adminProtect, requireSuperAdmin, async (req, res) => {

    res.json({
        success: true,
        groq: getGroqUsage(),
        gemini: getGeminiUsage(),
    });

});

// POST /api/dev/ai-status/mode — manually force a provider, or set
// back to "auto" (Groq first, falls back to Gemini automatically).
router.post("/ai-status/mode", adminProtect, requireSuperAdmin, async (req, res) => {

    try {
        const { mode } = req.body;
        const updated = setProviderMode(mode);

        logger.info(`AI provider mode manually changed to: ${updated}`);

        res.json({ success: true, mode: updated });

    } catch (err) {

        res.status(400).json({ success: false, error: err.message });

    }

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