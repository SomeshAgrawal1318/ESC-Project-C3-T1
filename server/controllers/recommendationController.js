import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { RecommendationReport } from '../models/recommendationReport.js';
import { Sample } from '../models/sample.js';
import { Student } from '../models/student.js';
import { generateReport } from '../services/generateReport.js';
import { recommendWorksheets } from '../services/recommendWorksheet.js';
import { recommendationEngine } from '../services/recommendationEngine.js';
import { AppError } from '../utils/appError.js';

// Keep controller logs structured and free of report contents or student writing.
function logAction(action, details = {}) {
  console.info(`[recommendation] ${action} ${JSON.stringify(details)}`);
}

// Fail early so invalid identifiers never reach MongoDB.
function assertObjectId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'INVALID_ID', 'The supplied resource ID is invalid.');
  }
}

// Keep the sample recommendation response stable across POST and GET routes.
function worksheetResponse(sample) {
  return {
    sampleId: sample._id.toString(),
    generatedAt: sample.recommendationsGeneratedAt,
    worksheets: sample.recommendedWorksheets,
  };
}

// Generate and retain only the student's newest intervention report.
export async function generateStudentRecommendations(req, res) {
  const { studentId } = req.params;
  const startedAt = Date.now();
  logAction('student-report-start', { studentId });
  assertObjectId(studentId);
  const student = await Student.findById(studentId);
  if (!student) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');

  const samples = await Sample.find({
    student: studentId,
    status: { $in: ['ANALYSED', 'REVIEWED'] },
  }).sort({ createdAt: 1 });
  logAction('student-report-samples-loaded', { studentId, samples: samples.length });
  const generated = await generateReport(student, samples);
  const report = await RecommendationReport.create({
    student: studentId,
    ...generated,
    generatedAt: new Date(),
  });

  // Keep exactly one report: the newest successful generation.
  await RecommendationReport.deleteMany({ student: studentId, _id: { $ne: report._id } });
  logAction('student-report-complete', {
    studentId,
    reportId: report._id.toString(),
    strategies: report.strategies.length,
    durationMs: Date.now() - startedAt,
  });
  res.status(201).json({ report });
}

// Return the one current report without triggering a regeneration.
export async function getLatestStudentRecommendations(req, res) {
  const { studentId } = req.params;
  logAction('student-report-read-start', { studentId });
  assertObjectId(studentId);
  const report = await RecommendationReport.findOne({ student: studentId })
    .sort({ generatedAt: -1 });
  if (!report) {
    throw new AppError(404, 'RECOMMENDATION_NOT_FOUND', 'No recommendation report has been generated.');
  }
  logAction('student-report-read-complete', {
    studentId,
    reportId: report._id.toString(),
    strategies: report.strategies.length,
  });
  res.json({ report });
}

// Run recommendation generation and persist its latest worksheet list on the sample.
export async function generateAndSaveSampleWorksheets(sampleId) {
  const startedAt = Date.now();
  logAction('sample-worksheets-start', { sampleId });
  assertObjectId(sampleId);
  const sample = await Sample.findById(sampleId).populate('student', 'currentGrade');
  if (!sample) throw new AppError(404, 'SAMPLE_NOT_FOUND', 'Sample not found.');
  sample.recommendedWorksheets = await recommendWorksheets(sample);
  sample.recommendationsGeneratedAt = new Date();
  await sample.save();
  logAction('sample-worksheets-complete', {
    sampleId,
    worksheets: sample.recommendedWorksheets.length,
    durationMs: Date.now() - startedAt,
  });
  return sample;
}

// HTTP wrapper for generating one sample's worksheet recommendations.
export async function generateSampleWorksheets(req, res) {
  const sample = await generateAndSaveSampleWorksheets(req.params.sampleId);
  res.status(201).json(worksheetResponse(sample));
}

// Return the worksheet recommendations already stored on a sample.
export async function getSampleWorksheets(req, res) {
  const { sampleId } = req.params;
  assertObjectId(sampleId);
  const sample = await Sample.findById(sampleId)
    .select('recommendedWorksheets recommendationsGeneratedAt');
  if (!sample) throw new AppError(404, 'SAMPLE_NOT_FOUND', 'Sample not found.');
  logAction('sample-worksheets-read', {
    sampleId,
    worksheets: sample.recommendedWorksheets.length,
  });
  res.json(worksheetResponse(sample));
}

// Proxy an approved private Azure PDF so the browser never receives the SAS token.
export async function streamWorksheetFile(req, res) {
  const startedAt = Date.now();
  logAction('worksheet-stream-start', { worksheetId: req.params.worksheetId });
  const { worksheet, response } = await recommendationEngine.fetchWorksheet(req.params.worksheetId);
  if (!response.body) {
    throw new AppError(502, 'AZURE_BLOB_FETCH_FAILED', 'Azure Blob Storage returned an empty worksheet.');
  }
  const upstreamType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (upstreamType !== 'application/pdf' && upstreamType !== 'application/octet-stream') {
    throw new AppError(502, 'INVALID_WORKSHEET_CONTENT_TYPE', 'Azure Blob Storage did not return a PDF worksheet.');
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `inline; filename="${worksheet.worksheetId}.pdf"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  await pipeline(Readable.fromWeb(response.body), res);
  logAction('worksheet-stream-complete', {
    worksheetId: worksheet.worksheetId,
    durationMs: Date.now() - startedAt,
  });
}