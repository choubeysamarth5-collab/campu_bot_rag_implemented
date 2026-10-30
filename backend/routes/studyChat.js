// =============================================
// routes/studyChat.js – Study Section Chat API
// =============================================
// Mirrors routes/chat.js's structure (same response shape: reply,
// timestamp) but talks ONLY to askStudyRAG — no FAQ fallback, no
// intent matching, because this bot's whole job is "answer strictly
// from teacher-uploaded notes."

const express = require("express");
const router = express.Router();
const Log = require('../models/Log');
const { askStudyRAG } = require("../rag/services/studyRagService");
const { askGemini } = require("../rag/services/geminiService");
const { askGroq } = require("../rag/services/groqService");
const { generateStudyVisualizations } =
    require("../rag/services/studyVisualizationService");
const { generateStudyQuiz } =
    require("../rag/services/studyQuizService");

router.post('/history/message', async (req, res) => {
    try {
        const { conversationId, conversationTitle, subject, userMessage, botReply, timestamp } = req.body;
        if (!conversationId || !String(userMessage || '').trim() || typeof botReply !== 'string' || !botReply.trim()) {
            return res.status(400).json({ success: false, message: 'Conversation, question, and answer are required.' });
        }
        const log = await Log.create({
            userId: req.user._id,
            conversationId: String(conversationId).slice(0, 100),
            conversationTitle: String(conversationTitle || 'Study Chat').trim().slice(0, 80),
            chatType: 'study',
            studySubject: String(subject || '').trim().slice(0, 100),
            userMessage: String(userMessage).trim().slice(0, 5000),
            botReply: String(botReply).slice(0, 30000),
            lang: 'en',
            timestamp: timestamp ? new Date(timestamp) : new Date(),
        });
        res.status(201).json({ success: true, id: log._id });
    } catch (error) {
        console.error('Study history save error:', error.message);
        res.status(500).json({ success: false, message: 'Could not save Study chat history.' });
    }
});

router.get('/history', async (req, res) => {
    try {
        const since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
        const logs = await Log.find({ userId: req.user._id, chatType: 'study', timestamp: { $gte: since } })
            .sort({ timestamp: 1 }).lean();
        const conversations = new Map();
        for (const log of logs) {
            if (!log.conversationId) continue;
            if (!conversations.has(log.conversationId)) {
                conversations.set(log.conversationId, {
                    id: log.conversationId,
                    title: log.conversationTitle || log.userMessage.slice(0, 40) || 'Study Chat',
                    subject: log.studySubject || '',
                    messages: [],
                    updatedAt: log.timestamp,
                });
            }
            const chat = conversations.get(log.conversationId);
            if (log.conversationTitle) chat.title = log.conversationTitle;
            if (log.studySubject) chat.subject = log.studySubject;
            chat.messages.push({ role: 'user', text: log.userMessage, id: `u-${log._id}`, time: log.timestamp.getTime() });
            chat.messages.push({ role: 'bot', text: log.botReply, id: `b-${log._id}`, time: log.timestamp.getTime() });
            chat.updatedAt = log.timestamp;
        }
        res.json({ conversations: [...conversations.values()].sort((a, b) => b.updatedAt - a.updatedAt) });
    } catch (error) {
        console.error('Study history fetch error:', error.message);
        res.status(500).json({ error: 'Could not load Study chat history.' });
    }
});

router.put('/history/:conversationId', async (req, res) => {
    try {
        const title = String(req.body?.title || '').trim().slice(0, 80);
        if (!title) return res.status(400).json({ error: 'Conversation name cannot be empty.' });
        const result = await Log.updateMany(
            { userId: req.user._id, conversationId: req.params.conversationId, chatType: 'study' },
            { $set: { conversationTitle: title } }
        );
        if (!result.matchedCount) return res.status(404).json({ error: 'Study conversation not found.' });
        res.json({ success: true, title });
    } catch (error) {
        res.status(500).json({ error: 'Could not rename Study conversation.' });
    }
});

