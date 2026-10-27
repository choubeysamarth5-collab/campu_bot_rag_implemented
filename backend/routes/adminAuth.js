// =================================================================
// routes/adminAuth.js  –  Admin Authentication Routes
// =================================================================
//
// ENDPOINTS:
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
const multer = require('multer');
const router = express.Router();
const Admin = require('../models/Admin');
const User = require('../models/User');
const AuthorizedEmail = require('../models/AuthorizedEmail');
const Log = require('../models/Log');
const Feedback = require('../models/Feedback');
const FAQ = require('../models/FAQ');
const { parseAuthorizedEmailFile } = require('../utils/authorizedEmailImport');
const { generateAdminToken } = require('../utils/jwt');
const { adminProtect, requireSuperAdmin } = require('../middleware/adminAuth');
const { validateLogin } = require('../utils/validators');

const accessListUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (/\.(xlsx|csv|tsv|pdf)$/i.test(file.originalname || '')) return callback(null, true);
    callback(new Error('Upload an .xlsx, .csv, .tsv, or PDF file.'));
  },
});

function normalizeAccessRecord(body = {}) {
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const branch = String(body.branch || body.department || '').trim();
  const rawSemester = String(body.semester ?? '').trim();
  const semester = rawSemester ? Number.parseInt(rawSemester, 10) : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (name.length > 100 || branch.length > 100) throw new Error('Name and branch must be 100 characters or fewer.');
  if (rawSemester && (!Number.isInteger(semester) || semester < 1 || semester > 10)) throw new Error('Semester must be between 1 and 10.');
  return { email, name, branch, semester };
}

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
router.get('/authorized-emails', adminProtect, async (req, res) => {
  try {
    const records = await AuthorizedEmail.find({ isDeleted: false }).sort({ createdAt: -1 }).lean();
    const emails = records.map(record => record.email);
    const registered = await User.find({ email: { $in: emails } }).select('email').lean();
    const registeredEmails = new Set(registered.map(user => user.email));
    res.json({
      success: true,
      data: records.map(record => ({ ...record, isRegistered: registeredEmails.has(record.email) })),
    });
  } catch (err) {
    console.error('Authorized email list error:', err.message);
    res.status(500).json({ success: false, message: 'Could not load authorized emails.' });
  }
});

router.post('/authorized-emails', adminProtect, async (req, res) => {
  try {
    const record = normalizeAccessRecord(req.body);
    const saved = await AuthorizedEmail.findOneAndUpdate(
      { email: record.email },
      { $set: { ...record, isEnabled: true, isDeleted: false, source: 'manual' }, $setOnInsert: { createdBy: req.admin._id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await User.updateOne({ email: saved.email }, { $set: { isActive: true } });
    res.status(200).json({ success: true, message: 'Email authorized.', record: saved });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 400).json({ success: false, message: err.message || 'Could not authorize email.' });
  }
});

router.post('/authorized-emails/import', adminProtect, (req, res, next) => {
  accessListUpload.array('files', 10)(req, res, err => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'Select one or more .xlsx, .csv, .tsv, or PDF files.' });
    const importedRows = [];
    const errors = [];
    for (const file of req.files) {
      try {
        const rows = await parseAuthorizedEmailFile(file);
        rows.forEach(row => importedRows.push({ ...row, sourceFile: file.originalname }));
      } catch (err) {
        errors.push({ file: file.originalname, message: err.message });
      }
    }
    const uniqueRecords = new Map();
    importedRows.forEach((row, index) => {
      try {
        const record = normalizeAccessRecord(row);
        uniqueRecords.set(record.email, { ...record, sourceFile: row.sourceFile, sourceRow: row.sourceRow || index + 2 });
      } catch (err) {
        errors.push({ file: row.sourceFile, row: row.sourceRow || index + 2, email: row.email || '', message: err.message });
      }
    });

    const operations = [...uniqueRecords.values()].map(record => ({
          updateOne: {
            filter: { email: record.email },
            update: {
              $set: {
                email: record.email,
                name: record.name,
                branch: record.branch,
                semester: record.semester,
                isEnabled: true,
                isDeleted: false,
                source: 'import',
              },
              $setOnInsert: { createdBy: req.admin._id },
            },
            upsert: true,
          },
        }));

    const result = operations.length
      ? await AuthorizedEmail.bulkWrite(operations, { ordered: false })
      : { upsertedCount: 0, modifiedCount: 0 };
    const importedEmails = operations.map(operation => operation.updateOne.filter.email);
    if (importedEmails.length) await User.updateMany({ email: { $in: importedEmails } }, { $set: { isActive: true } });
    res.json({
      success: true,
      message: `${operations.length} row(s) processed; ${errors.length} file/row error(s).`,
      imported: result.upsertedCount + result.modifiedCount,
      invalidRows: errors,
    });
  } catch (err) {
    console.error('Authorized email import error:', err.message);
    res.status(400).json({ success: false, message: err.message || 'Could not import file.' });
  }
});

