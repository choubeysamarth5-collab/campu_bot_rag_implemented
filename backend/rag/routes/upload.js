const express = require("express");
console.log("✅ Upload Route Loaded");

const fs = require("fs");
const path = require("path");

const router = express.Router();
const { adminProtect } = require("../../middleware/adminAuth");
const upload = require("../middleware/upload");
const { ingestDocuments } = require("../services/ingestDocuments");

// Multer prefixes saved files with a timestamp (see
// rag/middleware/upload.js), e.g. "1751533801234-time table.pdf".
// This strips that prefix back off to get the original name back.
function toOriginalName(savedFileName) {
    return savedFileName.replace(/^\d+-/, "");
}

router.post(
    "/upload",

    adminProtect,

    upload.single("pdf"),

    async (req, res) => {

        try {

            console.log("Uploaded File:", req.file.originalname);

            await ingestDocuments(req.file.path);

            // ── REPLACE EXISTING DOCUMENT ────────────────────────
            // ingestDocuments() already replaces this file's OLD
            // chunks in ChromaDB (by original filename). But because
            // multer gives every upload a unique timestamped name on
            // disk, a re-upload of "Library.pdf" would otherwise
            // leave the PREVIOUS physical file sitting in uploads/
            // forever, showing up as a confusing duplicate in the
            // Document Manager. Here we clean up any other files in
            // the uploads folder that share this document's original
            // name, keeping only the one we just saved.
            const uploadsDir = path.dirname(req.file.path);
            const newSavedName = path.basename(req.file.path);
            const originalName = toOriginalName(newSavedName);

            const siblingFiles = fs.readdirSync(uploadsDir);

            for (const fileName of siblingFiles) {
                const isSameDocument =
                    fileName !== newSavedName &&
                    toOriginalName(fileName) === originalName;

                if (isSameDocument) {
                    console.log(`🗑️  Removing old duplicate file: ${fileName}`);
                    fs.unlinkSync(path.join(uploadsDir, fileName));
                }
            }

            res.json({
                success: true,
                message: "PDF uploaded and indexed successfully.",
                file: req.file.originalname
            });

        } catch (err) {

            console.error(err);

            // If parsing/embedding failed AFTER the file was already
            // saved to disk (multer succeeds first, ingestion runs
            // after), remove it — otherwise a FAILED upload still
            // shows up in the Document Manager looking like it
            // succeeded, even though it was never actually indexed.
            if (req.file && fs.existsSync(req.file.path)) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (cleanupErr) {
                    console.error("Cleanup failed:", cleanupErr.message);
                }
            }

            // pdfParser.js throws a clear, human-readable message
            // when a PDF is genuinely unreadable (both normal text
            // extraction AND the OCR fallback failed) — pass that
            // straight through. Anything else is an unexpected
            // server-side issue.
            res.status(500).json({
                success: false,
                message: err.message || "Upload failed."
            });

        }

    }
);

module.exports = router;