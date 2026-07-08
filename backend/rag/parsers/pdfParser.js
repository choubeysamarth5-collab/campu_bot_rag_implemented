// =====================================================================
// rag/parsers/pdfParser.js
// ---------------------------------------------------------------------
// Extracts text from a PDF. Two strategies are used:
//
//   1. NORMAL TEXT EXTRACTION (fast, cheap)
//      Most PDFs (Word exports, "Print to PDF", etc.) store real,
//      selectable text. `pdf-parse` reads that directly.
//
//   2. OCR FALLBACK (slow, but works on scanned/image PDFs)
//      Some PDFs are just a photo/screenshot glued onto a page —
//      e.g. someone scans a printed timetable, or pastes a
//      screenshot of a table into a PDF. `pdf-parse` finds ZERO
//      real text in that case, because there IS no text — it's
//      pixels. So we detect that situation and instead:
//        a) render each PDF page to a PNG image
//        b) run Tesseract OCR on that image
//        c) use each recognized word's on-page position (x, y) to
//           rebuild rows and columns, so a timetable grid comes out
//           as readable rows instead of one jumbled line of words.
// =====================================================================

const fs = require("fs");
const pdf = require("pdf-parse");
const sharp = require("sharp");
const { createWorker, PSM } = require("tesseract.js");

// If normal extraction finds fewer than this many characters, we
// treat the PDF as "no real text" and fall back to OCR.
const MIN_TEXT_LENGTH = 40;

// Words whose vertical position differs by less than this many
// pixels are considered to be on the SAME row of a table.
// (Tune this up/down if rows are merging or splitting incorrectly.)
const ROW_TOLERANCE_PX = 12;


// =====================================================================
// MAIN ENTRY POINT — called by documentLoader.js, same as before.
// =====================================================================
async function parsePDF(filePath) {

    let text = "";

    // Try normal text extraction first. If pdf-parse CRASHES (some
    // malformed/corrupted PDFs make its internal parser throw,
    // rather than just returning little/no text), we no longer give
    // up immediately — we fall through to the OCR path below, since
    // rendering the page as an IMAGE is often more tolerant of a
    // broken content stream than text extraction is.
    try {
        const buffer = fs.readFileSync(filePath);
        const result = await pdf(buffer);
        text = result.text.trim();
    } catch (error) {
        console.log(`⚠️  Normal text extraction failed (${error.message}) — will try OCR instead...`);
        text = "";
    }

    if (text.length >= MIN_TEXT_LENGTH) {
        // Plenty of real text found — this is a normal PDF.
        return text;
    }

    // Almost no text found (or extraction crashed) -> try OCR.
    console.log("⚠️  Little/no selectable text found in PDF — running OCR instead...");

    try {
        return await ocrPDF(filePath);
    } catch (ocrError) {
        // Both text extraction AND OCR failed — this PDF is
        // genuinely unreadable (corrupted file, empty pages, etc.),
        // not something more retries or tuning can fix.
        console.error("OCR fallback also failed:", ocrError.message);
        throw new Error(
            "This PDF could not be read (it may be corrupted or empty). Try re-exporting/re-scanning it."
        );
    }
}


// =====================================================================
// OCR FALLBACK
// =====================================================================
async function ocrPDF(filePath) {

    // `pdf-to-img` is an ESM-only package, so from our CommonJS
    // (require-based) code we have to load it with a dynamic
    // import() instead of require().
    const { pdf: renderPdfToImages } = await import("pdf-to-img");

    // Create one Tesseract worker and reuse it for every page —
    // much faster than spinning up a new worker per page.
    const worker = await createWorker("eng");

    // PSM (Page Segmentation Mode) tells Tesseract HOW to read the
    // page layout. The default mode assumes fairly normal paragraphs
    // of text, which struggles on a busy multi-table grid like a
    // timetable. SPARSE_TEXT tells it to look for text anywhere on
    // the page as independent chunks (closer to how a table's cells
    // actually are), which noticeably helps recognize short, scattered
    // labels like "MONDAY" or "11:00 AM" that a paragraph-reading
    // mode tends to skip or merge incorrectly.
    await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });

    let fullText = "";

    try {
        // scale: 5 renders each page at very high resolution, which
        // helps a lot with small table text like day names/times.
        const document = await renderPdfToImages(filePath, { scale: 5 });

        let pageNumber = 1;

        for await (const imageBuffer of document) {

            console.log(`   🔍 OCR-ing page ${pageNumber}...`);

            // ── IMAGE PREPROCESSING ─────────────────────────────
            // Colorful headers/cells (like a timetable with orange,
            // yellow, and green row backgrounds) confuse OCR because
            // the engine has to tell text apart from a busy
            // background. We fix this in two steps:
            //   1. grayscale + normalize  -> flattens all those
            //      colors down to shades of gray and stretches
            //      contrast to use the full range.
            //   2. threshold(160)         -> BINARIZES the image:
            //      every pixel becomes either pure black or pure
            //      white. This completely removes background color
            //      as a factor and leaves crisp black text on a
            //      white page, which is exactly what Tesseract is
            //      best at reading.
            // (sharp ships prebuilt binaries — no extra system
            // dependency needed beyond `npm install sharp`.)
            const processedImage = await sharp(imageBuffer)
                .grayscale()
                .normalize()
                .threshold(160)
                .toBuffer();

            // IMPORTANT: Tesseract.js v5+ only returns plain `text`
            // by default — word-level positions (needed to rebuild
            // table rows/columns) must be explicitly requested via
            // the `blocks` output option, otherwise word data is
            // empty and we silently lose all table structure.
            const { data } = await worker.recognize(
                processedImage,
                {},
                { blocks: true, text: true }
            );

            const words = flattenWords(data.blocks);

            if (words.length > 0) {
                // We got word positions — rebuild the table layout.
                fullText += reconstructTableLayout(words) + "\n\n";
            } else {
                // Fallback: no block/word data available for some
                // reason — at least keep the plain recognized text
                // instead of losing the page entirely.
                fullText += (data.text || "") + "\n\n";
            }

            pageNumber++;
        }

    } finally {
        // Always shut the worker down, even if OCR throws partway
        // through, so we don't leak background processes.
        await worker.terminate();
    }

    return fullText.trim();
}


