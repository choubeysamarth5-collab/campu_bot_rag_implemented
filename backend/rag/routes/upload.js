const express = require("express");
console.log("✅ Upload Route Loaded");

const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");

const router = express.Router();
const { adminProtect } = require("../../middleware/adminAuth");
const upload = require("../middleware/upload");
const { ingestDocuments } = require("../services/ingestDocuments");
const { getBucket } = require("../config/gridfs");

router.post(
    "/upload",

    adminProtect,

    upload.single("pdf"),

    async (req, res) => {

        // Give the saved file a timestamp-prefixed name (same
        // convention as before) so re-uploads of the same original
        // filename can still be told apart chronologically if needed.
        const savedName = `${Date.now()}-${req.file.originalname}`;

        // Parsing (pdf-parse / OCR via pdf-to-img) needs a real file
        // on disk to read from — so we write the in-memory buffer to
        // a TEMP file just for the duration of parsing, then delete
        // it immediately after. This temp file is short-lived (only
        // exists during this one request), so the ephemeral-disk
        // problem doesn't apply to it — the PERMANENT copy lives in
        // GridFS/MongoDB Atlas, saved in step 1 below.
        const tempFilePath = path.join(os.tmpdir(), savedName);

        try {

            console.log("Uploaded File:", req.file.originalname);

            // 1. Save the PDF permanently to GridFS (MongoDB Atlas) —
            // this survives server restarts, unlike local disk.
            const bucket = getBucket();
            await new Promise((resolve, reject) => {
                Readable.from(req.file.buffer)
                    .pipe(bucket.openUploadStream(savedName, {
                        metadata: { originalName: req.file.originalname },
                    }))
                    .on("finish", resolve)
                    .on("error", reject);
            });

            // 2. Write a temp copy to disk so the existing parser
            // (pdf-parse + OCR fallback, which need a file path) can
            // read it without any changes to that code.
            fs.writeFileSync(tempFilePath, req.file.buffer);

            // 3. Parse + chunk + embed, same as before. ingestDocuments
            // derives the original filename from tempFilePath's name
            // (stripping the timestamp prefix), so no changes needed
            // there.
            await ingestDocuments(tempFilePath);

            res.json({
                success: true,
                message: "PDF uploaded and indexed successfully.",
                file: req.file.originalname
            });

        } catch (err) {

            console.error(err);

            const isCorruptPdf =
                /invalid number|xref|FormatError|could not be read/i.test(err.message || "");

            res.status(500).json({
                success: false,
                message: isCorruptPdf
                    ? "This PDF appears to be corrupted or unreadable. Try re-exporting/re-scanning it and upload again."
                    : "Upload failed."
            });

        } finally {

            // Always clean up the temp file, success or failure —
            // it was only ever needed for parsing.
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

        }

    }
);

module.exports = router;