import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { app } from '../dist/app.js';

let server;
let base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test('reports healthy status', async () => {
  const response = await fetch(base + '/healthz');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('greets the requested person', async () => {
  const response = await fetch(base + '/hello?name=Ada');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: 'Hello, Ada!' });
});

test('rejects repeated query parameters', async () => {
  const response = await fetch(base + '/hello?name=Ada&name=Grace');
  assert.equal(response.status, 400);
});

test('returns a JSON error for missing routes', async () => {
  const response = await fetch(base + '/missing');
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found' });
});
