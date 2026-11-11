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
  { id: 'virtualenv', label: 'virtualenv', tool: 'virtualenv' },
  { id: 'none', label: 'Existing Python environment' }
];

function parsePythonOptions(input, lines, testing) {
  const environment = environments.find(item => item.id === (input.environment || 'venv'));
  if (!environment) throw new Error('Choose a Python environment manager.');
  const version = environment.id !== 'none' && typeof input.pythonVersion === 'string' ? input.pythonVersion.trim() : '';
  if (version && !/^3\.(?:[89]|[1-9]\d+)(?:\.\d+)?$/.test(version)) {
    throw new Error('Enter a Python version such as 3.13 or 3.13.2. Python 3.8 or newer is supported.');
  }
  const packages = new Map();
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9][a-zA-Z0-9_.-]*)(?:\[[a-zA-Z0-9_,.-]+\])?(?:(?:~=|==|!=|<=|>=|<|>)[a-zA-Z0-9.*+!-]+(?:,(?:~=|==|!=|<=|>=|<|>)[a-zA-Z0-9.*+!-]+)*)?$/);
    if (!match) throw new Error('Use one Python package per line, for example requests or requests>=2,<3.');
    const name = match[1].toLowerCase().replace(/[-_.]+/g, '-');
    if (packages.has(name)) throw new Error('Duplicate Python package: ' + name);
    packages.set(name, line);
  }
  const pytest = testing && !packages.has('pytest') ? (version.startsWith('3.8') ? 'pytest<8.4' : 'pytest') : undefined;
  return { environment: environment.id, version, packages: [...packages.values()], pytest, testing,
    createNow: input.createEnvironment === true && environment.id !== 'none' };
}

function selectPython(options, tools, versions, template) {
  if (options.environment === 'uv' || options.environment === 'conda') {
    return tools[options.environment];
  }
  const virtualenv = tools.virtualenv?.version !== 'Python module' ? tools.virtualenv?.file : undefined;
  const runtime = versions.find(runtime => runtime.usable !== false &&
    (!options.version || runtime.version === options.version || runtime.version.startsWith(options.version + '.')) &&
    (template.id !== 'python-desktop' || runtime.tkinter) &&
    (options.environment !== 'virtualenv' || runtime.virtualenv || virtualenv));
  if (runtime) return { ...runtime, virtualenvExecutable: !runtime.virtualenv ? virtualenv : undefined };
}

async function preparePython(project, template, name, options) {
  const { environment, version, packages, pytest, testing } = options;
  const requirements = [...packages, ...(pytest ? [pytest] : [])];
  const readme = ['# ' + name, '', template.description, ''];
  const setup = [];
  let runner = 'python3';

  if (environment === 'uv') {
    const dependencies = packages.map(value => JSON.stringify(value)).join(', ');
    const toml = ['[project]', 'name = ' + JSON.stringify(replaceTokens('__PROJECT_SLUG__', name)),
      'version = "0.1.0"', 'requires-python = ">=3.8"', 'dependencies = [' + dependencies + ']', ''];
    if (pytest) toml.push('[dependency-groups]', 'dev = [' + JSON.stringify(pytest) + ']', '');
    await fs.writeFile(path.join(project, 'pyproject.toml'), toml.join('\n'), { flag: 'wx' });
    if (version) await fs.writeFile(path.join(project, '.python-version'), version + '\n', { flag: 'wx' });
    setup.push('uv sync');
    runner = 'uv run python';
  } else if (environment === 'conda') {
    const yaml = ['channels:', '  - conda-forge', '  - nodefaults', 'dependencies:', '  - python' + (version ? '=' + version : '>=3.8')];
    if (template.id === 'python-desktop') yaml.push('  - tk');
    if (requirements.length) yaml.push('  - pip', '  - pip:', ...requirements.map(requirement => '    - ' + JSON.stringify(requirement)));
    await fs.writeFile(path.join(project, 'environment.yml'), yaml.join('\n') + '\n', { flag: 'wx' });
    setup.push('conda env create --prefix ./.venv --file environment.yml');
    runner = 'conda run --prefix ./.venv python';
  } else {
    const minorVersion = version.split('.').slice(0, 2).join('.');
    if (environment !== 'none') {
      const module = environment === 'virtualenv' ? 'virtualenv' : 'venv';
      setup.push('python' + (minorVersion || '3') + ' -m ' + module + ' .venv');
      setup.push('# macOS / Linux: source .venv/bin/activate', '# Windows PowerShell: .\\.venv\\Scripts\\Activate.ps1');
      runner = 'python';
    }
    if (requirements.length) {
      await fs.writeFile(path.join(project, 'requirements.txt'), requirements.join('\n') + '\n', { flag: 'wx' });
      setup.push(runner + ' -m pip install -r requirements.txt');
    }
    readme.push(version ? 'Use Python ' + version + '.' : 'Use Python 3.8 or newer.');
    if (environment === 'virtualenv') readme.push('Install virtualenv into the selected Python interpreter before running setup.');
    readme.push('On Windows, use py -' + (minorVersion || '3') + ' in place of python' + (minorVersion || '3') + ', or use the path to your Python executable.', '');
  }

  if (setup.length) readme.push('## Set up', '', '~~~sh', ...setup, '~~~', '');
  readme.push('## Run', '', '~~~sh', ...template.commands.map(command => command.replace(/^python3\b/, runner)), '~~~', '');
  if (template.id === 'python-server') readme.push('Open http://127.0.0.1:8080 after starting the development server.', '');
  if (testing) {
    await fs.mkdir(path.join(project, 'tests'));
    await fs.writeFile(path.join(project, 'tests', 'test_example.py'),
      'def add(left: int, right: int) -> int:\n    return left + right\n\n\ndef test_add():\n    assert add(2, 3) == 5\n', { flag: 'wx' });
    readme.push('## Tests', '', '~~~sh', runner + ' -m pytest', '~~~', '');
  }
  await fs.writeFile(path.join(project, 'README.md'), readme.join('\n'));
}

async function setupPython(project, options, runtime, log) {
  const { environment, version, packages, pytest } = options;
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
      const interpreter = process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python';
      await run(path.join(project, '.venv', interpreter), ['-m', 'pip', 'install', '-r', 'requirements.txt']);
    }
  }
}

module.exports = { environments, parsePythonOptions, preparePython, selectPython, setupPython };
