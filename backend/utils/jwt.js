// =================================================================
// utils/jwt.js  –  JWT Helper Functions
// =================================================================
//
// 📖 HOW JWT (JSON WEB TOKEN) WORKS — SIMPLIFIED:
//
//   JWT is like a SIGNED PASS (think: backstage concert pass).
//
//   1. USER LOGS IN  →  Server verifies credentials
//   2. SERVER CREATES TOKEN:
//        Header  { "alg": "HS256", "typ": "JWT" }   ← algorithm used
//        Payload { "id": "abc", "role": "user" }     ← your data
//        Signature  HMAC_SHA256(header+payload, SECRET_KEY)
//      All three parts are base64-encoded and joined with dots:
//        "eyJhbGci....eyJpZCI....SflKxw...."
//
//   3. SERVER SENDS TOKEN to the frontend (browser stores it)
//   4. EVERY FUTURE REQUEST includes the token in the header:
//        Authorization: Bearer eyJhbGci....
//   5. SERVER VERIFIES the signature using the same SECRET_KEY
//      If valid → allow request.  If tampered → reject.
//
//   🔑 The SECRET_KEY never leaves the server.
//      Anyone can READ the payload (it's base64, not encrypted).
//      But nobody can FORGE the signature without the secret key.
//      So never put sensitive data (passwords) in the payload.
// =================================================================

const jwt = require('jsonwebtoken');

// Read secret keys from environment variables
// NEVER hardcode secrets in source code!
const USER_SECRET  = process.env.JWT_SECRET       || 'campusbot_user_secret_change_this';
const ADMIN_SECRET = process.env.JWT_ADMIN_SECRET  || 'campusbot_admin_secret_change_this';

// How long tokens remain valid
const USER_EXPIRES  = process.env.JWT_EXPIRES       || '7d';   // 7 days
const ADMIN_EXPIRES = process.env.JWT_ADMIN_EXPIRES || '1d';   // 1 day (shorter for security)

// =================================================================
// generateUserToken(userId)
// Creates a JWT for a normal user
// =================================================================
const generateUserToken = (userId) => {
  return jwt.sign(
    // PAYLOAD — data embedded in the token (visible but not editable)
    {
      id:   userId.toString(),
      role: 'user',
    },
    // SECRET KEY — used to sign and later verify the token
    USER_SECRET,
    // OPTIONS
    { expiresIn: USER_EXPIRES }
  );
};

// =================================================================
// generateAdminToken(adminId, adminRole)
// Creates a JWT for an admin — shorter expiry for security
// =================================================================
const generateAdminToken = (adminId, adminRole = 'admin') => {
  return jwt.sign(
    {
      id:   adminId.toString(),
      role: adminRole,        // 'admin' or 'superadmin'
    },
    ADMIN_SECRET,
    { expiresIn: ADMIN_EXPIRES }
  );
};

// =================================================================
// verifyUserToken(token)
// Decodes and validates a user token
// Returns the payload object, or throws an error
// =================================================================
const verifyUserToken = (token) => {
  // jwt.verify throws JsonWebTokenError if:
  //   - signature doesn't match (tampered)
  //   - token is expired
  //   - token is malformed
  return jwt.verify(token, USER_SECRET);
};

// =================================================================
// verifyAdminToken(token)
// =================================================================
const verifyAdminToken = (token) => {
  return jwt.verify(token, ADMIN_SECRET);
};

module.exports = {
  generateUserToken,
  generateAdminToken,
  verifyUserToken,
  verifyAdminToken,
};
