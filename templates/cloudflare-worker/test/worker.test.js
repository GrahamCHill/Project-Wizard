import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import worker, { greeting, json } from '../src/index.js';

const call = (path, init, env) => worker.fetch(new Request('https://worker.example' + path, init), env);

/** A stand-in for a KV namespace that keeps its values in memory. */
function fakeKv(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, get: async key => values.get(key) ?? null, put: async (key, value) => void values.set(key, value) };
}

describe('routes', () => {
  it('describes itself at /', async () => {
    const response = await call('/');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^application\/json/);
    const body = await response.json();
    assert.equal(body.name, '__PROJECT_NAME__');
    assert.ok(body.endpoints.includes('/healthz'));
  });

  it('answers health checks', async () => {
    const response = await call('/healthz');
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  it('answers unknown paths with 404 JSON', async () => {
    const response = await call('/nope');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found.' });
  });
});

describe('greeting', () => {
  it('greets a name, trims it, and falls back to "world"', () => {
    assert.deepEqual(greeting('Ada'), { message: 'Hello, Ada!' });
    assert.deepEqual(greeting('  Ada  '), { message: 'Hello, Ada!' });
    assert.deepEqual(greeting(''), { message: 'Hello, world!' });
    assert.deepEqual(greeting(null), { message: 'Hello, world!' });
    assert.deepEqual(greeting(undefined), { message: 'Hello, world!' });
  });

  it('rejects names that are too long', () => {
    assert.match(greeting('x'.repeat(51)).error, /at most 50/);
    assert.equal(greeting('x'.repeat(50)).message.length, 'Hello, !'.length + 50);
  });

  it('is served at /api/greet', async () => {
    const ok = await call('/api/greet?name=Grace');
    assert.deepEqual(await ok.json(), { message: 'Hello, Grace!' });
    const empty = await call('/api/greet');
    assert.deepEqual(await empty.json(), { message: 'Hello, world!' });
    const tooLong = await call('/api/greet?name=' + 'x'.repeat(51));
    assert.equal(tooLong.status, 400);
  });

  it('only allows GET and says which method is allowed', async () => {
    const response = await call('/api/greet', { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET');
  });

  it('keeps special characters in the JSON instead of interpreting them', async () => {
    const response = await call('/api/greet?name=' + encodeURIComponent('<b>"x"</b>'));
    assert.deepEqual(await response.json(), { message: 'Hello, <b>"x"</b>!' });
  });
});

describe('visits', () => {
  it('counts visits in KV, starting from zero', async () => {
    const kv = fakeKv();
    assert.deepEqual(await (await call('/api/visits', { method: 'POST' }, { VISITS: kv })).json(), { visits: 1 });
    assert.deepEqual(await (await call('/api/visits', { method: 'POST' }, { VISITS: kv })).json(), { visits: 2 });
    assert.equal(kv.values.get('count'), '2');
  });

  it('survives a damaged stored value', async () => {
    const response = await call('/api/visits', { method: 'POST' }, { VISITS: fakeKv({ count: 'banana' }) });
    assert.deepEqual(await response.json(), { visits: 1 });
  });

  it('explains how to enable counting when KV is not bound', async () => {
    const response = await call('/api/visits', { method: 'POST' });
    assert.equal(response.status, 501);
    assert.match((await response.json()).error, /wrangler\.jsonc/);
  });

  it('does not change anything for a GET', async () => {
    const kv = fakeKv();
    const response = await call('/api/visits', {}, { VISITS: kv });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
    assert.equal(kv.values.size, 0);
  });
});

describe('json helper', () => {
  it('sets the status and merges extra headers', () => {
    const response = json({ a: 1 }, 201, { 'x-test': '1' });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('x-test'), '1');
    assert.match(response.headers.get('content-type'), /json/);
  });
});
