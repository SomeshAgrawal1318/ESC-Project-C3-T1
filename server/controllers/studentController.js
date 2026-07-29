import { Student } from '../models/student.js';
// The client shape for a student. Every route in this file answers with
// this instead of the raw Mongoose document, so `_id`/`__v` never reach the
// UI — client/src/lib/api.js and the pages key off `studentId`.
const toClientStudent = (s) => ({
  studentId: s._id,
  name: s.name,
  currentGrade: s.currentGrade,
});

// Newest first, matching StudentsListPage, which drops a newly created
// student at the top of the grid.
const getStudents = async (req, res) => {
  // Older development databases can contain documents from before these
  // required fields existed. Do not let one unusable legacy row crash the
  // entire caseload screen.
  const students = await Student.find({
    name: { $type: 'string' },
    currentGrade: { $type: 'string' },
  }).sort({ createdAt: -1 });
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

export { getStudent, getStudents, createStudent };
