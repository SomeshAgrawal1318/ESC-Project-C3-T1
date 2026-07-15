import test from "node:test";
import assert from "node:assert/strict";
import {
  buildErrorPatternReport,
  interventionTracks,
} from "../services/ErrorPatternAnalysisEngine.js";

test("omission errors show whole words and a complete sentence", () => {
  const report = buildErrorPatternReport(
    "I have a cat. It is cute.",
    "I have a cart. It is cute."
  );

  assert.deepEqual(report.errors, [
    {
      value: "cat → cart",
      category: "omission_error",
      track: interventionTracks.omission_error,
      context_snippet: "I have a cat.",
    },
  ]);
  assert.deepEqual(report.summary, {
    total_characters_analyzed: 25,
    total_errors: 1,
    error_percentage: "4.0%",
    primary_prevention_track: interventionTracks.omission_error,
  });
});

test("addition errors show whole words without cutting context words", () => {
  const report = buildErrorPatternReport(
    "Before sentence. I was So ahchen\nthat I peed after class. Next sentence.",
    "Before sentence. I was So achen\nthat I peed after class. Next sentence."
  );

  assert.deepEqual(report.errors, [
    {
      value: "ahchen → achen",
      category: "addition_error",
      track: interventionTracks.addition_error,
      context_snippet: "I was So ahchen\nthat I peed after class.",
    },
  ]);
});

test("adjacent addition and omission tokens become one substitution card", () => {
  const report = buildErrorPatternReport("Bay is here.", "Day is here.");

  assert.deepEqual(report.errors, [
    {
      value: "Bay → Day",
      category: "substitution_error",
      track: interventionTracks.substitution_error,
      context_snippet: "Bay is here.",
    },
  ]);
  assert.equal(report.summary.total_errors, 1);
  assert.equal(
    report.summary.primary_prevention_track,
    interventionTracks.substitution_error
  );
});

test("multiple character changes in one word remain one substitution card", () => {
  const report = buildErrorPatternReport(
    "Her face turned pail.",
    "Her face turned pale."
  );

  assert.deepEqual(report.errors, [
    {
      value: "pail → pale",
      category: "substitution_error",
      track: interventionTracks.substitution_error,
      context_snippet: "Her face turned pail.",
    },
  ]);
});

test("whitespace-only layout differences do not create error cards", () => {
  const report = buildErrorPatternReport("Two words.", "Two  words.");

  assert.equal(report.summary.total_errors, 0);
  assert.deepEqual(report.errors, []);
});

test("non-word marks do not produce identical word comparisons", () => {
  const report = buildErrorPatternReport(
    "On ^sunny Monday.",
    "On sunny Monday."
  );

  assert.equal(report.errors[0].value, "^sunny → sunny");
  assert.equal(report.errors[0].context_snippet, "On ^sunny Monday.");
});

test("correct tokens remain absent from an error-free report", () => {
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
