// =====================================================================
// rag/routes/document.js  –  Document Manager API
// ---------------------------------------------------------------------
// Powers the admin panel's "Uploaded Documents" list: shows every PDF
// that's been uploaded for RAG, lets an admin open/view one, or
// delete one (which removes BOTH the file on disk AND its indexed
// chunks in ChromaDB, so it stops showing up in chat answers too).
//
// IMPORTANT: this file only lists files that actually live in the
// `uploads/` folder (where multer saves admin-uploaded PDFs) — it
// does NOT re-parse or OCR every file just to list them. The old
// version of this route called loadDocuments(), which re-ran OCR on
// every single PDF just to build a file list — extremely slow and
// completely unnecessary for a listing screen.
// =====================================================================

const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const { adminProtect } = require("../../middleware/adminAuth");
const { getVectorStore } = require("../config/mongoVectorStore");

// Same folder multer's upload.js saves into (rag/routes/../../uploads
// => backend/uploads).
const UPLOADS_PATH = path.join(__dirname, "../../uploads");

// Multer prefixes saved files with a timestamp, e.g.
// "1751533801234-time table.pdf". This turns that back into the
// human-readable original name for display purposes.
function toOriginalName(savedFileName) {
    return savedFileName.replace(/^\d+-/, "");
}


// =====================================================================
// GET /api/rag/documents
// List every uploaded PDF (fast — just reads folder + file stats,
// no parsing/OCR).
// =====================================================================
router.get("/", adminProtect, async (req, res) => {

    try {

        // Make sure the uploads folder exists so a fresh install
        // doesn't crash here with ENOENT.
        if (!fs.existsSync(UPLOADS_PATH)) {
            fs.mkdirSync(UPLOADS_PATH, { recursive: true });
        }

        const fileNames = fs
            .readdirSync(UPLOADS_PATH)
            .filter(name => name.toLowerCase().endsWith(".pdf"));

        const documents = fileNames.map(savedName => {
            const fullPath = path.join(UPLOADS_PATH, savedName);
            const stats = fs.statSync(fullPath);

            return {
                savedName,                          // needed for view/delete calls
                name: toOriginalName(savedName),     // shown to the admin
                sizeKB: Math.round(stats.size / 1024),
                uploadedAt: stats.birthtime,
            };
        });

        // Newest uploads first.
        documents.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        res.json({
            success: true,
            count: documents.length,
            documents,
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message,
        });

    }

});


// =====================================================================
// GET /api/rag/documents/view/:savedName
// Streams the raw PDF back so the browser can open/preview it.
// =====================================================================
router.get("/view/:savedName", adminProtect, async (req, res) => {

    try {

        // Guard against path traversal (e.g. "../../server.js") —
        // only allow plain filenames, never a path with slashes.
        const savedName = path.basename(req.params.savedName);
        const fullPath = path.join(UPLOADS_PATH, savedName);

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({
                success: false,
                message: "File not found.",
            });
        }

        res.setHeader("Content-Type", "application/pdf");
        // inline (not attachment) so it opens in a browser tab/preview
        // instead of forcing a download.
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${toOriginalName(savedName)}"`
        );

        fs.createReadStream(fullPath).pipe(res);

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message,
        });

    }

});


// =====================================================================
// DELETE /api/rag/documents/:savedName
// Removes the file from disk AND its chunks from ChromaDB, so it's
// fully gone — both from the file list and from future chat answers.
// =====================================================================
router.delete("/:savedName", adminProtect, async (req, res) => {

    try {

        const savedName = path.basename(req.params.savedName);
        const fullPath = path.join(UPLOADS_PATH, savedName);
        const originalName = toOriginalName(savedName);

        // 1. Delete the physical file (if it still exists).
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        // 2. Delete its chunks from MongoDB Atlas Vector Search so
        // chat stops citing it.
        let chunksRemoved = true;
        try {
            const vectorStore = getVectorStore();

            await vectorStore.delete({
                filter: { source: originalName },
            });

        } catch (err) {
            // Don't fail the whole request just because vector-store
            // cleanup had trouble — the file is already gone from
            // disk either way — but DO tell the admin so it isn't
            // silently swallowed like our earlier bug was.
            chunksRemoved = false;
            console.log("   ⚠️  Vector store cleanup failed:", err.message);
        }

        res.json({
            success: true,
            message: chunksRemoved
                ? "Document and its indexed data were deleted."
                : "File deleted, but there was a problem clearing it from the AI's index. It may still be cited until re-ingested.",
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message,
        });

    }

});


module.exports = router;