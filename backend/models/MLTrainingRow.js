const mongoose = require('mongoose');

const mlTrainingRowSchema = new mongoose.Schema({
  text: { type: String, required: true },
  intent: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('MLTrainingRow', mlTrainingRowSchema);