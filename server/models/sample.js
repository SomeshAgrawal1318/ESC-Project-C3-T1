// models/Sample.js
// -----------------
// the Sample collection - the heart of the data model. one document per
// uploaded piece of student work, holding everything about it: the scanned
// image(s), what kind of task it was, how far through the analysis flow it
// is, and the errors the AI found (after the educator's review).
//
// the errors live inside the sample document ("embedded") rather than in
// their own collection, because this module always works with one sample
// end to end. if we later need cross-student analytics ("show me every
// phonological error in Band A"), errors could move to their own collection.

import mongoose from "mongoose";

// the fixed vocabulary of error categories, used everywhere in the app.
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

// the shape of one flagged error. this is a sub-schema: it describes the
// objects inside the sample's `errors` array, not a collection of its own.
const errorSchema = new mongoose.Schema(
  {
    // the word exactly as the child wrote it. this is sacred - it is never
    // auto-corrected anywhere in the app.
    written: { type: String, required: true },

    // the AI's best guess at the word the child meant. the educator can
    // correct this guess during review.
    intended: { type: String, default: "" },

    category: {
      type: String,
      enum: ERROR_CATEGORIES, // "enum" = only these values are allowed
      default: "unsure",
    },
    locationOnScan: {type: boxSchema, default: null},
    // a short plain-language reason for the category, written by the AI.
    note: { type: String, default: "" },

    // the educator's human-in-the-loop control: true means "the AI flagged
    // this, but a person decided it is not actually an error". we keep
    // dismissed errors instead of deleting them, so the decision is visible
    // and reversible.
    dismissed: { type: Boolean, default: false },
  },
  { _id: false } // sub-documents don't need their own database ids
);

const sampleSchema = new mongoose.Schema(
  {
    // a reference ("foreign key") to the Student who wrote this work.
    // storing just the id keeps the data in one place; .populate() in the
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

    // a sample can be several scanned pages (e.g. a multi-page PDF), so this
    // is an array, not one path. mimeType is stored per page so the image
    // route can set the right Content-Type without re-reading the file.
    // imagePath is a filesystem path, never image bytes, and must never be
    // sent back in a JSON response.
    pages: {
      type: [
        {
          imagePath: { type: String, required: true },
          originalFilename: { type: String, default: "" },
          mimeType: { type: String, required: true },
        },
      ],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message: "A sample needs at least one uploaded file",
      },
    },

    // EDIT_DIAGRAM tasks have one known correct answer; NARRATIVE writing
    // does not. this matters because closed tasks can give the AI an
    // answer key as reading context. not collected on upload right now (no
    // task-type picker in the upload modal), so it defaults to ESSAY.
    taskType: {
      type: String,
      enum: ["ESSAY", "LONG_ANSWER", "SHORT_ANSWER"],
      default: "ESSAY",
    },

    // for closed tasks only: the exercise's correct text. passed to Gemini
    // purely to help it read unclear handwriting - never to correct the
    // child's writing toward it.
    answerKey: { type: String, default: "" },

    // how far through the flow this sample is:
    //   UPLOADED  - image saved, AI has not looked at it yet
    //   ANALYSED  - the AI has flagged errors, awaiting human review
    //   REVIEWED  - an educator has checked the errors against the scan
    //   FAILED    - the AI could not produce a report; see analysisError
    status: {
      type: String,
      enum: ["UPLOADED", "ANALYSED", "REVIEWED", "FAILED"],
      default: "UPLOADED",
    },

    // human-readable reason analysis failed (e.g. unreadable file, AI
    // timeout). only meaningful when status is FAILED; empty otherwise.
    // never a raw stack trace - the educator reads this directly.
    analysisError: { type: String, default: "" },

    // text the AI extracts from the scan, once analysis has run. empty
    // until then - nothing in this slice writes it.
    sampleContent: { type: String, default: "" },

    // the flagged errors (see errorSchema above).
    errors: { type: [errorSchema], default: [] },

    // anything the AI could not read on the page, in its own words.
    // "none" or empty means everything was legible.
    illegibleNote: { type: String, default: "" },
  },
  {
    // timestamps: true tells Mongoose to maintain createdAt and updatedAt
    // fields on every document automatically.
    timestamps: true,

    // Mongoose warns that "errors" is a name it also uses internally (for
    // validation errors). our usage - a plain data array we read and write
    // whole - is safe, so we acknowledge the warning and turn it off.
    suppressReservedKeysWarning: true,

    // pages[].imagePath is a filesystem path - it must never leave the
    // server in a JSON response. Strip it here so every route gets this for
    // free instead of everyone remembering to do it by hand.
    toJSON: {
      transform: (_doc, ret) => {
        ret.pages = ret.pages.map(({ imagePath, ...rest }) => rest);
        return ret;
      },
    },
  }
);

export const Sample = mongoose.model("Sample", sampleSchema);