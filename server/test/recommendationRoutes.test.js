import test from 'node:test';
import assert from 'node:assert/strict';

import app from '../app.js';
import { recommendationEngine } from '../services/recommendationEngine.js';

async function withServer(run) {
  const server = app.listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()),
    );
  }
}

test('simplified recommendation endpoints validate student and sample IDs', async () => {
  await withServer(async baseUrl => {
    for (const [method, path] of [
      ['POST', '/api/students/not-an-id/recommendations'],
      ['GET', '/api/students/not-an-id/recommendations/latest'],
      ['POST', '/api/samples/not-an-id/recommendations'],
      ['GET', '/api/samples/not-an-id/recommendations'],
    ]) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : '{}',
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'INVALID_ID');
    }
  });
});

test('lifecycle endpoints were removed', async () => {
  await withServer(async baseUrl => {
    const regenerate = await fetch(`${baseUrl}/api/students/507f1f77bcf86cd799439011/recommendations/regenerate`, { method: 'POST' });
    const flag = await fetch(`${baseUrl}/api/recommendations/507f1f77bcf86cd799439011/flag`, { method: 'PATCH' });
    assert.equal(regenerate.status, 404);
    assert.equal(flag.status, 404);
  });
});

test('worksheet file endpoint rejects IDs outside the approved index', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/worksheets/not-approved/file`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'WORKSHEET_NOT_FOUND');
  });
});

test('worksheet file endpoint forces a non-sniffable PDF response', async () => {
  const originalFetchWorksheet = recommendationEngine.fetchWorksheet;
  recommendationEngine.fetchWorksheet = async worksheetId => ({
    worksheet: { worksheetId },
    response: new Response('%PDF-1.7', {
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  });
  try {
    await withServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/worksheets/approved/file`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(await response.text(), '%PDF-1.7');
    });
  } finally {
    recommendationEngine.fetchWorksheet = originalFetchWorksheet;
  }
});

test('worksheet file endpoint rejects active upstream content', async () => {
  const originalFetchWorksheet = recommendationEngine.fetchWorksheet;
  recommendationEngine.fetchWorksheet = async worksheetId => ({
    worksheet: { worksheetId },
    response: new Response('<script>unsafe</script>', {
      headers: { 'Content-Type': 'text/html' },
    }),
  });
  try {
    await withServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/worksheets/approved/file`);
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error.code, 'INVALID_WORKSHEET_CONTENT_TYPE');
    });
  } finally {
    recommendationEngine.fetchWorksheet = originalFetchWorksheet;
  }
});
