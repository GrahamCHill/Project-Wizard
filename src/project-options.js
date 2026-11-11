const fs = require('node:fs/promises');
const path = require('node:path');
const { cmakeLibraries, parseCmakeLibraries, writeCmakeOptions } = require('./cmake-options');
const { environments, parsePythonOptions, preparePython, selectPython } = require('./python-options');
const { addDotnetTests, addJvmTests, addSwiftTests } = require('./extra-tests');
const { replaceTokens } = require('./projects');

const npmTemplates = ['javascript-frontend', 'javascript-server', 'typescript-frontend', 'expo-mobile'];
const npmOptions = { type: 'npm', dependencies: 'npm packages', example: '@scope/package@^1.0.0' };
const testLabels = {
  ctest: 'CTest', gtest: 'GoogleTest', catch2: 'Catch2', pytest: 'pytest', unittest: 'unittest',
  node: 'Node.js test runner', vitest: 'Vitest', junit: 'JUnit', xctest: 'XCTest', xunit: 'xUnit', nunit: 'NUnit',
  Go: 'Go testing', Rust: 'Cargo tests', Zig: 'Zig tests'
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

function projectOptions(template, tools = {}, versions = []) {
  if (template.kind === 'react-native') return npmOptions;
  if (template.kind === 'dotnet' || template.id === 'raylib-csharp') {
    return { type: 'dotnet-tests', ...testOptions('xunit', 'nunit') };
  }
  if (template.kind !== 'starter') return;
  if (template.cmakeTarget) {
    return { type: 'cmake', libraries: cmakeLibraries(template).map(({ id, label }) => ({ id, label })),
      dependencies: 'Additional CMake archives', example: 'name target https://example.com/library.tar.gz [sha256]',
      ...testOptions(...(template.language === 'C' ? ['ctest'] : ['gtest', 'catch2'])) };
  }
  if (template.language === 'Python') {
    const managers = environments.map(environment => {
      const id = environment.id;
      const local = id === 'venv' || id === 'virtualenv';
      const available = Boolean(selectPython({ environment: id }, tools, versions, template));
      const interpreters = versions.filter(runtime => runtime.usable &&
        (!local || selectPython({ environment: id }, tools, [runtime], template)));
      return { ...environment, available, versions: [...new Set(interpreters.map(runtime => runtime.version))] };
    });
    const preferred = template.id === 'python-desktop' ? ['venv', 'conda', 'virtualenv', 'uv'] : ['venv', 'uv', 'conda', 'virtualenv'];
    const defaultEnvironment = preferred.find(id => managers.some(manager => manager.id === id && manager.available)) || 'venv';
    return { type: 'python', environments: managers, defaultEnvironment,
      dependencies: 'Python packages', example: 'requests>=2,<3', ...testOptions('pytest', 'unittest') };
  }
  if (npmTemplates.includes(template.id)) {
    return { ...npmOptions, ...testOptions(...(template.id === 'expo-mobile' ? ['node'] : ['node', 'vitest'])) };
  }
  if (template.id === 'kotlin-multiplatform') return;
  if (['Java', 'Kotlin'].includes(template.language)) return { type: 'jvm-tests', ...testOptions('junit') };
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

function readProjectOptions(template, input = {}) {
  const config = projectOptions(template);
  if (!config) return;
  if (!input || typeof input !== 'object') throw new Error('Invalid project options.');
  const text = typeof input.dependencies === 'string' ? input.dependencies : '';
  if (text.length > 12000) throw new Error('Enter fewer dependencies.');
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const frameworks = config.frameworks || [];
  const framework = input.testing === true ? input.framework || frameworks[0]?.id : undefined;
  if (framework && !frameworks.some(item => item.id === framework)) throw new Error('Choose a supported test framework.');
  if (config.type === 'python') {
    return { type: config.type, tkinter: template.id === 'python-desktop', ...parsePythonOptions(input, lines, framework) };
  }
  const selected = Array.isArray(input.libraries) ? input.libraries : [];
  const packages = config.type === 'cmake' ? parseCmakeLibraries(template, selected, lines) :
    config.type === 'npm' ? parseNpmLibraries(lines) : undefined;
  return { type: config.type, packages, framework };
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
  if (options.type === 'cmake') return writeCmakeOptions(project, template, options.packages, options.framework);
  if (options.type === 'python') return preparePython(project, template, name, options);
  if (options.type === 'npm') return configureNpm(project, template, name, options);
  if (options.framework) {
    if (options.type === 'dotnet-tests') return addDotnetTests(project, parent, options.framework, log);
    if (options.type === 'jvm-tests') return addJvmTests(project, template.language === 'Kotlin');
    if (options.type === 'swift-tests') return addSwiftTests(project);
    const test = nativeTests[template.language];
    await appendTest(project, test.file, test.source, test.command, test.label + '.');
  }
}

module.exports = { applyProjectOptions, projectOptions, readProjectOptions };
