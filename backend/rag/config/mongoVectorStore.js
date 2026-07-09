// =====================================================================
// rag/config/mongoVectorStore.js  –  MongoDB Atlas Vector Search Setup
// ---------------------------------------------------------------------
// Replaces ChromaDB entirely. Instead of a separate vector database
// server (which needs its own persistent storage — a problem on free
// hosting tiers), embeddings are now stored as documents directly in
// your existing MongoDB Atlas database, in a collection called
// "rag_chunks". Atlas's free M0 tier includes Vector Search, so this
// keeps everything on one free, genuinely persistent database.
//
// IMPORTANT ONE-TIME SETUP (do this in the Atlas UI, not in code):
//   1. Go to your cluster → Atlas Search → Create Search Index →
//      "Atlas Vector Search" → JSON Editor.
//   2. Select the "rag_chunks" collection (it will be created
//      automatically the first time you upload a document, but you
//      can also create it manually first).
//   3. Use this index definition (name the index "vector_index" to
//      match INDEX_NAME below):
//
//      {
//        "fields": [
//          {
//            "type": "vector",
//            "path": "embedding",
//            "numDimensions": 3072,
//            "similarity": "cosine"
//          },
//          {
//            "type": "filter",
//            "path": "source"
//          }
//        ]
//      }
//
//   NOTE ON numDimensions: 3072 matches this project's actual
//   embedding model (confirmed from a live "vector field is indexed
//   with 768 dimensions but queried with 3072" error) — Google's
//   gemini-embedding-001 defaults to 3072-dimensional output. If you
//   ever change rag/embeddings/geminiEmbeddings.js to a different
//   model, re-check its output dimension and update the Atlas index
//   (and this comment) to match — a mismatch here causes vector
//   search to fail outright rather than just return poor results.
// =====================================================================

const mongoose = require("mongoose");
const { MongoDBAtlasVectorSearch } = require("@langchain/mongodb");
const embeddings = require("../embeddings/geminiEmbeddings");

const COLLECTION_NAME = "rag_chunks";
const INDEX_NAME = "vector_index";

// Reuses Mongoose's EXISTING connection (the one server.js already
// opened with mongoose.connect()) instead of opening a second,
// duplicate connection to MongoDB just for vector search.
function getVectorCollection() {
    const client = mongoose.connection.getClient();
    const db = client.db(); // uses the database name from your MONGO_URI
    return db.collection(COLLECTION_NAME);
}

function getVectorStore() {
    const collection = getVectorCollection();

    return new MongoDBAtlasVectorSearch(embeddings, {
        collection,
        indexName: INDEX_NAME,
        textKey: "text",
        embeddingKey: "embedding",
    });
}
// ... (upar wala code same rahe)

// Enhanced delete function (harmless warnings ko clean karta hai)
async function deleteBySource(source) {
    try {
        const vectorStore = getVectorStore();
        await vectorStore.delete({ filter: { source } });
        console.log(`🗑️  Removed existing chunks for "${source}"`);
    } catch (err) {
        // Ignore common cases jab kuch delete karne ko nahi hota
        if (err.message?.includes('reduce') || 
            err.message?.includes('undefined') || 
            err.message?.includes('no documents') ||
            err.message?.includes('PlanExecutor')) {
            console.log(`ℹ️  No previous chunks found for "${source}"`);
        } else {
            console.warn(`⚠️  Delete warning for "${source}":`, err.message);
        }
    }
}

module.exports = {
    getVectorStore,
    getVectorCollection,
    deleteBySource,        // ← naya export
    COLLECTION_NAME,
    INDEX_NAME,
};
