// Runs in every page. It reads the page's text and answers questions from the popup and the background.
// Content scripts cannot be modules, so shared code is loaded before this file by the manifest.
(function () {
  const HIGHLIGHT_ATTRIBUTE = 'data-page-stats-longest';

  function stats() {
    const text = PageText.extractText(document.body);
    return { words: PageText.countWords(text), title: document.title };
  }

  function toggleHighlight() {
    const existing = document.querySelector('[' + HIGHLIGHT_ATTRIBUTE + ']');
    if (existing) {
      existing.removeAttribute(HIGHLIGHT_ATTRIBUTE);
      existing.style.outline = '';
      return false;
    }
    let longest = null;
    let longestWords = 0;
    for (const paragraph of document.querySelectorAll('p')) {
      const words = PageText.countWords(paragraph.textContent || '');
      if (words > longestWords) {
        longest = paragraph;
        longestWords = words;
      }
    }
    if (!longest) return false;
    longest.setAttribute(HIGHLIGHT_ATTRIBUTE, '');
    longest.style.outline = '3px solid #e8590c';
    longest.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }

  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'getStats') {
      sendResponse(stats());
    } else if (message && message.type === 'toggleHighlight') {
      sendResponse({ highlighted: toggleHighlight() });
    }
    // Each request is answered synchronously, so there is no need to keep the channel open.
  });

  // Tell the background the word count so it can show it on the toolbar icon.
  api.runtime.sendMessage({ type: 'wordCount', words: stats().words }).catch(() => {
    // The background may be asleep or restarting. The popup can still ask this script directly.
  });
})();
