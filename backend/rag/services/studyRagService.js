// =============================================
// rag/services/studyRagService.js – Study Notes RAG
// =============================================
// Reuses your EXISTING askGemini/askGroq functions and their
// Gemini-first-then-Groq fallback pattern (same reasoning as before).
//
// NEW: conversation history support, same idea as ragService.js's
// formatHistory(). Two places use it:
//   1. RETRIEVAL — a short follow-up like "more detailed" is embedded
//      almost meaninglessly on its own, so the vector search would
//      match random unrelated chunks. We prepend the last user
//      question to the search query so retrieval stays on-topic.
//   2. THE PROMPT — same as ragService.js, gives Gemini/Groq the
//      recent back-and-forth so it understands what "it"/"more
//      detailed"/"the second one" refers to.

const { askGemini } = require("./geminiService");
const { askGroq } = require("./groqService");
const { getStudyVectorStore } = require("../config/studyVectorStore");

const NO_MATCH_MESSAGE =
    "I couldn't find this in your uploaded notes. Please check with your teacher if the material has been uploaded yet.";

// Same idea as ragService.js's MAX_HISTORY_MESSAGES — last 3 turns
// (6 messages) is enough for follow-ups without bloating the prompt.
const MAX_HISTORY_MESSAGES = 6;

function formatHistory(history = []) {
    if (!Array.isArray(history) || history.length === 0) return "";

    const recent = history.slice(-MAX_HISTORY_MESSAGES);

    const transcript = recent
        .map((turn) => {
            const speaker = turn.role === "user" ? "Student" : "Study Assistant";
            return `${speaker}: ${turn.text}`;
        })
        .join("\n");

    return `\nRecent conversation so far (for context on follow-up questions):\n${transcript}\n`;
}

// Builds the string actually sent to vector search. If the current
// message looks like a short follow-up, we fold in the last user
// question so retrieval doesn't go off-topic.
function buildSearchQuery(message, history = []) {
    if (!Array.isArray(history) || history.length === 0) return message;

    const lastUserTurn = [...history].reverse().find((t) => t.role === "user");
    if (!lastUserTurn) return message;

    // Only prepend for short/likely-follow-up messages — a full,
    // self-contained question doesn't need it and prepending could
    // dilute an already-specific search.
    const looksLikeFollowUp = message.trim().split(/\s+/).length <= 6;
    if (!looksLikeFollowUp) return message;

    return `${lastUserTurn.text} ${message}`;
}

/**
 * askStudyRAG(message, subject?, history?)
 * subject narrows the search to one subject (from the subject tabs).
 * history is an array of { role: 'user'|'bot', text: '...' } — same
 * shape your frontend already uses for the main chatbot.
 */
async function askStudyRAG(message, subject, history = []) {
    const vectorStore = getStudyVectorStore();
    const filter = subject ? { subject } : undefined;

    const searchQuery = buildSearchQuery(message, history);
    const results = await vectorStore.similaritySearch(searchQuery, 5, filter);

    if (!results.length) {
        return { reply: NO_MATCH_MESSAGE, matched: false, sources: [] };
    }

    const context = results
        .map((doc, i) => `[Source ${i + 1} — ${doc.metadata?.title || "Notes"}]\n${doc.pageContent}`)
        .join("\n\n");

    const historyBlock = formatHistory(history);

    const prompt = `You are a study assistant helping a student understand their course notes.
Answer using ONLY the context below. If the context doesn't fully answer the
question, say what's missing instead of guessing.
${historyBlock}
Use the recent conversation above ONLY to understand what the student is
referring to (e.g. "more detailed", "what about the second one"). Every
factual claim in your answer must still come from the Context below — do not
switch to a different topic than what the conversation was actually about.

Context:
${context}

Question: ${message}

Answer:`;

    let reply;

    try {
        console.log("🤖 Study RAG: Using Gemini...");
        reply = await askGemini(prompt);
        console.log("✅ Study RAG: Gemini Success");
    } catch (err) {
        console.log("❌ Study RAG: Gemini Failed —", err.message);

        try {
            console.log("🚀 Study RAG: Switching to Groq...");
            reply = await askGroq(prompt);
            console.log("✅ Study RAG: Groq Success");
        } catch (groqErr) {
            console.log("❌ Study RAG: Groq Failed —", groqErr.message);
            throw new Error("AI_PROVIDER_UNAVAILABLE");
        }
    }

    const sources = results.map((doc) => ({
        title: doc.metadata?.title,
        subject: doc.metadata?.subject,
    }));

    return { reply, matched: true, sources };
}

module.exports = { askStudyRAG, NO_MATCH_MESSAGE };