import { RECLASSIFY_ORDER } from './categories.js';

export const TREND_CATEGORIES = RECLASSIFY_ORDER;

export const DATE_RANGES = [
  { value: '3m', label: 'Last 3 months', months: 3 },
  { value: '6m', label: 'Last 6 months', months: 6 },
  { value: '12m', label: 'Last 12 months', months: 12 },
  { value: 'all', label: 'All time', months: null },
];

const READY_STATUSES = new Set(['ANALYSED', 'REVIEWED', 'COMPLETE']);

function emptyCounts() {
  return Object.fromEntries(TREND_CATEGORIES.map((category) => [category, 0]));
}

export function prepareTrendSamples(samples) {
  return samples
    .filter(
      (sample) =>
        READY_STATUSES.has(sample.analysisStatus) &&
        !Number.isNaN(new Date(sample.uploadedAt).getTime())
    )
    .map((sample) => {
      const counts = emptyCounts();

      for (const error of sample.errors ?? []) {
        if (!error.dismissed && error.category in counts) {
          counts[error.category] += 1;
        }
      }

      return {
        ...sample,
        counts,
        totalErrors: TREND_CATEGORIES.reduce((total, category) => total + counts[category], 0),
      };
    })
    .sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
}

export function getRangeStart(range, now = new Date()) {
  const option = DATE_RANGES.find((item) => item.value === range);
  if (!option || option.months === null) return null;

  const targetMonth = new Date(now.getFullYear(), now.getMonth() - option.months, 1);
  const lastDayOfTargetMonth = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  ).getDate();

  return new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(now.getDate(), lastDayOfTargetMonth)
  );
}

export function filterSamplesByRange(samples, range, now = new Date()) {
  const start = getRangeStart(range, now);
  if (!start) return samples;

  return samples.filter((sample) => new Date(sample.uploadedAt) >= start);
}

export function applySampleSelection(samples, excludedIds) {
  return samples.filter((sample) => !excludedIds.has(String(sample.sampleId)));
}

export function summariseTrends(samples) {
  const categoryTotals = emptyCounts();

  for (const sample of samples) {
    for (const category of TREND_CATEGORIES) {
      categoryTotals[category] += sample.counts[category];
    }
  }

  const totalErrors = TREND_CATEGORIES.reduce(
    (total, category) => total + categoryTotals[category],
    0
  );

  let mostFrequent = null;
  for (const category of TREND_CATEGORIES) {
    if (
      categoryTotals[category] > 0 &&
      (mostFrequent === null || categoryTotals[category] > categoryTotals[mostFrequent])
    ) {
      mostFrequent = category;
    }
  }

  let comparison = null;
  if (samples.length >= 2) {
    const previousTotal = samples.at(-2).totalErrors;
    const latestTotal = samples.at(-1).totalErrors;
    const state =
      latestTotal < previousTotal
        ? 'improving'
        : latestTotal > previousTotal
          ? 'more-errors'
          : 'steady';

    comparison = { state, previousTotal, latestTotal };
  }

  return {
    sampleCount: samples.length,
    firstDate: samples[0]?.uploadedAt ?? null,
    lastDate: samples.at(-1)?.uploadedAt ?? null,
    categoryTotals,
    totalErrors,
    mostFrequent,
    comparison,
  };
}
