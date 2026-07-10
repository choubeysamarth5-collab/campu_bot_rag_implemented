// =====================================================================
// rag/config/gridfs.js  –  GridFS Setup (persistent PDF storage)
// ---------------------------------------------------------------------
// WHY THIS EXISTS: on Render's free tier (and most free hosting), the
// server's local disk is EPHEMERAL — every time the service restarts
// (which happens automatically after ~15 min of inactivity on the
// free tier), anything written to disk, including the uploads/
// folder, is wiped. MongoDB Atlas, on the other hand, is a separate,
// permanent database — so we now store the actual PDF file bytes
// there too (using GridFS, MongoDB's built-in large-file storage),
// instead of the local filesystem. This keeps uploaded PDFs safe
// across restarts, the same way the vector chunks already are.
// =====================================================================

const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

const BUCKET_NAME = "pdfUploads";

// Reuses Mongoose's EXISTING connection (the one server.js already
// opened) instead of creating a second connection just for GridFS.
function getBucket() {
    const client = mongoose.connection.getClient();
    const db = client.db(); // uses the database name from your MONGO_URI
    return new GridFSBucket(db, { bucketName: BUCKET_NAME });
}

module.exports = { getBucket, BUCKET_NAME };