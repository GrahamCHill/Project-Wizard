// Pure text helpers. They touch no browser API, so they run in a page, a service worker, and tests.
(function (root) {
  const DEFAULT_WORDS_PER_MINUTE = 230;
  const SKIPPED = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'IFRAME', 'TEXTAREA', 'INPUT']);

  /** Counts the words in a string by splitting on whitespace. */
  function countWords(text) {
    const trimmed = String(text).trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  /** Whole minutes to read `words` words: none for no text, and never less than one for any text. */
  function readingMinutes(words, wordsPerMinute = DEFAULT_WORDS_PER_MINUTE) {
    const rate = Number.isFinite(wordsPerMinute) && wordsPerMinute > 0 ? wordsPerMinute : DEFAULT_WORDS_PER_MINUTE;
    return words > 0 ? Math.max(1, Math.round(words / rate)) : 0;
  }

  /** Short text for the toolbar badge, which fits about four characters: 950, 1.5k, 12k, 1m. */
  function formatBadge(words) {
    if (!(words > 0)) return '';
    if (words < 1000) return String(words);
    if (words < 10000) return (Math.round(words / 100) / 10).toString().replace(/\.0$/, '') + 'k';
    if (words < 1000000) return Math.round(words / 1000) + 'k';
    return Math.round(words / 1000000) + 'm';
  }

  /** Collects the visible reading text under a node, skipping scripts, styles, and form controls. */
  function extractText(node) {
    if (!node) return '';
    if (node.nodeType === 3) return node.nodeValue || '';
    if (node.nodeType !== 1 || SKIPPED.has(String(node.nodeName).toUpperCase())) return '';
    if (node.hidden || (node.getAttribute && node.getAttribute('aria-hidden') === 'true')) return '';
    let text = '';
    for (const child of node.childNodes || []) text += extractText(child) + ' ';
    return text;
  }

  root.PageText = { DEFAULT_WORDS_PER_MINUTE, countWords, readingMinutes, formatBadge, extractText };
})(globalThis);
