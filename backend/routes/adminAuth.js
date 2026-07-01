// =================================================================
// routes/adminAuth.js  –  Admin Authentication Routes
// =================================================================
//
// ENDPOINTS:
//   POST  /api/admin/auth/register   Create a new admin account
//   POST  /api/admin/auth/login      Admin login → JWT
//   GET   /api/admin/auth/me         Admin profile          [adminProtect]
//   GET   /api/admin/users           List all users         [adminProtect]
//   PUT   /api/admin/users/:id       Activate/deactivate    [adminProtect]
//   GET   /api/admin/stats           Dashboard statistics   [adminProtect]
//
// 📖 ADMIN REGISTRATION:
//   Requires a secret ADMIN_REGISTRATION_KEY from .env
//   This prevents random people from creating admin accounts.
//   In production: disable this endpoint after setup.
// =================================================================

const express = require('express');
const router  = express.Router();
const Admin   = require('../models/Admin');
const User    = require('../models/User');
const Log     = require('../models/Log');
const Feedback = require('../models/Feedback');
const FAQ     = require('../models/FAQ');
const { generateAdminToken }                       = require('../utils/jwt');
const { adminProtect, requireSuperAdmin }          = require('../middleware/adminAuth');
const { validateLogin, validateAdminRegister }     = require('../utils/validators');

