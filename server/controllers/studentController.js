import { Student } from '../models/student.js';
import { Sample } from '../models/sample.js';
// The client shape for a student. Every route in this file answers with
// this instead of the raw Mongoose document, so `_id`/`__v` never reach the
// UI — client/src/lib/api.js and the pages key off `studentId`.
const toClientStudent = (s) => ({
  studentId: s._id,
  name: s.name,
  currentGrade: s.currentGrade,
});

const parseDateQuery = (value) => {
  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof value !== 'string' || !dateFormat.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  // JavaScript changes impossible dates such as 2026-02-30 into a date in
  // March. Comparing each part lets us reject that instead of accepting it.
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return isRealDate ? date : null;
};

// Newest first, matching StudentsListPage, which drops a newly created
// student at the top of the grid.
const getStudents = async (req, res) => {
  const students = await Student.find({}).sort({ createdAt: -1 });
  res.json(students.map(toClientStudent));
};

const getStudent = async (req, res) => {
  const student = await Student.findById(req.params.studentId);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  res.status(200).json(toClientStudent(student));
};

const createStudent = async (req, res) => {
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
  res.status(201).json(toClientStudent(student));
};

const getTrends = async (req, res) => {
  const filter = { student: req.params.studentId };
  if (req.query.from) {
    const from = parseDateQuery(req.query.from);
    if (!from) {
      res.status(400);
      throw new Error('The "from" date must use the YYYY-MM-DD format');
    }
    filter.createdAt = { $gte: from };
  }
  if (req.query.to) {
    const to = parseDateQuery(req.query.to);
    if (!to) {
      res.status(400);
      throw new Error('The "to" date must use the YYYY-MM-DD format');
    }
    // Use midnight of the following UTC day as the exclusive upper limit.
    // For to=2026-07-27, this produces createdAt < 2026-07-28 00:00 UTC.
    to.setUTCDate(to.getUTCDate() + 1);
    filter.createdAt = { ...filter.createdAt, $lt: to };
  }
  const samples = await Sample.find(filter);
  let validErrors = samples
    .filter((s) => s.errors.length > 0)
    .flatMap((s) => s.errors)
    .filter((error) => !error.dismissed);

  const phonological = validErrors.filter((error) => error.category === 'phonological');
  const orthographic = validErrors.filter((error) => error.category === 'orthographic');
  const morphological = validErrors.filter((error) => error.category === 'morphological');
  const capitalisation = validErrors.filter((error) => error.category === 'capitalisation');
  const punctuation = validErrors.filter((error) => error.category === 'punctuation');
  res.status(200).json({
    phonological,
    orthographic,
    morphological,
    capitalisation,
    punctuation,
  });
};

export { getStudent, getStudents, createStudent, getTrends };
