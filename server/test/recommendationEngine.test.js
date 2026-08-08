import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  AzureKnowledgeSource,
  buildAzureBlobUrl,
  buildStrategyGenerationRequest,
  buildWorksheetSelectionRequest,
  createApprovedWorksheetRecord,
  isEligibleWorksheetResource,
  parseBlobManifest,
  parseResourceCatalogue,
  readRecommendationConfig,
  RecommendationEngine,
  requestStructuredGeminiResponse,
  validateStrategySelection,
  validateWorksheetSelection,
} from '../services/RecommendationEngine.js';
import { readBoundedResponse } from '../utils/readBoundedResponse.js';

const silentLogger = { info() {} };
const liveConfig = {
  useMocks: false,
  geminiApiKey: 'test-key',
  geminiModelName: 'gemini-flash-latest',
  geminiTimeoutMilliseconds: 100,
  geminiMaxRetries: 2,
  azureStorageAccountName: 'exampleaccount',
  azureStorageContainerName: 'worksheets',
  azureKnowledgeManifestPath: '_manifests/knowledge.jsonl',
  azureStorageSasToken: 'sp=r&sig=already%2Bencoded',
};

function geminiResponse(value) {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function reviewedEvidence(overrides = {}) {
  return {
    id: 'evidence-1-1',
    sampleId: '507f1f77bcf86cd799439011',
    written: 'hop',
    intended: 'hope',
    category: 'phonological',
    note: 'long vowel confusion',
    ...overrides,
  };
}

function approvedWorksheet(overrides = {}) {
  return {
    worksheetId: 'azure-0123456789abcdef',
    title: 'Long vowel practice',
    pdfPath: '_raw/Long vowel practice.pdf',
    pdfPages: 'PDF pages 1–3',
    errorPatterns: ['phonological'],
    available: true,
    audience: 'student',
    resourceType: 'worksheet',
    verificationStatus: 'verified',
    ...overrides,
  };
}

describe('recommendation configuration and Azure URL safety', () => {
  test('defaults to offline mock mode and reuses the existing Gemini names', () => {
    assert.deepEqual(readRecommendationConfig({}), {
      useMocks: true,
      geminiApiKey: undefined,
      geminiModelName: 'gemini-flash-latest',
      geminiTimeoutMilliseconds: 30_000,
      geminiMaxRetries: 2,
      azureStorageAccountName: undefined,
      azureStorageContainerName: undefined,
      azureKnowledgeManifestPath: undefined,
      azureStorageSasToken: undefined,
    });

    const configured = readRecommendationConfig({
      RECOMMENDATION_USE_MOCKS: 'false',
      GEMINI_API_KEY: 'existing-key',
      GEMINI_MODEL_NAME: 'existing-model',
      GEMINI_TIMEOUT_MS: '1234',
      GEMINI_MAX_RETRIES: '4',
    });
    assert.equal(configured.useMocks, false);
    assert.equal(configured.geminiApiKey, 'existing-key');
    assert.equal(configured.geminiModelName, 'existing-model');
    assert.equal(configured.geminiTimeoutMilliseconds, 1234);
    assert.equal(configured.geminiMaxRetries, 4);
  });

  test('encodes each Blob path segment and preserves the encoded SAS query', () => {
    const url = buildAzureBlobUrl(liveConfig, '_raw/Level 1/A+B.pdf');
    assert.equal(
      url,
      'https://exampleaccount.blob.core.windows.net/worksheets/_raw/Level%201/A%2BB.pdf?sp=r&sig=already%2Bencoded'
    );

    assert.equal(
      buildAzureBlobUrl({ ...liveConfig, azureStorageSasToken: '?sp=r&sig=x' }, 'safe.pdf'),
      'https://exampleaccount.blob.core.windows.net/worksheets/safe.pdf?sp=r&sig=x'
    );
  });

  test('rejects traversal, absolute paths, empty segments, and backslashes', () => {
    for (const unsafePath of [
      '',
      '/absolute.pdf',
      '../private.pdf',
      'folder/../private.pdf',
      'folder//file.pdf',
      'C:/private.pdf',
      'folder\\file.pdf',
    ]) {
      assert.throws(() => buildAzureBlobUrl(liveConfig, unsafePath), /path is invalid/i);
    }
  });
});

describe('Azure knowledge and worksheet catalogues', () => {
  test('validates manifest structure and parses resource JSONL line by line', () => {
    assert.deepEqual(parseBlobManifest('{"files":[{"path":"one.pdf"}]}'), [{ path: 'one.pdf' }]);
    assert.deepEqual(
      parseResourceCatalogue('{"source_file":"one.pdf"}\n\n{"source_file":"two.pdf"}'),
      [{ source_file: 'one.pdf' }, { source_file: 'two.pdf' }]
    );
    assert.throws(() => parseBlobManifest('{"files":null}'), /invalid structure/i);
    assert.throws(() => parseResourceCatalogue('{not-json}'), /invalid JSON/i);
  });

  test('accepts only exact, student-safe, verified Blob records', () => {
    const blobRecord = {
      path: '_raw/phonics.pdf',
      displayName: 'Phonics practice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 123,
      sha256: 'a'.repeat(64),
    };
    const resourceRecord = {
      source_file: '_raw/phonics.pdf',
      audience: 'student',
      answer_key_available: false,
      title: 'Phonics practice',
      source_location: 'PDF pages 2–4',
      resource_type: 'worksheet',
      verification_status: 'verified',
      addresses_error_types: ['short-vowel-confusion'],
    };

    assert.equal(isEligibleWorksheetResource(blobRecord, resourceRecord), true);
    assert.equal(
      isEligibleWorksheetResource(blobRecord, { ...resourceRecord, audience: 'teacher' }),
      false
    );
    assert.equal(
      isEligibleWorksheetResource(blobRecord, {
        ...resourceRecord,
        answer_key_available: true,
      }),
      false
    );
    assert.equal(
      isEligibleWorksheetResource({ ...blobRecord, mimeType: 'text/plain' }, resourceRecord),
      false
    );
    assert.equal(
      isEligibleWorksheetResource({ ...blobRecord, sha256: 'short' }, resourceRecord),
      false
    );
    assert.equal(
      isEligibleWorksheetResource(blobRecord, {
        ...resourceRecord,
        source_file: '_raw/other.pdf',
      }),
      false
    );

    assert.deepEqual(createApprovedWorksheetRecord(blobRecord, resourceRecord), {
      worksheetId: 'azure-aaaaaaaaaaaaaaaa',
      title: 'Phonics practice',
      pdfPath: '_raw/phonics.pdf',
      pdfPages: 'PDF pages 2–4',
      errorPatterns: ['phonological'],
      available: true,
      audience: 'student',
      resourceType: 'worksheet',
      verificationStatus: 'verified',
    });
  });

  test('joins resource records to exact Blob paths and ignores duplicate paths', async () => {
    const eligibleBlob = {
      path: '_raw/phonics.pdf',
      displayName: 'Phonics.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 99,
      sha256: 'b'.repeat(64),
    };
    const blobManifest = JSON.stringify({
      files: [eligibleBlob, { ...eligibleBlob, sha256: 'c'.repeat(64) }],
    });
    const resourceCatalogue = `${JSON.stringify({
      source_file: '_raw/phonics.pdf',
      audience: 'mixed',
      answer_key_available: false,
      title: 'Phonics',
      addresses_error_types: ['short-vowel-confusion'],
    })}\n${JSON.stringify({
      source_file: '_raw/teacher.pdf',
      audience: 'teacher',
      answer_key_available: false,
    })}`;
    const responses = new Map([
      ['_manifests/blob-upload-manifest.json', blobManifest],
      ['wiki/_data/resource-catalogue.jsonl', resourceCatalogue],
    ]);
    const source = new AzureKnowledgeSource(liveConfig, {
      fetchImplementation: async (url) => {
        const blobPath = decodeURIComponent(new URL(url).pathname.split('/').slice(2).join('/'));
        return new Response(responses.get(blobPath), { status: 200 });
      },
    });

    const first = await source.getApprovedWorksheetCatalogue();
    const second = await source.getApprovedWorksheetCatalogue();
    assert.equal(first, second);
    assert.equal(first.length, 1);
    assert.equal(first[0].worksheetId, 'azure-bbbbbbbbbbbbbbbb');
  });

  test('keeps identical PDFs distinct without exposing their private paths in IDs', async () => {
    const sharedHash = 'd'.repeat(64);
    const blobManifest = JSON.stringify({
      files: [
        {
          path: '_raw/level-one/practice.pdf',
          displayName: 'Level one practice.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 99,
          sha256: sharedHash,
        },
        {
          path: '_raw/level-two/practice.pdf',
          displayName: 'Level two practice.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 99,
          sha256: sharedHash,
        },
      ],
    });
    const resourceCatalogue = [
      {
        source_file: '_raw/level-one/practice.pdf',
        audience: 'student',
        answer_key_available: false,
      },
      {
        source_file: '_raw/level-two/practice.pdf',
        audience: 'student',
        answer_key_available: false,
      },
    ]
      .map(JSON.stringify)
      .join('\n');
    const responses = new Map([
      ['_manifests/blob-upload-manifest.json', blobManifest],
      ['wiki/_data/resource-catalogue.jsonl', resourceCatalogue],
    ]);
    const source = new AzureKnowledgeSource(liveConfig, {
      fetchImplementation: async (url) => {
        const blobPath = decodeURIComponent(new URL(url).pathname.split('/').slice(2).join('/'));
        return new Response(responses.get(blobPath), { status: 200 });
      },
    });

    const worksheets = await source.getApprovedWorksheetCatalogue();
    assert.equal(worksheets.length, 2);
    assert.notEqual(worksheets[0].worksheetId, worksheets[1].worksheetId);
    for (const worksheet of worksheets) {
      assert.match(worksheet.worksheetId, /^azure-d{16}-[a-f\d]{16}$/);
      assert.equal(worksheet.worksheetId.includes('_raw'), false);
      assert.equal(worksheet.worksheetId.includes('practice'), false);
    }
  });

  test('loads unique Markdown documents in batches of eight and reuses the cache', async () => {
    const manifestPaths = Array.from({ length: 10 }, (_, index) => `docs/${index}.md`);
    const manifest = [...manifestPaths, manifestPaths[0]]
      .map((path) => JSON.stringify({ path }))
      .join('\n');
    let activeDownloads = 0;
    let maximumActiveDownloads = 0;
    let manifestRequests = 0;

    const source = new AzureKnowledgeSource(liveConfig, {
      fetchImplementation: async (url) => {
        const blobPath = decodeURIComponent(new URL(url).pathname.split('/').slice(2).join('/'));
        if (blobPath === liveConfig.azureKnowledgeManifestPath) {
          manifestRequests += 1;
          return new Response(manifest);
        }
        activeDownloads += 1;
        maximumActiveDownloads = Math.max(maximumActiveDownloads, activeDownloads);
        await new Promise((resolve) => setTimeout(resolve, 2));
        activeDownloads -= 1;
        return new Response(`phonological practice in ${blobPath}`);
      },
    });

    const [first, shared] = await Promise.all([
      source.getKnowledgeDocuments(),
      source.getKnowledgeDocuments(),
    ]);
    const cached = await source.getKnowledgeDocuments();
    assert.equal(first, shared);
    assert.equal(first, cached);
    assert.equal(first.length, 10);
    assert.equal(manifestRequests, 1);
    assert.equal(maximumActiveDownloads, 8);

    const selected = await source.selectRelevantDocuments({
      level: 'primary',
      errors: [reviewedEvidence()],
    });
    assert.equal(selected.length, 10);
    assert.deepEqual(
      selected.map((document) => document.blobPath),
      [...manifestPaths].sort()
    );
  });

  test('clears a failed knowledge cache so a later request can retry', async () => {
    let attempts = 0;
    const source = new AzureKnowledgeSource(liveConfig, {
      fetchImplementation: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('temporary network failure');
        if (attempts === 2) return new Response('{"path":"docs/retry.md"}');
        return new Response('orthographic spelling practice');
      },
    });

    await assert.rejects(source.getKnowledgeDocuments(), /could not be reached/i);
    assert.equal((await source.getKnowledgeDocuments()).length, 1);
  });

  test('enforces declared and streamed byte limits', async () => {
    const declared = new AzureKnowledgeSource(liveConfig, {
      documentByteLimit: 4,
      fetchImplementation: async () =>
        new Response('large', { headers: { 'Content-Length': '5' } }),
    });
    await assert.rejects(declared.readTextBlob('docs/large.md', 4), /too large/i);

    const streamed = await readBoundedResponse(new Response('12345'), 4, {
      tooLarge: () => new Error('stream too large'),
      interrupted: () => new Error('stream interrupted'),
    }).catch((error) => error);
    assert.match(streamed.message, /stream too large/i);
  });
});

