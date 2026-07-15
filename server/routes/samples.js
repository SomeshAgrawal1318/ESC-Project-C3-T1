// routes/samples.js
// ------------------
// Every API endpoint for samples lives here. All five routes follow the
// same shape, so once you can read one, you can read them all:
//
//   1. validate the input
//   2. do the work
//   3. return clear JSON
//   4. catch errors with a readable message
//
// The flow the routes support:
//   POST /api/samples            upload an image        -> status UPLOADED
//   POST /api/samples/:id/analyse  Gemini flags errors  -> status ANALYSED
//   PUT  /api/samples/:id/errors   educator's review    -> status REVIEWED
//   GET  /api/samples / :id        read things back

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Student } from "../models/Student.js";
import { Sample } from "../models/Sample.js";
import { analyseImage } from "../services/gemini.js";
import { buildErrorPatternReport } from "../services/ErrorPatternAnalysisEngine.js";

export const samplesRouter = express.Router();

// ---------------------------------------------------------------------------
// File upload setup (multer)
// ---------------------------------------------------------------------------

// multer is middleware that receives the uploaded file, saves it to the
// /uploads folder, and hands us the saved file path on req.file.

// Work out where /server/uploads is, and make sure it exists.
// (import.meta.url is this file's own location; two levels up is /server.)
const thisFilePath = fileURLToPath(import.meta.url);
const serverFolder = path.dirname(path.dirname(thisFilePath));
const uploadsFolder = path.join(serverFolder, "uploads");
fs.mkdirSync(uploadsFolder, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsFolder,
  filename: (request, file, callback) => {
    // Prefix with the time so two files named "scan.jpg" never collide,
    // and strip odd characters so the name is always safe on disk.
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    callback(null, `${Date.now()}-${safeName}`);
  },
});

const SUPPORTED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export function isSupportedUploadMimeType(mimeType) {
  return SUPPORTED_UPLOAD_MIME_TYPES.includes(mimeType);
}

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB is plenty for a scan
  fileFilter: (request, file, callback) => {
    // Only accept the image types the Gemini service understands.
    if (isSupportedUploadMimeType(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error("Please upload a JPG, PNG, WebP or PDF file."));
    }
  },
});

// ---------------------------------------------------------------------------
// POST /api/samples - upload a new piece of student work
// ---------------------------------------------------------------------------
// upload.single("image") means: expect one file, in a form field named "image".
samplesRouter.post("/", upload.single("image"), async (request, response) => {
  try {
    // 1. Validate the input.
    const { externalRef, taskType, answerKey } = request.body;

    if (!request.file) {
      return response
        .status(400)
        .json({ message: "No image was uploaded. Please choose a scan first." });
    }
    if (!externalRef || externalRef.trim() === "") {
      return response
        .status(400)
        .json({ message: "Please enter the student's DAS ID (e.g. Student-60570)." });
    }
    const allowedTaskTypes = ["EDIT_DIAGRAM", "NARRATIVE", "OTHER"];
    if (!allowedTaskTypes.includes(taskType)) {
      return response
        .status(400)
        .json({ message: "Please choose a task type." });
    }

    // 2. Do the work: find this student by DAS ID, or create them if this
    //    is their first sample.
    let student = await Student.findOne({ externalRef: externalRef.trim() });
    if (!student) {
      student = await Student.create({ externalRef: externalRef.trim() });
    }

    const sample = await Sample.create({
      student: student._id,
      imagePath: request.file.path,
      originalFilename: request.file.originalname,
      taskType: taskType,
      answerKey: answerKey || "",
      status: "UPLOADED",
    });

    // 3. Return clear JSON.
    return response.status(201).json(sample);
  } catch (error) {
    // 4. Catch errors with a readable message.
    console.error("Upload failed:", error);
    return response
      .status(500)
      .json({ message: `The upload could not be saved: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// POST /api/samples/:id/analyse - send the image to Gemini (one call)
// ---------------------------------------------------------------------------
samplesRouter.post("/:id/analyse", async (request, response) => {
  try {
    const sample = await Sample.findById(request.params.id);
    if (!sample) {
      return response
        .status(404)
        .json({ message: "That sample could not be found." });
    }

    // Team 1 transcribes in one VLM call; Team 2 then performs a deterministic
    // character diff and attaches primitive target tracks.
    const transcription = await analyseImage(sample.imagePath, sample.answerKey);

    sample.raw_text = transcription.raw_text;
    sample.corrected_text = transcription.corrected_text;
    sample.errorPatternReport = buildErrorPatternReport(
      transcription.raw_text,
      transcription.corrected_text
    );
    sample.errors = [];
    sample.illegibleNote = "";
    sample.status = "ANALYSED";
    await sample.save();

    // Swap the student id for the full student document, so the frontend
    // can keep showing the DAS ID without an extra request.
    await sample.populate("student");
    return response.json(sample);
  } catch (error) {
    console.error("Analysis failed:", error);
    return response
      .status(500)
      .json({ message: `The analysis did not complete: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/samples/:id/errors - save the educator's review
// ---------------------------------------------------------------------------
// The human-in-the-loop step: the educator has checked the flagged errors
// against the scan, dismissed any false alarms, and maybe corrected an
// "intended" word. We save their reviewed list and mark the sample REVIEWED.
samplesRouter.put("/:id/errors", async (request, response) => {
  try {
    const { errors } = request.body;
    if (!Array.isArray(errors)) {
      return response
        .status(400)
        .json({ message: "Expected an 'errors' array in the request body." });
    }

    const sample = await Sample.findById(request.params.id);
    if (!sample) {
      return response
        .status(404)
        .json({ message: "That sample could not be found." });
    }

    // Note: the educator may edit "intended" (their reading of what the
    // child meant) and "dismissed" - but "written" stays exactly what the
    // AI transcribed from the page. The schema's enum also rejects any
    // category outside the fixed vocabulary.
    sample.errors = errors;
    sample.status = "REVIEWED";
    await sample.save();

    await sample.populate("student");
    return response.json(sample);
  } catch (error) {
    console.error("Saving the review failed:", error);
    return response
      .status(500)
      .json({ message: `The review could not be saved: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// GET /api/samples/:id - one sample, with everything
// ---------------------------------------------------------------------------
samplesRouter.get("/:id", async (request, response) => {
  try {
    // .populate("student") swaps the stored student id for the full student
    // document, so the frontend gets the DAS ID without a second request.
    const sample = await Sample.findById(request.params.id).populate("student");
    if (!sample) {
      return response
        .status(404)
        .json({ message: "That sample could not be found." });
    }
    return response.json(sample);
  } catch (error) {
    console.error("Loading the sample failed:", error);
    return response
      .status(500)
      .json({ message: `The sample could not be loaded: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// GET /api/samples - the list for the landing page
// ---------------------------------------------------------------------------
samplesRouter.get("/", async (request, response) => {
  try {
    const samples = await Sample.find()
      .sort({ createdAt: -1 }) // newest first
      .select("student taskType status createdAt") // just what the list shows
      .populate("student", "externalRef");
    return response.json(samples);
  } catch (error) {
    console.error("Loading the samples list failed:", error);
    return response
      .status(500)
      .json({ message: `The samples list could not be loaded: ${error.message}` });
  }
});
