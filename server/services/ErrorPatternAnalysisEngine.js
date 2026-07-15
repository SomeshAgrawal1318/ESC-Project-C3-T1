// services/ErrorPatternAnalysisEngine.js
// --------------------------------------
// Converts Team 1's raw/corrected transcription handoff into Team 2's minimal
// contextual character-error report.

import * as Diff from "diff";

export const interventionTracks = Object.freeze({
  omission_error: Object.freeze({
    trackId: "TRK_1",
    label: "Phonics Review",
  }),
  addition_error: Object.freeze({
    trackId: "TRK_2",
    label: "Letter Accuracy Review",
  }),
});

const CONTEXT_RADIUS = 15;

function buildContextSnippet(rawText, errorStart, errorLength) {
  const start = Math.max(0, errorStart - CONTEXT_RADIUS);
  const end = Math.min(
    rawText.length,
    errorStart + errorLength + CONTEXT_RADIUS
  );
  const prefix = start > 0 ? "..." : "";
  const suffix = end < rawText.length ? "..." : "";

  return `${prefix}${rawText.slice(start, end)}${suffix}`;
}

export function buildErrorPatternReport(rawText, correctedText) {
  const raw = typeof rawText === "string" ? rawText : "";
  const corrected = typeof correctedText === "string" ? correctedText : "";
  const errors = [];
  const categoryCounts = {
    omission_error: 0,
    addition_error: 0,
  };
  let currentRawIndex = 0;

  for (const token of Diff.diffChars(raw, corrected)) {
    if (token.added) {
      const category = "omission_error";
      errors.push({
        value: token.value,
        category,
        track: interventionTracks[category],
        context_snippet: buildContextSnippet(raw, currentRawIndex, 0),
      });
      categoryCounts[category] += 1;
      continue;
    }

    if (token.removed) {
      const category = "addition_error";
      errors.push({
        value: token.value,
        category,
        track: interventionTracks[category],
        context_snippet: buildContextSnippet(
          raw,
          currentRawIndex,
          token.value.length
        ),
      });
      categoryCounts[category] += 1;
      currentRawIndex += token.value.length;
      continue;
    }

    currentRawIndex += token.value.length;
  }

  let primaryCategory = null;
  for (const category of ["omission_error", "addition_error"]) {
    if (
      categoryCounts[category] > 0 &&
      (!primaryCategory ||
        categoryCounts[category] > categoryCounts[primaryCategory])
    ) {
      primaryCategory = category;
    }
  }

  const totalCharacters = raw.length;
  const errorPercentage = totalCharacters
    ? ((errors.length / totalCharacters) * 100).toFixed(1)
    : "0.0";

  return {
    summary: {
      total_characters_analyzed: totalCharacters,
      total_errors: errors.length,
      error_percentage: `${errorPercentage}%`,
      primary_prevention_track: primaryCategory
        ? interventionTracks[primaryCategory]
        : null,
    },
    errors,
  };
}

export class ErrorPatternAnalysisEngine {
  static analyse(rawText, correctedText) {
    return buildErrorPatternReport(rawText, correctedText);
  }
}
