const { execFile } = require('node:child_process');
const { constants } = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');

const exec = promisify(execFile);

const toolchains = {
  dotnet: {
    label: '.NET SDK', url: 'https://dotnet.microsoft.com/download',
    instructions: 'Install the current .NET SDK for your operating system.'
  },
  python: {
    label: 'Python 3', url: 'https://www.python.org/downloads/',
    instructions: 'Install the latest stable Python 3 and make python3, python, or the Windows py launcher available.'
  },
  tkinter: {
    label: 'Tkinter', url: 'https://docs.python.org/3/library/tkinter.html',
    instructions: 'Use a Python build that includes Tcl/Tk. On Linux, install your distribution’s Tkinter package for the detected Python.'
  },
  uv: {
    label: 'uv', url: 'https://docs.astral.sh/uv/getting-started/installation/',
    instructions: 'Install uv and make it available on PATH. uv can download the selected Python version.',
    windows: 'winget install --exact --id astral-sh.uv', macos: 'brew install uv'
  },
  conda: {
    label: 'Conda', url: 'https://docs.conda.io/projects/conda/en/latest/user-guide/install/index.html',
    instructions: 'Install Conda through a distribution such as Miniforge. Make conda available to VS Code.'
  },
  virtualenv: {
    label: 'virtualenv', url: 'https://virtualenv.pypa.io/en/latest/installation.html',
    instructions: 'Install virtualenv for the selected interpreter or put the virtualenv command on PATH.'
  },
  rust: {
    label: 'Rust and Cargo', url: 'https://rust-lang.org/tools/install/',
    instructions: 'Install rustup and its stable toolchain. On Windows, also install the C++ build tools if rustup requests them.'
  },
  go: {
    label: 'Go', url: 'https://go.dev/doc/install',
    instructions: 'Install the latest stable Go release for your operating system.',
    windows: 'winget install --exact --id GoLang.Go', macos: 'brew install go'
  },
  swift: {
    label: 'Swift', url: {
      win32: 'https://www.swift.org/install/windows/', darwin: 'https://www.swift.org/install/macos/', linux: 'https://www.swift.org/install/linux/'
    },
    instructions: 'Follow the Swift installer and prerequisite instructions for your operating system.'
  },
  'apple-sdk': {
    label: 'Xcode and macOS SDK', url: 'https://developer.apple.com/xcode/',
    instructions: 'Install the latest compatible Xcode or Command Line Tools and select the active developer directory.',
    macosCommand: 'xcode-select --install'
  },
  java: {
    label: 'Java JDK', url: 'https://adoptium.net/temurin/releases/',
    instructions: 'Install a current JDK, including java and javac. Set JAVA_HOME or add the JDK bin folder to PATH.'
  },
  kotlin: {
    label: 'Kotlin/JVM compiler', url: 'https://kotlinlang.org/docs/command-line.html',
    instructions: 'Download the latest standalone compiler and add its bin folder to PATH.',
    macos: 'brew install kotlin'
  },
  zig: {
    label: 'Zig', url: 'https://ziglang.org/download/',
    instructions: 'Download the latest stable Zig release and add the directory containing zig to PATH.',
    windows: 'winget install --exact --id zig.zig'
  },
  node: {
    label: 'Node.js', url: 'https://nodejs.org/en/download',
    instructions: 'Install the latest Node.js LTS release for your operating system.',
    windows: 'winget install --exact --id OpenJS.NodeJS.LTS'
  },
  'vite-node': {
    label: 'Node.js for Vite', url: 'https://nodejs.org/en/download',
    instructions: 'Install the latest Node.js LTS. Vite requires Node.js 20.19+ on the 20.x line, or 22.12 or newer.',
    windows: 'winget install --exact --id OpenJS.NodeJS.LTS'
  },
  'expo-node': {
    label: 'Node.js for Expo', url: 'https://nodejs.org/en/download',
    instructions: 'Install the current Node.js LTS release. Expo SDK 57 requires Node.js 22.13 or newer.',
    windows: 'winget install --exact --id OpenJS.NodeJS.LTS'
  },
  'react-native-node': {
    label: 'Node.js for React Native', url: 'https://nodejs.org/en/download',
    instructions: 'Install Node.js 22.13+ on the 22.x line, 24.3+ on the 24.x line, or Node.js 26 or newer.',
    windows: 'winget install --exact --id OpenJS.NodeJS.LTS'
  },
  npm: {
    label: 'npm', url: 'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm',
    instructions: 'Install the current Node.js LTS distribution with npm included.'
  },
  cmake: {
    label: 'CMake', url: 'https://cmake.org/download/',
    instructions: 'Install a current CMake release (3.24 or newer) and add it to PATH.'
  },
  'qt-widgets': {
    label: 'Qt 6 Widgets', url: 'https://doc.qt.io/qt-6/qt-online-installation.html',
    instructions: 'Install a Qt 6.5 or newer desktop kit with Widgets and set CMAKE_PREFIX_PATH to its kit folder.'
  },
  'qt-quick': {
    label: 'Qt 6 Quick', url: 'https://doc.qt.io/qt-6/qt-online-installation.html',
    instructions: 'Install a Qt 6.5 or newer desktop kit with Qt Quick and set CMAKE_PREFIX_PATH to its kit folder.'
  },
  'wx-gtk': {
    label: 'wxWidgets or GTK 3 development files', url: 'https://www.wxwidgets.org/docs/faq/linux/',
    instructions: 'Install wxWidgets development files, or install GTK 3 development files so CMake can build wxWidgets.'
  },
  'sdl-desktop': {
    label: 'SDL desktop development files', url: 'https://wiki.libsdl.org/SDL3/README-linux',
    instructions: 'Install the SDL development prerequisites for your Linux distribution, including an X11 or Wayland desktop backend.'
  },
  'opengl-dev': {
    label: 'OpenGL development files', url: 'https://docs.mesa3d.org/install.html',
    instructions: 'Install your Linux distribution’s desktop OpenGL development package.'
  },
  cuda: {
    label: 'NVIDIA CUDA Toolkit', url: 'https://developer.nvidia.com/cuda-downloads',
    instructions: 'Install the CUDA Toolkit and a supported C++ compiler. A compatible NVIDIA GPU and driver are needed to run the sample.'
  },
  'c-compiler': {
    label: 'C compiler',
    url: {
      win32: 'https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio',
      darwin: 'https://developer.apple.com/xcode/',
      linux: 'https://gcc.gnu.org/install/'
    },
    instructions: {
      win32: 'Install Visual Studio Build Tools and select Desktop development with C++.',
      darwin: 'Install Xcode Command Line Tools.',
      linux: 'Install GCC or Clang and the C development tools from your distribution.'
    },
    macosCommand: 'xcode-select --install'
  }
};
toolchains['cpp-compiler'] = { ...toolchains['c-compiler'], label: 'C++ compiler' };

