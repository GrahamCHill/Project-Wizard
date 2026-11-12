const assert = require('node:assert/strict');
const test = require('node:test');
const { catalogCache } = require('../src/catalog-cache');

function fixture() {
  const data = new Map();
  const state = {
    get: key => data.get(key),
    update: async (key, value) => data.set(key, structuredClone(value))
  };
  let time = 10_000;
  return {
    cache: (scope = 'host') => catalogCache(state, 'templates', { scope, ttl: 1_000, limit: 2, now: () => time }),
    advance: duration => { time += duration; }
  };
}

test('reuses persisted catalog results and shares a background scan when they expire', async () => {
  const { cache, advance } = fixture();
  let scans = 0;
  const scan = () => ++scans;
  await cache().refresh('folder', scan);
  const reopened = cache();
  assert.equal(reopened.read('folder'), 1);
  assert.equal(reopened.refresh('folder', scan), undefined);

  advance(1_000);
  const refresh = reopened.refresh('folder', scan);
  assert.equal(reopened.read('folder'), 1);
  assert.equal(reopened.refresh('folder', scan), refresh);
  await refresh;
  assert.equal(reopened.read('folder'), 2);
  assert.equal(scans, 2);
});

test('keeps locations separate and discards cached results from another environment', async () => {
  const { cache } = fixture();
  const current = cache();
  await current.refresh('first', () => ['MonoGame from SDK 8']);
  await current.refresh('second', () => ['MonoGame from SDK 10']);
  assert.deepEqual(cache().read('first'), ['MonoGame from SDK 8']);
  assert.deepEqual(cache().read('second'), ['MonoGame from SDK 10']);
  assert.equal(cache('different environment').read('first'), undefined);

  await current.refresh('third', () => []);
  assert.equal(cache().read('first'), undefined);
  assert.deepEqual(cache().read('third'), []);
});

test('a template install invalidates every location and discards an older scan', async () => {
  const { cache } = fixture();
  const current = cache();
  await current.refresh('first', () => ['old']);
  await current.refresh('second', () => ['old']);
  const previous = Promise.withResolvers();
  const stale = current.refresh('first', () => previous.promise, true);
  current.invalidate();
  assert.deepEqual(current.read('first'), ['old']);
  await current.refresh('first', () => ['installed']);
  previous.resolve(['stale']);
  await stale;
  assert.deepEqual(current.read('first'), ['installed']);
  await current.refresh('second', () => ['installed']);
  assert.deepEqual(current.read('second'), ['installed']);
});

test('keeps cached results on a transient failure and allows a manual retry', async () => {
  const { cache, advance } = fixture();
  const current = cache();
  await current.refresh('host', () => ['cached']);
  advance(1_000);
  await current.refresh('host', () => { throw new Error('Temporary scan failure'); });
  assert.deepEqual(current.read('host'), ['cached']);
  const next = () => ['refreshed'];
  assert.equal(current.refresh('host', next), undefined);
  await current.refresh('host', next, true);
  assert.deepEqual(current.read('host'), ['refreshed']);
});
