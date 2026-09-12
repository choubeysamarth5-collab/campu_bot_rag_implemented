// ============================================================
// CampusBot - Study Quiz Service
// backend/rag/services/studyQuizService.js
// ============================================================

const { askGemini } = require("./geminiService");
const { askGroq } = require("./groqService");

const MAX_HISTORY = 6;
const MAX_CONTEXT_LENGTH = 30000;
const MAX_QUESTIONS = 8;


// ============================================================
// Format Study Conversation
// ============================================================

function buildConversation(history = []) {
    if (!Array.isArray(history)) {
        return "";
    }

    return history
        .filter(item =>
            item &&
            typeof item.text === "string" &&
            item.text.trim()
        )
        .slice(-MAX_HISTORY)
        .map(item => {
            const role =
                item.role === "user"
                    ? "Student"
                    : "Study Assistant";

            return `${role}:\n${item.text
                .trim()
                .slice(0, 10000)}`;
        })
        .join("\n\n")
        .slice(0, MAX_CONTEXT_LENGTH);
}


// ============================================================
// Extract JSON
// ============================================================

function extractJSON(text) {
    if (!text) {
        return null;
    }

    let raw = String(text).trim();

    // Remove markdown fences
    raw = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    // Direct JSON
    try {
        return JSON.parse(raw);
    } catch (_) {}

    // Find object
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start !== -1 && end > start) {
        try {
            return JSON.parse(
                raw.slice(start, end + 1)
            );
        } catch (_) {}
    }

    // Find array
    const arrayStart = raw.indexOf("[");
    const arrayEnd = raw.lastIndexOf("]");

    if (
        arrayStart !== -1 &&
        arrayEnd > arrayStart
    ) {
        try {
            return {
                questions: JSON.parse(
                    raw.slice(
                        arrayStart,
                        arrayEnd + 1
                    )
                )
            };
        } catch (_) {}
    }

    return null;
}


// ============================================================
// Normalize Question
// ============================================================

function normalizeQuestion(question, index) {
    if (
        !question ||
        typeof question !== "object"
    ) {
        return null;
    }

    const text =
        String(
            question.question ||
            question.questionText ||
            question.prompt ||
            ""
        ).trim();

    if (!text) {
        return null;
    }

    let options =
        Array.isArray(question.options)
            ? question.options
                .map(option => {
                    if (
                        typeof option === "object"
                    ) {
                        return String(
                            option.label ||
                            option.text ||
                            option.value ||
                            ""
                        ).trim();
                    }

                    return String(
                        option || ""
                    ).trim();
                })
                .filter(Boolean)
            : [];

    // --------------------------------------------------------
    // Support both MCQ and True/False
    // --------------------------------------------------------

    const type =
        String(
            question.type || "mcq"
        ).toLowerCase();

    if (
        type === "true_false" ||
        type === "truefalse"
    ) {
        options = [
            "True",
            "False"
        ];
    }

    // MCQ must have 4 options
    if (
        type !== "true_false" &&
        options.length < 4
    ) {
        return null;
    }

    options =
        options.slice(
            0,
            type === "true_false"
                ? 2
                : 4
        );

    // --------------------------------------------------------
    // Resolve answer
    // --------------------------------------------------------

    let answer =
        question.answer ??
        question.correctAnswer ??
        question.correct;

    if (
        typeof answer === "string"
    ) {
        const normalized =
            answer
                .trim()
                .toUpperCase();

        // A/B/C/D
        const letterIndex =
            ["A", "B", "C", "D"]
                .indexOf(normalized);

        if (letterIndex !== -1) {
            answer = letterIndex;
        }

        // true / false
        else if (
            type === "true_false"
        ) {
            if (
                normalized === "TRUE"
            ) {
                answer = 0;
            } else if (
                normalized === "FALSE"
            ) {
                answer = 1;
            }
        }

        // numeric string
        else if (
            /^\d+$/.test(normalized)
        ) {
            answer =
                Number(normalized);

            // Convert 1-based answers
            if (
                answer >= 1 &&
                answer <= options.length
            ) {
                answer -= 1;
            }
        }
    }

    if (
        typeof answer !== "number" ||
        !Number.isInteger(answer) ||
        answer < 0 ||
        answer >= options.length
    ) {
        return null;
    }

    const explanation =
        String(
            question.explanation ||
            question.feedback ||
            ""
        )
        .trim();

    return {
        id:
            String(
                question.id ||
                `q${index + 1}`
            ),

        type:
            type === "true_false"
                ? "true_false"
                : "mcq",

        question: text,

        options,

        answer,

        explanation:
            explanation ||
            "Review the study material above to understand this answer.",

        difficulty:
            String(
                question.difficulty ||
                "medium"
            ).toLowerCase()
    };
}


