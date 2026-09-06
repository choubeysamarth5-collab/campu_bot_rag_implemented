// =============================================
// rag/routes/studyUpload.js – Teacher Notes Upload
// =============================================
// Auth: reuses your EXISTING adminProtect + requirePermission from
// middleware/adminAuth.js. No new role/model needed — a teacher is
// just an Admin account that has "studyNotes" in its permissions
// array. Grant that permission the same way you grant any other
// (e.g. 'faqs', 'logs') when creating/editing the admin.
//
// PDF parsing/chunking here is SELF-CONTAINED (uses @langchain
// community's PDFLoader + RecursiveCharacterTextSplitter) rather than
// reusing rag/parsers/pdfParser.js or rag/chunking/textChunker.js,
// since I don't have those files' exact exports. If you'd rather reuse
// your existing parser/chunker for consistency, swap the two marked
// sections below for calls into those modules — the calling code
// around them (GridFS + vector store) doesn't need to change.

const express = require("express");
const multer = require("multer");
const { Document } = require("@langchain/core/documents");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");

const { adminProtect, requirePermission } = require("../../middleware/adminAuth");
const { getStudyBucket } = require("../config/studyGridfs");
const { getStudyVectorStore, deleteByFileId } = require("../config/studyVectorStore");
const StudyNote = require("../../models/StudyNote");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ── POST /api/study/admin/upload ──
router.post(
    "/upload",
    adminProtect,
    requirePermission("studyNotes"),
    upload.single("file"),
    async (req, res) => {
        const { title, subject, semester } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }
        if (!title || !subject) {
            return res.status(400).json({ success: false, message: "title and subject are required" });
        }

        try {
            // 1. Store the original PDF bytes in GridFS (survives Render restarts).
            const bucket = getStudyBucket();
            const uploadStream = bucket.openUploadStream(req.file.originalname, {
                metadata: { title, subject, semester, uploadedBy: req.admin._id },
            });
            uploadStream.end(req.file.buffer);
            const fileId = uploadStream.id;

            // 2. Extract text from the PDF.
            // --- SWAP-ABLE SECTION: replace with rag/parsers/pdfParser.js if preferred ---
            const blob = new Blob([req.file.buffer], { type: "application/pdf" });
            const loader = new PDFLoader(blob);
            const rawDocs = await loader.load();
            const fullText = rawDocs.map((d) => d.pageContent).join("\n\n");
            // --- end swap-able section ---

            if (!fullText.trim()) {
                return res.status(422).json({ success: false, message: "Could not extract text from this PDF" });
            }

            // 3. Chunk the text.
            // --- SWAP-ABLE SECTION: replace with rag/chunking/textChunker.js if preferred ---
            const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 150 });
            const chunks = await splitter.splitText(fullText);
            // --- end swap-able section ---

            // 4. Embed + store chunks in the isolated study_chunks collection.
            const docs = chunks.map(
                (chunk) =>
                    new Document({
                        pageContent: chunk,
                        metadata: {
                            title,
                            subject,
                            semester: semester || null,
                            fileId: String(fileId),
                            source: req.file.originalname,
                        },
                    })
            );

            const vectorStore = getStudyVectorStore();
            await vectorStore.addDocuments(docs);

            // 5. Save metadata row for the admin panel list view.
            const note = await StudyNote.create({
                title,
                subject,
                semester,
                sourceFileName: req.file.originalname,
                fileId,
                chunkCount: docs.length,
                uploadedBy: req.admin._id,
            });

            res.json({ success: true, message: "Notes uploaded and indexed", note });
        } catch (err) {
            console.error("Study upload error:", err);
            res.status(500).json({ success: false, message: "Upload failed", error: err.message });
        }
    }
);

// ── GET /api/study/admin/notes ──
router.get("/notes", adminProtect, requirePermission("studyNotes"), async (req, res) => {
    try {
        const notes = await StudyNote.find().sort({ createdAt: -1 });
        res.json({ success: true, notes });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to list notes" });
    }
});

// ── DELETE /api/study/admin/notes/:id ──
router.delete("/notes/:id", adminProtect, requirePermission("studyNotes"), async (req, res) => {
    try {
        const note = await StudyNote.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ success: false, message: "Note not found" });
        }

        await deleteByFileId(note.fileId);

        const bucket = getStudyBucket();
        await bucket.delete(note.fileId).catch(() => {}); // ignore if already gone

        await note.deleteOne();

        res.json({ success: true, message: "Note deleted" });
    } catch (err) {
        console.error("Study note delete error:", err);
        res.status(500).json({ success: false, message: "Delete failed", error: err.message });
    }
});
// ── GET /api/study/admin/notes/view/:id ──
router.get("/notes/view/:id", adminProtect, requirePermission("studyNotes"), async (req, res) => {
    try {
        const note = await StudyNote.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ success: false, message: "Note not found" });
        }

        const bucket = getStudyBucket();
        res.set("Content-Type", "application/pdf");
        res.set("Content-Disposition", `inline; filename="${note.sourceFileName}"`);

        const downloadStream = bucket.openDownloadStream(note.fileId);
        downloadStream.on("error", () => {
            res.status(404).json({ success: false, message: "File not found in storage" });
        });
        downloadStream.pipe(res);
    } catch (err) {
        console.error("Study note view error:", err);
        res.status(500).json({ success: false, message: "Failed to load PDF" });
    }
});
module.exports = router;