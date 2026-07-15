// services/ErrorPatternAnalysisEngine.js
// --------------------------------------
// Converts Team 1's raw/corrected transcription handoff into Team 2's minimal
// contextual character-error report.

import * as Diff from "diff";

export const interventionTracks = Object.freeze({
  phonological: Object.freeze({
    trackId: "TRK_1",
    label: "Phonics Review",
  }),
  orthographic: Object.freeze({
    trackId: "TRK_2",
    label: "Letter Accuracy Review",
  }),
  morphological: Object.freeze({
    trackId: "TRK_4",
    label: "Word Structure Review",
  }),
  spelling: Object.freeze({
    trackId: "TRK_3",
    label: "Spelling Review",
  }),
  grammar: Object.freeze({
    trackId: "TRK_5",
    label: "Grammar Review",
  }),
});

function isWordCharacter(character) {
  return Boolean(character && /[\p{L}\p{N}'’-]/u.test(character));
}

function findWord(text, index) {
  if (!text) return "";

  let anchor = Math.min(Math.max(index, 0), text.length - 1);
  if (!isWordCharacter(text[anchor])) {
    if (anchor > 0 && isWordCharacter(text[anchor - 1])) {
      anchor -= 1;
    } else {
      while (anchor < text.length && !isWordCharacter(text[anchor])) anchor += 1;
    }
  }
  if (anchor >= text.length) return "";

  let start = anchor;
  let end = anchor + 1;
  while (start > 0 && isWordCharacter(text[start - 1])) start -= 1;
  while (end < text.length && isWordCharacter(text[end])) end += 1;
  return text.slice(start, end);
}

function findSentence(text, index) {
  if (!text) return "";

  let start = Math.min(Math.max(index, 0), text.length);
  while (start > 0 && !/[.!?]/.test(text[start - 1])) start -= 1;

  let end = Math.min(Math.max(index, 0), text.length);
  while (end < text.length && !/[.!?]/.test(text[end])) end += 1;
  if (end < text.length) end += 1;

  return text.slice(start, end).trim();
}

function wordComparison(raw, corrected, rawIndex, correctedIndex, tokens) {
  const rawToken = tokens.find((token) => token.removed);
  const correctedToken = tokens.find((token) => token.added);
  let rawWord = findWord(raw, rawIndex) || rawToken?.value || "∅";
  let correctedWord =
    findWord(corrected, correctedIndex) || correctedToken?.value || "∅";

  if (rawWord === correctedWord) {
    if (rawToken?.value.trim()) rawWord = `${rawToken.value}${rawWord}`;
    if (correctedToken?.value.trim()) {
      correctedWord = `${correctedToken.value}${correctedWord}`;
    }
  }

  return `${rawWord} → ${correctedWord}`;
}

export function buildErrorPatternReport(rawText, correctedText) {
  const raw = typeof rawText === "string" ? rawText : "";
  const corrected = typeof correctedText === "string" ? correctedText : "";
  const diffTokens = Diff.diffChars(raw, corrected);
  const errors = [];
  const categoryCounts = {
    phonological: 0,
    orthographic: 0,
    morphological: 0,
    spelling: 0,
    grammar: 0,
  };
  let currentRawIndex = 0;
  let currentCorrectedIndex = 0;

  for (let index = 0; index < diffTokens.length; index += 1) {
    const token = diffTokens[index];

    if (!token.added && !token.removed) {
      currentRawIndex += token.value.length;
      currentCorrectedIndex += token.value.length;
      continue;
    }

    const nextToken = diffTokens[index + 1];
    const isSubstitution = Boolean(
      nextToken &&
        ((token.removed && nextToken.added) ||
          (token.added && nextToken.removed))
    );
    const errorTokens = isSubstitution ? [token, nextToken] : [token];
    const category = isSubstitution
      ? "spelling"
      : token.added
        ? "phonological"
        : "orthographic";
    const rawLength = errorTokens.reduce(
      (length, errorToken) =>
        length + (errorToken.removed ? errorToken.value.length : 0),
      0
    );
    const correctedLength = errorTokens.reduce(
      (length, errorToken) =>
        length + (errorToken.added ? errorToken.value.length : 0),
      0
    );

    if (errorTokens.every((errorToken) => !errorToken.value.trim())) {
      currentRawIndex += rawLength;
      currentCorrectedIndex += correctedLength;
      if (isSubstitution) index += 1;
      continue;
    }

    const error = {
      value: wordComparison(
        raw,
        corrected,
        currentRawIndex,
        currentCorrectedIndex,
        errorTokens
      ),
      category,
      track: interventionTracks[category],
      context_snippet: findSentence(raw, currentRawIndex),
    };
    const previousError = errors.at(-1);
    const matchesPreviousWord =
      previousError &&
      previousError.value === error.value &&
      previousError.context_snippet === error.context_snippet;

    if (matchesPreviousWord) {
      if (
        previousError.category !== error.category &&
        previousError.category !== "spelling"
      ) {
        categoryCounts[previousError.category] -= 1;
        previousError.category = "spelling";
        previousError.track = interventionTracks.spelling;
        categoryCounts.spelling += 1;
      }
    } else {
      errors.push(error);
      categoryCounts[category] += 1;
    }

    currentRawIndex += rawLength;
    currentCorrectedIndex += correctedLength;
    if (isSubstitution) index += 1;
  }

  let primaryCategory = null;
  for (const category of [
    "phonological",
    "orthographic",
    "morphological",
    "spelling",
    "grammar",
  ]) {
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