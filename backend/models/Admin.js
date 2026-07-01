// =================================================================
// models/Admin.js  –  Admin Account
// =================================================================
//
// 📖 WHY A SEPARATE MODEL?
//   Admins and Users have DIFFERENT roles and permissions.
//   Keeping them in separate collections makes it easier to:
//     - Apply different validation rules
//     - Grant admin-only powers without touching user logic
//     - Audit admin actions separately
//
//   The schema is very similar to User.js but the role is locked
//   to 'admin' and extra fields like permissions are included.
// =================================================================

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const AdminSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Admin name is required'],
      trim:      true,
      minlength: [2,  'Name must be at least 2 characters'],
      maxlength: [50, 'Name must be at most 50 characters'],
    },

    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please enter a valid email address',
      ],
    },

    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [8, 'Admin password must be at least 8 characters'],
      select:    false,   // never returned in queries by default
    },

    // ── Role is LOCKED to 'admin' ────────────────────────────────
    role: {
      type:    String,
      enum:    ['admin', 'superadmin'],
      default: 'admin',
    },

    // ── Which sections this admin can manage ─────────────────────
    permissions: {
      type:    [String],
      default: ['faqs', 'logs', 'feedback', 'users'],
      // Possible values: 'faqs', 'logs', 'feedback', 'users', 'all'
    },

    isActive: {
      type:    Boolean,
      default: true,
    },

    lastLogin: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Hash password before saving (same logic as User.js) ──────────
AdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt     = await bcrypt.genSalt(12);
    this.password  = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Compare plain password with stored hash ───────────────────────
AdminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ── Safe object without password ─────────────────────────────────
AdminSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Admin', AdminSchema);