const system = {
  platform: process.platform,
  env: process.env,
  home: os.homedir()
};

function pathDirectories(env) {
  return (env.PATH || '').split(path.delimiter).map(part => part.replace(/^"(.*)"$/, '$1')).filter(part => path.isAbsolute(part));
}

async function subdirectories(root, suffix) {
  if (!root || !path.isAbsolute(root)) return [];
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  return entries.filter(entry => entry.isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))
    .map(entry => path.join(root, entry.name, suffix));
}

async function candidates(names, dirs, platform) {
  const extensions = platform === 'win32' ? ['.exe', '.cmd', '.bat'] : [''];
  const result = [];
  for (const name of names) {
    for (const directory of dirs) {
      for (const extension of extensions) {
        const file = path.join(directory, name + extension);
        if (await fs.access(file, constants.X_OK).then(() => true, () => false)) {
          const info = await fs.stat(file).catch(() => undefined);
          if (info?.isFile()) result.push(file);
        }
      }
    }
  }
  return result;
}

async function commandOutput(file, args, { platform, env, home }) {
  const options = {
    cwd: home, env: { ...env, GOTOOLCHAIN: 'local' },
    windowsHide: true, timeout: 4000, maxBuffer: 256 * 1024
  };
  let executable = file;
  let argumentsList = args;
  if (platform === 'win32' && /\.(?:cmd|bat)$/i.test(file)) {
    executable = env.ComSpec || path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
    options.env.PROJECT_WIZARD_PROBE_FILE = file;
    options.windowsVerbatimArguments = true;
    argumentsList = ['/d', '/v:off', '/s', '/c', '""%PROJECT_WIZARD_PROBE_FILE%" ' + args.join(' ') + '"'];
  }
  const { stdout, stderr } = await exec(executable, argumentsList, options);
  return (stdout + '\n' + stderr).trim();
}

