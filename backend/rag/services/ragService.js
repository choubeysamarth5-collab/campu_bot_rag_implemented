require("dotenv").config();

const { retrieveDocuments } = require("./retriever");
const { askGroq } = require("./groqService");
const { askGemini } = require("./geminiService");
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

async function askRAG(question, lang = "en") {

    const docs = await retrieveDocuments(question);

    const context = docs.map(doc => doc.pageContent).join("\n\n");

    const languageName = LANGUAGE_NAMES[lang] || "English";

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

    // ===============================
// Try Groq First
// ===============================

try {

    console.log("🚀 Using Groq...");

    const answer = await askGroq(prompt);

    console.log("✅ Groq Success");

    return answer;

} catch (err) {

    console.log("❌ Groq Failed");

    console.log(err.message);

}

// ===============================
// Try Gemini
// ===============================

try {

    console.log("🤖 Switching to Gemini...");

    const answer = await askGemini(prompt);

    console.log("✅ Gemini Success");

    return answer;

} catch (err) {

    console.log("❌ Gemini Failed");

    console.log(err.message);

}

// ===============================
// Final Fallback
// ===============================

console.log("⚠️ Returning Retrieved Context");

return `AI service is temporarily unavailable.

Relevant information from uploaded documents:

${context}`;
}

module.exports = {
    askRAG
};