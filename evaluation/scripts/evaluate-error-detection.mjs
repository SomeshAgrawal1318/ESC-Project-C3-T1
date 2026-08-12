#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = new URL("..", import.meta.url);
const VETTED_DIR = new URL("../ground-truth-vetted/", import.meta.url);
const predictionsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(ROOT.pathname, "predictions/gemini");

async function jsonFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(dir, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function key(error) {
  return `${String(error.written ?? "")
    .trim()
    .toLowerCase()}::${String(error.intended ?? "")
    .trim()
    .toLowerCase()}`;
}

function pct(numerator, denominator) {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function format(value) {
  return value.toFixed(3);
}

const truthFiles = await jsonFiles(VETTED_DIR.pathname);
if (truthFiles.length === 0) {
  console.log(
    "No vetted ground-truth files found. Add JSON files under evaluation/ground-truth-vetted/ first.",
  );
  process.exit(0);
}

let truePositives = 0;
let falsePositives = 0;
let falseNegatives = 0;
let categoryMatches = 0;
let latencyTotal = 0;
let latencyCount = 0;
let missingPredictionFiles = 0;
let failedPredictions = 0;
const latencies = [];
const confusion = new Map();
const actualByCategory = new Map();
const predictedByCategory = new Map();
const correctByCategory = new Map();

for (const truthFile of truthFiles) {
  const truth = JSON.parse(await readFile(truthFile, "utf8"));
  for (const error of truth.errors) {
    actualByCategory.set(
      error.category,
      (actualByCategory.get(error.category) ?? 0) + 1,
    );
  }
  const predictionFile = path.join(predictionsDir, path.basename(truthFile));
  let prediction;
  try {
    prediction = JSON.parse(await readFile(predictionFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      missingPredictionFiles += 1;
      falseNegatives += truth.errors.length;
      continue;
    }
    throw error;
  }

  if (prediction.status === "failed") failedPredictions += 1;

  if (typeof prediction.latencyMs === "number") {
    latencyTotal += prediction.latencyMs;
    latencyCount += 1;
    latencies.push(prediction.latencyMs);
  }

  const remainingTruth = new Map(
    truth.errors.map((error) => [key(error), error]),
  );
  for (const predicted of prediction.errors ?? []) {
    predictedByCategory.set(
      predicted.category,
      (predictedByCategory.get(predicted.category) ?? 0) + 1,
    );
    const matched = remainingTruth.get(key(predicted));
    if (!matched) {
      falsePositives += 1;
      continue;
    }

    truePositives += 1;
    remainingTruth.delete(key(predicted));
    const actualCategory = matched.category;
    const predictedCategory = predicted.category;
    const row = confusion.get(actualCategory) ?? new Map();
    row.set(predictedCategory, (row.get(predictedCategory) ?? 0) + 1);
    confusion.set(actualCategory, row);
    if (actualCategory === predictedCategory) {
      categoryMatches += 1;
      correctByCategory.set(
        actualCategory,
        (correctByCategory.get(actualCategory) ?? 0) + 1,
      );
    }
  }
  falseNegatives += remainingTruth.size;
}

const precision = pct(truePositives, truePositives + falsePositives);
const recall = pct(truePositives, truePositives + falseNegatives);
const f1 =
  precision + recall === 0
    ? 0
    : (2 * precision * recall) / (precision + recall);
const categoryAccuracy = pct(categoryMatches, truePositives);
const sortedLatencies = [...latencies].sort((a, b) => a - b);
const p95Latency =
  sortedLatencies.length > 0
    ? sortedLatencies[Math.max(0, Math.ceil(sortedLatencies.length * 0.95) - 1)]
    : null;

console.log(
  `# Error detection evaluation for ${path.relative(process.cwd(), predictionsDir)}`,
);
console.log("");
console.log(`- Vetted samples: ${truthFiles.length}`);
console.log(`- Missing prediction files: ${missingPredictionFiles}`);
console.log(`- Failed model predictions: ${failedPredictions}`);
console.log(
  `- Missing/failed sample rate: ${format(
    pct(missingPredictionFiles + failedPredictions, truthFiles.length)
  )}`
);
console.log(`- True positives: ${truePositives}`);
console.log(`- False positives: ${falsePositives}`);
console.log(`- False negatives: ${falseNegatives}`);
console.log(`- Detection precision: ${format(precision)}`);
console.log(`- Detection recall: ${format(recall)}`);
console.log(`- Detection F1: ${format(f1)}`);
console.log(
  `- Classification accuracy on matched errors: ${format(categoryAccuracy)}`,
);
if (latencyCount > 0)
  console.log(`- Average latency: ${format(latencyTotal / latencyCount)} ms`);
if (p95Latency !== null) console.log(`- P95 latency: ${format(p95Latency)} ms`);
console.log("");
console.log("## Per-category exact-match metrics");
for (const category of new Set([
  ...actualByCategory.keys(),
  ...predictedByCategory.keys(),
])) {
  const correct = correctByCategory.get(category) ?? 0;
  const categoryPrecision = pct(
    correct,
    predictedByCategory.get(category) ?? 0,
  );
  const categoryRecall = pct(correct, actualByCategory.get(category) ?? 0);
  console.log(
    `- ${category}: precision=${format(categoryPrecision)}, recall=${format(categoryRecall)}, ` +
      `correct=${correct}, actual=${actualByCategory.get(category) ?? 0}, ` +
      `predicted=${predictedByCategory.get(category) ?? 0}`,
  );
}
console.log("");
console.log("## Confusion counts");
for (const [actual, row] of confusion) {
  for (const [predicted, count] of row) {
    console.log(`- actual=${actual}, predicted=${predicted}: ${count}`);
  }
}
