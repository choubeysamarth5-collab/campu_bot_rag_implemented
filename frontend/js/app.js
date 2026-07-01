// =============================================
// app.js – CampusBot Frontend Logic
// Step-by-step comments for beginners
// =============================================

// ── State: keeps track of everything ──
const state = {
  lang: 'en',          // current language
  theme: 'dark',       // current theme
  conversations: [],

  currentChatId: null,        // chat history
  lastBotMsgId: null,  // for feedback
  pendingRating: null, // star rating
};

// ── Backend API URL (change if deploying) ──
const API_BASE = 'https://campus-bot-ml-2.onrender.com/api';

// ── DOM Shortcuts ──
const $ = (id) => document.getElementById(id);
const chatMessages = $('chatMessages');
const userInput = $('userInput');
const sendBtn = $('sendBtn');
const topicList = $('topicList');
const chipsRow = $('chipsRow');
const feedbackModal = $('feedbackModal');
const themeToggle = $('themeToggle');
const historyList = $('historyList');
const clearHistoryBtn = $('clearHistoryBtn');

// ── Utility: Format time ──
function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Utility: Parse markdown-like bold (**text**) ──
function parseMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// ── Utility: Generate unique ID ──
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ──────────────────────────────────────────
// CREATE NEW CHAT
// Similar to ChatGPT "New Chat"
// ──────────────────────────────────────────



// ──────────────────────────────────────────
// GET CURRENT OPEN CHAT
// ──────────────────────────────────────────

function getCurrentChat() {

  return state.conversations.find(

    chat =>
      chat.id ===
      state.currentChatId
  );
}
// ──────────────────────────────────────────
//  RENDER FUNCTIONS
// ──────────────────────────────────────────

// Render the sidebar topics based on current language
function renderTopics() {
  const t = TRANSLATIONS[state.lang];
  const icons = ['💰', '🎓', '📅', '🏠', '📚', '💼', '🏆', '🗓'];
  const intents = ['fee_deadline', 'admission', 'exam_schedule', 'hostel', 'library', 'placement', 'scholarship', 'timetable'];

  topicList.innerHTML = t.topics.map((topic, i) => `
    <button class="topic-btn" data-intent="${intents[i]}" onclick="handleTopicClick('${intents[i]}')">
      ${topic}
    </button>
  `).join('');
}

// Render suggestion chips below chat
function renderChips() {
  const t = TRANSLATIONS[state.lang];
  chipsRow.innerHTML = t.chips.map(chip => `
    <button class="chip" onclick="handleChipClick('${chip}')">${chip}</button>
  `).join('');
}

// Append a message bubble to the chat window
function appendMessage(role, text, id = null) {
  const msgId = id || uid();
  const isBot = role === 'bot';
  const t = TRANSLATIONS[state.lang];

  const row = document.createElement('div');
  row.className = `msg-row ${role}`;
  row.id = `msg-${msgId}`;

  row.innerHTML = `
    <div class="msg-avatar">${isBot ? '🎓' : '👤'}</div>
    <div>
      <div class="bubble">${parseMarkdown(text)}</div>
      <div class="bubble-meta">
        <span>${getTime()}</span>
        ${isBot ? `<button class="feedback-btn" onclick="openFeedback('${msgId}')" title="Rate this answer">⭐</button>` : ''}
      </div>
    </div>
  `;

  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight; // auto-scroll

  // Save message inside CURRENT chat

  // Get active chat

  const currentChat =
    getCurrentChat();

  // Safety check

  if (!currentChat) {

    console.log(
      'No active chat found'
    );

    return msgId;
  }

  // Save message

  currentChat.messages.push({

    role,

    text,

    id: msgId,

    time: Date.now()
  });

  // Save chats locally

  saveChatHistory();

  return msgId;



}

// ──────────────────────────────────────────
// SHOW CURRENT CHAT
// ──────────────────────────────────────────

