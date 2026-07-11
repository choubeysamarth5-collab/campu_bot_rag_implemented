require("dotenv").config();

const path = require("path");

const {
    loadDocuments,
    loadSingleDocument
} = require("../loaders/documentLoader");
const { chunkDocuments } = require("../chunking/textChunker");
const {
    getVectorStore,
    getVectorCollection,
} = require("../config/mongoVectorStore");

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

        try {
            console.log(`🗑️  Removing any existing chunks for "${originalFileName}"...`);

            // NOTE: @langchain/mongodb's vectorStore.delete({filter})
            // is documented as "delete by ids" and internally expects
            // an `ids` array — passing only a filter crashes with
            // "Cannot read properties of undefined (reading
            // 'reduce')". We bypass that buggy wrapper and delete
            // directly on the underlying MongoDB collection instead,
            // which works reliably.
            const collection = getVectorCollection();
            const result = await collection.deleteMany({ source: originalFileName });
            console.log(`   Removed ${result.deletedCount} old chunk(s).`);
        } catch (err) {
            // Log the REAL reason instead of hiding it — a silent
            // catch here is exactly how we ended up with duplicate
            // chunks piling up unnoticed, back when this used Chroma.
            console.log("   ⚠️  Delete failed (may just mean nothing existed yet):", err.message);
        }
    }

    await vectorStore.addDocuments(chunks);

    return vectorStore;
}

module.exports = {
    ingestDocuments
};