async function detectExecutable(names, args, pattern, dirs, settings, skip = () => false) {
  for (const file of await candidates(names, dirs, settings.platform)) {
    if (skip(file)) continue;
    const output = await commandOutput(file, args, settings).catch(() => '');
    const version = output.match(pattern)?.[1];
    if (version) return { version, file };
  }
}

function atLeast(version, ...minimum) {
  const parts = version.split('.').map(Number);
  for (const [index, value] of minimum.entries()) {
    const part = parts[index] || 0;
    if (part !== value) return part > value;
  }
  return true;
}

function supportsVite(version) {
  return (version.startsWith('20.') && atLeast(version, 20, 19)) || atLeast(version, 22, 12);
}

function supportsReactNative(version) {
  return (version.startsWith('22.') && atLeast(version, 22, 13)) ||
    (version.startsWith('24.') && atLeast(version, 24, 3)) || atLeast(version, 26);
}

function requireVersion(tool, ...minimum) {
  if (tool) return { ...tool, usable: atLeast(tool.version, ...minimum) };
}

async function findPythonVersions(dirs, settings, uv) {
  const { platform } = settings;
  const uvRoot = uv && await commandOutput(uv.file, ['python', 'dir'], settings).catch(() => '');
  const uvDirs = await subdirectories(uvRoot, platform === 'win32' ? '' : 'bin');
  const versioned = platform === 'win32' ? [] : Array.from({ length: 10 }, (_, index) => 'python3.' + (index + 8));
  const files = await candidates(['python3', 'python', ...versioned], [...dirs, ...uvDirs], platform);
  if (platform === 'win32') {
    const launcher = (await candidates(['py'], dirs, platform)).find(file => /\.exe$/i.test(file));
    if (launcher) {
      const list = await commandOutput(launcher, ['-0p'], settings).catch(() => '');
      for (const line of list.split(/\r?\n/)) {
        const file = line.match(/(?:^|\s)([A-Za-z]:[\\/].*?\.exe)\s*$/i)?.[1];
        if (file) files.push(file);
      }
    }
  }
  const realPaths = new Set();
  const unique = [];
  for (const file of files) {
    if (/[\\/]WindowsApps[\\/][^\\/]+$/i.test(file) || /\.(?:cmd|bat)$/i.test(file) ||
        (platform === 'darwin' && !settings.appleSdk && file.startsWith('/usr/bin/'))) continue;
    const resolved = await fs.realpath(file).catch(() => file);
    if (realPaths.has(resolved)) continue;
    realPaths.add(resolved);
    unique.push(file);
  }
  const probed = await Promise.all(unique.slice(0, 24).map(async file => {
    const code = "import importlib.util as u; import sys; print('.'.join(map(str, sys.version_info[:3]))); print(int(bool(u.find_spec('tkinter') and u.find_spec('_tkinter'))), int(bool(u.find_spec('virtualenv'))))";
    const output = await commandOutput(file, ['-I', '-c', code], settings).catch(() => '');
    const match = output.match(/^(3\.\d+\.\d+)\r?\n([01]) ([01])$/m);
    if (match) return { ...requireVersion({ version: match[1], file }, 3, 8), tkinter: match[2] === '1', virtualenv: match[3] === '1' };
  }));
  return probed.filter(Boolean);
}

