// services/geminiPrompt.js
// -------------------------
// The prompt we send to Gemini, kept in its own file so it is easy to find
// and tweak without touching any logic.
//
// This wording has been tested on real student work. Do not casually reword
// the rules or the category definitions - consistent wording is what keeps
// the tool's behaviour stable from one sample to the next.
//
// The one idea behind every line of it: the child's mistakes ARE the data.
// A normal OCR tool would "helpfully" correct "panishment" to "punishment"
// and destroy exactly what the educator needs to see. So the prompt hammers
// on one rule - preserve what was actually written, correct nothing.

export const ERROR_ANALYSIS_PROMPT = `You are helping a teacher study the spelling and writing mistakes in a child's
handwritten schoolwork. You will look at an image of the child's work and
identify the mistakes directly.

This work is by a student with dyslexia. Their writing often contains letter
reversals (b/d, p/q), phonetic spellings (words spelled the way they sound),
and letter sequencing errors (letters in the wrong order). Expect these
patterns and preserve them exactly — but do not assume an error is present.
Only record what is actually on the page. A correctly spelled word is not a
mistake just because the child is dyslexic.

First, silently read exactly what the child physically wrote — every word,
including misspellings, exactly as written on the page. Do not correct anything
in your mind; you need the real, uncorrected words to find the mistakes.

Then list every word that deviates from standard written English. For each one,
provide:
- "written": the word exactly as the child wrote it
- "intended": your best guess at the word they meant
- "category": one of —
    - phonological   — sounds right but spelled wrong ("panishment" -> "punishment")
    - orthographic   — letters wrong, swapped, or reversed, not sound-based
                       ("form" -> "from")
    - morphological  — base word correct but ending/prefix wrong
                       ("regreted" -> "regretted")
    - capitalisation — a capital letter is missing or wrong ("tom" -> "Tom")
    - punctuation    — a punctuation mark is missing or wrong
- "note": a short, plain-language reason for the category

Rules:
- Do not invent mistakes. If a word is correct, do not list it.
- Copy each "written" word exactly as the child wrote it, even if misspelled.
- If you cannot confidently categorise a mistake, use "unsure" rather than guessing.
- If part of the work is illegible, describe it in "illegible_parts" instead of
  guessing at it.

Return only this JSON:
{ "errors": [ { "written": "...", "intended": "...",
                "category": "...", "note": "..." } ],
  "illegible_parts": "none | describe what you couldn't read" }`;

// For closed tasks (Edit & Diagram) the exercise has one known correct
// answer. We hand it to Gemini as READING context only - the wording below
// is explicit that it must never correct the child's writing toward it.
export function buildPromptWithAnswerKey(answerKey) {
  // No answer key (narrative writing, or just not provided): send the
  // prompt exactly as it is.
  if (!answerKey || answerKey.trim() === "") {
    return ERROR_ANALYSIS_PROMPT;
  }

  const answerKeyLine =
    `For context, the exercise's correct answer is: "${answerKey.trim()}". ` +
    `Use this only to help you read unclear words and judge what was intended — ` +
    `do NOT correct the child's writing toward it, and copy each "written" word ` +
    `exactly as the child wrote it.`;

  return `${ERROR_ANALYSIS_PROMPT}\n\n${answerKeyLine}`;
}
