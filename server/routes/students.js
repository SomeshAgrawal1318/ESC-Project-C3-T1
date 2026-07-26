import express from 'express';
import constants from '../constants.js';
import { Student } from '../models/student.js';
import { Sample } from '../models/sample.js';

const router = express.Router();

router.route('/')
    .get((req, res) =>{
        res.send('Hi Im a student');
    });

// GET /api/students/:studentId/samples - the summary list a student's
// profile page renders (newest first). Deliberately a summary, not the
// full Sample - never sends images or sampleContent.
router.get('/:studentId/samples', async (req, res) => {
  const { studentId } = req.params;
  const { status } = req.query;

  const student = await Student.findById(studentId).catch(() => null);
  if (!student) {
    res.status(constants.NOT_FOUND);
    throw new Error('Student not found');
  }

  const filter = { student: studentId };
  if (status) filter.analysisStatus = status;

  const samples = await Sample.find(filter).sort({ createdAt: -1 });

  res.status(200).json(
    samples.map((sample) => ({
      sampleId: sample._id,
      title: sample.title,
      uploadedAt: sample.createdAt,
      analysisStatus: sample.analysisStatus,
      imageCount: sample.images.length,
    }))
  );
});

export default router;