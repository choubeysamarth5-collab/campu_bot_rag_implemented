require("dotenv").config();

const { retrieveDocuments } = require("./retriever");
const model = require("../config/gemini");

async function askRAG(question) {

    const docs = await retrieveDocuments(question);

    const context = docs.map(doc => doc.pageContent).join("\n\n");

    const prompt = `
You are CampusBot.

Answer ONLY using the context below.

If the answer is not available in the context, reply:

"I couldn't find this information in the uploaded documents."

Context:
${context}

Question:
${question}

Answer:
`;

    const result = await model.generateContent(prompt);

    return result.response.text();
}

module.exports = {
    askRAG
};