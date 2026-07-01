// =================================================================
// middleware/adminAuth.js  –  Admin Authentication Middleware
// =================================================================
//
// 📖 DIFFERENCE FROM auth.js:
//   - Uses a DIFFERENT JWT secret (ADMIN_SECRET vs USER_SECRET)
//   - Looks up the Admin model instead of the User model
//   - Checks that role === 'admin' or 'superadmin'
//
// This means even if a user somehow gets a valid user token,
// they CANNOT access admin routes — wrong secret, wrong model.
//
// 📖 LAYERED SECURITY:
//   Route: GET /api/admin/logs
//   Middleware chain:  adminProtect  →  logsHandler
//   The request must pass adminProtect to even reach logsHandler.
// =================================================================

const { verifyAdminToken } = require('../utils/jwt');
const Admin = require('../models/Admin');

// =================================================================
// adminProtect  –  Ensures request has a valid ADMIN JWT
// Usage:   router.get('/logs', adminProtect, logsHandler)
// =================================================================
const adminProtect = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Admin access denied. No token provided.',
      });
    }

    // Verify using the ADMIN secret (different from user secret)
    let decoded;
    try {
      decoded = verifyAdminToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Admin session expired. Please log in again.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid admin token.',
        code: 'TOKEN_INVALID',
      });
    }

    // Confirm this is an admin role token
    if (!['admin', 'superadmin'].includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Admin privileges required.',
      });
    }

    // Load admin from DB
    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin account not found.',
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Admin account has been deactivated.',
      });
    }

    // Attach admin to request
    req.admin = admin;

    next();
  } catch (err) {
    console.error('Admin auth middleware error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Admin authentication error.',
    });
  }
};

// =================================================================
// requireSuperAdmin  –  Extra layer: only superadmin can proceed
// Usage:  router.delete('/admin/:id', adminProtect, requireSuperAdmin, handler)
// =================================================================
const requireSuperAdmin = (req, res, next) => {
  if (req.admin && req.admin.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Superadmin privileges required for this action.',
  });
};

// =================================================================
// requirePermission(perm)  –  Check a specific permission
// Usage:  router.post('/faqs', adminProtect, requirePermission('faqs'), handler)
// =================================================================
const requirePermission = (permission) => {
  return (req, res, next) => {
    const perms = req.admin?.permissions || [];
    if (perms.includes('all') || perms.includes(permission)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: `You don't have '${permission}' permission.`,
    });
  };
};

module.exports = { adminProtect, requireSuperAdmin, requirePermission };
