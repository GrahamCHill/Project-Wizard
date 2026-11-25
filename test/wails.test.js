const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { starters } = require('../src/starters');
const { projectOptions, readProjectOptions, applyProjectOptions } = require('../src/project-options');
const { enabledTemplates, readCatalogSettings } = require('../src/catalog');
const { executableIconFormats, loadExecutableIcons } = require('../src/native-app');
const { generatorRegistry } = require('../clion/generators');

test('keeps Wails 2 and 3 combined in one Go desktop entry in both IDEs', () => {
  const tools = { 'wails-go': {}, wails2: {}, wails3: {}, 'vite-node': {}, npm: {}, 'wails-webview': {} };
  const templates = starters.filter(template => template.kind === 'wails');
  assert.equal(templates.length, 1);
  const [template] = templates;
  assert.equal(template.id, 'wails');
  assert.equal(template.language, 'Go');
  assert.equal(template.group, 'desktop');
  const choice = projectOptions(template, tools, [], 'win32').buildChoice;
  assert.deepEqual(choice.options.map(option => option.id), ['wails3', 'wails2']);
  assert.equal(choice.defaultId, 'wails3');
  assert.equal(projectOptions(template, { ...tools, wails3: undefined }, [], 'win32').buildChoice.defaultId, 'wails2');
  for (const build of ['wails2', 'wails3']) assert.equal(readProjectOptions(template, { build }).build, build);
  assert.throws(() => readProjectOptions(template, { build: 'unknown' }), /supported build option/);
  assert.deepEqual(executableIconFormats(template), ['.png', '.webp']);
  assert.equal(generatorRegistry().filter(item => item.id?.startsWith('wails')).length, 1);
  assert.deepEqual(enabledTemplates(templates, readCatalogSettings({ disabledLanguages: ['Go'] })), []);
});

test('writes packaging icons for both Wails versions from the combined Go template', async t => {
  const temp = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temp, 'project-wizard-wails-'));
  t.after(async () => {
    assert.equal(path.dirname(root), temp);
    await fs.rm(root, { recursive: true, force: true });
  });
  const sharp = require('sharp');
  const source = path.join(root, 'icon.png');
  await sharp({ create: { width: 32, height: 32, channels: 4, background: '#1289aaff' } }).png().toFile(source);
  const icons = await loadExecutableIcons([source]);
  for (const build of ['wails2', 'wails3']) {
    const project = path.join(root, build);
    const directory = path.join(project, 'build/windows');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'icon.ico'), 'old generated icon');
    await fs.writeFile(path.join(project, 'README.md'), '# Wails icon example\n');
    const template = starters.find(item => item.id === 'wails');
    const options = readProjectOptions(template, { build, executableIcon: true }, icons);
    await applyProjectOptions(project, template, 'Wails icon example', options);
    const image = await sharp(path.join(project, 'build/appicon.png')).metadata();
    assert.equal(image.width, 1024);
    assert.equal(image.height, 1024);
    assert.match(await fs.readFile(path.join(project, 'README.md'), 'utf8'), /build\/appicon.png/);
    if (build === 'wails2') await assert.rejects(fs.access(path.join(directory, 'icon.ico')), { code: 'ENOENT' });
  }
});
