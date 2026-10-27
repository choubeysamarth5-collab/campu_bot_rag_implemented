const mongoose = require('mongoose');

const AuthorizedEmailSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  name: { type: String, trim: true, default: '', maxlength: 100 },
  branch: { type: String, trim: true, default: '', maxlength: 100 },
  semester: { type: Number, min: 1, max: 10, default: null },
  isEnabled: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  source: { type: String, enum: ['manual', 'import', 'registered'], default: 'manual' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

module.exports = mongoose.model('AuthorizedEmail', AuthorizedEmailSchema);
