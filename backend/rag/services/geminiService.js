const model = require("../config/gemini");

async function askGemini(question) {
    try {

        const result = await model.generateContent(question);

        const response = await result.response;

        return response.text();

    } catch (error) {

        console.log("Gemini Error:", error.message);

        return "Sorry, AI service is unavailable.";

    }
}

module.exports = {
    askGemini
};