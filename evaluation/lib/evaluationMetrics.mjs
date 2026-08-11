import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function jsonFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directory, entry.name))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function errorKey(error) {
  return `${String(error?.written ?? "")
    .trim()
    .toLowerCase()}::${String(error?.intended ?? "")
    .trim()
    .toLowerCase()}`;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function guardrailProfileFor(prediction) {
  if (prediction.guardrailProfile) return prediction.guardrailProfile;
  return prediction.guardrails ? "full/legacy" : "none";
}

export async function evaluatePredictionDirectory({
  truthDirectory,
  predictionsDirectory,
}) {
  const truthFiles = await jsonFiles(truthDirectory);
  const metrics = {
    samples: truthFiles.length,
    predictions: 0,
    groundTruthErrors: 0,
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
    categoryMatches: 0,
    latencyTotalMs: 0,
    latencyCount: 0,
    confusion: {},
  };

  for (const truthFile of truthFiles) {
    const truth = JSON.parse(await readFile(truthFile, "utf8"));
    metrics.groundTruthErrors += truth.errors.length;
    const predictionFile = path.join(
      predictionsDirectory,
      `${truth.sampleId}.json`,
    );
    let prediction;
    try {
      prediction = JSON.parse(await readFile(predictionFile, "utf8"));
      metrics.predictions += 1;
    } catch (error) {
      if (error.code === "ENOENT") {
        metrics.falseNegatives += truth.errors.length;
        continue;
      }
      throw error;
    }

    if (typeof prediction.latencyMs === "number") {
      metrics.latencyTotalMs += prediction.latencyMs;
      metrics.latencyCount += 1;
    }

    const remaining = [...truth.errors];
    for (const predicted of prediction.errors || []) {
      const matchIndex = remaining.findIndex(
        (actual) => errorKey(actual) === errorKey(predicted),
      );
      if (matchIndex < 0) {
        metrics.falsePositives += 1;
        continue;
      }

      const [actual] = remaining.splice(matchIndex, 1);
      metrics.truePositives += 1;
      const actualCategory = actual.category;
      const predictedCategory = predicted.category;
      metrics.confusion[actualCategory] ||= {};
      metrics.confusion[actualCategory][predictedCategory] =
        (metrics.confusion[actualCategory][predictedCategory] || 0) + 1;
      if (actualCategory === predictedCategory) metrics.categoryMatches += 1;
    }
    metrics.falseNegatives += remaining.length;
  }

  metrics.precision = ratio(
    metrics.truePositives,
    metrics.truePositives + metrics.falsePositives,
  );
  metrics.recall = ratio(
    metrics.truePositives,
    metrics.truePositives + metrics.falseNegatives,
  );
  metrics.f1 =
    metrics.precision + metrics.recall === 0
      ? 0
      : (2 * metrics.precision * metrics.recall) /
        (metrics.precision + metrics.recall);
  metrics.categoryAccuracy = ratio(
    metrics.categoryMatches,
    metrics.truePositives,
  );
  metrics.averageLatencyMs =
    metrics.latencyCount === 0
      ? null
      : metrics.latencyTotalMs / metrics.latencyCount;
  return metrics;
}
