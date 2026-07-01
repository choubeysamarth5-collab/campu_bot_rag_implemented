// =================================================================
// utils/validators.js  –  Input Validation Helpers
// =================================================================
//
// 📖 WHY VALIDATE ON THE BACKEND?
//   Frontend validation (HTML required, JS checks) is for UX only.
//   A malicious user can bypass the frontend entirely using tools
//   like Postman or curl and send raw HTTP requests.
//   Backend validation is the LAST LINE OF DEFENSE.
// =================================================================

// ── Validate user registration input ─────────────────────────────
const validateRegister = ({ name, email, password }) => {
  const errors = [];

  if (!name || name.trim().length < 2)
    errors.push('Name must be at least 2 characters');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('Please provide a valid email address');

  if (!password || password.length < 6)
    errors.push('Password must be at least 6 characters');

  if (password && !/[A-Za-z]/.test(password))
    errors.push('Password must contain at least one letter');

  return errors; // empty array = valid
};

// ── Validate login input ──────────────────────────────────────────
const validateLogin = ({ email, password }) => {
  const errors = [];

  if (!email || email.trim() === '')
    errors.push('Email is required');

  if (!password || password.trim() === '')
    errors.push('Password is required');

  return errors;
};

// ── Validate admin registration ───────────────────────────────────
const validateAdminRegister = ({ name, email, password, adminKey }) => {
  const errors = [...validateRegister({ name, email, password })];

  // Admin registration requires a secret key
  const expectedKey = process.env.ADMIN_REGISTRATION_KEY || 'campusadmin2024';
  if (!adminKey || adminKey !== expectedKey)
    errors.push('Invalid admin registration key');

  if (password && password.length < 8)
    errors.push('Admin password must be at least 8 characters');

  return errors;
};

module.exports = { validateRegister, validateLogin, validateAdminRegister };
