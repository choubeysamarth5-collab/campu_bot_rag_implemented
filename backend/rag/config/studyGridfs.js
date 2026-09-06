// =====================================================================
// rag/config/studyGridfs.js  –  GridFS Setup for Study Notes
// ---------------------------------------------------------------------
// Exact same pattern as rag/config/gridfs.js (same reasoning: Render's
// free tier wipes local disk on restart, so PDF bytes live in Mongo
// via GridFS). We deliberately pull GridFSBucket from mongoose.mongo
// here too — NOT a separate `require("mongodb")` — for the same
// "dual package hazard" reason documented in gridfs.js (mismatched
// bson instances cause BSONVersionError).
//
// Separate bucket name so teacher-uploaded notes never share storage
// with the existing pdfUploads bucket used by the FAQ/admissions PDFs.
// =====================================================================

const mongoose = require("mongoose");
const { GridFSBucket } = mongoose.mongo;

const BUCKET_NAME = "studyNotesUploads";

function getStudyBucket() {
    const client = mongoose.connection.getClient();
    const db = client.db();
    return new GridFSBucket(db, { bucketName: BUCKET_NAME });
}

module.exports = { getStudyBucket, BUCKET_NAME };