// =====================================================================
// rag/config/studyVectorStore.js  –  Study Notes Vector Store
// ---------------------------------------------------------------------
// Exact same pattern as rag/config/mongoVectorStore.js — reuses
// Mongoose's existing connection, same MongoDBAtlasVectorSearch setup,
// same embeddings module. ONLY difference: separate collection name,
// so FAQ chunks (rag_chunks) and Study Notes chunks (study_chunks)
// can never end up in the same vector search.
//
// ONE-TIME ATLAS SETUP (same as rag_chunks, different collection):
//   1. Atlas → your cluster → Atlas Search → Create Search Index →
//      "Atlas Vector Search" → JSON Editor.
//   2. Select the "study_chunks" collection.
//   3. Index definition (name it "study_vector_index" to match
//      INDEX_NAME below):
//
//      {
//        "fields": [
//          { "type": "vector", "path": "embedding", "numDimensions": 3072, "similarity": "cosine" },
//          { "type": "filter", "path": "subject" }
//        ]
//      }
//
//   NOTE: numDimensions is 3072 to match gemini-embedding-001, same
//   as your existing rag_chunks index — this MUST match or vector
//   search fails outright (same warning as in mongoVectorStore.js).
// =====================================================================

const mongoose = require("mongoose");
const { MongoDBAtlasVectorSearch } = require("@langchain/mongodb");
const embeddings = require("../embeddings/geminiEmbeddings"); // reused as-is, no changes

const COLLECTION_NAME = "study_chunks";
const INDEX_NAME = "study_vector_index";

function getStudyVectorCollection() {
    const client = mongoose.connection.getClient();
    const db = client.db();
    return db.collection(COLLECTION_NAME);
}

function getStudyVectorStore() {
    const collection = getStudyVectorCollection();

    return new MongoDBAtlasVectorSearch(embeddings, {
        collection,
        indexName: INDEX_NAME,
        textKey: "text",
        embeddingKey: "embedding",
    });
}

async function deleteByFileId(fileId) {
    try {
        const vectorStore = getStudyVectorStore();
        await vectorStore.delete({ filter: { fileId: String(fileId) } });
        console.log(`🗑️  Removed study chunks for fileId "${fileId}"`);
    } catch (err) {
        if (
            err.message?.includes("reduce") ||
            err.message?.includes("undefined") ||
            err.message?.includes("no documents") ||
            err.message?.includes("PlanExecutor")
        ) {
            console.log(`ℹ️  No previous study chunks found for fileId "${fileId}"`);
        } else {
            console.warn(`⚠️  Delete warning for fileId "${fileId}":`, err.message);
        }
    }
}

module.exports = {
    getStudyVectorStore,
    getStudyVectorCollection,
    deleteByFileId,
    COLLECTION_NAME,
    INDEX_NAME,
};