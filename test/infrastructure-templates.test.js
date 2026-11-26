const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { promisify } = require('node:util');
const { starters, writeStarter } = require('../src/starters');
const { projectOptions } = require('../src/project-options');
const { createProject } = require('../src/projects');
const { getSetup, templateAvailability, templatesForPlatform } = require('../src/toolchains');
const { generatorRegistry } = require('../clion/generators');
const { enabledTemplates, readCatalogSettings } = require('../src/catalog');

const exec = promisify(execFile);
const projectName = 'Sample Infra';
const slug = 'sample-infra';
const terraformIds = ['terraform-aws', 'terraform-gcp', 'terraform-azure', 'terraform-linode'];
const infrastructureIds = [...terraformIds, 'kubernetes-kustomize', 'helm-chart', 'ansible-playbook'];

async function fixture(t) {
  const temp = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temp, 'project-wizard-infra-'));
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

async function files(directory, base = directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ?
    files(path.join(directory, entry.name), base) : [path.relative(base, path.join(directory, entry.name)).replaceAll('\\', '/')]));
  return nested.flat().sort();
}

const read = (project, file) => fs.readFile(path.join(project, file), 'utf8');

async function available(command, args) {
  try {
    await exec(command, args, { windowsHide: true, timeout: 30000 });
    return true;
  } catch {
    return false;
  }
}

