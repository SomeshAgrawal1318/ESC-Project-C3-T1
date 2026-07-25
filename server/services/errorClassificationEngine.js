// services/errorClassificationEngine.js
// -------------------------------------
// The AI core. Takes an uploaded Sample and produces the categorised
// errors that get written back onto it.
//
// There is no separate SampleReport model in this codebase (see
// models/sample.js) - errors live embedded on the Sample itself, so the
// "report" this engine produces is just { errors, illegibleNote }, the two
// fields Sample already has room for.
//
// Two ways to run:
//   - Mock mode (default when GEMINI_API_KEY is unset): returns a fixed,
//     realistic fixture. Lets the rest of the team build against a stable
//     shape without burning API quota or waiting on model latency.
//   - Real mode: calls Gemini vision with a structured-output schema so the
//     response maps directly onto DetectedError fields.
//
// Coordinate system for locationOnScan: { x, y, z, w }, all normalised 0-1
// against the full page image, where x,y is the box's top-left corner and
// z,w are its width and height. Chosen here in the absence of a written
// agreement with Person 4 (the review screen owner) - confirm this still
// matches what they render before wiring the real screen up.

import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { ERROR_CATEGORIES, Sample } from "../models/sample.js";

// Confidence threshold that drives the "uncertain - AI needs your judgement"
// state. 0.6 is picked so a roughly coin-flip guess (0.5) always gets a human
// look, while confident calls (0.8+) pass straight through. Tune via
// ERROR_CONFIDENCE_THRESHOLD once real model output can be checked against
// teacher corrections.
export const CONFIDENCE_THRESHOLD_DEFAULT = 0.6;

export function getConfidenceThreshold() {
  const fromEnv = Number(process.env.ERROR_CONFIDENCE_THRESHOLD);
  return Number.isFinite(fromEnv) && fromEnv >= 0 && fromEnv <= 1
    ? fromEnv
    : CONFIDENCE_THRESHOLD_DEFAULT;
}

export function isUncertain(detectedError, threshold = getConfidenceThreshold()) {
  return detectedError.confidenceScore < threshold;
}

class TimeoutError extends Error {}

function readConfig() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return {
    apiKey,
    useMock: process.env.USE_MOCK_AI
      ? process.env.USE_MOCK_AI === "true"
      : apiKey === "",
    // "-latest" alias rather than a pinned version: pinned Gemini models get
    // retired for new API keys (gemini-2.5-flash already 404s), and this
    // project needs to keep working past any one model's lifetime.
    modelName: process.env.GEMINI_MODEL_NAME || "gemini-flash-latest",
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 30000,
    maxRetries: Number(process.env.GEMINI_MAX_RETRIES) || 2,
  };
}

// ---------------------------------------------------------------------------
// Mock mode
// ---------------------------------------------------------------------------

// One example per category, plus one deliberately low-confidence entry so
// the "uncertain" UI state has something real to render against.
const MOCK_REPORT = {
  illegibleNote: "",
  errors: [
    {
      written: "beacuse",
      intended: "because",
      category: "phonological",
      confidenceScore: 0.92,
      note: "Sounded-out spelling; 'because' misheard as 'beacuse'.",
      locationOnScan: { x: 0.12, y: 0.18, z: 0.14, w: 0.05 },
    },
    {
      written: "recieve",
      intended: "receive",
      category: "orthographic",
      confidenceScore: 0.88,
      note: "'i before e' spelling rule reversed.",
      locationOnScan: { x: 0.35, y: 0.18, z: 0.13, w: 0.05 },
    },
    {
      written: "goed",
      intended: "went",
      category: "morphological",
      confidenceScore: 0.81,
      note: "Regular past-tense '-ed' applied to an irregular verb.",
      locationOnScan: { x: 0.55, y: 0.3, z: 0.1, w: 0.05 },
    },
    {
      written: "i",
      intended: "I",
      category: "capitalisation",
      confidenceScore: 0.95,
      note: "First-person pronoun not capitalised.",
      locationOnScan: { x: 0.1, y: 0.42, z: 0.03, w: 0.05 },
    },
    {
      written: "dont",
      intended: "don't",
      category: "punctuation",
      confidenceScore: 0.9,
      note: "Missing apostrophe in the contraction.",
      locationOnScan: { x: 0.2, y: 0.42, z: 0.09, w: 0.05 },
    },
    {
      written: "fone",
      intended: "phone",
      category: "unsure",
      confidenceScore: 0.35,
      note: "Could be a phonological respelling of 'phone' or a proper noun - low confidence.",
      locationOnScan: { x: 0.4, y: 0.55, z: 0.1, w: 0.05 },
    },
  ],
};

