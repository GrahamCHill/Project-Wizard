import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fakeApi, load, same } from './helpers.js';

const shared = ['shared/api.js', 'shared/text.js', 'shared/settings.js'];

function background(initialSync, extra = {}) {
  const fake = fakeApi(initialSync);
  load([...shared, 'background.js'], { browser: fake.api, ...extra });
  return { ...fake, onMessage: fake.listeners.message[0], onInstalled: fake.listeners.installed[0] };
}

describe('background', () => {
  it('shows the word count on the tab that sent it', async () => {
    const { onMessage, calls } = background();
    const result = await onMessage({ type: 'wordCount', words: 1500 }, { tab: { id: 7 } });
    same(result, { badge: '1.5k' });
    same(calls.badgeText, [{ tabId: 7, text: '1.5k' }]);
    same(calls.badgeColor, [{ tabId: 7, color: '#e8590c' }]);
  });

  it('clears the badge when the setting is off', async () => {
    const { onMessage, calls } = background({ showBadge: false });
    same(await onMessage({ type: 'wordCount', words: 1500 }, { tab: { id: 1 } }), { badge: '' });
    same(calls.badgeText, [{ tabId: 1, text: '' }]);
    assert.equal(calls.badgeColor.length, 0);
  });

  it('ignores messages that are not word counts, and senders without a tab', () => {
    const { onMessage, calls } = background();
    assert.equal(onMessage({ type: 'other' }, { tab: { id: 1 } }), undefined);
    assert.equal(onMessage({ type: 'wordCount', words: 5 }, {}), undefined);
    assert.equal(onMessage(null, { tab: { id: 1 } }), undefined);
    assert.equal(calls.badgeText.length, 0);
  });

  it('writes the default settings once, on install', async () => {
    const { onInstalled, sync } = background();
    await onInstalled({ reason: 'update' });
    same(sync, {});
    await onInstalled({ reason: 'install' });
    same(sync, { showBadge: true, wordsPerMinute: 230 });
  });

  it('loads its helpers with importScripts when it runs as a service worker', () => {
    const imported = [];
    const fake = fakeApi();
    load(['shared/api.js', 'shared/text.js', 'shared/settings.js', 'background.js'], {
      browser: fake.api,
      importScripts: (...files) => void imported.push(...files)
    });
    same(imported, ['shared/api.js', 'shared/text.js', 'shared/settings.js']);
  });
});

function page(paragraphs) {
  const outlines = new Map();
  const nodes = paragraphs.map(words => {
    const attributes = new Map();
    const node = {
      nodeType: 1, nodeName: 'P', childNodes: [{ nodeType: 3, nodeValue: words }], textContent: words, style: { outline: '' },
      getAttribute: name => attributes.get(name) ?? null,
      setAttribute: (name, value) => void attributes.set(name, value),
      removeAttribute: name => void attributes.delete(name),
      scrollIntoView: () => {},
      has: name => attributes.has(name)
    };
    outlines.set(node, attributes);
    return node;
  });
  const body = { nodeType: 1, nodeName: 'BODY', childNodes: nodes, getAttribute: () => null };
  const document = {
    body, title: 'A page',
    querySelectorAll: selector => (selector === 'p' ? nodes : []),
    querySelector: selector => nodes.find(node => node.has(selector.slice(1, -1))) ?? null
  };
  return { document, nodes };
}

describe('content script', () => {
  function run(paragraphs) {
    const fake = fakeApi();
    const { document, nodes } = page(paragraphs);
    load(['shared/api.js', 'shared/text.js', 'content.js'], { browser: fake.api, document });
    const respond = message => new Promise(resolve => fake.listeners.message[0](message, {}, resolve));
    return { ...fake, nodes, respond };
  }

  it('reports its word count to the background when it loads', () => {
    const { calls } = run(['one two three', 'four five']);
    same(calls.sent, [{ type: 'wordCount', words: 5 }]);
  });

  it('answers the popup with the page statistics', async () => {
    const { respond } = run(['one two three', 'four five']);
    same(await respond({ type: 'getStats' }), { words: 5, title: 'A page' });
  });

  it('highlights the longest paragraph, then removes the highlight', async () => {
    const { respond, nodes } = run(['short one', 'this is clearly the longest paragraph here', 'tiny']);
    same(await respond({ type: 'toggleHighlight' }), { highlighted: true });
    same(nodes.map(node => node.style.outline !== ''), [false, true, false]);
    same(await respond({ type: 'toggleHighlight' }), { highlighted: false });
    same(nodes.map(node => node.style.outline), ['', '', '']);
  });

  it('does nothing to a page with no paragraphs', async () => {
    const { respond } = run([]);
    same(await respond({ type: 'toggleHighlight' }), { highlighted: false });
  });
});
