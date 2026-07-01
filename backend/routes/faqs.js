// =============================================
// routes/faqs.js – FAQ CRUD API
// CRUD = Create, Read, Update, Delete
// =============================================

const express = require('express');
const router = express.Router();

let FAQ;
try { FAQ = require('../models/FAQ'); } catch(e) {}

// ── GET /api/faqs ── Get all FAQs
router.get('/', async (req, res) => {
  try {
    if (!FAQ) return res.json([]);
    const faqs = await FAQ.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(faqs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/faqs/:id ── Get one FAQ
router.get('/:id', async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) return res.status(404).json({ error: 'FAQ not found' });
    res.json(faq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/faqs ── Create a new FAQ
router.post('/', async (req, res) => {
  try {
    if (!FAQ) return res.status(503).json({ error: 'Database not connected' });

    const { keywords, category, intent, answers } = req.body;

    // Validation
    if (!keywords || !keywords.length) return res.status(400).json({ error: 'Keywords required' });
    if (!answers?.en) return res.status(400).json({ error: 'English answer required' });

    const faq = new FAQ({ keywords, category, intent, answers });
    await faq.save();

    res.status(201).json({ success: true, faq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/faqs/:id ── Update a FAQ
router.put('/:id', async (req, res) => {
  try {
    const updated = await FAQ.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'FAQ not found' });
    res.json({ success: true, faq: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/faqs/:id ── Delete a FAQ
router.delete('/:id', async (req, res) => {
  try {
    // Soft delete: set isActive to false instead of removing from DB
    const deleted = await FAQ.findByIdAndUpdate(req.params.id, { isActive: false });
    if (!deleted) return res.status(404).json({ error: 'FAQ not found' });
    res.json({ success: true, message: 'FAQ deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
