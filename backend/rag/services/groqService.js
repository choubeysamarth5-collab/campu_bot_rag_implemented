require("dotenv").config();

const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

async function askGroq(prompt) {

    const completion =
        await groq.chat.completions.create({

            model: "llama-3.3-70b-versatile",

            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],

            temperature: 0.2,
        });

    return completion.choices[0].message.content;
}

module.exports = {
    askGroq,
};