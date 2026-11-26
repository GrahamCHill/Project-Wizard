// Turns the Safari build into an Xcode project with Apple's converter. It needs macOS with Xcode.
// Safari only runs extensions that are packaged inside an app, so this creates that app project for you.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'manifests', 'base.json'), 'utf8'));

if (process.platform !== 'darwin') {
  console.error('Safari extensions are built on a Mac with Xcode. Run `npm run safari` there.');
  process.exit(1);
}

const source = build('safari');
const result = spawnSync('xcrun', [
  'safari-web-extension-converter', source,
  '--project-location', join(root, 'safari'),
  '--app-name', manifest.name,
  // Change this to an identifier that belongs to you before you distribute the app.
  '--bundle-identifier', `com.example.${pkg.name}`,
  '--swift', '--no-open', '--no-prompt', '--force'
], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`\nOpen ${join(root, 'safari', manifest.name, manifest.name + '.xcodeproj')} in Xcode, choose a signing team, and run it.`);
console.log('Then enable the extension in Safari > Settings > Extensions. During development, also turn on Develop > Allow Unsigned Extensions.');
