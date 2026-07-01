const express = require("express");

const router = express.Router();

const { askGemini } = require("../rag/services/geminiService");

router.post("/", async (req, res) => {

    try {

        const { message } = req.body;

        if (!message) {

            return res.status(400).json({
                success: false,
                message: "Message is required"
            });

        }

        const answer = await askGemini(message);

        res.json({
            success: true,
            reply: answer
        });

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});

module.exports = router;