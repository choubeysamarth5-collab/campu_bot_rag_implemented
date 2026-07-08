require("dotenv").config();

const path = require("path");

const {
    loadDocuments,
    loadSingleDocument
} = require("../loaders/documentLoader");
const { chunkDocuments } = require("../chunking/textChunker");
const embeddings = require("../embeddings/geminiEmbeddings");

const { Chroma } = require("@langchain/community/vectorstores/chroma");

async function ingestDocuments(filePath = null) {

    console.log("📄 Loading documents...");

    const documents = filePath

    ? await loadSingleDocument(filePath)

    : await loadDocuments();

    console.log(`✅ Loaded ${documents.length} document(s)`);

    console.log("✂️ Chunking documents...");

    const chunks = await chunkDocuments(documents);

    console.log(`✅ Created ${chunks.length} chunk(s)`);

    console.log("🧠 Creating embeddings and storing in ChromaDB...");

    const vectorStore =
await Chroma.fromExistingCollection(
    embeddings,
    {
        collectionName: "campusbot-rag",
        url: "http://localhost:8000"
    }
);

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
        await vectorStore.delete({
            filter: { source: originalFileName }
        });
    } catch (err) {
        // Nothing to delete (first-time upload) or the collection
        // doesn't support this filter shape — safe to continue,
        // we'll just add the new chunks below either way.
        console.log("   (nothing to remove, or already empty)");
    }
}

await vectorStore.addDocuments(chunks);

    return vectorStore;
}

module.exports = {
    ingestDocuments
};