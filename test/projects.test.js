const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { createWriteStream } = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { test } = require('node:test');
const { promisify } = require('node:util');
const { ZipFile } = require('yazl');
const { createProject, detectFrameworks, parseMonoGameTemplates, replaceTokens, validateProjectName } = require('../src/projects');
const { starters, writeStarter } = require('../src/starters');
const { getSetup, supportsReactNative, supportsVite, templateAvailability, templatesForPlatform } = require('../src/toolchains');
const { applyProjectOptions, projectOptions, readProjectOptions } = require('../src/project-options');
const { selectPython } = require('../src/python-options');
const { extractZipTemplate, listZipTemplates } = require('../src/zip-templates');
const { reactNativeIdentifier } = require('../src/react-native');
const { enabledTemplates, readCatalogSettings } = require('../src/catalog');
const { gitProjectStatus, initializeProjectGit } = require('../src/git-project');
const { loadExecutableIcons } = require('../src/native-app');

const exec = promisify(execFile);

async function fixture(t) {
  const temp = await fs.realpath(os.tmpdir());
  const directory = await fs.mkdtemp(path.join(temp, 'project-wizard-test-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), temp);
    await fs.rm(directory, { recursive: true, force: true });
  });
  return directory;
}

async function writeZip(folder, entries) {
  const archive = path.join(folder, 'Starter.ZIP');
  const zip = new ZipFile();
  const written = pipeline(zip.outputStream, createWriteStream(archive));
  for (const [name, data, options] of entries) {
    zip.addBuffer(Buffer.from(data), name, options);
  }
  zip.end();
  await written;
  return archive;
}

test('discovers MonoGame aliases and framework package references', () => {
  const templates = parseMonoGameTemplates(`Template Name   Short Name   Language   Tags
MonoGame Cross-Platform OpenGL Desktop Application  mgdesktopgl  [C#]  MonoGame/Games/Desktop
MonoGame Empty Game  monogame,mg-emptygame  [C#]  MonoGame/Games/Empty
Console App  console  [C#],F#,VB  Common/Console`);
  assert.deepEqual(templates.map(({ shortName }) => shortName), ['mg-emptygame', 'mgdesktopgl']);
  assert.equal(templates[0].language, 'C#');
  assert.deepEqual(detectFrameworks('Example.csproj', `<ItemGroup>
    <PackageReference Version="3.8.6" Include="MonoGame.Framework.DesktopGL" />
    <PackageReference Include='Raylib-cs' />
  </ItemGroup>`), ['MonoGame', 'Raylib']);
  assert.deepEqual(detectFrameworks('CMakeLists.txt', 'FetchContent_Declare(\n  raylib\n  URL test)'), ['Raylib']);
  assert.deepEqual(detectFrameworks('Example.csproj', '<!-- <PackageReference Include="Raylib-cs"/> -->'), []);
});

