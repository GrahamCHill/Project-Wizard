const assert = require('node:assert/strict');
const { createWriteStream } = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { test } = require('node:test');
const { ZipFile } = require('yazl');
const { createProject, detectFrameworks, parseMonoGameTemplates, validateProjectName } = require('../src/projects');
const { starters, writeStarter } = require('../src/starters');
const { getSetup, supportsReactNative, supportsVite, templateAvailability, templatesForPlatform } = require('../src/toolchains');
const { applyProjectOptions, projectOptions, readProjectOptions } = require('../src/project-options');
const { selectPython } = require('../src/python-options');
const { extractZipTemplate, listZipTemplates } = require('../src/zip-templates');
const { reactNativeIdentifier } = require('../src/react-native');
const { enabledTemplates, readCatalogSettings } = require('../src/catalog');

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
      const generated = path.join(project, output);
      assert.doesNotMatch(await fs.readFile(generated, 'utf8'), /__PROJECT_[A-Z]+__/);
    }
    const readme = await fs.readFile(path.join(project, 'README.md'), 'utf8');
    assert.match(readme, /^# 9 Example Project/);
    if (template.commands.length) assert.ok(readme.includes(template.commands[0]));
  }
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
  const cTemplates = starters.filter(template => template.language === 'C');
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
  assert.equal(readProjectOptions(starters.find(item => item.id === 'dotnet-console'), { testing: true, framework: 'nunit' }).type, 'dotnet-tests');
});

test('offers both React Native starters with the native CLI Node versions', () => {
  const mobile = starters.filter(template => template.group === 'mobile');
  assert.deepEqual(mobile.map(template => template.kind), ['starter', 'react-native']);
  assert.equal(reactNativeIdentifier('9 React-Native App'), 'App9ReactNativeApp');
  assert.equal(supportsReactNative('22.12.0'), false);
  assert.equal(supportsReactNative('22.13.0'), true);
  assert.equal(supportsReactNative('24.2.9'), false);
  assert.equal(supportsReactNative('24.3.0'), true);
  assert.equal(supportsReactNative('25.1.0'), false);
  assert.equal(supportsReactNative('26.0.0'), true);
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
  assert.match(cmake, /if\(NOT ANDROID\)[\s\S]*target_link_libraries\(example_test PRIVATE starter_logic\)/);
  const gradle = await fs.readFile(path.join(project, 'build.gradle.kts'), 'utf8');
  const main = await fs.readFile(path.join(project, 'src', 'main.c'), 'utf8');
  const applicationId = gradle.match(/applicationId = "([a-zA-Z0-9_.]+)"/)[1];
  assert.match(applicationId, /^com\.example\.raylib\.project_[a-zA-Z0-9_]+$/);
  assert.ok(main.includes('ASensorManager_getInstanceForPackage("' + applicationId + '")'));
});
