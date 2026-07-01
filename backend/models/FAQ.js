// =============================================
// models/FAQ.js – FAQ Database Schema
// =============================================
// A "schema" tells MongoDB what shape our data has.
// Think of it like a form with specific fields.

const mongoose = require('mongoose');

// Define the structure of a FAQ document
const FAQSchema = new mongoose.Schema({

  // Array of keywords that trigger this FAQ
  // Example: ["fee", "payment", "deadline"]
  keywords: {
    type: [String],
    required: true,
  },

  // The category this FAQ belongs to
  category: {
    type: String,
    enum: ['fees', 'admissions', 'exams', 'hostel', 'library', 'placements', 'scholarships', 'timetable', 'other'],
    required: true,
  },

  // Short name for the intent (machine-readable)
  intent: {
    type: String,
    required: true,
  },

  // Answers in different languages
  // Only English is required; others are optional
  answers: {
    en: { type: String, required: true },  // English (required)
    hi: { type: String, default: '' },     // Hindi
    mr: { type: String, default: '' },     // Marathi
    ta: { type: String, default: '' },     // Tamil
    te: { type: String, default: '' },     // Telugu
  },

  // Is this FAQ currently active?
  isActive: {
    type: Boolean,
    default: true,
  },

  // Timestamps: automatically adds createdAt and updatedAt
}, { timestamps: true });

// Create a text index on keywords for faster searching
FAQSchema.index({ keywords: 'text' });

// Export the model so other files can use it
module.exports = mongoose.model('FAQ', FAQSchema);
