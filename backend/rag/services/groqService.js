require("dotenv").config();

const Groq = require("groq-sdk");
const { recordGroqHeaders } = require("../../utils/apiUsageTracker");
const REQUEST_TIMEOUT_MS = Number(process.env.GROQ_REQUEST_TIMEOUT_MS) || 12_000;
const TOTAL_FALLBACK_BUDGET_MS = Number(process.env.GROQ_FALLBACK_BUDGET_MS) || 24_000;
const GROQ_CIRCUIT_COOLDOWN_MS = 30 * 1000;
let circuitOpenUntil = 0;

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0,
});

const GROQ_MODELS = (process.env.GROQ_MODELS || "openai/gpt-oss-120b,openai/gpt-oss-20b,qwen/qwen3.8-27b")
    .split(",")
    .map(model => model.trim())
    .filter(Boolean);

async function askGroq(prompt) {
    if (Date.now() < circuitOpenUntil) {
        const retryInSeconds = Math.ceil((circuitOpenUntil - Date.now()) / 1000);
        console.log(`[LLM] Groq circuit open; skipping Groq for ${retryInSeconds}s.`);
        throw new Error(`GROQ_CIRCUIT_OPEN: retry in ${retryInSeconds}s`);
    }
    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing; configure it in the deployment environment.");
    }

    const startedAt = Date.now();
    let lastError;
    for (const model of GROQ_MODELS) {
        const remainingMs = TOTAL_FALLBACK_BUDGET_MS - (Date.now() - startedAt);
        if (remainingMs <= 0) {
            console.warn("[LLM] Groq fallback time budget exhausted.");
            break;
        }
        const attemptStartedAt = Date.now();
        try {
            console.log(`[LLM] Trying Groq model ${model}...`);
            // Keep a strict request budget so provider fallback cannot
            // leave the chat spinning for minutes.
            const { data: completion, response } = await groq.chat.completions
                .create({
                    model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.2,
                }, { maxRetries: 0, timeout: Math.min(REQUEST_TIMEOUT_MS, remainingMs) })
                .withResponse();

            recordGroqHeaders(response.headers);
            circuitOpenUntil = 0;
            console.log(`[LLM] Groq model ${model} succeeded in ${Date.now() - attemptStartedAt}ms.`);
            return completion.choices[0].message.content;
        } catch (error) {
            lastError = error;
            const status = error.status || error.statusCode || null;
            console.error(`[LLM] Groq model ${model} failed after ${Date.now() - attemptStartedAt}ms (${status || error.message}).`);
            // Credentials and account permissions affect every model; don't
            // spend more time retrying the same invalid setup.
            if (status === 401 || status === 403 || status === 500 || status === 502 || status === 503 || status === 504 || !status) {
                circuitOpenUntil = Date.now() + GROQ_CIRCUIT_COOLDOWN_MS;
                console.error("[LLM] Groq provider circuit opened; next requests will use the notes fallback sooner.");
                break;
            }
        }
    }

    throw lastError || new Error("No Groq fallback models are configured.");
}

module.exports = {
    askGroq,
};
