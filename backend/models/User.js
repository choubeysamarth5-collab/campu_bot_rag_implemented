// =================================================================
// models/User.js  –  Normal Student/User Account
// =================================================================
//
// 📖 BEGINNER EXPLANATION:
//   A "model" is like a blueprint for how data is stored in MongoDB.
//   This blueprint defines every field a User document will have.
//   Mongoose reads the schema and enforces the rules automatically.
//
// 🔐 SECURITY FEATURES IN THIS FILE:
//   1. Passwords are NEVER stored as plain text.
//   2. bcrypt hashes passwords before saving (one-way encryption).
//   3. A helper method lets us safely compare passwords on login.
// =================================================================

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── Define the shape of a User document ──────────────────────────
const UserSchema = new mongoose.Schema(
  {
    // ── Basic Info ───────────────────────────────────────────────
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,           // strip leading/trailing spaces
      minlength: [2,  'Name must be at least 2 characters'],
      maxlength: [50, 'Name must be at most 50 characters'],
    },

    email: {
      type:     String,
      required: [true, 'Email is required'],
      unique:   true,           // no two users can share an email
      trim:     true,
      lowercase: true,          // always store in lowercase
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please enter a valid email address',
      ],
    },

    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      // select: false means this field is EXCLUDED from query results
      // by default — you must explicitly ask for it with .select('+password')
      select: false,
    },

    // ── College Details ──────────────────────────────────────────
    rollNumber: {
      type:  String,
      trim:  true,
      default: '',
    },

    department: {
      type:    String,
      trim:    true,
      default: '',
    },

    year: {
      type: Number,
      min:  1,
      max:  5,
      default: 1,
    },

    // ── Role (always 'user' for this model) ──────────────────────
    role: {
      type:    String,
      enum:    ['user'],   // only 'user' is allowed here
      default: 'user',
    },

    // ── Account Status ───────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
    },

    // ── Track last login time ────────────────────────────────────
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

// =================================================================
// PRE-SAVE HOOK  –  runs automatically BEFORE every .save() call
// =================================================================
//
// 📖 HOW PASSWORD HASHING WORKS:
//   Plain text:  "myPassword123"
//   After bcrypt: "$2a$10$XQK8...randomLookingString"
//
//   bcrypt uses a "salt" (random data) + many rounds of computation.
//   Even identical passwords produce DIFFERENT hashes every time.
//   You CANNOT reverse a bcrypt hash — that is the whole point.
//
//   SALT ROUNDS = 12 means bcrypt loops 2^12 = 4096 times.
//   Higher = more secure but slower. 10–12 is the standard.
// =================================================================
UserSchema.pre('save', async function (next) {
  // Only hash the password if it was actually changed
  // (prevents re-hashing on profile update, etc.)
  if (!this.isModified('password')) return next();

  try {
    // Generate a salt (random string added to password before hashing)
    const salt = await bcrypt.genSalt(12);

    // Hash the plain-text password with the salt
    this.password = await bcrypt.hash(this.password, salt);

    next(); // continue saving
  } catch (err) {
    next(err); // pass error to Express error handler
  }
});

// =================================================================
// INSTANCE METHOD  –  comparePassword
// =================================================================
//
// 📖 WHY WE NEED THIS:
//   When a user logs in, they send their plain-text password.
//   We need to compare it against the stored hash.
//   bcrypt.compare() does this safely — it hashes the candidate
//   using the same salt that is embedded in the stored hash.
// =================================================================
UserSchema.methods.comparePassword = async function (candidatePassword) {
  // 'this.password' is the hashed password stored in MongoDB
  return await bcrypt.compare(candidatePassword, this.password);
};

// =================================================================
// INSTANCE METHOD  –  toSafeObject
// =================================================================
// Returns user data WITHOUT the password — safe to send to frontend
// =================================================================
UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;   // remove password from the copy
  return obj;
};

// Export the model so other files can use it
module.exports = mongoose.model('User', UserSchema);
