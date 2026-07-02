require("dotenv").config();

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

await vectorStore.addDocuments(chunks);

    return vectorStore;
}

module.exports = {
    ingestDocuments
};