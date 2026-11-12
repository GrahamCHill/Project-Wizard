const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const monoGamePackage = 'MonoGame.Templates.CSharp';

function isPortablePathPart(value) {
  return Boolean(value) && value === value.trim() && !value.endsWith('.') &&
    !/[<>:"/\\|?*\x00-\x1f]/.test(value) &&
    !/^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³]) *(?:\.|$)/i.test(value);
}

function validateProjectName(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/.test(name) ||
      !isPortablePathPart(name)) {
    throw new Error('Enter a project name of 1–80 characters using letters, numbers, spaces, dots, hyphens, or underscores. Start with a letter or number and use a valid folder name.');
  }
}

function replaceTokens(text, name, sdkMajor) {
  const identifier = name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(?=\d)/, '_');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  const replacements = {
    __PROJECT_NAME__: name,
    __PROJECT_IDENTIFIER__: identifier,
    __PROJECT_SLUG__: slug,
    __PROJECT_SNAKE__: slug.replaceAll('-', '_'),
    __TARGET_FRAMEWORK__: sdkMajor ? `net${sdkMajor}.0` : '__TARGET_FRAMEWORK__'
  };
  return text.replace(/__PROJECT_NAME__|__PROJECT_IDENTIFIER__|__PROJECT_SLUG__|__PROJECT_SNAKE__|__TARGET_FRAMEWORK__/g, token => replacements[token]);
}

function absolutePath(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) ||
      (process.platform === 'win32' && !/^(?:[A-Za-z]:[/\\]|[/\\]{2}[^.?/\\])/.test(value))) {
    throw new Error('Choose an absolute folder path.');
  }
  return path.resolve(value);
}

async function existingDirectory(value) {
  const directory = absolutePath(value);
  const info = await fs.stat(directory).catch(() => undefined);
  if (!info?.isDirectory()) throw new Error(`Folder is unavailable: ${directory}`);
  return fs.realpath(directory);
}

async function createProject(parentValue, name, generate, log) {
  validateProjectName(name);
  const parent = await existingDirectory(parentValue);
  const destination = path.join(parent, name);
  const existing = await fs.lstat(destination).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing) throw new Error(`A file or folder already exists at ${destination}`);

  const staging = await fs.mkdtemp(path.join(parent, '.project-wizard-'));
  try {
    const project = path.join(staging, name);
    await fs.mkdir(project);
    await generate(project, parent);
    await fs.mkdir(destination).catch(error => {
      if (error.code === 'EEXIST') throw new Error(`A file or folder already exists at ${destination}`);
      throw error;
    });
    try {
      for (const entry of await fs.readdir(project)) {
        await fs.cp(path.join(project, entry), path.join(destination, entry), {
          recursive: true, force: false, errorOnExist: true
        });
      }
    } catch (error) {
      throw new Error(`Could not finish writing ${destination}. It may contain some generated files. ${error.message}`);
    }
    return destination;
  } finally {
    if (path.dirname(staging) === parent) {
      await fs.rm(staging, { recursive: true, force: true }).catch(error => log?.(error.message));
    }
  }
}

async function findDotnet() {
  const filename = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
  const searchPath = (process.env.PATH || '').split(path.delimiter);
  for (const folder of searchPath) {
    const directory = folder.replace(/^"(.*)"$/, '$1');
    if (!path.isAbsolute(directory)) continue;
    const executable = path.join(directory, filename);
    const info = await fs.stat(executable).catch(() => undefined);
    if (info?.isFile()) return executable;
  }
  throw new Error('Install the .NET SDK (8 or newer), then restart VS Code and refresh.');
}

async function runDotnet(executable, args, cwd, log, timeout = 30000) {
  log?.(`dotnet ${args.map(arg => JSON.stringify(arg)).join(' ')}`);
  try {
    const { stdout, stderr } = await exec(executable, args, {
      cwd,
      env: { ...process.env, DOTNET_NOLOGO: '1', DOTNET_CLI_UI_LANGUAGE: 'en-US', NO_COLOR: '1' },
      timeout,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true
    });
    if (stdout.trim()) log?.(stdout.trim());
    if (stderr.trim()) log?.(stderr.trim());
    return stdout;
  } catch (error) {
    const details = [error.stderr, error.stdout].filter(Boolean).join('\n').trim();
    log?.(details || error.message);
    const summary = details.split(/\r?\n/).find(line => /error|not found|no .net sdks/i.test(line)) || details.split(/\r?\n/)[0];
    throw new Error(error.killed ? 'The .NET command timed out. See the Project Wizard output for details.' :
      summary?.trim().slice(0, 450) || error.message);
  }
}

async function getSdk(cwd, log) {
  const executable = await findDotnet();
  const output = await runDotnet(executable, ['--version'], cwd, log);
  const version = output.match(/^\d+\.\d+\.\d+\S*$/m)?.[0];
  const major = Number.parseInt(version, 10);
  if (!version || major < 8) throw new Error('Select a folder with a .NET SDK of version 8 or newer.');
  return { executable, version, major };
}

