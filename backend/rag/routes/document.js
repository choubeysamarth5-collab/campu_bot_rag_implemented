const express = require("express");

const router = express.Router();

const { loadDocuments } = require("../loaders/documentLoader");

router.get("/", async (req, res) => {

    try {

        const docs = await loadDocuments();

        res.json({

            success: true,

            count: docs.length,

            documents: docs

        });

    } catch (err) {

        res.status(500).json({

            success: false,

            error: err.message

        });

    }

});

module.exports = router;