describe('Gemini transport and prompt privacy', () => {
  test('retries network and retryable HTTP failures with exponential delays', async () => {
    const responses = [
      new Error('network'),
      new Response('', { status: 429 }),
      geminiResponse({ ok: true }),
    ];
    const delays = [];
    let calls = 0;
    const result = await requestStructuredGeminiResponse({}, liveConfig, {
      fetchImplementation: async () => {
        const next = responses[calls++];
        if (next instanceof Error) throw next;
        return next;
      },
      retryBaseMilliseconds: 500,
      wait: async (milliseconds) => delays.push(milliseconds),
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(calls, 3);
    assert.deepEqual(delays, [500, 1000]);
  });

  test('does not retry permanent HTTP errors and stops after retry exhaustion', async () => {
    let permanentCalls = 0;
    await assert.rejects(
      requestStructuredGeminiResponse({}, liveConfig, {
        fetchImplementation: async () => {
          permanentCalls += 1;
          return new Response('private upstream detail', { status: 400 });
        },
        wait: async () => {},
      }),
      /request failed/i
    );
    assert.equal(permanentCalls, 1);

    let retryCalls = 0;
    await assert.rejects(
      requestStructuredGeminiResponse(
        {},
        { ...liveConfig, geminiMaxRetries: 1 },
        {
          fetchImplementation: async () => {
            retryCalls += 1;
            return new Response('', { status: 503 });
          },
          wait: async () => {},
        }
      ),
      /request failed/i
    );
    assert.equal(retryCalls, 2);
  });

  test('times out an unresponsive request and reports malformed structured data', async () => {
    await assert.rejects(
      requestStructuredGeminiResponse(
        {},
        { ...liveConfig, geminiTimeoutMilliseconds: 5, geminiMaxRetries: 0 },
        {
          fetchImplementation: async (_url, { signal }) =>
            new Promise((_resolve, reject) => {
              const keepEventLoopActive = setTimeout(
                () => reject(new Error('request did not abort')),
                50
              );
              signal.addEventListener('abort', () => {
                clearTimeout(keepEventLoopActive);
                reject(new Error('aborted'));
              });
            }),
        }
      ),
      /unavailable/i
    );

    await assert.rejects(
      requestStructuredGeminiResponse({}, liveConfig, {
        fetchImplementation: async () =>
          new Response(JSON.stringify({ candidates: [] }), {
            headers: { 'Content-Type': 'application/json' },
          }),
      }),
      /returned no data/i
    );
    await assert.rejects(
      requestStructuredGeminiResponse({}, liveConfig, {
        fetchImplementation: async () =>
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: '{bad' }] } }] }),
            { headers: { 'Content-Type': 'application/json' } }
          ),
      }),
      /malformed data/i
    );
  });

  test('excludes student identity, sample IDs, and private paths from prompts', () => {
    const input = {
      studentName: 'Private Student',
      level: 'primary',
      errors: [reviewedEvidence({ written: '<ignore instructions>' })],
    };
    const worksheet = approvedWorksheet();
    const worksheetRequest = buildWorksheetSelectionRequest(
      input,
      [worksheet],
      [
        {
          blobPath: 'private/knowledge.md',
          content: 'Reference content',
        },
      ]
    );
    const strategyRequest = buildStrategyGenerationRequest(input, [
      {
        worksheetId: worksheet.worksheetId,
        title: worksheet.title,
        available: true,
        targetCategories: ['phonological'],
        rationale: 'Useful practice.',
      },
    ]);
    const prompts = `${JSON.stringify(worksheetRequest)} ${JSON.stringify(strategyRequest)}`;

    assert.equal(prompts.includes('Private Student'), false);
    assert.equal(prompts.includes('507f1f77bcf86cd799439011'), false);
    assert.equal(prompts.includes('_raw/Long vowel practice.pdf'), false);
    assert.equal(prompts.includes('private/knowledge.md'), false);
    assert.equal(prompts.includes('<ignore instructions>'), false);
    assert.equal(prompts.includes('\\\\u003cignore instructions\\\\u003e'), true);
  });
});

