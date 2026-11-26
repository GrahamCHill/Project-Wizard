const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { promisify } = require('node:util');
const { starters, writeStarter } = require('../src/starters');
const { projectOptions, readProjectOptions } = require('../src/project-options');
const { createProject } = require('../src/projects');

const exec = promisify(execFile);
const goTemplates = ['go-cli', 'go-server', 'go-library', 'docker-go'];
const projectName = '9 Go Example';

async function fixture(t) {
  const temp = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temp, 'project-wizard-go-'));
  t.after(async () => {
    assert.equal(path.dirname(root), temp);
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

async function generate(root, id) {
  const template = starters.find(item => item.id === id);
  assert.ok(template, 'missing template ' + id);
  return createProject(root, id, (project, parent) => writeStarter(template, projectName, project, parent));
}

async function goVersion() {
  try {
    const { stdout } = await exec('go', ['version'], { windowsHide: true, timeout: 30000 });
    return stdout.trim();
  } catch {
    return undefined;
  }
}

function runGo(project, args) {
  // GOTOOLCHAIN=local keeps a test run from downloading another Go release, and GOFLAGS=-mod=mod
  // lets the stdlib-only sample modules build without a go.sum file.
  return exec('go', args, {
    cwd: project, windowsHide: true, timeout: 180000,
    env: { ...process.env, GOTOOLCHAIN: 'local', GOFLAGS: '-mod=mod', GOWORK: 'off' }
  });
}

async function failure(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail('The command should have failed.');
}

test('every Go starter lists a Go test file and keeps the test in its generated project', async t => {
  const root = await fixture(t);
  for (const id of goTemplates) {
    const template = starters.find(item => item.id === id);
    assert.equal(template.language, 'Go');
    assert.ok(template.files.some(file => file.endsWith('_test.go')), id + ' should list a *_test.go file');
    const project = await generate(root, id);
    const tests = (await fs.readdir(project)).filter(file => file.endsWith('_test.go'));
    assert.ok(tests.length > 0, id + ' should generate a test file');
    for (const file of tests) {
      const source = await fs.readFile(path.join(project, file), 'utf8');
      assert.match(source, /func Test\w+\(t \*testing\.T\)/, file);
      assert.doesNotMatch(source, /__PROJECT_/, file + ' should not contain unreplaced tokens');
    }
  }
});

test('Go starters document go test and do not offer a second generated test example', () => {
  for (const id of ['go-cli', 'go-server', 'go-library']) {
    const template = starters.find(item => item.id === id);
    assert.ok(template.commands.includes('go test ./...'), id + ' should document go test');
    assert.ok(template.commands.includes('go vet ./...'), id + ' should document go vet');
    assert.equal(projectOptions(template), undefined, id + ' already includes tests');
    assert.equal(readProjectOptions(template, { testing: true }), undefined);
  }
});

test('Go starters generate a README with test commands and a gitignore for test artifacts', async t => {
  const root = await fixture(t);
  for (const id of ['go-cli', 'go-server']) {
    const project = await generate(root, id);
    assert.match(await fs.readFile(path.join(project, 'README.md'), 'utf8'), /go test \.\/\.\.\./);
    assert.match(await fs.readFile(path.join(project, '.gitignore'), 'utf8'), /coverage\.out/);
    assert.match(await fs.readFile(path.join(project, 'go.mod'), 'utf8'), /^module example\.com\/9-go-example$/m);
  }
});

test('the Go CLI keeps its behavior testable through run and greeting', async t => {
  const root = await fixture(t);
  const project = await generate(root, 'go-cli');
  const main = await fs.readFile(path.join(project, 'main.go'), 'utf8');
  assert.match(main, /func run\(args \[\]string, stdout, stderr io\.Writer\) int/);
  assert.match(main, /os\.Exit\(run\(os\.Args\[1:\], os\.Stdout, os\.Stderr\)\)/);
  assert.match(main, /const defaultName = "9 Go Example"/);
  const tests = await fs.readFile(path.join(project, 'main_test.go'), 'utf8');
  for (const name of ['TestGreeting', 'TestRun']) assert.match(tests, new RegExp('func ' + name + '\\('));
  assert.match(tests, /unknown flag/);
  assert.match(tests, /extra arguments/);
});

test('the Go server exposes newHandler so tests do not need a network port', async t => {
  const root = await fixture(t);
  const project = await generate(root, 'go-server');
  const main = await fs.readFile(path.join(project, 'main.go'), 'utf8');
  assert.match(main, /func newHandler\(\) http\.Handler/);
  assert.match(main, /Handler:\s+newHandler\(\)/);
  const tests = await fs.readFile(path.join(project, 'main_test.go'), 'utf8');
  assert.match(tests, /httptest\.NewRecorder\(\)/);
  assert.doesNotMatch(tests, /ListenAndServe|net\.Listen/);
  for (const behavior of ['http.StatusNotFound', 'http.StatusMethodNotAllowed', 'application/json']) {
    assert.ok(tests.includes(behavior), 'the tests should cover ' + behavior);
  }
});

test('generated Go projects pass gofmt, go vet, and go test', async t => {
  const version = await goVersion();
  if (!version) return t.skip('Go is not installed.');
  const root = await fixture(t);
  for (const id of goTemplates) {
    await t.test(id, async () => {
      const project = await generate(root, id);
      const unformatted = await exec('gofmt', ['-l', '.'], { cwd: project, windowsHide: true, timeout: 60000 })
        .then(result => result.stdout.trim(), error => {
          if (error.code === 'ENOENT') return '';
          throw error;
        });
      assert.equal(unformatted, '', 'gofmt should not list any files');
      await runGo(project, ['vet', './...']);
      const { stdout } = await runGo(project, ['test', '-count=1', './...']);
      // The Docker starter prefixes its module name with "app-".
      assert.match(stdout, /^ok\s+example\.com\/(?:app-)?9-go-example/m);
    });
  }
});

test('the Go CLI tests fail when the program behavior changes', async t => {
  if (!await goVersion()) return t.skip('Go is not installed.');
  const root = await fixture(t);
  const project = await generate(root, 'go-cli');
  const main = path.join(project, 'main.go');
  const original = await fs.readFile(main, 'utf8');
  assert.ok(original.includes('return 2\n\t}\n\tfmt.Fprintln(stdout'));
  await fs.writeFile(main, original.replace('return 2\n\t}\n\tfmt.Fprintln(stdout', 'return 0\n\t}\n\tfmt.Fprintln(stdout'));
  const error = await failure(runGo(project, ['test', '-count=1', './...']));
  assert.match(error.stdout, /FAIL/);
  assert.match(error.stdout, /extra_arguments/);
});

test('the Go server tests fail when the handler stops rejecting other methods', async t => {
  if (!await goVersion()) return t.skip('Go is not installed.');
  const root = await fixture(t);
  const project = await generate(root, 'go-server');
  const main = path.join(project, 'main.go');
  const original = await fs.readFile(main, 'utf8');
  assert.ok(original.includes('r.Method != http.MethodGet'));
  await fs.writeFile(main, original.replace('r.Method != http.MethodGet', 'false'));
  const error = await failure(runGo(project, ['test', '-count=1', './...']));
  assert.match(error.stdout, /FAIL/);
  assert.match(error.stdout, /TestOtherMethodsAreRejected/);
});