router.delete('/history/:conversationId', async (req, res) => {
    try {
        await Log.deleteMany({ userId: req.user._id, conversationId: req.params.conversationId, chatType: 'study' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Could not delete Study conversation.' });
    }
});

router.delete('/history', async (req, res) => {
    try {
        await Log.deleteMany({ userId: req.user._id, chatType: 'study' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Could not clear Study chat history.' });
    }
});

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
router.post("/summary", async (req, res) => {
    try {

        const { subject, history } = req.body;

        if (
            !history ||
            !Array.isArray(history) ||
            history.length === 0
        ) {
            return res.status(400).json({
                error: "Chat history is required"
            });
        }


        const conversationText =
            history
                .map(item => {
                    const role =
                        item.role === "user"
                            ? "Student"
                            : "Study Assistant";

                    return `${role}: ${item.text || ""}`;
                })
                .join("\n\n");


        const prompt = `
You are creating a Quick Revision Summary for a student's current study conversation.

Subject:
${subject || "All Subjects"}

Conversation:
${conversationText}

Create a concise revision summary based ONLY on the information present in this conversation.

Use exactly these sections:

📌 Key Concepts
⭐ Important Points
🧠 Terms to Remember
📝 Questions to Revise
🎯 Quick Takeaway

Rules:
- Do not add information that is not present in the conversation.
- Keep it concise and exam-oriented.
- Use clear bullet points.
- Do not mention that you are an AI.
- Do not include sources/citations unless they already appear as part of the conversation.
`;


        let summary = null;


        /* -------------------------------------------------
           GEMINI FIRST
        ------------------------------------------------- */

        try {

            console.log(
                "🤖 Study Summary: Using Gemini..."
            );

            summary =
                await askGemini(prompt);

            console.log(
                "✅ Study Summary: Gemini Success"
            );

        } catch (geminiErr) {

            console.log(
                "❌ Study Summary: Gemini Failed —",
                geminiErr.message
            );


            /* ---------------------------------------------
               GROQ FALLBACK
            --------------------------------------------- */

            try {

                console.log(
                    "🚀 Study Summary: Switching to Groq..."
                );

                summary =
                    await askGroq(prompt);

                console.log(
                    "✅ Study Summary: Groq Success"
                );

            } catch (groqErr) {

                console.log(
                    "❌ Study Summary: Groq Failed —",
                    groqErr.message
                );

                summary = null;
            }
        }


        /*
           PDF should still generate even if
           both AI providers fail.
        */

        return res.json({
            summary: summary || null
        });


    } catch (error) {

        console.error(
            "Study summary error:",
            error
        );

        return res.json({
            summary: null
        });
    }
});

// ── POST /api/study/visualize ──
router.post("/visualize", async (req, res) => {
    try {
        const { subject, history } = req.body;

        if (
            !history ||
            !Array.isArray(history) ||
            history.length === 0
        ) {
            return res.status(400).json({
                visualizations: [],
                error: "Chat history is required"
            });
        }

        const result = await generateStudyVisualizations(
            subject,
            history
        );

        return res.json(result);

    } catch (error) {
        console.error(
            "Study visualize route error:",
            error.message
        );

        // Visualization is optional.
        // PDF generation should continue even if AI fails.
        return res.status(500).json({
            visualizations: []
        });
    }
});

router.post("/quiz", async (req, res) => {
    try {
        const {
            subject,
            history
        } = req.body;

        if (
            !Array.isArray(history) ||
            history.length === 0
        ) {
            return res.status(400).json({
                questions: [],
                error: "Chat history is required"
            });
        }

        const result =
            await generateStudyQuiz(
                subject,
                history
            );

        return res.json(result);

    } catch (error) {

        console.error(
            "Study quiz route error:",
            error
        );

        return res.status(500).json({
            questions: [],
            error:
                "Failed to generate quiz"
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
