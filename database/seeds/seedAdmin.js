// =================================================================
// database/seeds/seedAdmin.js
// Creates a default admin account if none exists
// =================================================================
//
// 📖 This runs once when the server starts.
//    It checks if there are any admins in the DB.
//    If not, it creates one using credentials from .env
//    (or the hardcoded defaults below for development).
//
// ⚠️  CHANGE THESE DEFAULTS before deploying to production!
// =================================================================

let Admin;
try {
  Admin = require('../../backend/models/Admin');
} catch (e) {
  try { Admin = require('../models/Admin'); } catch (e2) {
    try { Admin = require('../../models/Admin'); } catch (e3) { return; }
  }
}

async function seedAdmin() {
  try {
    if (!Admin) return;

    const count = await Admin.countDocuments();
    if (count > 0) {
      console.log(`ℹ️  Admin accounts already exist (${count}), skipping seed`);
      return;
    }

    // Create default admin from environment variables or fallback defaults
    const defaultAdmin = {
      name: process.env.DEFAULT_ADMIN_NAME || 'CampusBot Admin',
      email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@college.edu',
      password: process.env.DEFAULT_ADMIN_PASS || 'Admin@1234',
      role: 'superadmin',
      permissions: ['all'],
    };

    await Admin.create(defaultAdmin);

    console.log('✅ Default admin created!');
    console.log(`   📧 Email: ${defaultAdmin.email}`);
    console.log(`   🔑 Password: ${defaultAdmin.password}`);
    console.log('   ⚠️  Please change the password after first login!');

  } catch (err) {
    console.log('⚠️  Could not seed admin:', err.message);
  }
}

seedAdmin();
module.exports = { seedAdmin };
