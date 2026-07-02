const multer = require("multer");
const path = require("path");

// Decide where the uploaded PDF will be stored
const storage = multer.diskStorage({

    // Folder where files will be saved
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },

    // Name of the uploaded file
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }

});

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