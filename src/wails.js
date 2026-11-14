const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { replaceTokens } = require('./projects');

const exec = promisify(execFile);
const wailsVersions = [
  { id: 'wails3', label: 'Wails 3', cli: 'wails3', version: '3.0.0', git: 'github.com/wailsapp/wails/v3/cmd/wails3',
    linux: 'wails3-linux', frontend: 'vanilla-js' },
  { id: 'wails2', label: 'Wails 2', cli: 'wails', version: '2.17.1', git: 'github.com/wailsapp/wails/v2/cmd/wails',
    linux: 'wails2-linux', frontend: 'vanilla' }
].map(version => ({
  ...version,
  generatorTools: ['wails-go', version.id],
  tools: ['wails-go', version.id, 'vite-node', 'npm'],
  platformTools: { win32: ['wails-webview'], darwin: ['wails-macos'], linux: [version.linux] },
  requirement: 'Go 1.26.10 or newer, the ' + version.label + ' CLI, a supported Node.js LTS release, npm, and your OS webview.'
}));

const wailsStarter = {
  id: 'wails', kind: 'wails', group: 'desktop', language: 'Go', label: 'Wails Desktop',
  platforms: ['win32', 'darwin', 'linux'],
  description: 'A native webview app with a Go backend and a Vite frontend that calls a Go greeting method.',
  next: 'Follow the development and packaging commands in README.md.'
};

async function createWailsProject(name, project, tools, build, log) {
  const version = wailsVersions.find(option => option.id === build);
  if (!version || version.generatorTools.some(id => !tools[id] || tools[id].usable === false)) {
    throw new Error('Install Go and the selected Wails CLI from the setup guide, then refresh templates.');
  }
  const modern = version.id === 'wails3';
  const cli = tools[version.id].file;
  const go = tools['wails-go'].file;
  const installedVersion = tools[version.id].version || version.version;
  const slug = replaceTokens('app-__PROJECT_SLUG__', name);
  const output = path.join(project, slug);
  const args = ['init', '-n', slug, '-t', version.frontend, '-d', modern ? project : output];
  if (modern) args.push('-mod', 'example.com/' + slug, '-productname', name, '-productidentifier', 'com.example.' + slug, '--skipgomodtidy');
  const env = { ...process.env, GOWORK: 'off', PATH: path.dirname(go) + path.delimiter + (process.env.PATH || '') };
  try {
    log?.('Generating ' + version.label + ' Desktop.');
    const { stdout, stderr } = await exec(cli, args, {
      cwd: project, env, windowsHide: true, timeout: 300000, maxBuffer: 4 * 1024 * 1024
    });
    if (stdout.trim()) log?.(stdout.trim());
    if (stderr.trim()) log?.(stderr.trim());
  } catch (error) {
    log?.([error.stdout, error.stderr].filter(Boolean).join('\n') || error.message);
    throw new Error(version.label + ' generation failed. Open Project Wizard output for details.');
  }
  const entries = await fs.readdir(output);
  if (entries.includes('.git')) throw new Error(version.label + ' initialized Git during scaffolding.');
  const required = ['go.mod', 'main.go', 'frontend/package.json', 'build/appicon.png', modern ? 'Taskfile.yml' : 'wails.json'];
  for (const item of required) {
    await fs.access(path.join(output, item)).catch(() => {
      throw new Error(version.label + ' did not create ' + item + '.');
    });
  }
  if (modern) {
    const config = path.join(output, 'build/config.yml');
    const yaml = await fs.readFile(config, 'utf8');
    const values = { productName: name, productIdentifier: 'com.example.' + slug };
    await fs.writeFile(config, yaml.replace(/^(  (productName|productIdentifier): )"[^"]*"/gm,
      (line, key, field) => key + JSON.stringify(values[field])));
  } else {
    const config = path.join(output, 'wails.json');
    const settings = JSON.parse(await fs.readFile(config, 'utf8'));
    settings.info = { ...settings.info, productName: name };
    await fs.writeFile(config, JSON.stringify(settings, null, 2) + '\n');
  }
  await fs.writeFile(path.join(output, 'README.md'), [
    '# ' + name, '', 'A ' + version.label + ' desktop app with a Vite frontend that calls a Go greeting method.', '',
    '## Development', '',
    'Use Go 1.26.10 or newer, Node.js LTS and npm. Install the CLI on PATH. Run these commands from the project folder.', '',
    '~~~sh', 'go install ' + version.git + '@v' + installedVersion, version.cli + ' dev', '~~~', '',
    'On Windows, install Microsoft Edge WebView2 Runtime. On macOS, install Xcode Command Line Tools.', '',
    modern ?
      'On Linux, install a C compiler, pkg-config, GTK 4, and WebKitGTK 6.0 development files.' :
      'On Linux, install a C compiler, pkg-config, GTK 3, and WebKitGTK 4.1 development files. Use `wails dev -tags webkit2_41`.', '',
    '## Distribution', '',
    ...(modern ? ['Run `wails3 build` for a build or `wails3 task package` to package for your current platform. Outputs go under `bin/`.'] :
      ['Run `wails build` to package for the current platform. On Linux use `wails build -tags webkit2_41`. Outputs go under `build/bin/`.']),
    'On macOS, share the complete `.app` bundle. Linux users need the matching system webview libraries.', ''
  ].join('\n'));
  for (const entry of entries) await fs.rename(path.join(output, entry), path.join(project, entry));
  await fs.rmdir(output);
}

module.exports = { createWailsProject, wailsStarter, wailsVersions };
