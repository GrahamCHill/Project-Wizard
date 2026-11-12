const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { replaceTokens } = require('./projects');

const exec = promisify(execFile);
const environments = [
  { id: 'venv', label: 'venv (built-in)', tool: 'python' },
  { id: 'uv', label: 'uv', tool: 'uv' },
  { id: 'conda', label: 'Conda', tool: 'conda' },
  { id: 'virtualenv', label: 'virtualenv', tool: 'virtualenv' }
];

function pythonVersionSupported(version, template) {
  return !template.pythonMinimum || Number(version.split('.')[1]) >= Number(template.pythonMinimum.split('.')[1]);
}

function parsePythonOptions(input, lines, framework, template = {}) {
  const environment = environments.find(item => item.id === (input.environment || 'venv'));
  if (!environment) throw new Error('Choose a Python environment manager.');
  const requested = typeof input.pythonVersion === 'string' ? input.pythonVersion.trim() : '';
  const version = requested || (template.pythonMinimum && ['uv', 'conda'].includes(environment.id) ? '3.13' : '');
  if (version && !/^3\.(?:[89]|[1-9]\d+)(?:\.\d+)?$/.test(version)) {
    throw new Error('Enter a Python version such as 3.13 or 3.13.2. Python 3.8 or newer is supported.');
  }
  if (version && !pythonVersionSupported(version, template)) {
    throw new Error('This template requires Python ' + template.pythonMinimum + ' or newer.');
  }
  const packages = new Map();
  for (const line of [...(template.pythonPackages || []), ...lines]) {
    const match = line.match(/^([a-zA-Z0-9][a-zA-Z0-9_.-]*)(?:\[[a-zA-Z0-9_,.-]+\])?(?:(?:~=|==|!=|<=|>=|<|>)[a-zA-Z0-9.*+!-]+(?:,(?:~=|==|!=|<=|>=|<|>)[a-zA-Z0-9.*+!-]+)*)?$/);
    if (!match) throw new Error('Use one Python package per line, for example requests or requests>=2,<3.');
    const name = match[1].toLowerCase().replace(/[-_.]+/g, '-');
    if (packages.has(name)) throw new Error('Duplicate Python package: ' + name);
    packages.set(name, line);
  }
  const pytest = framework === 'pytest' && !packages.has('pytest') ? (version.startsWith('3.8') ? 'pytest<8.4' : 'pytest') : undefined;
  return { environment: environment.id, version, packages: [...packages.values()], pytest, framework };
}

function selectPython(options, tools, versions, template) {
  if (options.environment === 'uv' || options.environment === 'conda') {
    return tools[options.environment];
  }
  const virtualenv = tools.virtualenv?.version !== 'Python module' ? tools.virtualenv?.file : undefined;
  const runtime = versions.find(runtime => runtime.usable !== false &&
    pythonVersionSupported(runtime.version, template) &&
    (!options.version || runtime.version === options.version || runtime.version.startsWith(options.version + '.')) &&
    (template.id !== 'python-desktop' || runtime.tkinter) &&
    (options.environment !== 'virtualenv' || runtime.virtualenv || virtualenv));
  if (runtime) return { ...runtime, virtualenvExecutable: !runtime.virtualenv ? virtualenv : undefined };
}