// ============================================================
// Validate & Clean Quiz
// ============================================================

function cleanQuestions(data) {

    if (!data) {
        return [];
    }

    const rawQuestions =
        Array.isArray(data)
            ? data
            : data.questions ||
              data.quiz ||
              [];

    if (
        !Array.isArray(rawQuestions)
    ) {
        return [];
    }

    const questions =
        rawQuestions
            .map(normalizeQuestion)
            .filter(Boolean);

    // Remove duplicate questions
    const seen = new Set();

    return questions.filter(question => {

        const key =
            question.question
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim();

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    });
}


// ============================================================
// Prompt
// ============================================================

function buildPrompt(
    subject,
    conversation
) {

    return `
You are CampusBot's Study Quiz Generator.

Generate a high-quality academic quiz strictly from the study conversation supplied below.

SUBJECT:
${subject || "All Subjects"}

STUDY CONVERSATION:
${conversation}

IMPORTANT:

- Use ONLY information present in the study conversation.
- Do not introduce unrelated knowledge.
- Do not invent facts.
- Questions must test understanding.
- Avoid duplicate questions.
- Avoid ambiguous questions.
- Make every question self-contained.
- Make distractors plausible.
- Do not use "All of the above".
- Do not use "None of the above".
- Do not reveal the answer in the question.
- Questions should be useful for university exam preparation.

Generate 8 questions.

Use a mixture of:
- conceptual questions
- application/understanding questions
- important exam points
- advantages/disadvantages
- definitions and characteristics where supported

Each question must have exactly four options.

Exactly ONE option must be correct.

The answer field MUST be a zero-based index:
0 = first option
1 = second option
2 = third option
3 = fourth option

Return ONLY valid JSON.

No markdown.
No code fences.
No text before or after JSON.

Required format:

{
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question": "Question text",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "answer": 0,
      "explanation": "Explanation of why the answer is correct.",
      "difficulty": "easy"
    }
  ]
}
`;
}


// ============================================================
// Gemini Generation
// ============================================================

async function generateFromGemini(prompt) {

    console.log(
        "🤖 Study Quiz: Generating with Gemini..."
    );

    return await askGemini(prompt);
}


// ============================================================
// Groq Generation
// ============================================================

async function generateFromGroq(prompt) {

    console.log(
        "🚀 Study Quiz: Generating with Groq..."
    );

    return await askGroq(prompt);
}


// ============================================================
// Main Function
// ============================================================

async function generateStudyQuiz(
    subject,
    history
) {

    try {

        // ----------------------------------------------------
        // Validate conversation
        // ----------------------------------------------------

        if (
            !Array.isArray(history) ||
            history.length === 0
        ) {
            return {
                questions: []
            };
        }

        const conversation =
            buildConversation(history);

        if (!conversation) {
            return {
                questions: []
            };
        }

        const prompt =
            buildPrompt(
                subject,
                conversation
            );

        let questions = [];

        // ----------------------------------------------------
        // Gemini
        // ----------------------------------------------------

        try {

            const response =
                await generateFromGemini(
                    prompt
                );

            const parsed =
                extractJSON(response);

            questions =
                cleanQuestions(parsed);

            console.log(
                `📚 Gemini Quiz: ${questions.length} valid questions`
            );

        } catch (error) {

            console.error(
                "❌ Gemini Quiz Error:",
                error.message
            );
        }


        // ----------------------------------------------------
        // Groq fallback
        // ----------------------------------------------------

        if (
            questions.length === 0
        ) {

            try {

                const response =
                    await generateFromGroq(
                        prompt
                    );

                const parsed =
                    extractJSON(response);

                questions =
                    cleanQuestions(parsed);

                console.log(
                    `📚 Groq Quiz: ${questions.length} valid questions`
                );

            } catch (error) {

                console.error(
                    "❌ Groq Quiz Error:",
                    error.message
                );
            }
        }


        // ----------------------------------------------------
        // Final response
        // ----------------------------------------------------

        if (
            questions.length === 0
        ) {

            return {
                questions: []
            };
        }

        return {
            questions:
                questions.slice(
                    0,
                    MAX_QUESTIONS
                )
        };

    } catch (error) {

        console.error(
            "🔥 Study Quiz Service Error:",
            error
        );

        return {
            questions: []
        };
    }
}


// ============================================================
// Export
// ============================================================

module.exports = {
    generateStudyQuiz
};