window.renderCurrentChat = function () {

  // Clear old messages
  chatMessages.innerHTML = '';

  // Get active chat
  const chat = getCurrentChat();

  // No chat
  if (!chat) return;

  // Render each message
  chat.messages.forEach(msg => {

    const isBot =
      msg.role === 'bot';

    const row =
      document.createElement('div');

    row.className =
      `msg-row ${msg.role}`;

    row.id =
      `msg-${msg.id}`;

    row.innerHTML = `

      <div class="msg-avatar">
        ${isBot ? '🎓' : '👤'}
      </div>

      <div>

        <div class="bubble">

          ${parseMarkdown(msg.text)}

        </div>

        <div class="bubble-meta">

          <span>${getTime()}</span>

        </div>

      </div>
    `;

    chatMessages.appendChild(row);
  });

  // Auto scroll
  chatMessages.scrollTop =
    chatMessages.scrollHeight;
};


// ──────────────────────────────────────────
// CREATE NEW CHAT
// ──────────────────────────────────────────

window.createNewChat = function () {

  // Create new conversation
  const newChat = {

    id: uid(),

    title: 'New Chat',

    messages: []
  };

  // Add at top
  state.conversations.unshift(
    newChat
  );

  // Set active
  state.currentChatId =
    newChat.id;

  // Refresh sidebar
  renderConversationList();

  // Open empty chat
  renderCurrentChat();

  // Save
  saveChatHistory();
};

// Show typing animation (3 bouncing dots)
function showTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  row.id = 'typing-indicator';
  row.innerHTML = `
    <div class="msg-avatar">🎓</div>
    <div class="bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
  const el = $('typing-indicator');
  if (el) el.remove();
}

// Show welcome message
function showWelcome() {
  const t = TRANSLATIONS[state.lang];
  appendMessage('bot', t.welcome);
}

// ──────────────────────────────────────────
//  NLP / INTENT MATCHING
// ──────────────────────────────────────────

// Simple keyword-based intent recognition
// Returns the best matching FAQ entry or null
function matchIntent(userText) {
  const lowerText = userText.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  FAQ_DB.forEach(faq => {
    let score = 0;
    faq.keywords.forEach(kw => {
      if (lowerText.includes(kw.toLowerCase())) {
        score++;
      }
    });
    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  });

  // Only return match if at least 1 keyword matched
  return bestScore > 0 ? bestMatch : null;
}

// Get the bot's response for a given user message
async function getBotResponse(userText) {
  // 1. Try to match from local FAQ_DB first (instant)
  const match = matchIntent(userText);

  if (match) {
    const lang = state.lang;
    // Return the answer in current language, fallback to English
    return match.answers[lang] || match.answers['en'];
  }

  // 2. If no local match, try backend API (with auth token)
  try {
    // Use CampusAuth.userFetch if available (adds Authorization header)
    const fetchFn = (typeof CampusAuth !== 'undefined')
      ? (url, opts) => CampusAuth.userFetch(url.replace(API_BASE, ''), opts)
      : fetch;

    const res = await fetchFn(`${API_BASE}/chat/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        lang: state.lang,
        // Send last messages from current chat

        history:
          getCurrentChat()?.messages.slice(-6) || [],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.reply;
    }
  } catch (err) {
    // Backend not available - use fallback
    console.log('Backend unavailable, using local fallback');
  }

  // 3. Fallback response
  return TRANSLATIONS[state.lang].fallback;
}

// ──────────────────────────────────────────
//  SEND MESSAGE FLOW
// ──────────────────────────────────────────

async function sendMessage(text) {
  const msg = (text || userInput.value).trim();
  if (!msg) return;

  // Clear input
  userInput.value = '';
  userInput.focus();

  // Disable send during processing
  sendBtn.disabled = true;

  // Show user message
  appendMessage('user', msg);

  // Automatically rename
  // "New Chat" using first message

  const currentChat =
    getCurrentChat();

  if (
    currentChat.title ===
    'New Chat'
  ) {

    currentChat.title =
      msg.substring(0, 30);

    renderConversationList();
  }

  // Hide chips after first message
  chipsRow.style.display = 'none';

  // Show typing...
  await new Promise(r => setTimeout(r, 300));
  showTyping();

  // Simulate thinking time (300-800ms) for natural feel
  const thinkTime = 400 + Math.random() * 400;
  await new Promise(r => setTimeout(r, thinkTime));

  hideTyping();

  // Get and show bot response
  const reply = await getBotResponse(msg);
  const msgId = appendMessage('bot', reply);
  state.lastBotMsgId = msgId;

  sendBtn.disabled = false;

  // Log to backend (fire-and-forget, don't block UI)
  logConversation(msg, reply);
}

