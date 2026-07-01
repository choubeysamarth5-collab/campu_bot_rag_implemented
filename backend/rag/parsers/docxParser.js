const mammoth = require("mammoth");

async function parseDOCX(filePath) {

    try {

        const result = await mammoth.extractRawText({

            path: filePath

        });

        return result.value.trim();

    } catch (error) {

        console.error("DOCX Parser Error:", error.message);

        throw error;
    }

}

module.exports = {

    parseDOCX

};