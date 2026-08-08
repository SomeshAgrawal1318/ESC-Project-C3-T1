import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import express from 'express';
import mongoose from 'mongoose';

import errorHandler from '../middleware/errorHandler.js';
import { RecommendationReport } from '../models/recommendationReport.js';
import { Sample } from '../models/sample.js';
import { Student } from '../models/student.js';
import recommendationRoutes from '../routes/recommendation.js';
import studentRoutes from '../routes/students.js';
import worksheetRoutes from '../routes/worksheets.js';
import {
  recommendationEngine,
  RecommendationServiceError,
} from '../services/RecommendationEngine.js';

const originals = {
  findStudent: Student.findById,
  findSamples: Sample.find,
  existsSample: Sample.exists,
  findReport: RecommendationReport.findOne,
  upsertReport: RecommendationReport.findOneAndUpdate,
  createStrategies: recommendationEngine.createInterventionStrategies,
  fetchWorksheet: recommendationEngine.fetchWorksheet,
};

let server;
let baseUrl;

before(() => {
  const app = express();
  app.use(express.json());
  app.use('/api/students', studentRoutes);
  app.use('/api/worksheets', worksheetRoutes);
  app.use('/api/recommendation', recommendationRoutes);
  app.use(errorHandler);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  Student.findById = async () => null;
  Sample.find = () => ({ sort: async () => [] });
  Sample.exists = async () => null;
  RecommendationReport.findOne = async () => null;
  RecommendationReport.findOneAndUpdate = async () => null;
  recommendationEngine.createInterventionStrategies = originals.createStrategies;
  recommendationEngine.fetchWorksheet = originals.fetchWorksheet;
});

