import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AzureKnowledgeSource,
  buildAzureBlobUrl,
  RecommendationEngine,
} from '../services/recommendationEngine.js';

const TEST_WORKSHEETS = [{
  worksheetId: 'long-vowel-practice',
  title: 'Long-vowel and split-digraph practice',
  pdfPath: '_raw/phonics.pdf',
  pdfPages: '1-20',
  errorPatterns: ['phonological', 'long-vowel-pattern-confusion', 'silent-e'],
  description: 'Use for silent-e and split-digraph errors.',
}];

test('Azure blob URLs preserve virtual folders and keep the SAS query opaque', () => {
  const url = buildAzureBlobUrl({
    accountName: 'demoaccount',
    containerName: 'worksheets',
    sasToken: '?sp=r&sig=test%2Bvalue',
  }, '_raw/Band A/5) Phonics.pdf');

  assert.equal(
    url,
    'https://demoaccount.blob.core.windows.net/worksheets/_raw/Band%20A/5)%20Phonics.pdf?sp=r&sig=test%2Bvalue',
  );
});

test('Gemini requests retry transient service failures', async () => {
  const responses = [
    new Response('temporarily unavailable', { status: 503 }),
    new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"worksheets":[]}' }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ];
  const events = [];
  const engine = new RecommendationEngine({
    apiKey: 'test-key',
    useMocks: false,
    fetchImpl: async () => responses.shift(),
    geminiRetryDelayMs: 0,
    logger: { info: message => events.push(message) },
  });

  assert.deepEqual(await engine.callGemini({}), { worksheets: [] });
  assert.match(events.join('\n'), /gemini-request-retry/);
  assert.match(events.join('\n'), /"attempt":2/);
});

test('Azure knowledge retrieval caches the canonical wiki and selects relevant context', async () => {
  const requests = [];
  const fetchImpl = async url => {
    requests.push(url);
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/_manifests/gemini-canonical-markdown.jsonl')) {
      return new Response([
        JSON.stringify({ path: 'wiki/phonics.md' }),
        JSON.stringify({ path: 'wiki/morphology.md' }),
      ].join('\n'));
    }
    if (pathname.endsWith('/wiki/phonics.md')) {
      return new Response('# Phonics\nSilent-e and long-vowel spelling practice.');
    }
    if (pathname.endsWith('/wiki/morphology.md')) {
      return new Response('# Morphology\nPrefixes, suffixes, and base words.');
    }
    return new Response('missing', { status: 404 });
  };
  const source = new AzureKnowledgeSource({
    accountName: 'demoaccount',
    containerName: 'worksheets',
    sasToken: 'sp=r&sig=test',
    fetchImpl,
  });
  const input = {
    level: 'primary',
    errors: [{ category: 'phonological', written: 'hop', note: 'silent e long vowel' }],
  };

  const first = await source.contextFor(input, 1);
  const second = await source.contextFor(input, 1);

  assert.match(first, /wiki\/phonics\.md/);
  assert.doesNotMatch(first, /wiki\/morphology\.md/);
  assert.equal(second, first);
  assert.equal(requests.length, 3, 'manifest and documents should be fetched only once');
});

test('Azure asset manifest is the approved worksheet catalogue', async () => {
  let requests = 0;
  const source = new AzureKnowledgeSource({
    accountName: 'demoaccount',
    containerName: 'worksheets',
    sasToken: 'sp=r&sig=test',
    fetchImpl: async () => {
      requests += 1;
      return Response.json({
        files: [{
          path: '_raw/Band A/Phonics.pdf',
          displayName: 'Phonics intervention.pdf',
          sha256: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        }],
      });
    },
  });

  const first = await source.worksheetCatalogue();
  const second = await source.worksheetCatalogue();

  assert.equal(first[0].worksheetId, 'azure-1234567890abcdef');
  assert.equal(first[0].pdfPath, '_raw/Band A/Phonics.pdf');
  assert.equal(second, first);
  assert.equal(requests, 1, 'the private asset manifest should be fetched only once');
});

