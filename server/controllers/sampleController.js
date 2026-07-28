import { Sample, ERROR_CATEGORIES } from '../models/sample.js';
import { runAnalysis } from '../services/errorClassificationEngine.js';

// ------------------------------------------------------------------
// Serialising samples for the client
// ------------------------------------------------------------------
// A sample document holds filesystem paths (pages[].imagePath), and the
// project rule is that raw paths NEVER leave the server (see CLAUDE.md).
// So every route in this file answers with this shape instead of the raw
// Mongoose document. The field names are the ones the client already uses
// (client/src/lib/api.js).
//
// One mapper, not two: the review screen re-renders itself from whatever a
// PATCH hands back, so the writes have to answer with exactly what the read
// does. Splitting a "summary" off for the list routes only bought them a few
// hundred error objects they ignore, at the cost of a second copy of this
// block that the writes had to keep in step by hand.
//
// students.js reuses this for GET /api/students/:studentId/samples.
function toClientSample(sample) {
  return {
    sampleId: sample._id,
    title: sample.title,
    uploadedAt: sample.createdAt,
    analysisStatus: sample.status, // UPLOADED | ANALYSED | REVIEWED
    imageCount: sample.pages.length,
    taskType: sample.taskType,
    // studentId is what lets the review screen's "back to profile" link
    // survive a hard refresh - the response holds no other reference to the
    // student. Still no imagePath: paths never leave the server.
    studentId: sample.student,
    illegibleNote: sample.illegibleNote,
    analysisError: sample.analysisError,
    // errorIndex is the position in errors[] - the errors sub-schema is
    // _id: false, so this is the only handle the client has on one error.
    // It is stable because a removed error is flagged dismissed, not deleted.
    errors: sample.errors.map((flagged, errorIndex) => ({
      errorIndex,
      written: flagged.written,
      intended: flagged.intended,
      category: flagged.category,
      confidenceScore: flagged.confidenceScore,
      locationOnScan: flagged.locationOnScan,
      note: flagged.note,
      dismissed: flagged.dismissed,
    })),
  };
}

const getStudentSamples = async (req, res) => {
  const filter = { student: req.params.studentId };
  if (req.query.status) {
    filter.status = req.query.status;
  }
  const samples = await Sample.find(filter).sort({ createdAt: -1 });
  res.status(200).json(samples.map(toClientSample));
};

const getSamples = async (req, res) => {
  const samples = await Sample.find({}).sort({ createdAt: -1 });
  res.json(samples.map(toClientSample));
};

// The single-sample route is the one the review screen (screen 3) reads.
const getSample = async (req, res) => {
  const sample = await Sample.findById(req.params.sampleId);
  if (!sample) {
    res.status(404);
    throw new Error('Sample not found');
  }
  res.json(toClientSample(sample));
};

const createSample = async (req, res) => {
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
  runAnalysis(sample);
};

const getImages = async (req, res) => {
  const sample = await Sample.findById(req.params.sampleId);
  if (!sample) {
    res.status(400);
    throw new Error('Sample Not found');
  }
  const imagePath = sample.pages[Number(req.params.index)].imagePath;
  if (!imagePath) {
    res.status(400);
    throw new Error('Image not found');
  }

  res.status(200).sendFile(imagePath);
};

const markReviewed = async (req, res) => {
  const validSampleStatus = ['UPLOADED', 'ANALYSED', 'REVIEWED', 'FAILED'];
  const sample = await Sample.findById(req.params.sampleId);
  if (!sample) {
    res.status(400);
    throw new Error('Sample Not found');
  }
  const status = req.body.status;
  if (!status && !validSampleStatus.includes(status)) {
    res.status(400);
    throw new Error('body usage incorrect submit correct status');
  }
  sample.status = status;
  await sample.save();
  res.status(200).json(toClientSample(sample));
};

const reclassifyError = async (req, res) => {
  const sample = await Sample.findById(req.params.sampleId);
  if (!sample) {
    res.status(400);
    throw new Error('Sample Not found');
  }
  if (req.body.dismissed) {
    sample.errors[req.params.errorIndex].dismissed = true;
    await sample.save();
  }
  const newCategory = req.body.category;
  if (!newCategory || !ERROR_CATEGORIES.includes(newCategory)) {
    res.status(400);
    throw new Error('Category wrong');
  }
  sample.errors[req.params.errorIndex].category = newCategory;
  await sample.save();
  res.json(toClientSample(sample));
};

export {
  getStudentSamples,
  createSample,
  getSamples,
  getSample,
  toClientSample,
  getImages,
  markReviewed,
  reclassifyError,
};
