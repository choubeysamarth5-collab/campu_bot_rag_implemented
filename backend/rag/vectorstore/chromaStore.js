const { Chroma } = require("@langchain/community/vectorstores/chroma");

const embeddings = require("../embeddings/geminiEmbeddings");

module.exports = {
    Chroma,
    embeddings
};