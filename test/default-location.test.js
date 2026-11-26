const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { defaultLocationKey, readDefaultLocation, startLocation, validateDefaultLocation } = require('../src/default-location');

async function fixture(t) {
  const temp = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temp, 'project-wizard-location-'));
  t.after(async () => {
    assert.equal(path.dirname(root), temp);
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

const home = path.resolve(os.homedir());
const workspace = path.join(os.homedir(), 'workspace-folder');

test('reads the saved location as trimmed text and ignores other values', () => {
  assert.equal(readDefaultLocation('  /projects  '), '/projects');
  for (const value of [undefined, null, 5, {}, []]) assert.equal(readDefaultLocation(value), '');
});

test('starts in the saved folder when it exists, so projects land in the same place every time', async t => {
  const root = await fixture(t);
  const saved = path.join(root, 'projects');
  await fs.mkdir(saved);
  assert.equal(await startLocation({ saved, workspace, home }), saved);
  assert.equal(await startLocation({ saved: '  ' + saved + '  ', workspace, home }), saved);
});

test('a folder the wizard was opened from wins over the saved default', async t => {
  const root = await fixture(t);
  const saved = path.join(root, 'projects');
  await fs.mkdir(saved);
  const requested = path.join(root, 'right-clicked');
  assert.equal(await startLocation({ requested, saved, workspace, home }), requested);
});

test('falls back to the workspace and then the home folder when there is no usable saved folder', async t => {
  const root = await fixture(t);
  const file = path.join(root, 'a-file');
  await fs.writeFile(file, 'not a folder');
  for (const saved of [undefined, '', '   ', path.join(root, 'deleted'), file, 'relative/folder', 42]) {
    assert.equal(await startLocation({ saved, workspace, home }), workspace, String(saved));
    assert.equal(await startLocation({ saved, home }), home, String(saved));
  }
});

test('validates a folder before saving it as the default', async t => {
  const root = await fixture(t);
  const folder = path.join(root, 'projects');
  await fs.mkdir(folder);
  assert.equal(await validateDefaultLocation(folder), folder);
  assert.equal(await validateDefaultLocation('  ' + folder + path.sep + '  '), folder);
  await assert.rejects(validateDefaultLocation(''), /Enter a location/);
  await assert.rejects(validateDefaultLocation('   '), /Enter a location/);
  await assert.rejects(validateDefaultLocation('relative/path'), /absolute folder path/);
  await assert.rejects(validateDefaultLocation(path.join(root, 'missing')), /Folder is unavailable/);
  const file = path.join(root, 'file.txt');
  await fs.writeFile(file, 'x');
  await assert.rejects(validateDefaultLocation(file), /Folder is unavailable/);
});

test('declares the machine-scoped setting that the wizard reads and writes', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const setting = manifest.contributes.configuration.properties[defaultLocationKey];
  assert.equal(defaultLocationKey, 'projectWizard.defaultLocation');
  assert.equal(setting.type, 'string');
  assert.equal(setting.default, '');
  assert.equal(setting.scope, 'machine', 'a folder path only makes sense on the machine that has it');
  assert.match(setting.markdownDescription, /Save as default/);
});

test('the extension and the webview agree on the default-location messages and button', async () => {
  const extension = await fs.readFile(path.join(__dirname, '..', 'src', 'extension.js'), 'utf8');
  const webview = await fs.readFile(path.join(__dirname, '..', 'media', 'wizard.js'), 'utf8');
  assert.match(extension, /<button id="default-location"/);
  assert.match(webview, /byId\('default-location'\)/);
  // Webview to extension.
  for (const type of ['saveDefaultLocation', 'clearDefaultLocation']) {
    assert.ok(webview.includes(`type: '${type}'`), 'webview sends ' + type);
    assert.ok(extension.includes(`'${type}'`), 'extension handles ' + type);
  }
  // Extension to webview.
  for (const type of ['defaultLocation', 'defaultLocationError']) {
    assert.ok(extension.includes(`type: '${type}'`), 'extension sends ' + type);
    assert.ok(webview.includes(`case '${type}':`), 'webview handles ' + type);
  }
  assert.match(extension, /defaultLocation: savedDefaultLocation\(\)/, 'the catalog carries the saved location');
  assert.match(extension, /startLocation\(\{[\s\S]*requested: requestedParent/);
  assert.match(extension, /event\.affectsConfiguration\(defaultLocationKey\)/, 'editing the setting updates an open wizard');
});

test('the webview treats two spellings of one folder as the same folder', async () => {
  const webview = await fs.readFile(path.join(__dirname, '..', 'media', 'wizard.js'), 'utf8');
  const start = webview.indexOf('function sameFolder');
  const end = webview.indexOf('function updateDefaultLocation');
  assert.ok(start > 0 && end > start);
  const sameFolder = separator => new Function('catalog', webview.slice(start, end) + '\nreturn sameFolder;')({ separator });
  const windows = sameFolder('\\');
  assert.equal(windows('C:\\Projects\\', 'c:\\projects'), true);
  assert.equal(windows('C:/Projects', 'C:\\Projects\\'), true);
  assert.equal(windows('C:\\Projects', 'C:\\Other'), false);
  const posix = sameFolder('/');
  assert.equal(posix('/home/ada/projects/', '/home/ada/projects'), true);
  assert.equal(posix('/home/ada/Projects', '/home/ada/projects'), false, 'POSIX paths are case-sensitive');
  for (const [first, second] of [['', '/a'], ['/a', ''], ['', '']]) assert.equal(posix(first, second), false);
});
