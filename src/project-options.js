const fs = require('node:fs/promises');
const path = require('node:path');
const { cmakeLibraries, parseCmakeLibraries, writeCmakeOptions } = require('./cmake-options');
const { environments, parsePythonOptions, preparePython } = require('./python-options');
const { replaceTokens } = require('./projects');

const npmTemplates = ['javascript-frontend', 'javascript-server', 'typescript-frontend', 'expo-mobile'];
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
  if (template.kind !== 'starter') return;
  if (template.cmakeTarget) {
    return { type: 'cmake', libraries: cmakeLibraries(template).map(({ id, label }) => ({ id, label })),
      dependencies: 'Additional CMake archives', example: 'name target https://example.com/library.tar.gz [sha256]',
      test: template.language === 'C' ? 'Add a CTest example' : 'Add a GoogleTest example' };
  }
  if (template.language === 'Python') {
    const hasPython = versions.some(runtime => runtime.usable && (template.id !== 'python-desktop' || runtime.tkinter));
    const canCreate = { venv: hasPython, uv: Boolean(tools.uv), conda: Boolean(tools.conda), virtualenv: hasPython && Boolean(tools.virtualenv) };
    return { type: 'python', environments: environments.map(({ id, label, tool }) => ({ id, label, tool, available: canCreate[id] })),
      defaultEnvironment: hasPython ? 'venv' : template.id === 'python-desktop' && tools.conda ? 'conda' : tools.uv ? 'uv' : tools.conda ? 'conda' : 'venv',
      versions: [...new Set(versions.filter(runtime => runtime.usable).map(runtime => runtime.version))],
      dependencies: 'Python packages', example: 'requests>=2,<3', test: 'Add a pytest example' };
  }
  if (npmTemplates.includes(template.id)) {
    return { type: 'npm', dependencies: 'npm packages', example: '@scope/package@^1.0.0', test: 'Add a Node.js test example' };
  }
  if (nativeTests[template.language]) return { type: 'native', test: 'Add a ' + nativeTests[template.language].label };
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
  const testing = input.testing === true;
  if (config.type === 'python') return { type: config.type, ...parsePythonOptions(input, lines, testing) };
  const selected = Array.isArray(input.libraries) ? input.libraries : [];
  const packages = config.type === 'cmake' ? parseCmakeLibraries(template, selected, lines) :
    config.type === 'npm' ? parseNpmLibraries(lines) : undefined;
  return { type: config.type, packages, testing };
}

async function appendTest(project, file, source, command, label) {
  const target = path.join(project, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, source, { flag: 'wx' });
  await fs.appendFile(path.join(project, 'README.md'), '\n## Tests\n\n' + label + '\n\n~~~sh\n' + command + '\n~~~\n');
}

async function configureNpm(project, name, options) {
  if (!options.packages.size && !options.testing) return;
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
    if (!source) await fs.writeFile(path.join(project, '.gitignore'), 'node_modules/\n', { flag: 'wx' });
  }
  if (options.testing) {
    manifest.scripts = { ...manifest.scripts, test: 'node --test' };
    await appendTest(project, 'tests/example.test.mjs',
      "import assert from 'node:assert/strict';\nimport test from 'node:test';\n\nconst add = (left, right) => left + right;\n\ntest('adds two numbers', () => {\n  assert.equal(add(2, 3), 5);\n});\n",
      'npm test', 'Run the example with Node.js 18 or newer.');
  }
  await fs.writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
}

async function applyProjectOptions(project, template, name, options) {
  if (!options) return;
  if (options.type === 'cmake') return writeCmakeOptions(project, template, options.packages, options.testing);
  if (options.type === 'python') return preparePython(project, template, name, options);
  if (options.type === 'npm') return configureNpm(project, name, options);
  if (options.testing) {
    const test = nativeTests[template.language];
    await appendTest(project, test.file, test.source, test.command, test.label + '.');
  }
}

module.exports = { applyProjectOptions, projectOptions, readProjectOptions };
