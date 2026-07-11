// =====================================================================
// utils/aiProviderConfig.js  –  Manual AI Provider Override
// ---------------------------------------------------------------------
// By default, the chatbot tries Groq first and automatically falls
// back to Gemini if Groq fails ("auto"). This module lets a
// superadmin manually force one provider only, from the Developer
// Panel — useful for testing, or if one provider is having issues
// and you want to skip straight past it instead of waiting for the
// automatic fallback on every request.
//
// NOTE: This is in-memory (resets to "auto" on server restart), same
// approach as utils/faqCache.js — simple and good enough for a
// single-instance deployment.
//
// HOW TO USE THIS IN YOUR AI SERVICE FILE (wherever the actual
// Groq → Gemini fallback call happens):
//
//   const { getProviderMode } = require("../../utils/aiProviderConfig");
//
//   async function askAI(question) {
//     const mode = getProviderMode();
//
//     if (mode === "gemini_only") {
//       return await askGemini(question);
//     }
//     if (mode === "groq_only") {
//       return await askGroq(question);   // let it throw if it fails
//     }
//     // mode === "auto" — existing try Groq, catch, fallback to
//     // Gemini logic goes here, unchanged.
//   }
// =====================================================================

const VALID_MODES = ["auto", "groq_only", "gemini_only"];

let currentMode = "auto";

function getProviderMode() {
    return currentMode;
}

function setProviderMode(mode) {
    if (!VALID_MODES.includes(mode)) {
        throw new Error(`Invalid provider mode: ${mode}. Must be one of ${VALID_MODES.join(", ")}`);
    }
    currentMode = mode;
    return currentMode;
}

module.exports = { getProviderMode, setProviderMode, VALID_MODES };