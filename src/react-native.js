const fs = require('node:fs/promises');
const path = require('node:path');
const { runNpmGenerator } = require('./npm-generators');
const { writeMobileSources } = require('./mobile-starters');

function reactNativeIdentifier(name) {
  return 'App' + name.replace(/[^a-zA-Z0-9]/g, '');
}

async function createReactNativeProject(name, project, tools, log) {
  const args = ['@react-native-community/cli@20.2.0', 'init',
    reactNativeIdentifier(name), '--version', '0.88.1', '--title', name, '--directory', project,
    '--pm', 'npm', '--skip-install', '--skip-git-init', 'true', '--install-pods', 'false'];
  log?.('Generating React Native 0.88.1 with the Community CLI.');
  await runNpmGenerator(tools['react-native-node'], tools.npm, args, path.dirname(project), 'React Native', log);
  for (const item of ['package.json', 'android', 'ios', 'App.tsx', '__tests__/App.test.tsx']) {
    await fs.access(path.join(project, item)).catch(() => {
      throw new Error('The React Native CLI did not generate the expected ' + item + '.');
    });
  }
  await writeMobileSources(project, name, [
    ['expo-mobile/App.js', 'App.tsx'],
    ['_shared/mobile/ReactNativeApp.test.tsx', '__tests__/App.test.tsx']
  ]);
  const file = path.join(project, 'package.json');
  const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
  delete manifest.dependencies['@react-native/new-app-screen'];
  await fs.writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
}

module.exports = { createReactNativeProject, reactNativeIdentifier };
