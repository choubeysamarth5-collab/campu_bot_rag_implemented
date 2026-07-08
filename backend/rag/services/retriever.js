require("dotenv").config();

const { Chroma } = require("@langchain/community/vectorstores/chroma");
const embeddings = require("../embeddings/geminiEmbeddings");

async function retrieveDocuments(query) {

    const vectorStore = await Chroma.fromExistingCollection(
        embeddings,
        {
            collectionName: "campusbot-rag",
            url: "http://localhost:8000",
        }
    );

    // TEMP DEBUG: print the full chunk text so we can inspect OCR
    // quality after the sharp preprocessing change. Remove once
    // satisfied with accuracy.
    const scoredDocs = await vectorStore.similaritySearchWithScore(query, 5);

    console.log("---- RAG DEBUG: full chunk content ----");
    scoredDocs.forEach(([doc, score], i) => {
        console.log(`\n[${i + 1}] score=${score}`);
        console.log(doc.pageContent);
    });
    console.log("---- END RAG DEBUG ----\n");

    const docs = scoredDocs.map(([doc]) => doc);

    return docs;
}

module.exports = {
    retrieveDocuments,
};