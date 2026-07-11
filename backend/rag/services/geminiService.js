const model = require("../config/gemini");
const { recordGeminiCall } = require("../../utils/apiUsageTracker");

async function askGemini(prompt) {

    const result = await model.generateContent(prompt);

    const response = await result.response;

    // Gemini's API doesn't expose remaining-quota headers like Groq
    // does, so this is the only way to track usage: count every call
    // we successfully make. Recorded AFTER success, so failed calls
    // (which don't consume a "successful response" but may still
    // count against quota depending on the failure type) aren't
    // silently miscounted as usage.
    recordGeminiCall();

    return response.text();

}

module.exports = {
    askGemini
};