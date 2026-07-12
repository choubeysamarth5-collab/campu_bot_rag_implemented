// =====================================================================
// utils/csvParser.js  –  Minimal CSV Parser
// ---------------------------------------------------------------------
// A small, dependency-free CSV parser used for FAQ bulk-training.
// Handles the two things that break naive `line.split(',')` parsing:
//   1. Commas INSIDE quoted fields  →  "hostel, mess, fee"
//   2. Escaped quotes inside quoted fields  →  "He said ""hi"""
// Returns an array of objects keyed by the header row.
// =====================================================================

function parseCsvLine(line) {
    const fields = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (insideQuotes) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    // Escaped quote ("") inside a quoted field -> a
                    // literal " character.
                    current += '"';
                    i++;
                } else {
                    insideQuotes = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                insideQuotes = true;
            } else if (char === ",") {
                fields.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }
    }

    fields.push(current.trim());
    return fields;
}

// Parses full CSV text into an array of row objects, using the first
// line as column headers. Blank lines are skipped.
function parseCsv(text) {
    const lines = text
        .split(/\r?\n/)
        .filter(line => line.trim().length > 0);

    if (lines.length === 0) return [];

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());

    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);

        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] !== undefined ? values[index] : "";
        });

        rows.push(row);
    }

    return rows;
}

module.exports = { parseCsv };
