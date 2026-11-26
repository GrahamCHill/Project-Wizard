const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { promisify } = require('node:util');
const { displayGroup } = require('../src/groups');
const { createProject } = require('../src/projects');
const { starters, writeStarter } = require('../src/starters');

const exec = promisify(execFile);
const root = path.join(__dirname, '..');
const templates = path.join(root, 'templates');
const projectName = 'Blender World';
const ids = ['misc-blender-world-raylib', 'misc-blender-world-sdl', 'misc-blender-world-bevy'];
const cIds = ids.slice(0, 2);

async function fixture(t) {
  const temp = await fs.realpath(os.tmpdir());
  const directory = await fs.mkdtemp(path.join(temp, 'project-wizard-misc-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), temp);
    await fs.rm(directory, { recursive: true, force: true });
  });
  return directory;
}

async function generate(directory, id, name = projectName) {
  const template = starters.find(item => item.id === id);
  assert.ok(template, 'missing template ' + id);
  return createProject(directory, id, (project, parent) => writeStarter(template, name, project, parent));
}

async function files(directory, base = directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ?
    files(path.join(directory, entry.name), base) : [path.relative(base, path.join(directory, entry.name)).replaceAll('\\', '/')]));
  return nested.flat().sort();
}

const read = (project, file) => fs.readFile(path.join(project, file), 'utf8');
const bytes = file => fs.readFile(path.join(templates, '_shared', 'blender-world', file));

test('the Blender world examples are listed under Misc and say what they need', () => {
  for (const id of ids) {
    const template = starters.find(item => item.id === id);
    assert.ok(template, id);
    assert.equal(template.group, 'misc');
    assert.equal(displayGroup(template.group), 'misc');
    assert.match(template.requirement, /Blender is needed only to make your own world/);
    assert.ok(template.description.length > 40);
  }
  assert.deepEqual(starters.find(item => item.id === ids[2]).tools, ['rust']);
  for (const id of cIds) assert.deepEqual(starters.find(item => item.id === id).tools, ['cmake', 'c-compiler']);
});

test('every file a Blender world template lists exists, so a missing file fails here and not for a user', async () => {
  for (const id of ids) {
    const template = starters.find(item => item.id === id);
    for (const file of template.files) await fs.access(path.join(templates, id, file));
    for (const source of Object.keys(template.sharedFiles)) await fs.access(path.join(templates, '_shared', source));
  }
});

test('the C examples are generated with the shared loader, player, tests, sample world, and Blender script', async t => {
  const directory = await fixture(t);
  const shared = ['assets/world.gltf', 'tools/export_world.py', 'src/world.c', 'src/world.h', 'src/player.c', 'src/player.h', 'tests/world_test.c'];
  const raylib = await generate(directory, cIds[0]);
  assert.deepEqual(await files(raylib), [...shared, '.gitignore', 'CMakeLists.txt', 'README.md', 'src/main.c'].sort());
  const sdl = await generate(directory, cIds[1]);
  assert.deepEqual(await files(sdl), [...shared, '.gitignore', 'CMakeLists.txt', 'README.md', 'src/main.c', 'src/raster.c', 'src/raster.h',
    'tests/raster_test.c'].sort());

  // The shared files are copied exactly, so the two engines cannot drift apart.
  for (const project of [raylib, sdl]) {
    for (const [file, source] of [['src/world.c', 'c/world.c'], ['src/world.h', 'c/world.h'], ['src/player.c', 'c/player.c'],
      ['src/player.h', 'c/player.h'], ['tests/world_test.c', 'c/world_test.c'], ['assets/world.gltf', 'world.gltf'],
      ['tools/export_world.py', 'export_world.py']]) {
      assert.equal(await read(project, file), (await bytes(source)).toString('utf8').replaceAll('\r\n', '\n'), file);
    }
  }
});

