const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');

const exec = promisify(execFile);

function reactNativeIdentifier(name) {
  return 'App' + name.replace(/[^a-zA-Z0-9]/g, '');
}

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
  throw new Error('Install npm bundled with Node.js to generate a React Native project.');
}

async function createReactNativeProject(name, project, tools, log) {
  const node = tools['react-native-node'];
  if (!node || !tools.npm) throw new Error('Set up Node.js and npm before generating React Native.');
  const [file, ...prefix] = await npmCommand(node, tools.npm);
  const args = [...prefix, 'exec', '--yes', '--', '@react-native-community/cli@20.2.0', 'init',
    reactNativeIdentifier(name), '--version', '0.88.1', '--title', name, '--directory', project,
    '--pm', 'npm', '--skip-install', '--skip-git-init', 'true', '--install-pods', 'false'];
  log?.('Generating React Native 0.88.1 with the Community CLI.');
  try {
    const { stdout, stderr } = await exec(file, args, {
      cwd: path.dirname(project),
      env: { ...process.env, PATH: path.dirname(node.file) + path.delimiter + (process.env.PATH || ''), CI: '1' },
      windowsHide: true, timeout: 300000, maxBuffer: 4 * 1024 * 1024
    });
    if (stdout.trim()) log?.(stdout.trim());
    if (stderr.trim()) log?.(stderr.trim());
  } catch (error) {
    log?.([error.stdout, error.stderr].filter(Boolean).join('\n') || error.message);
    throw new Error('React Native generation failed. Open Project Wizard output for details.');
  }
  for (const item of ['package.json', 'android', 'ios']) {
    await fs.access(path.join(project, item)).catch(() => {
      throw new Error('The React Native CLI did not generate the expected ' + item + '.');
    });
  }
}

module.exports = { createReactNativeProject, reactNativeIdentifier };
