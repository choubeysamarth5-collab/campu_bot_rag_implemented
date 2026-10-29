require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Priority order: pehla model pehle try hoga
const MODEL_NAMES = (
  process.env.GEMINI_MODELS ||
  "gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const models = MODEL_NAMES.map((name) => ({
  name,
  instance: genAI.getGenerativeModel({ model: name }),
}));

// Inhi errors pe agle model pe jaana hai (busy / quota / model band)
const RETRYABLE_STATUS = [404, 429, 500, 503, 504];

async function generateContent(...args) {
  let lastErr;

  for (const { name, instance } of models) {
    try {
      const result = await instance.generateContent(...args);
      console.log(`✅ Gemini model used: ${name}`);
      return result;
    } catch (err) {
      lastErr = err;
      const status = err.status;
      console.log(`⚠️ ${name} failed (${status || err.message}), trying next...`);

      // 403/400 jaise errors mein agla model bhi fail hoga, to turant roko
      if (status && !RETRYABLE_STATUS.includes(status)) throw err;
    }
  }

  throw lastErr; // sab Gemini models fail, ab tumhara existing Groq fallback chalega
}

module.exports = { generateContent };