// Mock-mode convention so the FAILED path can be exercised without a real
// broken file or an API key: a sample whose imagePath or original filename
// contains "corrupt" (case-insensitive) simulates an unreadable upload.
// Documented in server/README.md.
function runMockAnalysis(sample) {
  const looksCorrupt =
    /corrupt/i.test(sample.imagePath || "") ||
    /corrupt/i.test(sample.originalFilename || "");
  if (looksCorrupt) {
    throw new Error(`Could not read the uploaded image at "${sample.imagePath}"`);
  }
  return structuredClone(MOCK_REPORT);
}

// ---------------------------------------------------------------------------
// Real Gemini vision integration
// ---------------------------------------------------------------------------

function mimeTypeFor(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".pdf") return "application/pdf";
  throw new Error(`Unsupported image type "${ext}" for analysis`);
}

function buildPrompt(sample) {
  const categoryList = ERROR_CATEGORIES.map((category) => `- ${category}`).join("\n");

  let answerKeyNote = "";
  if (sample.taskType !== "ESSAY" && sample.answerKey) {
    answerKeyNote = `\nThe expected answer for this task is: "${sample.answerKey}". Use it ONLY to help you read unclear handwriting. Never use it to judge whether the student's answer is "correct", and never let it change the "written" field - "written" must always be exactly what the student wrote, spelling and all.\n`;
  }

  return `You are analysing a scanned page of a child's handwritten schoolwork for a literacy-support tool.
Read the handwriting exactly as the child wrote it and flag every spelling, grammar and punctuation error you find. Do not silently correct anything - "written" must always be the child's original text.

For each error, classify it into exactly one of these categories:
${categoryList}
Use "unsure" only when you genuinely cannot decide between the other categories.
${answerKeyNote}
For each error return:
- written: the word or phrase exactly as the child wrote it.
- intended: your best guess at the word or phrase the child meant.
- category: one of the categories above.
- confidenceScore: a number from 0 to 1 for how confident you are in this category assignment.
- note: one short, plain-language sentence explaining the error, written for a teacher.
- locationOnScan: a bounding box around the error on the page, normalised to the image size (0 to 1), as { x, y, z, w } where x,y is the top-left corner and z,w are the width and height.

Also return illegibleNote: a short note describing any part of the page you could not read, or an empty string if everything was legible.

Return only the JSON described by the response schema - no extra commentary.`;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    illegibleNote: { type: "string" },
    errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          written: { type: "string" },
          intended: { type: "string" },
          category: { type: "string", enum: ERROR_CATEGORIES },
          confidenceScore: { type: "number" },
          note: { type: "string" },
          locationOnScan: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              z: { type: "number" },
              w: { type: "number" },
            },
            required: ["x", "y", "z", "w"],
          },
        },
        required: ["written", "intended", "category", "confidenceScore", "locationOnScan"],
      },
    },
  },
  required: ["illegibleNote", "errors"],
};

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`Gemini request timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateAnalysisResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Analysis result must be an object");
  }
  if (typeof result.illegibleNote !== "string") {
    throw new Error("illegibleNote must be a string");
  }
  if (!Array.isArray(result.errors)) {
    throw new Error("errors must be an array");
  }
  result.errors.forEach((detectedError, index) => {
    if (!detectedError || typeof detectedError.written !== "string" || detectedError.written.trim() === "") {
      throw new Error(`errors[${index}].written must be a non-empty string`);
    }
    if (typeof detectedError.intended !== "string") {
      throw new Error(`errors[${index}].intended must be a string`);
    }
    if (!ERROR_CATEGORIES.includes(detectedError.category)) {
      throw new Error(
        `errors[${index}].category "${detectedError.category}" is not one of ${ERROR_CATEGORIES.join(", ")}`
      );
    }
    if (
      typeof detectedError.confidenceScore !== "number" ||
      detectedError.confidenceScore < 0 ||
      detectedError.confidenceScore > 1
    ) {
      throw new Error(`errors[${index}].confidenceScore must be a number between 0 and 1`);
    }
    const box = detectedError.locationOnScan;
    const hasValidBox =
      box && ["x", "y", "z", "w"].every((key) => typeof box[key] === "number" && box[key] >= 0 && box[key] <= 1);
    if (!hasValidBox) {
      throw new Error(`errors[${index}].locationOnScan must have x, y, z, w numbers between 0 and 1`);
    }
  });
  return result;
}

// NOTE: written against @google/genai, Google's current unified Gemini SDK.
// This is the piece most likely to drift as the SDK evolves - if
// `ai.models.generateContent` or the response shape has changed by the time
// this is wired up for real, check the current Gemini API docs and adjust
// this function; nothing else in this file depends on the SDK shape.
async function callModelWithRetry(ai, parts, config) {
  let lastError;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      const result = await withTimeout(
        ai.models.generateContent({
          model: config.modelName,
          contents: [{ role: "user", parts }],
          config: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        config.timeoutMs
      );
      const parsed = JSON.parse(result.text);
      return validateAnalysisResult(parsed);
    } catch (err) {
      lastError = err;
      if (attempt < config.maxRetries) {
        await sleep(500 * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

async function runRealAnalysis(sample, config) {
  if (!config.apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  let imageBytes;
  try {
    imageBytes = await fs.readFile(sample.imagePath);
  } catch {
    throw new Error(`Could not read the uploaded image at "${sample.imagePath}"`);
  }

  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const parts = [
    { text: buildPrompt(sample) },
    { inlineData: { mimeType: mimeTypeFor(sample.imagePath), data: imageBytes.toString("base64") } },
  ];

  return callModelWithRetry(ai, parts, config);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ErrorClassificationEngine.analyse(sample) - runs mock or real analysis and
// returns the fields Sample needs updated: { errors, illegibleNote }.
export async function analyseSample(sample) {
  const config = readConfig();
  const result = config.useMock ? runMockAnalysis(sample) : await runRealAnalysis(sample, config);

  return {
    illegibleNote: result.illegibleNote,
    errors: result.errors.map((detectedError) => ({
      written: detectedError.written,
      intended: detectedError.intended,
      category: detectedError.category,
      confidenceScore: detectedError.confidenceScore,
      note: detectedError.note || "",
      locationOnScan: detectedError.locationOnScan,
      dismissed: false,
    })),
  };
}

export function describeFailure(err) {
  if (err instanceof TimeoutError) {
    return "Analysis timed out. The image may be too large, or the AI service is slow to respond.";
  }
  if (err instanceof Error && err.message.startsWith("Could not read the uploaded image")) {
    return err.message;
  }
  if (err instanceof Error && err.message === "GEMINI_API_KEY is not configured") {
    return "Analysis is not configured (missing GEMINI_API_KEY).";
  }
  return "Analysis failed: the AI could not produce a usable error report for this sample.";
}

// The background job. Call this after the 202 response for a sample upload
// has already been sent (do not await it in the request handler). Always
// resolves the sample to ANALYSED or FAILED - it never leaves a sample
// stuck mid-analysis, even if Gemini errors out after every retry.
export async function runAnalysis(sampleId) {
  const sample = await Sample.findById(sampleId);
  if (!sample) {
    console.error(`runAnalysis: no sample found for id ${sampleId}`);
    return;
  }

  try {
    const { errors, illegibleNote } = await analyseSample(sample);
    sample.errors = errors;
    sample.illegibleNote = illegibleNote;
    sample.analysisError = "";
    sample.status = "ANALYSED";
  } catch (err) {
    sample.status = "FAILED";
    sample.analysisError = describeFailure(err);
  }

  await sample.save();
}

const ErrorClassificationEngine = { analyse: analyseSample };
export default ErrorClassificationEngine;
