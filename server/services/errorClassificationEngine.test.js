// Unit tests for the Error Classification Engine.
// Run with: npm test  (see package.json - runs `node --test`)
//
// These exercise the pure classification logic (mock analysis, validation,
// confidence-threshold flagging, failure messaging) directly, without a
// database connection. runAnalysis() itself touches Mongoose/Sample and is
// left to integration testing once the upload endpoint (Person 2) exists.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  analyseSample,
  validateAnalysisResult,
  isUncertain,
  getConfidenceThreshold,
  describeFailure,
  CONFIDENCE_THRESHOLD_DEFAULT,
} from "./errorClassificationEngine.js";
import { ERROR_CATEGORIES } from "../models/sample.js";

describe("analyseSample (mock mode)", () => {
  test("returns one error per fixed category with valid fields", async () => {
    const sample = { imagePath: "uploads/sample-1.png", taskType: "ESSAY" };
    const report = await analyseSample(sample);

    assert.equal(typeof report.illegibleNote, "string");
    assert.ok(Array.isArray(report.errors));
    assert.ok(report.errors.length > 0);

    // The fixture promises downstream slices an example of every category.
    const covered = new Set(report.errors.map((e) => e.category));
    for (const category of ERROR_CATEGORIES) {
      assert.ok(covered.has(category), `fixture missing an example of "${category}"`);
    }

    for (const detectedError of report.errors) {
      assert.ok(ERROR_CATEGORIES.includes(detectedError.category), `unexpected category: ${detectedError.category}`);
      assert.equal(typeof detectedError.written, "string");
      assert.notEqual(detectedError.written.trim(), "");
      assert.equal(typeof detectedError.confidenceScore, "number");
      assert.ok(detectedError.confidenceScore >= 0 && detectedError.confidenceScore <= 1);
      assert.equal(detectedError.dismissed, false);
      for (const key of ["x", "y", "z", "w"]) {
        assert.equal(typeof detectedError.locationOnScan[key], "number");
        assert.ok(detectedError.locationOnScan[key] >= 0 && detectedError.locationOnScan[key] <= 1);
      }
    }
  });

  test("includes at least one below-threshold error for the uncertain UI state", async () => {
    const sample = { imagePath: "uploads/sample-1.png", taskType: "ESSAY" };
    const report = await analyseSample(sample);

    const uncertainErrors = report.errors.filter((detectedError) => isUncertain(detectedError));
    assert.ok(uncertainErrors.length > 0, "expected at least one error below the confidence threshold");
  });

  test("simulates a corrupt/unreadable file when imagePath contains 'corrupt'", async () => {
    const sample = { imagePath: "uploads/corrupt-scan.png", taskType: "ESSAY" };
    await assert.rejects(() => analyseSample(sample), /Could not read the uploaded image/);
  });
});

describe("validateAnalysisResult", () => {
  const validResult = {
    illegibleNote: "",
    errors: [
      {
        written: "teh",
        intended: "the",
        category: "orthographic",
        confidenceScore: 0.9,
        note: "Transposed letters.",
        locationOnScan: { x: 0.1, y: 0.1, z: 0.05, w: 0.05 },
      },
    ],
  };

  test("accepts a well-formed result", () => {
    assert.doesNotThrow(() => validateAnalysisResult(validResult));
  });

  test("rejects an unknown category", () => {
    const bad = structuredClone(validResult);
    bad.errors[0].category = "not-a-real-category";
    assert.throws(() => validateAnalysisResult(bad), /category/);
  });

  test("rejects an out-of-range confidenceScore", () => {
    const bad = structuredClone(validResult);
    bad.errors[0].confidenceScore = 1.5;
    assert.throws(() => validateAnalysisResult(bad), /confidenceScore/);
  });

  test("rejects an out-of-range locationOnScan", () => {
    const bad = structuredClone(validResult);
    bad.errors[0].locationOnScan.x = 2;
    assert.throws(() => validateAnalysisResult(bad), /locationOnScan/);
  });

  test("rejects a missing written field", () => {
    const bad = structuredClone(validResult);
    bad.errors[0].written = "";
    assert.throws(() => validateAnalysisResult(bad), /written/);
  });

  test("rejects a non-array errors field", () => {
    const bad = { illegibleNote: "", errors: "not an array" };
    assert.throws(() => validateAnalysisResult(bad), /errors must be an array/);
  });
});

describe("confidence threshold", () => {
  test("defaults to CONFIDENCE_THRESHOLD_DEFAULT when unset", () => {
    delete process.env.ERROR_CONFIDENCE_THRESHOLD;
    assert.equal(getConfidenceThreshold(), CONFIDENCE_THRESHOLD_DEFAULT);
  });

  test("honours a valid ERROR_CONFIDENCE_THRESHOLD override", () => {
    process.env.ERROR_CONFIDENCE_THRESHOLD = "0.8";
    assert.equal(getConfidenceThreshold(), 0.8);
    delete process.env.ERROR_CONFIDENCE_THRESHOLD;
  });

  test("falls back to the default for an out-of-range override", () => {
    process.env.ERROR_CONFIDENCE_THRESHOLD = "5";
    assert.equal(getConfidenceThreshold(), CONFIDENCE_THRESHOLD_DEFAULT);
    delete process.env.ERROR_CONFIDENCE_THRESHOLD;
  });

  test("isUncertain flags scores below the threshold", () => {
    assert.equal(isUncertain({ confidenceScore: 0.3 }, 0.6), true);
    assert.equal(isUncertain({ confidenceScore: 0.9 }, 0.6), false);
  });
});

describe("describeFailure", () => {
  test("produces a human-readable message, never a raw stack trace", () => {
    const message = describeFailure(new Error("some internal detail"));
    assert.equal(typeof message, "string");
    assert.ok(!message.includes("at "), "message should not look like a stack trace");
  });

  test("passes through the unreadable-image message unchanged", () => {
    const err = new Error('Could not read the uploaded image at "uploads/x.png"');
    assert.equal(describeFailure(err), err.message);
  });

  test("explains a missing API key", () => {
    const err = new Error("GEMINI_API_KEY is not configured");
    assert.match(describeFailure(err), /GEMINI_API_KEY/);
  });
});
