const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { starters } = require('../src/starters');
const { generators } = require('../src/npm-generators');
const { projectOptions, readProjectOptions } = require('../src/project-options');
const { createProject } = require('../src/projects');
const { writeProjectFiles } = require('../src/generate-project');
const { generatorRegistry } = require('../clion/generators');

async function fixture(t) {
  const temp = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temp, 'project-wizard-additional-'));
  t.after(async () => {
    assert.equal(path.dirname(root), temp);
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

async function generate(root, id, input, suffix = '') {
  const template = starters.find(template => template.id === id);
  const options = readProjectOptions(template, input);
  return createProject(root, id + suffix, (project, parent) => writeProjectFiles(project, parent,
    { template, name: '9 Example Package', options, initializeGit: false }));
}

test('exposes the additional templates to both IDEs and scaffolds Vite without install prompts', () => {
  const ids = ['react-frontend', 'vue-frontend', 'svelte-frontend', 'typescript-express', 'python-package',
    'go-library', 'rust-library', 'dotnet-library', 'dotnet-worker'];
  for (const id of ids) {
    assert.equal(starters.filter(template => template.id === id).length, 1);
    assert.ok(generatorRegistry().some(template => template.id === id));
  }
  for (const framework of ['react', 'vue', 'svelte']) {
    const template = generators.find(template => template.id === framework + '-frontend');
    assert.equal(template.generatorNode, 'vite-node');
    assert.ok(template.args.includes('--no-immediate'));
    assert.ok(template.args.includes('--no-interactive'));
    assert.ok(template.args.includes(framework + '-ts'));
    assert.deepEqual(template.runCommands, ['npm install', 'npm run dev']);
  }
  assert.equal(projectOptions(starters.find(template => template.id === 'go-library')), undefined);
});

test('keeps Python package metadata and CLI entry points for each environment manager', async t => {
  const root = await fixture(t);
  for (const environment of ['venv', 'virtualenv', 'uv', 'conda']) {
    const project = await generate(root, 'python-package', {
      environment, dependencies: 'requests>=2,<3', testing: true, framework: 'pytest'
    }, '-' + environment);
    const manifest = await fs.readFile(path.join(project, 'pyproject.toml'), 'utf8');
    assert.match(manifest, /\[build-system\]/);
    assert.match(manifest, /name = "app-9-example-package"/);
    assert.match(manifest, /dependencies = \["requests>=2,<3"\]/);
    assert.match(manifest, /"9-example-package" = "starter_package.cli:main"/);
    assert.match(await fs.readFile(path.join(project, 'tests/test_package.py'), 'utf8'), /from starter_package import greet/);
    assert.match(await fs.readFile(path.join(project, 'tests/test_example.py'), 'utf8'), /test_add/);
    const readme = await fs.readFile(path.join(project, 'README.md'), 'utf8');
    if (environment === 'uv') {
      assert.match(manifest, /\[dependency-groups\]\ndev = \["pytest"\]/);
      assert.match(readme, /uv sync/);
      assert.match(readme, /uv run python -m starter_package/);
    } else {
      assert.match(readme, /python -m pip install -e \./);
      if (environment === 'conda') assert.match(await fs.readFile(path.join(project, 'environment.yml'), 'utf8'), /  - pip\n/);
    }
  }
});

test('creates reusable Rust and Go libraries with examples that use their public API', async t => {
  const root = await fixture(t);
  const go = await generate(root, 'go-library');
  assert.match(await fs.readFile(path.join(go, 'greeting.go'), 'utf8'), /package greeting/);
  assert.match(await fs.readFile(path.join(go, 'greeting_test.go'), 'utf8'), /greeting "example.com\/9-example-package"/);
  assert.match(await fs.readFile(path.join(go, 'greeting_test.go'), 'utf8'), /greeting.Greet\(test.name\)/);
  const rust = await generate(root, 'rust-library');
  assert.match(await fs.readFile(path.join(rust, 'Cargo.toml'), 'utf8'), /\[lib\]\nname = "greeting"/);
  assert.match(await fs.readFile(path.join(rust, 'examples/greet.rs'), 'utf8'), /greeting::greet/);
});

test('preserves the Express API tests while adding npm dependencies', async t => {
  const root = await fixture(t);
  const project = await generate(root, 'typescript-express', { dependencies: 'zod@^4.0.0' });
  const manifest = JSON.parse(await fs.readFile(path.join(project, 'package.json'), 'utf8'));
  assert.equal(manifest.dependencies.zod, '^4.0.0');
  assert.match(manifest.scripts.test, /^npm run build && node --test/);
  assert.equal(projectOptions(starters.find(template => template.id === 'typescript-express')).test, undefined);
  assert.match(await fs.readFile(path.join(project, 'tests/api.mjs'), 'utf8'), /fetch\(base \+ '\/hello/);
});
