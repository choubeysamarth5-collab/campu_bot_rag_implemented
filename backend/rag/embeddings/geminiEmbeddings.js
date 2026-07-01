const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");

const embeddings = new GoogleGenerativeAIEmbeddings({

    apiKey: process.env.GEMINI_API_KEY,

    model: "gemini-embedding-001"

});

module.exports = embeddings;