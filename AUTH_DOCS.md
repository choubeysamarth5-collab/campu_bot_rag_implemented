# 🔐 CampusBot Authentication System – Complete API Documentation

## Table of Contents
1. [How Auth Works (Theory)](#how-auth-works)
2. [User Auth Endpoints](#user-auth-endpoints)
3. [Admin Auth Endpoints](#admin-auth-endpoints)
4. [Protected Route Examples](#protected-routes)
5. [MongoDB Schemas](#mongodb-schemas)
6. [Sample Requests & Responses](#sample-requests)
7. [Frontend Token Flow](#frontend-token-flow)
8. [Common Errors](#common-errors)

---

## How Auth Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                          │
│                                                                 │
│  1. USER REGISTERS / LOGS IN                                    │
│     POST /api/auth/login  ←  { email, password }               │
│                                                                 │
│  2. SERVER VERIFIES PASSWORD (bcrypt.compare)                   │
│     ✓ Match → Generate JWT token                                │
│     ✗ No match → 401 Unauthorized                               │
│                                                                 │
│  3. SERVER RETURNS TOKEN                                        │
│     ← { token: "eyJhbGci...", user: { name, email } }          │
│                                                                 │
│  4. FRONTEND STORES TOKEN                                       │
│     localStorage.setItem('campusbot_token', token)             │
│                                                                 │
│  5. SUBSEQUENT REQUESTS INCLUDE TOKEN IN HEADER                 │
│     GET /api/auth/me                                            │
│     Authorization: Bearer eyJhbGci...                           │
│                                                                 │
│  6. MIDDLEWARE VERIFIES TOKEN ON EVERY REQUEST                  │
│     ✓ Valid → req.user = user data → allow                      │
│     ✗ Invalid/Expired → 401 Unauthorized                        │
└─────────────────────────────────────────────────────────────────┘
```

### JWT Structure
```
Header.Payload.Signature

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9   ← Header (algorithm)
.eyJpZCI6IjY2YWJjMTIzIiwicm9sZSI6InVzZXIifQ  ← Payload (your data)
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  ← Signature (tamper-proof)
```

---

## User Auth Endpoints

### POST /api/auth/register
**Description:** Create a new student account

**Request Body:**
```json
{
  "name":       "Raj Sharma",
  "email":      "raj@college.edu",
  "password":   "mypassword123",
  "rollNumber": "21CS001",
  "department": "Computer Science",
  "year":       2
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully! Welcome to CampusBot 🎓",
  "token":   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id":        "64a1b2c3d4e5f6a7b8c9d0e1",
    "name":       "Raj Sharma",
    "email":      "raj@college.edu",
    "rollNumber": "21CS001",
    "department": "Computer Science",
    "year":       2,
    "role":       "user",
    "isActive":   true,
    "createdAt":  "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (400 – Validation):**
```json
{
  "success": false,
  "message": "Password must be at least 6 characters",
  "errors":  ["Password must be at least 6 characters"]
}
```

**Error Response (409 – Duplicate):**
```json
{
  "success": false,
  "message": "An account with this email already exists. Please login."
}
```

---

### POST /api/auth/login
**Description:** Login and receive a JWT token

**Request Body:**
```json
{
  "email":    "raj@college.edu",
  "password": "mypassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Welcome back, Raj Sharma! 👋",
  "token":   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id":   "64a1b2c3d4e5f6a7b8c9d0e1",
    "name":  "Raj Sharma",
    "email": "raj@college.edu",
    "role":  "user"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid email or password."
}
```

---

### GET /api/auth/me  🔒 Protected
**Description:** Get the currently logged-in user's profile

**Headers Required:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "_id":        "64a1b2c3d4e5f6a7b8c9d0e1",
    "name":       "Raj Sharma",
    "email":      "raj@college.edu",
    "rollNumber": "21CS001",
    "department": "Computer Science",
    "year":       2,
    "role":       "user",
    "lastLogin":  "2024-01-15T10:30:00.000Z"
  }
}
```

**Error (401 – No/Bad Token):**
```json
{
  "success": false,
  "message": "Access denied. No token provided. Please log in."
}
```

**Error (401 – Expired Token):**
```json
{
  "success": false,
  "message": "Session expired. Please log in again.",
  "code":    "TOKEN_EXPIRED"
}
```

---

### PUT /api/auth/profile  🔒 Protected
**Update name, department, year (NOT email or password)**

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name":       "Raj Kumar Sharma",
  "department": "Information Technology",
  "year":       3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully.",
  "user": { ... updated user ... }
}
```

---

### PUT /api/auth/password  🔒 Protected
**Change password**

**Request Body:**
```json
{
  "currentPassword": "mypassword123",
  "newPassword":     "newStrongPass@456"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Password changed successfully."
}
```

---

### POST /api/auth/logout  🔒 Protected
**Response:**
```json
{
  "success":    true,
  "message":    "Logged out successfully. See you soon! 👋",
  "clearToken": true
}
```

---

## Admin Auth Endpoints

### POST /api/admin/auth/register
**Description:** Create an admin account (requires secret key)

**Request Body:**
```json
{
  "name":     "Prof. Suresh Kumar",
  "email":    "admin@college.edu",
  "password": "AdminStr0ng@Pass",
  "adminKey": "campusadmin2024_secretkey"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Admin account created! Welcome, Prof. Suresh Kumar ⚙️",
  "token":   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "_id":         "64a1b2c3d4e5f6a7b8c9d0e2",
    "name":        "Prof. Suresh Kumar",
    "email":       "admin@college.edu",
    "role":        "admin",
    "permissions": ["faqs", "logs", "feedback", "users"]
  }
}
```

---

### POST /api/admin/auth/login
**Description:** Admin login (uses DIFFERENT JWT secret from user login)

**Request Body:**
```json
{
  "email":    "admin@college.edu",
  "password": "AdminStr0ng@Pass"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Welcome back, Prof. Suresh Kumar! ⚙️",
  "token":   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "_id":   "64a1b2c3d4e5f6a7b8c9d0e2",
    "name":  "Prof. Suresh Kumar",
    "email": "admin@college.edu",
    "role":  "admin"
  }
}
```

---

### GET /api/admin/auth/me  🔒 Admin Protected
**Headers:** `Authorization: Bearer <ADMIN_TOKEN>`

```json
{
  "success": true,
  "admin": {
    "_id":         "64a1b2c3d4e5f6a7b8c9d0e2",
    "name":        "Prof. Suresh Kumar",
    "role":        "admin",
    "permissions": ["faqs", "logs", "feedback", "users"],
    "lastLogin":   "2024-01-15T09:00:00.000Z"
  }
}
```

---

### GET /api/admin/users  🔒 Admin Protected
**List all registered users**

**Query Params:** `?page=1&limit=20`

```json
{
  "success": true,
  "data": [
    { "_id": "...", "name": "Raj Sharma", "email": "raj@...", "isActive": true },
    { "_id": "...", "name": "Priya Singh", "email": "priya@...", "isActive": true }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "pages": 3 }
}
```

---

### GET /api/admin/stats  🔒 Admin Protected

```json
{
  "success": true,
  "stats": {
    "faqs":          8,
    "conversations": 152,
    "feedbackCount": 37,
    "avgRating":     "4.3",
    "users":         89
  }
}
```

---

## Protected Route Examples

### How to call a protected route from JavaScript:

```javascript
// ── Method 1: Manual fetch with token ────────────────────────────
const token = localStorage.getItem('campusbot_token');

const response = await fetch('https://campus-bot-ml-2.onrender.com', {
  method:  'GET',
  headers: {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,   // ← JWT here
  },
});

const data = await response.json();
console.log(data.user);

// ── Method 2: Using CampusAuth helper (in our project) ───────────
const response = await CampusAuth.userFetch('/auth/me');
const data     = await response.json();
```

---

## MongoDB Schemas

### users collection
```javascript
{
  _id:        ObjectId,           // auto-generated
  name:       String,             // "Raj Sharma"
  email:      String,             // "raj@college.edu" (unique, lowercase)
  password:   String,             // "$2a$12$..." (bcrypt hash)
  rollNumber: String,             // "21CS001"
  department: String,             // "Computer Science"
  year:       Number (1-5),       // 2
  role:       "user",             // always "user" in this collection
  isActive:   Boolean,            // true
  lastLogin:  Date,               // 2024-01-15T10:30:00Z
  createdAt:  Date,               // auto
  updatedAt:  Date,               // auto
}
```

### admins collection
```javascript
{
  _id:         ObjectId,
  name:        String,
  email:       String (unique),
  password:    String,            // bcrypt hash
  role:        "admin" | "superadmin",
  permissions: [String],          // ["faqs", "logs", "feedback", "users"]
  isActive:    Boolean,
  lastLogin:   Date,
  createdAt:   Date,
  updatedAt:   Date,
}
```

---

## Common Errors

| HTTP Code | Meaning | Cause |
|-----------|---------|-------|
| 400 | Bad Request | Missing/invalid input fields |
| 401 | Unauthorized | Missing, expired, or invalid token |
| 403 | Forbidden | Valid token but wrong role (user trying admin route) |
| 404 | Not Found | User/endpoint doesn't exist |
| 409 | Conflict | Email already registered |
| 500 | Server Error | Unexpected backend crash |

### Token error codes:
```json
{ "code": "TOKEN_EXPIRED" }   // → redirect to login
{ "code": "TOKEN_INVALID" }   // → redirect to login
```

---

## Frontend Token Flow

```
LOGIN PAGE                    SERVER                    CHATBOT PAGE
    │                            │                           │
    │  POST /api/auth/login       │                           │
    │  { email, password }        │                           │
    │ ──────────────────────────► │                           │
    │                            │ verify password            │
    │                            │ generate JWT              │
    │  { token, user }           │                           │
    │ ◄────────────────────────── │                           │
    │                            │                           │
    │ localStorage.setItem(token)│                           │
    │                            │                           │
    │ window.location = /index   │                           │
    │ ─────────────────────────────────────────────────────► │
    │                            │  GET /api/auth/me          │
    │                            │  Authorization: Bearer ... │
    │                            │ ◄──────────────────────── │
    │                            │ verify JWT                 │
    │                            │ { user: {...} }            │
    │                            │ ─────────────────────────► │
    │                            │                           │ render UI
```

---

*CampusBot Auth System – Built for hackathons and fresher resumes*
