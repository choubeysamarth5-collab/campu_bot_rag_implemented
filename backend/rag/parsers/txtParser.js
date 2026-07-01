const fs = require("fs");

async function parseTXT(filePath) {

    try {

        return fs.readFileSync(filePath, "utf8").trim();

    } catch (error) {

        console.error("TXT Parser Error:", error.message);

        throw error;
    }

}

module.exports = {

    parseTXT

};
