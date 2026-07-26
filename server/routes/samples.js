import express from 'express';
import { Sample } from '../models/sample.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ------------------------------------------------------------------
// Serialising samples for the client
// ------------------------------------------------------------------
// A sample document holds filesystem paths (pages[].imagePath), and the
// project rule is that raw paths NEVER leave the server (see CLAUDE.md).
// So every route in this file answers with this summary shape instead of
// the raw Mongoose document. The field names are the ones the client
// already uses (client/src/lib/api.js):
//
//   { sampleId, title, uploadedAt, analysisStatus, imageCount, taskType }
//
// students.js reuses this for GET /api/students/:studentId/samples.
export function toClientSample(sample) {
  return {
    sampleId: sample._id,
    title: sample.title,
    uploadedAt: sample.createdAt,
    analysisStatus: sample.status, // UPLOADED | ANALYSED | REVIEWED
    imageCount: sample.pages.length,
    taskType: sample.taskType,
  };
}

// ------------------------------------------------------------------
// File storage (multer)
// ------------------------------------------------------------------
// Uploaded scans land in server/samples/<studentId>/, prefixed with a
// timestamp so two files with the same name never overwrite each other.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const studentId = req.params.studentId;
    if (!studentId) {
      return cb(new Error('missing studentId route parameter'));
    }
    const uploadDirectory = path.join(process.cwd(), 'samples', studentId);
    fs.mkdirSync(uploadDirectory, { recursive: true });
    return cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    return cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

const router = express.Router();

// GET /api/samples — every sample, newest first.
router.route('/').get(async (req, res) => {
  const samples = await Sample.find({}).sort({ createdAt: -1 });
  res.json(samples.map(toClientSample));
});

// POST /api/samples/:studentId — upload a new sample for one student.
// Multipart form data: files under the field "samples" (up to 12; they all
// become pages of ONE sample), plus "title" and "taskType" text fields.
// The client polls GET /api/samples/:sampleId afterwards to see the status
// move from UPLOADED to ANALYSED once the AI analysis (Gemini, not wired
// up yet) has run.
router.route('/:studentId').post(upload.array('samples', 12), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error('No files uploaded under the "samples" field');
  }
  const sample = await Sample.create({
    student: req.params.studentId,
    title: req.body.title || req.files[0].originalname,
    pages: req.files.map((file) => ({
      imagePath: file.path,
      originalFilename: file.originalname,
    })),
    taskType: req.body.taskType,
  });
  res.status(201).json(toClientSample(sample));
});

// GET /api/samples/:sampleId — one sample's summary. The upload page polls
// this while the "Analysing…" screen is up.
router.route('/:sampleId').get(async (req, res) => {
  const sample = await Sample.findById(req.params.sampleId);
  if (!sample) {
    res.status(404);
    throw new Error('Sample not found');
  }
  res.json(toClientSample(sample));
});

export default router;
