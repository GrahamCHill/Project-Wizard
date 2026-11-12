const fs = require('node:fs/promises');
const path = require('node:path');
const { cmakeLibraries, cmakeLibraryLine, configureEmscripten, parseCmakeLibraries, writeCmakeOptions } = require('./cmake-options');
const { environments, parsePythonOptions, preparePython, pythonVersionSupported, selectPython } = require('./python-options');
const { addDotnetTests, addJvmTests, addSwiftTests } = require('./extra-tests');
const { packageChoices, parseNuGetPackages, writeNuGetPackages } = require('./dotnet-options');
const { replaceTokens } = require('./projects');
const { configureJava, parseJavaDependencies } = require('./java-options');
const { configureNativeApp, executableIconFormats, mobileIconTemplate } = require('./native-app');
const { configureNativeDistribution } = require('./native-distribution');
const { iconVariants } = require('./icon-data');
const { configureDesktopApp } = require('./desktop-icons');
const { configureMobileIcons } = require('./mobile-icons');
const { templateAvailability } = require('./toolchains');

const npmTemplates = ['javascript-frontend', 'javascript-server', 'typescript-frontend', 'expo-mobile', 'electron'];
const npmOptions = { type: 'npm', dependencies: 'npm packages', example: '@scope/package@^1.0.0' };
const testLabels = {
  ctest: 'CTest', gtest: 'GoogleTest', catch2: 'Catch2', pytest: 'pytest', unittest: 'unittest',
  node: 'Node.js test runner', vitest: 'Vitest', junit: 'JUnit', xctest: 'XCTest', xunit: 'xUnit', nunit: 'NUnit',
  Dart: 'Dart test', Go: 'Go testing', Rust: 'Cargo tests', Zig: 'Zig tests'
};
const nativeTests = {
  Go: {
    file: 'example_test.go', command: 'go test ./...', label: 'Go test example',
    source: 'package main\n\nimport "testing"\n\nfunc TestAdd(t *testing.T) {\n\tadd := func(a, b int) int { return a + b }\n\tif actual := add(2, 3); actual != 5 {\n\t\tt.Fatalf("add(2, 3) = %d, want 5", actual)\n\t}\n}\n'
  },
  Rust: {
    file: 'tests/example.rs', command: 'cargo test', label: 'Cargo test example',
    source: 'fn add(left: i32, right: i32) -> i32 {\n    left + right\n}\n\n#[test]\nfn adds_two_numbers() {\n    assert_eq!(add(2, 3), 5);\n}\n'
  },
  Zig: {
    file: 'tests/example.zig', command: 'zig test tests/example.zig', label: 'Zig test example',
    source: 'const std = @import("std");\n\nfn add(left: i32, right: i32) i32 {\n    return left + right;\n}\n\ntest "adds two numbers" {\n    try std.testing.expectEqual(@as(i32, 5), add(2, 3));\n}\n'
  }
};

const javaBuilds = [
  { id: 'jdk', label: 'JDK (javac and java)', tools: ['java'] },
  { id: 'maven', label: 'Maven', tools: ['java-17', 'maven'], requirement: 'Maven 3.9+ and JDK 17 or newer.' },
  { id: 'gradle', label: 'Gradle', tools: ['java-17', 'gradle'], requirement: 'Gradle 8.5+ and a compatible JDK 17 or newer.' }
];

function buildChoice(label, choices, tools, platform, manager) {
  const options = choices.map(({ id, label, requirement, ...requirements }) => ({
    id, label, requirement, ...templateAvailability(requirements, tools, platform, manager)
  }));
  return { label, options, defaultId: (options.find(option => option.ready) || options[0]).id };
}

function projectOptions(template, tools = {}, versions = [], platform = process.platform, manager) {
  const options = buildOptions(template, tools, versions, platform, manager);
  const formats = executableIconFormats(template);
  return formats.length ? { type: 'app', ...options, executableIconFormats: formats } : options;
}

function cmakeChoices(template) {
  return cmakeLibraries(template).map(library => ({
    id: library.id, label: library.label, line: cmakeLibraryLine(library), desktopOnly: library.desktopOnly
  }));
}

function nativeOptionsTemplate(template) {
  if (template.nativeTarget) return { id: template.id, language: 'C++', cmakeTarget: template.nativeTarget };
}

