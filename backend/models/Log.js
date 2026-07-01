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

module.exports = mongoose.model('Log', LogSchema);


// =============================================
// models/Feedback.js – User Feedback Schema
// =============================================
// This is in the same file for simplicity.
// In a bigger project, separate them.