async function preparePython(project, template, name, options) {
  const { environment, version, packages, pytest, framework } = options;
  const requirements = [...packages, ...(pytest ? [pytest] : [])];
  const minimum = template.pythonMinimum || '3.8';
  const readme = ['# ' + name, '', template.description, ''];
  const setup = [];
  let runner;

  if (environment === 'uv') {
    const dependencies = packages.map(value => JSON.stringify(value)).join(', ');
    const toml = ['[project]', 'name = ' + JSON.stringify(replaceTokens('__PROJECT_SLUG__', name)),
      'version = "0.1.0"', 'requires-python = ">=' + minimum + '"', 'dependencies = [' + dependencies + ']', ''];
    if (pytest) toml.push('[dependency-groups]', 'dev = [' + JSON.stringify(pytest) + ']', '');
    await fs.writeFile(path.join(project, 'pyproject.toml'), toml.join('\n'), { flag: 'wx' });
    if (version) await fs.writeFile(path.join(project, '.python-version'), version + '\n', { flag: 'wx' });
    setup.push('uv sync');
    runner = 'uv run python';
  } else if (environment === 'conda') {
    const yaml = ['channels:', '  - conda-forge', '  - nodefaults', 'dependencies:', '  - python' + (version ? '=' + version : '>=' + minimum)];
    if (template.id === 'python-desktop') yaml.push('  - tk');
    if (requirements.length) yaml.push('  - pip', '  - pip:', ...requirements.map(requirement => '    - ' + JSON.stringify(requirement)));
    await fs.writeFile(path.join(project, 'environment.yml'), yaml.join('\n') + '\n', { flag: 'wx' });
    setup.push('conda env create --prefix ./.venv --file environment.yml');
    runner = 'conda run --prefix ./.venv python';
  } else {
    const minorVersion = version.split('.').slice(0, 2).join('.');
    setup.push('python' + (minorVersion || '3') + ' -m ' + environment + ' .venv');
    setup.push('# macOS / Linux: source .venv/bin/activate', '# Windows PowerShell: .\\.venv\\Scripts\\Activate.ps1');
    runner = 'python';
    if (requirements.length) {
      await fs.writeFile(path.join(project, 'requirements.txt'), requirements.join('\n') + '\n', { flag: 'wx' });
      setup.push(runner + ' -m pip install -r requirements.txt');
    }
    readme.push(version ? 'Use Python ' + version + '.' : 'Use Python ' + minimum + ' or newer.');
    if (environment === 'virtualenv') readme.push('Install virtualenv into the selected Python interpreter before running setup.');
    readme.push('On Windows, use py -' + (minorVersion || '3') + ' in place of python' + (minorVersion || '3') + ', or use the path to your Python executable.', '');
  }

  if (setup.length) readme.push('## Set up', '', '~~~sh', ...setup, '~~~', '');
  readme.push('## Run', '', '~~~sh', ...template.commands.map(command => command.replace(/^python3\b/, runner)), '~~~', '');
  if (template.id === 'python-server') readme.push('Open http://127.0.0.1:8080 after starting the development server.', '');
  if (template.pythonMinimum && template.note) readme.push(template.note, '');
  if (framework) {
    await fs.mkdir(path.join(project, 'tests'));
    const sample = 'def add(left: int, right: int) -> int:\n    return left + right\n';
    const source = framework === 'pytest' ? sample + '\n\ndef test_add():\n    assert add(2, 3) == 5\n' :
      'import unittest\n\n\n' + sample + '\n\nclass ExampleTest(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add(2, 3), 5)\n';
    await fs.writeFile(path.join(project, 'tests', 'test_example.py'), source, { flag: 'wx' });
    const command = framework === 'pytest' ? 'pytest' : 'unittest discover -s tests';
    readme.push('## Tests', '', '~~~sh', runner + ' -m ' + command, '~~~', '');
  }
  await fs.writeFile(path.join(project, 'README.md'), readme.join('\n'));
  const editorSettings = { 'python.defaultInterpreterPath': '${workspaceFolder}/.venv' };
  if (framework) {
    editorSettings['python.testing.pytestEnabled'] = framework === 'pytest';
    editorSettings['python.testing.unittestEnabled'] = framework === 'unittest';
    if (framework === 'unittest') editorSettings['python.testing.unittestArgs'] = ['-s', 'tests'];
  }
  const vscode = path.join(project, '.vscode');
  await fs.mkdir(vscode);
  await fs.writeFile(path.join(vscode, 'settings.json'), JSON.stringify(editorSettings, null, 2) + '\n', { flag: 'wx' });
}

async function setupPython(project, options, runtime, log) {
  const { environment, version, packages, pytest } = options;
  const pythonRelative = process.platform !== 'win32' ? 'bin/python' :
    environment === 'conda' ? 'python.exe' : 'Scripts/python.exe';
  const interpreter = path.join(project, '.venv', pythonRelative);
  async function run(file, args) {
    log?.(path.basename(file) + ' ' + args.join(' '));
    const settings = {
      cwd: project, env: { ...process.env, UV_PROJECT_ENVIRONMENT: path.join(project, '.venv'), UV_NO_PROGRESS: '1' },
      windowsHide: true, timeout: 300000, maxBuffer: 2 * 1024 * 1024
    };
    try {
      const { stdout, stderr } = await exec(file, args, settings);
      if (stdout.trim()) log?.(stdout.trim());
      if (stderr.trim()) log?.(stderr.trim());
    } catch (error) {
      log?.([error.stdout, error.stderr].filter(Boolean).join('\n'));
      throw error;
    }
  }
  if (environment === 'uv') {
    await run(runtime.file, ['sync', ...(version ? ['--python', version] : [])]);
  } else if (environment === 'conda') {
    await run(runtime.file, ['env', 'create', '--yes', '--prefix', './.venv', '--file', 'environment.yml']);
  } else {
    if (environment === 'virtualenv' && runtime.virtualenvExecutable) {
      await run(runtime.virtualenvExecutable, ['--python', runtime.file, '.venv']);
    } else {
      await run(runtime.file, ['-m', environment, '.venv']);
    }
    if (packages.length || pytest) {
      await run(interpreter, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
    }
  }
  if (!(await fs.stat(interpreter).catch(() => undefined))?.isFile()) {
    throw new Error('The environment manager did not create a Python interpreter inside .venv.');
  }
  if (options.tkinter) await run(interpreter, ['-I', '-c', 'import tkinter']);
}

module.exports = { environments, parsePythonOptions, preparePython, pythonVersionSupported, selectPython, setupPython };
