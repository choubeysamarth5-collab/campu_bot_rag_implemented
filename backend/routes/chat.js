const { protect } = require("../middleware/auth");
const { askRAG } = require("../rag/services/ragService");
const { getFAQsCached } = require("../utils/faqCache");
// =============================================
// routes/chat.js – Chat & Log API Routes
// =============================================

const express = require('express');
const router = express.Router();

// Import models
let FAQ, Log;
try {
  FAQ = require('../models/FAQ');
  Log = require('../models/Log');
} catch (e) { }

// ── MULTILINGUAL FALLBACK MESSAGES ──
const FALLBACKS = {
  en: "I'm sorry, I don't have information on that. Please contact helpdesk@college.edu or call +91 12345 67890.",
  hi: "मुझे खेद है, मेरे पास इस विषय पर जानकारी नहीं है। helpdesk@college.edu से संपर्क करें।",
  mr: "मला माफ करा, या विषयावर माहिती नाही. helpdesk@college.edu शी संपर्क करा.",
  ta: "மன்னிக்கவும், இதற்கான தகவல் என்னிடம் இல்லை. helpdesk@college.edu-ல் தொடர்பு கொள்ளுங்கள்.",
  te: "క్షమించండి, దాని గురించి నాకు సమాచారం లేదు. helpdesk@college.edu ని సంప్రదించండి.",
};

// ── INTENT MATCHING FUNCTION ──
// This is our "NLP engine" – simple keyword matching
function matchFAQ(text, faqs) {
  const lowerText = text.toLowerCase();
  let bestFaq = null;
  let bestScore = 0;

  faqs.forEach(faq => {
    let score = 0;
    (faq.keywords || []).forEach(kw => {
      if (lowerText.includes(kw.toLowerCase())) {
        score++;
        // Bonus score for exact intent phrase match
        if (lowerText === kw.toLowerCase()) score += 2;
      }
    });
    if (score > bestScore) {
      bestScore = score;
      bestFaq = faq;
    }
  });

  return bestScore > 0 ? bestFaq : null;
}

// =============================================
// ML INTENT PREDICTION
// =============================================
async function predictIntent(text) {

  try {

    const response =
      await fetch(
        `${process.env.ML_SERVICE_URL}/predict`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            text
          })
        }
      );

    const data =
      await response.json();

    return data.intent;

  } catch (err) {

    console.log(
      'ML server offline'
    );

    return null;
  }
}
// ── POST /api/chat ──
// Main chat endpoint – receives user message, returns bot reply
router.post('/chat', async (req, res) => {
  try {
    const { message, lang = 'en', history = [] } = req.body;


    // Validate input
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    // =======================
    // Try RAG First
    // =======================

    try {

      console.log("========== RAG ==========");
      console.log("Question:", message);

      const ragReply = await askRAG(message, lang);

      console.log("RAG Reply:");
      console.log(ragReply);

      if (
        ragReply &&
        !ragReply.includes("I couldn't find this information")
      ) {

        console.log("Returning RAG answer");

        return res.json({
          reply: ragReply,
          intent: "rag",
          lang,
          timestamp: new Date().toISOString(),
        });

      }

      console.log("Falling back to FAQ");

    } catch (err) {

      console.error("RAG Error:");
      console.error(err);

    }

    let reply = null;
    let intent = 'unknown';

    // Try to find answer in MongoDB
    if (FAQ) {
      const faqs = await getFAQsCached(FAQ);
      let match = null;

      // Try ML prediction first
      const predictedIntent =
        await predictIntent(message);

      if (predictedIntent) {

        console.log(
          'Predicted Intent:',
          predictedIntent
        );

        match = faqs.find(faq =>

          (faq.keywords || [])
            .some(keyword =>

              keyword
                .toLowerCase()
                .includes(
                  predictedIntent
                    ?.toLowerCase()
                )
            )
        );
        console.log(
          'Predicted Intent:',
          predictedIntent
        );
      }

      // Fallback to keyword matching
      if (!match) {

        match =
          matchFAQ(message, faqs);
      }

      if (match) {
        intent = match.category;
        // Get answer in requested language, fallback to English
        reply = match.answers[lang] || match.answers.en;
      }
    }

    // If no match found, use fallback
    if (!reply) {
      reply = FALLBACKS[lang] || FALLBACKS.en;
    }

    // Respond to the frontend
    res.json({
      reply,
      intent,
      lang,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      reply: FALLBACKS[req.body?.lang || 'en'],
      error: 'Server error'
    });
  }
});

// ── POST /api/log ──
// Save a conversation to the database
router.post(
  '/log',

  protect,

  async (req, res) => {
    try {
      // Get data from frontend

      const {

        // NEW
        conversationId,

        conversationTitle,

        userMessage,

        botReply,

        lang = 'en',

        timestamp

      } = req.body;

      if (!userMessage || !botReply) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      if (Log) {
        // Create MongoDB log document

        const log = new Log({

          userId: req.user._id,

          // NEW
          conversationId,

          conversationTitle,

          chatType: 'faq',

          userMessage:
            userMessage.trim(),

          botReply,

          lang,

          timestamp:
            timestamp
              ? new Date(timestamp)
              : new Date(),
        });
        await log.save();
      }

      res.json({ success: true, message: 'Logged successfully' });
    } catch (error) {
      // Don't crash the app if logging fails
      console.error('Logging error:', error.message);
      res.json({ success: false });
    }
  });

// Return the signed-in user's conversations, newest activity first.
router.get('/history', async (req, res) => {
  try {
    if (!Log) return res.json({ conversations: [] });
    const logs = await Log.find({ userId: req.user._id, chatType: { $ne: 'study' }, timestamp: { $gte: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) } })
      .sort({ timestamp: 1 }).lean();
    const byConversation = new Map();
    for (const log of logs) {
      if (!log.conversationId) continue;
      if (!byConversation.has(log.conversationId)) byConversation.set(log.conversationId, { id: log.conversationId, title: log.conversationTitle || log.userMessage.slice(0, 30) || 'Chat', messages: [], updatedAt: log.timestamp });
      const chat = byConversation.get(log.conversationId);
      if (log.conversationTitle) chat.title = log.conversationTitle;
      chat.messages.push({ role: 'user', text: log.userMessage, id: `u-${log._id}`, time: log.timestamp.getTime() });
      chat.messages.push({ role: 'bot', text: log.botReply, id: `b-${log._id}`, time: log.timestamp.getTime() });
      chat.updatedAt = log.timestamp;
    }
    res.json({ conversations: [...byConversation.values()].sort((a, b) => b.updatedAt - a.updatedAt) });
  } catch (error) {
    console.error('History fetch error:', error.message);
    res.status(500).json({ error: 'Could not load chat history' });
  }
});

router.put('/history/:conversationId', async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim().slice(0, 80);
    if (!title) return res.status(400).json({ error: 'Conversation name cannot be empty' });
    if (Log) await Log.updateMany(
      { userId: req.user._id, conversationId: req.params.conversationId, chatType: { $ne: 'study' } },
      { $set: { conversationTitle: title } }
    );
    res.json({ success: true, title });
  } catch (error) {
    res.status(500).json({ error: 'Could not rename conversation' });
  }
});

router.delete('/history/:conversationId', async (req, res) => {
  try {
    if (Log) await Log.deleteMany({ userId: req.user._id, conversationId: req.params.conversationId, chatType: { $ne: 'study' } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete conversation' });
  }
});

router.delete('/history', async (req, res) => {
  try {
    if (Log) await Log.deleteMany({ userId: req.user._id, chatType: { $ne: 'study' } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Could not clear chat history' });
  }
});

module.exports = router;
