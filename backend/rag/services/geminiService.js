const model = require("../config/gemini");

async function askGemini(prompt) {

    const result = await model.generateContent(prompt);

    const response = await result.response;

    return response.text();

}

module.exports = {
    askGemini
};