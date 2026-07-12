// models/Student.js
// ------------------
// The Student collection. One document per child, identified ONLY by their
// DAS ID number (e.g. "Student-60570").
//
// Privacy rule: we never store a child's real name - the DAS ID is enough to
// link samples together, and it means a leaked database exposes no identities.
//
// A Mongoose schema describes what fields a document has and what type each
// one is. Mongoose then validates every save against this description.

import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  // The DAS ID number. "required" means Mongoose refuses to save without it.
  externalRef: {
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
