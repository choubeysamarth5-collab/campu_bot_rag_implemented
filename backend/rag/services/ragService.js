require("dotenv").config();

const { retrieveDocuments } = require("./retriever");
const { askGroq } = require("./groqService");
const { askGemini } = require("./geminiService");
const { getProviderMode } = require("../../utils/aiProviderConfig");

// Maps the short language codes used by the frontend's language
// switcher to a full name Gemini can understand in plain English
// instructions.
const LANGUAGE_NAMES = {
    en: "English",
    hi: "Hindi",
    mr: "Marathi",
    ta: "Tamil",
    te: "Telugu",
};

// How many past messages (user + bot combined) to include as
// conversation context. 6 messages ≈ last 3 back-and-forth turns —
// enough for the AI to understand follow-up questions like "what
// about hostel 2?" without bloating the prompt with the entire
// conversation on every request.
const MAX_HISTORY_MESSAGES = 6;

// Turns the frontend's history array into a simple transcript the
// AI can read. Expected shape per entry: { role: 'user'|'bot',
// text: '...' } — matches what app.js already stores per message.
function formatHistory(history = []) {
    if (!Array.isArray(history) || history.length === 0) return "";

    const recent = history.slice(-MAX_HISTORY_MESSAGES);

    const transcript = recent
        .map(turn => {
            const speaker = turn.role === "user" ? "Student" : "CampusBot";
            return `${speaker}: ${turn.text}`;
        })
        .join("\n");

    return `\nRecent conversation so far (for context on follow-up questions):\n${transcript}\n`;
}

async function askRAG(question, lang = "en", history = []) {

    const docs = await retrieveDocuments(question);

    const context = docs.map(doc => doc.pageContent).join("\n\n");

    const languageName = LANGUAGE_NAMES[lang] || "English";
    const historyBlock = formatHistory(history);

    const prompt = `
You are CampusBot.

Answer using ONLY the context below. The context may come from OCR
(scanned images/tables), so spacing, line breaks, or occasional
misread characters can be imperfect — do your best to interpret it
rather than rejecting it for being messy. If you can reasonably infer
the answer from the context, answer directly and confidently.

Only reply with "I couldn't find this information in the uploaded
documents." if the context truly does not contain anything related
to the question — not merely because the formatting is imperfect.
${historyBlock}
Use the recent conversation above ONLY to understand what the student
is referring to (e.g. pronouns, follow-up questions like "what about
the second one?"). Do not treat earlier conversation turns as a
substitute for the Context section — every factual claim in your
answer must still come from the Context below.

IMPORTANT: Always reply in ${languageName}, regardless of what
language or script the question itself was written in. Do not switch
languages based on the wording of the question — always follow this
instruction.

Context:
${context}

Question:
${question}

Answer:
`;

    // Manual override from the Developer Panel — lets a superadmin
    // force one provider only (e.g. for testing, or if a provider is
    // down and they don't want to wait for the automatic fallback on
    // every single request).
    const mode = getProviderMode();

    if (mode === "gemini_only") {
        try {
            console.log("🤖 Using Gemini (manually forced)...");
            const answer = await askGemini(prompt);
            console.log("✅ Gemini Success");
            return answer;
        } catch (err) {
            console.log("❌ Gemini Failed (forced mode) — falling back to FAQ:", err.message);
            // Throwing here lets chat.js's existing try/catch around
            // askRAG() catch this and fall through to FAQ matching,
            // instead of us trying to answer directly.
            throw new Error("AI_PROVIDER_UNAVAILABLE");
        }
    }

    if (mode === "groq_only") {
        try {
            console.log("🚀 Using Groq (manually forced)...");
            const answer = await askGroq(prompt);
            console.log("✅ Groq Success");
            return answer;
        } catch (err) {
            console.log("❌ Groq Failed (forced mode) — falling back to FAQ:", err.message);
            throw new Error("AI_PROVIDER_UNAVAILABLE");
        }
    }

    // ===============================
    // mode === "auto" — Try Gemini First
    // ===============================

    try {

        console.log("🤖 Using Gemini...");

        const answer = await askGemini(prompt);

        console.log("✅ Gemini Success");

        return answer;

    } catch (err) {

        console.log("❌ Gemini Failed");

        console.log(err.message);

    }

    // ===============================
    // Try Groq
    // ===============================

    try {

        console.log("🚀 Switching to Groq...");

        const answer = await askGroq(prompt);

        console.log("✅ Groq Success");

        return answer;

    } catch (err) {

        console.log("❌ Groq Failed");

        console.log(err.message);

    }

    // ===============================
    // Both AI providers failed — fall through to FAQ matching in
    // chat.js instead of returning a raw context dump.
    // ===============================

    console.log("⚠️ Both providers failed — falling back to FAQ");

    throw new Error("AI_PROVIDER_UNAVAILABLE");
}

module.exports = {
    askRAG
};