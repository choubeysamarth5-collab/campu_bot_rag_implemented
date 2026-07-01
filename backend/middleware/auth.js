// =================================================================
// middleware/auth.js  –  User Authentication Middleware
// =================================================================
//
// 📖 WHAT IS MIDDLEWARE?
//   Middleware is a function that runs BETWEEN receiving a request
//   and sending a response.  Think of it as a security checkpoint
//   at an airport — every passenger (request) must pass through
//   before reaching the gate (route handler).
//
//   Express middleware signature:
//     (req, res, next) => { ... }
//
//   - req   = the incoming request (headers, body, etc.)
//   - res   = the outgoing response object
//   - next  = a function to call to move to the NEXT middleware
//
// 📖 HOW THE TOKEN GETS SENT:
//   Frontend JavaScript adds this header to every protected request:
//     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
//
//   This middleware:
//     1. Reads that header
//     2. Strips the "Bearer " prefix to get the raw token
//     3. Verifies the token's signature
//     4. Loads the user from MongoDB
//     5. Attaches user to req.user so the route handler can use it
//     6. Calls next() to allow the request to continue
//
//   If ANYTHING fails, it responds with 401 Unauthorized immediately.
// =================================================================

const { verifyUserToken } = require('../utils/jwt');
const User = require('../models/User');

// =================================================================
// protect  –  Ensures request has a valid USER JWT
// Usage:   router.get('/profile', protect, profileHandler)
// =================================================================
const protect = async (req, res, next) => {
  try {
    let token;

    // ── Step 1: Extract token from Authorization header ──────────
    // The header looks like:  "Bearer eyJhbGci...."
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Split "Bearer eyJhbGci...." → ["Bearer", "eyJhbGci...."]
      // Take the second part [1]
      token = authHeader.split(' ')[1];
    }

    // No token found → reject immediately
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided. Please log in.',
      });
    }

    // ── Step 2: Verify the token's signature and expiry ──────────
    // verifyUserToken throws an error if:
    //   - Token was tampered with
    //   - Token has expired
    //   - Token is malformed
    let decoded;
    try {
      decoded = verifyUserToken(token);
    } catch (err) {
      // Distinguish between expired and invalid tokens
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in again.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
        code: 'TOKEN_INVALID',
      });
    }

    // ── Step 3: Confirm the role encoded in the token ─────────────
    if (decoded.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'This route is for users only.',
      });
    }

    // ── Step 4: Load the full user from MongoDB ───────────────────
    // We re-fetch from DB to catch cases where the account was
    // deleted or deactivated after the token was issued.
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact support.',
      });
    }

    // ── Step 5: Attach user to req so route handlers can use it ──
    req.user = user;

    // ── Step 6: Proceed to the actual route handler ───────────────
    next();

  } catch (err) {
    // Catch any unexpected errors
    console.error('Auth middleware error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.',
    });
  }
};

module.exports = { protect };
