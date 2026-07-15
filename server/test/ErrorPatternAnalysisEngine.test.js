import test from "node:test";
import assert from "node:assert/strict";
import {
  buildErrorPatternReport,
  interventionTracks,
} from "../services/ErrorPatternAnalysisEngine.js";

test("buildErrorPatternReport returns contextual omission errors and summary analytics", () => {
  const report = buildErrorPatternReport("cat", "cart");

  assert.deepEqual(report, {
    summary: {
      total_characters_analyzed: 3,
      total_errors: 1,
      error_percentage: "33.3%",
      primary_prevention_track: interventionTracks.omission_error,
    },
    errors: [
      {
        value: "r",
        category: "omission_error",
        track: interventionTracks.omission_error,
        context_snippet: "cat",
      },
    ],
  });
});

test("buildErrorPatternReport returns contextual addition errors and summary analytics", () => {
  const report = buildErrorPatternReport("caart", "cart");

  assert.deepEqual(report, {
    summary: {
      total_characters_analyzed: 5,
      total_errors: 1,
      error_percentage: "20.0%",
      primary_prevention_track: interventionTracks.addition_error,
    },
    errors: [
      {
        value: "a",
        category: "addition_error",
        track: interventionTracks.addition_error,
        context_snippet: "caart",
      },
    ],
  });
});

test("context snippets include nearby raw text and mark clipped boundaries", () => {
  const raw = "This long prefix says I was So ahchen that I peed after class.";
  const corrected = "This long prefix says I was So  that I peed after class.";
  const [error] = buildErrorPatternReport(raw, corrected).errors;

  assert.equal(error.category, "addition_error");
  assert.match(error.context_snippet, /^\.\.\./);
  assert.match(error.context_snippet, /So ahchen that I/);
  assert.match(error.context_snippet, /\.\.\.$/);
});

test("buildErrorPatternReport omits correct tokens from an error-free report", () => {
  assert.deepEqual(buildErrorPatternReport("same", "same"), {
    summary: {
      total_characters_analyzed: 4,
      total_errors: 0,
      error_percentage: "0.0%",
      primary_prevention_track: null,
    },
    errors: [],
  });
});
