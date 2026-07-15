import test from "node:test";
import assert from "node:assert/strict";
import {
  buildErrorPatternReport,
  interventionTracks,
} from "../services/ErrorPatternAnalysisEngine.js";

test("intervention tracks use the documented dyslexia taxonomy", () => {
  assert.deepEqual(Object.keys(interventionTracks), [
    "phonological",
    "orthographic",
    "morphological",
    "spelling",
    "grammar",
  ]);
});

test("added diff tokens use the phonological taxonomy", () => {
  const report = buildErrorPatternReport(
    "I have a cat. It is cute.",
    "I have a cart. It is cute."
  );

  assert.deepEqual(report.errors, [
    {
      value: "cat → cart",
      category: "phonological",
      track: interventionTracks.phonological,
      context_snippet: "I have a cat.",
    },
  ]);
  assert.deepEqual(report.summary, {
    total_characters_analyzed: 25,
    total_errors: 1,
    error_percentage: "4.0%",
    primary_prevention_track: interventionTracks.phonological,
  });
});

test("removed diff tokens use the orthographic taxonomy", () => {
  const report = buildErrorPatternReport(
    "Before sentence. I was So ahchen\nthat I peed after class. Next sentence.",
    "Before sentence. I was So achen\nthat I peed after class. Next sentence."
  );

  assert.deepEqual(report.errors, [
    {
      value: "ahchen → achen",
      category: "orthographic",
      track: interventionTracks.orthographic,
      context_snippet: "I was So ahchen\nthat I peed after class.",
    },
  ]);
});

test("adjacent added and removed tokens use the spelling taxonomy", () => {
  const report = buildErrorPatternReport("Bay is here.", "Day is here.");

  assert.deepEqual(report.errors, [
    {
      value: "Bay → Day",
      category: "spelling",
      track: interventionTracks.spelling,
      context_snippet: "Bay is here.",
    },
  ]);
  assert.equal(report.summary.total_errors, 1);
  assert.equal(
    report.summary.primary_prevention_track,
    interventionTracks.spelling
  );
});

test("multiple character changes in one word remain one spelling card", () => {
  const report = buildErrorPatternReport(
    "Her face turned pail.",
    "Her face turned pale."
  );

  assert.deepEqual(report.errors, [
    {
      value: "pail → pale",
      category: "spelling",
      track: interventionTracks.spelling,
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
