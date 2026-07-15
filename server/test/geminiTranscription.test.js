import test from "node:test";
import assert from "node:assert/strict";
import {
  TRANSCRIPTION_PROMPT,
  buildPromptWithAnswerKey,
} from "../services/geminiPrompt.js";
import { parseTranscriptionResponse } from "../services/gemini.js";

test("Gemini prompt requests only the Team 1 transcription handoff fields", () => {
  assert.match(TRANSCRIPTION_PROMPT, /"raw_text"/);
  assert.match(TRANSCRIPTION_PROMPT, /"corrected_text"/);
  assert.doesNotMatch(TRANSCRIPTION_PROMPT, /"category"/);
  assert.doesNotMatch(TRANSCRIPTION_PROMPT, /"errors"/);
});

test("answer key remains context without changing the two-field contract", () => {
  const prompt = buildPromptWithAnswerKey("The cat sat.");

  assert.match(prompt, /The cat sat\./);
  assert.match(prompt, /"raw_text"/);
  assert.match(prompt, /"corrected_text"/);
});

test("parseTranscriptionResponse accepts a strict two-field JSON object", () => {
  assert.deepEqual(
    parseTranscriptionResponse('{"raw_text":"I hav a cat","corrected_text":"I have a cat"}'),
    { raw_text: "I hav a cat", corrected_text: "I have a cat" }
  );
});

test("parseTranscriptionResponse rejects missing or additional fields", () => {
  assert.throws(
    () => parseTranscriptionResponse('{"raw_text":"text"}'),
    /raw_text and corrected_text/
  );
  assert.throws(
    () =>
      parseTranscriptionResponse(
        '{"raw_text":"text","corrected_text":"text","errors":[]}'
      ),
    /only raw_text and corrected_text/
  );
});
