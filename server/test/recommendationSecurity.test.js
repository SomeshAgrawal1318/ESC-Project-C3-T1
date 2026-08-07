import test from 'node:test';
import assert from 'node:assert/strict';

import app from '../app.js';
import { recommendationEngine } from '../services/recommendationEngine.js';

async function withServer(run) {
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test('worksheet proxy stops oversized chunked PDFs without Content-Length', async () => {
  const originalFetchWorksheet = recommendationEngine.fetchWorksheet;
  recommendationEngine.fetchWorksheet = async (worksheetId) => ({
    worksheet: { worksheetId },
    response: new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('%PDF-'));
          controller.enqueue(new TextEncoder().encode('oversized'));
          controller.close();
        },
      }),
      { headers: { 'Content-Type': 'application/pdf' } }
    ),
    maxBytes: 8,
  });
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/worksheets/approved/file`);
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error.code, 'WORKSHEET_TOO_LARGE');
    });
  } finally {
    recommendationEngine.fetchWorksheet = originalFetchWorksheet;
  }
});
