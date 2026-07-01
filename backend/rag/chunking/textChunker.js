const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");

const splitter = new RecursiveCharacterTextSplitter({

    chunkSize:1000,

    chunkOverlap:200

});

async function chunkDocuments(documents){

    const texts = documents.map(doc => doc.content);

    const chunks = await splitter.createDocuments(texts);

    return chunks;

}

module.exports = {

    chunkDocuments

};