after(async () => {
  Student.findById = originals.findStudent;
  Sample.find = originals.findSamples;
  Sample.exists = originals.existsSample;
  RecommendationReport.findOne = originals.findReport;
  RecommendationReport.findOneAndUpdate = originals.upsertReport;
  recommendationEngine.createInterventionStrategies = originals.createStrategies;
  recommendationEngine.fetchWorksheet = originals.fetchWorksheet;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.arrayBuffer();
  return { response, body };
}

function readySample(sampleId, written = 'hop') {
  return {
    _id: sampleId,
    status: 'REVIEWED',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    errors: [
      {
        written,
        intended: 'hope',
        category: 'phonological',
        note: 'long vowel',
        dismissed: false,
      },
    ],
  };
}

function generatedStrategy(sampleId) {
  return {
    strategy: 'Teach long-vowel patterns',
    rationale: '1 observed error includes “hop”. Use explicit guided practice.',
    targetCategories: ['phonological'],
    evidence: [
      {
        category: 'phonological',
        count: 1,
        writtenExamples: ['hop'],
        sampleIds: [sampleId.toString()],
      },
    ],
    worksheets: [
      {
        worksheetId: 'mock-phonics',
        title: 'Phonics practice',
        pdfPages: '',
        available: false,
        targetCategories: ['phonological'],
        rationale: 'Practise after teacher modelling.',
      },
    ],
  };
}

describe('student recommendation routes', () => {
  test('rejects malformed IDs and reports a missing student', async () => {
    const invalid = await request('/api/students/not-an-id/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(invalid.response.status, 400);
    assert.match(invalid.body.message, /resource ID is invalid/i);

    const missing = await request('/api/students/507f1f77bcf86cd799439011/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.message, 'Student not found.');
  });

  test('returns 422 when every reviewed error was dismissed', async () => {
    const studentId = new mongoose.Types.ObjectId();
    const sampleId = new mongoose.Types.ObjectId();
    Student.findById = async () => ({ _id: studentId, currentGrade: 'Primary 4' });
    Sample.find = () => ({
      sort: async () => [
        {
          ...readySample(sampleId),
          errors: [
            {
              written: 'dismissed',
              category: 'orthographic',
              dismissed: true,
            },
          ],
        },
      ],
    });

    const result = await request(`/api/students/${studentId}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(result.response.status, 422);
    assert.match(result.body.message, /No active errors/i);
  });

  test('generates all evidence before atomically upserting the latest report', async () => {
    const studentId = new mongoose.Types.ObjectId();
    const firstSampleId = new mongoose.Types.ObjectId();
    const secondSampleId = new mongoose.Types.ObjectId();
    const reportId = new mongoose.Types.ObjectId();
    let sampleQuery;
    let sampleSort;
    let upsertCall;

    Student.findById = async () => ({ _id: studentId, currentGrade: 'Primary 4' });
    Sample.find = (query) => {
      sampleQuery = query;
      return {
        sort: async (sort) => {
          sampleSort = sort;
          return [readySample(firstSampleId), readySample(secondSampleId, 'pali')];
        },
      };
    };
    recommendationEngine.createInterventionStrategies = async (input) => {
      assert.equal(input.errors.length, 2);
      return [generatedStrategy(firstSampleId)];
    };
    RecommendationReport.findOneAndUpdate = async (filter, update, options) => {
      upsertCall = { filter, update, options };
      return {
        _id: reportId,
        student: studentId,
        basedOnSamples: update.$set.basedOnSamples,
        strategies: update.$set.strategies,
        generatedAt: update.$set.generatedAt,
      };
    };

    const result = await request(`/api/students/${studentId}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    assert.equal(result.response.status, 201);
    assert.equal(result.body.report.reportId, reportId.toString());
    assert.equal(result.body.report.studentId, studentId.toString());
    assert.deepEqual(sampleQuery, {
      student: studentId.toString(),
      status: { $in: ['ANALYSED', 'REVIEWED'] },
    });
    assert.deepEqual(sampleSort, { createdAt: 1 });
    assert.deepEqual(upsertCall.filter, { student: studentId.toString() });
    assert.equal(upsertCall.options.upsert, true);
    assert.equal(upsertCall.options.runValidators, true);
    assert.equal(upsertCall.options.returnDocument, 'after');
    assert.ok(upsertCall.update.$set.generatedAt instanceof Date);
    assert.deepEqual(upsertCall.update.$set.basedOnSamples, [firstSampleId, secondSampleId]);
  });

  test('returns the winning report after a concurrent first-upsert race', async () => {
    const studentId = new mongoose.Types.ObjectId();
    const sampleId = new mongoose.Types.ObjectId();
    const reportId = new mongoose.Types.ObjectId();
    const winner = {
      _id: reportId,
      student: studentId,
      basedOnSamples: [sampleId],
      strategies: [],
      generatedAt: new Date(),
    };
    Student.findById = async () => ({ _id: studentId, currentGrade: 'Primary 4' });
    Sample.find = () => ({ sort: async () => [readySample(sampleId)] });
    recommendationEngine.createInterventionStrategies = async () => [];
    RecommendationReport.findOneAndUpdate = async () => {
      const error = new Error('duplicate key');
      error.code = 11000;
      throw error;
    };
    RecommendationReport.findOne = async () => winner;

    const result = await request(`/api/students/${studentId}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.report.reportId, reportId.toString());
  });

  test('preserves the previous report when generation fails', async () => {
    const studentId = new mongoose.Types.ObjectId();
    const sampleId = new mongoose.Types.ObjectId();
    let upsertCalled = false;
    Student.findById = async () => ({ _id: studentId, currentGrade: 'Primary 4' });
    Sample.find = () => ({ sort: async () => [readySample(sampleId)] });
    recommendationEngine.createInterventionStrategies = async () => {
      throw new RecommendationServiceError(502, 'The recommendation service is unavailable.');
    };
    RecommendationReport.findOneAndUpdate = async () => {
      upsertCalled = true;
    };

    const result = await request(`/api/students/${studentId}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(result.response.status, 502);
    assert.equal(upsertCalled, false);
    assert.equal(result.body.message, 'The recommendation service is unavailable.');
  });

  test('retrieves the latest report and computes changed or new evidence freshness', async () => {
    const studentId = new mongoose.Types.ObjectId();
    const sampleId = new mongoose.Types.ObjectId();
    const generatedAt = new Date('2026-07-29T00:00:00.000Z');
    let freshnessQuery;
    RecommendationReport.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      student: studentId,
      basedOnSamples: [sampleId],
      strategies: [],
      generatedAt,
    });
    Sample.exists = async (query) => {
      freshnessQuery = query;
      return { _id: sampleId };
    };

    const result = await request(`/api/students/${studentId}/recommendations/latest`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.report.isOutdated, true);
    assert.deepEqual(freshnessQuery.$or, [
      {
        _id: { $in: [sampleId] },
        updatedAt: { $gt: generatedAt },
      },
      {
        _id: { $nin: [sampleId] },
        status: { $in: ['ANALYSED', 'REVIEWED'] },
      },
    ]);
  });

  test('returns 404 when no latest report exists and retains the legacy route', async () => {
    const studentId = new mongoose.Types.ObjectId();
    const missing = await request(`/api/students/${studentId}/recommendations/latest`);
    assert.equal(missing.response.status, 404);
    assert.match(missing.body.message, /No recommendation report/i);

    const legacy = await fetch(`${baseUrl}/api/recommendation`);
    assert.equal(legacy.status, 200);
    assert.equal(await legacy.text(), 'Hello world');
  });
});

describe('approved worksheet PDF route', () => {
  test('rejects arbitrary worksheet IDs before returning any file', async () => {
    recommendationEngine.fetchWorksheet = async () => {
      throw new RecommendationServiceError(404, 'Worksheet not found.');
    };
    const result = await request('/api/worksheets/not-approved/file');
    assert.equal(result.response.status, 404);
    assert.equal(result.body.message, 'Worksheet not found.');
  });

  test('returns a verified PDF with private caching and nosniff headers', async () => {
    recommendationEngine.fetchWorksheet = async (worksheetId) => ({
      worksheet: { worksheetId },
      response: new Response('%PDF-1.7\nsynthetic fixture', {
        headers: { 'Content-Type': 'application/octet-stream' },
      }),
      maximumBytes: 1024,
    });
    const result = await request('/api/worksheets/azure-0123456789abcdef/file');

    assert.equal(result.response.status, 200);
    assert.equal(result.response.headers.get('content-type'), 'application/pdf');
    assert.equal(result.response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(result.response.headers.get('cache-control'), 'private, max-age=300');
    assert.match(result.response.headers.get('content-disposition'), /inline/);
    assert.equal(Buffer.from(result.body).subarray(0, 5).toString(), '%PDF-');
  });

  test('rejects wrong metadata, oversized bodies, invalid signatures, and interrupted streams', async () => {
    const cases = [
      {
        response: new Response('%PDF-1.7', { headers: { 'Content-Type': 'text/html' } }),
        maximumBytes: 100,
        message: /did not return a PDF/i,
      },
      {
        response: new Response('%PDF-1.7', {
          headers: { 'Content-Type': 'application/pdf', 'Content-Length': '8' },
        }),
        maximumBytes: 5,
        message: /too large/i,
      },
      {
        response: new Response('not a pdf', { headers: { 'Content-Type': 'application/pdf' } }),
        maximumBytes: 100,
        message: /invalid PDF/i,
      },
      {
        response: new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('%PDF-'));
              controller.error(new Error('interrupted'));
            },
          }),
          { headers: { 'Content-Type': 'application/pdf' } }
        ),
        maximumBytes: 100,
        message: /interrupted/i,
      },
    ];

    for (const fixture of cases) {
      recommendationEngine.fetchWorksheet = async () => ({
        worksheet: { worksheetId: 'azure-0123456789abcdef' },
        ...fixture,
      });
      const result = await request('/api/worksheets/azure-0123456789abcdef/file');
      assert.equal(result.response.status, 502);
      assert.match(result.body.message, fixture.message);
    }
  });
});
