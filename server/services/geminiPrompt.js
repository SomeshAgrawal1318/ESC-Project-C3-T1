// services/geminiPrompt.js
// -------------------------
// Team 1's VLM handoff contract: transcribe the student's work verbatim, then
// provide a minimally spell-corrected counterpart for deterministic diffing.

export const TRANSCRIPTION_PROMPT = `Act only as a transcription tool for a student's handwritten schoolwork.

Return the complete text in two forms:
- "raw_text": exactly what the student physically wrote. Preserve every spelling
  mistake, capital letter, punctuation mark, line break, paragraph break, and
  visible spacing. Do not silently correct or categorize anything.
- "corrected_text": the same text and layout, correcting only basic spelling.
  Infer the intended spelling from context, but do not replace, simplify, add,
  or remove the student's vocabulary or ideas.

If a character cannot be read, use [?] in the same location in both fields.
Preserve layout with newline characters. Return a strict JSON object with only
these two string fields and no markdown, explanation, categories, or extra keys:
{ "raw_text": "...", "corrected_text": "..." }`;

// A closed-task answer key may help read unclear handwriting, but it must not
// change Team 1's two-field output contract or the student's vocabulary.
export function buildPromptWithAnswerKey(answerKey) {
  if (!answerKey || answerKey.trim() === "") {
    return TRANSCRIPTION_PROMPT;
  }

  const answerKeyLine =
    `For reading context only, the exercise's answer key is: "${answerKey.trim()}". ` +
    `Do not copy vocabulary from it unless that vocabulary is visibly present in ` +
    `the student's work, and never alter raw_text toward the answer key.`;

  return `${TRANSCRIPTION_PROMPT}\n\n${answerKeyLine}`;
}
