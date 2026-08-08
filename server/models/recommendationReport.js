// One student has one current recommendation report. Regeneration replaces the
// report atomically; the prototype deliberately keeps no report-history state.

import mongoose from 'mongoose';

import { ERROR_CATEGORIES } from './sample.js';

const worksheetSchema = new mongoose.Schema(
  {
    worksheetId: { type: String, required: true },
    title: { type: String, required: true },
    pdfPages: { type: String, default: '' },
    available: { type: Boolean, default: false },
    targetCategories: [{ type: String, enum: ERROR_CATEGORIES }],
    rationale: { type: String, required: true },
  },
  { _id: false }
);

const evidenceSchema = new mongoose.Schema(
  {
    category: { type: String, enum: ERROR_CATEGORIES, required: true },
    count: { type: Number, min: 1, required: true },
    writtenExamples: { type: [String], default: [] },
    sampleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sample' }],
  },
  { _id: false }
);

const strategySchema = new mongoose.Schema(
  {
    strategy: { type: String, required: true, trim: true },
    rationale: { type: String, required: true, trim: true },
    targetCategories: [{ type: String, enum: ERROR_CATEGORIES }],
    evidence: { type: [evidenceSchema], default: [] },
    worksheets: { type: [worksheetSchema], default: [] },
  },
  { _id: false }
);

const recommendationReportSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
      unique: true,
    },
    basedOnSamples: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sample' }],
    strategies: { type: [strategySchema], default: [] },
    generatedAt: { type: Date, required: true, default: Date.now },
  },
  // Index creation is delayed until the server has performed the read-only
  // duplicate check below. This prevents a unique-index failure from hiding
  // legacy duplicate data that needs an explicit migration decision.
  { timestamps: true, autoIndex: false }
);

function stringId(value) {
  const identifier = value?._id ?? value;
  return identifier == null ? null : identifier.toString();
}

function publicEvidence(evidence) {
  return {
    category: evidence.category,
    count: evidence.count,
    writtenExamples: [...(evidence.writtenExamples ?? [])],
    sampleIds: (evidence.sampleIds ?? []).map(stringId),
  };
}

function publicWorksheet(worksheet) {
  return {
    worksheetId: worksheet.worksheetId,
    title: worksheet.title,
    pdfPages: worksheet.pdfPages ?? '',
    available: worksheet.available === true,
    targetCategories: [...(worksheet.targetCategories ?? [])],
    rationale: worksheet.rationale,
  };
}

function publicStrategy(strategy) {
  return {
    strategy: strategy.strategy,
    rationale: strategy.rationale,
    targetCategories: [...(strategy.targetCategories ?? [])],
    evidence: (strategy.evidence ?? []).map(publicEvidence),
    worksheets: (strategy.worksheets ?? []).map(publicWorksheet),
  };
}

/** Centralize the only report shape allowed to leave the server. */
export function toPublicRecommendationReport(report, { isOutdated = false } = {}) {
  const value = typeof report.toObject === 'function' ? report.toObject() : report;
  return {
    reportId: stringId(value._id ?? value.reportId),
    studentId: stringId(value.student ?? value.studentId),
    basedOnSamples: (value.basedOnSamples ?? []).map(stringId),
    strategies: (value.strategies ?? []).map(publicStrategy),
    generatedAt: value.generatedAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    isOutdated,
  };
}

recommendationReportSchema.set('toJSON', {
  transform: (_document, result) => toPublicRecommendationReport(result),
});

export const RecommendationReport = mongoose.model(
  'RecommendationReport',
  recommendationReportSchema
);

/** Verify legacy data before creating the latest-only unique student index. */
export async function prepareRecommendationReportStorage() {
  const duplicateStudents = await RecommendationReport.aggregate([
    { $group: { _id: '$student', reportCount: { $sum: 1 } } },
    { $match: { reportCount: { $gt: 1 } } },
    { $limit: 1 },
  ]);

  if (duplicateStudents.length > 0) {
    throw new Error(
      'Duplicate student recommendation reports require an approved migration before startup.'
    );
  }

  await RecommendationReport.createIndexes();
}
