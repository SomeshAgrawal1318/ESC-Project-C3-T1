// services/ErrorPatternAnalysisEngine.js
// --------------------------------------
// Converts Team 1's raw/corrected transcription handoff into Team 2's minimal
// contextual character-error report.

import * as Diff from "diff";

// The report contract supports all five taxonomy labels. The current MVP
// diff rules emit phonological, orthographic, and spelling; morphological and
// grammar remain available for future classifiers with linguistic context.
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

// A diff index can land on punctuation or just beyond a changed word. Prefer
// the character to its left before searching forward so cards contain the
// learner's complete word rather than a neighbouring word or partial token.
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

// OCR often inserts line breaks inside a sentence, so only punctuation marks
// terminate the context shown with an error card.
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

  // Unchanged tokens advance both positions. Removed tokens consume only raw
  // text, while added tokens consume only corrected text. The primitive MVP
  // mapping classifies added as phonological, removed as orthographic, and a
  // neighbouring remove/add pair as spelling.
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

    // Spacing and line-wrap differences are OCR layout changes, not learner
    // errors, but their lengths must still advance the corresponding indexes.
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
    // diffChars can split one changed word into multiple segments around a
    // shared unchanged character. Collapse matching word/context cards and
    // classify mixed operations as one spelling error.
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

  // Counts replace the winner only when strictly greater, so this order is
  // also the deterministic tie-break order for the primary track.
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