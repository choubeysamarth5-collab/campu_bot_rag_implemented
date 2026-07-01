// =================================================================
// routes/userAuth.js  –  User Authentication Routes
// =================================================================
//
// ENDPOINTS:
//   POST   /api/auth/register     Register a new user
//   POST   /api/auth/login        Login and get JWT token
//   GET    /api/auth/me           Get logged-in user's profile  [protected]
//   PUT    /api/auth/profile      Update profile                [protected]
//   POST   /api/auth/logout       Logout (invalidate token hint)[protected]
//   PUT    /api/auth/password     Change password               [protected]
//
// 📖 NOTE ON LOGOUT:
//   JWTs are stateless — the server does NOT store them.
//   True server-side invalidation would require a token blacklist
//   (Redis, etc).  For this beginner project, logout simply tells
//   the frontend to delete its stored token.  The token technically
//   remains valid until it expires, but the client won't use it.
// =================================================================

const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const { generateUserToken }           = require('../utils/jwt');
const { protect }                     = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../utils/validators');

// =================================================================
// POST /api/auth/register
// Body: { name, email, password, rollNumber?, department?, year? }
// =================================================================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, rollNumber, department, year } = req.body;

    // ── 1. Validate input ────────────────────────────────────────
    const errors = validateRegister({ name, email, password });
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    // ── 2. Check if email already registered ────────────────────
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({   // 409 = Conflict
        success: false,
        message: 'An account with this email already exists. Please login.',
      });
    }

    // ── 3. Create user (password auto-hashed by pre-save hook) ───
    const user = await User.create({
      name:       name.trim(),
      email:      email.toLowerCase().trim(),
      password,                   // plain text — hashed in model
      rollNumber: rollNumber || '',
      department: department || '',
      year:       year || 1,
    });

    // ── 4. Generate JWT token ─────────────────────────────────────
    const token = generateUserToken(user._id);

    // ── 5. Respond with token and safe user object ────────────────
    res.status(201).json({   // 201 = Created
      success: true,
      message: 'Account created successfully! Welcome to CampusBot 🎓',
      token,
      user: user.toSafeObject(),   // no password in response
    });

  } catch (err) {
    console.error('Register error:', err.message);
    // Handle MongoDB duplicate key error (race condition)
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered.',
      });
    }
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// =================================================================
// POST /api/auth/login
// Body: { email, password }
// =================================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── 1. Validate input ────────────────────────────────────────
    const errors = validateLogin({ email, password });
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0] });
    }

    // ── 2. Find user by email ────────────────────────────────────
    // Use .select('+password') because password has select:false in schema
    const user = await User.findOne({ email: email.toLowerCase().trim() })
                           .select('+password');

    if (!user) {
      // Use vague message — don't reveal whether email exists
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // ── 3. Check if account is active ────────────────────────────
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact helpdesk.',
      });
    }

    // ── 4. Compare password with stored hash ──────────────────────
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // ── 5. Update lastLogin timestamp ────────────────────────────
    user.lastLogin = new Date();
    await user.save();

    // ── 6. Generate JWT ───────────────────────────────────────────
    const token = generateUserToken(user._id);

    // ── 7. Respond ────────────────────────────────────────────────
    res.json({
      success: true,
      message: `Welcome back, ${user.name}! 👋`,
      token,
      user: user.toSafeObject(),
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// =================================================================
// GET /api/auth/me   [PROTECTED — requires valid JWT]
// Returns the currently logged-in user's profile
// =================================================================
router.get('/me', protect, async (req, res) => {
  // req.user is set by the protect middleware
  res.json({
    success: true,
    user: req.user.toSafeObject(),
  });
});

// =================================================================
// PUT /api/auth/profile   [PROTECTED]
// Update name, rollNumber, department, year
// =================================================================
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, rollNumber, department, year } = req.body;

    // Only allow updating these fields (not email, password, role)
    const updates = {};
    if (name)        updates.name       = name.trim();
    if (rollNumber)  updates.rollNumber = rollNumber.trim();
    if (department)  updates.department = department.trim();
    if (year)        updates.year       = parseInt(year);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }  // return updated doc, run schema validators
    );

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUser.toSafeObject(),
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =================================================================
// PUT /api/auth/password   [PROTECTED]
// Body: { currentPassword, newPassword }
// =================================================================
router.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Both current and new password are required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      });
    }

    // Fetch user with password (select:false by default)
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isCorrect = await user.comparePassword(currentPassword);
    if (!isCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    // Set new password (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully.' });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =================================================================
// POST /api/auth/logout   [PROTECTED]
// Stateless logout — instructs frontend to clear token
// =================================================================
router.post('/logout', protect, (req, res) => {
  // Since JWTs are stateless, we can't truly invalidate them server-side
  // without a token blacklist (beyond scope here).
  // We tell the frontend to delete the token, which is enough for most cases.
  res.json({
    success: true,
    message: 'Logged out successfully. See you soon! 👋',
    clearToken: true,  // hint for the frontend
  });
});


module.exports = router;
