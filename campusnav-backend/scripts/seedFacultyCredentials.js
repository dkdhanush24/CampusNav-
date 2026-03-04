/**
 * Seed Faculty Credentials
 *
 * One-time script to add login credentials for Dr. Nijil Raj.
 * Run from campusnav-backend/: node scripts/seedFacultyCredentials.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Faculty = require("../models/faculty");

const MONGO_URI = process.env.MONGO_URI;

const FACULTY_CREDENTIALS = [
    {
        namePattern: /nijil\s*raj/i,     // Matches "Nijil Raj", "Dr. Nijil Raj", etc.
        username: "nijilraj",
        password: "faculty123"
    }
];

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("[Seed] Connected to MongoDB Atlas");

        for (const cred of FACULTY_CREDENTIALS) {
            const faculty = await Faculty.findOne({ name: cred.namePattern });

            if (!faculty) {
                console.log(`[Seed] ⚠️  Faculty matching "${cred.namePattern}" not found. Skipping.`);
                continue;
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(cred.password, salt);

            // Update faculty document
            await Faculty.findByIdAndUpdate(faculty._id, {
                $set: {
                    username: cred.username,
                    password: hashedPassword,
                    status: "available",
                    statusUpdatedAt: new Date()
                }
            });

            console.log(`[Seed] ✅ Credentials set for "${faculty.name}"`);
            console.log(`       Username: ${cred.username}`);
            console.log(`       Password: ${cred.password} (stored as bcrypt hash)`);
        }

        await mongoose.disconnect();
        console.log("[Seed] Done.");
        process.exit(0);
    } catch (err) {
        console.error("[Seed] ❌ Error:", err.message);
        process.exit(1);
    }
}

seed();
