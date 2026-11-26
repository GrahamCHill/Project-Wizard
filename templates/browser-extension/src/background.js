// Chrome runs this as a service worker, which has no `document` and starts only when needed. Firefox and
// Safari run it as a background script that the manifest lists after the shared files. The guard lets the
// same file work in both: a service worker loads its helpers with importScripts, the others already have them.
if (typeof importScripts === 'function') importScripts('shared/api.js', 'shared/text.js', 'shared/settings.js');

api.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== 'wordCount' || !sender.tab || sender.tab.id === undefined) return;
  const tabId = sender.tab.id;
  // Returning the promise lets the sender know when the badge is set, and keeps a service worker alive until then.
  return Settings.load(api.storage.sync).then(async settings => {
    const text = settings.showBadge ? PageText.formatBadge(message.words) : '';
    await api.action.setBadgeText({ tabId, text });
    if (text) await api.action.setBadgeBackgroundColor({ tabId, color: '#e8590c' });
    return { badge: text };
  });
});

api.runtime.onInstalled.addListener(async details => {
  if (details.reason !== 'install') return;
  // Write the defaults once, so every other part of the extension can read a complete set of settings.
  await Settings.save(api.storage.sync, {});
});