// =================================================================
// POST /api/admin/auth/register
// Body: { name, email, password, adminKey }
// Creates a new admin — requires the secret ADMIN_REGISTRATION_KEY
// =================================================================
router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, adminKey, role } = req.body;

    // Validate inputs + secret key
    const errors = validateAdminRegister({ name, email, password, adminKey });
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    // Check duplicate
    const existing = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An admin account with this email already exists.',
      });
    }

    // Only allow 'superadmin' role if a specific super-key is provided
    const assignedRole = (role === 'superadmin' &&
      req.body.superKey === process.env.SUPER_ADMIN_KEY)
      ? 'superadmin'
      : 'admin';

    const admin = await Admin.create({
      name:  name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role:  assignedRole,
    });

    const token = generateAdminToken(admin._id, admin.role);

    res.status(201).json({
      success: true,
      message: `Admin account created! Welcome, ${admin.name} ⚙️`,
      token,
      admin: admin.toSafeObject(),
    });

  } catch (err) {
    console.error('Admin register error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// =================================================================
// POST /api/admin/auth/login
// Body: { email, password }
// =================================================================
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const errors = validateLogin({ email, password });
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0] });
    }

    // Select password explicitly (select:false in schema)
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() })
                             .select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials.',
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Admin account is deactivated.',
      });
    }

    const isPasswordCorrect = await admin.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials.',
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    const token = generateAdminToken(admin._id, admin.role);

    res.json({
      success: true,
      message: `Welcome back, ${admin.name}! ⚙️`,
      token,
      admin: admin.toSafeObject(),
    });

  } catch (err) {
    console.error('Admin login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// =================================================================
// GET /api/admin/auth/me   [PROTECTED]
// =================================================================
router.get('/auth/me', adminProtect, (req, res) => {
  res.json({
    success: true,
    admin: req.admin.toSafeObject(),
  });
});

// =================================================================
// GET /api/admin/users   [PROTECTED]
// List all registered users (admin can monitor)
// =================================================================
router.get('/users', adminProtect, async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(),
    ]);

    res.json({
      success: true,
      data: users.map(u => u.toSafeObject()),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =================================================================
// PUT /api/admin/users/:id   [PROTECTED]
// Activate or deactivate a user account
// =================================================================
router.put('/users/:id', adminProtect, async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'}.`,
      user: user.toSafeObject(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// =================================================================
// DELETE /api/admin/users/:id   [PROTECTED]
// Permanently delete a user
// =================================================================
router.delete('/users/:id', adminProtect, async (req, res) => {

  try {

    const user =
      await User.findByIdAndDelete(req.params.id);

    if (!user) {

      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully.'
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});
// =================================================================
// GET /api/admin/stats   [PROTECTED]
// Dashboard statistics
// =================================================================
router.get('/stats', adminProtect, async (req, res) => {
  try {
    const [faqs, conversations, feedbackItems, users] = await Promise.all([
      FAQ.countDocuments({ isActive: true }),
      Log.countDocuments(),
      Feedback.find(),
      User.countDocuments({ isActive: true }),
    ]);

    const avgRating = feedbackItems.length
      ? (feedbackItems.reduce((s, f) => s + f.rating, 0) / feedbackItems.length).toFixed(1)
      : null;

    res.json({
      success: true,
      stats: { faqs, conversations, feedbackCount: feedbackItems.length, avgRating, users },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =================================================================
// POST /api/admin/auth/logout   [PROTECTED]
// =================================================================
router.post('/auth/logout', adminProtect, (req, res) => {
  res.json({
    success: true,
    message: 'Admin logged out successfully.',
    clearToken: true,
  });
});
// =================================================================
// CREATE ADMIN  [SUPERADMIN ONLY]
// =================================================================
router.post(
  '/create-admin',
  adminProtect,
  requireSuperAdmin,

  async (req, res) => {

    try {

      const {
        name,
        email,
        password,
        role
      } = req.body;

      // Check existing
      const exists =
        await Admin.findOne({ email });

      if (exists) {

        return res.status(400).json({
          success: false,
          message: 'Admin already exists.'
        });
      }

      // Create admin
      const admin =
        await Admin.create({

          name,
          email,
          password,
          role: role || 'admin'
        });

      res.json({
        success: true,
        message: 'Admin created successfully.',
        admin
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);
// =================================================================
// CHANGE ADMIN PASSWORD  [PROTECTED]
// =================================================================
router.put(
  '/change-password',
  adminProtect,

  async (req, res) => {

    try {

      const {
        currentPassword,
        newPassword
      } = req.body;

      if (
        !currentPassword ||
        !newPassword
      ) {

        return res.status(400).json({
          success: false,
          message: 'All fields are required.'
        });
      }

      if (newPassword.length < 6) {

        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters.'
        });
      }

      const admin = await Admin
        .findById(req.admin._id)
        .select('+password');

      const isCorrect =
        await admin.comparePassword(currentPassword);

      if (!isCorrect) {

        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.'
        });
      }

      admin.password = newPassword;

      await admin.save();

      res.json({
        success: true,
        message: 'Password changed successfully.'
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =================================================================
// GET ALL ADMINS
// =================================================================
router.get(
  '/admins',

  adminProtect,

  requireSuperAdmin,

  async (req, res) => {

    try {

      const admins =
        await Admin.find()
          .select('-password');

      res.json({
        success: true,
        data: admins
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);
// =================================================================
// UPDATE ADMIN STATUS
// =================================================================
router.put(
  '/admins/:id',

  adminProtect,

  requireSuperAdmin,

  async (req, res) => {

    try {

      // Prevent disabling last superadmin
if (
  req.body.isActive === false
) {

  const admin =
    await Admin.findById(
      req.params.id
    );

  if (
    admin &&
    admin.role === 'superadmin'
  ) {

    const activeSuperadmins =
      await Admin.countDocuments({
        role: 'superadmin',
        isActive: true
      });

    if (activeSuperadmins <= 1) {

      return res.status(400).json({
        success: false,
        message:
          'Cannot disable last active superadmin.'
      });
    }
  }
}
      const admin =
        await Admin.findByIdAndUpdate(
          req.params.id,
          {
            isActive: req.body.isActive
          },
          { new: true }
        );

      if (!admin) {

        return res.status(404).json({
          success: false,
          message: 'Admin not found.'
        });
      }

      res.json({
        success: true,
        message: 'Admin updated.'
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);
// =================================================================
// DELETE ADMIN
// =================================================================
router.delete(
  '/admins/:id',

  adminProtect,

  requireSuperAdmin,

  async (req, res) => {

    try {

      // Prevent deleting yourself
      if (
        req.admin._id.toString() ===
        req.params.id
      ) {

        return res.status(400).json({
          success: false,
          message: 'You cannot delete yourself.'
        });
      }

      const admin =
        await Admin.findById(req.params.id);

      if (!admin) {

        return res.status(404).json({
          success: false,
          message: 'Admin not found.'
        });
      }

      // Prevent deleting last superadmin
      if (
        admin.role === 'superadmin'
      ) {

        const superCount =
          await Admin.countDocuments({
            role: 'superadmin'
          });

        if (superCount <= 1) {

          return res.status(400).json({
            success: false,
            message:
              'Cannot delete the last superadmin.'
          });
        }
      }

      await Admin.findByIdAndDelete(
        req.params.id
      );

      res.json({
        success: true,
        message:
          'Admin deleted successfully.'
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);
// =================================================================
// CLEAR OLD CHAT LOGS (30 DAYS)
// =================================================================
router.delete(
  '/cleanup/logs',

  adminProtect,

  requireSuperAdmin,

  async (req, res) => {

    try {

      const result =
        await Log.deleteMany({

          createdAt: {
            $lt: new Date(
              Date.now() -
              30 * 24 * 60 * 60 * 1000
            )
          }
        });

      res.json({
        success: true,
        deletedCount:
          result.deletedCount,
        message:
          'Old chat logs cleaned.'
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// =================================================================
// CLEAR OLD FEEDBACK (30 DAYS)
// =================================================================
router.delete(
  '/cleanup/feedback',

  adminProtect,

  requireSuperAdmin,

  async (req, res) => {

    try {

      const result =
        await Feedback.deleteMany({

          createdAt: {
            $lt: new Date(
              Date.now() -
              30 * 24 * 60 * 60 * 1000
            )
          }
        });

      res.json({
        success: true,
        deletedCount:
          result.deletedCount,
        message:
          'Old feedback cleaned.'
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);
module.exports = router;