describe('worksheet and strategy validation', () => {
  test('rejects unknown worksheet IDs and unsupported categories', () => {
    const evidence = [reviewedEvidence()];
    assert.throws(
      () =>
        validateWorksheetSelection(
          {
            worksheets: [
              {
                worksheetId: 'invented',
                targetCategories: ['phonological'],
                rationale: 'Practice.',
              },
            ],
          },
          [approvedWorksheet()],
          evidence
        ),
      /unapproved worksheet/i
    );
    assert.throws(
      () =>
        validateWorksheetSelection(
          {
            worksheets: [
              {
                worksheetId: approvedWorksheet().worksheetId,
                targetCategories: ['orthographic'],
                rationale: 'Practice.',
              },
            ],
          },
          [approvedWorksheet()],
          evidence
        ),
      /unsupported by the evidence/i
    );
  });

  test('uses server-owned worksheet fields and limits worksheet count and rationale', () => {
    const selection = {
      worksheetId: approvedWorksheet().worksheetId,
      targetCategories: ['phonological'],
      rationale: 'Model and practise this pattern.',
    };
    const validated = validateWorksheetSelection(
      { worksheets: [selection, selection, selection, selection] },
      [approvedWorksheet()],
      [reviewedEvidence()]
    );
    assert.equal(validated.length, 3);
    assert.equal(validated[0].title, 'Long vowel practice');
    assert.equal('pdfPath' in validated[0], false);

    assert.throws(
      () =>
        validateWorksheetSelection(
          { worksheets: [{ ...selection, rationale: 'x'.repeat(601) }] },
          [approvedWorksheet()],
          [reviewedEvidence()]
        ),
      /too long/i
    );
  });

  test('rejects unknown evidence and unsupported strategy categories', () => {
    const worksheet = {
      worksheetId: approvedWorksheet().worksheetId,
      title: 'Long vowel practice',
      pdfPages: '',
      available: true,
      targetCategories: ['phonological'],
      rationale: 'Practice.',
    };
    const validSelection = {
      strategy: 'Teach the pattern',
      rationale: 'Use gradual release.',
      targetCategories: ['phonological'],
      evidenceIds: ['evidence-1-1'],
      worksheetIds: [worksheet.worksheetId],
    };

    assert.throws(
      () =>
        validateStrategySelection(
          { strategies: [{ ...validSelection, evidenceIds: ['invented'] }] },
          { errors: [reviewedEvidence()] },
          [worksheet]
        ),
      /unknown evidence/i
    );
    assert.throws(
      () =>
        validateStrategySelection(
          { strategies: [{ ...validSelection, targetCategories: ['orthographic'] }] },
          { errors: [reviewedEvidence()] },
          [worksheet]
        ),
      /unsupported by its evidence/i
    );
  });

  test('limits strategy count and validates title and generated-rationale lengths', () => {
    const worksheet = {
      worksheetId: approvedWorksheet().worksheetId,
      title: 'Long vowel practice',
      pdfPages: '',
      available: true,
      targetCategories: ['phonological'],
      rationale: 'Practice.',
    };
    const selection = {
      strategy: 'Teach the pattern',
      rationale: 'Use gradual release.',
      targetCategories: ['phonological'],
      evidenceIds: ['evidence-1-1'],
      worksheetIds: [worksheet.worksheetId],
    };
    const input = { errors: [reviewedEvidence()] };

    assert.equal(
      validateStrategySelection(
        { strategies: [selection, selection, selection, selection, selection] },
        input,
        [worksheet]
      ).length,
      4
    );
    assert.throws(
      () =>
        validateStrategySelection(
          { strategies: [{ ...selection, strategy: 'x'.repeat(301) }] },
          input,
          [worksheet]
        ),
      /title.*too long/i
    );
    assert.throws(
      () =>
        validateStrategySelection(
          { strategies: [{ ...selection, rationale: 'x'.repeat(1001) }] },
          input,
          [worksheet]
        ),
      /rationale.*too long/i
    );
  });

  test('mock mode works without credentials and preserves written evidence exactly', async () => {
    const written = '  speling<exact>  ';
    const engine = new RecommendationEngine({ environment: {}, logger: silentLogger });
    const strategies = await engine.createInterventionStrategies({
      level: 'primary',
      errors: [reviewedEvidence({ written, category: 'orthographic' })],
    });

    assert.equal(strategies.length, 1);
    assert.equal(strategies[0].evidence[0].writtenExamples[0], written);
    assert.equal(strategies[0].worksheets[0].available, false);
  });

  test('live mode validates Gemini and Azure configuration only when used', async () => {
    const engine = new RecommendationEngine({
      environment: { RECOMMENDATION_USE_MOCKS: 'false' },
      logger: silentLogger,
    });
    assert.deepEqual(engine.getStatus(), {
      mode: 'live',
      model: 'gemini-flash-latest',
      azureConfigured: false,
    });
    await assert.rejects(
      engine.createInterventionStrategies({ level: null, errors: [reviewedEvidence()] }),
      /API key is not configured/i
    );
  });
});
