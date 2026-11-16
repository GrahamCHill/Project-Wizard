const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { generatorRegistry, generatorSources } = require('../clion/generators');

test('the CLion registry adds individual starters and defers equivalent entries to CLion', () => {
  const registry = generatorRegistry();
  assert.equal(registry.find(entry => entry.id === 'raylib-cpp').label, 'Raylib for C++');
  assert.deepEqual(registry.find(entry => entry.id === 'sdl').platforms, ['win32', 'darwin', 'linux']);
  assert.deepEqual(registry.find(entry => entry.id === 'ios-uikit').platforms, ['darwin']);
  assert.ok(registry.find(entry => entry.id === 'rust-cli').names.includes('Rust'));
  assert.ok(['empty', 'c-cmake', 'cpp-cmake', 'cuda-cmake'].every(id => !registry.some(entry => entry.id === id)));
  assert.equal(generatorSources().extensions.split('\n').length, registry.length);
});

function requestBridge(request) {
  const bridge = path.join(__dirname, '..', 'clion', 'bridge.js');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bridge], { windowsHide: true });
    const chunks = [];
    const errors = [];
    child.stdout.on('data', chunk => chunks.push(chunk));
    child.stderr.on('data', chunk => errors.push(chunk));
    child.on('error', reject);
    child.stdin.on('error', reject);
    child.on('close', code => {
      try {
        if (code !== 0) throw new Error(Buffer.concat(errors).toString('utf8'));
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

test('the CLion bridge creates Raylib and SDL in IDE-created directories and preserves project files', async t => {
  const parent = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(parent, 'project-wizard-clion-'));
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    await fs.rm(root, { recursive: true, force: true });
  });
  const context = { tools: {}, pythonVersions: [], mono: [] };
  for (const [name, templateId, options, library] of [
    ['Raylib Example', 'raylib-cpp', { targets: ['native', 'emscripten'] }, /target_link_libraries\(game PRIVATE raylib\)/],
    ['SDL Example', 'sdl', { build: 'sdl2', language: 'c', renderer: 'default' }, /SDL2::SDL2-static/]
  ]) {
    const destination = path.join(root, name);
    const idea = path.join(destination, '.idea');
    await fs.mkdir(idea, { recursive: true });
    const workspace = path.join(idea, 'workspace.xml');
    await fs.writeFile(workspace, '<project />');
    const request = { action: 'create', templateId, context, destination, options, initializeGit: false };
    const result = await requestBridge(request);
    assert.equal(result.error, undefined);
    assert.equal(result.destination, destination);
    assert.equal(await fs.readFile(workspace, 'utf8'), '<project />');
    const cmakeFile = path.join(destination, 'CMakeLists.txt');
    const cmake = await fs.readFile(cmakeFile, 'utf8');
    assert.match(cmake, library);
    assert.match(cmake, /OUTPUT_NAME index SUFFIX "\.html"/);
    assert.match(await fs.readFile(path.join(destination, 'README.md'), 'utf8'), /itch\.io/);
    assert.match((await requestBridge(request)).error, /project folder must be empty/);
    assert.equal(await fs.readFile(cmakeFile, 'utf8'), cmake);
  }
});
