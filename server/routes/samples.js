import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getSample, getSamples, createSample } from '../controllers/sampleController.js';

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
router.route('/').get(getSamples);

// POST /api/samples/:studentId — upload a new sample for one student.
// Multipart form data: files under the field "samples" (up to 12; they all
// become pages of ONE sample), plus "title" and "taskType" text fields.
// The client polls GET /api/samples/:sampleId afterwards to see the status
// move from UPLOADED to ANALYSED once the AI analysis (Gemini, not wired
// up yet) has run.
router.route('/:studentId').post(upload.array('samples', 12), createSample);

// GET /api/samples/:sampleId — one sample's summary. The upload page polls
// this while the "Analysing…" screen is up.
router.route('/:sampleId').get(getSample);

export default router;
