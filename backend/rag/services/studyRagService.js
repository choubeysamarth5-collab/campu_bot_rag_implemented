// =============================================
// rag/services/studyRagService.js – Study Notes RAG
// =============================================
// Reuses your EXISTING askGemini/askGroq functions and their
// Gemini-first-then-Groq fallback pattern (same reasoning as before).
//
// Uses shared retrieval enhancements for contextual query rewriting,
// semantic caching, candidate reranking, and bounded source context.

const { askGemini } = require("./geminiService");
const { askGroq } = require("./groqService");
const { getStudyVectorStore } = require("../config/studyVectorStore");
const { embedQuery, findCachedAnswer, storeAnswer } = require("./semanticCache");
const { rewriteFollowUpQuery, rerankDocuments, buildGroundedContext } = require("./retrievalEnhancements");

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

/**
 * askStudyRAG(message, subject?, history?)
 * subject narrows the search to one subject (from the subject tabs).
 * history is an array of { role: 'user'|'bot', text: '...' } — same
 * shape your frontend already uses for the main chatbot.
 */
async function askStudyRAG(message, subject, history = []) {
    const vectorStore = getStudyVectorStore();
    const filter = subject ? { subject } : undefined;
    const rewrite = rewriteFollowUpQuery(message, history);
    console.log("[Study RAG]", JSON.stringify({ stage: "query_rewrite", status: rewrite.rewritten ? "REWRITTEN" : "UNCHANGED", followUp: rewrite.rewritten, subject: subject || "all" }));
    const queryVector = await embedQuery(rewrite.query);
    const cacheScope = `study:${subject || "all"}`;
    if (Array.isArray(history) && history.length) {
        console.log("[Study RAG]", JSON.stringify({ stage: "semantic_cache", status: "BYPASS", reason: "conversation_context" }));
    } else {
        const cached = findCachedAnswer(cacheScope, queryVector);
        if (cached) return cached;
    }

    const started = Date.now();
    const candidates = await vectorStore.similaritySearchVectorWithScore(queryVector, 12, filter);
    const reranked = rerankDocuments(rewrite.query, candidates, 5);
    const results = reranked.documents;
    console.log("[Study RAG]", JSON.stringify({ stage: "retrieval_rerank", status: "ok", candidates: reranked.candidates, selected: reranked.selected, durationMs: Date.now() - started }));

    if (!results.length) {
        console.log("[Study RAG]", JSON.stringify({ stage: "context_assembly", status: "EMPTY", chunks: 0, characters: 0 }));
        return { reply: NO_MATCH_MESSAGE, matched: false, sources: [] };
    }

    const context = buildGroundedContext(results);
    console.log("[Study RAG]", JSON.stringify({ stage: "context_assembly", status: context ? "READY" : "EMPTY", chunks: results.length, characters: context.length }));

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
        console.log("[Study RAG]", JSON.stringify({ stage: "answer_generation", provider: "gemini", status: "ok" }));
    } catch (err) {
        console.log("❌ Study RAG: Gemini Failed —", err.message);

        try {
            console.log("🚀 Study RAG: Switching to Groq...");
            reply = await askGroq(prompt);
            console.log("✅ Study RAG: Groq Success");
            console.log("[Study RAG]", JSON.stringify({ stage: "answer_generation", provider: "groq", status: "ok", fallback: true }));
        } catch (groqErr) {
            console.log("❌ Study RAG: Groq Failed —", groqErr.message);
            console.error("[Study RAG]", JSON.stringify({ stage: "answer_generation", status: "error", providers: ["gemini", "groq"] }));
            throw new Error("AI_PROVIDER_UNAVAILABLE");
        }
    }

    const sources = results.map((doc) => ({
        title: doc.metadata?.title,
        subject: doc.metadata?.subject,
    }));

    const result = { reply, matched: true, sources };
    if (!(Array.isArray(history) && history.length)) storeAnswer(cacheScope, queryVector, result);
    return result;
}

module.exports = { askStudyRAG, NO_MATCH_MESSAGE };