async function findQt(settings, dirs) {
  const { env, home, platform } = settings;
  const onlineRoots = [path.join(home, 'Qt'), ...(platform === 'win32' ? ['C:\\Qt'] : [])];
  const releases = (await Promise.all(onlineRoots.map(root => subdirectories(root, '')))).flat()
    .filter(root => /^6\.\d+\.\d+$/.test(path.basename(root)));
  const kits = (await Promise.all(releases.map(root => subdirectories(root, '')))).flat()
    .filter(kit => !/^(?:android|ios|wasm)/i.test(path.basename(kit)));
  const qmake = await detectExecutable(['qmake6', 'qmake'], ['-query', 'QT_VERSION'], /^(\d+\.\d+\.\d+)$/, dirs, settings);
  const prefix = qmake && await commandOutput(qmake.file, ['-query', 'QT_INSTALL_PREFIX'], settings).catch(() => '');
  const multiarch = { x64: 'x86_64-linux-gnu', arm64: 'aarch64-linux-gnu' }[process.arch];
  const hints = [
    env.Qt6_DIR, ...(env.CMAKE_PREFIX_PATH || '').split(path.delimiter), prefix, ...kits,
    ...(platform === 'darwin' ? ['/opt/homebrew/opt/qt', '/usr/local/opt/qt'] : []),
    ...(platform === 'linux' ? ['/usr', '/usr/local', ...(multiarch ? ['/usr/lib/' + multiarch + '/cmake/Qt6'] : []), '/usr/lib64/cmake/Qt6'] : [])
  ].filter(hint => hint && path.isAbsolute(hint));
  const result = {};
  for (const hint of new Set(hints)) {
    const config = path.basename(hint).toLowerCase() === 'qt6' ? hint : path.join(hint, 'lib', 'cmake', 'Qt6');
    const versionFiles = await Promise.all(['Qt6ConfigVersion.cmake', 'Qt6ConfigVersionImpl.cmake']
      .map(file => fs.readFile(path.join(config, file), 'utf8').catch(() => '')));
    const version = versionFiles.join('\n').match(/set\(PACKAGE_VERSION\s+"(\d+\.\d+\.\d+)"/)?.[1];
    if (!version || !atLeast(version, 6, 5)) continue;
    for (const module of ['Widgets', 'Quick']) {
      const file = path.join(path.dirname(config), 'Qt6' + module, 'Qt6' + module + 'Config.cmake');
      const id = 'qt-' + module.toLowerCase();
      if (!result[id] && await fs.access(file).then(() => true, () => false)) result[id] = { version, file };
    }
  }
  return result;
}

async function findAppleSdk(settings) {
  if (settings.platform !== 'darwin') return;
  const selected = settings.env.DEVELOPER_DIR ||
    await commandOutput('/usr/bin/xcode-select', ['-p'], settings).catch(() => '');
  if (!selected) return;
  const version = await commandOutput('/usr/bin/xcrun', ['--sdk', 'macosx', '--show-sdk-version'], settings).catch(() => '');
  if (/^\d+(?:\.\d+)+$/.test(version)) return { version, file: '/usr/bin/xcrun' };
}

async function findVisualStudio(settings) {
  if (settings.platform !== 'win32') return;
  const root = settings.env['ProgramFiles(x86)'];
  if (!root) return;
  const file = path.join(root, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = await commandOutput(file, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], settings).catch(() => '');
  if (path.isAbsolute(installation)) return { file, installation };
}

async function findPackageManager(dirs, platform) {
  if (platform === 'darwin' && (await candidates(['brew'], dirs, platform)).length) return 'macos';
  if (platform !== 'win32') return;
  for (const dir of dirs) {
    const file = await fs.lstat(path.join(dir, 'winget.exe')).catch(() => undefined);
    if (file?.isFile() || file?.isSymbolicLink()) return 'windows';
  }
}

async function detectToolchains(settings = system) {
  const { platform, env, home } = settings;
  const fromPath = pathDirectories(env);
  const windows = platform === 'win32';
  const mac = platform === 'darwin';
  const programFiles = env.ProgramFiles;
  const common = [...new Set([
    ...fromPath, path.join(home, '.local', 'bin'), ...(mac ? ['/opt/homebrew/bin', '/usr/local/bin'] : [])
  ])];
  const bin = value => value && path.join(value, 'bin');
  const directories = (...values) => [...new Set([...common, ...values.flat().filter(value => value && path.isAbsolute(value))])];
  const swiftRoot = windows && env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'Programs', 'Swift') : undefined;
  const [appleSdk, studio, pythonInstallations, jdkInstallations, swiftInstallations, cudaInstallations] = await Promise.all([
    findAppleSdk(settings), findVisualStudio(settings),
    windows && env.LOCALAPPDATA ? subdirectories(path.join(env.LOCALAPPDATA, 'Programs', 'Python'), '') : [],
    Promise.all(windows && programFiles ? ['Eclipse Adoptium', 'Java', 'Microsoft'].map(folder => subdirectories(path.join(programFiles, folder), 'bin')) :
      mac ? [subdirectories('/Library/Java/JavaVirtualMachines', 'Contents/Home/bin')] : [subdirectories('/usr/lib/jvm', 'bin')]),
    swiftRoot ? subdirectories(path.join(swiftRoot, 'Toolchains'), 'usr/bin') : [],
    windows && programFiles ? subdirectories(path.join(programFiles, 'NVIDIA GPU Computing Toolkit', 'CUDA'), 'bin') : []
  ]);
  const probe = (names, args, pattern, extra = [], skip) =>
    detectExecutable(names, args, pattern, directories(extra), settings, skip);
  const rustHome = bin(env.CARGO_HOME || path.join(home, '.cargo'));
  const javaDirs = directories(bin(env.JAVA_HOME), jdkInstallations.flat());
  const cmakeDir = studio && path.join(studio.installation, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin');
  const condaRoots = ['miniforge3', 'miniconda3', 'anaconda3'].flatMap(folder =>
    [home, env.LOCALAPPDATA, env.ProgramData, '/opt'].filter(Boolean).map(root => path.join(root, folder)));
  const [uv, conda, virtualenv, rustc, cargo, go, swift, javac, kotlin, zig, node, npm, cmake, compiler, cpp, cuda, qt, manager] = await Promise.all([
    probe(['uv'], ['--version'], /\buv (\d+\.\d+\.\d+)/, [path.join(home, '.cargo', 'bin')]),
    probe(['conda'], ['--version'], /\bconda (\d+\.\d+(?:\.\d+)?)/, [
      env.CONDA_EXE && path.dirname(env.CONDA_EXE),
      ...condaRoots.map(root => path.join(root, windows ? 'Scripts' : 'bin'))
    ], file => /\.(?:cmd|bat)$/i.test(file)),
    probe(['virtualenv'], ['--version'], /\bvirtualenv (\d+\.\d+\.\d+)/, [], file => /\.(?:cmd|bat)$/i.test(file)),
    probe(['rustc'], ['--version'], /rustc (\d+\.\d+\.\d+)/, rustHome),
    probe(['cargo'], ['--version'], /cargo (\d+\.\d+\.\d+)/, rustHome),
    probe(['go'], ['version'], /\bgo(\d+\.\d+(?:\.\d+)?)/, [bin(env.GOROOT), windows && programFiles ? path.join(programFiles, 'Go', 'bin') : '/usr/local/go/bin']),
    probe(['swift'], ['--version'], /Swift version (\d+\.\d+(?:\.\d+)?)/i, [bin(env.SWIFT_HOME), env.SWIFTLY_BIN_DIR, ...swiftInstallations], file => mac && !appleSdk && file === '/usr/bin/swift'),
    detectExecutable(['javac'], ['-version'], /\bjavac (\d+(?:\.\d+)*)/, javaDirs, settings, file => mac && file === '/usr/bin/javac'),
    probe(['kotlinc'], ['-version'], /kotlinc-jvm (\d+\.\d+(?:\.\d+)?)/, [bin(env.KOTLIN_HOME), path.join(home, '.sdkman', 'candidates', 'kotlin', 'current', 'bin')]),
    probe(['zig'], ['version'], /^(\d+\.\d+\.\d+)/, env.ZIG_HOME),
    probe(['node'], ['--version'], /^v(\d+\.\d+\.\d+)/, windows && programFiles ? path.join(programFiles, 'nodejs') : undefined),
    probe(['npm'], ['--version'], /^(\d+\.\d+\.\d+)/, windows && programFiles ? path.join(programFiles, 'nodejs') : undefined),
    probe(['cmake'], ['--version'], /cmake version (\d+\.\d+\.\d+)/i, [cmakeDir, windows && programFiles && path.join(programFiles, 'CMake', 'bin')]),
    !studio && !appleSdk ? probe(['clang', 'gcc'], ['--version'], /(\d+\.\d+(?:\.\d+)?)/, [], file => mac && file === '/usr/bin/clang') : undefined,
    !studio && !appleSdk ? probe(['clang++', 'g++', 'c++'], ['--version'], /(\d+\.\d+(?:\.\d+)?)/, [], file => mac && file === '/usr/bin/clang++') : undefined,
    !mac ? probe(['nvcc'], ['--version'], /\bV(\d+\.\d+\.\d+)/, [bin(env.CUDA_PATH), ...cudaInstallations, '/usr/local/cuda/bin']) : undefined,
    findQt(settings, common),
    findPackageManager(common, platform)
  ]);
  const pythonVersions = await findPythonVersions(directories(pythonInstallations,
    env.VIRTUAL_ENV && path.join(env.VIRTUAL_ENV, windows ? 'Scripts' : 'bin'),
    env.CONDA_PREFIX && path.join(env.CONDA_PREFIX, windows ? '' : 'bin')), { ...settings, appleSdk }, uv);
  const python = pythonVersions.find(runtime => runtime.usable) || pythonVersions[0];
  const tk = pythonVersions.find(runtime => runtime.usable && runtime.tkinter);
  const javaRuntime = javac && await detectExecutable(['java'], ['-version'], /version "(\d+(?:\.\d+)*)/, [path.dirname(javac.file), ...javaDirs], settings, file => mac && file === '/usr/bin/java');
  const systemCompiler = studio ? { version: 'MSVC', file: studio.file } : appleSdk ? { version: 'Apple Clang', file: appleSdk.file } : undefined;
  const virtualenvRuntime = pythonVersions.find(runtime => runtime.usable && runtime.virtualenv);
  const pkgConfig = (module) => probe(['pkg-config', 'pkgconf'], ['--modversion', module], /^(\d+(?:\.\d+)*)/);
  const [wx, gtk, x11, wayland, gl] = platform === 'linux' ? await Promise.all([
    probe(['wx-config'], ['--version'], /^(\d+\.\d+\.\d+)/),
    pkgConfig('gtk+-3.0'), pkgConfig('x11'), pkgConfig('wayland-client'), pkgConfig('gl')
  ]) : [];
  const results = {
    python, uv, conda, virtualenv: virtualenv || virtualenvRuntime && { version: 'Python module', file: virtualenvRuntime.file },
    tkinter: tk && { version: 'with Python ' + tk.version, file: tk.file },
    rust: rustc && cargo && { ...rustc, version: rustc.version + ' / Cargo ' + cargo.version },
    go: requireVersion(go, 1, 20),
    swift: requireVersion(swift, 5, 9),
    'apple-sdk': appleSdk,
    java: javac && javaRuntime ? javac : undefined,
    kotlin,
    zig,
    node: requireVersion(node, 18),
    'vite-node': node && supportsVite(node.version) ? node : undefined,
    'expo-node': requireVersion(node, 22, 13),
    'react-native-node': node && supportsReactNative(node.version) ? node : undefined,
    npm,
    cmake: requireVersion(cmake, 3, 24),
    'c-compiler': systemCompiler || compiler,
    'cpp-compiler': systemCompiler || cpp,
    'wx-gtk': wx || gtk,
    'sdl-desktop': x11 || wayland,
    'opengl-dev': gl,
    cuda,
    ...qt
  };
  return { results, manager, pythonVersions };
}

function templatesForPlatform(templates, platform) {
  return templates.filter(template => !template.platforms || template.platforms.includes(platform));
}

function getSetup(id, platform, manager) {
  if (!Object.hasOwn(toolchains, id)) return;
  const tool = toolchains[id];
  const pick = value => typeof value === 'string' ? value : value[platform] || value.linux;
  return {
    id, label: tool.label, url: pick(tool.url), instructions: pick(tool.instructions),
    command: tool[manager] || (platform === 'darwin' ? tool.macosCommand : undefined)
  };
}

function templateAvailability(template, tools, platform, manager) {
  const supported = !template.platforms || template.platforms.includes(platform);
  const available = { ...tools };
  if (template.language === 'Python' && (tools.uv || tools.conda)) available.python = { usable: true };
  if (template.language === 'Python' && tools.conda) available.tkinter = { usable: true };
  const required = [...(template.tools || []), ...(template.platformTools?.[platform] || [])];
  const missing = required.filter(id => !available[id] || available[id].usable === false).map(id => getSetup(id, platform, manager));
  return { ready: supported && missing.length === 0, supported, missing };
}

module.exports = { detectToolchains, getSetup, supportsReactNative, supportsVite, templateAvailability, templatesForPlatform, toolchains };
