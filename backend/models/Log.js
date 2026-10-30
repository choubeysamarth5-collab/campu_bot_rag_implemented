// =============================================
// models/Log.js – Chat Conversation Log Schema
// =============================================

const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({

  userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
},

// Which conversation/chat
// this message belongs to

conversationId: {

  type: String,

  required: true
},

  conversationTitle: {
    type: String,
    trim: true,
    maxlength: 80,
  },

  chatType: {
    type: String,
    enum: ['faq', 'study'],
    default: 'faq',
    index: true,
  },

  studySubject: {
    type: String,
    trim: true,
    maxlength: 100,
  },

  // What the user typed
  userMessage: {
    type: String,
    required: true,
    trim: true,        // removes extra spaces
  },

  // What the bot replied
  botReply: {
    type: String,
    required: true,
  },

  // Quizzes generated from a Study conversation (stored on its latest turn).
  studyQuizzes: {
    type: [mongoose.Schema.Types.Mixed],
    default: undefined,
  },

  // Which language was used (en/hi/mr/ta/te)
  lang: {
    type: String,
    default: 'en',
    enum: ['en', 'hi', 'mr', 'ta', 'te'],
  },

  // Which intent was detected (e.g. "fee_deadline")
  intent: {
    type: String,
    default: 'unknown',
  },

  // When the message was sent
  timestamp: {
    type: Date,
    default: Date.now,
  },

}, { timestamps: true });

// Keep chat history for 15 days, then let MongoDB remove expired messages.
LogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 15 * 24 * 60 * 60 });
LogSchema.index({ userId: 1, conversationId: 1, timestamp: 1 });

module.exports = mongoose.model('Log', LogSchema);


// =============================================
// models/Feedback.js – User Feedback Schema
// =============================================
// This is in the same file for simplicity.
// In a bigger project, separate them.
