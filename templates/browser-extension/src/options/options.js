const form = document.getElementById('form');
const badge = document.getElementById('showBadge');
const rate = document.getElementById('wordsPerMinute');
const saved = document.getElementById('saved');

async function load() {
  const settings = await Settings.load(api.storage.sync);
  badge.checked = settings.showBadge;
  rate.value = settings.wordsPerMinute;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const settings = await Settings.save(api.storage.sync, { showBadge: badge.checked, wordsPerMinute: Number(rate.value) });
  // Show what was actually stored, because invalid input is replaced with a default.
  badge.checked = settings.showBadge;
  rate.value = settings.wordsPerMinute;
  saved.textContent = 'Saved.';
});

load();
