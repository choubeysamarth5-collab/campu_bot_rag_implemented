// =============================================
// rag/services/studyVisualizationService.js – Visual Learning Diagram Generation
// =============================================
// Reuses the EXISTING askGemini/askGroq functions and the same
// Gemini-first-then-Groq fallback pattern as studyRagService.js.
//
// IMPORTANT: this is called ONLY at PDF export time (never during
// normal chat) — see generateVisualizations() in study.html. Normal
// chatting stays exactly as fast as it is today; no extra AI call
// happens per message.

const { askGemini } = require("./geminiService");
const { askGroq } = require("./groqService");

// Same idea as studyRagService.js's MAX_HISTORY_MESSAGES.
const MAX_HISTORY_MESSAGES = 6;

function formatHistoryForPrompt(history = []) {
    if (!Array.isArray(history) || history.length === 0) return "";

    const recent = history.slice(-MAX_HISTORY_MESSAGES);

    return recent
        .map((turn) => {
            const speaker = turn.role === "user" ? "Student" : "Study Assistant";
            return `${speaker}: ${turn.text}`;
        })
        .join("\n");
}

// Pulls the JSON object out of a model response even if it wrapped
// it in ```json fences or added a stray sentence before/after it.
function extractJson(raw) {
    if (!raw) return null;

    let text = String(raw).trim();

    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
        text = fenceMatch[1].trim();
    }

    const braceStart = text.indexOf("{");
    const braceEnd = text.lastIndexOf("}");

    if (braceStart === -1 || braceEnd === -1 || braceEnd < braceStart) {
        return null;
    }

    text = text.slice(braceStart, braceEnd + 1);

    try {
        return JSON.parse(text);
    } catch (err) {
        return null;
    }
}

// Keeps only correctly-shaped visualizations, so a slightly-off
// model response can never reach the frontend renderer broken.
function sanitizeVisualizations(rawVisualizations) {
    if (!Array.isArray(rawVisualizations)) return [];

    const ALLOWED_TYPES = [
        "flowchart",
        "process",
        "architecture",
        "hierarchy",
        "decision_tree",
        "concept_map",
        "comparison",
    ];

    return rawVisualizations
        .filter((viz) => viz && typeof viz === "object")
        .map((viz) => {
            const type = ALLOWED_TYPES.includes(viz.type) ? viz.type : "flowchart";

            const base = {
                type,
                title: typeof viz.title === "string" ? viz.title : "",
                description: typeof viz.description === "string" ? viz.description : "",
                remember: typeof viz.remember === "string" ? viz.remember : "",
            };

            if (type === "comparison") {
                return {
                    ...base,
                    columns: Array.isArray(viz.columns) ? viz.columns.map(String) : [],
                    rows: Array.isArray(viz.rows)
                        ? viz.rows.map((row) => (Array.isArray(row) ? row.map(String) : []))
                        : [],
                };
            }

            return {
                ...base,
                nodes: Array.isArray(viz.nodes)
                    ? viz.nodes
                          .filter((n) => n && n.id && n.label)
                          .map((n) => ({ id: String(n.id), label: String(n.label) }))
                    : [],
                edges: Array.isArray(viz.edges)
                    ? viz.edges
                          .filter((e) => e && e.from && e.to)
                          .map((e) => ({
                              from: String(e.from),
                              to: String(e.to),
                              ...(e.label ? { label: String(e.label) } : {}),
                          }))
                    : [],
            };
        })
        .filter((viz) => {
            if (viz.type === "comparison") {
                return viz.columns.length > 0 && viz.rows.length > 0;
            }
            return viz.nodes.length > 0;
        })
        .slice(0, 4); // keeps the PDF from getting overcrowded
}

/**
 * generateStudyVisualizations(subject?, history)
 * history is the conversation snapshot from the frontend at export
 * time — same { role, text } shape used everywhere else in Study.
 *
 * Returns { visualizations: [...] } — an empty array if nothing in
 * the conversation genuinely benefits from a diagram, or if the
 * model output couldn't be parsed. Only THROWS if both Gemini and
 * Groq are down (same as askStudyRAG) — a bad/empty model response
 * is NOT treated as a provider failure, it just means "no visuals
 * this time".
 */
async function generateStudyVisualizations(subject, history = []) {
    const transcript = formatHistoryForPrompt(history);

    if (!transcript) {
        return { visualizations: [] };
    }

    const prompt = `You are generating STRUCTURED VISUAL DIAGRAMS to help a student revise, based on a study conversation${
        subject ? ` about "${subject}"` : ""
    }.

Conversation:
${transcript}

Decide which concepts (if any) from this conversation genuinely benefit
from a visual diagram. Do NOT force a diagram for every concept — most
simple factual answers do NOT need one. Only include a diagram when it
would clearly help a student understand or remember something: a
process, a flow, an architecture, a hierarchy, a decision path, or a
comparison between things.

Respond with ONLY a JSON object in exactly this shape, nothing else —
no markdown fences, no explanation before or after:

{
  "visualizations": [
    {
      "type": "flowchart" | "process" | "architecture" | "hierarchy" | "decision_tree" | "concept_map" | "comparison",
      "title": "short title",
      "description": "one short sentence explaining the diagram",
      "remember": "one short exam-tip / key point to remember",
      "nodes": [ { "id": "short_id", "label": "Short Label" } ],
      "edges": [ { "from": "short_id", "to": "short_id" } ]
    }
  ]
}

For the "comparison" type ONLY, use "columns" and "rows" instead of "nodes"/"edges":
{
  "type": "comparison",
  "title": "...",
  "description": "...",
  "remember": "...",
  "columns": ["Column A", "Column B"],
  "rows": [["value", "value"], ["value", "value"]]
}

Rules:
- Maximum 3 diagrams. Usually 0-1 is correct — only add more if the
  conversation genuinely covered multiple distinct diagrammable concepts.
- Keep node labels SHORT (2-4 words) — they render inside small boxes.
- If nothing in the conversation benefits from a diagram, respond with
  exactly: {"visualizations": []}
- Output MUST be valid JSON and nothing else.`;

    let raw;

    try {
        console.log("🎨 Study Visualize: Using Gemini...");
        raw = await askGemini(prompt);
        console.log("✅ Study Visualize: Gemini Success");
    } catch (err) {
        console.log("❌ Study Visualize: Gemini Failed —", err.message);

        try {
            console.log("🚀 Study Visualize: Switching to Groq...");
            raw = await askGroq(prompt);
            console.log("✅ Study Visualize: Groq Success");
        } catch (groqErr) {
            console.log("❌ Study Visualize: Groq Failed —", groqErr.message);
            throw new Error("AI_PROVIDER_UNAVAILABLE");
        }
    }

    const parsed = extractJson(raw);

    if (!parsed) {
        console.log(
            "⚠️ Study Visualize: Could not parse JSON from model output — returning no visuals."
        );
        return { visualizations: [] };
    }

    return { visualizations: sanitizeVisualizations(parsed.visualizations) };
}

module.exports = { generateStudyVisualizations };