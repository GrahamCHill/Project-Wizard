// Builds one folder per browser from the shared source:
//   dist/chrome   Chrome, Edge, Brave, Opera, and other Chromium browsers (a service worker)
//   dist/firefox  Firefox desktop and Android (a background script and a gecko id)
//   dist/safari   Safari on macOS and iOS (convert it to an Xcode project with `npm run safari`)
// Only the manifest differs. Everything else is copied unchanged from src/.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPng, iconSizes } from './icons.mjs';

export const targets = ['chrome', 'firefox', 'safari'];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

/** Merges objects deeply. Arrays and other values from `override` replace the ones in `base`. */
export function merge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const plain = value && typeof value === 'object' && !Array.isArray(value);
    out[key] = plain && out[key] && typeof out[key] === 'object' ? merge(out[key], value) : value;
  }
  return out;
}

export function buildManifest(target, version) {
  if (!targets.includes(target)) throw new Error(`Unknown target '${target}'. Choose one of: ${targets.join(', ')}.`);
  const base = readJson(join(root, 'manifests', 'base.json'));
  return merge({ ...base, version }, readJson(join(root, 'manifests', `${target}.json`)));
}

export function build(target, { outDir = join(root, 'dist', target) } = {}) {
  const manifest = buildManifest(target, readJson(join(root, 'package.json')).version);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'icons'), { recursive: true });
  for (const size of iconSizes) writeFileSync(join(outDir, 'icons', `icon-${size}.png`), createPng(size));
  // Copied last, so artwork you add to src/icons replaces the generated icons.
  cpSync(join(root, 'src'), outDir, { recursive: true });
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return outDir;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requested = process.argv[2] ? [process.argv[2]] : targets;
  for (const target of requested) console.log(`Built ${target}: ${build(target)}`);
}