function buildOptions(template, tools, versions, platform, manager) {
  if (template.kind === 'react-native') return npmOptions;
  if (template.kind === 'npm-generator') return { ...npmOptions, ...testOptions('node', 'vitest') };
  if (template.kind === 'dotnet' || (template.language === 'C#' && template.needsSdk)) {
    const native = nativeOptionsTemplate(template);
    const libraries = native ? [
      ...packageChoices.map(item => ({ ...item, label: 'C# · ' + item.label })),
      ...cmakeChoices(native).map(item => ({ ...item, label: 'C++ · ' + item.label }))
    ] : packageChoices;
    return { type: 'dotnet', libraries, libraryLabel: native ? 'Common NuGet and CMake libraries' : 'Common NuGet packages',
      dependencies: native ? 'Additional NuGet and CMake dependencies' : 'Additional NuGet packages',
      example: 'LiteNetLib 2.1.5', dependencyHint: native ?
        'Choose a package above or enter a NuGet package ID and version or a CMake archive line. Use one line per dependency.' :
        'Choose a package above or enter a NuGet package ID and version. Use one line per package.',
      ...testOptions('xunit', 'nunit') };
  }
  if (template.kind !== 'starter') return;
  if (template.cmakeTarget) {
    return { type: 'cmake', libraries: cmakeChoices(template), libraryLabel: 'Common CMake libraries',
      dependencies: 'Additional CMake archives', example: 'name target https://example.com/library.tar.gz [sha256]',
      dependencyHint: 'Choose a library above or enter a custom archive. Use one line per dependency.',
      targetChoice: template.webTarget ? buildChoice('Target platforms', [
        { id: 'native', label: 'Desktop (native)', tools: template.tools, platformTools: template.platformTools,
          requirement: template.requirement },
        { id: 'emscripten', label: 'Web (Emscripten)', tools: ['cmake', 'emscripten'], platformTools: { win32: ['emscripten-generator'] },
          requirement: 'CMake 3.24+ and an activated Emscripten SDK.' }
      ], tools, platform, manager) : undefined,
      ...testOptions(...(template.language === 'C' ? ['ctest'] : ['gtest', 'catch2'])) };
  }
  if (template.language === 'Java') {
    return { type: 'java', buildChoice: buildChoice('Build system', javaBuilds, tools, platform, manager),
      dependencies: 'Java dependencies', example: 'org.apache.commons:commons-lang3:3.20.0', ...testOptions('junit') };
  }
  if (template.language === 'Python' && !template.embeddedPython) {
    const managers = environments.map(environment => {
      const id = environment.id;
      const local = id === 'venv' || id === 'virtualenv';
      const available = Boolean(selectPython({ environment: id }, tools, versions, template));
      const interpreters = versions.filter(runtime => runtime.usable && pythonVersionSupported(runtime.version, template) &&
        (!local || selectPython({ environment: id }, tools, [runtime], template)));
      return { ...environment, available, versions: [...new Set(interpreters.map(runtime => runtime.version))] };
    });
    const preferred = template.id === 'python-desktop' ? ['venv', 'conda', 'virtualenv', 'uv'] : ['venv', 'uv', 'conda', 'virtualenv'];
    const defaultEnvironment = preferred.find(id => managers.some(manager => manager.id === id && manager.available)) || 'venv';
    return { type: 'python', environments: managers, defaultEnvironment,
      dependencies: 'Python packages', example: 'requests>=2,<3', requiredDependencies: template.pythonPackages,
      ...testOptions('pytest', 'unittest') };
  }
  if (npmTemplates.includes(template.id)) {
    return { ...npmOptions, ...testOptions(...(template.id === 'expo-mobile' ? ['node'] : ['node', 'vitest'])) };
  }
  if (['kotlin-multiplatform', 'kotlin-android-xr', 'android-compose', 'ios-swiftui'].includes(template.id)) return;
  if (template.language === 'Dart') return { type: 'dart', ...testOptions('Dart') };
  if (template.language === 'Kotlin') return { type: 'jvm-tests', ...testOptions('junit') };
  if (template.language === 'Swift') return { type: 'swift-tests', ...testOptions('xctest') };
  if (nativeTests[template.language]) return { type: 'native', ...testOptions(template.language) };
}

function testOptions(...frameworks) {
  const test = frameworks.length === 1 ? 'Add a ' + testLabels[frameworks[0]] + ' example' : 'Add an example test';
  return { test, frameworks: frameworks.map(id => ({ id, label: testLabels[id] })) };
}

