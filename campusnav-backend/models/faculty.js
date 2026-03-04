const mongoose = require("mongoose");

const FacultySchema = new mongoose.Schema({
  facultyId: String,    // BLE tag mapping ID (e.g. "FAC_101") — links to facultyLocations
  name: String,
  designation: String,
  email: String,
  department: String,
  room_id: String,
  availability: String,
  specialization: String,
  subjects: String,

  // ── Faculty Login & Status Control ──────────────────────────────
  username: { type: String, unique: true, sparse: true },  // Only faculty with accounts
  password: String,                                         // bcrypt-hashed
  status: {
    type: String,
    enum: ["available", "busy", "private_break"],
    default: "available"
  },
  statusUpdatedAt: { type: Date, default: Date.now }
});

module.exports =
  mongoose.models.Faculty ||
  mongoose.model("Faculty", FacultySchema, "faculties");
