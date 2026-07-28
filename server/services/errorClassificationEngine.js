// services/errorClassificationEngine.js
// -------------------------------------
// The AI core: takes an uploaded Sample and returns { errors, illegibleNote },
// the two fields Sample has room for. Errors are embedded on Sample, so there
// is no separate SampleReport model to write.
//
// Setup, environment variables, the locationOnScan coordinate system and how
// to wire this into the upload route are all documented in server/README.md.
//
// The coordinate system was chosen here in the absence of a written agreement
// with Person 4 (the review screen owner) - confirm it still matches what they
// render before wiring up the real review screen.

import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { ERROR_CATEGORIES, Sample } from '../models/sample.js';

// Thrown and matched in one place, so the wording can change freely.
const MISSING_API_KEY = 'GEMINI_API_KEY is not configured';

// Confidence threshold that drives the "uncertain - AI needs your judgement"
// state. 0.6 is picked so a roughly coin-flip guess (0.5) always gets a human
// look, while confident calls (0.8+) pass straight through. Tune via
// ERROR_CONFIDENCE_THRESHOLD once real model output can be checked against
// teacher corrections.
export const CONFIDENCE_THRESHOLD_DEFAULT = 0.6;

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export function getConfidenceThreshold() {
  const threshold = numberFromEnv('ERROR_CONFIDENCE_THRESHOLD', CONFIDENCE_THRESHOLD_DEFAULT);
  return threshold >= 0 && threshold <= 1 ? threshold : CONFIDENCE_THRESHOLD_DEFAULT;
}

export function isUncertain(detectedError, threshold = getConfidenceThreshold()) {
  return detectedError.confidenceScore < threshold;
}

// Exported so callers can tell a timed-out analysis apart from other
// failures (see describeFailure below).
export class TimeoutError extends Error {}

function readConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY || '',
    // "-latest" alias rather than a pinned version: pinned Gemini models get
    // retired for new API keys (gemini-2.5-flash already 404s), and this
    // project needs to keep working past any one model's lifetime.
    modelName: process.env.GEMINI_MODEL_NAME || 'gemini-flash-latest',
    timeoutMs: numberFromEnv('GEMINI_TIMEOUT_MS', 30000),
    maxRetries: numberFromEnv('GEMINI_MAX_RETRIES', 2),
    // Base backoff delay, doubled per attempt. Configurable mainly so the
    // test suite can set it to 0 instead of really sleeping through retries.
    retryBaseMs: numberFromEnv('GEMINI_RETRY_BASE_MS', 500),
  };
}

function mimeTypeFor(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.pdf') return 'application/pdf';
  throw new Error(`Unsupported image type "${ext}" for analysis`);
}

function buildPrompt(sample) {
  const categoryList = ERROR_CATEGORIES.map((category) => `- ${category}`).join('\n');
  const pageCount = (sample.pages || []).length;

  let answerKeyNote = '';
  if (sample.taskType !== 'ESSAY' && sample.answerKey) {
    answerKeyNote = `\nThe expected answer for this task is: "${sample.answerKey}". Use it ONLY to help you read unclear handwriting. Never use it to judge whether the student's answer is "correct", and never let it change the "written" field - "written" must always be exactly what the student wrote, spelling and all.\n`;
  }

  const pageNote =
    pageCount > 1
      ? `This sample has ${pageCount} pages, provided as ${pageCount} images in order (the first image is page 0, the second is page 1, and so on). Treat them as one continuous piece of writing - an error can start on one page and finish on the next.`
      : `This sample has a single page, provided as one image (page 0).`;

  return `You are analysing a scanned, possibly multi-page piece of a child's handwritten schoolwork for a literacy-support tool.
${pageNote}
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
- locationOnScan: a bounding box around the error, as { page, x, y, z, w } - page is the 0-based index of the image the error appears on, and x, y, z, w are normalised to that image's size (0 to 1), where x,y is the top-left corner and z,w are the width and height.

Also return illegibleNote: a short note describing any part of the page(s) you could not read, or an empty string if everything was legible.

Return only the JSON described by the response schema - no extra commentary.`;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    illegibleNote: { type: 'string' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          written: { type: 'string' },
          intended: { type: 'string' },
          category: { type: 'string', enum: ERROR_CATEGORIES },
          confidenceScore: { type: 'number' },
          note: { type: 'string' },
          locationOnScan: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              x: { type: 'number' },
              y: { type: 'number' },
              z: { type: 'number' },
              w: { type: 'number' },
            },
            required: ['page', 'x', 'y', 'z', 'w'],
          },
        },
        required: ['written', 'intended', 'category', 'confidenceScore', 'locationOnScan'],
      },
    },
  },
  required: ['illegibleNote', 'errors'],
};

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`Gemini request timed out after ${ms}ms`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const inUnitRange = (value) => typeof value === 'number' && value >= 0 && value <= 1;

// Returns a message describing the first thing wrong with one detected error,
// or null if it is well-formed. The caller adds the `errors[i].` prefix.
function findProblem(detectedError, pageCount) {
  const box = detectedError?.locationOnScan;

  if (
    !detectedError ||
    typeof detectedError.written !== 'string' ||
    !detectedError.written.trim()
  ) {
    return 'written must be a non-empty string';
  }
  if (typeof detectedError.intended !== 'string') {
    return 'intended must be a string';
  }
  if (!ERROR_CATEGORIES.includes(detectedError.category)) {
    return `category "${detectedError.category}" is not one of ${ERROR_CATEGORIES.join(', ')}`;
  }
  if (!inUnitRange(detectedError.confidenceScore)) {
    return 'confidenceScore must be a number between 0 and 1';
  }
  if (!box || !['x', 'y', 'z', 'w'].every((key) => inUnitRange(box[key]))) {
    return 'locationOnScan must have x, y, z, w numbers between 0 and 1';
  }
  if (!Number.isInteger(box.page) || box.page < 0 || box.page >= pageCount) {
    return `locationOnScan.page must be a valid page index (0-${pageCount - 1})`;
  }
  return null;
}

