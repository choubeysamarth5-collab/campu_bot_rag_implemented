const multer = require("multer");
const path = require("path");

// CHANGED: memoryStorage instead of diskStorage. Files are now kept
// in memory as a Buffer (req.file.buffer) instead of being written
// to the local disk — the local disk is ephemeral on free hosting
// (wiped on every restart), so we upload the buffer to GridFS
// (MongoDB Atlas) ourselves in the route handler instead.
const storage = multer.memoryStorage();

// Accept only PDF files
const upload = multer({

    storage,

    fileFilter: function (req, file, cb) {

        if (path.extname(file.originalname).toLowerCase() !== ".pdf") {
            return cb(new Error("Only PDF files are allowed"));
        }

        cb(null, true);

    }

});

module.exports = upload;