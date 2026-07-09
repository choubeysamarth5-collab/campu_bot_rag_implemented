// =================================================================
// server.js  –  CampusBot Backend (Node.js + Express)
// Updated to include JWT Authentication System
// =================================================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

// 👇 dotenv ke BAAD
// const aiRoutes = require("./routes/ai");

const app = express();

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "https://campus-bot-ml2.vercel.app",
    "https://campu-bot-rag-implemented.vercel.app"   // ← Naya domain add kiya
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ── Security headers ──────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// ── Database Connection ───────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/campusbot';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected!');
    require('../database/seeds/seedData')
    require('../database/seeds/seedAdmin');
  })
  .catch(err => console.error('❌ MongoDB error:', err.message));

// ── Import Routes ─────────────────────────────────────────────────
const userAuthRoutes = require('./routes/userAuth');
const adminAuthRoutes = require('./routes/adminAuth');
const chatRoutes = require('./routes/chat');
const faqRoutes = require('./routes/faqs');
const logRoutes = require('./routes/logs');
const feedbackRoutes = require('./routes/feedback');

const aiRoutes = require("./routes/ai");
const documentRoute = require("./rag/routes/document");
const uploadRoutes = require("./rag/routes/upload");

const { protect } = require("./middleware/auth");
const { adminProtect } = require("./middleware/adminAuth");
// Documents/routes imports ke paas
const developerRoutes = require('./routes/developer');
// ── Register Routes ───────────────────────────────────────────────
// app.use('/api/auth', userAuthRoutes);
// app.use('/api/admin', adminAuthRoutes);
// app.use('/api', protect, chatRoutes);
// app.use('/api/faqs', faqRoutes);
// app.use('/api/logs', logRoutes);
// app.use('/api/feedback', feedbackRoutes);

// app.get('/api/stats', adminProtect, async (req, res) => {
//   try {
//     const FAQ = require('./models/FAQ');
//     const Log = require('./models/Log');
//     const Feedback = require('./models/Feedback');
//     const User = require('./models/User');
//     const [faqs, conversations, feedbackItems, users] = await Promise.all([
//       FAQ.countDocuments(), Log.countDocuments(), Feedback.find(), User.countDocuments(),
//     ]);
//     const avgRating = feedbackItems.length
//       ? (feedbackItems.reduce((s, f) => s + f.rating, 0) / feedbackItems.length).toFixed(1)
//       : null;
//     res.json({ faqs, conversations, feedbackCount: feedbackItems.length, avgRating, users });
//   } catch (err) {
//     res.json({ faqs: 8, conversations: 0, feedbackCount: 0, avgRating: null, users: 0 });
//   }
// });

// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'OK', message: 'CampusBot backend is running!',
//     dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
//     auth: 'JWT enabled', timestamp: new Date().toISOString(),
//   });
// });

// app.use('*', (req, res) => {
//   res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found` });
// });

// app.use((err, req, res, next) => {
//   console.error('Server Error:', err.message);
//   res.status(err.status || 500).json({ success: false, message: 'Something went wrong' });
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`🚀 CampusBot at http://localhost:${PORT}`);
//   console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/login`);
//   console.log(`⚙️  Admin: http://localhost:${PORT}/api/admin/auth/login`);
// });

// module.exports = app;
// ── Register Routes ───────────────────────────────

app.use('/api/auth', userAuthRoutes);

app.use('/api/admin', adminAuthRoutes);

// Register Routes section mein (kahi bhi, before 404 handler)
app.use('/api/dev', developerRoutes);

// Chatbot protected for logged-in users only
app.use('/api/chat', protect, chatRoutes);

// Public admin-panel routes
app.use('/api/faqs', faqRoutes);

app.use('/api/logs', logRoutes);

app.use('/api/feedback', feedbackRoutes);

app.use('/api/ai', aiRoutes);
app.use("/api/rag", uploadRoutes);

// Public stats route
app.get('/api/stats', async (req, res) => {

  try {

    const FAQ = require('./models/FAQ');
    const Log = require('./models/Log');
    const Feedback = require('./models/Feedback');
    const User = require('./models/User');

    const [
      faqs,
      conversations,
      feedbackItems,
      users
    ] = await Promise.all([

      FAQ.countDocuments({ isActive: true }),

      Log.countDocuments(),

      Feedback.find(),

      User.countDocuments(),
    ]);

    const avgRating =

      feedbackItems.length

        ? (

          feedbackItems.reduce(
            (s, f) => s + f.rating,
            0
          ) / feedbackItems.length

        ).toFixed(1)

        : null;

    res.json({

      faqs,

      conversations,

      feedbackCount:
        feedbackItems.length,

      avgRating,

      users
    });

  } catch (err) {

    console.error(err);

    res.json({

      faqs: 0,

      conversations: 0,

      feedbackCount: 0,

      avgRating: null,

      users: 0
    });
  }
});
// ── Health Route ───────────────────────────────
app.get('/api/health', (req, res) => {

  res.json({

    status: 'OK',

    message: 'CampusBot backend is running!',

    dbStatus:
      mongoose.connection.readyState === 1
        ? 'Connected'
        : 'Disconnected',

    timestamp: new Date().toISOString(),
  });
});
app.use("/api/rag/documents", documentRoute);

// ── 404 Handler ───────────────────────────────
app.use('*', (req, res) => {

  res.status(404).json({

    success: false,

    error: `Route ${req.originalUrl} not found`
  });
});

// ── Error Handler ─────────────────────────────
app.use((err, req, res, next) => {

  console.error('Server Error:', err.message);

  res.status(err.status || 500).json({

    success: false,

    message: 'Something went wrong'
  });
});

// ── Start Server ──────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

  console.log(`🚀 CampusBot at http://localhost:${PORT}`);

  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/login`);

  console.log(`⚙️ Admin: http://localhost:${PORT}/api/admin/auth/login`);
});

module.exports = app;