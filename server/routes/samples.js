import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getSample,
  getSamples,
  createSample,
  getImages,
  markReviewed,
  reclassifyError,
} from '../controllers/sampleController.js';
import {
  generateSampleWorksheets,
  getSampleWorksheets,
} from '../controllers/recommendationController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { MAX_FILE_SIZE } from '../middleware/upload.js';

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

const upload = multer({ storage: storage, limits: { fileSize: MAX_FILE_SIZE } });

// multer rejects an oversized file with a MulterError before createSample
// ever runs. Convert that into the 422 validateSample() would have produced
// for any other unacceptable file, instead of a generic 500.
function uploadSamples(req, res, next) {
  upload.array('samples', 12)(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      const sizeError = new Error(
        `One of the uploaded files is larger than ${MAX_FILE_SIZE / (1024 * 1024)}MB, the maximum accepted size.`
      );
      sizeError.statusCode = 422;
      return next(sizeError);
    }
    next(err);
  });
}

const router = express.Router();

// GET /api/samples — every sample, newest first.
router.route('/').get(getSamples);

// POST /api/samples/:studentId — upload a new sample for one student.
// Multipart form data: files under the field "samples" (up to 12; they all
// become pages of ONE sample), plus "title" and "taskType" text fields.
// The client polls GET /api/samples/:sampleId afterwards to see the status
// move from UPLOADED to ANALYSED once the AI analysis (Gemini, not wired
// up yet) has run.
router.route('/:studentId').post(uploadSamples, createSample);

// GET /api/samples/:sampleId — one sample's summary. The upload page polls
// this while the "Analysing…" screen is up.
router
  .route('/:sampleId/recommendations')
  .post(asyncHandler(generateSampleWorksheets))
  .get(asyncHandler(getSampleWorksheets));
router.route('/:sampleId').get(getSample).patch(markReviewed);
router.route('/:sampleId/images/:index').get(getImages);
router.route('/:sampleId/errors/:errorIndex').patch(reclassifyError);

export default router;
