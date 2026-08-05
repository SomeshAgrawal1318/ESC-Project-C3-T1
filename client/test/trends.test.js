import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  applySampleSelection,
  filterSamplesByRange,
  getRangeStart,
  prepareTrendSamples,
  summariseTrends,
} from '../src/lib/trends.js';

function sample({ id, date, status = 'ANALYSED', errors = [] }) {
  return {
    sampleId: id,
    title: `Sample ${id}`,
    uploadedAt: date,
    analysisStatus: status,
    errors,
  };
}

describe('trend data preparation', () => {
  test('keeps completed samples in chronological order and retains zero-error samples', () => {
    const result = prepareTrendSamples([
      sample({ id: 'new', date: '2026-07-20T08:00:00.000Z', status: 'REVIEWED' }),
      sample({ id: 'waiting', date: '2026-07-10T08:00:00.000Z', status: 'UPLOADED' }),
      sample({ id: 'old', date: '2026-06-20T08:00:00.000Z' }),
    ]);

    assert.deepEqual(
      result.map((item) => item.sampleId),
      ['old', 'new']
    );
    assert.equal(result[1].totalErrors, 0);
  });

  test('counts five categories while excluding dismissed and unsure errors', () => {
    const [result] = prepareTrendSamples([
      sample({
        id: 'one',
        date: '2026-07-20T08:00:00.000Z',
        errors: [
          { category: 'phonological', dismissed: false },
          { category: 'phonological', dismissed: true },
          { category: 'punctuation', dismissed: false },
          { category: 'unsure', dismissed: false },
        ],
      }),
    ]);

    assert.equal(result.counts.phonological, 1);
    assert.equal(result.counts.punctuation, 1);
    assert.equal(result.totalErrors, 2);
    assert.equal('unsure' in result.counts, false);
  });
});

describe('trend filtering and selection', () => {
  test('calculates calendar-month date presets and supports all time', () => {
    const now = new Date(2026, 6, 31, 12);
    const start = getRangeStart('3m', now);

    assert.deepEqual([start.getFullYear(), start.getMonth(), start.getDate()], [2026, 3, 30]);
    assert.equal(getRangeStart('all', now), null);
  });

  test('filters by range and removes explicitly excluded samples', () => {
    const prepared = prepareTrendSamples([
      sample({ id: 'old', date: '2026-01-01T08:00:00.000Z' }),
      sample({ id: 'middle', date: '2026-06-01T08:00:00.000Z' }),
      sample({ id: 'latest', date: '2026-07-20T08:00:00.000Z' }),
    ]);
    const ranged = filterSamplesByRange(prepared, '3m', new Date(2026, 6, 31, 12));
    const selected = applySampleSelection(ranged, new Set(['middle']));

    assert.deepEqual(
      ranged.map((item) => item.sampleId),
      ['middle', 'latest']
    );
    assert.deepEqual(
      selected.map((item) => item.sampleId),
      ['latest']
    );
  });
});

describe('trend summaries', () => {
  test('uses category order to break a most-frequent tie', () => {
    const prepared = prepareTrendSamples([
      sample({
        id: 'one',
        date: '2026-06-01T08:00:00.000Z',
        errors: [
          { category: 'phonological', dismissed: false },
          { category: 'orthographic', dismissed: false },
        ],
      }),
    ]);

    assert.equal(summariseTrends(prepared).mostFrequent, 'phonological');
  });

  test('reports improving, steady, and more-errors comparisons', () => {
    const counts = (amount) =>
      Array.from({ length: amount }, () => ({ category: 'phonological', dismissed: false }));
    const makePair = (previous, latest) =>
      prepareTrendSamples([
        sample({ id: 'previous', date: '2026-06-01T08:00:00.000Z', errors: counts(previous) }),
        sample({ id: 'latest', date: '2026-07-01T08:00:00.000Z', errors: counts(latest) }),
      ]);

    assert.equal(summariseTrends(makePair(5, 3)).comparison.state, 'improving');
    assert.equal(summariseTrends(makePair(3, 3)).comparison.state, 'steady');
    assert.equal(summariseTrends(makePair(2, 4)).comparison.state, 'more-errors');
  });
});
