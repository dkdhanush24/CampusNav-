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
  subjects: String
});

module.exports =
  mongoose.models.Faculty ||
  mongoose.model("Faculty", FacultySchema, "faculties");
