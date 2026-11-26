import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { build, buildManifest, merge, targets } from '../scripts/build.mjs';
import { createPng } from '../scripts/icons.mjs';
import { root } from './helpers.js';

const output = mkdtempSync(join(tmpdir(), 'extension-build-'));
after(() => rmSync(output, { recursive: true, force: true }));
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const manifestOf = target => JSON.parse(readFileSync(join(output, target, 'manifest.json'), 'utf8'));
for (const target of targets) build(target, { outDir: join(output, target) });

/** Every file a manifest and its pages refer to. */
function references(target) {
  const manifest = manifestOf(target);
  const files = new Set([...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon), manifest.action.default_popup, manifest.options_ui.page]);
  for (const script of manifest.content_scripts) script.js.forEach(file => files.add(file));
  if (manifest.background.service_worker) files.add(manifest.background.service_worker);
  for (const file of manifest.background.scripts ?? []) files.add(file);
  for (const page of [manifest.action.default_popup, manifest.options_ui.page]) {
    const html = readFileSync(join(output, target, page), 'utf8');
    for (const [, reference] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) files.add(join(dirname(page), reference).replaceAll('\\', '/'));
  }
  return [...files];
}

describe('builds', () => {
  it('produces one folder per browser', () => {
    assert.deepEqual(targets, ['chrome', 'firefox', 'safari']);
    for (const target of targets) assert.ok(existsSync(join(output, target, 'manifest.json')), target);
  });

  it('writes a Manifest V3 file with the package version for every browser', () => {
    for (const target of targets) {
      const manifest = manifestOf(target);
      assert.equal(manifest.manifest_version, 3, target);
      assert.equal(manifest.version, version, target);
      assert.equal(manifest.name, '__PROJECT_NAME__');
    }
  });

  it('includes every file that each manifest and page refers to', () => {
    for (const target of targets) {
      const files = references(target);
      assert.ok(files.length >= 14, target + ' should have many references');
      for (const file of files) assert.ok(existsSync(join(output, target, file)), `${target} is missing ${file}`);
    }
  });

  it('uses a service worker for Chrome and background scripts for Firefox and Safari', () => {
    const chrome = manifestOf('chrome');
    assert.equal(chrome.background.service_worker, 'background.js');
    assert.equal(chrome.background.scripts, undefined, 'Chrome rejects a manifest that has both');
    assert.equal(chrome.browser_specific_settings, undefined);
    for (const target of ['firefox', 'safari']) {
      const { background } = manifestOf(target);
      assert.equal(background.service_worker, undefined, target);
      assert.deepEqual(background.scripts.slice(-1), ['background.js']);
      assert.ok(background.scripts.indexOf('shared/api.js') < background.scripts.indexOf('background.js'), 'helpers load first');
    }
  });

  it('gives Firefox an add-on id and declares that it collects no data', () => {
    const { gecko } = manifestOf('firefox').browser_specific_settings;
    assert.match(gecko.id, /^[a-z0-9-]+@example\.com$/);
    assert.deepEqual(gecko.data_collection_permissions, { required: ['none'] });
    assert.equal(manifestOf('safari').browser_specific_settings, undefined);
  });

  it('asks for as little as it can and loads no remote code', () => {
    for (const target of targets) {
      const manifest = manifestOf(target);
      assert.deepEqual(manifest.permissions, ['storage'], target);
      assert.equal(manifest.host_permissions, undefined);
      assert.equal(manifest.content_security_policy, undefined);
      assert.deepEqual(manifest.content_scripts[0].matches, ['http://*/*', 'https://*/*']);
      for (const file of readdirSync(join(output, target), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())) {
        if (!/\.(js|html)$/.test(file.name)) continue;
        const source = readFileSync(join(file.parentPath, file.name), 'utf8');
        assert.doesNotMatch(source, /https?:\/\/[^\s"']*\.(js|mjs)\b|\beval\(|new Function\(/, `${target}/${file.name} loads or builds code at runtime`);
      }
    }
  });

  it('draws valid PNG icons at every size', () => {
    for (const size of [16, 32, 48, 128]) {
      const png = readFileSync(join(output, 'chrome', 'icons', `icon-${size}.png`));
      assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.equal(png.readUInt32BE(16), size, 'width');
      assert.equal(png.readUInt32BE(20), size, 'height');
      assert.equal(png.toString('ascii', png.length - 8, png.length - 4), 'IEND');
    }
    assert.deepEqual(createPng(16), createPng(16), 'the icons are reproducible');
  });

  it('merges deeply and rejects an unknown target', () => {
    assert.deepEqual(merge({ a: { b: 1, c: 2 }, d: [1] }, { a: { c: 3 }, d: [2, 3] }), { a: { b: 1, c: 3 }, d: [2, 3] });
    assert.throws(() => buildManifest('opera', '1.0.0'), /Unknown target 'opera'/);
  });

  it('the Safari script refuses to run outside macOS and documents its next step', () => {
    const script = readFileSync(join(root, 'scripts', 'safari.mjs'), 'utf8');
    assert.match(script, /process\.platform !== 'darwin'/);
    assert.match(script, /safari-web-extension-converter/);
  });
});