function parseNpmLibraries(lines) {
  const packages = new Map();
  for (const line of lines) {
    const match = line.match(/^((?:@[a-z0-9][a-z0-9_.-]*\/)?[a-z0-9][a-z0-9_.-]*)(?:@([a-zA-Z0-9~^*][a-zA-Z0-9.*+~^<>=| -]*))?$/);
    if (!match) throw new Error('Use one npm package per line, for example lodash or @scope/package@^1.0.0.');
    if (packages.has(match[1])) throw new Error('Duplicate npm package: ' + match[1]);
    packages.set(match[1], match[2] || 'latest');
  }
  return packages;
}

function readProjectOptions(template, input = {}, selectedIcons) {
  const config = projectOptions(template);
  if (!config) return;
  if (!input || typeof input !== 'object') throw new Error('Invalid project options.');
  const text = typeof input.dependencies === 'string' ? input.dependencies : '';
  if (text.length > 12000) throw new Error('Enter fewer dependencies.');
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const frameworks = config.frameworks || [];
  const framework = input.testing === true ? input.framework || frameworks[0]?.id : undefined;
  if (framework && !frameworks.some(item => item.id === framework)) throw new Error('Choose a supported test framework.');
  const builds = config.buildChoice?.options;
  const build = builds && (input.build || builds[0].id);
  if (build && !builds.some(option => option.id === build)) throw new Error('Choose a supported build option.');
  let targets;
  if (config.targetChoice) {
    const selected = input.targets ?? ['native'];
    if (!Array.isArray(selected) || !selected.length ||
        !selected.every(id => config.targetChoice.options.some(option => option.id === id))) {
      throw new Error('Choose at least one supported target platform.');
    }
    targets = [...new Set(selected)];
  }
  let packages;
  let nativePackages;
  let icons;
  if (input.executableIcon === true) {
    if (!config.executableIconFormats?.length || (targets && !targets.includes('native'))) {
      throw new Error('Select a native executable target to set an icon.');
    }
    icons = new Map([...(selectedIcons || [])].filter(([format]) => config.executableIconFormats.includes(format)));
    if (!icons.size) throw new Error('Choose an executable icon file.');
  }
  if (config.type === 'python') {
    return { type: config.type, tkinter: template.id === 'python-desktop', icons,
      ...parsePythonOptions(input, lines, framework, template) };
  }
  if (config.type === 'java') {
    if (build === 'jdk' && lines.length) throw new Error('Choose Maven or Gradle to add Java dependencies.');
    packages = parseJavaDependencies(lines);
    const testDependencies = ['org.junit.jupiter:junit-jupiter', 'org.junit.platform:junit-platform-launcher'];
    if (framework && packages.some(({ group, artifact }) => testDependencies.includes(`${group}:${artifact}`))) {
      throw new Error('The selected JUnit example already adds the JUnit dependencies.');
    }
  } else if (config.type === 'cmake') {
    packages = parseCmakeLibraries(template, Array.isArray(input.libraries) ? input.libraries : [], lines, targets);
  } else if (config.type === 'npm') {
    packages = parseNpmLibraries(lines);
  } else if (config.type === 'dotnet') {
    const native = nativeOptionsTemplate(template);
    const nativeIds = new Set(native ? cmakeLibraries(native).map(library => library.id) : []);
    const nugetLines = [];
    const cmakeLines = [];
    for (const line of lines) {
      const [, , archive] = line.split(/\s+/);
      (native && (nativeIds.has(line) || archive?.startsWith('https://')) ? cmakeLines : nugetLines).push(line);
    }
    packages = parseNuGetPackages(nugetLines);
    if (native) nativePackages = parseCmakeLibraries(native, [], cmakeLines);
  }
  return { type: config.type, packages, nativePackages, framework, build, targets, icons };
}

async function appendTest(project, file, source, command, label) {
  const target = path.join(project, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, source, { flag: 'wx' });
  await fs.appendFile(path.join(project, 'README.md'), '\n## Tests\n\n' + label + '\n\n~~~sh\n' + command + '\n~~~\n');
}