// pageCount is the number of pages the sample actually has, so a page index
// the model invented is caught here rather than silently stored.
export function validateAnalysisResult(result, pageCount) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Analysis result must be an object');
  }
  if (typeof result.illegibleNote !== 'string') {
    throw new Error('illegibleNote must be a string');
  }
  if (!Array.isArray(result.errors)) {
    throw new Error('errors must be an array');
  }
  result.errors.forEach((detectedError, index) => {
    const problem = findProblem(detectedError, pageCount);
    if (problem) throw new Error(`errors[${index}].${problem}`);
  });
  return result;
}

// NOTE: written against @google/genai, Google's current unified Gemini SDK.
// This is the piece most likely to drift as the SDK evolves - if
// `ai.models.generateContent` or the response shape has changed by the time
// this is wired up for real, check the current Gemini API docs and adjust
// this function; nothing else in this file depends on the SDK shape.
async function callModelWithRetry(ai, parts, config, pageCount) {
  let lastError;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      const result = await withTimeout(
        ai.models.generateContent({
          model: config.modelName,
          contents: [{ role: 'user', parts }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        config.timeoutMs
      );
      return validateAnalysisResult(JSON.parse(result.text), pageCount);
    } catch (err) {
      lastError = err;
      if (attempt < config.maxRetries) {
        await sleep(config.retryBaseMs * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

async function readPageParts(pages) {
  const parts = [];
  for (const page of pages) {
    // mimeTypeFor first: an unsupported extension is a bad upload, not an
    // unreadable file, and it should say so rather than blaming the disk.
    const mimeType = mimeTypeFor(page.imagePath);
    let data;
    try {
      data = await fs.readFile(page.imagePath, 'base64');
    } catch {
      throw new Error(`Could not read the uploaded image at "${page.imagePath}"`);
    }
    parts.push({ inlineData: { mimeType, data } });
  }
  return parts;
}

// Analyses a sample and returns the fields Sample needs updated.
//
// `client` is a test seam: pass a stub with the same shape as the Gemini SDK
// (`{ models: { generateContent } }`) to exercise this without a live API
// call. Application code never passes it.
export async function analyseSample(sample, { client } = {}) {
  const config = readConfig();
  // Only a real run needs a key - an injected client brings its own transport.
  if (!client && !config.apiKey) {
    throw new Error(MISSING_API_KEY);
  }

  const pages = sample.pages || [];
  // Every page goes into the same request, in upload order, so the model can
  // read an error that spans a page break and so its reported `page` index
  // lines up with this order.
  const parts = [{ text: buildPrompt(sample) }, ...(await readPageParts(pages))];
  const ai = client ?? new GoogleGenAI({ apiKey: config.apiKey });

  const result = await callModelWithRetry(ai, parts, config, pages.length);

  return {
    illegibleNote: result.illegibleNote,
    errors: result.errors.map((detectedError) => ({
      written: detectedError.written,
      intended: detectedError.intended,
      category: detectedError.category,
      confidenceScore: detectedError.confidenceScore,
      note: detectedError.note || '',
      locationOnScan: detectedError.locationOnScan,
      dismissed: false,
    })),
  };
}

// Messages that are already written for an educator and pass straight through.
const PASS_THROUGH_PREFIXES = ['Could not read the uploaded image', 'Unsupported image type'];

export function describeFailure(err) {
  if (err instanceof TimeoutError) {
    return 'Analysis timed out. The image may be too large, or the AI service is slow to respond.';
  }
  const message = err instanceof Error ? err.message : '';
  if (message === MISSING_API_KEY) {
    return 'Analysis is not configured (missing GEMINI_API_KEY).';
  }
  if (PASS_THROUGH_PREFIXES.some((prefix) => message.startsWith(prefix))) {
    return message;
  }
  // Just the reason - the caller (UI, log line) supplies the "analysis
  // failed" framing, so repeating it here reads twice on screen.
  return 'The AI could not produce a usable error report for this sample.';
}

// The background job. Call this after the upload response for a sample has
// already been sent (do not await it in the request handler). Always resolves
// the sample to ANALYSED or FAILED - it never leaves a sample stuck
// mid-analysis, even if Gemini errors out after every retry.
export async function runAnalysis(sampleId, { client } = {}) {
  // Outer guard: this runs fire-and-forget, so nothing is waiting to catch a
  // rejection. Reading the sample or saving it can still fail (unreachable
  // database, malformed id) and an unhandled rejection would take the whole
  // server down - so the job logs and gives up quietly instead of throwing.
  try {
    const sample = await Sample.findById(sampleId);
    if (!sample) {
      console.error(`runAnalysis: no sample found for id ${sampleId}`);
      return;
    }

    // Inner guard: an analysis that fails is a normal outcome, not a crash.
    // It decides which status gets written, and the save below records it.
    try {
      const { errors, illegibleNote } = await analyseSample(sample, { client });
      sample.errors = errors;
      sample.illegibleNote = illegibleNote;
      sample.analysisError = '';
      sample.status = 'ANALYSED';
    } catch (err) {
      sample.status = 'FAILED';
      sample.analysisError = describeFailure(err);
    }

    await sample.save();
  } catch (err) {
    console.error(`runAnalysis: could not persist analysis for ${sampleId}:`, err);
  }
}

// Not public API. Exposed only so the unit tests can drive the retry,
// timeout and prompt-construction logic directly. Do not import these from
// application code.
export const __testing = { callModelWithRetry, buildPrompt, mimeTypeFor };
