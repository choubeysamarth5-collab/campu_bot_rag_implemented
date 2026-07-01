const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");

const embeddings = new GoogleGenerativeAIEmbeddings({

    apiKey: process.env.GEMINI_API_KEY,

    model: "text-embedding-004"

});

module.exports = embeddings;