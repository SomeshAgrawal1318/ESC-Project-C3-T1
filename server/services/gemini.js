// services/gemini.js
// -------------------
// Everything that talks to the Gemini API lives here, so the rest of the app
// never needs to know how the AI is called.
//
// The public function is analyseImage(imagePath, answerKey): it sends the
// scanned image plus our prompt to a free-tier Gemini Flash vision model,
// in ONE request, and returns the flagged errors.
//
// SDK note: this uses @google/genai (Google's current official Node SDK) and
// its stable `models.generateContent` method. The SDK also has a newer
// `interactions` API, but as of v1.52 the SDK itself warns that it is
// experimental, so we stay on the stable one.

import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { config } from "../config/config.js";
import { buildPromptWithAnswerKey } from "./geminiPrompt.js";
import { ERROR_CATEGORIES } from "../models/Sample.js";

// One shared client for the whole app, created on FIRST USE rather than at
// startup - analyseImage checks the key exists first, so a missing key gives
// our clear error message instead of a confusing SDK warning.
let geminiClient = null;
function getGeminiClient() {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return geminiClient;
}

// ---------------------------------------------------------------------------
// Small helpers, one job each
// ---------------------------------------------------------------------------

// The API needs to know what kind of image it is receiving.
// We work that out from the file extension of the uploaded file.
function getMimeType(imagePath) {
  const extension = path.extname(imagePath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  const mimeType = mimeTypes[extension];
  if (!mimeType) {
    throw new Error(
      `Unsupported image type "${extension}". Please upload a JPG, PNG or WebP file.`
    );
  }
  return mimeType;
}

// Base64 encoding turns the image file's raw bytes into plain text
// (letters, digits, + and /), which is the only way to carry a binary
// file inside a JSON API request.
function readImageAsBase64(imagePath) {
  if (!fs.existsSync(imagePath)) {
    throw new Error(
      `The uploaded image could not be found on disk at "${imagePath}". ` +
        `It may have been moved or deleted - try uploading the sample again.`
    );
  }
  return fs.readFileSync(imagePath, { encoding: "base64" });
}

// Pause for the given number of milliseconds (used between retries).
function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Is this error Gemini telling us "slow down"? The free tier allows only
// about 10 requests per minute, so hitting this is normal, not a bug.
function isRateLimitError(error) {
  const errorText = `${error.status || ""} ${error.message || ""}`;
  return errorText.includes("429") || errorText.includes("RESOURCE_EXHAUSTED");
}

// Call Gemini, retrying with exponential backoff on rate-limit errors:
// wait 2s, then 4s, then 8s. "Exponential" (doubling) matters because the
// free tier's limit is per-minute - if 2 seconds wasn't enough, a longer
// wait is more likely to land in a fresh minute than hammering again.
async function callGeminiWithRetry(requestContents) {
  const maxAttempts = 4;
  let waitMilliseconds = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await getGeminiClient().models.generateContent({
        model: config.geminiModel,
        contents: requestContents,
      });
      // The SDK gathers the model's text output for us on response.text.
      return response.text;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      if (isRateLimitError(error) && !isLastAttempt) {
        console.log(
          `Gemini rate limit hit (free tier is ~10 requests/minute). ` +
            `Waiting ${waitMilliseconds / 1000}s before attempt ${attempt + 1}...`
        );
        await wait(waitMilliseconds);
        waitMilliseconds = waitMilliseconds * 2;
      } else {
        // Not a rate limit (or we're out of retries) - let the route's
        // error handler turn this into a readable message.
        throw error;
      }
    }
  }
}

// Gemini is asked to return only JSON, but models sometimes wrap their
// answer in ```json ... ``` code fences anyway. Strip those before parsing,
// and fail with a clear message if what remains still isn't valid JSON.
function parseGeminiJson(rawText) {
  if (!rawText || rawText.trim() === "") {
    throw new Error("Gemini returned an empty response. Please try again.");
  }

  const withoutFences = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch (parseError) {
    throw new Error(
      "Gemini's response was not valid JSON, so the errors could not be " +
        "read. This is usually a one-off - please try the analysis again."
    );
  }
}

// The AI's output crosses a trust boundary here: before anything reaches the
// database, make sure each error has the fields we expect and a category
// from our fixed vocabulary (anything unrecognised becomes "unsure").
function cleanUpErrors(parsedErrors) {
  if (!Array.isArray(parsedErrors)) {
    return [];
  }

  return parsedErrors
    .filter((error) => error && typeof error.written === "string" && error.written !== "")
    .map((error) => {
      const category = ERROR_CATEGORIES.includes(error.category)
        ? error.category
        : "unsure";
      return {
        written: error.written, // exactly as the child wrote it - never touched
        intended: typeof error.intended === "string" ? error.intended : "",
        category: category,
        note: typeof error.note === "string" ? error.note : "",
        dismissed: false, // every fresh AI result starts un-dismissed
      };
    });
}

// ---------------------------------------------------------------------------
// The public function
// ---------------------------------------------------------------------------

// Sends the child's scanned work to Gemini and returns:
//   { errors: [...], illegibleNote: "..." }
// One image, one API call - the analysis happens in a single step.
export async function analyseImage(imagePath, answerKey) {
  if (!config.geminiApiKey) {
    throw new Error(
      "No Gemini API key is set. Get a free key at https://aistudio.google.com/apikey " +
        "and put it in server/.env as GEMINI_API_KEY, then restart the server."
    );
  }

  const prompt = buildPromptWithAnswerKey(answerKey);
  const imageBase64 = readImageAsBase64(imagePath);
  const mimeType = getMimeType(imagePath);

  // One request containing two parts: the image itself (as base64 text)
  // and our instructions for how to analyse it.
  const requestContents = [
    { inlineData: { mimeType: mimeType, data: imageBase64 } },
    { text: prompt },
  ];

  const responseText = await callGeminiWithRetry(requestContents);
  const parsed = parseGeminiJson(responseText);

  return {
    errors: cleanUpErrors(parsed.errors),
    illegibleNote:
      typeof parsed.illegible_parts === "string" ? parsed.illegible_parts : "",
  };
}
