import assert from 'node:assert/strict';
import test from 'node:test';

const liveTestEnabled = process.env.RECOMMENDATION_LIVE_TEST === 'true';

test(
  'opt-in live Azure and Gemini recommendation smoke test',
  { skip: !liveTestEnabled },
  async () => {
    // Load the ignored local environment only after the explicit opt-in. The
    // test never prints credentials, signed URLs, prompts, or private paths.
    const dotenv = await import('dotenv');
    dotenv.config();

    const [{ RecommendationEngine }, { generateReport }, { readBoundedResponse }] =
      await Promise.all([
        import('../services/RecommendationEngine.js'),
        import('../services/generateReport.js'),
        import('../utils/readBoundedResponse.js'),
      ]);
    const logMessages = [];
    const engine = new RecommendationEngine({
      environment: process.env,
      logger: { info: (message) => logMessages.push(message) },
    });

    assert.equal(engine.getStatus().mode, 'live');
    const catalogue = await engine.getWorksheetCatalogue();
    assert.equal(catalogue.length, 174);
    assert.equal((await engine.azureKnowledgeSource.getKnowledgeDocuments()).length > 0, true);

    const sampleId = { toString: () => '507f1f77bcf86cd799439011' };
    const generated = await generateReport(
      { currentGrade: 'Primary 4' },
      [
        {
          _id: sampleId,
          status: 'REVIEWED',
          errors: [
            {
              written: 'hop',
              intended: 'hope',
              category: 'phonological',
              note: 'long vowel confusion',
              dismissed: false,
            },
          ],
        },
      ],
      engine
    );
    assert.equal(generated.strategies.length > 0, true);
    assert.equal(generated.strategies.length <= 4, true);

    const { response, maximumBytes } = await engine.fetchWorksheet(catalogue[0].worksheetId);
    const pdfBytes = await readBoundedResponse(response, maximumBytes, {
      tooLarge: () => new Error('Live worksheet exceeded the byte limit.'),
      interrupted: () => new Error('Live worksheet download was interrupted.'),
    });
    assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');

    const publicJson = JSON.stringify(generated);
    assert.equal(publicJson.includes('pdfPath'), false);
    assert.equal(publicJson.includes('sig='), false);
    assert.equal(
      logMessages.some((message) => message.includes('sig=')),
      false
    );
    assert.equal(
      logMessages.some((message) => message.includes('?')),
      false
    );
  }
);