async function configureNpm(project, template, name, options) {
  if (!options.packages.size && !options.framework) return;
  const file = path.join(project, 'package.json');
  const source = await fs.readFile(file, 'utf8').catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  const manifest = source ? JSON.parse(source) : {
    name: replaceTokens('__PROJECT_SLUG__', name), version: '0.1.0', private: true
  };
  if (options.packages.size) {
    for (const [id, version] of options.packages) {
      const current = manifest.dependencies?.[id] || manifest.devDependencies?.[id];
      if (Object.hasOwn(manifest.dependencies || {}, id) || Object.hasOwn(manifest.devDependencies || {}, id)) {
        if (version !== 'latest' && version !== current) throw new Error('The starter already includes ' + id + ' at ' + current + '.');
        continue;
      }
      manifest.dependencies = { ...manifest.dependencies, [id]: version };
    }
    await fs.appendFile(path.join(project, 'README.md'), '\n## Dependencies\n\nRun npm install to install the packages you selected.\n');
  }
  if (!source && (options.packages.size || options.framework === 'vitest')) {
    await fs.writeFile(path.join(project, '.gitignore'), 'node_modules/\n', { flag: 'wx' });
  }
  if (options.framework === 'node') {
    manifest.scripts = { ...manifest.scripts, test: 'node --test' };
    await appendTest(project, 'tests/example.test.mjs',
      "import assert from 'node:assert/strict';\nimport test from 'node:test';\n\nconst add = (left, right) => left + right;\n\ntest('adds two numbers', () => {\n  assert.equal(add(2, 3), 5);\n});\n",
      'npm test', 'Run the example with Node.js 18 or newer.');
  }
  if (options.framework === 'vitest') {
    manifest.scripts = { ...manifest.scripts, test: 'vitest run' };
    if (!manifest.dependencies?.vitest && !manifest.devDependencies?.vitest) {
      manifest.devDependencies = { ...manifest.devDependencies, vitest: '~4.1.12' };
    }
    const typescript = template.language === 'TypeScript';
    const add = typescript ? 'const add = (left: number, right: number) => left + right;' :
      'const add = (left, right) => left + right;';
    await appendTest(project, typescript ? 'tests/example.test.ts' : 'tests/example.test.mjs',
      "import { expect, test } from 'vitest';\n\n" + add +
      "\n\ntest('adds two numbers', () => {\n  expect(add(2, 3)).toBe(5);\n});\n",
      'npm install\nnpm test', 'Use a current Node.js LTS release for Vitest.');
  }
  await fs.writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
}

async function applyProjectOptions(project, template, name, options, parent, log) {
  if (!options) return;
  if (!options.icons) {
    await applyBuildOptions(project, template, name, options, parent, log);
    if (options.type !== 'cmake' && (template.group === 'desktop' || (template.group === 'raylib' && template.language === 'C#'))) {
      await configureDesktopApp(project, template, name, options, new Map());
    }
    return;
  }
  const { outputs, raster } = await iconVariants(options.icons, executableIconFormats(template));
  const mobile = mobileIconTemplate(template);
  if (raster && !mobile) outputs.set('.png', { data: await raster.png(256) });
  await applyBuildOptions(project, template, name, { ...options, icons: outputs }, parent, log);
  if (mobile) return configureMobileIcons(project, template, name, raster);
  if (options.type !== 'cmake' || template.cmakeLibrary) return configureDesktopApp(project, template, name, options, outputs, raster);
}

async function applyBuildOptions(project, template, name, options, parent, log) {
  if (options.type === 'cmake') {
    if (options.targets?.includes('emscripten')) await configureEmscripten(project, template, name, options.targets);
    await configureNativeApp(project, template, name, options);
    await writeCmakeOptions(project, template, options.packages, options.framework, options.targets);
    return configureNativeDistribution(project, template, options);
  }
  if (options.type === 'java') return configureJava(project, template, name, options);
  if (options.type === 'python') return preparePython(project, template, name, options);
  if (options.type === 'npm') return configureNpm(project, template, name, options);
  if (options.type === 'dotnet') {
    await writeNuGetPackages(project, options.packages);
    const native = nativeOptionsTemplate(template);
    if (native) await writeCmakeOptions(path.join(project, 'native'), native, options.nativePackages);
    if (options.framework) {
      await addDotnetTests(project, parent, options.framework, log, native && {
        call: 'NativeMotion.Advance(94, 10, 100)', expected: 4
      });
    }
    return;
  }
  if (options.framework) {
    if (options.type === 'jvm-tests') return addJvmTests(project, true);
    if (options.type === 'swift-tests') return addSwiftTests(project);
    if (options.type === 'dart') {
      const testFile = template.id === 'dart-server' ? 'test/server_test.dart' : 'test/greeting_test.dart';
      const source = await fs.readFile(path.join(__dirname, '..', 'templates', template.id, testFile), 'utf8');
      await fs.appendFile(path.join(project, 'pubspec.yaml'), '\ndev_dependencies:\n  test: ^1.25.0\n');
      return appendTest(project, testFile, replaceTokens(source, name), 'dart pub get\ndart test', 'Run the Dart test example.');
    }
    const test = nativeTests[template.language];
    await appendTest(project, test.file, test.source, test.command, test.label + '.');
  }
}

module.exports = { applyProjectOptions, projectOptions, readProjectOptions };
