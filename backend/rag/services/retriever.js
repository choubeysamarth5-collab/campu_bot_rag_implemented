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

    const docs = await vectorStore.similaritySearch(query, 3);

    return docs;
}

module.exports = {
    retrieveDocuments,
};