// ──────────────────────────────────────────
//  TOPIC + CHIP CLICK HANDLERS
// ──────────────────────────────────────────

function handleTopicClick(intent) {
  // Find the FAQ for this intent and directly show the answer
  const faq = FAQ_DB.find(f => f.intent === intent);
  if (!faq) return;

  const questionMap = {
    fee_deadline: 'What are the fee payment deadlines?',
    admission: 'How do I apply for admission?',
    exam_schedule: 'When are the exams scheduled?',
    hostel: 'Tell me about the hostel.',
    library: 'What are the library timings?',
    placement: 'Tell me about placement opportunities.',
    scholarship: 'What scholarships are available?',
    timetable: 'Where can I find the class timetable?',
  };

  sendMessage(questionMap[intent] || intent);

  // Highlight active topic
  document.querySelectorAll('.topic-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-intent="${intent}"]`)?.classList.add('active');
}

function handleChipClick(chip) {
  sendMessage(chip);
}

// ──────────────────────────────────────────
//  FEEDBACK SYSTEM
// ──────────────────────────────────────────

function openFeedback(msgId) {
  state.lastBotMsgId = msgId;
  state.pendingRating = 0;
  // Reset stars
  document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
  $('feedbackText').value = '';
  feedbackModal.style.display = 'flex';
}

// Star rating logic
document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', () => {
    const val = parseInt(star.dataset.val);
    state.pendingRating = val;
    document.querySelectorAll('.star').forEach((s, i) => {
      s.classList.toggle('active', i < val);
    });
  });
});

$('submitFeedback').addEventListener('click', async () => {
  if (!state.pendingRating) {
    alert('Please select a star rating!');
    return;
  }
  try {
    await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: state.pendingRating,
        comment: $('feedbackText').value,
        messageId: state.lastBotMsgId,
        lang: state.lang,
      }),
    });
  } catch (e) { /* offline mode */ }

  feedbackModal.style.display = 'none';
  appendMessage('bot', `✅ Thank you for your ${state.pendingRating}⭐ rating!`);
});

$('closeFeedback').addEventListener('click', () => {
  feedbackModal.style.display = 'none';
});

// ──────────────────────────────────────────
//  LANGUAGE SWITCHING
// ──────────────────────────────────────────

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const newLang = btn.dataset.lang;
    if (newLang === state.lang) return;

    state.lang = newLang;

    // Update active button
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update placeholder
    userInput.placeholder = TRANSLATIONS[newLang].placeholder;

    // Re-render sidebar and chips
    renderTopics();
    chipsRow.style.display = 'flex';
    renderChips();

    // Send language-change greeting
    appendMessage('bot', TRANSLATIONS[newLang].welcome);
  });
});

// ──────────────────────────────────────────
//  THEME TOGGLE
// ──────────────────────────────────────────

themeToggle.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = state.theme;
  themeToggle.querySelector('.theme-icon').textContent = state.theme === 'dark' ? '☀️' : '🌙';
});

// ──────────────────────────────────────────
//  KEYBOARD: Send on Enter
// ──────────────────────────────────────────

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', () => sendMessage());

// ──────────────────────────────────────────
//  BACKEND LOGGING (non-blocking)
// ──────────────────────────────────────────
// ──────────────────────────────────────────
//  CHAT HISTORY STORAGE
// ──────────────────────────────────────────

// Save chat history for logged-in users
function saveChatHistory() {

  const user = (typeof CampusAuth !== 'undefined')
    ? CampusAuth.getUser()
    : null;

  // Only save if user is logged in
  if (!user) return;

  localStorage.setItem(
    `chat_history_${user.email}`,
    // Save ALL conversations

    JSON.stringify({

      conversations:
        state.conversations,

      currentChatId:
        state.currentChatId
    })
  );

  renderConversationList();

}

// Load previous chat history
function loadChatHistory() {

  const user = (typeof CampusAuth !== 'undefined')
    ? CampusAuth.getUser()
    : null;

  if (!user) return;

  const savedHistory = localStorage.getItem(
    `chat_history_${user.email}`
  );

  if (!savedHistory) return;

  try {

    // Parse saved conversations

    const savedData =
      JSON.parse(savedHistory);

    state.conversations =
      savedData.conversations || [];

    state.currentChatId =
      savedData.currentChatId || null;



    // Render current chat

    renderCurrentChat();

  } catch (err) {
    console.log('Failed to load history');
  }
}

