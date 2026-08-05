import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  __testing,
  analyseSample,
  CONFIDENCE_THRESHOLD_DEFAULT,
  describeFailure,
  getConfidenceThreshold,
  isUncertain,
  TimeoutError,
  validateAnalysisResult,
} from '../services/errorClassificationEngine.js';

const validError = {
  written: 'becos',
  intended: 'because',
  category: 'orthographic',
  confidenceScore: 0.91,
  note: 'The vowel pattern is incorrect.',
  locationOnScan: { page: 0, x: 0.1, y: 0.2, z: 0.3, w: 0.1 },
};

let testDirectory;
let imagePath;

before(async () => {
  testDirectory = await mkdtemp(join(tmpdir(), 'lexipath-engine-'));
  imagePath = join(testDirectory, 'sample.png');
  await writeFile(imagePath, Buffer.from('fake-image-content'));
});

after(async () => {
  delete process.env.ERROR_CONFIDENCE_THRESHOLD;
  delete process.env.GEMINI_MAX_RETRIES;
  delete process.env.GEMINI_RETRY_BASE_MS;
  delete process.env.GEMINI_TIMEOUT_MS;
  await rm(testDirectory, { recursive: true, force: true });
});

describe('analyseSample', () => {
  test('returns a completed analysis from an injected Gemini client', async () => {
    let request;
    const client = {
      models: {
        generateContent: async (receivedRequest) => {
          request = receivedRequest;
          return {
            text: JSON.stringify({
              illegibleNote: '',
              errors: [validError],
            }),
          };
        },
      },
    };

    const result = await analyseSample(
      {
        taskType: 'ESSAY',
        pages: [{ imagePath }],
      },
      { client }
    );

    assert.deepEqual(result, {
      illegibleNote: '',
      errors: [{ ...validError, dismissed: false }],
    });
    assert.equal(request.contents[0].parts[1].inlineData.mimeType, 'image/png');
    assert.match(request.contents[0].parts[0].text, /first image is page 0|single page/);
  });

  test('rejects an unsupported upload before calling Gemini', async () => {
    let called = false;
    const client = {
      models: {
        generateContent: async () => {
          called = true;
        },
      },
    };

    await assert.rejects(
      analyseSample(
        {
          taskType: 'ESSAY',
          pages: [{ imagePath: join(testDirectory, 'sample.txt') }],
        },
        { client }
      ),
      /Unsupported image type "\.txt"/
    );
    assert.equal(called, false);
  });

  test('reports a missing or corrupted image without calling Gemini', async () => {
    let called = false;
    const missingPath = join(testDirectory, 'missing.png');
    const client = {
      models: {
        generateContent: async () => {
          called = true;
        },
      },
    };

    await assert.rejects(
      analyseSample(
        {
          taskType: 'ESSAY',
          pages: [{ imagePath: missingPath }],
        },
        { client }
      ),
      new RegExp(`Could not read the uploaded image`)
    );
    assert.equal(called, false);
  });

  test('includes an answer key only for non-essay tasks', () => {
    const shortAnswerPrompt = __testing.buildPrompt({
      taskType: 'SHORT_ANSWER',
      answerKey: 'photosynthesis',
      pages: [{ imagePath }],
    });
    const essayPrompt = __testing.buildPrompt({
      taskType: 'ESSAY',
      answerKey: 'must not appear',
      pages: [{ imagePath }],
    });

    assert.match(shortAnswerPrompt, /photosynthesis/);
    assert.doesNotMatch(essayPrompt, /must not appear/);
  });
});

describe('analysis result validation', () => {
  test('accepts a valid result and returns the same object', () => {
    const result = { illegibleNote: '', errors: [validError] };
    assert.equal(validateAnalysisResult(result, 1), result);
  });

  test('rejects an invalid category', () => {
    const result = {
      illegibleNote: '',
      errors: [{ ...validError, category: 'spelling' }],
    };
    assert.throws(() => validateAnalysisResult(result, 1), /category "spelling"/);
  });

  test('rejects confidence and coordinates outside the unit range', () => {
    assert.throws(
      () =>
        validateAnalysisResult(
          {
            illegibleNote: '',
            errors: [{ ...validError, confidenceScore: 1.1 }],
          },
          1
        ),
      /confidenceScore/
    );
    assert.throws(
      () =>
        validateAnalysisResult(
          {
            illegibleNote: '',
            errors: [
              {
                ...validError,
                locationOnScan: { ...validError.locationOnScan, x: -0.1 },
              },
            ],
          },
          1
        ),
      /locationOnScan/
    );
  });

  test('rejects a page index that is not present in the sample', () => {
    const result = {
      illegibleNote: '',
      errors: [
        {
          ...validError,
          locationOnScan: { ...validError.locationOnScan, page: 1 },
        },
      ],
    };
    assert.throws(() => validateAnalysisResult(result, 1), /valid page index/);
  });
});

describe('confidence and failure handling', () => {
  test('uses the configured threshold and falls back for invalid values', () => {
    process.env.ERROR_CONFIDENCE_THRESHOLD = '0.75';
    assert.equal(getConfidenceThreshold(), 0.75);
    assert.equal(isUncertain({ confidenceScore: 0.74 }), true);
    assert.equal(isUncertain({ confidenceScore: 0.75 }), false);

    process.env.ERROR_CONFIDENCE_THRESHOLD = '2';
    assert.equal(getConfidenceThreshold(), CONFIDENCE_THRESHOLD_DEFAULT);
  });

  test('converts internal failures to educator-facing messages', () => {
    assert.equal(
      describeFailure(new TimeoutError('late')),
      'Analysis timed out. The image may be too large, or the AI service is slow to respond.'
    );
    assert.equal(
      describeFailure(new Error('secret SDK response')),
      'The AI could not produce a usable error report for this sample.'
    );
  });
});

describe('Gemini retry handling', () => {
  test('retries a failed request and returns the next valid response', async () => {
    let attempts = 0;
    const ai = {
      models: {
        generateContent: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('temporary failure');
          return {
            text: JSON.stringify({ illegibleNote: '', errors: [validError] }),
          };
        },
      },
    };

    const result = await __testing.callModelWithRetry(
      ai,
      [{ text: 'prompt' }],
      {
        modelName: 'test-model',
        timeoutMs: 100,
        maxRetries: 1,
        retryBaseMs: 0,
      },
      1
    );

    assert.equal(attempts, 2);
    assert.deepEqual(result.errors, [validError]);
  });
});
