import express from 'express';
import fs from 'fs';
import upload from '../middleware/upload.js';
import constants from '../constants.js';
import { Sample } from '../models/sample.js';
import { createSample } from '../controllers/sampleController.js';

const router = express.Router();

// multer's own size-limit rejection happens before our route handler runs,
// as a plain callback rather than a promise, so it needs its own explicit
// res.status()+next(err) instead of relying on Express 5's auto-catch for
// async handlers below.
function handleUpload(req, res, next) {
  upload.array('images')(req, res, (err) => {
    if (!err) return next();
    res.status(constants.UNPROCESSABLE_ENTITY);
    next(
      new Error(
        err.code === 'LIMIT_FILE_SIZE'
          ? 'One of the files is over the 10MB limit.'
          : err.message
      )
    );
  });
}

router.post('/', handleUpload, async (req, res) => {
  const { studentId } = req.body;
  const files = req.files;

  if (!studentId || !files || files.length === 0) {
    res.status(constants.VALIDATION_ERROR);
    throw new Error('studentId and at least one image are required');
  }

  try {
    const sample = await createSample(studentId, files);
    res.status(202).json(sample);
  } catch (err) {
    res.status(err.statusCode || constants.INTERNAL_SERVER_ERROR);
    throw new Error(err.message);
  }
});

router.get('/:sampleId', async (req, res) => {
  const sample = await Sample.findById(req.params.sampleId).catch(() => null);

  if (!sample) {
    res.status(constants.NOT_FOUND);
    throw new Error('Sample not found');
  }

  // the polling target - a summary, not the full document. sampleContent
  // and analysisError are only included once they're actually meaningful.
  // the JSON key stays "analysisStatus" even though the model field is
  // "status" - that's the name the client side already reads it as.
  res.status(200).json({
    sampleId: sample._id,
    studentId: sample.student,
    uploadedAt: sample.createdAt,
    analysisStatus: sample.status,
    imageCount: sample.pages.length,
    ...(sample.sampleContent && { sampleContent: sample.sampleContent }),
    ...(sample.status === 'FAILED' && {
      analysisError: sample.analysisError,
    }),
  });
});

router.get('/:sampleId/images/:index', async (req, res) => {
  const sample = await Sample.findById(req.params.sampleId).catch(() => null);
  const page = sample?.pages[req.params.index];

  if (!page) {
    res.status(constants.NOT_FOUND);
    throw new Error('Image not found');
  }

  res.setHeader('Content-Type', page.mimeType);
  fs.createReadStream(page.imagePath).pipe(res);
});

export default router;
