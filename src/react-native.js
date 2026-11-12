const fs = require('node:fs/promises');
const path = require('node:path');
const { runNpmGenerator } = require('./npm-generators');

function reactNativeIdentifier(name) {
  return 'App' + name.replace(/[^a-zA-Z0-9]/g, '');
}

async function createReactNativeProject(name, project, tools, log) {
  const args = ['@react-native-community/cli@20.2.0', 'init',
    reactNativeIdentifier(name), '--version', '0.88.1', '--title', name, '--directory', project,
    '--pm', 'npm', '--skip-install', '--skip-git-init', 'true', '--install-pods', 'false'];
  log?.('Generating React Native 0.88.1 with the Community CLI.');
  await runNpmGenerator(tools['react-native-node'], tools.npm, args, path.dirname(project), 'React Native', log);
  for (const item of ['package.json', 'android', 'ios']) {
    await fs.access(path.join(project, item)).catch(() => {
      throw new Error('The React Native CLI did not generate the expected ' + item + '.');
    });
  }
}

module.exports = { createReactNativeProject, reactNativeIdentifier };
