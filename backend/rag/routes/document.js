// =====================================================================
// rag/routes/document.js  –  Document Manager API
// ---------------------------------------------------------------------
// Lists, previews, and deletes uploaded PDFs. Files now live in
// GridFS (MongoDB Atlas) instead of the local disk, so they survive
// server restarts on free hosting tiers (Render, etc.) where local
// disk storage is wiped periodically.
// =====================================================================

const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const { adminProtect } = require("../../middleware/adminAuth");
const { getVectorCollection } = require("../config/mongoVectorStore");
const { getBucket } = require("../config/gridfs");

// Reuse Mongoose's own bundled ObjectId (mongoose.mongo.ObjectId)
// instead of importing a separate top-level `mongodb` package —
// mixing the two causes a BSON version mismatch (see gridfs.js for
// the full explanation).
const { ObjectId } = mongoose.mongo;

// Multer prefixes saved files with a timestamp, e.g.
// "1751533801234-time table.pdf". This turns that back into the
// human-readable original name for display purposes.
function toOriginalName(savedFileName) {
    return savedFileName.replace(/^\d+-/, "");
}


// =====================================================================
// GET /api/rag/documents
// List every uploaded PDF stored in GridFS.
// =====================================================================
router.get("/", adminProtect, async (req, res) => {

    try {

        const bucket = getBucket();
        const files = await bucket.find({}).sort({ uploadDate: -1 }).toArray();

        const documents = files.map(file => ({
            savedName: file.filename,
            fileId: file._id.toString(),
            name: toOriginalName(file.filename),
            sizeKB: Math.round(file.length / 1024),
            uploadedAt: file.uploadDate,
        }));

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
// GET /api/rag/documents/view/:fileId
// Streams the raw PDF from GridFS so the browser can open/preview it.
// =====================================================================
router.get("/view/:fileId", adminProtect, async (req, res) => {

    try {

        const bucket = getBucket();

        const files = await bucket.find({ _id: new ObjectId(req.params.fileId) }).toArray();

        if (files.length === 0) {
            return res.status(404).json({
                success: false,
                message: "File not found.",
            });
        }

        const file = files[0];

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${toOriginalName(file.filename)}"`
        );

        bucket.openDownloadStream(file._id).pipe(res);

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message,
        });

    }

});


// =====================================================================
// DELETE /api/rag/documents/:fileId
// Removes the file from GridFS AND its chunks from the vector store,
// so it's fully gone — both from the file list and from future chat
// answers.
// =====================================================================
router.delete("/:fileId", adminProtect, async (req, res) => {

    try {

        const bucket = getBucket();

        const files = await bucket.find({ _id: new ObjectId(req.params.fileId) }).toArray();
        const originalName = files.length > 0 ? toOriginalName(files[0].filename) : null;

        // 1. Delete the file from GridFS.
        await bucket.delete(new ObjectId(req.params.fileId));

        // 2. Delete its chunks from the vector store so chat stops
        // citing it.
        let chunksRemoved = true;
        if (originalName) {
            try {
                const collection = getVectorCollection();
                await collection.deleteMany({ source: originalName });
            } catch (err) {
                chunksRemoved = false;
                console.log("   ⚠️  Vector store cleanup failed:", err.message);
            }
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