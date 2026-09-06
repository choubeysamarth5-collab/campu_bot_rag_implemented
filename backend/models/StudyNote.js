// =============================================
// models/StudyNote.js – Study Notes metadata
// =============================================
// One document per uploaded file (not per chunk — the chunks/embeddings
// themselves live in the "study_chunks" collection via studyVectorStore.js).
// This model is just for listing/managing uploads in the admin panel,
// same role FAQ.js plays for FAQ entries.

const mongoose = require("mongoose");

const studyNoteSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        subject: { type: String, required: true, trim: true },
        semester: { type: String, trim: true },
        sourceFileName: { type: String, required: true },
        fileId: { type: mongoose.Schema.Types.ObjectId, required: true }, // GridFS file id
        chunkCount: { type: Number, default: 0 },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("StudyNote", studyNoteSchema);