const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { replaceTokens } = require('./projects');

const exec = promisify(execFile);

const generators = [
  {
    id: 'nextjs', label: 'Next.js', group: 'frontend', generatorNode: 'next-node',
    description: 'A TypeScript React app with the Next.js App Router and ESLint.',
    requirement: 'Node.js 20.9 or newer and npm.',
    cli: 'create-next-app@16.4.6',
    args: ['--ts', '--app', '--src-dir', '--eslint', '--no-tailwind', '--no-react-compiler', '--empty',
      '--use-npm', '--skip-install', '--disable-git', '--yes'],
    expected: 'src/app/page.tsx', runCommands: ['npm install', 'npm run dev']
  },
  {
    id: 'nuxt', label: 'Nuxt', group: 'frontend', generatorNode: 'nuxt-node',
    description: 'A Vue and TypeScript app with Nuxt 4 and server-side rendering.',
    requirement: 'Node.js 22.22.3+ (22.x), 24.15+ (24.x), or 26+, and npm.',
    cli: 'create-nuxt@4.0.3',
    args: ['--template', 'gh:nuxt/starter#v4', '--no-install', '--no-gitInit', '--packageManager', 'npm', '--no-modules'],
    expected: 'nuxt.config.ts', runCommands: ['npm install', 'npm run dev']
  },
  {
    id: 'tauri', label: 'Tauri Desktop', group: 'desktop', generatorNode: 'vite-node',
    description: 'A Tauri 2 desktop app with a Rust backend and a vanilla TypeScript frontend.',
    requirement: 'Node.js and npm to scaffold. Rust, Cargo, and the Tauri platform prerequisites to build.',
    cli: 'create-tauri-app@4.7.5',
    args: ['--manager', 'npm', '--template', 'vanilla-ts', '--tauri-version', '2', '--yes'],
    expected: 'src-tauri/tauri.conf.json', runCommands: ['npm install', 'npm run tauri dev'],
    tools: ['rust'],
    platformTools: { win32: ['tauri-windows'], darwin: ['apple-sdk'], linux: ['tauri-linux', 'c-compiler'] }
  }
].map(template => ({
  ...template, kind: 'npm-generator', language: 'TypeScript',
  tools: [template.generatorNode, 'npm', ...(template.tools || [])],
  next: 'Follow the commands in README.md.'
}));

async function npmCommand(node, npm) {
  const file = await fs.realpath(npm.file).catch(() => npm.file);
  const scripts = [
    path.join(path.dirname(npm.file), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(path.dirname(file), 'npm-cli.js')
  ];
  for (const script of scripts) {
    if (await fs.stat(script).then(stat => stat.isFile(), () => false)) return [node.file, script];
  }
  if (!/\.(?:cmd|bat)$/i.test(file)) return [file];
  throw new Error('Install npm bundled with Node.js to run this generator.');
}

async function runNpmGenerator(node, npm, args, cwd, label, log) {
  if (!node || node.usable === false || !npm) throw new Error('Set up Node.js and npm before generating ' + label + '.');
  const [file, ...prefix] = await npmCommand(node, npm);
  try {
    const { stdout, stderr } = await exec(file, [...prefix, 'exec', '--yes', '--', ...args], {
      cwd,
      env: { ...process.env, PATH: path.dirname(node.file) + path.delimiter + (process.env.PATH || ''), CI: '1' },
      windowsHide: true, timeout: 300000, maxBuffer: 4 * 1024 * 1024
    });
    if (stdout.trim()) log?.(stdout.trim());
    if (stderr.trim()) log?.(stderr.trim());
  } catch (error) {
    log?.([error.stdout, error.stderr].filter(Boolean).join('\n') || error.message);
    throw new Error(label + ' generation failed. Open Project Wizard output for details.');
  }
}

async function createNpmProject(template, name, project, tools, log) {
  const slug = 'app-' + replaceTokens('__PROJECT_SLUG__', name);
  const directory = await fs.mkdtemp(path.join(project, '.generator-'));
  const generated = path.join(directory, slug);
  const args = [template.cli, slug, ...template.args];
  if (template.id === 'tauri') args.push('--identifier', 'com.example.' + slug);
  log?.('Generating ' + template.label + ' with ' + template.cli + '.');
  await runNpmGenerator(tools[template.generatorNode], tools.npm, args, directory, template.label, log);
  for (const item of ['package.json', template.expected]) {
    await fs.access(path.join(generated, item)).catch(() => {
      throw new Error(template.label + ' did not generate the expected ' + item + '.');
    });
  }
  const files = await fs.readdir(generated);
  if (files.includes('.git') || files.includes('node_modules')) {
    throw new Error(template.label + ' initialized Git or installed dependencies during scaffolding.');
  }
  for (const file of files) await fs.rename(path.join(generated, file), path.join(project, file));
  await fs.rmdir(generated);
  await fs.rmdir(directory);
  const tauriSetup = template.id === 'tauri' ?
    '\nFor native prerequisites, see the [Tauri setup guide](https://v2.tauri.app/start/prerequisites/). ' +
    'Run `npm run tauri build` to package the app. Set your own identifier in `src-tauri/tauri.conf.json` before distribution.\n' : '';
  await fs.appendFile(path.join(project, 'README.md'),
    '\n## Run locally with npm\n\n```sh\n' + template.runCommands.join('\n') + '\n```\n' + tauriSetup);
}

module.exports = { createNpmProject, generators, runNpmGenerator };
