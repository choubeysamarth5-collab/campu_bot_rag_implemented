// =============================================
// models/Feedback.js – Feedback Schema
// =============================================

const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({

  // Star rating 1-5
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },

  // Optional comment from the user
  comment: {
    type: String,
    default: '',
    trim: true,
  },

  // The message ID this feedback refers to
  messageId: {
    type: String,
    default: null,
  },

  // Language of the session
  lang: {
    type: String,
    default: 'en',
  },

}, { timestamps: true });

module.exports = mongoose.model('Feedback', FeedbackSchema);
