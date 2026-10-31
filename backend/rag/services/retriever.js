require("dotenv").config();

const { getVectorStore } = require("../config/mongoVectorStore");
const { rerankDocuments } = require("./retrievalEnhancements");

async function retrieveDocuments(query, vector, limit = 5) {

    const vectorStore = getVectorStore();
    const started = Date.now();

    // Fetch a wider semantic set, then rerank with query-term coverage.
    const candidates = await vectorStore.similaritySearchVectorWithScore(vector, 12);
    const reranked = rerankDocuments(query, candidates, limit);
    console.log("[RAG]", JSON.stringify({ stage: "retrieval_rerank", status: "ok", candidates: reranked.candidates, selected: reranked.selected, durationMs: Date.now() - started }));

    return reranked.documents;
}

module.exports = {
    retrieveDocuments,
};
