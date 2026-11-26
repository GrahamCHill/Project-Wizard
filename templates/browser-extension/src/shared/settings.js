// Settings are stored with the browser's sync storage, so they follow the user between devices.
(function (root) {
  const DEFAULTS = { showBadge: true, wordsPerMinute: 230 };

  /** Replaces anything missing or invalid with the default, so a corrupt value can never break the extension. */
  function normalize(stored) {
    const source = stored && typeof stored === 'object' ? stored : {};
    const rate = Number(source.wordsPerMinute);
    return {
      showBadge: typeof source.showBadge === 'boolean' ? source.showBadge : DEFAULTS.showBadge,
      wordsPerMinute: Number.isInteger(rate) && rate >= 50 && rate <= 1000 ? rate : DEFAULTS.wordsPerMinute
    };
  }

  async function load(storage) {
    return normalize(await storage.get(Object.keys(DEFAULTS)));
  }

  async function save(storage, values) {
    const settings = normalize({ ...(await load(storage)), ...values });
    await storage.set(settings);
    return settings;
  }

  root.Settings = { DEFAULTS, normalize, load, save };
})(globalThis);
