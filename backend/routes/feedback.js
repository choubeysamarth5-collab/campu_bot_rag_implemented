// =============================================
// routes/feedback.js – Feedback Routes
// =============================================
const express = require('express');
const router = express.Router();
let Feedback;
try { Feedback = require('../models/Feedback'); } catch(e) {}

// GET /api/feedback
router.get('/', async (req, res) => {
  try {
    if (!Feedback) return res.json([]);
    const items = await Feedback.find().sort({ createdAt: -1 }).limit(100);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/feedback
router.post('/', async (req, res) => {
  try {
    if (!Feedback) return res.json({ success: false, error: 'DB offline' });
    const { rating, comment, messageId, lang } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be 1-5' });
    }
    const fb = new Feedback({ rating, comment, messageId, lang });
    await fb.save();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