test('creates a Raylib C starter and preserves an existing project', async t => {
  const parent = await fixture(t);
  const template = starters.find(item => item.id === 'raylib-c');
  const name = '9 Test-Game';
  const project = await createProject(parent, name, (target, root) => writeStarter(template, name, target, root));
  assert.match(await fs.readFile(path.join(project, 'CMakeLists.txt'), 'utf8'), /project\(_9_Test_Game/);
  assert.match(await fs.readFile(path.join(project, 'src', 'main.c'), 'utf8'), /"9 Test-Game"/);
  assert.equal(await fs.readFile(path.join(project, '.gitignore'), 'utf8'), 'build/\n');
  await assert.rejects(createProject(parent, name, () => assert.fail('Ran generator twice')), /already exists/);
  assert.throws(() => validateProjectName('../outside'), /project name/);
  assert.throws(() => validateProjectName('COM1.cs'), /project name/);
});

test('scaffolds ZIP templates with wrapper folders, tokens and binary assets', async t => {
  const parent = await fixture(t);
  const binary = Buffer.alloc(1024 ** 2 + 16, 0xfe);
  const zip = await writeZip(parent, [
    ['wrapper/src/__PROJECT_NAME__.txt', '\uFEFF__PROJECT_IDENTIFIER__\r\n'],
    ['wrapper/logo.bin', binary],
    ['__MACOSX/metadata', 'ignore']
  ]);
  const catalog = await listZipTemplates(parent);
  assert.deepEqual(catalog.templates.map(item => item.label), ['Starter']);
  assert.equal(catalog.templates[0].archive, zip);
  const project = await createProject(parent, '9 Game', target => extractZipTemplate(zip, target, '9 Game'));
  assert.equal(await fs.readFile(path.join(project, 'src', '9 Game.txt'), 'utf8'), '\uFEFF_9_Game\r\n');
  assert.deepEqual(await fs.readFile(path.join(project, 'logo.bin')), binary);
  assert.deepEqual((await fs.readdir(project)).sort(), ['logo.bin', 'src']);
});

test('rejects traversal, links, duplicate names and corrupt data without leaving project files', async t => {
  const cases = [
    { entries: [['xx/escape.txt', 'test']], original: 'xx/escape.txt', replacement: '../escape.txt', error: /relative path|invalid path/i },
    { entries: [['link', '..', { mode: 0o120777 }]], error: /link or special file/ },
    { entries: [['Name.txt', '1'], ['name.txt', '2']], error: /conflicting paths/i },
    { entries: [['contents', 'right-data', { compress: false }]], original: 'right-data', replacement: 'wrong-data', error: /corrupt zip entry/i }
  ];
  for (const { entries, original, replacement, error } of cases) {
    const parent = await fixture(t);
    const archive = await writeZip(parent, entries);
    if (original) {
      const data = await fs.readFile(archive);
      for (let offset = data.indexOf(original); offset !== -1; offset = data.indexOf(original, offset + original.length)) {
        data.write(replacement, offset, original.length, 'utf8');
      }
      await fs.writeFile(archive, data);
    }
    await assert.rejects(createProject(parent, 'BadZip', target => extractZipTemplate(archive, target, 'BadZip')), error);
    assert.deepEqual(await fs.readdir(parent), ['Starter.ZIP']);
  }
});

test('two simultaneous requests cannot replace the same project folder', async t => {
  const parent = await fixture(t);
  const attempt = content => createProject(parent, 'SameName', target => fs.writeFile(path.join(target, 'file'), content));
  const attempts = await Promise.allSettled([attempt('first'), attempt('second')]);
  assert.deepEqual(attempts.map(result => result.status).sort(), ['fulfilled', 'rejected']);
  const winner = attempts[0].status === 'fulfilled' ? 'first' : 'second';
  assert.equal(await fs.readFile(path.join(parent, 'SameName', 'file'), 'utf8'), winner);
  assert.deepEqual(await fs.readdir(parent), ['SameName']);
});

test('defaults to Git init outside a repository and allows explicit overrides', async t => {
  if (!await exec('git', ['--version']).catch(() => undefined)) {
    t.skip('Git is unavailable');
    return;
  }
  const root = await fixture(t);
  const git = 'git';
  const create = (parent, name, choice) => createProject(parent, name, (staged, actualParent) =>
    initializeProjectGit(staged, actualParent, git, choice, message => t.diagnostic(message)));
  assert.deepEqual(await gitProjectStatus(root, git), { available: true, validLocation: true, insideRepository: false });
  const outside = await create(root, 'Standalone');
  assert.equal((await fs.stat(path.join(outside, '.git'))).isDirectory(), true);
  const topLevel = (await exec(git, ['rev-parse', '--show-toplevel'], { cwd: outside })).stdout.trim();
  assert.equal(await fs.realpath(topLevel), outside);

  const noGit = await create(root, 'Opt out', false);
  await assert.rejects(fs.stat(path.join(noGit, '.git')), { code: 'ENOENT' });
  const subfolder = path.join(outside, 'projects');
  await fs.mkdir(subfolder);
  assert.equal((await gitProjectStatus(subfolder, git)).insideRepository, true);
  const nested = await create(subfolder, 'Default inside');
  await assert.rejects(fs.stat(path.join(nested, '.git')), { code: 'ENOENT' });
  const optedIn = await create(subfolder, 'Explicit nested', true);
  assert.equal((await fs.stat(path.join(optedIn, '.git'))).isDirectory(), true);

  const worktree = path.join(root, 'Linked worktree');
  await exec(git, ['init', '--quiet', '--separate-git-dir', path.join(root, 'Git metadata'), worktree]);
  assert.equal((await fs.stat(path.join(worktree, '.git'))).isFile(), true);
  assert.equal((await gitProjectStatus(worktree, git)).insideRepository, true);
  assert.equal((await gitProjectStatus(worktree)).insideRepository, true);
});

test('generates the bundled source templates with portable names and run instructions', async t => {
  const root = await fixture(t);
  const templates = starters.filter(template => template.commands);
  const name = '9 Example Project';
  assert.ok(templates.length >= 20);
  for (const template of templates) {
    const parent = path.join(root, template.id);
    await fs.mkdir(parent);
    const project = await createProject(parent, name, (target, directory) => writeStarter(template, name, target, directory));
    for (const file of template.files) {
      const output = file === 'gitignore' ? '.gitignore' :
        template.language === 'C++' && template.sourceDirectory && file === 'src/main.c' ? 'src/main.cpp' : file;
      const moduleName = 'Game9ExampleProject';
      const generated = path.join(project, replaceTokens(output, name).replaceAll('__UNREAL_MODULE__', moduleName));
      assert.doesNotMatch(await fs.readFile(generated, 'utf8'), /__PROJECT_[A-Z]+__/);
    }
    const readme = await fs.readFile(path.join(project, 'README.md'), 'utf8');
    assert.match(readme, /^# 9 Example Project/);
    if (template.commands.length) assert.ok(readme.includes(template.commands[0]));
  }
});

test('scaffolds mixed SDL backends and both plugin contracts with Lua', async t => {
  const root = await fixture(t);
  const backends = { vulkan: 'vulkan', opengl: 'opengl', directx: 'direct3d11' };
  for (const [id, driver] of Object.entries(backends)) {
    const template = starters.find(item => item.id === `sdl3-${id}-csharp-cpp-lua`);
    const name = `Mixed ${id}`;
    const project = await createProject(root, name, async (target, parent) => {
      await writeStarter({ ...template, needsSdk: false }, name, target, parent);
      await applyProjectOptions(target, template, name, readProjectOptions(template, { dependencies: 'libuv' }));
    });
    const cmake = await fs.readFile(path.join(project, 'native/CMakeLists.txt'), 'utf8');
    assert.ok(cmake.includes(`PW_SDL_BACKEND="${driver}"`));
    assert.match(cmake, /SDL3::SDL3-static lua_runtime/);
    assert.match(await fs.readFile(path.join(project, 'native/cmake/ProjectOptions.cmake'), 'utf8'), /pw_native PRIVATE uv_a/);
    assert.match(await fs.readFile(path.join(project, 'scripts/behavior.lua'), 'utf8'), /function update\(/);
    assert.equal(templatesForPlatform([template], 'darwin').length, id === 'directx' ? 0 : 1);
  }
  for (const [id, contract] of [['cpp-plugin-host', 'include/plugin_api.h'], ['csharp-plugin-host', 'contracts/IPlugin.cs']]) {
    const template = starters.find(item => item.id === id);
    const project = await createProject(root, id, (target, parent) => writeStarter({ ...template, needsSdk: false }, id, target, parent));
    assert.match(await fs.readFile(path.join(project, contract), 'utf8'), /plugin_greet|interface IPlugin/);
    assert.match(await fs.readFile(path.join(project, 'plugins/greeting.lua'), 'utf8'), /return "Hello/);
  }
  const nativeHost = starters.find(item => item.id === 'cpp-native-plugin-host');
  const project = await createProject(root, nativeHost.id, (target, parent) => writeStarter(nativeHost, nativeHost.id, target, parent));
  assert.deepEqual(nativeHost.tools, ['cmake', 'cpp-compiler']);
  assert.match(await fs.readFile(path.join(project, 'CMakeLists.txt'), 'utf8'), /LANGUAGES CXX\)/);
  assert.match(await fs.readFile(path.join(project, 'cmake/PluginHost.cmake'), 'utf8'), /add_library\(sample_plugin MODULE/);
  assert.match(await fs.readFile(path.join(project, 'src/native_plugin.cpp'), 'utf8'), /version\(\) != PLUGIN_API_VERSION/);
  await assert.rejects(fs.access(path.join(project, 'cmake/Lua.cmake')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(project, 'plugins/greeting.lua')), { code: 'ENOENT' });
});

test('recognizes web, desktop, and game project files', () => {
  assert.deepEqual(detectFrameworks('package.json', '{"dependencies":{"nuxt":"^4","next":"^16"},"devDependencies":{"electron":"^45"}}'),
    ['Next.js', 'Nuxt', 'Electron']);
  assert.deepEqual(detectFrameworks('package.json', '{invalid'), []);
  assert.deepEqual(detectFrameworks('tauri.conf.json', '{"productName":"Example"}'), ['Tauri']);
  assert.deepEqual(detectFrameworks('CMakeLists.txt', 'pkg_check_modules(GTKMM REQUIRED IMPORTED_TARGET gtkmm-4.0)'), ['GTKmm 4']);
  assert.deepEqual(detectFrameworks('project.godot', 'config_version=5'), ['Godot']);
  assert.deepEqual(detectFrameworks('ProjectVersion.txt', 'm_EditorVersion: 6000.3.0f1'), ['Unity']);
  assert.deepEqual(detectFrameworks('Game.uproject', '{"FileVersion":3}'), ['Unreal Engine']);
});

test('uses installed game editor versions and connects generated engine assets', async t => {
  const root = await fixture(t);
  const tools = { 'unity-editor': { editorVersion: '6000.6.8f1' }, 'unreal-editor': { association: '5.8' } };
  for (const id of ['unity', 'unreal', 'godot']) {
    const template = starters.find(item => item.id === id);
    const name = id + ' 9';
    const project = await createProject(root, name, (target, parent) => writeStarter(template, name, target, parent, undefined, tools));
    const read = file => fs.readFile(path.join(project, file), 'utf8');
    if (id === 'unity') {
      assert.match(await read('ProjectSettings/ProjectVersion.txt'), /6000\.6\.8f1/);
      const guid = (await read('Assets/Game/Scripts/DemoScene.cs.meta')).match(/guid: (\w+)/)[1];
      assert.ok((await read('Assets/Game/Scenes/Demo.unity')).includes(guid));
    } else if (id === 'unreal') {
      const descriptor = JSON.parse(await read('Gameunreal9.uproject'));
      assert.equal(descriptor.EngineAssociation, '5.8');
      assert.equal(descriptor.Modules[0].Name, 'Gameunreal9');
      assert.match(await read('Source/Gameunreal9/Public/SpinningActor.h'), /GAMEUNREAL9_API/);
    } else {
      assert.match(await read('project.godot'), /res:\/\/game\/main\.tscn/);
      assert.match(await read('game/main.tscn'), /res:\/\/game\/player\/player\.tscn/);
      assert.match(await read('game/player/player.tscn'), /res:\/\/game\/player\/player\.gd/);
    }
  }
});

test('keeps LaTeX opt-in and iOS native templates macOS-only', () => {
  const latex = starters.find(template => template.id === 'latex-article');
  const ios = starters.find(template => template.id === 'ios-swiftui');
  assert.deepEqual(enabledTemplates([latex], readCatalogSettings()), []);
  assert.deepEqual(enabledTemplates([latex], readCatalogSettings({ enableLatexTemplates: true })), [latex]);
  assert.deepEqual(enabledTemplates([latex], readCatalogSettings({
    enableLatexTemplates: true, disabledLanguages: ['LaTeX']
  })), []);
  assert.deepEqual(templatesForPlatform([ios], 'win32'), []);
  assert.deepEqual(templatesForPlatform([ios], 'linux'), []);
  assert.deepEqual(templatesForPlatform([ios], 'darwin'), [ios]);
});

test('installs built-in Python dependencies in the selected environment and uses Blender Python', async t => {
  const root = await fixture(t);
  const classifier = starters.find(template => template.id === 'ml-classifier');
  const blender = starters.find(template => template.id === 'blender-extension');
  assert.equal(projectOptions(blender), undefined);
  assert.equal(templateAvailability(classifier, { uv: {} }, 'win32').ready, true);
  assert.throws(() => readProjectOptions(classifier, { pythonVersion: '3.10' }), /Python 3.11/);
  const choices = projectOptions(classifier, {}, [
    { version: '3.10.9', usable: true }, { version: '3.13.5', usable: true }
  ]);
  assert.deepEqual(choices.environments.find(item => item.id === 'venv').versions, ['3.13.5']);
  for (const [environment, file] of [['venv', 'requirements.txt'], ['conda', 'environment.yml'], ['uv', 'pyproject.toml']]) {
    const options = readProjectOptions(classifier, { environment, dependencies: 'joblib' });
    const project = await createProject(root, environment, async (target, parent) => {
      await writeStarter(classifier, environment, target, parent);
      await applyProjectOptions(target, classifier, environment, options);
    });
    assert.match(await fs.readFile(path.join(project, file), 'utf8'), /scikit-learn>=1\.7,<2/);
    assert.match(await fs.readFile(path.join(project, file), 'utf8'), /joblib/);
  }
});

test('configures Godot C++ as a shared library with native tests', async t => {
  const root = await fixture(t);
  const template = starters.find(item => item.id === 'godot-native-cpp');
  assert.ok(projectOptions(template).executableIconFormats.includes('.png'));
  const project = await createProject(root, 'Native Demo', async (target, parent) => {
    await writeStarter(template, 'Native Demo', target, parent);
    await applyProjectOptions(target, template, 'Native Demo', readProjectOptions(template, { testing: true }));
  });
  const cmake = await fs.readFile(path.join(project, 'CMakeLists.txt'), 'utf8');
  assert.match(cmake, /add_library\(pw_native SHARED/);
  assert.match(cmake, /starter_logic PROPERTIES POSITION_INDEPENDENT_CODE ON/);
  assert.doesNotMatch(cmake, /MACOSX_BUNDLE/);
  assert.match(await fs.readFile(path.join(project, 'native.gdextension'), 'utf8'), /entry_symbol = "pw_native_init"/);
});

test('maps tool requirements to install help and distinguishes OS support from missing tools', () => {
  const templates = new Map(starters.map(template => [template.id, template]));
  const java = { version: '25', file: '/jdk/bin/javac' };
  assert.equal(templateAvailability(templates.get('java-server'), { java }, 'win32').ready, true);
  const kotlin = templateAvailability(templates.get('kotlin-desktop'), { java }, 'win32');
  assert.equal(kotlin.supported, true);
  assert.equal(kotlin.ready, false);
  assert.deepEqual(kotlin.missing.map(tool => tool.id), ['kotlin']);
  const apple = templateAvailability(templates.get('objc-desktop'), { 'apple-sdk': {} }, 'win32');
  assert.equal(apple.supported, false);
  assert.equal(apple.ready, false);
  assert.equal(templateAvailability(templates.get('javascript-frontend'), {}, 'linux').ready, true);
  assert.equal(templateAvailability(templates.get('go-cli'), { go: { version: '1.19', usable: false } }, 'linux').ready, false);
  assert.match(getSetup('zig', 'win32', 'windows').command, /winget install/);
  assert.equal(getSetup('zig', 'win32').command, undefined);
  assert.equal(getSetup('constructor', 'win32'), undefined);
  assert.match(getSetup('swift', 'win32').url, /windows/);
  assert.equal(supportsVite('20.18.0'), false);
  assert.equal(supportsVite('20.19.0'), true);
  assert.equal(supportsVite('21.9.0'), false);
  assert.equal(supportsVite('22.11.0'), false);
  assert.equal(supportsVite('22.12.0'), true);
  assert.equal(supportsVite('24.0.0'), true);
});

test('excludes macOS-only starters on other hosts and recognizes Python managers', () => {
  for (const platform of ['win32', 'linux']) {
    const visible = templatesForPlatform(starters, platform);
    assert.ok(visible.some(template => template.id === 'swift-cli'));
    assert.ok(visible.some(template => template.id === 'expo-mobile'));
    assert.ok(visible.every(template => !['swift-desktop', 'objc-desktop'].includes(template.id)));
  }
  assert.ok(templatesForPlatform(starters, 'darwin').some(template => template.id === 'objc-desktop'));
  const python = starters.find(template => template.id === 'python-cli');
  const tools = { uv: { file: 'uv' } };
  assert.equal(templateAvailability(python, tools, 'linux').ready, true);
  assert.equal(projectOptions(python, tools).defaultEnvironment, 'uv');
});

test('writes CMake dependency declarations and opt-in C or GoogleTest examples', async t => {
  const root = await fixture(t);
  for (const [id, name, library, testFile] of [
    ['c-cmake', 'CTestApp', 'yyjson', 'example_test.c'],
    ['cpp-cmake', 'GoogleTestApp', 'fmt', 'example_test.cpp']
  ]) {
    const template = starters.find(item => item.id === id);
    const options = readProjectOptions(template, {
      libraries: [library], testing: true,
      dependencies: 'custom custom::custom https://example.com/custom.tar.gz ' + 'a'.repeat(64)
    });
    const project = await createProject(root, name, async (target, parent) => {
      await writeStarter(template, name, target, parent);
      await applyProjectOptions(target, template, name, options);
    });
    assert.match(await fs.readFile(path.join(project, 'CMakeLists.txt'), 'utf8'), /include\(cmake\/ProjectOptions\.cmake\)/);
    const cmake = await fs.readFile(path.join(project, 'cmake', 'ProjectOptions.cmake'), 'utf8');
    assert.ok(cmake.includes('FetchContent_MakeAvailable(' + library + ')'));
    assert.match(cmake, /URL_HASH SHA256=a{64}/);
    assert.match(cmake, /target_link_libraries\(app PRIVATE custom::custom\)/);
    assert.match(cmake, id === 'c-cmake' ? /add_test\(NAME example_test/ : /gtest_discover_tests\(example_test/);
    const suffix = path.extname(testFile);
    const testSource = await fs.readFile(path.join(project, 'tests', testFile), 'utf8');
    assert.match(testSource, /#include "starter\.h"/);
    assert.match(testSource, /starter_add\(2, 3\)/);
    assert.doesNotMatch(testSource, /int starter_add\(/);
    assert.match(cmake, /target_link_libraries\(example_test PRIVATE starter_logic/);
    assert.match(await fs.readFile(path.join(project, 'src', 'starter' + suffix), 'utf8'), /int starter_add\(/);
    assert.match(await fs.readFile(path.join(project, 'src', 'main' + suffix), 'utf8'), /starter_add\(2, 3\)/);
    assert.throws(() => readProjectOptions(template, { dependencies: 'bad dep https://example.com/a";foo' }), /CMake dependency/);
  }
});

test('uses the CMake picker entries as editable dependencies and packages a Vulkan desktop app', async t => {
  const root = await fixture(t);
  const cpp = starters.find(template => template.id === 'sdl3-vulkan-cpp');
  const c = starters.find(template => template.id === 'sdl3-vulkan-c');
  const raylib = starters.find(template => template.id === 'raylib-cpp');
  const choices = projectOptions(cpp).libraries;
  const ids = choices.map(choice => choice.id);
  const lines = ids.map(id => choices.find(choice => choice.id === id).line);
  assert.deepEqual(projectOptions(c).libraries.map(choice => choice.id), ['yyjson', 'stb', 'libuv', 'tinyfiledialogs']);
  assert.throws(() => readProjectOptions(raylib, { dependencies: 'bgfx', targets: ['emscripten'] }), /desktop target/);
  assert.throws(() => readProjectOptions(cpp, { dependencies: 'tinyfiledialogs\ntinyfiledialogs' }), /Duplicate/);
  const options = readProjectOptions(cpp, { dependencies: lines.join('\n') });
  assert.deepEqual(options.packages.map(library => library.id), ids);

  const project = await createProject(root, 'Vulkan Distribution', async (target, parent) => {
    await writeStarter(cpp, 'Vulkan Distribution', target, parent);
    await applyProjectOptions(target, cpp, 'Vulkan Distribution', options);
  });
  const cmake = await fs.readFile(path.join(project, 'cmake/ProjectOptions.cmake'), 'utf8');
  assert.match(cmake, /add_library\(tinyfiledialogs STATIC/);
  assert.match(cmake, /add_library\(imgui STATIC/);
  assert.match(cmake, /FetchContent_MakeAvailable\(bgfx_cmake\)/);
  assert.match(cmake, /target_link_libraries\(app PRIVATE uv_a\)/);
  for (const id of ids) {
    assert.ok(cmake.includes(`add_executable(example_${id} examples/${id}.cpp)`));
    assert.match(await fs.readFile(path.join(project, `examples/${id}.cpp`), 'utf8'), /\bint main\(/);
  }
  assert.match(cmake, /if\(NOT EMSCRIPTEN\)[\s\S]*add_executable\(example_asio/);
  const distribution = await fs.readFile(path.join(project, 'cmake/Distribution.cmake'), 'utf8');
  assert.match(distribution, /set\(distribution_vulkan ON\)/);
  assert.match(distribution, /add_custom_target\(distribution/);
  assert.match(await fs.readFile(path.join(project, 'README.md'), 'utf8'), /build\/dist\/Release\//);
});

test('adds NuGet and native networking packages to their respective mixed Raylib build files', async t => {
  const root = await fixture(t);
  const template = starters.find(item => item.id === 'cpp-csharp-raylib');
  const cpp = starters.find(item => item.id === 'cpp-cmake');
  const csharp = starters.find(item => item.id === 'dotnet-console');
  const libraries = projectOptions(template).libraries;
  const asio = libraries.find(item => item.id === 'asio');
  const udp = libraries.find(item => item.id === 'litenetlib');
  const tcp = libraries.find(item => item.id === 'supersimpletcp');
  assert.equal(projectOptions(csharp).libraryLabel, 'Common NuGet packages');
  assert.throws(() => readProjectOptions(csharp, { dependencies: 'LiteNetLib 2.1.5\nlitenetlib 2.1.5' }), /Duplicate NuGet package/);
  assert.throws(() => readProjectOptions(csharp, { dependencies: 'LiteNetLib 2.1.5<xml' }), /package ID and version/);
  assert.throws(() => readProjectOptions(cpp, { dependencies: asio.line, targets: ['emscripten'] }), /desktop target/);

  const options = readProjectOptions(template, { dependencies: `${asio.line}\n${udp.line}\n${tcp.line}\nraylib-cs 8.1.0` });
  const name = 'Managed Native';
  const project = await createProject(root, name, async (target, parent) => {
    await writeStarter({ ...template, needsSdk: false }, name, target, parent);
    await applyProjectOptions(target, template, name, options);
  });
  const csproj = await fs.readFile(path.join(project, name + '.csproj'), 'utf8');
  assert.match(csproj, /PackageReference Include="LiteNetLib" Version="2\.1\.5"/);
  assert.match(csproj, /PackageReference Include="SuperSimpleTcp" Version="3\.2\.3"/);
  assert.equal([...csproj.matchAll(/PackageReference Include="Raylib-cs"/gi)].length, 1);
  assert.match(csproj, /CopyToPublishDirectory="PreserveNewest"/);
  const cmake = await fs.readFile(path.join(project, 'native/cmake/ProjectOptions.cmake'), 'utf8');
  assert.match(cmake, /target_link_libraries\(pw_native PRIVATE asio\)/);
  assert.match(cmake, /target_link_libraries\(asio INTERFACE ws2_32 mswsock\)/);
  assert.match(await fs.readFile(path.join(project, 'Program.cs'), 'utf8'), /position = NativeMotion\.Advance\(position, step,/);
  assert.match(await fs.readFile(path.join(project, 'scripts/package-macos.sh'), 'utf8'), /--self-contained .* -o "\$app\/Contents\/MacOS"/);
});

test('configures the Emscripten target for both Raylib and basic CMake languages', async t => {
  const root = await fixture(t);
  for (const id of ['c-cmake', 'cpp-cmake', 'raylib-c', 'raylib-cpp']) {
    const template = starters.find(item => item.id === id);
    const config = projectOptions(template, { cmake: {}, emscripten: {}, 'emscripten-generator': {} }).targetChoice;
    assert.deepEqual(config.options.map(option => option.id), ['native', 'emscripten']);
    assert.equal(config.defaultId, 'emscripten');
    assert.deepEqual(readProjectOptions(template).targets, ['native']);
    assert.throws(() => readProjectOptions(template, { targets: [] }), /at least one supported target/);
    const desktop = id === 'raylib-cpp';
    const targets = desktop ? ['native', 'emscripten'] : ['emscripten'];
    const options = readProjectOptions(template, { targets, testing: true });
    assert.deepEqual(options.targets, targets);
    const project = await createProject(root, id, async (target, parent) => {
      await writeStarter(template, id, target, parent);
      await applyProjectOptions(target, template, id, options);
    });
    const cmake = await fs.readFile(path.join(project, 'CMakeLists.txt'), 'utf8');
    if (desktop) {
      assert.doesNotMatch(cmake, /if\(NOT EMSCRIPTEN\)/);
      assert.match(cmake, /if\(CMAKE_SYSTEM_NAME STREQUAL "Darwin"\)[\s\S]+MACOSX_BUNDLE TRUE/);
    } else {
      assert.match(cmake, /if\(NOT EMSCRIPTEN\)/);
      assert.doesNotMatch(cmake, /MACOSX_BUNDLE/);
    }
    assert.match(cmake, /if\(EMSCRIPTEN\)/);
    assert.match(cmake, /OUTPUT_NAME index SUFFIX "\.html"/);
    const readme = await fs.readFile(path.join(project, 'README.md'), 'utf8');
    assert.match(readme, /emcmake cmake -S \. -B build-web/);
    assert.match(readme, /emrun build-web\/index\.html/);
    assert.match(readme, /ctest --test-dir build-web/);
    assert.match(await fs.readFile(path.join(project, '.gitignore'), 'utf8'), /build-web\//);
    if (desktop) assert.match(readme, /^ctest --test-dir build -C Debug/m);
  }
  assert.equal(projectOptions(starters.find(item => item.id === 'cuda-cmake')).targetChoice, undefined);
});

test('scaffolds executable icons and a macOS bundle alongside a Raylib web target', async t => {
  const root = await fixture(t);
  const template = starters.find(item => item.id === 'raylib-cpp');
  const cuda = starters.find(item => item.id === 'cuda-cmake');
  const android = starters.find(item => item.id === 'raylib-vr-android-c');
  assert.deepEqual(projectOptions(template).executableIconFormats, ['.png', '.webp', '.ico', '.icns']);
  assert.deepEqual(projectOptions(cuda).executableIconFormats, ['.png', '.webp', '.ico']);
  assert.deepEqual(projectOptions(android).executableIconFormats, ['.png', '.webp']);
  assert.throws(() => readProjectOptions(template, { executableIcon: true }), /Choose an executable icon file/);
  assert.throws(() => readProjectOptions(template, { executableIcon: true, targets: ['emscripten'] }), /native executable target/);

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=', 'base64');
  const icoHeader = Buffer.from([0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 22, 0, 0, 0]);
  icoHeader.writeUInt32LE(png.length, 14);
  const icnsHeader = Buffer.from('icns\x00\x00\x00\x00icp4\x00\x00\x00\x00', 'ascii');
  icnsHeader.writeUInt32BE(icnsHeader.length + png.length, 4);
  icnsHeader.writeUInt32BE(8 + png.length, 12);
  const ico = Buffer.concat([icoHeader, png]);
  const icns = Buffer.concat([icnsHeader, png]);
  const winFile = path.join(root, 'Windows Icon.ICO');
  const macFile = path.join(root, 'macOS Icon.icns');
  const invalidFile = path.join(root, 'Invalid.ico');
  await fs.writeFile(winFile, ico);
  await fs.writeFile(macFile, icns);
  await fs.writeFile(invalidFile, 'invalid');
  await assert.rejects(loadExecutableIcons([invalidFile]), /valid .ico file/);
  await assert.rejects(loadExecutableIcons([winFile, invalidFile]), /up to one/);
  const icons = await loadExecutableIcons([winFile, macFile]);
  const options = readProjectOptions(template, { executableIcon: true, targets: ['native', 'emscripten'] }, icons);
  const name = 'Raylib Game';
  const project = await createProject(root, name, async (target, parent) => {
    await writeStarter(template, name, target, parent);
    await applyProjectOptions(target, template, name, options);
  });
  assert.deepEqual(await fs.readFile(path.join(project, 'assets/app.ico')), ico);
  assert.deepEqual(await fs.readFile(path.join(project, 'assets/app.icns')), icns);
  assert.match(await fs.readFile(path.join(project, 'assets/app-icon.rc.in'), 'utf8'), /1 ICON "@CMAKE_CURRENT_SOURCE_DIR@\/assets\/app.ico"/);
  const cmake = await fs.readFile(path.join(project, 'CMakeLists.txt'), 'utf8');
  assert.match(cmake, /if\(WIN32 AND NOT EMSCRIPTEN\)\s+enable_language\(RC\)/);
  assert.match(cmake, /MACOSX_BUNDLE_BUNDLE_NAME "Raylib Game"/);
  assert.match(cmake, /MACOSX_BUNDLE_GUI_IDENTIFIER "com.example.raylib-game"/);
  assert.match(cmake, /MACOSX_PACKAGE_LOCATION Resources/);
  assert.match(cmake, /MACOSX_BUNDLE_ICON_FILE "app.icns"/);
  assert.match(cmake, /OUTPUT_NAME index SUFFIX "\.html"/);
});

test('converts raster icons for desktop and mobile project scaffolds', async t => {
  const root = await fixture(t);
  const sharp = require('sharp');
  for (const template of starters.filter(template => ['desktop', 'mobile'].includes(template.group))) {
    assert.ok(projectOptions(template).executableIconFormats.includes('.webp'), template.id);
  }
  for (const format of ['png', 'webp']) {
    const file = path.join(root, 'Example.' + format);
    await sharp({ create: { width: 48, height: 32, channels: 4, background: '#1388aaff' } }).toFormat(format).toFile(file);
    const icons = await loadExecutableIcons([file]);
    for (const id of ['c-cmake', 'electron', 'android-compose', 'ios-swiftui', 'expo-mobile']) {
      const template = starters.find(item => item.id === id);
      const name = id + '-' + format;
      const options = readProjectOptions(template, { executableIcon: true }, icons);
      const project = await createProject(root, name, async (target, parent) => {
        await writeStarter(template, name, target, parent);
        await applyProjectOptions(target, template, name, options);
      });
      if (id === 'android-compose') {
        assert.match(await fs.readFile(path.join(project, 'src/main/AndroidManifest.xml'), 'utf8'), /@mipmap\/pw_app_icon/);
        const { width } = await sharp(path.join(project, 'src/main/res/mipmap-xxxhdpi/pw_app_icon.png')).metadata();
        assert.equal(width, 192);
      } else if (id === 'ios-swiftui') {
        const file = path.join(project, 'Sources/Assets.xcassets/AppIcon.appiconset/Icon-1024.png');
        const { width, height, hasAlpha } = await sharp(file).metadata();
        assert.deepEqual([width, height, hasAlpha], [1024, 1024, false]);
        assert.match(await fs.readFile(path.join(project, 'project.yml'), 'utf8'), /ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon/);
      } else if (id === 'expo-mobile') {
        const { expo } = JSON.parse(await fs.readFile(path.join(project, 'app.json'), 'utf8'));
        assert.equal(expo.icon, './assets/app-icon.png');
        assert.equal(expo.android.adaptiveIcon.foregroundImage, './assets/adaptive-icon.png');
      } else {
        const native = await loadExecutableIcons(['.ico', '.icns'].map(extension => path.join(project, 'assets', 'app' + extension)));
        assert.equal(native.get('.ico').data.readUInt16LE(4), 7);
        const png = path.join(project, 'assets/app.png');
        assert.equal((await sharp(png).metadata()).width, 256);
        if (id === 'electron') assert.match(await fs.readFile(path.join(project, 'forge.config.cjs'), 'utf8'), /packagerConfig:.*icon/);
      }
    }
  }
});

test('installs desktop icon assets for GUI and game starters', async t => {
  const root = await fixture(t);
  const image = path.join(root, 'icon.webp');
  await require('sharp')({ create: { width: 32, height: 32, channels: 4, background: '#1289aaff' } }).webp().toFile(image);
  const icons = await loadExecutableIcons([image]);
  const templates = [...starters.filter(template => ['lua-love', 'unity', 'unreal', 'sfml-imgui-cpp', 'sdl2-cpp', 'cpp-lua-desktop'].includes(template.id)),
    parseMonoGameTemplates('MonoGame DesktopGL  mgdesktopgl  [C#]  MonoGame')[0]];
  for (const template of templates) {
    const options = readProjectOptions(template, { executableIcon: true, ...(template.sfml ? { build: 'sfml2' } : {}) }, icons);
    const name = template.shortName || template.id;
    const project = await createProject(root, name, async (target, parent) => {
      if (template.group === 'monogame') {
        await fs.writeFile(path.join(target, 'Game.csproj'), '<Project><PropertyGroup><OutputType>WinExe</OutputType></PropertyGroup></Project>');
      } else {
        await writeStarter(template, name, target, parent, undefined, {}, options);
      }
      await applyProjectOptions(target, template, name, options, parent);
    });
    if (template.cmakeTarget) {
      const code = await fs.readFile(path.join(project, 'src/main.cpp'), 'utf8');
      assert.match(code, /#include "app_icon.h"/);
      if (template.sfml) assert.match(code, /window\.setIcon\(48, 48, app_icon_pixels\)/);
      continue;
    }
    assert.ok(await fs.stat(path.join(project, 'scripts/install-linux-icon.sh')));
    if (template.group === 'monogame') {
      assert.match(await fs.readFile(path.join(project, 'Game.csproj'), 'utf8'), /ApplicationIcon>Icon.ico/);
      assert.equal((await fs.readFile(path.join(project, 'Icon.bmp'))).toString('ascii', 0, 2), 'BM');
      assert.match(await fs.readFile(path.join(project, 'scripts/package-macos.sh'), 'utf8'), /CFBundleIconFile/);
    } else if (template.id === 'unity') {
      assert.match(await fs.readFile(path.join(project, 'Assets/Editor/ProjectWizardAppIcon.cs'), 'utf8'), /PlayerSettings\.SetIcons/);
    } else if (template.id === 'unreal') {
      assert.ok(await fs.stat(path.join(project, 'Build/Windows/Application.ico')));
      assert.ok(await fs.stat(path.join(project, 'Build/Mac/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json')));
    } else {
      assert.match(await fs.readFile(path.join(project, 'conf.lua'), 'utf8'), /config\.window\.icon = 'assets\/app.png'/);
    }
  }
});

test('creates Maven and Gradle Java applications with selected dependencies and JUnit', async t => {
  const root = await fixture(t);
  const template = starters.find(item => item.id === 'java-server');
  const config = projectOptions(template, { java: {}, 'java-17': {}, maven: {} }).buildChoice;
  assert.equal(config.defaultId, 'jdk');
  assert.deepEqual(config.options.map(option => [option.id, option.ready]), [['jdk', true], ['maven', true], ['gradle', false]]);
  assert.throws(() => readProjectOptions(template, { build: 'maven', dependencies: '<dependency/>' }), /group:artifact:version/);
  assert.throws(() => readProjectOptions(template, { build: 'jdk', dependencies: 'example:library:1.0.0' }), /Choose Maven or Gradle/);
  assert.throws(() => readProjectOptions(template, { build: 'other' }), /supported build option/);
  for (const [build, file, dependency, run] of [
    ['maven', 'pom.xml', /<artifactId>commons-lang3<\/artifactId>/, /mvn compile exec:java/],
    ['gradle', 'build.gradle', /implementation 'org\.apache\.commons:commons-lang3:3\.20\.0'/, /gradle run/]
  ]) {
    const name = 'Java ' + build;
    const options = readProjectOptions(template, {
      build, dependencies: 'org.apache.commons:commons-lang3:3.20.0', testing: true, framework: 'junit'
    });
    const project = await createProject(root, name, async (target, parent) => {
      await writeStarter(template, name, target, parent);
      await applyProjectOptions(target, template, name, options);
    });
    assert.match(await fs.readFile(path.join(project, file), 'utf8'), dependency);
    assert.match(await fs.readFile(path.join(project, 'src/main/java/Main.java'), 'utf8'), /HttpServer/);
    assert.match(await fs.readFile(path.join(project, 'src/test/java/GreetingTest.java'), 'utf8'), /Main\.greeting\(\)/);
    assert.match(await fs.readFile(path.join(project, 'README.md'), 'utf8'), run);
    await assert.rejects(fs.stat(path.join(project, 'Main.java')), { code: 'ENOENT' });
  }
});

test('writes Python manager-specific configuration and resolves installed interpreter versions', async t => {
  const root = await fixture(t);
  const template = starters.find(item => item.id === 'python-desktop');
  const runtime = { file: 'python', version: '3.13.4', usable: true, tkinter: true, virtualenv: true };
  for (const [environment, configFile, configPattern, command] of [
    ['uv', 'pyproject.toml', /\[dependency-groups\]/, 'uv run python -m pytest'],
    ['conda', 'environment.yml', /python=3\.13\n  - tk/, 'conda run --prefix ./.venv python -m pytest'],
    ['venv', 'requirements.txt', /requests>=2,<3/, 'python3.13 -m venv .venv'],
    ['virtualenv', 'requirements.txt', /pytest/, 'python3.13 -m virtualenv .venv']
  ]) {
    const options = readProjectOptions(template, {
      environment, pythonVersion: '3.13', dependencies: 'requests>=2,<3', testing: true, createEnvironment: true
    });
    const project = await createProject(root, environment, async (target, parent) => {
      await writeStarter(template, environment, target, parent);
      await applyProjectOptions(target, template, environment, options);
    });
    assert.match(await fs.readFile(path.join(project, configFile), 'utf8'), configPattern);
    assert.ok((await fs.readFile(path.join(project, 'README.md'), 'utf8')).includes(command));
    assert.ok(await fs.stat(path.join(project, 'tests', 'test_example.py')));
    const settings = JSON.parse(await fs.readFile(path.join(project, '.vscode', 'settings.json'), 'utf8'));
    assert.equal(settings['python.defaultInterpreterPath'], '${workspaceFolder}/.venv');
    assert.ok(selectPython(options, { uv: { file: 'uv' }, conda: { file: 'conda' } }, [runtime], template));
  }
  assert.throws(() => readProjectOptions(template, { dependencies: '-r untrusted.txt' }), /Python package/);
  assert.throws(() => readProjectOptions(template, { pythonVersion: '2.7' }), /Python version/);
  const missing = readProjectOptions(template, { environment: 'venv', pythonVersion: '3.12' });
  assert.equal(selectPython(missing, {}, [runtime], template), undefined);
});

test('preserves mobile dependencies and adds selected npm packages and tests', async t => {
  const root = await fixture(t);
  const template = starters.find(item => item.id === 'expo-mobile');
  const options = readProjectOptions(template, { dependencies: 'lodash@^4.17.21', testing: true });
  const project = await createProject(root, 'My Mobile App', async (target, parent) => {
    await writeStarter(template, 'My Mobile App', target, parent);
    await applyProjectOptions(target, template, 'My Mobile App', options);
  });
  const manifest = JSON.parse(await fs.readFile(path.join(project, 'package.json'), 'utf8'));
  assert.equal(manifest.name, 'my-mobile-app');
  assert.ok(manifest.dependencies.expo && manifest.dependencies['react-native']);
  assert.equal(manifest.dependencies.lodash, '^4.17.21');
  assert.equal(manifest.scripts.test, 'node --test');
  assert.ok(await fs.stat(path.join(project, 'tests', 'example.test.mjs')));
});

test('pairs every C starter with a C++ CMake build', async t => {
  const root = await fixture(t);
  const cTemplates = starters.filter(template => template.language === 'C' && template.cmakeTarget);
  assert.ok(cTemplates.length >= 5);
  for (const c of cTemplates) {
    const cppId = c.id === 'c-cmake' ? 'cpp-cmake' : c.id.replace(/-c$/, '-cpp');
    const cpp = starters.find(template => template.id === cppId);
    assert.equal(cpp?.language, 'C++');
    assert.equal(cpp?.group, c.group);
    for (const [template, language, suffix] of [[c, 'C', 'c'], [cpp, 'CXX', 'cpp']]) {
      const project = await createProject(root, template.id, (target, parent) =>
        writeStarter(template, template.id, target, parent));
      const cmake = await fs.readFile(path.join(project, 'CMakeLists.txt'), 'utf8');
      assert.ok(cmake.includes('LANGUAGES ' + language + ')'));
      assert.ok(cmake.includes('src/main.' + suffix));
      assert.ok(await fs.stat(path.join(project, 'src', 'main.' + suffix)));
    }
  }
});

test('offers assembly for matching architectures and kernel modules on Linux only', async t => {
  const root = await fixture(t);
  const systems = starters.filter(template => template.group === 'systems');
  const idsFor = (platform, architecture) => templatesForPlatform(systems, platform, architecture).map(template => template.id);
  assert.deepEqual(idsFor('win32', 'x64'), ['assembly-x64']);
  assert.deepEqual(idsFor('darwin', 'arm64'), ['assembly-arm64']);
  assert.deepEqual(idsFor('linux', 'arm64'), ['assembly-arm64', 'linux-kernel-hello', 'linux-kernel-chardev']);
  const tools = { cmake: {}, 'c-compiler': {}, nasm: {}, 'gnu-make': {} };
  for (const template of systems) {
    const project = await createProject(root, template.id, (target, parent) => writeStarter(template, template.id, target, parent));
    if (template.language === 'Assembly') {
      assert.match(await fs.readFile(path.join(project, 'tests/test_add.c'), 'utf8'), /assembly_add\(7, -3\)/);
      assert.match(await fs.readFile(path.join(project, 'cmake/AssemblyApp.cmake'), 'utf8'), /add_test\(NAME assembly_add/);
    } else {
      assert.deepEqual(templateAvailability(template, tools, 'linux').missing.map(tool => tool.id), ['linux-kernel-headers']);
      assert.equal(templateAvailability(template, { ...tools, 'linux-kernel-headers': {} }, 'linux').ready, true);
      assert.match(await fs.readFile(path.join(project, 'Makefile'), 'utf8'), /\t\$\(MAKE\) -C .* modules/);
      assert.match(await fs.readFile(path.join(project, 'Kbuild'), 'utf8'), /^obj-m := pw_\w+\.o/m);
    }
  }
});

test('offers OpenGL and Vulkan for both SDL versions and checks Vulkan setup', async t => {
  const root = await fixture(t);
  const tools = { cmake: {}, 'c-compiler': {}, 'cpp-compiler': {} };
  for (const major of [2, 3]) {
    for (const [api, label, target] of [['opengl', 'OpenGL', 'OpenGL::GL'], ['vulkan', 'Vulkan', 'Vulkan::Vulkan']]) {
      for (const [suffix, language] of [['c', 'C'], ['cpp', 'C++']]) {
        const id = `sdl${major}-${api}-${suffix}`;
        const template = starters.find(item => item.id === id);
        assert.equal(template.label, `SDL${major} + ${label} for ${language}`);
        const missing = templateAvailability(template, tools, 'win32').missing.map(tool => tool.id);
        assert.deepEqual(missing, api === 'vulkan' ? ['vulkan-dev'] : []);
        assert.ok(templateAvailability(template, { ...tools, 'vulkan-dev': {} }, 'win32').ready);

        const project = await createProject(root, id, (destination, parent) => writeStarter(template, id, destination, parent));
        const cmake = await fs.readFile(path.join(project, 'CMakeLists.txt'), 'utf8');
        assert.ok(cmake.includes(`SDL${major}::SDL${major}-static ${target}`));
        assert.ok(cmake.includes(`STARTER_SDL_MAJOR=${major}`));
        assert.doesNotMatch(cmake, /__SDL_[A-Z]+__/);
        assert.match(await fs.readFile(path.join(project, 'src', `main.${suffix}`), 'utf8'), /starter_add\(/);
      }
    }
  }
});

test('scaffolds both SFML desktop projects and keeps the ImGui backend on one version', async t => {
  const root = await fixture(t);
  for (const [id, imgui] of [['sfml-cpp', false], ['sfml-imgui-cpp', true]]) {
    const template = starters.find(item => item.id === id);
    const tools = { 'cmake-3.28': {}, 'cpp-compiler': {}, git: {} };
    const windows = projectOptions(template, tools, [], 'win32');
    const linux = projectOptions(template, tools, [], 'linux');
    assert.equal(windows.buildChoice.defaultId, 'sfml3');
    assert.ok(windows.buildChoice.options.every(choice => choice.ready));
    assert.deepEqual(linux.buildChoice.options.map(choice => choice.missing[0].id), ['sfml-desktop', 'sfml2-desktop']);
    assert.equal(projectOptions(template, tools).libraries.some(library => library.id === 'imgui'), !imgui);
    for (const [build, version, backend, poll] of [['sfml2', '2.6.2', 'v2.6', 'pollEvent(event)'], ['sfml3', '3.1.0', 'v3.0', 'pollEvent()']]) {
      const name = id + '-' + build;
      const options = readProjectOptions(template, { build });
      const project = await createProject(root, name, async (target, parent) => {
        await writeStarter(template, name, target, parent, undefined, {}, options);
        await applyProjectOptions(target, template, name, options, parent);
      });
      const cmake = await fs.readFile(path.join(project, 'CMakeLists.txt'), 'utf8');
      assert.match(cmake, /MACOSX_BUNDLE TRUE/);
      assert.match(cmake, /include\(cmake\/Distribution\.cmake\)/);
      assert.equal(cmake.includes('ImGui-SFML::ImGui-SFML'), imgui);
      if (imgui) assert.ok(cmake.includes('/' + backend));
      assert.ok((await fs.readFile(path.join(project, 'cmake/SFML.cmake'), 'utf8')).includes('/' + version));
      const source = await fs.readFile(path.join(project, 'src/main.cpp'), 'utf8');
      assert.ok(source.includes(poll));
      assert.match(source, imgui ? /ImGui::SliderFloat/ : /sf::Keyboard::isKeyPressed/);
    }
  }
});

test('requires a Python environment manager and exposes only matching local interpreter versions', () => {
  const template = starters.find(item => item.id === 'python-desktop');
  const config = projectOptions(template, { uv: { file: 'uv' } }, [
    { file: 'python1', version: '3.14.7', usable: true, tkinter: false },
    { file: 'python2', version: '3.13.9', usable: true, tkinter: true }
  ]);
  assert.ok(config.environments.every(manager => manager.id !== 'none'));
  assert.deepEqual(config.environments.find(manager => manager.id === 'venv').versions, ['3.13.9']);
  assert.equal(config.defaultEnvironment, 'venv');
  assert.throws(() => readProjectOptions(template, { environment: 'none' }), /environment manager/);
  assert.equal(readProjectOptions(template, {}).environment, 'venv');
});

test('adds each alternative test framework to its starter', async t => {
  const root = await fixture(t);
  const examples = [
    ['cpp-cmake', 'catch2', 'cmake/ProjectOptions.cmake', /Catch2::Catch2WithMain/],
    ['python-cli', 'unittest', 'tests/test_example.py', /unittest.TestCase/],
    ['typescript-frontend', 'vitest', 'package.json', /vitest run/],
    ['java-cli', 'junit', 'tests/src/test/java/ExampleTest.java', /org.junit.jupiter/],
    ['kotlin-cli', 'junit', 'tests/src/test/kotlin/ExampleTest.kt', /org.junit.jupiter/],
    ['swift-cli', 'xctest', 'Package.swift', /\.testTarget\(name: "ExampleTests"\)/]
  ];
  for (const [id, framework, file, content] of examples) {
    const template = starters.find(item => item.id === id);
    const options = readProjectOptions(template, { testing: true, framework });
    const project = await createProject(root, id, async (target, parent) => {
      await writeStarter(template, id, target, parent);
      await applyProjectOptions(target, template, id, options);
    });
    assert.match(await fs.readFile(path.join(project, file), 'utf8'), content);
    if (framework === 'unittest') await assert.rejects(fs.stat(path.join(project, 'requirements.txt')), { code: 'ENOENT' });
  }
  const c = starters.find(item => item.id === 'c-cmake');
  assert.throws(() => readProjectOptions(c, { testing: true, framework: 'nunit' }), /supported test framework/);
  assert.equal(readProjectOptions(starters.find(item => item.id === 'dotnet-console'), { testing: true, framework: 'nunit' }).type, 'dotnet');
});

test('offers both React Native starters with the native CLI Node versions', () => {
  const mobile = starters.filter(template => ['expo-mobile', 'react-native-mobile'].includes(template.id));
  assert.deepEqual(mobile.map(template => template.kind), ['starter', 'react-native']);
  assert.equal(reactNativeIdentifier('9 React-Native App'), 'App9ReactNativeApp');
  assert.equal(supportsReactNative('22.12.0'), false);
  assert.equal(supportsReactNative('22.13.0'), true);
  assert.equal(supportsReactNative('24.2.9'), false);
  assert.equal(supportsReactNative('24.3.0'), true);
  assert.equal(supportsReactNative('25.1.0'), false);
  assert.equal(supportsReactNative('26.0.0'), true);
});

test('offers Dart CLI and API starters and Flutter mobile, desktop, and web runners', async t => {
  const root = await fixture(t);
  const api = starters.find(template => template.id === 'dart-server');
  const options = readProjectOptions(api, { testing: true });
  const project = await createProject(root, 'Dart API', async (target, parent) => {
    await writeStarter(api, 'Dart API', target, parent);
    await applyProjectOptions(target, api, 'Dart API', options);
  });
  assert.match(await fs.readFile(path.join(project, 'pubspec.yaml'), 'utf8'), /name: app_dart_api[\s\S]*test: \^1\.25\.0/);
  assert.match(await fs.readFile(path.join(project, 'test/server_test.dart'), 'utf8'), /startServer\(port: 0\)/);
  assert.equal(starters.find(template => template.id === 'dart-cli').group, 'cli');
  for (const [id, group, platforms] of [
    ['flutter-mobile', 'mobile', ['android', 'ios']],
    ['flutter-desktop', 'desktop', ['windows', 'macos', 'linux']],
    ['flutter-web', 'frontend', ['web']]
  ]) {
    const template = starters.find(item => item.id === id);
    assert.equal(template.group, group);
    assert.deepEqual(template.flutterPlatforms, platforms);
  }
});

test('keeps VR opt-in and applies language and template settings independently', () => {
  const templates = templatesForPlatform(starters, 'win32');
  const defaults = enabledTemplates(templates, readCatalogSettings());
  assert.ok(defaults.some(template => template.id === 'kotlin-multiplatform'));
  assert.ok(defaults.every(template => template.group !== 'vr'));
  assert.ok(defaults.every(template => template.language !== 'Objective-C'));
  const settings = readCatalogSettings({ enableVrTemplates: true, disabledLanguages: ['Ruby', 'Ruby', 7],
    disabledTemplates: ['lua-love', 'raylib-vr-android-c'] });
  const enabled = enabledTemplates(templates, settings);
  assert.deepEqual(settings.disabledLanguages, ['Ruby']);
  assert.ok(enabled.every(template => template.language !== 'Ruby' && template.id !== 'lua-love'));
  assert.ok(enabled.some(template => template.id === 'lua-cli'));
  assert.deepEqual(enabled.filter(template => template.group === 'vr').map(template => template.id),
    ['raylib-vr-android-cpp', 'kotlin-android-xr']);
});

test('keeps Android CMake sample tests on the host', async t => {
  const root = await fixture(t);
  const template = starters.find(item => item.id === 'raylib-vr-android-c');
  const options = readProjectOptions(template, { testing: true, libraries: ['yyjson'] });
  const project = await createProject(root, '9 Android VR', async (target, parent) => {
    await writeStarter(template, '9 Android VR', target, parent);
    await applyProjectOptions(target, template, '9 Android VR', options);
  });
  const cmake = await fs.readFile(path.join(project, 'cmake', 'ProjectOptions.cmake'), 'utf8');
  assert.match(cmake, /if\(ANDROID\)[\s\S]*target_link_libraries\(game PRIVATE yyjson\)/);
  assert.match(cmake, /if\(PROJECT_BUILD_LIBRARY_EXAMPLES AND NOT ANDROID\)[\s\S]*add_executable\(example_yyjson examples\/yyjson\.c\)/);
  assert.match(cmake, /if\(NOT ANDROID\)[\s\S]*target_link_libraries\(example_test PRIVATE starter_logic\)/);
  const gradle = await fs.readFile(path.join(project, 'build.gradle.kts'), 'utf8');
  const main = await fs.readFile(path.join(project, 'src', 'main.c'), 'utf8');
  const applicationId = gradle.match(/applicationId = "([a-zA-Z0-9_.]+)"/)[1];
  assert.match(applicationId, /^com\.example\.raylib\.project_[a-zA-Z0-9_]+$/);
  assert.ok(main.includes('ASensorManager_getInstanceForPackage("' + applicationId + '")'));
});
