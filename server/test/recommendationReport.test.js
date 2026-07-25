import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { RecommendationReport } from '../models/recommendationReport.js';

const studentId = new mongoose.Types.ObjectId();
const sampleId = new mongoose.Types.ObjectId();

const strategy = {
  strategy: 'Practise split digraphs',
  rationale: '2 errors include “pali” and “hop”.',
  targetCategories: ['phonological'],
  evidence: [{
    category: 'phonological',
    count: 2,
    writtenExamples: ['pali', 'hop'],
    sampleIds: [sampleId],
  }],
};

test('student recommendation report contains only the latest-report fields', async () => {
  const report = new RecommendationReport({
    student: studentId,
    basedOnSamples: [sampleId],
    strategies: [strategy],
  });
  await report.validate();

  const json = report.toJSON();
  assert.equal(json.status, undefined);
  assert.equal(json.supersedes, undefined);
  assert.equal(json.pendingRegeneration, undefined);
  assert.equal(json.stalenessEvents, undefined);
  assert.equal(json.outdatedFlagDismissedAt, undefined);
  assert.equal(json.student.toString(), studentId.toString());
  assert.equal(json.strategies.length, 1);
  assert.ok(json.reportId);
});