function parseMonoGameTemplates(output) {
  const result = new Map();
  for (const line of output.split(/\r?\n/)) {
    const [label, aliases, languages = '', tags = ''] = line.trim().split(/\s{2,}/);
    if (!aliases || !/monogame/i.test(`${label} ${tags}`)) continue;
    const names = aliases.split(',').map(alias => alias.trim());
    const shortName = names.find(alias => alias.startsWith('mg')) || names[0];
    if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(shortName)) continue;
    const language = languages.match(/\[([^\]]+)\]/)?.[1] || languages.split(',')[0].trim();
    const id = `monogame:${shortName}`;
    result.set(id, {
      id, group: 'monogame', kind: 'dotnet', label, shortName, language, tools: ['dotnet'], needsSdk: true,
      description: tags ? tags.split('/').join(' · ') : 'MonoGame project',
      requirement: 'The installed MonoGame template determines the SDK and platform requirements.',
      next: 'Run dotnet tool restore if the project includes a tool manifest, then follow the template’s build instructions.'
    });
  }
  const priority = { 'mg-emptygame': 0, monogame: 0, mgdesktopgl: 1 };
  return [...result.values()].sort((a, b) => (priority[a.shortName] ?? 2) - (priority[b.shortName] ?? 2));
}

async function listMonoGame(sdk, cwd, log) {
  const output = await runDotnet(sdk.executable, ['new', 'list', '--type', 'project'], cwd, log);
  return parseMonoGameTemplates(output);
}

async function installMonoGame(cwd, log) {
  const sdk = await getSdk(cwd, log);
  await runDotnet(sdk.executable, ['new', 'install', monoGamePackage], cwd, log, 180000);
}

async function removeStagedRestoreCaches(project, directory = project) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = path.join(directory, entry.name);
    if (entry.name.toLowerCase() === 'obj') {
      const files = await fs.readdir(child);
      if (files.some(file => file === 'project.assets.json' || file.endsWith('.nuget.dgspec.json'))) {
        // NuGet caches contain absolute paths to the temporary project directory.
        const relative = path.relative(project, await fs.realpath(child));
        if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
          await fs.rm(child, { recursive: true, force: true });
        }
        continue;
      }
    }
    await removeStagedRestoreCaches(project, child);
  }
}

async function createDotnetProject(template, name, project, parent, log) {
  const sdk = await getSdk(parent, log);
  const args = ['new', template.shortName, '--name', name, '--output', project, '--no-update-check'];
  if (template.language) args.push('--language', template.language);
  const help = await runDotnet(sdk.executable, ['new', template.shortName, '--help'], parent, log);
  if (/^\s+--no-restore\b/m.test(help)) args.push('--no-restore');
  if (/^\s+--allow-scripts\b/m.test(help)) args.push('--allow-scripts', 'no');
  await runDotnet(sdk.executable, args, parent, log, 180000);
  await removeStagedRestoreCaches(project);
}

function detectFrameworks(filename, contents) {
  const file = filename.toLowerCase();
  if (file === 'cmakelists.txt') {
    const cmake = contents.replace(/#\[\[.*?\]\]|#[^\r\n]*/gs, '');
    const frameworks = [];
    if (/\b(?:find_package|FetchContent_Declare)\s*\(\s*["']?raylib\b|\btarget_link_libraries\s*\([^)]*\braylib\b/i.test(cmake)) frameworks.push('Raylib');
    if (/\bpkg_check_modules\s*\([^)]*\bgtk4\b/i.test(cmake)) frameworks.push('GTK 4');
    if (/\bpkg_check_modules\s*\([^)]*\bgtkmm-4\.0\b/i.test(cmake)) frameworks.push('GTKmm 4');
    return frameworks;
  }
  if (file === 'package.json') {
    const manifest = parseProjectJson(contents);
    const dependencies = { ...manifest?.dependencies, ...manifest?.devDependencies };
    return Object.entries({ next: 'Next.js', nuxt: 'Nuxt', electron: 'Electron', '@tauri-apps/cli': 'Tauri' })
      .filter(([id]) => Object.hasOwn(dependencies, id)).map(([, label]) => label);
  }
  if (file === 'tauri.conf.json') return parseProjectJson(contents) ? ['Tauri'] : [];
  if (file === 'composer.json') {
    const manifest = parseProjectJson(contents);
    return typeof manifest?.require?.['laravel/framework'] === 'string' ? ['Laravel'] : [];
  }
  if (file === 'blender_manifest.toml') return /^blender_version_min\s*=/m.test(contents) ? ['Blender'] : [];
  if (file === 'pubspec.yaml') return /^\s+sdk:\s*flutter\s*$/m.test(contents) ? ['Flutter'] : [];
  if (file.endsWith('.uproject')) return parseProjectJson(contents)?.FileVersion ? ['Unreal Engine'] : [];
  if (file === 'project.godot') return /^config_version\s*=\s*\d+/m.test(contents) ? ['Godot'] : [];
  if (file === 'projectversion.txt') return /^m_EditorVersion:\s*\d+\./m.test(contents) ? ['Unity'] : [];
  const xml = contents.replace(/<!--[\s\S]*?-->/g, '');
  const packages = [...xml.matchAll(/<Package(?:Reference|Version)\b[^>]*?\b(?:Include|Update)\s*=\s*["']([^"']+)/gi)]
    .map(match => match[1].toLowerCase());
  const frameworks = [];
  if (packages.some(name => name.startsWith('monogame.'))) frameworks.push('MonoGame');
  if (packages.includes('raylib-cs')) frameworks.push('Raylib');
  return frameworks;
}

function parseProjectJson(contents) {
  try {
    return JSON.parse(contents.replace(/^\uFEFF/, ''));
  } catch {
    return undefined;
  }
}

module.exports = {
  createDotnetProject, createProject, detectFrameworks, existingDirectory, getSdk,
  installMonoGame, isPortablePathPart, listMonoGame, parseMonoGameTemplates, replaceTokens, validateProjectName
};
