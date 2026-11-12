const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { replaceTokens } = require('./projects');

const exec = promisify(execFile);

const externalGenerators = [
  {
    id: 'laravel-vue', kind: 'external-generator', group: 'server', language: 'PHP', label: 'Laravel + Vue',
    description: 'Laravel’s official Vue starter with Inertia, TypeScript, and authentication.',
    tools: ['laravel-php', 'composer', 'vite-node', 'npm'], generatorTools: ['laravel-php', 'composer'],
    requirement: 'PHP 8.3+, Composer 2, and Node.js and npm for frontend assets.',
    next: 'Run the setup commands in README.md.'
  },
  {
    id: 'flutter-mobile', kind: 'external-generator', group: 'mobile', language: 'Dart', label: 'Flutter Mobile (Android + iOS)',
    description: 'A Flutter counter app with Android and iOS projects and a widget test.',
    tools: ['flutter', 'git'], generatorTools: ['flutter', 'git'],
    requirement: 'Flutter SDK and Git. Use Android SDK for Android or macOS with Xcode for iOS builds.',
    next: 'Run flutter pub get and follow the generated README.'
  }
];

async function composerCommand(tools) {
  const file = tools.composer.file;
  if (!/\.(?:cmd|bat)$/i.test(file)) return [file];
  const phar = path.join(path.dirname(file), 'composer.phar');
  if (await fs.stat(phar).then(info => info.isFile(), () => false)) return [tools['laravel-php'].file, phar];
  throw new Error('Install Composer with its composer.phar next to composer.bat, or use a Composer executable.');
}

async function createExternalProject(template, name, project, tools, log) {
  if (template.generatorTools.some(id => !tools[id] || tools[id].usable === false)) {
    throw new Error('Install the required generator tools for ' + template.label + '.');
  }
  const laravel = template.id === 'laravel-vue';
  const [file, ...prefix] = laravel ? await composerCommand(tools) : [tools.flutter.file];
  const args = laravel ?
    [...prefix, 'create-project', 'laravel/vue-starter-kit', '.', 'dev-main', '--prefer-dist',
      '--no-install', '--no-scripts', '--no-interaction', '--remove-vcs'] :
    ['create', '--no-pub', '--platforms=android,ios', '--org', 'com.example', '--project-name',
      replaceTokens('app___PROJECT_SNAKE__', name), '.'];
  const env = { ...process.env, CI: '1', FLUTTER_SUPPRESS_ANALYTICS: 'true' };
  const support = laravel ? tools['laravel-php'] : tools.git;
  env.PATH = path.dirname(support.file) + path.delimiter + (process.env.PATH || '');
  const settings = { cwd: project, env, windowsHide: true, timeout: 300000, maxBuffer: 4 * 1024 * 1024 };
  try {
    log?.('Generating ' + template.label + '.');
    const windowsBatch = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(file);
    if (windowsBatch) env.PROJECT_WIZARD_GENERATOR_FILE = file;
    // Flutter's batch arguments are literals and a normalized Dart package name.
    const { stdout, stderr } = windowsBatch ?
      await exec(env.ComSpec || 'cmd.exe', ['/d', '/v:off', '/s', '/c',
        '""%PROJECT_WIZARD_GENERATOR_FILE%" ' + args.join(' ') + '"'], { ...settings, windowsVerbatimArguments: true }) :
      await exec(file, args, settings);
    if (stdout.trim()) log?.(stdout.trim());
    if (stderr.trim()) log?.(stderr.trim());
  } catch (error) {
    log?.([error.stdout, error.stderr].filter(Boolean).join('\n') || error.message);
    throw new Error(template.label + ' generation failed. Open Project Wizard output for details.');
  }

  const expected = laravel ? ['artisan', 'resources/js', 'composer.json', 'package.json'] :
    ['pubspec.yaml', 'lib/main.dart', 'android', 'ios', 'test/widget_test.dart'];
  for (const item of expected) {
    await fs.access(path.join(project, item)).catch(() => {
      throw new Error(template.label + ' did not create ' + item + '.');
    });
  }
  if (await fs.lstat(path.join(project, '.git')).then(() => true, error => {
    if (error.code !== 'ENOENT') throw error;
    return false;
  })) throw new Error(template.label + ' initialized Git during scaffolding.');

  const instructions = laravel ? [
    'Use PHP with SQLite, mbstring, and the other Laravel extensions, plus Composer and npm.',
    '',
    '~~~sh',
    'php -r "file_exists(\'database/database.sqlite\') || touch(\'database/database.sqlite\');"',
    'composer setup',
    'php artisan serve',
    '~~~',
    '',
    'Open http://127.0.0.1:8000. Run npm run dev in a second terminal for Vue hot reload. Run php artisan test after setup.'
  ] : [
    '~~~sh', 'flutter pub get', 'flutter test', 'flutter run', '~~~', '',
    'Use an Android emulator or connected device for Android. Build and run the iOS target on macOS with Xcode.'
  ];
  await fs.appendFile(path.join(project, 'README.md'), '\n## Run locally\n\n' + instructions.join('\n') + '\n');
}

module.exports = { createExternalProject, externalGenerators };