test('the Bevy example is a Cargo package named after the project, with the shared sample world and Blender script', async t => {
  const project = await generate(await fixture(t), ids[2], 'My Level');
  assert.deepEqual(await files(project), ['.gitignore', 'Cargo.toml', 'README.md', 'assets/world.gltf', 'src/main.rs', 'src/player.rs',
    'src/world.rs', 'tools/export_world.py']);
  const manifest = await read(project, 'Cargo.toml');
  assert.match(manifest, /^name = "my-level"$/m);
  assert.match(manifest, /^bevy = "0\.20\.1"$/m);
  assert.match(manifest, /^gltf = \{ version = "1\.4\.1"/m);
  assert.match(manifest, /\[profile\.dev\.package\."\*"\]\nopt-level = 3/);
  assert.match(await read(project, 'src/main.rs'), /title: "My Level"\.into\(\)/);
  assert.equal(await read(project, 'tools/export_world.py'), (await bytes('export_world.py')).toString('utf8').replaceAll('\r\n', '\n'));
});

test('project names are used where the build needs them, and no template token is left behind', async t => {
  const directory = await fixture(t);
  for (const id of ids) {
    const project = await generate(directory, id, 'Sample App');
    for (const file of await files(project)) {
      assert.doesNotMatch(await read(project, file), /__PROJECT_(NAME|SLUG|IDENTIFIER)__|__NATIVE_|__CMAKE_/, `${id}/${file}`);
    }
  }
  const raylib = await generate(await fixture(t), cIds[0], 'Sample App');
  assert.match(await read(raylib, 'CMakeLists.txt'), /project\(Sample_App LANGUAGES C\)/);
  assert.match(await read(raylib, 'CMakeLists.txt'), /OUTPUT_NAME "Sample App"/);
  assert.match(await read(raylib, 'src/main.c'), /InitWindow\(1280, 720, "Sample App"\)/);
  assert.match(await read(raylib, 'README.md'), /^# Sample App$/m);
});

test('the CMake files pin the library versions the repository already uses', async t => {
  const directory = await fixture(t);
  const raylib = await read(await generate(directory, cIds[0]), 'CMakeLists.txt');
  assert.match(raylib, /raysan5\/raylib\/archive\/refs\/tags\/6\.0\.tar\.gz/);
  assert.match(raylib, /FIND_PACKAGE_ARGS 6\.0/);
  const sdl = await read(await generate(directory, cIds[1]), 'CMakeLists.txt');
  assert.match(sdl, /release-3\.4\.16\/SDL3-3\.4\.16\.tar\.gz/);
  for (const text of [raylib, sdl]) {
    assert.match(text, /ibireme\/yyjson\/archive\/refs\/tags\/0\.13\.0\.tar\.gz/);
    // The loader, player, and renderer are a separate library, so tests link without a window system.
    assert.match(text, /add_library\(world STATIC src\/world\.c src\/player\.c/);
    assert.match(text, /add_test\(NAME world /);
  }
  assert.match(sdl, /add_test\(NAME raster /);
  const repositoryVersions = await fs.readFile(path.join(root, 'src', 'sdl.js'), 'utf8');
  assert.match(repositoryVersions, /version: '3\.4\.16'/);
});

// --- The sample world: the contract all three examples depend on -------------------------------------------------------

async function sampleWorld() {
  return JSON.parse((await bytes('world.gltf')).toString('utf8'));
}

test('the sample world follows the contract the loaders rely on', async () => {
  const gltf = await sampleWorld();
  assert.equal(gltf.asset.version, '2.0');
  assert.deepEqual(gltf.extensionsUsed, ['KHR_lights_punctual']);

  const named = Object.fromEntries(gltf.nodes.map(node => [node.name, node]));
  const colliders = gltf.nodes.filter(node => node.extras?.collider === 'box');
  assert.equal(colliders.length, 9);
  for (const node of colliders) assert.notEqual(node.mesh, undefined, `${node.name} has a collider but no mesh`);
  assert.ok(named.spawn_player && named.spawn_player.mesh === undefined, 'a spawn empty with no mesh');
  assert.equal(named.Lamp.extensions.KHR_lights_punctual.light, 0);
  assert.equal(gltf.extensions.KHR_lights_punctual.lights[0].type, 'point');

  // The geometry is embedded and its accessors fit inside the buffer, so no file is needed beside it.
  const [buffer] = gltf.buffers;
  assert.match(buffer.uri, /^data:application\/octet-stream;base64,/);
  const data = Buffer.from(buffer.uri.split(',')[1], 'base64');
  assert.equal(data.length, buffer.byteLength);
  for (const accessor of gltf.accessors) {
    const view = gltf.bufferViews[accessor.bufferView];
    const size = { SCALAR: 1, VEC3: 3 }[accessor.type] * (accessor.componentType === 5126 ? 4 : 2);
    assert.ok((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + size * accessor.count <= data.length, 'accessor fits in the buffer');
  }
  // Every triangle index points at a real vertex.
  const indices = gltf.accessors.find(accessor => accessor.type === 'SCALAR');
  const view = gltf.bufferViews[indices.bufferView];
  for (let i = 0; i < indices.count; i++) {
    assert.ok(data.readUInt16LE((view.byteOffset ?? 0) + (indices.byteOffset ?? 0) + i * 2) < 24);
  }
});

test('the sample world file is exactly what its generator script writes, so the two cannot drift apart', async t => {
  const directory = await fixture(t);
  const output = path.join(directory, 'world.gltf');
  await exec(process.execPath, [path.join(templates, '_shared', 'blender-world', 'make_sample_world.mjs'), output]);
  assert.equal((await fs.readFile(output, 'utf8')).replaceAll('\r\n', '\n'), (await bytes('world.gltf')).toString('utf8').replaceAll('\r\n', '\n'));
});

test('the Blender export script names its own limits and uses the settings the loaders expect', async () => {
  const script = (await bytes('export_world.py')).toString('utf8');
  for (const setting of ['export_extras', 'export_lights', 'export_yup', 'GLTF_EMBEDDED', 'export_apply']) assert.ok(script.includes(setting), setting);
  assert.ok(script.includes('spawn_player') && script.includes('"collider"') && script.includes('"box"'));
  // The loaders read the empty by this exact name and the property by this exact name.
  for (const file of ['c/world.c']) assert.ok((await bytes(file)).toString('utf8').includes('"spawn_player"'));
  assert.ok((await fs.readFile(path.join(templates, 'misc-blender-world-bevy', 'src', 'world.rs'), 'utf8')).includes('"spawn_player"'));
});

// --- Opt-in: build and run the real thing ------------------------------------------------------------------------------

const cmake = process.env.PROJECT_WIZARD_CMAKE === '1';
const cargo = process.env.PROJECT_WIZARD_CARGO === '1';
const bpy = process.env.PROJECT_WIZARD_BPY; // a Python that can import bpy, such as one with `pip install bpy`

for (const id of cIds) {
  test(`${id} builds and its tests pass with CMake`, { skip: !cmake && 'set PROJECT_WIZARD_CMAKE=1 (downloads yyjson and the engine)', timeout: 900000 }, async t => {
    const project = await generate(await fixture(t), id);
    const build = path.join(project, 'build');
    await exec('cmake', ['-S', project, '-B', build, '-DCMAKE_BUILD_TYPE=Debug'], { maxBuffer: 1 << 26 });
    const targets = id.endsWith('sdl') ? ['world_test', 'raster_test'] : ['world_test'];
    await exec('cmake', ['--build', build, '--config', 'Debug', '--target', ...targets], { maxBuffer: 1 << 26 });
    const { stdout } = await exec('ctest', ['--test-dir', build, '-C', 'Debug', '--output-on-failure'], { maxBuffer: 1 << 26 });
    assert.match(stdout, /100% tests passed/);
  });
}

test('the Bevy example builds and its tests pass with Cargo', { skip: !cargo && 'set PROJECT_WIZARD_CARGO=1 (compiles Bevy, which takes several minutes)', timeout: 3600000 }, async t => {
  const project = await generate(await fixture(t), ids[2]);
  const { stdout, stderr } = await exec('cargo', ['test', '--manifest-path', path.join(project, 'Cargo.toml')], { maxBuffer: 1 << 27 });
  assert.match(stdout + stderr, /test result: ok\. \d+ passed; 0 failed/);
});

test('the Blender export script works on a scene built with real Blender code', { skip: !bpy && 'set PROJECT_WIZARD_BPY to a Python with bpy installed', timeout: 300000 }, async t => {
  const directory = await fixture(t);
  const script = (await fs.readFile(path.join(__dirname, 'blender', 'export_world_check.py'), 'utf8'));
  await fs.writeFile(path.join(directory, 'check.py'), script);
  const { stdout } = await exec(bpy, [path.join(directory, 'check.py')], {
    env: { ...process.env, EXPORTER: path.join(templates, '_shared', 'blender-world', 'export_world.py'), OUT: directory }
  });
  assert.match(stdout, /0 failed/);
});
