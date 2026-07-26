import express from 'express';
import { Student } from '../models/student.js';
import { Sample } from '../models/sample.js';
import { toClientSample } from './samples.js';

const router = express.Router();

router
  .route('/')
  .get(async (req, res) => {
    const student = await Student.find({});
    res.json(student);
  })
  .post(async (req, res) => {
    console.log(req.body);
    const { name, currentGrade } = req.body;
    if (!name || !currentGrade) {
      res.status(400);
      throw new Error('All fields are mandatory!');
    }
    const student = await Student.create({
      name,
      currentGrade,
    });
    res.status(201).json(student);
  });
router.route('/:studentId').get(async (req, res) => {
  const student = await Student.findById(req.params.studentId);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  res.status(200).json(student);
});
// GET /api/students/:studentId/samples — the writing-samples list on the
// student profile, newest first. Supports ?status=UPLOADED etc. so the UI
// can filter later. Responses use the path-free summary shape from
// samples.js — raw image paths never leave the server.
router.route('/:studentId/samples').get(async (req, res) => {
  const filter = { student: req.params.studentId };
  if (req.query.status) {
    filter.status = req.query.status;
  }
  const samples = await Sample.find(filter).sort({ createdAt: -1 });
  res.status(200).json(samples.map(toClientSample));
});

export default router;
