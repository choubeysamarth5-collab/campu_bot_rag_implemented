const fs = require("fs");
const path = require("path");

const { parsePDF } = require("../parsers/pdfParser");
const { parseDOCX } = require("../parsers/docxParser");
const { parseTXT } = require("../parsers/txtParser");

const DOCUMENTS_PATH = path.join(__dirname, "../../documents");

async function loadDocuments() {

    const files = fs.readdirSync(DOCUMENTS_PATH);

    const documents = [];

    for (const file of files) {

        const filePath = path.join(DOCUMENTS_PATH, file);

        const extension = path.extname(file).toLowerCase();

        let content = "";

        switch (extension) {

            case ".pdf":
                content = await parsePDF(filePath);
                break;

            case ".docx":
                content = await parseDOCX(filePath);
                break;

            case ".txt":
                content = await parseTXT(filePath);
                break;

            default:
                console.log(`Skipping unsupported file: ${file}`);
                continue;
        }

        documents.push({

            fileName: file,

            content

        });

    }

    return documents;
}

module.exports = {

    loadDocuments

};