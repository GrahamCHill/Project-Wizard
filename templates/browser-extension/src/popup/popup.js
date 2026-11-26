const statusLine = document.getElementById('status');

function show(words, minutes) {
  document.getElementById('words').textContent = words.toLocaleString();
  document.getElementById('minutes').textContent = minutes === 0 ? 'None' : minutes + ' min';
  document.getElementById('stats').hidden = false;
  document.getElementById('highlight').hidden = false;
  statusLine.hidden = true;
}

async function main() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const settings = await Settings.load(api.storage.sync);
  try {
    // The popup asks the page's content script directly. It only works on pages the extension can run in.
    const stats = await api.tabs.sendMessage(tab.id, { type: 'getStats' });
    show(stats.words, PageText.readingMinutes(stats.words, settings.wordsPerMinute));
  } catch {
    statusLine.textContent = 'This page cannot be read. Try a regular website, and reload it if it was open before you installed the extension.';
    return;
  }
  document.getElementById('highlight').addEventListener('click', async () => {
    await api.tabs.sendMessage(tab.id, { type: 'toggleHighlight' });
  });
}

document.getElementById('options').addEventListener('click', event => {
  event.preventDefault();
  api.runtime.openOptionsPage();
});

main();