function scrollToMessage(id) {

  const target =
    document.getElementById(id);

  if (!target) return;

  target.scrollIntoView({

    behavior: 'smooth',

    block: 'center'
  });

  target.style.transform =
    'scale(1.02)';

  setTimeout(() => {

    target.style.transform =
      'scale(1)';
  }, 300);
}
// ──────────────────────────────────────────
//  HISTORY SIDEBAR
// ──────────────────────────────────────────

// ──────────────────────────────────────────
// SIDEBAR CONVERSATION LIST
// ──────────────────────────────────────────

function renderConversationList() {

  if (!historyList) return;

  // No chats yet
  if (
    state.conversations.length === 0
  ) {

    historyList.innerHTML = `

      <p style="opacity:.7">

        No chats yet.

      </p>
    `;

    return;
  }

  // Render all chats
  historyList.innerHTML =

    state.conversations.map(chat => `

      <button
        class="history-item"
        onclick="openConversation('${chat.id}')"
      >

        ${chat.title}

      </button>

    `).join('');
}

// ──────────────────────────────────────────
// OPEN CONVERSATION
// Runs when user clicks sidebar chat
// ──────────────────────────────────────────

window.openConversation = function (id) {

  // Change current active chat
  state.currentChatId = id;

  // Render that chat's messages
  renderCurrentChat();

  // Re-render sidebar
  // (for active highlight later)
  renderConversationList();
}

// Clear history
if (clearHistoryBtn) {

  clearHistoryBtn.addEventListener('click', () => {

    const user = (typeof CampusAuth !== 'undefined')
      ? CampusAuth.getUser()
      : null;

    if (!user) return;

    localStorage.removeItem(
      `chat_history_${user.email}`
    );

    state.conversations = [];

    chatMessages.innerHTML = '';

    renderConversationList();

    showWelcome();
  });
}

async function logConversation(userMsg, botReply) {

  try {

    const fetchFn =
      (typeof CampusAuth !== 'undefined')

        ? (url, opts) =>
          CampusAuth.userFetch(
            url.replace(API_BASE, ''),
            opts
          )

        : fetch;

    await fetchFn(`${API_BASE}/chat/log`, {

      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({

        // NEW
        conversationId:
          state.currentChatId,

        userMessage:
          userMsg,

        botReply,

        lang: state.lang,

        timestamp:
          new Date().toISOString(),
      }),
    });

  } catch (e) {

    console.log('Log save failed');
  }
}

// ──────────────────────────────────────────
//  INIT: Run when page loads
// ──────────────────────────────────────────

function init() {

  renderTopics();
  renderChips();

  // Load previous chats
  loadChatHistory();

  // Render sidebar chats

  renderConversationList();

  // Show welcome only if no old chats
  // First app open

  if (
    state.conversations.length === 0
  ) {

    window.createNewChat();

    showWelcome();
  }

  userInput.focus();
}


// Start the app!
init();
// ================================
// MOBILE SIDEBAR TOGGLE
// ================================

const mobileMenuBtn =
  document.getElementById(
    'mobileMenuBtn'
  );

const sidebar =
  document.querySelector(
    '.sidebar'
  );

if (mobileMenuBtn && sidebar) {

  mobileMenuBtn.addEventListener(
    'click',
    () => {

      sidebar.classList.toggle(
        'active'
      );
    }
  );
}
// ================================
// LANGUAGE DROPDOWN
// ================================

const langCurrentBtn =
  document.getElementById(
    'langCurrentBtn'
  );

const langMenu =
  document.getElementById(
    'langMenu'
  );

if (
  langCurrentBtn &&
  langMenu
) {

  langCurrentBtn.addEventListener(
    'click',
    () => {

      langMenu.classList.toggle(
        'active'
      );
    }
  );

  document
    .querySelectorAll('.lang-btn')
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () => {

          langCurrentBtn.textContent =
            btn.textContent + ' ⌄';

          langMenu.classList.remove(
            'active'
          );
        }
      );
    });
}