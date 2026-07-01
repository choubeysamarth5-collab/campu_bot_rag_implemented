<<<<<<< HEAD
# 🎓 CampusBot – Multilingual AI Chatbot for Campus Query Assistance

> A full-stack multilingual chatbot that helps college students get instant answers about fees, admissions, exams, hostel, library, placements, and more.

![CampusBot Preview](https://img.shields.io/badge/Status-Active-brightgreen) ![Node.js](https://img.shields.io/badge/Node.js-v18+-green) ![MongoDB](https://img.shields.io/badge/MongoDB-Database-darkgreen) ![Languages](https://img.shields.io/badge/Languages-5-blue)

---

## 🌟 Features

| Feature | Description |
|---------|-------------|
| 🌐 **5 Languages** | English, Hindi, Marathi, Tamil, Telugu |
| 💬 **Smart Chat** | Keyword-based NLP with intent recognition |
| 🗄️ **Database** | MongoDB stores FAQs, logs, and feedback |
| 👨‍💼 **Admin Panel** | Add/Edit/Delete FAQs, view chat logs |
| 🌙 **Dark/Light Mode** | Toggle between themes |
| 📱 **Mobile Responsive** | Works on phones and tablets |
| ⭐ **Feedback System** | Users can rate bot responses |
| 🔄 **Offline Mode** | Works even without backend (local FAQ matching) |

---

## 📁 Project Structure

```
campus-chatbot/
│
├── 📂 frontend/               # All UI files (HTML, CSS, JS)
│   ├── index.html             # Main chatbot page
│   ├── admin.html             # Admin dashboard
│   ├── css/
│   │   └── style.css          # All styles (dark/light theme)
│   └── js/
│       ├── translations.js    # 5-language text + FAQ knowledge base
│       ├── app.js             # Main chatbot logic
│       └── admin.js           # Admin panel logic
│
├── 📂 backend/                # Node.js + Express server
│   ├── server.js              # Main server file (START HERE)
│   ├── package.json           # Dependencies list
│   ├── .env.example           # Environment variables template
│   ├── models/
│   │   ├── FAQ.js             # FAQ database schema
│   │   ├── Log.js             # Chat log schema
│   │   └── Feedback.js        # Feedback schema
│   └── routes/
│       ├── chat.js            # POST /api/chat, POST /api/log
│       ├── faqs.js            # CRUD for FAQs
│       ├── logs.js            # GET chat logs
│       └── feedback.js        # GET/POST feedback
│
├── 📂 database/
│   └── seeds/
│       └── seedData.js        # Pre-populate MongoDB with sample FAQs
│
├── .gitignore                 # Files to exclude from GitHub
└── README.md                  # This file!
```

---

## 🚀 Setup Instructions (Step by Step for Beginners)

### Prerequisites (Install these first)
1. **Node.js** (v16+): https://nodejs.org → Download LTS version
2. **MongoDB**: Choose ONE:
   - **Local**: https://www.mongodb.com/try/download/community
   - **Cloud (easier)**: https://www.mongodb.com/cloud/atlas (free tier)
3. **VS Code**: https://code.visualstudio.com (recommended editor)

---

### Step 1: Download / Clone the Project

```bash
# If you have git installed:
git clone https://github.com/yourusername/campus-chatbot.git
cd campus-chatbot

# OR just download the ZIP and extract it
```

---

### Step 2: Set Up the Backend

```bash
# Go into the backend folder
cd backend

# Install all required packages (this reads package.json)
npm install

# You should see a node_modules folder appear!
```

---

### Step 3: Configure Environment Variables

```bash
# Copy the example file to create your .env file
cp .env.example .env

# Now open .env in VS Code and set your MongoDB URL
# For local MongoDB: MONGO_URI=mongodb://localhost:27017/campusbot
# For Atlas: MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/campusbot
```

---

### Step 4: Start MongoDB (if using local)

```bash
# On Windows: start MongoDB service from Services panel
# OR run: mongod

# On Mac: brew services start mongodb-community
# On Linux: sudo systemctl start mongod
```

---

### Step 5: Start the Backend Server

```bash
# Inside the backend/ folder:
npm run dev    # Development mode (auto-restarts on changes)
# OR
npm start      # Production mode
```

You should see:
```
✅ MongoDB connected successfully!
✅ Seeded 8 FAQs into MongoDB
🚀 CampusBot server running at https://campus-bot-ml-2.onrender.com
```

---

### Step 6: Open the Frontend

```bash
# Option 1: Just open the file
# Double-click frontend/index.html in your file explorer

# Option 2: Use VS Code Live Server extension
# Right-click index.html → "Open with Live Server"

# Option 3: Simple HTTP server
cd frontend
npx serve .
# Then open http://localhost:3000
```

---

### Step 7: Test Everything!

Open your browser and go to:
- **Chatbot**: `frontend/index.html`
- **Admin Panel**: `frontend/admin.html`
- **API Health Check**: `https://campus-bot-ml-2.onrender.com`

---

## 🗄️ MongoDB Collections (Database Tables)

### 1. `faqs` Collection
```json
{
  "_id": "ObjectId",
  "keywords": ["fee", "payment", "deadline"],
  "intent": "fee_deadline",
  "category": "fees",
  "answers": {
    "en": "Fee is due on July 31...",
    "hi": "शुल्क की तारीख 31 जुलाई है...",
    "mr": "फी ची तारीख 31 जुलै आहे..."
  },
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### 2. `logs` Collection
```json
{
  "_id": "ObjectId",
  "userMessage": "When is the fee deadline?",
  "botReply": "Fee is due on July 31...",
  "lang": "en",
  "intent": "fee_deadline",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 3. `feedbacks` Collection
```json
{
  "_id": "ObjectId",
  "rating": 5,
  "comment": "Very helpful!",
  "messageId": "abc123",
  "lang": "en",
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |
| POST | `/api/chat` | Send message, get response |
| POST | `/api/log` | Log a conversation |
| GET | `/api/faqs` | Get all FAQs |
| POST | `/api/faqs` | Add a new FAQ |
| PUT | `/api/faqs/:id` | Update a FAQ |
| DELETE | `/api/faqs/:id` | Delete a FAQ |
| GET | `/api/logs` | Get chat history |
| GET | `/api/feedback` | Get all feedback |
| POST | `/api/feedback` | Submit feedback |
| GET | `/api/stats` | Dashboard statistics |

---

## 💬 Supported Topics

- 💰 **Fees** – Payment deadlines, modes, late fees
- 🎓 **Admissions** – Application process, documents, dates
- 📅 **Exams** – Schedule, admit cards, rules
- 🏠 **Hostel** – Rules, timings, charges
- 📚 **Library** – Timings, borrowing rules, e-library
- 💼 **Placements** – Stats, registration, companies
- 🏆 **Scholarships** – Merit, government, need-based
- 🗓 **Timetable** – Class schedule, portal link

---

## 🌐 Supported Languages

| Language | Code | Script |
|----------|------|--------|
| English | `en` | Latin |
| Hindi | `hi` | देवनागरी |
| Marathi | `mr` | मराठी |
| Tamil | `ta` | தமிழ் |
| Telugu | `te` | తెలుగు |

---

## 🔧 Customization Guide

### Add a New FAQ Topic:
1. Open `frontend/js/translations.js`
2. Add to `FAQ_DB` array with keywords and multilingual answers
3. Add the FAQ to MongoDB via Admin Panel or seed file

### Add a New Language:
1. Add translations to `TRANSLATIONS` object in `translations.js`
2. Add the language button in `index.html`
3. Add `answers.newLang` to FAQ entries

### Change College Name/Info:
1. Update answers in `FAQ_DB` in `translations.js`
2. Update contact info in `index.html` sidebar footer
3. Update seed data in `database/seeds/seedData.js`

---

## 🏆 Hackathon Presentation Tips

**What to highlight:**
- "Works offline with local FAQ matching"
- "5 Indian languages supported natively"
- "Full CRUD admin panel"
- "MongoDB integration with live logging"
- "Mobile-responsive, dark/light mode"

**Live demo flow:**
1. Open chatbot → ask in English
2. Switch to Hindi → ask same question
3. Show Admin Panel → add a new FAQ live
4. Show MongoDB collection in MongoDB Compass

---

## 📋 Resume Bullet Points

```
• Built a full-stack multilingual chatbot supporting 5 Indian languages 
  (English, Hindi, Marathi, Tamil, Telugu) using Node.js, Express, and MongoDB

• Implemented keyword-based NLP intent recognition system with 8+ intents 
  covering fees, admissions, exams, hostel, library, and placements

• Developed admin dashboard with FAQ CRUD operations, chat log viewer, 
  and user feedback analytics

• Integrated MongoDB with Mongoose ODM for storing FAQs, conversation logs, 
  and user feedback with automatic seeding
```

---

## 🛠️ Tech Stack Summary

```
Frontend:    HTML5, CSS3 (CSS Variables, Grid, Flexbox), Vanilla JavaScript
Backend:     Node.js v18+, Express.js v4
Database:    MongoDB, Mongoose ODM
Fonts:       Syne (display), DM Sans (body) from Google Fonts
Deploy:      Vercel (frontend), Railway/Render (backend), MongoDB Atlas (DB)
```

---

## 📞 Support

If chatbot can't answer: **helpdesk@college.edu** | **+91 12345 67890**

---

*Made with ❤️ for college students | Hackathon & Resume Ready*
=======
# campus_bot_ml
>>>>>>> 198390c5631f2617ce0e65e1a1c9d43572a8a0f8
