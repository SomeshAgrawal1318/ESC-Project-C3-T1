// models/Sample.js
// -----------------
// The Sample collection - the heart of the data model. One document per
// uploaded piece of student work, holding everything about it: the image,
// what kind of task it was, how far through the flow it is, and the errors
// the AI found (after the educator's review).
//
// The errors live INSIDE the sample document ("embedded") rather than in
// their own collection, because this module always works with one sample
// end to end. If we later need cross-student analytics ("show me every
// phonological error in Band A"), errors could move to their own collection.

import mongoose from "mongoose";

// The fixed vocabulary of error categories, used everywhere in the app.
// "unsure" is the AI's honest fallback when it cannot confidently pick one.
export const ERROR_CATEGORIES = [
  "phonological",
  "orthographic",
  "morphological",
  "capitalisation",
  "punctuation",
  "unsure",
];
const boxSchema = new mongoose.Schema({
  x: {type: Number, required: true, min: 0, max: 1},
  y: {type: Number, required: true, min: 0, max: 1},
  z: {type: Number, required: true, min: 0, max: 1},
  w: {type: Number, required: true, min: 0, max: 1},
},
  {_id: false}
);

// The shape of one flagged error. This is a sub-schema: it describes the
// objects inside the sample's `errors` array, not a collection of its own.
const errorSchema = new mongoose.Schema(
  {
    // The word exactly as the child wrote it. This is sacred - it is never
    // auto-corrected anywhere in the app.
    written: { type: String, required: true },

    // The AI's best guess at the word the child meant. The educator can
    // correct this guess during review.
    intended: { type: String, default: "" },

    category: {
      type: String,
      enum: ERROR_CATEGORIES, // "enum" = only these values are allowed
      default: "unsure",
    },
    locationOnScan: {type: boxSchema, default: null},
    // A short plain-language reason for the category, written by the AI.
    note: { type: String, default: "" },

    // The educator's human-in-the-loop control: true means "the AI flagged
    // this, but a person decided it is not actually an error". We keep
    // dismissed errors instead of deleting them, so the decision is visible
    // and reversible.
    dismissed: { type: Boolean, default: false },
  },
  { _id: false } // sub-documents don't need their own database ids
);

// Up to three worksheets selected immediately after this sample is analysed.
// The source file path stays inside the recommendation engine; the API stores
// only Markdown-grounded PDF metadata that is safe to return to the client.
const worksheetSchema = new mongoose.Schema(
  {
    worksheetId: { type: String, required: true },
    title: { type: String, required: true },
    pdfPath: { type: String, required: true },
    pdfPages: { type: String, default: "" },
    targetCategories: [{ type: String, enum: ERROR_CATEGORIES }],
    rationale: { type: String, required: true },
  },
  { _id: false }
);

const sampleSchema = new mongoose.Schema(
  {
    // A reference ("foreign key") to the Student who wrote this work.
    // Storing just the id keeps the data in one place; .populate() in the
    // routes swaps the id for the full student document when we need it.
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    title: {
      type: String, 
      required: true,
    },

    // Where the uploaded image lives on disk. We store the PATH, not the
    // image bytes - files belong on the filesystem, not in the database.
    imagePath: { type: String, required: true },
    originalFilename: { type: String, default: "" },

    // EDIT_DIAGRAM tasks have one known correct answer; NARRATIVE writing
    // does not. This matters because closed tasks can give the AI an
    // answer key as reading context.
    taskType: {
      type: String,
      enum: ["ESSAY", "LONG_ANSWER", "SHORT_ANSWER"],
      required: true,
    },

    // For closed tasks only: the exercise's correct text. Passed to Gemini
    // purely to help it read unclear handwriting - never to correct the
    // child's writing toward it.
    answerKey: { type: String, default: "" },

    // How far through the flow this sample is:
    //   UPLOADED  - image saved, AI has not looked at it yet
    //   ANALYSED  - the AI has flagged errors, awaiting human review
    //   REVIEWED  - an educator has checked the errors against the scan
    status: {
      type: String,
      enum: ["UPLOADED", "ANALYSED", "REVIEWED"],
      default: "UPLOADED",
    },

    // The flagged errors (see errorSchema above).
    errors: { type: [errorSchema], default: [] },

    recommendedWorksheets: {
      type: [worksheetSchema],
      default: [],
      validate: {
        validator: value => value.length <= 3,
        message: "A sample can have at most three recommended worksheets",
      },
    },
    recommendationsGeneratedAt: { type: Date, default: null },

    // Anything the AI could not read on the page, in its own words.
    // "none" or empty means everything was legible.
    illegibleNote: { type: String, default: "" },
  },
  {
    // timestamps: true tells Mongoose to maintain createdAt and updatedAt
    // fields on every document automatically.
    timestamps: true,

    // Mongoose warns that "errors" is a name it also uses internally (for
    // validation errors). Our usage - a plain data array we read and write
    // whole - is safe, so we acknowledge the warning and turn it off.
    suppressReservedKeysWarning: true,
  }
);

export const Sample = mongoose.model("Sample", sampleSchema);