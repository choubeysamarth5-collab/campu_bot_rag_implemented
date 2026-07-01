// =================================================================
// auth/auth.js  –  Shared Authentication Utilities
// Used by login.html, register.html, admin-login.html,
//         index.html, admin.html
// =================================================================
//
// 📖 HOW TOKEN STORAGE WORKS:
//
//   After successful login, the server sends back:
//     { success: true, token: "eyJhbGci...", user: { ... } }
//
//   We store BOTH the token AND the user object in localStorage:
//     localStorage.setItem('campusbot_token', token)
//     localStorage.setItem('campusbot_user',  JSON.stringify(user))
//
//   On every protected page load, we read the token and send it
//   in the Authorization header of every fetch() call:
//     Authorization: Bearer eyJhbGci....
//
//   On logout, we remove both items from localStorage.
//
// 📖 LOCALSTORAGE vs COOKIES:
//   localStorage is simpler and fine for learning projects.
//   In production, httpOnly cookies are more secure (prevent XSS).
// =================================================================

const API = 'https://campus-bot-ml-2.onrender.com/api';

// ── Key names in localStorage ─────────────────────────────────────
const TOKEN_KEY = 'campusbot_token';
const USER_KEY = 'campusbot_user';
const ADMIN_TOKEN_KEY = 'campusbot_admin_token';
const ADMIN_KEY = 'campusbot_admin';

// =================================================================
//  TOKEN MANAGEMENT
// =================================================================

// Save user token + profile after login
function saveUserAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Save admin token + profile after admin login
function saveAdminAuth(token, admin) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

// Get stored user token
function getUserToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Get stored admin token
function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

// Get stored user object
function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

// Get stored admin object
function getAdmin() {
  const raw = localStorage.getItem(ADMIN_KEY);
  return raw ? JSON.parse(raw) : null;
}

// Clear user session (logout)
function clearUserAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Clear admin session (admin logout)
function clearAdminAuth() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

// Check if user is logged in
function isUserLoggedIn() {
  return !!getUserToken();
}

// Check if admin is logged in
function isAdminLoggedIn() {
  return !!getAdminToken();
}

// =================================================================
//  ROUTE GUARDS
//  Call these at the TOP of each protected page
// =================================================================

// Call on pages that require USER login (e.g. index.html)
// If not logged in → redirect to login page
function requireUserLogin(redirectTo = '/auth/login.html') {
  if (!isUserLoggedIn()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

// Call on pages that require ADMIN login (e.g. admin.html)
function requireAdminLogin(redirectTo = '/auth/admin-login.html') {
  if (!isAdminLoggedIn()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

// Call on login/register pages — redirect away if already logged in
function redirectIfUserLoggedIn(destination = '/index.html') {
  if (isUserLoggedIn()) window.location.href = destination;
}

function redirectIfAdminLoggedIn(destination = '/admin.html') {
  if (isAdminLoggedIn()) window.location.href = destination;
}

// =================================================================
//  AUTHENTICATED FETCH HELPERS
//  These automatically add the Authorization header
// =================================================================

// Fetch with user token
async function userFetch(endpoint, options = {}) {
  const token = getUserToken();
  return fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,  // ← JWT goes here
      ...(options.headers || {}),
    },
  });
}

// Fetch with admin token
async function adminFetch(endpoint, options = {}) {
  const token = getAdminToken();
  return fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

// =================================================================
//  LOGOUT HELPERS
// =================================================================

async function logoutUser() {
  try {
    await userFetch('/auth/logout', { method: 'POST' });
  } catch (e) { /* silently ignore network errors */ }
  clearUserAuth();
  window.location.href = '/auth/login.html';
}

async function logoutAdmin() {
  try {
    await adminFetch('/admin/auth/logout', { method: 'POST' });
  } catch (e) { }
  clearAdminAuth();
  window.location.href = '/auth/admin-login.html';
}

// =================================================================
//  UI HELPERS
// =================================================================

// Show an alert message in the auth forms
function showAlert(elementId, message, type = 'error') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `alert ${type} show`;
  el.innerHTML = `<span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span><span>${message}</span>`;
}

function hideAlert(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.className = 'alert';
}

// Set button loading state
function setLoading(btnId, isLoading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle('loading', isLoading);
}

// Password strength checker
function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"|,.<>\/?]/.test(password)) score++;

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#10b981'];
  const widths = ['0%', '20%', '40%', '60%', '80%', '100%'];

  return {
    score,
    label: labels[score] || '',
    color: colors[score] || '',
    width: widths[score] || '0%',
  };
}

// Update strength bar UI
function updateStrengthBar(password, fillId, labelId) {
  const result = checkPasswordStrength(password);
  const fill = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  if (fill) { fill.style.width = result.width; fill.style.background = result.color; }
  if (label) { label.textContent = result.label; label.style.color = result.color; }
}

// Expose everything to all pages
window.CampusAuth = {
  saveUserAuth, saveAdminAuth,
  getUserToken, getAdminToken,
  getUser, getAdmin,
  clearUserAuth, clearAdminAuth,
  isUserLoggedIn, isAdminLoggedIn,
  requireUserLogin, requireAdminLogin,
  redirectIfUserLoggedIn, redirectIfAdminLoggedIn,
  userFetch, adminFetch,
  logoutUser, logoutAdmin,
  showAlert, hideAlert, setLoading,
  checkPasswordStrength, updateStrengthBar,
  API,
};
