require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("../models/Admin");

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error("Usage: node scripts/grantStudyPermission.js <admin-email>");
        process.exit(1);
    }

    const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/campusbot";
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");

    const admin = await Admin.findOne({ email });

    if (!admin) {
        console.error(`No admin found with email: ${email}`);
        process.exit(1);
    }

    if (!admin.permissions) admin.permissions = [];

    if (admin.permissions.includes("all") || admin.permissions.includes("studyNotes")) {
        console.log(`${email} already has studyNotes access (permissions: ${admin.permissions.join(", ")})`);
    } else {
        admin.permissions.push("studyNotes");
        await admin.save();
        console.log(`Granted "studyNotes" permission to ${email}`);
        console.log(`Current permissions: ${admin.permissions.join(", ")}`);
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error("Script error:", err);
    process.exit(1);
});