function balanced(text) {
  const stripped = text.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/#.*$/gm, '');
  let depth = 0;
  for (const character of stripped) {
    if ('{[('.includes(character)) depth++;
    if ('}])'.includes(character)) depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

test('lists every infrastructure starter once, in the Infrastructure group, in both IDEs', () => {
  for (const id of infrastructureIds) {
    const matches = starters.filter(template => template.id === id);
    assert.equal(matches.length, 1, id);
    assert.equal(matches[0].group, 'infrastructure', id);
    assert.ok(generatorRegistry().some(entry => entry.id === id && entry.group === 'cloud'), id + ' in CLion');
    assert.equal(projectOptions(matches[0]), undefined, id + ' has no extra setup options');
  }
  assert.ok(starters.some(template => template.id === 'terraform-infrastructure'), 'the original layout starter remains');
  const ids = starters.map(template => template.id);
  assert.equal(new Set(ids).size, ids.length, 'template IDs must be unique');
});

test('maps each infrastructure starter to the CLI it needs and keeps Ansible off native Windows', () => {
  const byId = new Map(starters.map(template => [template.id, template]));
  for (const id of terraformIds) {
    assert.deepEqual(byId.get(id).tools, ['terraform'], id);
    assert.equal(templateAvailability(byId.get(id), {}, 'linux').missing[0].id, 'terraform');
    assert.equal(templateAvailability(byId.get(id), { terraform: { usable: true } }, 'win32').ready, true);
    assert.equal(templateAvailability(byId.get(id), { terraform: { usable: false } }, 'linux').ready, false);
  }
  for (const [id, tool] of [['kubernetes-kustomize', 'kubectl'], ['helm-chart', 'helm'], ['ansible-playbook', 'ansible']]) {
    assert.deepEqual(byId.get(id).tools, [tool], id);
    assert.equal(templateAvailability(byId.get(id), {}, 'linux').missing[0].id, tool);
    assert.equal(templateAvailability(byId.get(id), { [tool]: { usable: true } }, 'linux').ready, true);
    assert.equal(templateAvailability(byId.get(id), { [tool]: { usable: false } }, 'linux').ready, false);
  }
  const ansible = byId.get('ansible-playbook');
  assert.equal(templateAvailability(ansible, { ansible: { usable: true } }, 'win32').supported, false);
  assert.equal(templateAvailability(ansible, { ansible: { usable: true } }, 'darwin').ready, true);
  assert.deepEqual(templatesForPlatform(starters, 'win32').filter(template => template.id === 'ansible-playbook'), []);
  for (const platform of ['linux', 'darwin']) {
    assert.equal(templatesForPlatform(starters, platform).filter(template => infrastructureIds.includes(template.id)).length, infrastructureIds.length);
  }
});

test('offers install help for kubectl, Helm, and Ansible', () => {
  assert.match(getSetup('kubectl', 'win32', 'windows').command, /winget install .*Kubernetes\.kubectl/);
  assert.match(getSetup('kubectl', 'darwin', 'macos').command, /brew install kubectl/);
  assert.match(getSetup('helm', 'win32', 'windows').command, /winget install .*Helm\.Helm/);
  assert.match(getSetup('helm', 'darwin', 'macos').command, /brew install helm/);
  assert.match(getSetup('ansible', 'darwin', 'macos').command, /brew install ansible/);
  assert.equal(getSetup('ansible', 'linux').command, undefined);
  for (const id of ['kubectl', 'helm', 'ansible']) assert.match(getSetup(id, 'linux').url, /^https:\/\//);
});

test('the Infrastructure category can be hidden by language without hiding the others', () => {
  const templates = templatesForPlatform(starters, 'linux');
  const visible = enabledTemplates(templates, readCatalogSettings({ disabledLanguages: ['Kubernetes', 'Helm', 'Ansible'] }));
  const ids = visible.map(template => template.id);
  for (const id of ['kubernetes-kustomize', 'helm-chart', 'ansible-playbook']) assert.ok(!ids.includes(id), id);
  for (const id of terraformIds) assert.ok(ids.includes(id), id);
});

for (const id of terraformIds) {
  test(`${id} generates a complete Terraform root with a plan-time test suite`, async t => {
    const root = await fixture(t);
    const project = await generate(root, id);
    const generated = await files(project);
    assert.deepEqual(generated, [
      '.github/workflows/terraform.yml', '.gitignore', 'README.md', 'SETUP.md', 'backend.hcl.example', 'backend.tf.example',
      'ci/bitbucket-pipelines.yml', 'ci/gitlab-ci.yml', 'main.tf', 'outputs.tf',
      'terraform.tfvars.example', 'tests/main.tftest.hcl', 'variables.tf', 'versions.tf'
    ]);
    for (const file of generated.filter(file => /\.(tf|hcl|example)$/.test(file))) {
      assert.ok(balanced(await read(project, file)), file + ' should have balanced brackets');
    }
    const versions = await read(project, 'versions.tf');
    assert.match(versions, /required_version = ">= 1\.9"/);
    assert.match(versions, /source\s+= "hashicorp\/random"/);
    assert.match(versions, /version\s+= "(?:~> \d|>= \d)/, 'providers should be version constrained');
    // The backend is documented but must not be active, so the first plan works without remote state.
    assert.match(await read(project, 'backend.tf.example'), /^terraform \{\n\s+backend "\w+" \{\}/m);
    assert.doesNotMatch(await read(project, 'main.tf') + versions, /backend "/);
    assert.match(await read(project, 'variables.tf'), new RegExp('default\\s+= "' + slug + '"'));
    assert.match(await read(project, 'terraform.tfvars.example'), new RegExp('"' + slug + '"'));
    const readme = await read(project, 'README.md');
    for (const command of ['terraform fmt -check', 'terraform validate', 'terraform test', 'terraform init -backend=false']) {
      assert.ok(readme.includes(command), id + ' README should document ' + command);
    }
    assert.match(readme, /^# Sample Infra$/m);
    const gitignore = await read(project, '.gitignore');
    for (const pattern of ['*.tfstate', '**/.terraform/', '*.tfvars', 'backend.hcl']) assert.ok(gitignore.includes(pattern), pattern);
    assert.ok(!gitignore.includes('.terraform.lock.hcl'), 'the lock file should be committed');
    await assert.rejects(fs.stat(path.join(project, 'backend.tf')), { code: 'ENOENT' });
  });

  test(`${id} tests run on mock providers and cover both valid and invalid input`, async t => {
    const root = await fixture(t);
    const project = await generate(root, id);
    const suite = await read(project, 'tests/main.tftest.hcl');
    const providers = [...suite.matchAll(/^mock_provider "(\w+)"/gm)].map(match => match[1]);
    assert.ok(providers.length >= 2, 'mock the cloud provider and random');
    assert.ok(providers.includes('random'));
    const providerSource = await read(project, 'versions.tf');
    for (const provider of providers) assert.ok(providerSource.includes(`source  = "`) && new RegExp(`^    ${provider} = \\{`, 'm').test(providerSource), provider);
    const runs = suite.match(/^run "\w+" \{/gm) || [];
    assert.ok(runs.length >= 4, id + ' should have at least four runs');
    assert.ok(/command = plan/.test(suite) && !/command = apply/.test(suite), 'tests must not create real resources');
    assert.ok((suite.match(/expect_failures = \[var\.\w+\]/g) || []).length >= 2, 'validation should be tested');
    const assertions = suite.match(/^\s+assert \{/gm) || [];
    const messages = suite.match(/error_message = "/g) || [];
    assert.ok(assertions.length >= 4);
    assert.equal(messages.length, assertions.length, 'every assertion needs an error message');
    assert.ok(balanced(suite));
    // Each variable that a test expects to fail must have a validation block.
    const variables = await read(project, 'variables.tf');
    for (const [, name] of suite.matchAll(/expect_failures = \[var\.(\w+)\]/g)) {
      const block = variables.match(new RegExp('variable "' + name + '" \\{[\\s\\S]*?\\n\\}\\n'));
      assert.ok(block && /validation \{/.test(block[0]), 'var.' + name + ' needs a validation block');
    }
  });
}

test('Terraform starters keep storage private and encrypted or versioned on every cloud', async t => {
  const root = await fixture(t);
  const aws = await read(await generate(root, 'terraform-aws'), 'main.tf');
  for (const setting of ['block_public_acls       = true', 'block_public_policy     = true', 'ignore_public_acls      = true',
    'restrict_public_buckets = true', 'status = "Enabled"', 'sse_algorithm = "AES256"']) {
    assert.ok(aws.includes(setting), 'AWS: ' + setting);
  }
  const gcp = await read(await generate(root, 'terraform-gcp'), 'main.tf');
  for (const setting of ['uniform_bucket_level_access = true', 'public_access_prevention    = "enforced"', 'enabled = true',
    'private_ip_google_access = true', 'auto_create_subnetworks = false']) {
    assert.ok(gcp.includes(setting), 'GCP: ' + setting);
  }
  assert.ok(gcp.includes('35.235.240.0/20'), 'GCP SSH should be limited to Identity-Aware Proxy');
  assert.doesNotMatch(gcp, /0\.0\.0\.0\/0/);
  const azure = await read(await generate(root, 'terraform-azure'), 'main.tf');
  for (const setting of ['min_tls_version                 = "TLS1_2"', 'allow_nested_items_to_be_public = false',
    'versioning_enabled = true', 'container_access_type = "private"', 'access                     = "Deny"']) {
    assert.ok(azure.includes(setting), 'Azure: ' + setting);
  }
  const linodeProject = await generate(root, 'terraform-linode');
  const linode = await read(linodeProject, 'main.tf');
  assert.ok(linode.includes('inbound_policy  = "DROP"'));
  assert.doesNotMatch(linode, /0\.0\.0\.0\/0|::\/0/, 'SSH must not be open to the world');
  assert.match(await read(linodeProject, 'variables.tf'),
    /variable "ssh_allowed_cidrs" \{[^}]*\n\s+type\s+= list\(string\)\n\n\s+validation/);
});

test('Terraform starters do not hard-code credentials and keep sensitive values out of examples', async t => {
  const root = await fixture(t);
  const projects = new Map();
  for (const id of terraformIds) {
    const project = await generate(root, id);
    projects.set(id, project);
    for (const file of await files(project)) {
      const text = await read(project, file);
      assert.doesNotMatch(text, /AKIA[0-9A-Z]{16}/, file);
      assert.doesNotMatch(text, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, file);
      assert.doesNotMatch(text, /^\s*(?:access_key|secret_key|client_secret|token|password)\s*=\s*"[^"]+"/mi, file);
    }
  }
  const linode = projects.get('terraform-linode');
  assert.match(await read(linode, 'terraform.tfvars.example'), /203\.0\.113\./, 'use a documentation address, not a real one');
  assert.match(await read(linode, 'versions.tf'), /LINODE_TOKEN/);
});

test('names that start with a digit still produce valid Google Cloud and Terraform inputs', async t => {
  const root = await fixture(t);
  const project = await createProject(root, 'gcp-digits', (target, parent) =>
    writeStarter(starters.find(template => template.id === 'terraform-gcp'), '9 Cloud App', target, parent));
  assert.match(await read(project, 'variables.tf'), /default\s+= "9-cloud-app"/);
  assert.match(await read(project, 'main.tf'), /can\(regex\("\^\[a-z\]", local\.short_prefix\)\) \? local\.short_prefix : "p-\$\{local\.short_prefix\}"/);
  assert.match(await read(project, 'tests/main.tftest.hcl'), /== "p-9-app-dev-network"/);
});

test('Terraform starters validate and pass terraform test when the CLI and network are available', async t => {
  // `terraform init` downloads providers, so this check only runs when PROJECT_WIZARD_TERRAFORM=1 is set.
  if (process.env.PROJECT_WIZARD_TERRAFORM !== '1') return t.skip('Set PROJECT_WIZARD_TERRAFORM=1 to run Terraform.');
  if (!await available('terraform', ['version'])) return t.skip('Terraform is not installed.');
  const root = await fixture(t);
  for (const id of terraformIds) {
    await t.test(id, async () => {
      const project = await generate(root, id);
      const run = args => exec('terraform', args, { cwd: project, windowsHide: true, timeout: 600000,
        env: { ...process.env, TF_IN_AUTOMATION: '1', TF_INPUT: '0' } });
      await run(['fmt', '-check', '-recursive']);
      await run(['init', '-backend=false']);
      await run(['validate']);
      const { stdout } = await run(['test']);
      assert.match(stdout, /Success!/);
    });
  }
});

test('the Kubernetes starter has a base, dev and prod overlays, and a hardened workload', async t => {
  const root = await fixture(t);
  const project = await generate(root, 'kubernetes-kustomize');
  assert.deepEqual(await files(project), [
    'README.md', 'k8s/base/deployment.yaml', 'k8s/base/kustomization.yaml', 'k8s/base/networkpolicy.yaml',
    'k8s/base/poddisruptionbudget.yaml', 'k8s/base/service.yaml', 'k8s/base/serviceaccount.yaml',
    'k8s/overlays/dev/kustomization.yaml', 'k8s/overlays/dev/namespace.yaml',
    'k8s/overlays/prod/horizontalpodautoscaler.yaml', 'k8s/overlays/prod/kustomization.yaml', 'k8s/overlays/prod/namespace.yaml'
  ]);
  const deployment = await read(project, 'k8s/base/deployment.yaml');
  for (const setting of ['runAsNonRoot: true', 'allowPrivilegeEscalation: false', 'readOnlyRootFilesystem: true',
    '- ALL', 'type: RuntimeDefault', 'automountServiceAccountToken: false', 'readinessProbe:', 'livenessProbe:', 'memory: 128Mi']) {
    assert.ok(deployment.includes(setting), setting);
  }
  assert.doesNotMatch(deployment, /privileged: true|:latest\b/);
  for (const environment of ['dev', 'prod']) {
    assert.match(await read(project, `k8s/overlays/${environment}/kustomization.yaml`), new RegExp(`^namespace: ${environment}$`, 'm'));
    assert.match(await read(project, `k8s/overlays/${environment}/namespace.yaml`), /pod-security\.kubernetes\.io\/enforce: restricted/);
  }
  const base = await read(project, 'k8s/base/kustomization.yaml');
  for (const resource of ['serviceaccount.yaml', 'deployment.yaml', 'service.yaml', 'poddisruptionbudget.yaml', 'networkpolicy.yaml']) {
    assert.ok(base.includes('- ' + resource), 'base should include ' + resource);
  }
  assert.ok(!base.includes('horizontalpodautoscaler'), 'only prod autoscales');
  assert.match(await read(project, 'README.md'), /kubectl kustomize k8s\/overlays\/dev/);
});

test('kubectl renders the Kubernetes overlays with their per-environment differences', async t => {
  if (!await available('kubectl', ['version', '--client'])) return t.skip('kubectl is not installed.');
  const root = await fixture(t);
  const project = await generate(root, 'kubernetes-kustomize');
  const render = async overlay => (await exec('kubectl', ['kustomize', overlay], { cwd: project, windowsHide: true, timeout: 60000 })).stdout;
  const [base, dev, prod] = await Promise.all([render('k8s/base'), render('k8s/overlays/dev'), render('k8s/overlays/prod')]);
  const kinds = output => (output.match(/^kind: (\w+)$/gm) || []).map(line => line.slice(6)).sort();
  assert.deepEqual(kinds(base), ['Deployment', 'NetworkPolicy', 'PodDisruptionBudget', 'Service', 'ServiceAccount']);
  assert.deepEqual(kinds(dev), ['Deployment', 'Namespace', 'NetworkPolicy', 'PodDisruptionBudget', 'Service', 'ServiceAccount']);
  assert.deepEqual(kinds(prod), ['Deployment', 'HorizontalPodAutoscaler', 'Namespace', 'NetworkPolicy',
    'PodDisruptionBudget', 'Service', 'ServiceAccount']);
  assert.match(base, /replicas: 2/);
  assert.match(dev, /replicas: 1/);
  assert.match(prod, /replicas: 3/);
  assert.match(dev, /app\.kubernetes\.io\/environment: dev/);
  assert.match(prod, /app\.kubernetes\.io\/environment: prod/);
  assert.equal((dev.match(/namespace: dev/g) || []).length, 5, 'every namespaced dev resource is in the dev namespace');
  assert.doesNotMatch(dev, /namespace: prod/);
  // Selectors must keep matching the pod labels after the environment label is added.
  assert.match(dev, /selector:\n\s+matchLabels:\n\s+app\.kubernetes\.io\/name: web\n\s+template:/);
});

test('the Helm starter has a chart whose helpers, values, and schema agree', async t => {
  const root = await fixture(t);
  const project = await generate(root, 'helm-chart');
  assert.deepEqual(await files(project), [
    'README.md', 'chart/.helmignore', 'chart/Chart.yaml', 'chart/templates/NOTES.txt', 'chart/templates/_helpers.tpl',
    'chart/templates/deployment.yaml', 'chart/templates/hpa.yaml', 'chart/templates/ingress.yaml',
    'chart/templates/service.yaml', 'chart/templates/serviceaccount.yaml', 'chart/templates/tests/test-connection.yaml',
    'chart/values.schema.json', 'chart/values.yaml'
  ]);
  const chart = await read(project, 'chart/Chart.yaml');
  assert.match(chart, /^apiVersion: v2$/m);
  assert.match(chart, new RegExp('^name: ' + slug + '$', 'm'));
  assert.match(chart, /^type: application$/m);
  assert.match(chart, /^version: 0\.1\.0$/m);
  const helpers = await read(project, 'chart/templates/_helpers.tpl');
  const defined = new Set([...helpers.matchAll(/define "([\w.]+)"/g)].map(match => match[1]));
  assert.deepEqual([...defined].sort(), ['app.chart', 'app.fullname', 'app.labels', 'app.name', 'app.selectorLabels', 'app.serviceAccountName']);
  for (const file of (await files(path.join(project, 'chart'))).filter(file => file.startsWith('templates/'))) {
    const text = await read(project, 'chart/' + file);
    assert.equal((text.match(/\{\{/g) || []).length, (text.match(/\}\}/g) || []).length, file + ' delimiters');
    for (const [, name] of text.matchAll(/include "([\w.]+)"/g)) assert.ok(defined.has(name), `${file} includes undefined ${name}`);
  }
  const values = await read(project, 'chart/values.yaml');
  const schema = JSON.parse(await read(project, 'chart/values.schema.json'));
  assert.deepEqual(schema.properties.image.required, ['repository', 'tag']);
  for (const key of Object.keys(schema.properties)) assert.match(values, new RegExp('^' + key + ':', 'm'), key + ' should have defaults');
  const used = new Set();
  for (const file of (await files(path.join(project, 'chart'))).filter(file => file.startsWith('templates/'))) {
    for (const [, key] of (await read(project, 'chart/' + file)).matchAll(/\.Values\.(\w+)/g)) used.add(key);
  }
  for (const key of used) assert.match(values, new RegExp('^' + key + ':', 'm'), `.Values.${key} needs a default`);
  assert.doesNotMatch(values, /tag: ["']?latest/);
  for (const setting of ['runAsNonRoot: true', 'allowPrivilegeEscalation: false', 'readOnlyRootFilesystem: true']) {
    assert.ok(values.includes(setting), setting);
  }
  const test = await read(project, 'chart/templates/tests/test-connection.yaml');
  assert.match(test, /"helm\.sh\/hook": test/);
  assert.match(await read(project, 'README.md'), /helm lint chart/);
});

test('Helm lints and renders the chart with default and optional resources when Helm is installed', async t => {
  if (!await available('helm', ['version', '--short'])) return t.skip('Helm is not installed.');
  const root = await fixture(t);
  const project = await generate(root, 'helm-chart');
  const helm = args => exec('helm', args, { cwd: project, windowsHide: true, timeout: 60000 });
  const lint = await helm(['lint', 'chart']);
  assert.match(lint.stdout, /0 chart\(s\) failed/);
  const kinds = output => (output.match(/^kind: (\w+)$/gm) || []).sort();
  const defaults = (await helm(['template', 'demo', 'chart'])).stdout;
  assert.deepEqual(kinds(defaults), ['kind: Deployment', 'kind: Pod', 'kind: Service', 'kind: ServiceAccount']);
  assert.match(defaults, /replicas: 2/);
  const everything = (await helm(['template', 'demo', 'chart', '--set', 'ingress.enabled=true', '--set', 'autoscaling.enabled=true'])).stdout;
  assert.deepEqual(kinds(everything), ['kind: Deployment', 'kind: HorizontalPodAutoscaler', 'kind: Ingress', 'kind: Pod',
    'kind: Service', 'kind: ServiceAccount']);
  assert.doesNotMatch(everything, /replicas:/, 'autoscaling owns the replica count');
  const invalid = await helm(['template', 'demo', 'chart', '--set', 'service.port=70000']).then(() => undefined, error => error);
  assert.ok(invalid, 'the values schema should reject an invalid port');
  assert.match(invalid.stderr, /service/);
});

test('the Ansible starter wires roles to the inventory and uses fully qualified modules', async t => {
  const root = await fixture(t);
  const project = await generate(root, 'ansible-playbook');
  assert.deepEqual(await files(project), [
    '.gitignore', 'README.md', 'ansible.cfg', 'inventory/group_vars/all.yml', 'inventory/hosts.yml', 'requirements.yml',
    'roles/common/defaults/main.yml', 'roles/common/tasks/main.yml', 'roles/webserver/defaults/main.yml',
    'roles/webserver/tasks/main.yml', 'roles/webserver/templates/index.html.j2', 'site.yml'
  ]);
  const playbook = await read(project, 'site.yml');
  const roles = [...playbook.matchAll(/^\s+- (\w+)$/gm)].map(match => match[1]);
  assert.deepEqual(roles, ['common', 'webserver']);
  for (const role of roles) assert.ok((await fs.stat(path.join(project, 'roles', role, 'tasks/main.yml'))).isFile(), role);
  assert.match(playbook, /hosts: webservers/);
  assert.match(await read(project, 'inventory/hosts.yml'), /webservers:\n\s+hosts:/);
  assert.match(await read(project, 'inventory/group_vars/all.yml'), /site_name: "Sample Infra"/);
  const modules = [];
  for (const role of roles) {
    const tasks = await read(project, `roles/${role}/tasks/main.yml`);
    assert.match(tasks, /^---\n/, role + ' should start with a document marker');
    const roleModules = [...tasks.matchAll(/^  ((?:ansible\.builtin|community\.general)\.\w+):$/gm)].map(match => match[1]);
    assert.equal(roleModules.length, (tasks.match(/^- name: /gm) || []).length, role + ': each task needs one FQCN module');
    modules.push(...roleModules);
    const defaults = await read(project, `roles/${role}/defaults/main.yml`);
    for (const [, variable] of defaults.matchAll(/^(\w+):/gm)) assert.ok(variable.startsWith(role + '_'), `${variable} should be prefixed with ${role}_`);
  }
  assert.ok(modules.includes('community.general.ufw'));
  assert.match(await read(project, 'requirements.yml'), /name: community\.general/);
  assert.match(await read(project, 'roles/common/defaults/main.yml'), /common_firewall_allowed_ports:\n\s+- "22"/);
  // The firewall denies other inbound traffic, so the web role must open HTTP itself.
  assert.match(await read(project, 'roles/webserver/tasks/main.yml'), /community\.general\.ufw:\n\s+rule: allow\n\s+port: "80"/);
  assert.match(await read(project, 'ansible.cfg'), /^inventory = inventory\/hosts\.yml$/m);
  assert.doesNotMatch(await read(project, 'inventory/hosts.yml'), /password|ansible_ssh_pass/i);
  assert.ok((await read(project, '.gitignore')).includes('.vault_pass'));
});

test('ansible-playbook accepts the generated playbook when Ansible and its collection are installed', async t => {
  if (!await available('ansible-playbook', ['--version'])) return t.skip('Ansible is not installed.');
  if (!await available('ansible-doc', ['community.general.ufw'])) return t.skip('The community.general collection is not installed.');
  const root = await fixture(t);
  const project = await generate(root, 'ansible-playbook');
  const { stdout } = await exec('ansible-playbook', ['site.yml', '--syntax-check'], {
    cwd: project, windowsHide: true, timeout: 120000, env: { ...process.env, ANSIBLE_CONFIG: path.join(project, 'ansible.cfg') }
  });
  assert.match(stdout, /playbook: site\.yml/);
});

// --- Setup guides and CI pipelines for the Terraform starters ---------------------------------------------------

const allTerraformIds = [...terraformIds, 'terraform-infrastructure'];
const providerCredentials = {
  'terraform-aws': { github: ['AWS_ROLE_ARN', 'AWS_REGION'], gitlab: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'], oidc: true },
  'terraform-gcp': { github: ['GCP_WORKLOAD_IDENTITY_PROVIDER', 'GCP_SERVICE_ACCOUNT'], gitlab: ['GOOGLE_CREDENTIALS'], oidc: true },
  'terraform-azure': { github: ['AZURE_CLIENT_ID', 'AZURE_TENANT_ID', 'AZURE_SUBSCRIPTION_ID'], gitlab: ['ARM_CLIENT_ID', 'ARM_CLIENT_SECRET'], oidc: true },
  'terraform-linode': { github: ['LINODE_TOKEN', 'LINODE_OBJECT_STORAGE_ACCESS_KEY', 'LINODE_OBJECT_STORAGE_SECRET_KEY'], gitlab: ['LINODE_TOKEN', 'AWS_ACCESS_KEY_ID'], oidc: false },
  'terraform-infrastructure': { github: ['AZURE_CLIENT_ID', 'AZURE_TENANT_ID', 'AZURE_SUBSCRIPTION_ID'], gitlab: ['ARM_CLIENT_ID', 'ARM_CLIENT_SECRET'], oidc: true }
};

// Returns the text of every `run:` step, so a test can check exactly what the shell receives.
function runBlocks(workflow) {
  const lines = workflow.split('\n');
  const blocks = [];
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^(\s*)(?:- )?run:\s*(.*)$/);
    if (!match) continue;
    if (!/^[|>][+-]?$/.test(match[2])) {
      blocks.push(match[2]);
      continue;
    }
    const body = [];
    while (index + 1 < lines.length && (lines[index + 1].trim() === '' || lines[index + 1].match(/^ */)[0].length > match[1].length)) {
      body.push(lines[++index]);
    }
    blocks.push(body.join('\n'));
  }
  return blocks;
}

// Returns one job's text from a GitHub workflow.
function job(workflow, name) {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  assert.ok(start >= 0, 'missing job ' + name);
  const next = workflow.slice(start + 1).search(/\n  [a-z]+:\n/);
  return next < 0 ? workflow.slice(start) : workflow.slice(start, start + 1 + next);
}

for (const id of allTerraformIds) {
  test(`${id} ships a setup guide that covers tools, permissions, remote state, CI, and troubleshooting`, async t => {
    const root = await fixture(t);
    const project = await generate(root, id);
    const setup = await read(project, 'SETUP.md');
    assert.match(setup, /^# Setup requirements: Sample Infra/m);
    assert.doesNotMatch(setup, /__PROJECT_/, 'tokens should be replaced');
    for (const heading of [/^## Tools$/m, /^## Create the state (?:bucket|storage) \(once\)$/m, /^## Continuous integration$/m, /^## Troubleshooting$/m]) {
      assert.match(setup, heading, id);
    }
    assert.match(setup, /Terraform\]\(https:\/\/developer\.hashicorp\.com\/terraform\/install\) \| 1\.9 or newer/);
    assert.match(setup, /backend\.tf\.example/);
    assert.match(setup, /terraform init -backend-config=backend\.hcl -migrate-state/);
    for (const name of ['TF_BACKEND_CONFIG', 'TF_VARS', 'TERRAFORM_DEPLOY']) assert.ok(setup.includes(name), id + ' guide should explain ' + name);
    for (const file of ['.github/workflows/terraform.yml', 'ci/gitlab-ci.yml', 'ci/bitbucket-pipelines.yml']) assert.ok(setup.includes(file), file);
    assert.match(await read(project, 'README.md'), /\[SETUP\.md\]\(SETUP\.md\)/, 'the README should point to the guide');
    // Every credential name the pipelines read must be explained, so setup never leaves one out.
    const workflow = await read(project, '.github/workflows/terraform.yml');
    const used = [...workflow.matchAll(/(?:vars|secrets)\.(\w+)/g)].map(match => match[1]);
    assert.ok(used.length >= 3);
    for (const name of used) assert.ok(setup.includes(name), `${id} SETUP.md should mention ${name}`);
    const gitlab = await read(project, 'ci/gitlab-ci.yml');
    const bitbucket = await read(project, 'ci/bitbucket-pipelines.yml');
    for (const name of providerCredentials[id].gitlab) {
      assert.ok(setup.includes(name), `${id} SETUP.md should mention ${name}`);
      assert.ok(gitlab.includes('#   ' + name), `${id} GitLab file should list ${name}`);
      assert.ok(bitbucket.includes('#   ' + name), `${id} Bitbucket file should list ${name}`);
    }
  });

  test(`${id} GitHub workflow checks without credentials and gates deployment`, async t => {
    const root = await fixture(t);
    const project = await generate(root, id);
    const workflow = await read(project, '.github/workflows/terraform.yml');
    const { github, oidc } = providerCredentials[id];
    assert.match(workflow, /^name: Terraform$/m);
    assert.match(workflow, /^on:\n {2}pull_request:/m);
    assert.doesNotMatch(workflow, /pull_request_target/, 'untrusted code must never run with secrets');
    assert.match(workflow, /^permissions:\n {2}contents: read$/m, 'the default token should be read-only');
    assert.equal(/id-token: write/.test(workflow), oidc, 'only OIDC providers should be able to request an identity token');
    // The check job runs the same commands as a local run and has no credentials.
    const check = job(workflow, 'check');
    for (const command of ['terraform fmt -check -recursive', 'terraform init -backend=false', 'terraform validate', 'terraform test']) {
      assert.ok(check.includes(command), id + ' check should run ' + command);
    }
    assert.doesNotMatch(check, /secrets\.|vars\.|id-token|environment:/, 'the check job must not use credentials');
    // Plan and Apply are opt-in, ordered, and never run for a fork.
    const plan = job(workflow, 'plan');
    assert.match(plan, /needs: check/);
    assert.match(plan, /vars\.TERRAFORM_DEPLOY == 'true'/);
    assert.match(plan, /head\.repo\.full_name == github\.repository/, 'forks must not receive credentials');
    assert.match(plan, /backend\.tf/, 'the plan must refuse to run without remote state');
    assert.match(plan, /terraform plan -lock-timeout=5m -out=tfplan/);
    assert.match(plan, /retention-days: 1/);
    const apply = job(workflow, 'apply');
    assert.match(apply, /needs: plan/);
    assert.match(apply, /github\.event_name == 'push'/);
    assert.match(apply, /default_branch/, 'apply runs only from the default branch');
    assert.match(apply, /environment: production/, 'an environment lets you require approval');
    assert.match(apply, /terraform apply -lock-timeout=5m tfplan/, 'apply uses the reviewed plan file');
    assert.doesNotMatch(apply, /-auto-approve/);
    for (const name of github) {
      const scope = name.startsWith('LINODE_') ? 'secrets' : 'vars';
      assert.ok(workflow.includes(`${scope}.${name}`), `${id} workflow should read ${scope}.${name}`);
    }
    assert.match(workflow, /terraform_wrapper: false/);
    assert.match(workflow, /hashicorp\/setup-terraform@v3/);
    for (const [, action, version] of workflow.matchAll(/uses: ([\w./-]+)@(\S+)/g)) {
      assert.match(version, /^v\d+$/, action + ' should use a major version tag');
    }
  });

  test(`${id} workflow never interpolates repository values into shell commands`, async t => {
    const root = await fixture(t);
    const project = await generate(root, id);
    const workflow = await read(project, '.github/workflows/terraform.yml');
    const blocks = runBlocks(workflow);
    assert.ok(blocks.length >= 8, 'expected the run steps to be found');
    for (const block of blocks) {
      assert.doesNotMatch(block, /\$\{\{/, 'a ${{ }} expression inside run is a script-injection risk:\n' + block);
    }
    // Repository variables reach the shell through env, and are then written out as data.
    assert.match(workflow, /TF_BACKEND_CONFIG: \$\{\{ vars\.TF_BACKEND_CONFIG \}\}/);
    assert.match(workflow, /printf '%s\\n' "\$\{TF_BACKEND_CONFIG:-\}" > backend\.hcl/);
    assert.match(workflow, /ci\.auto\.tfvars\.json/);
  });

  test(`${id} GitLab and Bitbucket examples run the same checks and make deployment opt-in`, async t => {
    const root = await fixture(t);
    const project = await generate(root, id);
    const gitlab = await read(project, 'ci/gitlab-ci.yml');
    const bitbucket = await read(project, 'ci/bitbucket-pipelines.yml');
    assert.match(gitlab, /^# GitLab CI example\. Copy this file to \.gitlab-ci\.yml/m);
    assert.match(bitbucket, /^# Bitbucket Pipelines example\. Copy this file to bitbucket-pipelines\.yml/m);
    for (const file of [gitlab, bitbucket]) {
      for (const command of ['terraform fmt -check -recursive', 'terraform init -backend=false', 'terraform validate', 'terraform test',
        'terraform plan -lock-timeout=5m -out=tfplan', 'terraform apply -lock-timeout=5m tfplan']) {
        assert.ok(file.includes(command), id + ' should run ' + command);
      }
      assert.match(file, /hashicorp\/terraform:1\.\d+/, 'use the official image with a version tag');
      assert.doesNotMatch(file, /:latest|-auto-approve/);
      assert.match(file, /backend\.tf/, 'refuse to deploy without remote state');
      assert.ok(file.includes('TERRAFORM_DEPLOY'));
      assert.match(file, /TF_BACKEND_CONFIG:-/);
    }
    assert.match(gitlab, /entrypoint: \[""\]/, 'the Terraform image needs its entrypoint cleared in GitLab');
    assert.match(gitlab, /resource_group: terraform-state/, 'plan and apply must not run at the same time');
    assert.match(gitlab, /when: manual/, 'apply waits for a person');
    assert.match(bitbucket, /trigger: manual/);
    assert.match(bitbucket, /deployment: production/);
    assert.match(bitbucket, /"\*\*":\n\s+- step: \*check/, 'pull requests run the check');
    // Deployment steps do nothing unless it is switched on.
    assert.match(bitbucket, /\[ "\$\{TERRAFORM_DEPLOY:-\}" != "true" \]/);
    assert.match(gitlab, /\$TERRAFORM_DEPLOY == "true"/);
  });
}

test('Terraform CI files for the layout starter run in infra/envs/dev and format the whole infra folder', async t => {
  const root = await fixture(t);
  const project = await generate(root, 'terraform-infrastructure');
  const workflow = await read(project, '.github/workflows/terraform.yml');
  assert.match(workflow, /defaults:\n {2}run:\n {4}working-directory: infra\/envs\/dev/);
  assert.match(workflow, /terraform fmt -check -recursive \.\.\/\.\./);
  assert.match(workflow, /path: infra\/envs\/dev\/tfplan/, 'the artifact path is relative to the repository root');
  assert.match(await read(project, 'ci/gitlab-ci.yml'), /TF_ROOT: infra\/envs\/dev/);
  assert.match(await read(project, 'ci/bitbucket-pipelines.yml'), /cd infra\/envs\/dev/);
  assert.match(await read(project, 'SETUP.md'), /no cloud account, credentials, or provider downloads/);
});

test('the Linode pipelines queue every run because its state backend cannot lock', async t => {
  const root = await fixture(t);
  const project = await generate(root, 'terraform-linode');
  const workflow = await read(project, '.github/workflows/terraform.yml');
  assert.match(workflow, /group: terraform-linode-state\n\s+cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /id-token/);
  assert.match(await read(project, 'SETUP.md'), /does not lock state/);
  const other = await generate(root, 'terraform-aws');
  assert.match(await read(other, '.github/workflows/terraform.yml'), /group: terraform-\$\{\{ github\.ref \}\}/);
});

test('the workflow sources are stored without a dot folder, so packaging can never drop them', async () => {
  for (const id of allTerraformIds) {
    const template = starters.find(item => item.id === id);
    assert.deepEqual(template.sharedFiles, { ['terraform/' + id + '-github.yml']: '.github/workflows/terraform.yml' });
    const source = path.join(__dirname, '..', 'templates', '_shared', 'terraform', id + '-github.yml');
    assert.ok((await fs.stat(source)).isFile(), source);
    for (const file of ['SETUP.md', 'ci/gitlab-ci.yml', 'ci/bitbucket-pipelines.yml']) assert.ok(template.files.includes(file), id + ' lists ' + file);
  }
});

test('actionlint accepts the generated GitHub workflows when it is installed', async t => {
  if (!await available('actionlint', ['-version'])) return t.skip('actionlint is not installed.');
  const root = await fixture(t);
  const files = [];
  for (const id of allTerraformIds) {
    const project = await generate(root, id);
    files.push(path.join(project, '.github/workflows/terraform.yml'));
  }
  const { stdout } = await exec('actionlint', ['-no-color', ...files], { windowsHide: true, timeout: 60000 });
  assert.equal(stdout.trim(), '');
});
