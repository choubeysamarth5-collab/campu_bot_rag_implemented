require("dotenv").config();

const { getVectorStore } = require("../config/mongoVectorStore");

async function retrieveDocuments(query) {

    const vectorStore = getVectorStore();

    // k=5 — a little more context helps the LLM piece together an
    // answer when OCR text is split awkwardly across chunks.
    const docs = await vectorStore.similaritySearch(query, 5);

    return docs;
}

module.exports = {
    retrieveDocuments,
};