// =====================================================================
// FLATTEN TESSERACT'S "blocks" OUTPUT
// ---------------------------------------------------------------------
// When we ask Tesseract for `{ blocks: true }`, it gives back a
// NESTED structure instead of a flat word list:
//     blocks -> paragraphs -> lines -> words
// reconstructTableLayout() below just wants a simple flat array of
// words (each with .text and .bbox), so this walks the tree and
// collects every word into one array.
// =====================================================================
function flattenWords(blocks) {
    const words = [];

    if (!blocks) return words;

    for (const block of blocks) {
        for (const paragraph of block.paragraphs || []) {
            for (const line of paragraph.lines || []) {
                for (const word of line.words || []) {
                    words.push(word);
                }
            }
        }
    }

    return words;
}


// =====================================================================
// TABLE / TIMETABLE RECONSTRUCTION
// ---------------------------------------------------------------------
// Tesseract returns a flat list of recognized words, each with a
// bounding box: { x0, y0, x1, y1 } describing where on the page
// image that word sits (in pixels).
//
// A table/timetable is really just words arranged in aligned rows
// and columns. To rebuild that structure as text we:
//   1. Group words into rows using their Y position (top edge).
//   2. Within each row, sort words left-to-right by X position.
//   3. Join each row's words with wide spacing so columns stay
//      visually distinguishable, and join rows with newlines.
//
// Example: a timetable cell layout like
//     [Mon] [9-10 Maths] [10-11 Physics]
//     [Tue] [9-10 Chemistry] [10-11 Biology]
// comes out as:
//     Mon   9-10 Maths   10-11 Physics
//     Tue   9-10 Chemistry   10-11 Biology
// which the RAG chunker/embedder can read just like a normal table.
// =====================================================================
function reconstructTableLayout(words) {

    if (!words || words.length === 0) return "";

    // Row tolerance is calculated from the words' own height rather
    // than a fixed pixel number — this way it automatically adapts
    // whether the page was rendered at scale 1 or scale 3+, instead
    // of breaking on higher-resolution renders.
    const avgHeight =
        words.reduce((sum, w) => sum + (w.bbox.y1 - w.bbox.y0), 0) / words.length;
    const rowTolerance = Math.max(avgHeight * 0.6, ROW_TOLERANCE_PX);

    // Sort all words top-to-bottom first, so rows naturally come out
    // in reading order (top of page to bottom).
    const sortedByY = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0);

    const rows = [];

    for (const word of sortedByY) {
        const y = word.bbox.y0;

        // Find an existing row whose Y is close enough to this word.
        let row = rows.find(r => Math.abs(r.y - y) <= rowTolerance);

        if (!row) {
            row = { y, words: [] };
            rows.push(row);
        }

        row.words.push(word);
    }

    return rows
        .map(row => {
            const sortedWords = [...row.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);

            // Median word width helps us tell a normal "gap between
            // columns of the SAME table" apart from a much bigger
            // gap that really means "this is a separate table/block
            // sitting next to the first one" (very common in a
            // layout with two schedule tables side by side).
            const widths = sortedWords.map(w => w.bbox.x1 - w.bbox.x0);
            const medianWidth = widths.sort((a, b) => a - b)[Math.floor(widths.length / 2)] || 20;
            const bigGapThreshold = medianWidth * 6;

            let line = sortedWords[0]?.text || "";

            for (let i = 1; i < sortedWords.length; i++) {
                const gap = sortedWords[i].bbox.x0 - sortedWords[i - 1].bbox.x1;
                line += (gap > bigGapThreshold ? "  |  " : "   ") + sortedWords[i].text;
            }

            return line;
        })
        .join("\n");                                       // row break
}


module.exports = {
    parsePDF,
};