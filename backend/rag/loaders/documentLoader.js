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
async function loadSingleDocument(filePath) {

    const extension = path.extname(filePath).toLowerCase();

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
            throw new Error("Unsupported file type");

    }

    // Multer saves uploads with a timestamp prefix (e.g.
    // "1751533801234-time table.pdf") so two uploads of the same
    // file never collide on disk. That's great for storage, but bad
    // for identifying "this is the same document" later — every
    // re-upload would look like a brand new file. We strip that
    // prefix back off here so the metadata we store (and later use
    // to detect/replace older versions) uses the ORIGINAL filename.
    const originalFileName = path
        .basename(filePath)
        .replace(/^\d+-/, "");

    return [

        {

            fileName: originalFileName,

            content

        }

    ];

}

module.exports = {

    loadDocuments,

    loadSingleDocument

};