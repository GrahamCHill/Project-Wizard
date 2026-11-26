const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { promisify } = require('node:util');
const { starters, writeStarter } = require('../src/starters');
const { applyProjectOptions, projectOptions, readProjectOptions } = require('../src/project-options');
const { createProject } = require('../src/projects');
const { getSetup, templateAvailability, templatesForPlatform } = require('../src/toolchains');
const { generatorRegistry } = require('../clion/generators');
const { resolveDockerStarter } = require('../src/docker-starters');

const exec = promisify(execFile);
const projectName = 'Sample App';
const slug = 'sample-app';
const groups = {
  'ai-llm-chat-python': 'ai', 'ai-llm-chat-typescript': 'ai', 'mcp-server-python': 'ai', 'mcp-server-typescript': 'ai',
  'browser-extension': 'frontend', 'cloudflare-worker': 'server', 'go-cobra-cli': 'cli', 'docker-stack': 'docker',
  'aws-sam-app': 'infrastructure', 'cloudformation-aws': 'infrastructure', 'azure-bicep': 'infrastructure'
};
const ids = Object.keys(groups);
const online = process.env.PROJECT_WIZARD_ONLINE === '1';

async function fixture(t) {
  const temp = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temp, 'project-wizard-new-'));
  t.after(async () => {
    assert.equal(path.dirname(root), temp);
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

async function generate(root, id, name = projectName) {
  const template = starters.find(item => item.id === id);
  assert.ok(template, 'missing template ' + id);
  return createProject(root, id, (project, parent) => writeStarter(template, name, project, parent));
}

async function files(directory, base = directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ?
    files(path.join(directory, entry.name), base) : [path.relative(base, path.join(directory, entry.name)).replaceAll('\\', '/')]));
  return nested.flat().sort();
}

const read = (project, file) => fs.readFile(path.join(project, file), 'utf8');

async function works(command, args) {
  try {
    await exec(command, args, { windowsHide: true, timeout: 30000, shell: process.platform === 'win32' && command === 'npm' });
    return true;
  } catch {
    return false;
  }
}

/** A Python interpreter that has the given modules, from PROJECT_WIZARD_PYTHON or PATH, or undefined. */
async function pythonWith(...modules) {
  for (const candidate of [process.env.PROJECT_WIZARD_PYTHON, 'python', 'python3'].filter(Boolean)) {
    if (await works(candidate, ['-c', modules.length ? 'import ' + modules.join(', ') : 'pass'])) return candidate;
  }
}

test('lists every new starter once, in its group, in both IDEs', () => {
  for (const [id, group] of Object.entries(groups)) {
    const matches = starters.filter(template => template.id === id);
    assert.equal(matches.length, 1, id);
    assert.equal(matches[0].group, group, id);
    assert.ok(generatorRegistry().some(entry => entry.id === id), id + ' in CLion');
  }
  const all = starters.map(template => template.id);
  assert.equal(new Set(all).size, all.length, 'template IDs must be unique');
});

