import { Student } from '../models/student.js';
import { Sample, ERROR_CATEGORIES } from '../models/sample.js';
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

// Computed on demand from stored Samples - there is no persisted trend
// entity, by design (see the Error Trends & Analytics slice notes).
// Combines aadi/main's date-range filtering with error_trends_kavi's
// richer aggregate shape (totalSamples/mostFrequentCategory/categoryTotals
// plus a per-sample trends[] series), and adds the two filter rules the
// spec calls for: only ANALYSED/REVIEWED samples contribute, and dismissed
// errors are excluded from every count.
const getTrends = async (req, res) => {
  const filter = { student: req.params.studentId, status: { $in: ['ANALYSED', 'REVIEWED'] } };
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

  const samples = await Sample.find(filter).sort({ createdAt: 1 });

  const categoryTotals = Object.fromEntries(ERROR_CATEGORIES.map((category) => [category, 0]));
  let totalErrors = 0;

  const trends = samples.map((sample) => {
    const categoryCounts = Object.fromEntries(ERROR_CATEGORIES.map((category) => [category, 0]));
    const validErrors = sample.errors.filter((error) => !error.dismissed);

    for (const error of validErrors) {
      categoryCounts[error.category] += 1;
      categoryTotals[error.category] += 1;
    }
    totalErrors += validErrors.length;

    return {
      sampleId: sample._id,
      title: sample.title,
      date: sample.createdAt,
      totalErrors: validErrors.length,
      categoryCounts,
    };
  });

  let mostFrequentCategory = null;
  if (totalErrors > 0) {
    mostFrequentCategory = Object.entries(categoryTotals).reduce((highest, current) =>
      current[1] > highest[1] ? current : highest
    )[0];
  }

  res.status(200).json({
    studentId: req.params.studentId,
    totalSamples: samples.length,
    totalErrors,
    mostFrequentCategory,
    categoryTotals,
    trends,
  });
};

export { getStudent, getStudents, createStudent, getTrends };
