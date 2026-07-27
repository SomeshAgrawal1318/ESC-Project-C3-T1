import { Student } from '../models/student.js';

const getStudents = async (req, res) => {
  const student = await Student.find({});
  res.json(student);
};

const getStudent = async (req, res) => {
  const student = await Student.findById(req.params.studentId);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  res.status(200).json(student);
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
  res.status(201).json(student);
};

export { getStudent, getStudents, createStudent };
