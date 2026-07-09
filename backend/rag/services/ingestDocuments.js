require("dotenv").config();

const path = require("path");

const {
    loadDocuments,
    loadSingleDocument
} = require("../loaders/documentLoader");
const { chunkDocuments } = require("../chunking/textChunker");
const { getVectorStore, deleteBySource } = require("../config/mongoVectorStore");

async function ingestDocuments(filePath = null) {

    console.log("📄 Loading documents...");

    const documents = filePath

    ? await loadSingleDocument(filePath)

    : await loadDocuments();

    console.log(`✅ Loaded ${documents.length} document(s)`);

    console.log("✂️ Chunking documents...");

    const chunks = await chunkDocuments(documents);

    console.log(`✅ Created ${chunks.length} chunk(s)`);

    console.log("🧠 Creating embeddings and storing in MongoDB Atlas Vector Search...");

    const vectorStore = getVectorStore();

    // If this is a re-upload of a file we've seen before (same
    // original filename), delete its old chunks first. Otherwise
    // every re-upload just piles more (often lower-quality, from
    // earlier OCR attempts) chunks on top of the old ones, and the
    // AI ends up mixing outdated/garbled text in with the good stuff.
   if (filePath) {
    const originalFileName = path
        .basename(filePath)
        .replace(/^\d+-/, "");

    console.log(`🗑️  Removing any existing chunks for "${originalFileName}"...`);
    
    // New clean delete function use karo
    await deleteBySource(originalFileName);
}

    await vectorStore.addDocuments(chunks);

    return vectorStore;
}

module.exports = {
    ingestDocuments
};