test('maps each starter to the tools it needs and offers install help for the new ones', () => {
  const byId = new Map(starters.map(template => [template.id, template]));
  for (const id of ['ai-llm-chat-typescript', 'mcp-server-typescript', 'browser-extension']) {
    assert.deepEqual(byId.get(id).tools, ['node-ts', 'npm'], id);
    assert.equal(templateAvailability(byId.get(id), { 'node-ts': { usable: false }, npm: {} }, 'linux').ready, false, id);
    assert.equal(templateAvailability(byId.get(id), { 'node-ts': { usable: true }, npm: {} }, 'win32').ready, true, id);
  }
  assert.deepEqual(byId.get('cloudflare-worker').tools, ['node-22', 'npm']);
  assert.deepEqual(byId.get('aws-sam-app').tools, ['sam']);
  assert.deepEqual(byId.get('azure-bicep').tools, ['bicep']);
  assert.deepEqual(byId.get('go-cobra-cli').tools, ['go']);
  assert.equal(templateAvailability(byId.get('cloudformation-aws'), {}, 'linux').ready, true, 'CloudFormation needs no tool to create');
  assert.equal(templateAvailability(byId.get('aws-sam-app'), {}, 'linux').missing[0].id, 'sam');
  assert.match(getSetup('sam', 'win32', 'windows').command, /winget install .*SAM/);
  assert.match(getSetup('bicep', 'darwin', 'macos').command, /brew .*bicep/);
  assert.match(getSetup('node-ts', 'linux').instructions, /22\.18/);
  assert.match(getSetup('node-22', 'win32', 'windows').command, /winget/);
  for (const id of ['sam', 'bicep', 'node-ts', 'node-22']) assert.match(getSetup(id, 'linux').url, /^https:\/\//, id);
  assert.equal(templatesForPlatform(starters, 'win32').filter(template => ids.includes(template.id)).length, ids.length);
});

for (const id of ids) {
  test(`${id} generates every listed file with no leftover tokens`, async t => {
    const root = await fixture(t);
    const project = await generate(root, id);
    const listed = starters.find(item => item.id === id);
    // writeStarter resolves Docker starters itself, so do the same to see the files it writes.
    const template = listed.docker ? resolveDockerStarter(listed) : listed;
    const generated = await files(project);
    assert.ok(generated.length >= 4, id);
    for (const file of template.files.filter(file => file !== 'gitignore')) assert.ok(generated.includes(file), `${id} should generate ${file}`);
    for (const output of Object.values(template.sharedFiles || {})) assert.ok(generated.includes(output), `${id} should generate ${output}`);
    for (const file of generated) {
      const text = await read(project, file);
      assert.doesNotMatch(text, /__PROJECT_(?:NAME|SLUG|IDENTIFIER|SNAKE)__/, `${id}/${file} has an unreplaced token`);
      assert.doesNotMatch(text, /\u0000/, `${id}/${file} should be text`);
    }
    assert.ok(generated.includes('README.md'), id + ' should have a README');
  });
}

test('Python starters declare their SDKs and write a README with set-up and run steps', async t => {
  const root = await fixture(t);
  const expected = {
    'ai-llm-chat-python': [/anthropic>=2/, /groq>=1/, /openai>=3/, /llm_chat\.cli:main/],
    'mcp-server-python': [/mcp>=2/, /mcp_app\.server:main/]
  };
  for (const [id, patterns] of Object.entries(expected)) {
    const template = starters.find(item => item.id === id);
    assert.equal(template.pythonPackage, true);
    for (const environment of ['venv', 'uv']) {
      const options = readProjectOptions(template, { environment, testing: false });
      const project = await createProject(root, `${id}-${environment}`, async (target, parent) => {
        await writeStarter(template, projectName, target, parent);
        await applyProjectOptions(target, template, projectName, options, parent);
      });
      const manifest = await read(project, 'pyproject.toml');
      for (const pattern of patterns) assert.match(manifest, pattern, `${id} ${environment}`);
      assert.match(manifest, new RegExp(`name = "app-${slug}"`));
      const readme = await read(project, 'README.md');
      assert.match(readme, /## Set up/);
      assert.match(readme, /unittest discover -s tests/);
      assert.match(readme, environment === 'uv' ? /uv run python -m / : /python -m (?:llm_chat|mcp_app)/);
      if (environment === 'venv') assert.match(await read(project, 'requirements.txt'), id.startsWith('ai') ? /anthropic>=2/ : /mcp>=2/);
    }
  }
});

test('the LLM chat starters cover Claude, Groq, and OpenAI-compatible providers in both languages', async t => {
  const root = await fixture(t);
  for (const id of ['ai-llm-chat-python', 'ai-llm-chat-typescript']) {
    const project = await generate(root, id);
    const providers = await read(project, id.endsWith('python') ? 'src/llm_chat/providers.py' : 'src/providers.ts');
    for (const name of ['anthropic', 'groq', 'openai', 'together', 'mistral', 'openrouter', 'deepseek', 'xai', 'gemini', 'ollama', 'lmstudio', 'custom']) {
      assert.match(providers, new RegExp(`['"]?${name}['"]?\\s*[:=(]`), `${id} should offer ${name}`);
    }
    // Claude goes through the Anthropic SDK, and Groq through its own SDK, never through an OpenAI shim.
    assert.match(providers, id.endsWith('python') ? /from anthropic import Anthropic/ : /import Anthropic from '@anthropic-ai\/sdk'/);
    assert.match(providers, id.endsWith('python') ? /from groq import Groq/ : /import Groq from 'groq-sdk'/);
    assert.match(providers, /claude-opus-5-5/);
    assert.match(providers, /server-side-fallback-2026-07-01/);
    assert.match(providers, /eager_input_streaming/);
    assert.match(providers, /adaptive/);
    assert.doesNotMatch(providers, /temperature|top_p|top_k|budget_tokens|prefill/, 'removed Claude parameters must not appear');
    assert.doesNotMatch(providers, /sk-ant-|gsk_[A-Za-z0-9]{10}/, 'no keys in source');
  }
});

test('MCP starters expose the same tools, resources, and prompt in both languages', async t => {
  const root = await fixture(t);
  const python = await read(await generate(root, 'mcp-server-python'), 'src/mcp_app/server.py');
  const typescript = await read(await generate(root, 'mcp-server-typescript'), 'src/server.ts');
  for (const name of ['add', 'text_stats', 'slugify']) {
    assert.match(python, new RegExp(`def ${name}\\(`), 'python ' + name);
    assert.match(typescript, new RegExp(`'${name}'`), 'typescript ' + name);
  }
  assert.match(python, /notes:\/\/\{name\}/);
  assert.match(typescript, /notes:\/\/\{name\}/);
  assert.match(python, /read_only_hint=True/);
  assert.match(typescript, /readOnlyHint: true/);
  assert.match(python, /from mcp\.server\.mcpserver import MCPServer/, 'mcp 2.x renamed FastMCP');
  assert.doesNotMatch(python, /fastmcp/i);
  assert.match(typescript, /from '@modelcontextprotocol\/server'/);
  assert.doesNotMatch(typescript, /@modelcontextprotocol\/sdk/, 'the v1 package is not used');
  // Over stdio, stdout carries the protocol. Python may print only to stderr, and TypeScript must not use console.log.
  assert.doesNotMatch(python, /^\s*print\((?![^)]*file=sys\.stderr)/m, 'stdout carries the protocol');
  assert.doesNotMatch(typescript, /console\.log\(/, 'stdout carries the protocol');
});

test('the browser extension builds a manifest for each browser from one source', async t => {
  const root = await fixture(t);
  const project = await generate(root, 'browser-extension');
  assert.match(await read(project, 'README.md'), /Chrome and other Chromium browsers.*Firefox.*Safari/s);
  const firefox = JSON.parse(await read(project, 'manifests/firefox.json'));
  assert.equal(firefox.browser_specific_settings.gecko.id, `${slug}@example.com`);
  assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions, { required: ['none'] });
  assert.equal(JSON.parse(await read(project, 'manifests/chrome.json')).background.service_worker, 'background.js');
  const base = JSON.parse(await read(project, 'manifests/base.json'));
  assert.equal(base.manifest_version, 3);
  assert.equal(base.name, projectName);
  assert.deepEqual(base.permissions, ['storage']);
  assert.equal(JSON.parse(await read(project, 'package.json')).name, slug);
  assert.match(await read(project, 'scripts/safari.mjs'), /process\.platform !== 'darwin'/);
  assert.equal(generatorRegistry().find(entry => entry.id === 'browser-extension').platforms.length, 3);
});

test('the Compose stack keeps secrets out of the file and hardens the API container', async t => {
  const root = await fixture(t);
  const project = await generate(root, 'docker-stack');
  const compose = await read(project, 'compose.yaml');
  assert.match(compose, /POSTGRES_PASSWORD:\?/, 'the password is required and has no default');
  assert.doesNotMatch(compose, /POSTGRES_PASSWORD:-/);
  for (const setting of ['read_only: true', 'cap_drop:', 'no-new-privileges:true', 'condition: service_healthy', 'pg_isready', 'redis-cli']) {
    assert.ok(compose.includes(setting), setting);
  }
  assert.doesNotMatch(compose, /:latest\b/);
  assert.match(compose, /"127\.0\.0\.1:\$\{APP_PORT:-8000\}:8000"/, 'ports are bound to loopback');
  assert.match(await read(project, 'compose.override.yaml'), /127\.0\.0\.1:\$\{DB_PORT:-15432\}:5432/, 'the dev database port avoids 5432');
  assert.match(await read(project, 'Dockerfile'), /USER 10001/);
  const ignored = await read(project, '.gitignore');
  assert.ok(ignored.split('\n').includes('.env'));
  assert.match(await read(project, 'env.example'), /^POSTGRES_PASSWORD=/m);
  assert.doesNotMatch(await read(project, 'app/main.py'), /f".*(?:SELECT|INSERT).*\{/, 'SQL must be parameterized');
});

test('the SAM, CloudFormation, and Bicep starters ship hardened defaults', async t => {
  const root = await fixture(t);
  const sam = await read(await generate(root, 'aws-sam-app'), 'template.yaml');
  for (const setting of ['Transform: AWS::Serverless-2016-10-31', 'DynamoDBCrudPolicy', 'SSEEnabled: true', 'PointInTimeRecoveryEnabled: true', 'PAY_PER_REQUEST', 'RetentionInDays']) {
    assert.ok(sam.includes(setting), 'SAM: ' + setting);
  }
  assert.doesNotMatch(sam, /Action:\s*["']?\*["']?|dynamodb:\*/i, 'no wildcard permissions');
  const cfn = await read(await generate(root, 'cloudformation-aws'), 'template.yaml');
  for (const setting of ['BlockPublicAcls: true', 'RestrictPublicBuckets: true', 'SSEAlgorithm: AES256', 'aws:SecureTransport', 'Status: Enabled', 'BucketOwnerEnforced']) {
    assert.ok(cfn.includes(setting), 'CloudFormation: ' + setting);
  }
  assert.doesNotMatch(cfn, /BucketName:/, 'a fixed bucket name would block a second deployment');
  const bicep = await generate(root, 'azure-bicep');
  const storage = await read(bicep, 'modules/storage.bicep');
  for (const setting of ["minimumTlsVersion: 'TLS1_2'", 'allowBlobPublicAccess: false', 'supportsHttpsTrafficOnly: true', 'isVersioningEnabled: true', "publicAccess: 'None'"]) {
    assert.ok(storage.includes(setting), 'Bicep: ' + setting);
  }
  assert.match(await read(bicep, 'modules/network.bicep'), /access: 'Deny'/);
  assert.match(await read(bicep, 'main.bicepparam'), new RegExp(`param name = '${slug}'`));
});

for (const [id, workflow, variable] of [['cloudformation-aws', 'cloudformation', 'CFN_DEPLOY'], ['azure-bicep', 'bicep', 'BICEP_DEPLOY']]) {
  test(`${id} workflow lints without credentials and gates deployment`, async t => {
    const root = await fixture(t);
    const project = await generate(root, id);
    const text = await read(project, `.github/workflows/${workflow}.yml`);
    assert.doesNotMatch(text, /pull_request_target/);
    assert.match(text, /^permissions:\n {2}contents: read$/m);
    const job = name => {
      const start = text.indexOf(`\n  ${name}:\n`);
      assert.ok(start >= 0, name);
      const next = text.slice(start + 1).search(/\n  [a-z]+:\n/);
      return next < 0 ? text.slice(start) : text.slice(start, start + 1 + next);
    };
    const first = job(id === 'azure-bicep' ? 'build' : 'lint');
    assert.doesNotMatch(first, /secrets\.|vars\.|id-token|environment:/, 'the first job must not use credentials');
    for (const name of ['preview', 'deploy']) {
      const section = job(name);
      assert.ok(section.includes(`vars.${variable} == 'true'`), name + ' is opt-in');
      assert.match(section, /id-token: write/);
    }
    assert.match(job('preview'), /head\.repo\.full_name == github\.repository/, 'forks get no credentials');
    assert.match(job('deploy'), /environment: production/);
    assert.match(job('deploy'), /default_branch/);
    // Repository values reach the shell only through env, never through a ${{ }} expression inside run.
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (!/^\s+run:/.test(line)) return;
      const indent = line.match(/^ */)[0].length;
      const body = [line];
      while (index + 1 < lines.length && (lines[index + 1].trim() === '' || lines[index + 1].match(/^ */)[0].length > indent)) body.push(lines[++index]);
      assert.doesNotMatch(body.join('\n'), /\$\{\{/, 'a ${{ }} expression inside run is a script-injection risk');
    });
    for (const [, action, version] of text.matchAll(/uses: ([\w./-]+)@(\S+)/g)) assert.match(version, /^v\d+$/, action);
  });
}

test('the Worker, SAM, and CLI starters test their own code and document how', async t => {
  const root = await fixture(t);
  const worker = await generate(root, 'cloudflare-worker');
  assert.match(await read(worker, 'README.md'), /WRANGLER_SEND_METRICS=false/);
  assert.match(await read(worker, 'src/index.js'), /export default \{[\s\S]*async fetch\(request, env = \{\}\)/);
  assert.match(await read(worker, 'test/worker.test.js'), /worker\.fetch\(new Request/);
  assert.match(await read(worker, 'wrangler.jsonc'), new RegExp(`"name": "${slug}"`));
  const cli = await generate(root, 'go-cobra-cli');
  assert.match(await read(cli, 'go.mod'), new RegExp(`module example\\.com/${slug}`));
  assert.match(await read(cli, 'README.md'), /go mod tidy/);
  assert.match(await read(cli, 'cmd/root.go'), /func Execute\(args \[\]string, stdout, stderr io\.Writer\) int/);
  const sam = await generate(root, 'aws-sam-app');
  assert.match(await read(sam, 'README.md'), /SAM_CLI_TELEMETRY=0/);
  assert.match(await read(sam, 'samconfig.toml'), new RegExp(`stack_name = "${slug}"`));
  assert.match(await read(sam, 'tests/test_app.py'), /FakeTable/);
});

// --- Run each generated project's own checks where the tools exist -----------------------------------------------

test('generated Python starters pass their own tests', async t => {
  const root = await fixture(t);
  const cases = [
    ['ai-llm-chat-python', ['anthropic', 'groq', 'openai'], 'src'],
    ['mcp-server-python', ['mcp'], 'src'],
    ['aws-sam-app', [], ''],
    ['docker-stack', ['fastapi', 'httpx', 'psycopg_pool', 'redis'], '.']
  ];
  let ran = 0;
  for (const [id, modules, sourceDirectory] of cases) {
    const python = await pythonWith(...modules);
    if (!python) continue;
    await t.test(id, async () => {
      const project = await generate(root, id);
      const env = { ...process.env, PYTHONPATH: path.join(project, sourceDirectory) };
      const { stderr } = await exec(python, ['-m', 'unittest', 'discover', '-s', 'tests'], { cwd: project, env, windowsHide: true, timeout: 300000 });
      assert.match(stderr, /\nOK\s*$/, id);
    });
    ran++;
  }
  if (!ran) t.skip('Set PROJECT_WIZARD_PYTHON to a Python with the SDKs installed (anthropic, groq, openai, mcp, fastapi, httpx, psycopg_pool, redis).');
});

test('generated Node starters install, type-check, and pass their own tests', async t => {
  // npm install downloads packages, so this only runs when PROJECT_WIZARD_ONLINE=1 is set.
  if (!online) return t.skip('Set PROJECT_WIZARD_ONLINE=1 to run npm install in generated projects.');
  if (!await works('npm', ['--version'])) return t.skip('npm is not installed.');
  const root = await fixture(t);
  const shell = process.platform === 'win32';
  for (const [id, commands] of [
    ['ai-llm-chat-typescript', [['run', 'typecheck'], ['test']]],
    ['mcp-server-typescript', [['run', 'typecheck'], ['test'], ['run', 'build']]],
    ['browser-extension', [['test'], ['run', 'build']]],
    ['cloudflare-worker', [['test'], ['run', 'check']]]
  ]) {
    await t.test(id, async () => {
      const project = await generate(root, id);
      const run = args => exec('npm', args, { cwd: project, shell, windowsHide: true, timeout: 600000, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
      await run(['install', '--no-audit', '--no-fund']);
      for (const command of commands) await run(command);
    });
  }
});

test('the generated Cobra CLI passes go vet and go test after go mod tidy', async t => {
  if (!online) return t.skip('Set PROJECT_WIZARD_ONLINE=1 to download Cobra with go mod tidy.');
  if (!await works('go', ['version'])) return t.skip('Go is not installed.');
  const root = await fixture(t);
  const project = await generate(root, 'go-cobra-cli');
  const env = { ...process.env, GOTOOLCHAIN: 'local', GOWORK: 'off' };
  const run = args => exec('go', args, { cwd: project, env, windowsHide: true, timeout: 300000 });
  await run(['mod', 'tidy']);
  await run(['vet', './...']);
  assert.match((await run(['test', '-count=1', './...'])).stdout, /^ok\s+example\.com\/sample-app\/cmd/m);
});

test('cfn-lint accepts the generated CloudFormation and SAM templates when it is installed', async t => {
  if (!await works('cfn-lint', ['--version'])) return t.skip('cfn-lint is not installed.');
  const root = await fixture(t);
  for (const id of ['cloudformation-aws', 'aws-sam-app']) {
    const project = await generate(root, id);
    const { stdout } = await exec('cfn-lint', ['template.yaml'], { cwd: project, windowsHide: true, timeout: 120000 });
    assert.equal(stdout.trim(), '', id);
  }
});

test('sam validate and bicep build accept their templates when the CLIs are installed', async t => {
  const root = await fixture(t);
  let ran = false;
  if (await works('sam', ['--version'])) {
    ran = true;
    const project = await generate(root, 'aws-sam-app');
    const { stdout, stderr } = await exec('sam', ['validate', '--lint'], {
      cwd: project, windowsHide: true, timeout: 120000, env: { ...process.env, AWS_DEFAULT_REGION: 'us-east-1', SAM_CLI_TELEMETRY: '0' }
    });
    assert.match(stdout + stderr, /is a valid SAM Template/);
  }
  if (await works('bicep', ['--version'])) {
    ran = true;
    const project = await generate(root, 'azure-bicep');
    await exec('bicep', ['build', 'main.bicep', '--stdout'], { cwd: project, windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    await exec('bicep', ['lint', 'main.bicep'], { cwd: project, windowsHide: true, timeout: 120000 });
    await exec('bicep', ['build-params', 'main.bicepparam', '--stdout'], { cwd: project, windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  }
  if (!ran) t.skip('Neither sam nor bicep is installed.');
});

test('docker compose accepts the generated stack and requires a password', async t => {
  if (!await works('docker', ['compose', 'version'])) return t.skip('Docker Compose is not installed.');
  const root = await fixture(t);
  const project = await generate(root, 'docker-stack');
  const env = { ...process.env };
  delete env.POSTGRES_PASSWORD;
  await assert.rejects(exec('docker', ['compose', 'config', '--quiet'], { cwd: project, env, windowsHide: true, timeout: 60000 }), /POSTGRES_PASSWORD/);
  const { stdout } = await exec('docker', ['compose', 'config'], { cwd: project, env: { ...env, POSTGRES_PASSWORD: 'x' }, windowsHide: true, timeout: 60000 });
  assert.match(stdout, /condition: service_healthy/);
  assert.match(stdout, /read_only: true/);
});

test('actionlint accepts the new GitHub workflows when it is installed', async t => {
  if (!await works('actionlint', ['-version'])) return t.skip('actionlint is not installed.');
  const root = await fixture(t);
  const workflows = [];
  for (const [id, name] of [['cloudformation-aws', 'cloudformation'], ['azure-bicep', 'bicep']]) {
    workflows.push(path.join(await generate(root, id), `.github/workflows/${name}.yml`));
  }
  assert.equal((await exec('actionlint', ['-no-color', ...workflows], { windowsHide: true, timeout: 60000 })).stdout.trim(), '');
});

test('no starter offers a second generated test example when it already ships tests', () => {
  for (const id of ['go-cobra-cli']) {
    assert.ok(starters.find(template => template.id === id).files.some(file => file.endsWith('_test.go')), id);
  }
  assert.equal(projectOptions(starters.find(template => template.id === 'ai-llm-chat-typescript')), undefined);
});
