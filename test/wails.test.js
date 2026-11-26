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

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { addWailsTests, wailsVersions } = require('../src/wails');

const exec = promisify(execFile);

async function scratch(t) {
  const temp = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temp, 'project-wizard-wails-tests-'));
  t.after(async () => {
    assert.equal(path.dirname(root), temp);
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

const version = id => wailsVersions.find(option => option.id === id);
const sources = {
  wails2: ['app.go', 'type App struct{}\n\nfunc (a *App) Greet(name string) string {\n\treturn "Hello " + name\n}\n'],
  wails3: ['greetservice.go', 'type GreetService struct{}\n\nfunc (g *GreetService) Greet(name string) string {\n\treturn "Hello " + name\n}\n']
};

test('adds a Go test that calls the greeting method each Wails version generates', async t => {
  const root = await scratch(t);
  for (const [id, [file, source]] of Object.entries(sources)) {
    const project = path.join(root, id);
    await fs.mkdir(project);
    await fs.writeFile(path.join(project, file), 'package main\n\n' + source);
    assert.equal(await addWailsTests(project, version(id)), true);
    const testFile = file.replace('.go', '_test.go');
    const contents = await fs.readFile(path.join(project, testFile), 'utf8');
    assert.match(contents, /^package main$/m);
    assert.match(contents, /func TestGreetIncludesTheName\(t \*testing\.T\)/);
    assert.match(contents, id === 'wails2' ? /app\.Greet\(name\)/ : /service\.Greet\(name\)/);
    if (id === 'wails2') assert.match(contents, /app\.startup\(ctx\)/);
    // main.go embeds frontend/dist, so the test must be able to compile before a frontend build.
    assert.ok((await fs.readdir(path.join(project, 'frontend', 'dist'))).length > 0);
  }
});

test('keeps a frontend build the generator already placed and never overwrites an existing test', async t => {
  const root = await scratch(t);
  await fs.mkdir(path.join(root, 'frontend/dist'), { recursive: true });
  await fs.writeFile(path.join(root, 'frontend/dist/index.html'), '<html></html>');
  await fs.writeFile(path.join(root, 'app.go'), 'package main\n\n' + sources.wails2[1]);
  await addWailsTests(root, version('wails2'));
  assert.deepEqual(await fs.readdir(path.join(root, 'frontend/dist')), ['index.html']);
  await assert.rejects(addWailsTests(root, version('wails2')), { code: 'EEXIST' });
});

test('skips the Wails test, without failing creation, when the template no longer has the method', async t => {
  const root = await scratch(t);
  const messages = [];
  assert.equal(await addWailsTests(root, version('wails2'), line => messages.push(line)), false);
  await fs.writeFile(path.join(root, 'app.go'), 'package main\n\nfunc (a *App) Hello() {}\n');
  assert.equal(await addWailsTests(root, version('wails2'), line => messages.push(line)), false);
  assert.equal(messages.length, 2);
  assert.deepEqual(await fs.readdir(root), ['app.go']);
});

async function command(file, args) {
  try {
    await exec(file, args, { windowsHide: true, timeout: 30000 });
    return true;
  } catch {
    return false;
  }
}

test('real Wails projects pass go vet and go test when the CLIs are installed', async t => {
  // Generation and `go test` download Go modules, so this only runs when PROJECT_WIZARD_WAILS=1 is set.
  if (process.env.PROJECT_WIZARD_WAILS !== '1') return t.skip('Set PROJECT_WIZARD_WAILS=1 to generate real Wails projects.');
  if (!await command('go', ['version'])) return t.skip('Go is not installed.');
  const { createWailsProject } = require('../src/wails');
  const { createProject } = require('../src/projects');
  const root = await scratch(t);
  const tools = { 'wails-go': { file: 'go', version: '1.26.10' } };
  const cli = { wails2: ['wails', ['version']], wails3: ['wails3', ['version']] };
  for (const [build, [file, args]] of Object.entries(cli)) {
    await t.test(build, async t => {
      if (!await command(file, args)) return t.skip(file + ' is not installed.');
      const tooling = { ...tools, [build]: { file, version: version(build).version } };
      const project = await createProject(root, build, target => createWailsProject('9 Wails Demo', target, tooling, build));
      const env = { ...process.env, GOWORK: 'off', GOTOOLCHAIN: 'local', GOFLAGS: '-mod=mod' };
      const run = args => exec('go', args, { cwd: project, env, windowsHide: true, timeout: 600000 });
      await run(['vet', '.']);
      const { stdout } = await run(['test', '-count=1', '-v', '.']);
      assert.match(stdout, /--- PASS: TestGreetIncludesTheName/);
      assert.match(await fs.readFile(path.join(project, 'README.md'), 'utf8'), /## Tests[\s\S]*go test \.\/\.\.\./);
    });
  }
});
