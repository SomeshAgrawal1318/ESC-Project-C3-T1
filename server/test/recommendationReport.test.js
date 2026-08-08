import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import mongoose from 'mongoose';

import {
  prepareRecommendationReportStorage,
  RecommendationReport,
  toPublicRecommendationReport,
} from '../models/recommendationReport.js';

describe('latest-only recommendation report model', () => {
  test('enforces one report per student and validates the nested public shape', async () => {
    assert.equal(RecommendationReport.schema.path('student').options.unique, true);
    const studentId = new mongoose.Types.ObjectId();
    const sampleId = new mongoose.Types.ObjectId();
    const report = new RecommendationReport({
      student: studentId,
      basedOnSamples: [sampleId],
      strategies: [
        {
          strategy: 'Practise long vowels',
          rationale: 'One reviewed error supports this sequence.',
          targetCategories: ['phonological'],
          evidence: [
            {
              category: 'phonological',
              count: 1,
              writtenExamples: ['hop'],
              sampleIds: [sampleId],
            },
          ],
          worksheets: [
            {
              worksheetId: 'azure-0123456789abcdef',
              title: 'Long vowel practice',
              pdfPages: 'PDF pages 1–2',
              available: true,
              targetCategories: ['phonological'],
              rationale: 'Practises the observed pattern.',
            },
          ],
        },
      ],
    });

    await report.validate();
    assert.equal(report.status, undefined);
    assert.equal(report.supersedes, undefined);
    assert.equal(report.strategies[0].worksheets[0].pdfPath, undefined);
  });

  test('serializes IDs once and never exposes private or Mongoose fields', () => {
    const reportId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    const sampleId = new mongoose.Types.ObjectId();
    const publicReport = toPublicRecommendationReport(
      {
        _id: reportId,
        student: studentId,
        basedOnSamples: [sampleId],
        generatedAt: new Date('2026-08-01T00:00:00.000Z'),
        __v: 9,
        strategies: [
          {
            strategy: 'Practise',
            rationale: 'Grounded rationale.',
            targetCategories: ['orthographic'],
            evidence: [
              {
                category: 'orthographic',
                count: 1,
                writtenExamples: ['frend'],
                sampleIds: [sampleId],
                _id: 'private-subdocument-id',
              },
            ],
            worksheets: [
              {
                worksheetId: 'azure-0123456789abcdef',
                title: 'Spelling',
                pdfPages: '',
                available: true,
                targetCategories: ['orthographic'],
                rationale: 'Relevant.',
                pdfPath: '_raw/private.pdf',
                azureStorageSasToken: 'private',
              },
            ],
          },
        ],
      },
      { isOutdated: true }
    );

    assert.equal(publicReport.reportId, reportId.toString());
    assert.equal(publicReport.studentId, studentId.toString());
    assert.deepEqual(publicReport.basedOnSamples, [sampleId.toString()]);
    assert.deepEqual(publicReport.strategies[0].evidence[0].sampleIds, [sampleId.toString()]);
    assert.equal(publicReport.isOutdated, true);
    assert.equal('_id' in publicReport, false);
    assert.equal('__v' in publicReport, false);
    assert.equal('pdfPath' in publicReport.strategies[0].worksheets[0], false);
    assert.equal('azureStorageSasToken' in publicReport.strategies[0].worksheets[0], false);
  });

  test('checks for legacy duplicates before creating the unique index', async () => {
    const originalAggregate = RecommendationReport.aggregate;
    const originalCreateIndexes = RecommendationReport.createIndexes;
    let createIndexesCalled = false;

    try {
      RecommendationReport.aggregate = async () => [{ _id: 'duplicate', reportCount: 2 }];
      RecommendationReport.createIndexes = async () => {
        createIndexesCalled = true;
      };
      await assert.rejects(prepareRecommendationReportStorage(), /approved migration/i);
      assert.equal(createIndexesCalled, false);

      RecommendationReport.aggregate = async () => [];
      await prepareRecommendationReportStorage();
      assert.equal(createIndexesCalled, true);
    } finally {
      RecommendationReport.aggregate = originalAggregate;
      RecommendationReport.createIndexes = originalCreateIndexes;
    }
  });
});
