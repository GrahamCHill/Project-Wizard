const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { replaceTokens } = require('./projects');
const { writeMobileSources } = require('./mobile-starters');

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
    description: 'A Flutter app with Home and About tabs, Android and iOS projects, and a widget test.',
    tools: ['flutter', 'git'], generatorTools: ['flutter', 'git'],
    flutterPlatforms: ['android', 'ios'],
    requirement: 'Flutter SDK and Git. Use Android SDK for Android or macOS with Xcode for iOS builds.',
    next: 'Run flutter pub get and follow the generated README.'
  },
  {
    id: 'flutter-desktop', kind: 'external-generator', group: 'desktop', language: 'Dart', label: 'Flutter Desktop',
    description: 'A two-screen Flutter app with native Windows, macOS, and Linux runners and a widget test.',
    tools: ['flutter', 'git'], generatorTools: ['flutter', 'git'],
    flutterPlatforms: ['windows', 'macos', 'linux'],
    platformTools: { win32: ['flutter-windows'], darwin: ['flutter-macos'], linux: ['flutter-linux'] },
    requirement: 'Flutter SDK and Git. Use flutter doctor to check your operating system’s desktop build tools.',
    next: 'Follow the generated README for desktop builds and distribution.'
  },
  {
    id: 'flutter-web', kind: 'external-generator', group: 'frontend', language: 'Dart', label: 'Flutter Web',
    description: 'A two-screen Flutter app with a browser runner, static web build, and a widget test.',
    tools: ['flutter', 'git'], generatorTools: ['flutter', 'git'],
    flutterPlatforms: ['web'],
    requirement: 'Flutter SDK, Git, and a browser.',
    next: 'Run flutter pub get and follow the generated README.'
  }
];

const flutterInstructions = {
  'flutter-mobile': [
    '~~~sh', 'flutter pub get', 'flutter test', 'flutter run', '~~~', '',
    'Use an Android emulator or connected device for Android. Build and run the iOS target on macOS with Xcode.'
  ],
  'flutter-desktop': [
    '~~~sh', 'flutter doctor', 'flutter pub get', 'flutter test', 'flutter run', '~~~', '',
    '## Distribution', '',
    'Run the build command for the operating system you are using. Share the complete output directory or macOS app bundle so the Flutter engine, plugin libraries, and assets travel with the app.', '',
    '- Windows: `flutter build windows`. Share `build/windows/<arch>/runner/Release/`, including the Visual C++ runtime files copied from the build toolchain.',
    '- macOS: `flutter build macos`. Share the `.app` under `build/macos/Build/Products/Release/`. Flutter embeds its frameworks and any native plugin dependencies in the bundle.',
    '- Linux: `flutter build linux`. Share `build/linux/<arch>/release/bundle/` on a compatible Linux distribution.'
  ],
  'flutter-web': [
    '~~~sh', 'flutter pub get', 'flutter test', 'flutter run -d web-server', '~~~', '',
    'Open the URL printed by Flutter. Run `flutter build web` and serve the complete `build/web/` directory over HTTP.'
  ]
};

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
    ['create', '--no-pub', '--platforms=' + template.flutterPlatforms.join(','), '--org', 'com.example', '--project-name',
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
    ['pubspec.yaml', 'lib/main.dart', 'test/widget_test.dart', ...template.flutterPlatforms];
  for (const item of expected) {
    await fs.access(path.join(project, item)).catch(() => {
      throw new Error(template.label + ' did not create ' + item + '.');
    });
  }
  if (!laravel) {
    await writeMobileSources(project, name, [
      ['_shared/mobile/main.dart', 'lib/main.dart'],
      ['_shared/mobile/widget_test.dart', 'test/widget_test.dart']
    ]);
    if (template.id === 'flutter-desktop') {
      await fs.appendFile(path.join(project, 'windows/CMakeLists.txt'), '\n' + [
        'set(CMAKE_INSTALL_SYSTEM_RUNTIME_DESTINATION "${INSTALL_BUNDLE_LIB_DIR}")',
        'set(CMAKE_INSTALL_SYSTEM_RUNTIME_COMPONENT Runtime)',
        'include(InstallRequiredSystemLibraries)', ''
      ].join('\n'));
    }
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
  ] : flutterInstructions[template.id];
  await fs.appendFile(path.join(project, 'README.md'), '\n## Run locally\n\n' + instructions.join('\n') + '\n');
}

module.exports = { createExternalProject, externalGenerators };
