require("dotenv").config();

const Groq = require("groq-sdk");
const { recordGroqHeaders } = require("../../utils/apiUsageTracker");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

async function askGroq(prompt) {

    // .withResponse() gives us both the parsed completion AND the
    // raw HTTP response (so we can read Groq's rate-limit headers)
    // in a single call — same request, no extra API cost.
    const { data: completion, response } = await groq.chat.completions
        .create({

            model: "llama-3.3-70b-versatile",

            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],

            temperature: 0.2,
        })
        .withResponse();

    // Record the latest rate-limit snapshot for the Developer Panel.
    recordGroqHeaders(response.headers);

    return completion.choices[0].message.content;
}

module.exports = {
    askGroq,
};