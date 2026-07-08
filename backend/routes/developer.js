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
const { ChromaClient } = require("chromadb");
const logger = require("../utils/logger");
const faqCache = require("../utils/faqCache");
const geminiModel = require("../rag/config/gemini");

const UPLOADS_PATH = path.join(__dirname, "../uploads");
const CHROMA_URL = "http://localhost:8000";
const CHROMA_COLLECTION = "campusbot-rag";

// Recorded once when this module first loads (i.e. when the server
// starts), used to show "server started at" in Server Information.
const SERVER_STARTED_AT = new Date().toISOString();


// ── Helper: total size + file count of a folder ─────────────────────
function getFolderStats(folderPath) {
    if (!fs.existsSync(folderPath)) return { sizeKB: 0, fileCount: 0 };

    const files = fs.readdirSync(folderPath);
    let totalBytes = 0;

    files.forEach(name => {
        const stat = fs.statSync(path.join(folderPath, name));
        if (stat.isFile()) totalBytes += stat.size;
    });

    return {
        sizeKB: Math.round(totalBytes / 1024),
        fileCount: files.length,
    };
}

// ── Helper: real disk space stats for the drive the uploads folder
// lives on (Node's fs.statfsSync works on Windows/Mac/Linux since
// Node 18.15+) ────────────────────────────────────────────────────
function getDiskStats(folderPath) {
    try {
        // statfsSync needs a path that exists — fall back to the
        // backend root if the uploads folder hasn't been created yet.
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

// ── Helper: is ChromaDB reachable, and how many chunks are indexed? ─
async function getChromaStats() {
    try {
        const client = new ChromaClient({ path: CHROMA_URL });
        const collection = await client.getCollection({ name: CHROMA_COLLECTION });
        const chunkCount = await collection.count();

        return { connected: true, chunkCount };

    } catch (err) {
        return { connected: false, chunkCount: 0, error: err.message };
    }
}


// =====================================================================
// GET /api/dev/system
// Node/server environment info + connection health — useful for a
// developer debugging "why isn't X working" without SSH-ing in.
// =====================================================================
router.get("/system", adminProtect, requireSuperAdmin, async (req, res) => {

    try {

        const chroma = await getChromaStats();

        res.json({
            success: true,

            node: process.version,
            platform: `${os.type()} ${os.release()}`,
            uptimeMinutes: Math.round(process.uptime() / 60),
            memoryUsedMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),

            // ── Server Information (extra detail beyond the basics
            // above) ──
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
            // — never the actual value. Never expose real secrets over
            // an API, even an internal one.
            env: {
                NODE_ENV: process.env.NODE_ENV || "development",
                MONGO_URI: !!process.env.MONGO_URI,
                GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
            },

            mongo: {
                connected: mongoose.connection.readyState === 1,
                dbName: mongoose.connection.name || null,
            },

            chroma,
        });

    } catch (err) {

        res.status(500).json({ success: false, error: err.message });

    }

});


// =====================================================================
// GET /api/dev/storage
// Storage Management data: how much disk space uploaded PDFs are
// using, how many chunks are indexed in ChromaDB, and counts of every
// MongoDB collection.
// =====================================================================
router.get("/storage", adminProtect, requireSuperAdmin, async (req, res) => {

    try {

        const uploads = getFolderStats(UPLOADS_PATH);
        const chroma = await getChromaStats();
        const disk = getDiskStats(UPLOADS_PATH);

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

        // MongoDB's own reported storage usage (bytes) for the whole
        // database — separate from disk space, this is "how big is
        // our actual data", not "how full is the hard drive".
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
            chroma,
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
// DANGER ZONE: full reset — clears uploaded PDFs, ChromaDB, chat logs,
// feedback, and the FAQ cache all in one action. Does NOT touch FAQs,
// Users, or Admins (those are considered configuration, not
// "storage"/data you'd casually want to wipe).
// =====================================================================
router.delete("/storage/all", adminProtect, requireSuperAdmin, async (req, res) => {

    const results = {};

    // Uploaded files
    try {
        if (fs.existsSync(UPLOADS_PATH)) {
            const files = fs.readdirSync(UPLOADS_PATH);
            files.forEach(name => fs.unlinkSync(path.join(UPLOADS_PATH, name)));
        }
        results.uploads = "cleared";
    } catch (err) {
        results.uploads = `failed: ${err.message}`;
    }

    // ChromaDB
    try {
        const client = new ChromaClient({ path: CHROMA_URL });
        await client.deleteCollection({ name: CHROMA_COLLECTION });
        results.chroma = "cleared";
    } catch (err) {
        results.chroma = `skipped: ${err.message}`;
    }

    // Chat logs
    try {
        const Log = require("../models/Log");
        await Log.deleteMany({});
        results.chatLogs = "cleared";
    } catch (err) {
        results.chatLogs = `failed: ${err.message}`;
    }

    // Feedback
    try {
        const Feedback = require("../models/Feedback");
        await Feedback.deleteMany({});
        results.feedback = "cleared";
    } catch (err) {
        results.feedback = `failed: ${err.message}`;
    }

    // FAQ cache
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
// DANGER ZONE: wipes every uploaded PDF from disk AND drops the whole
// ChromaDB collection (all indexed chunks). Used to fully reset the
// RAG knowledge base, e.g. after a lot of messy test uploads.
// =====================================================================
router.delete("/storage/uploads", adminProtect, requireSuperAdmin, async (req, res) => {

    try {

        if (fs.existsSync(UPLOADS_PATH)) {
            const files = fs.readdirSync(UPLOADS_PATH);
            files.forEach(name => fs.unlinkSync(path.join(UPLOADS_PATH, name)));
        }

        try {
            const client = new ChromaClient({ path: CHROMA_URL });
            await client.deleteCollection({ name: CHROMA_COLLECTION });
        } catch (err) {
            // Collection may not exist yet — that's fine, nothing to
            // delete in that case.
            console.log("Chroma collection delete skipped:", err.message);
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
// Clears the chat logs collection (conversation history used for the
// Dashboard/Chat Logs admin views).
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
// =====================================================================

// GET /api/dev/vectordb — list every ChromaDB collection with its
// chunk count (there's usually just "campusbot-rag", but this
// supports however many collections end up existing).
router.get("/vectordb", adminProtect, requireSuperAdmin, async (req, res) => {

    try {

        const client = new ChromaClient({ path: CHROMA_URL });
        const rawCollections = await client.listCollections();

        const collections = await Promise.all(
            rawCollections.map(async (c) => {
                // Different chromadb client versions return either
                // plain strings or {name} objects here — handle both.
                const name = typeof c === "string" ? c : c.name;

                try {
                    const collection = await client.getCollection({ name });
                    const count = await collection.count();
                    return { name, chunkCount: count };
                } catch (err) {
                    return { name, chunkCount: null, error: err.message };
                }
            })
        );

        res.json({ success: true, connected: true, collections });

    } catch (err) {

        res.json({ success: true, connected: false, collections: [], error: err.message });

    }

});

// DELETE /api/dev/vectordb/:name — drop a specific collection entirely.
router.delete("/vectordb/:name", adminProtect, requireSuperAdmin, async (req, res) => {

    try {

        const client = new ChromaClient({ path: CHROMA_URL });
        await client.deleteCollection({ name: req.params.name });

        logger.info(`Vector DB collection deleted: ${req.params.name}`);

        res.json({ success: true, message: `Collection "${req.params.name}" deleted.` });

    } catch (err) {

        res.status(500).json({ success: false, error: err.message });

    }

});


// =====================================================================
// AI PROVIDER STATUS
// =====================================================================

// GET /api/dev/ai-status — passive check only (no live API call, so
// loading this panel doesn't burn API quota every time). Shows
// whether a key is configured and which model file is wired up.
router.get("/ai-status", adminProtect, requireSuperAdmin, async (req, res) => {

    res.json({
        success: true,
        provider: "Google Gemini",
        apiKeyConfigured: !!process.env.GEMINI_API_KEY,
    });

});

// POST /api/dev/ai-status/test — makes ONE real, tiny API call to
// confirm the key actually works (not just that it's set), and
// measures latency. This is a deliberate action (button press), not
// something that runs automatically, since it does cost a real API
// call.
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
// ---------------------------------------------------------------------
// Both screens read from the same in-memory logger (utils/logger.js).
// Error Monitor is just Developer Logs filtered to level=error.
// =====================================================================

// GET /api/dev/logs?level=error&limit=100
router.get("/logs", adminProtect, requireSuperAdmin, async (req, res) => {

    const { level, limit } = req.query;

    const logs = logger.getLogs({
        level: level || null,
        limit: limit ? parseInt(limit, 10) : 200,
    });

    res.json({ success: true, logs });

});

// DELETE /api/dev/logs — clears the in-memory log buffer.
router.delete("/logs", adminProtect, requireSuperAdmin, async (req, res) => {

    logger.clearLogs();
    res.json({ success: true, message: "Logs cleared." });

});


// =====================================================================
// CACHE MANAGEMENT
// =====================================================================

// GET /api/dev/cache — current FAQ cache status.
router.get("/cache", adminProtect, requireSuperAdmin, async (req, res) => {

    res.json({
        success: true,
        faqCache: faqCache.getCacheStatus(),
    });

});

// DELETE /api/dev/cache — force the FAQ cache to refresh on the next
// chat message (useful right after editing FAQs in the admin panel).
router.delete("/cache", adminProtect, requireSuperAdmin, async (req, res) => {

    faqCache.clearFaqCache();
    logger.info("FAQ cache cleared manually via Developer Panel.");

    res.json({ success: true, message: "FAQ cache cleared." });

});


module.exports = router;