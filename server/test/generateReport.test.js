import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { generateReport } from '../services/generateReport.js';

function sample({ id, status, errors }) {
  return {
    _id: { toString: () => id },
    status,
    errors,
  };
}

describe('generateReport evidence assembly', () => {
  test('combines all analysed and reviewed samples while excluding dismissed errors', async () => {
    let engineInput;
    const engine = {
      async createInterventionStrategies(input, limit) {
        engineInput = { input, limit };
        return [{ strategy: 'Example' }];
      },
    };
    const written = '  frend<keep exactly>  ';
    const samples = [
      sample({
        id: '000000000000000000000001',
        status: 'ANALYSED',
        errors: [
          {
            written,
            intended: undefined,
            category: undefined,
            note: undefined,
            dismissed: false,
          },
          {
            written: 'ignored',
            category: 'orthographic',
            dismissed: true,
          },
        ],
      }),
      sample({
        id: '000000000000000000000002',
        status: 'REVIEWED',
        errors: [
          {
            written: 'hop',
            intended: 'hope',
            category: 'phonological',
            note: 'long vowel',
          },
        ],
      }),
      sample({
        id: '000000000000000000000003',
        status: 'UPLOADED',
        errors: [{ written: 'not ready', category: 'unsure' }],
      }),
    ];

    const report = await generateReport(
      { currentGrade: 'Secondary 1', name: 'Never send this name' },
      samples,
      engine
    );

    assert.deepEqual(report.basedOnSamples, [samples[0]._id, samples[1]._id]);
    assert.equal(engineInput.limit, 4);
    assert.equal(engineInput.input.level, 'secondary');
    assert.equal('name' in engineInput.input, false);
    assert.equal(engineInput.input.errors.length, 2);
    assert.deepEqual(engineInput.input.errors[0], {
      id: 'evidence-1-1',
      sampleId: '000000000000000000000001',
      written,
      intended: '',
      category: 'unsure',
      note: '',
    });
    assert.equal(engineInput.input.errors[1].id, 'evidence-2-1');
    assert.equal(report.strategies.length, 1);
  });

  test('does not infer a DAS band from an unrelated school-grade label', async () => {
    let receivedLevel = 'not-called';
    await generateReport(
      { currentGrade: 'Grade 4' },
      [
        sample({
          id: '000000000000000000000001',
          status: 'REVIEWED',
          errors: [{ written: 'word', category: 'unsure' }],
        }),
      ],
      {
        async createInterventionStrategies(input) {
          receivedLevel = input.level;
          return [];
        },
      }
    );

    assert.equal(receivedLevel, null);
  });

  test('returns a 422 service error when no active reviewed evidence exists', async () => {
    await assert.rejects(
      generateReport(
        { currentGrade: 'Primary 3' },
        [
          sample({
            id: '000000000000000000000001',
            status: 'REVIEWED',
            errors: [{ written: 'dismissed', category: 'orthographic', dismissed: true }],
          }),
          sample({
            id: '000000000000000000000002',
            status: 'UPLOADED',
            errors: [{ written: 'not ready', category: 'unsure' }],
          }),
        ],
        { createInterventionStrategies: () => assert.fail('engine must not run') }
      ),
      (error) => {
        assert.equal(error.statusCode, 422);
        assert.match(error.message, /No active errors/i);
        return true;
      }
    );
  });

  test('returns no more than four strategies even if an engine misbehaves', async () => {
    const report = await generateReport(
      { currentGrade: 'Primary 3' },
      [
        sample({
          id: '000000000000000000000001',
          status: 'ANALYSED',
          errors: [{ written: 'word', category: 'orthographic' }],
        }),
      ],
      {
        async createInterventionStrategies() {
          return Array.from({ length: 6 }, (_, index) => ({ strategy: `Strategy ${index}` }));
        },
      }
    );

    assert.equal(report.strategies.length, 4);
  });
});
