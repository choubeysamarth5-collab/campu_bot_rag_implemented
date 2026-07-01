const fs = require("fs");
const pdf = require("pdf-parse");

async function parsePDF(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);

        const result = await pdf(buffer);

        return result.text.trim();
    } catch (error) {
        console.error("PDF Parser Error:", error.message);
        throw error;
    }
}

module.exports = {
    parsePDF,
};