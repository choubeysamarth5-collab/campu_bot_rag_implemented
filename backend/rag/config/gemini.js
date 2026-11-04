require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Priority order: pehla model pehle try hoga
const MODEL_NAMES = (
  process.env.GEMINI_MODELS ||
  "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.8-flash,gemini-3.7-flash,"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const models = MODEL_NAMES.map((name) => ({
  name,
  instance: genAI.getGenerativeModel(
    { model: name },
    { timeout: Number(process.env.GEMINI_REQUEST_TIMEOUT_MS) || 12_000 }
  ),
}));

// Inhi errors pe agle model pe jaana hai (busy / quota / model band)
const RETRYABLE_STATUS = [404, 429, 500, 503, 504];
const CIRCUIT_COOLDOWN_MS = 30 * 1000;
let circuitOpenUntil = 0;

async function generateContent(...args) {
  if (Date.now() < circuitOpenUntil) {
    const retryInSeconds = Math.ceil((circuitOpenUntil - Date.now()) / 1000);
    console.log(`[LLM] Gemini circuit open; skipping Gemini for ${retryInSeconds}s.`);
    const error = new Error(`GEMINI_CIRCUIT_OPEN: retry in ${retryInSeconds}s`);
    error.status = 503;
    throw error;
  }

  let lastErr;

  for (const { name, instance } of models) {
    const attemptStartedAt = Date.now();
    try {
      const result = await instance.generateContent(...args);
      circuitOpenUntil = 0;
      console.log(`✅ Gemini model used: ${name} (${Date.now() - attemptStartedAt}ms)`);
      return result;
    } catch (err) {
      lastErr = err;
      const status = err.status;
      console.log(`⚠️ ${name} failed after ${Date.now() - attemptStartedAt}ms (${status || err.message}), trying next...`);

      // A provider-wide overload/timeout will not improve by trying more
      // Gemini model IDs. Hand off immediately to the independent provider.
      if (status === 500 || status === 503 || status === 504 || err.name === "AbortError") {
        circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
        console.error("[LLM] Gemini is overloaded/timed out; skipping remaining Gemini models and handing request to Groq.");
        throw err;
      }

      // 403/400 jaise errors mein agla model bhi fail hoga, to turant roko
      if (status && !RETRYABLE_STATUS.includes(status)) {
        if (status === 401 || status === 403) {
          circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
          console.error("[LLM] Gemini credentials/permission failed; opening circuit and handing request to Groq.");
        }
        throw err;
      }
    }
  }

  circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  console.error("[LLM] Gemini circuit opened after all configured models failed; handing request to Groq.");
  throw lastErr; // existing callers route to Groq or the FAQ fallback
}

module.exports = { generateContent };
