const express = require("express");
console.log("✅ Upload Route Loaded");
const router = express.Router();
const { adminProtect } = require("../../middleware/adminAuth");
const upload = require("../middleware/upload");
const { ingestDocuments } = require("../services/ingestDocuments");

router.post(
    "/upload",

    adminProtect,

    upload.single("pdf"),

    async (req, res) => {

        try {

            console.log("Uploaded File:", req.file.originalname);

            await ingestDocuments(req.file.path);

            res.json({
                success: true,
                message: "PDF uploaded and indexed successfully.",
                file: req.file.originalname
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                success: false,
                message: "Upload failed."
            });

        }

    }
);

module.exports = router;