test('recommendation prompt combines approved mappings with retrieved Azure context', async () => {
    const engine = new RecommendationEngine({
      approvedWorksheets: TEST_WORKSHEETS,
      knowledgeSource: {
        contextFor: async () => 'SOURCE: wiki/phonics.md\nRetrieved silent-e guidance.',
      },
      useMocks: false,
      apiKey: 'test-key',
    });
    let request;
    engine.callGemini = async body => {
      request = body;
      return {
        worksheets: [{
          worksheetId: 'long-vowel-practice',
          title: 'Long-vowel and split-digraph practice',
          pdfPath: '_raw/phonics.pdf',
          pdfPages: '1-20',
          targetCategories: ['phonological'],
          rationale: 'Matches the retrieved silent-e guidance.',
        }],
      };
    };

    const result = await engine.findWorksheets({
      level: 'primary',
      errors: [{
        id: 'error-1',
        sampleId: '507f1f77bcf86cd799439011',
        category: 'phonological',
        written: 'hop',
        note: 'silent e',
      }],
    });

    const prompt = request.contents[0].parts[0].text;
    assert.match(prompt, /APPROVED WORKSHEET INDEX/);
    assert.match(prompt, /RETRIEVED AZURE WIKI CONTEXT/);
    assert.match(prompt, /Retrieved silent-e guidance/);
    assert.doesNotMatch(prompt, /507f1f77bcf86cd799439011/);
    assert.equal(result[0].worksheetId, 'long-vowel-practice');
});

test('approved worksheet lookup rejects arbitrary blob paths', async () => {
    const engine = new RecommendationEngine({ approvedWorksheets: TEST_WORKSHEETS, useMocks: true });
    const worksheet = await engine.getApprovedWorksheet('long-vowel-practice');
    assert.equal(worksheet.pdfPath, '_raw/phonics.pdf');
    await assert.rejects(
      engine.getApprovedWorksheet('not-approved'),
      error => error.code === 'WORKSHEET_NOT_FOUND',
    );
});

test('worksheet recommendation bypasses SQLite and selects an explicitly mapped PDF', async () => {
    const engine = new RecommendationEngine({ approvedWorksheets: TEST_WORKSHEETS, useMocks: true });
    const worksheets = await engine.findWorksheets({
      level: 'primary',
      errors: [{ category: 'phonological', written: 'pali', note: 'silent e split digraph' }],
    }, 3);
    assert.equal(worksheets.length, 1);
    assert.equal(worksheets[0].worksheetId, 'long-vowel-practice');
    assert.equal(worksheets[0].pdfPath, '_raw/phonics.pdf');
    assert.equal('catalogueId' in worksheets[0], false);
});

test('mock selection covers distinct observed error categories before near-duplicates', async () => {
  const engine = new RecommendationEngine({ useMocks: true });
  const worksheets = await engine.findWorksheets({
    level: 'primary',
    errors: [
      { category: 'phonological', written: 'pali', note: 'silent e' },
      { category: 'orthographic', written: 'frend', note: 'learned word spelling' },
      { category: 'morphological', written: 'playd', note: 'past tense suffix' },
    ],
  }, 3);
  assert.deepEqual(
    new Set(worksheets.flatMap(item => item.targetCategories)),
    new Set(['phonological', 'orthographic', 'morphological']),
  );
});

test('worksheet recommendation output inspection', async () => {
    const engine = new RecommendationEngine({ approvedWorksheets: TEST_WORKSHEETS, useMocks: true });
    
    // Test 1: See worksheet selection output
    const worksheets = await engine.findWorksheets({
      level: 'primary',
      errors: [{ category: 'phonological', written: 'pali', note: 'silent e split digraph' }],
    }, 3);
    
    console.log('\n--- FIND WORKSHEETS OUTPUT ---');
    console.log(JSON.stringify(worksheets, null, 2));

    // Test 2: See full strategy generation output
    const strategies = await engine.createInterventionStrategies({
      level: 'primary',
      errors: [
        { id: 'err_1', category: 'phonological', written: 'pali', note: 'silent e' }
      ]
    });

    console.log('\n--- FULL STRATEGIES OUTPUT ---');
    console.log(JSON.stringify(strategies, null, 2));
});