router.patch('/authorized-emails/bulk', adminProtect, async (req, res) => {
  try {
    const { action, ids = [], all = false } = req.body;
    if (!['enable', 'disable', 'delete'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Choose enable, disable, or delete.' });
    }
    if (!all && (!Array.isArray(ids) || !ids.length)) {
      return res.status(400).json({ success: false, message: 'Select at least one email.' });
    }

    const filter = { isDeleted: false, ...(!all ? { _id: { $in: ids } } : {}) };
    const targets = await AuthorizedEmail.find(filter).select('email').lean();
    const emails = targets.map(record => record.email);
    if (action === 'delete') {
      await AuthorizedEmail.updateMany(filter, { $set: { isDeleted: true, isEnabled: false } });
      if (emails.length) await User.updateMany({ email: { $in: emails } }, { $set: { isActive: false } });
    } else {
      const isEnabled = action === 'enable';
      await AuthorizedEmail.updateMany(filter, { $set: { isEnabled } });
      if (emails.length) await User.updateMany({ email: { $in: emails } }, { $set: { isActive: isEnabled } });
    }
    res.json({ success: true, affected: targets.length, message: `${targets.length} email(s) ${action}d.` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Bulk update failed.' });
  }
});

router.patch('/authorized-emails/:id', adminProtect, async (req, res) => {
  try {
    const current = await AuthorizedEmail.findOne({ _id: req.params.id, isDeleted: false });
    if (!current) return res.status(404).json({ success: false, message: 'Authorized email not found.' });

    const updates = {};
    if (req.body.isEnabled !== undefined) updates.isEnabled = Boolean(req.body.isEnabled);
    if (['email', 'name', 'branch', 'department', 'semester'].some(key => req.body[key] !== undefined)) {
      Object.assign(updates, normalizeAccessRecord({ ...current.toObject(), ...req.body }));
    }
    Object.assign(current, updates);
    await current.save();
    if (updates.isEnabled !== undefined) await User.updateOne({ email: current.email }, { $set: { isActive: current.isEnabled } });
    res.json({ success: true, record: current });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 400).json({ success: false, message: err.message || 'Could not update email.' });
  }
});

router.delete('/authorized-emails/:id', adminProtect, async (req, res) => {
  try {
    const record = await AuthorizedEmail.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true, isEnabled: false } },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Authorized email not found.' });
    await User.updateOne({ email: record.email }, { $set: { isActive: false } });
    res.json({ success: true, message: 'Email removed from registration allowlist.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Could not remove email.' });
  }
});

router.get('/users', adminProtect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

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
    await AuthorizedEmail.updateOne(
      { email: user.email, isDeleted: false },
      { $set: { isEnabled: Boolean(isActive) } }
    );

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'}.`,
      user: user.toSafeObject(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset a registered user's password without exposing the existing password.
router.put('/users/:id/password', adminProtect, async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.password = password;
    user.authVersion = (user.authVersion || 0) + 1;
    await user.save();
    res.json({ success: true, message: 'Password reset successfully. Existing sessions have been signed out.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Could not reset user password.' });
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

    await AuthorizedEmail.updateOne(
      { email: user.email, isDeleted: false },
      { $set: { isEnabled: false, isDeleted: true } }
    );

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

// =============================================
// PASTE into routes/adminAuth.js — anywhere after the existing
// PUT /admins/:id route (the one that toggles isActive), before
// module.exports = router;
// =============================================
//
// Lets a superadmin flip another admin's "studyNotes" permission
// on/off from the Manage Admins panel, instead of running
// grantStudyPermission.js in a terminal every time a new teacher
// account is created.

// =================================================================
// PUT /api/admin/admins/:id/study-notes   [SUPERADMIN ONLY]
// Body: { enabled: true|false }
// =================================================================
router.put(
  '/admins/:id/study-notes',

  adminProtect,

  requireSuperAdmin,

  async (req, res) => {

    try {

      const { enabled } = req.body;

      const admin = await Admin.findById(req.params.id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found.'
        });
      }

      if (!admin.permissions) admin.permissions = [];

      // If this admin has "all" permissions, studyNotes is already
      // implied — nothing to add, and we don't remove "all" just
      // because someone unchecked this one box.
      if (admin.permissions.includes('all')) {
        return res.json({
          success: true,
          message: `${admin.name} already has full access (includes Study Notes).`,
          permissions: admin.permissions,
        });
      }

      const hasIt = admin.permissions.includes('studyNotes');

      if (enabled && !hasIt) {
        admin.permissions.push('studyNotes');
      } else if (!enabled && hasIt) {
        admin.permissions = admin.permissions.filter(p => p !== 'studyNotes');
      }

      await admin.save();

      res.json({
        success: true,
        message: `Study Notes access ${enabled ? 'granted to' : 'removed from'} ${admin.name}.`,
        permissions: admin.permissions,
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
