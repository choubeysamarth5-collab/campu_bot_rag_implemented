// =============================================
// routes/logs.js – Chat Log Routes
// =============================================
const express = require('express');
const router = express.Router();
let Log;
try { Log = require('../models/Log'); } catch(e) {}

// GET /api/logs – Get all chat logs (newest first)
router.get('/', async (req, res) => {
  try {
    if (!Log) return res.json([]);
    const limit = parseInt(req.query.limit) || 50;
    const logs = await Log.find().sort({ timestamp: -1 }).limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
