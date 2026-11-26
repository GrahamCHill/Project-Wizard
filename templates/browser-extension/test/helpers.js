// Loads the extension's classic scripts into a sandbox, the way a browser loads them, with a fake `browser`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function load(files, globals = {}) {
  const sandbox = { console, ...globals };
  vm.createContext(sandbox);
  for (const file of files) vm.runInContext(readFileSync(join(root, 'src', file), 'utf8'), sandbox, { filename: file });
  return sandbox;
}

/** A fake of the parts of the extension API this project uses. Listeners are kept so tests can call them. */
export function fakeApi(initialSync = {}) {
  const sync = { ...initialSync };
  const calls = { badgeText: [], badgeColor: [], sent: [] };
  const listeners = { message: [], installed: [] };
  const api = {
    runtime: {
      onMessage: { addListener: listener => listeners.message.push(listener) },
      onInstalled: { addListener: listener => listeners.installed.push(listener) },
      sendMessage: async message => {
        calls.sent.push(message);
        return {};
      }
    },
    storage: {
      sync: {
        get: async keys => Object.fromEntries(keys.filter(key => key in sync).map(key => [key, sync[key]])),
        set: async values => void Object.assign(sync, values)
      }
    },
    action: {
      setBadgeText: async details => void calls.badgeText.push(details),
      setBadgeBackgroundColor: async details => void calls.badgeColor.push(details)
    }
  };
  return { api, sync, calls, listeners };
}

/** Copies a value out of the sandbox. Objects made inside it have another realm's prototypes, which strict deep equality rejects. */
export const plain = value => JSON.parse(JSON.stringify(value));

export const same = (actual, expected, message) => assert.deepEqual(plain(actual), expected, message);
