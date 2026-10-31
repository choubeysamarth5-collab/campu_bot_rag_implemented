const STOP_WORDS = new Set("about after again also and are because before being between but can could did does for from have how into its more most not of our should that the their them then there these they this those through what when where which while with would your explain tell please give show describe".split(" "));

function rewriteFollowUpQuery(question, history = []) {
    const cleanQuestion = String(question || "").trim();
    if (!Array.isArray(history) || !history.length) return { query: cleanQuestion, rewritten: false };
    const words = cleanQuestion.split(/\s+/);
    const hasReference = /\b(it|they|them|that|those|this|there|above|more|again|second|first|same|continue|explain)\b/i.test(cleanQuestion);
    if (words.length > 8 && !hasReference) return { query: cleanQuestion, rewritten: false };
    const previousQuestion = [...history].reverse().find(turn => turn.role === "user" && turn.text)?.text;
    if (!previousQuestion || previousQuestion.trim().toLowerCase() === cleanQuestion.toLowerCase()) {
        return { query: cleanQuestion, rewritten: false };
    }
    return { query: `${previousQuestion.trim().slice(0, 350)} — follow-up: ${cleanQuestion}`, rewritten: true };
}

function lexicalCoverage(query, text) {
    const terms = [...new Set(String(query || "").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])]
        .filter(term => !STOP_WORDS.has(term));
    if (!terms.length) return 0;
    const body = String(text || "").toLowerCase();
    return terms.reduce((count, term) => count + (body.includes(term) ? 1 : 0), 0) / terms.length;
}

function rerankDocuments(query, scoredDocuments, limit = 5) {
    const ranked = scoredDocuments.map(([doc, vectorScore], index) => {
        const lexicalScore = lexicalCoverage(query, doc.pageContent);
        const semanticScore = Math.max(0, Math.min(1, Number(vectorScore) || 0));
        return { doc, index, lexicalScore, semanticScore, score: semanticScore * 0.78 + lexicalScore * 0.22 };
    }).sort((a, b) => b.score - a.score || a.index - b.index);

    const seen = new Set();
    const selected = [];
    for (const item of ranked) {
        const normalized = String(item.doc.pageContent || "").toLowerCase().replace(/\s+/g, " ").trim();
        const fingerprint = normalized.slice(0, 320);
        if (!normalized || seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        selected.push(item.doc);
        if (selected.length >= limit) break;
    }
    return { documents: selected, candidates: scoredDocuments.length, selected: selected.length };
}

function buildGroundedContext(documents, maxChars = 12000) {
    const blocks = [];
    let remaining = maxChars;
    for (const [index, doc] of documents.entries()) {
        if (remaining <= 0) break;
        const text = String(doc.pageContent || "").trim().slice(0, Math.min(3500, remaining));
        if (!text) continue;
        const source = doc.metadata?.title || doc.metadata?.source || "Uploaded notes";
        const block = `[Source ${blocks.length + 1}: ${source}]\n${text}`;
        blocks.push(block);
        remaining -= block.length + 2;
    }
    return blocks.join("\n\n");
}

module.exports = { rewriteFollowUpQuery, rerankDocuments, buildGroundedContext };
