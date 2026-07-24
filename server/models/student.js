// models/Student.js
// ------------------
// A Mongoose schema describes what fields a document has and what type each
// one is. Mongoose then validates every save against this description.

import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true, // remove accidental spaces around the ID
  },
  currentGrade: {
    type: String,
    required: true,
    trim: true, // remove accidental spaces around the ID
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// mongoose.model registers the schema under the name "Student". Mongoose
// stores these documents in a MongoDB collection called "students".
export const Student = mongoose.model("Student", studentSchema);