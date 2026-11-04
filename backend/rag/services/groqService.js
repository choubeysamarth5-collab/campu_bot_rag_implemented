require("dotenv").config();

const Groq = require("groq-sdk");
const { recordGroqHeaders } = require("../../utils/apiUsageTracker");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    timeout: 25_000,
    maxRetries: 1,
});

const GROQ_MODELS = (process.env.GROQ_MODELS || "openai/gpt-oss-120b,openai/gpt-oss-20b,qwen/qwen3.8-27b")
    .split(",")
    .map(model => model.trim())
    .filter(Boolean);

async function askGroq(prompt) {
    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing; configure it in the deployment environment.");
    }

    let lastError;
    for (const model of GROQ_MODELS) {
        try {
            console.log(`[LLM] Trying Groq model ${model}...`);
            // SDK retries transient connection/429/5xx errors once, then
            // the next configured model is attempted.
            const { data: completion, response } = await groq.chat.completions
                .create({
                    model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.2,
                }, { maxRetries: 1, timeout: 25_000 })
                .withResponse();

            recordGroqHeaders(response.headers);
            console.log(`[LLM] Groq model ${model} succeeded.`);
            return completion.choices[0].message.content;
        } catch (error) {
            lastError = error;
            const status = error.status || error.statusCode || null;
            console.error(`[LLM] Groq model ${model} failed (${status || error.message}).`);
            // Credentials and account permissions affect every model; don't
            // spend more time retrying the same invalid setup.
            if (status === 401 || status === 403) break;
        }
    }

    throw lastError || new Error("No Groq fallback models are configured.");
}

module.exports = {
    askGroq,
};
