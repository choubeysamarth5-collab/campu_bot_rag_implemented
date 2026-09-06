// =============================================
// routes/studyChat.js – Study Section Chat API
// =============================================
// Mirrors routes/chat.js's structure (same response shape: reply,
// timestamp) but talks ONLY to askStudyRAG — no FAQ fallback, no
// intent matching, because this bot's whole job is "answer strictly
// from teacher-uploaded notes."

const express = require("express");
const router = express.Router();
const { askStudyRAG } = require("../rag/services/studyRagService");

// ── POST /api/study/chat ──
router.post("/chat", async (req, res) => {
    try {
        const { message, subject, history } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        console.log("========== STUDY RAG ==========");
        console.log("Question:", message, "| Subject filter:", subject || "(none)");

        const { reply, matched, sources } = await askStudyRAG(message, subject, history);

        res.json({
            reply,
            matched,
            sources,
            subject: subject || null,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Study chat error:", error);
        res.status(500).json({
            reply: "Something went wrong. Please try again.",
            error: "Server error",
        });
    }
});

// ── GET /api/study/subjects ──
// Distinct subjects for the subject-tabs UI in study.html
router.get("/subjects", async (req, res) => {
    try {
        const StudyNote = require("../models/StudyNote");
        const subjects = await StudyNote.distinct("subject");
        res.json({ subjects });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch subjects" });
    }
});

module.exports = router;