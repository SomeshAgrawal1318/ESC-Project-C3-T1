import {
  levelFromGrade,
  recommendationEngine,
  RecommendationServiceError,
} from './RecommendationEngine.js';

const REPORT_READY_STATUSES = new Set(['ANALYSED', 'REVIEWED']);

function activeEvidenceFromSamples(samples) {
  const evidence = [];

  samples.forEach((sample, sampleIndex) => {
    (sample.errors ?? []).forEach((error, errorIndex) => {
      if (error.dismissed) return;

      evidence.push({
        id: `evidence-${sampleIndex + 1}-${errorIndex + 1}`,
        sampleId: sample._id.toString(),
        // The child's spelling is evidence, not text to clean up. It must stay
        // byte-for-byte identical from MongoDB to the educator's report.
        written: error.written,
        intended: error.intended ?? '',
        category: error.category ?? 'unsure',
        note: error.note ?? '',
      });
    });
  });

  return evidence;
}

/**
 * Assemble all reviewed student evidence and generate one latest-only report.
 * Database writes remain in the controller so a failed generation cannot
 * replace the educator's previous report.
 */
export async function generateReport(student, samples, engine = recommendationEngine) {
  const reportReadySamples = samples.filter((sample) => REPORT_READY_STATUSES.has(sample.status));
  const evidence = activeEvidenceFromSamples(reportReadySamples);

  if (evidence.length === 0) {
    throw new RecommendationServiceError(
      422,
      'No active errors were found in this student’s analysed samples.'
    );
  }

  const strategies = await engine.createInterventionStrategies(
    {
      level: levelFromGrade(student.currentGrade),
      errors: evidence,
    },
    4
  );

  return {
    basedOnSamples: reportReadySamples.map((sample) => sample._id),
    strategies: strategies.slice(0, 4),
  };
}
