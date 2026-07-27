import { Sample } from '../models/sample.js';

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
function toClientSample(sample) {
  return {
    sampleId: sample._id,
    title: sample.title,
    uploadedAt: sample.createdAt,
    analysisStatus: sample.status, // UPLOADED | ANALYSED | REVIEWED
    imageCount: sample.pages.length,
    taskType: sample.taskType,
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
};

export { getStudentSamples, createSample, getSamples, getSample, toClientSample };
