import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fakeApi, load, same } from './helpers.js';

const { PageText } = load(['shared/text.js']);
const { Settings } = load(['shared/settings.js']);

const text = value => ({ nodeType: 3, nodeValue: value });
const element = (name, children = [], extra = {}) => ({ nodeType: 1, nodeName: name, childNodes: children, getAttribute: () => null, ...extra });

describe('PageText', () => {
  it('counts words', () => {
    assert.equal(PageText.countWords('one two  three\nfour\tfive'), 5);
    assert.equal(PageText.countWords('   '), 0);
    assert.equal(PageText.countWords(''), 0);
    assert.equal(PageText.countWords('well-known'), 1);
  });

  it('estimates reading time, never zero for real text', () => {
    assert.equal(PageText.readingMinutes(0), 0);
    assert.equal(PageText.readingMinutes(10), 1);
    assert.equal(PageText.readingMinutes(230), 1);
    assert.equal(PageText.readingMinutes(2300), 10);
    assert.equal(PageText.readingMinutes(1000, 100), 10);
    assert.equal(PageText.readingMinutes(460, 0), 2, 'an invalid rate falls back to the default');
    assert.equal(PageText.readingMinutes(460, NaN), 2);
  });

  it('formats the toolbar badge to fit', () => {
    const cases = [[0, ''], [-5, ''], [7, '7'], [999, '999'], [1000, '1k'], [1500, '1.5k'], [9949, '9.9k'], [10000, '10k'], [12400, '12k'], [999999, '1000k'], [1200000, '1m']];
    for (const [words, expected] of cases) assert.equal(PageText.formatBadge(words), expected, String(words));
  });

  it('extracts visible text and skips scripts, styles, hidden parts, and form controls', () => {
    const tree = element('BODY', [
      element('H1', [text('Title')]),
      element('SCRIPT', [text('var secret = 1')]),
      element('STYLE', [text('p { color: red }')]),
      element('P', [text('Hello '), element('B', [text('bold')]), text(' world')]),
      element('DIV', [text('hidden text')], { hidden: true }),
      element('DIV', [text('also hidden')], { getAttribute: name => (name === 'aria-hidden' ? 'true' : null) }),
      element('TEXTAREA', [text('draft')]),
      { nodeType: 8, nodeValue: 'a comment' }
    ]);
    assert.equal(PageText.countWords(PageText.extractText(tree)), 4);
    assert.doesNotMatch(PageText.extractText(tree), /secret|color|hidden|draft|comment/);
    assert.equal(PageText.extractText(null), '');
  });
});

describe('Settings', () => {
  it('replaces missing and invalid values with defaults', () => {
    same(Settings.normalize(undefined), { showBadge: true, wordsPerMinute: 230 });
    same(Settings.normalize({ showBadge: 'yes', wordsPerMinute: 'fast' }), { showBadge: true, wordsPerMinute: 230 });
    for (const rate of [49, 1001, 200.5, -3, NaN]) assert.equal(Settings.normalize({ wordsPerMinute: rate }).wordsPerMinute, 230, String(rate));
    same(Settings.normalize({ showBadge: false, wordsPerMinute: '300' }), { showBadge: false, wordsPerMinute: 300 });
  });

  it('loads defaults from empty storage and saves merged values', async () => {
    const { api, sync } = fakeApi();
    same(await Settings.load(api.storage.sync), { showBadge: true, wordsPerMinute: 230 });
    same(await Settings.save(api.storage.sync, { wordsPerMinute: 400 }), { showBadge: true, wordsPerMinute: 400 });
    same(sync, { showBadge: true, wordsPerMinute: 400 });
    same(await Settings.save(api.storage.sync, { showBadge: false, wordsPerMinute: 5 }), { showBadge: false, wordsPerMinute: 230 });
  });
});
