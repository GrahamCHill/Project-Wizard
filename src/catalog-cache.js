const retryDelay = 30_000;

function catalogCache(state, name, { scope, ttl, limit, log, now = Date.now }) {
  const storageKey = `projectWizard.discovery.${name}`;
  const saved = state.get(storageKey);
  const records = saved?.scope === scope && Array.isArray(saved.entries) ? saved.entries : [];
  const entries = new Map(records.slice(-limit));
  const pending = new Map();
  let writes = Promise.resolve();

  function save() {
    writes = writes.then(() => state.update(storageKey, { scope, entries: [...entries] }))
      .catch(error => log?.(`Could not save the ${name} catalog cache: ${error.message}`));
  }

  function set(key, value, lifetime) {
    entries.delete(key);
    entries.set(key, { value, expiresAt: now() + lifetime });
    if (entries.size > limit) entries.delete(entries.keys().next().value);
    save();
  }

  function read(key) {
    return entries.get(key)?.value;
  }

  function refresh(key, scan, force = false) {
    if (pending.has(key)) return pending.get(key);
    if (!force && entries.get(key)?.expiresAt > now()) return;

    const task = Promise.resolve().then(() => scan(read(key))).then(value => {
      if (pending.get(key) === task) set(key, value, ttl);
    }, error => {
      if (pending.get(key) !== task) return;
      log?.(`Could not refresh ${name}: ${error.message}`);
      set(key, read(key), retryDelay);
    }).finally(() => {
      if (pending.get(key) === task) pending.delete(key);
    });
    pending.set(key, task);
    return task;
  }

  function invalidate() {
    pending.clear();
    for (const entry of entries.values()) entry.expiresAt = 0;
    save();
  }

  return { read, refresh, invalidate };
}

module.exports = { catalogCache };
