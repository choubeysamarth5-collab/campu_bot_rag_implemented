const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");

const splitter = new RecursiveCharacterTextSplitter({

    chunkSize:1000,

    chunkOverlap:200

});

async function chunkDocuments(documents) {

    const chunks = await splitter.createDocuments(
        documents.map(doc => doc.content),
        documents.map(doc => ({
            source: doc.fileName
        }))
    );

    return chunks;
}

module.exports = {

    chunkDocuments

};