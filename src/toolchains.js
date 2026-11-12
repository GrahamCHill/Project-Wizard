const { execFile } = require('node:child_process');
const { constants } = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');

const exec = promisify(execFile);

const toolchains = {
  git: {
    label: 'Git', url: 'https://git-scm.com/install/',
    instructions: 'Install Git and restart VS Code if the installer changes PATH.',
    windows: 'winget install --exact --id Git.Git', macos: 'brew install git'
  },
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
  'java-17': {
    label: 'JDK 17 or newer', url: 'https://adoptium.net/temurin/releases/',
    instructions: 'Install a compatible JDK and set JAVA_HOME so Maven or Gradle uses it.'
  },
  maven: {
    label: 'Apache Maven', url: 'https://maven.apache.org/install.html',
    instructions: 'Install the latest stable Maven release and add its bin folder to PATH or set MAVEN_HOME.',
    macos: 'brew install maven'
  },
  emscripten: {
    label: 'Emscripten SDK', url: 'https://emscripten.org/docs/getting_started/downloads.html',
    instructions: 'Install and activate the latest Emscripten SDK. Load emsdk_env in your shell, then launch VS Code from that shell to detect the toolchain.'
  },
  'emscripten-generator': {
    label: 'Ninja or MinGW Make', url: 'https://ninja-build.org/',
    instructions: 'Install Ninja or MinGW Make and add it to PATH so emcmake can select a generator on Windows.',
    windows: 'winget install --exact --id Ninja-build.Ninja'
  },
  kotlin: {
    label: 'Kotlin/JVM compiler', url: 'https://kotlinlang.org/docs/command-line.html',
    instructions: 'Download the latest standalone compiler and add its bin folder to PATH.',
    macos: 'brew install kotlin'
  },
  gradle: {
    label: 'Gradle', url: 'https://docs.gradle.org/current/userguide/installation.html',
    instructions: 'Install the latest stable Gradle release and add its bin folder to PATH or set GRADLE_HOME.'
  },
  'kmp-gradle': {
    label: 'Gradle', url: 'https://gradle.org/releases/',
    instructions: 'Install a compatible Gradle 9.0–9.7 release and add its bin folder to PATH or set GRADLE_HOME. Run Gradle with a compatible JDK 17 or newer.'
  },
  'android-gradle': {
    label: 'Gradle for Android', url: 'https://gradle.org/releases/',
    instructions: 'Install Gradle 9.3.1 or newer. Use a compatible JDK 17+ and add Gradle to PATH or set GRADLE_HOME.'
  },
  'android-xr-gradle': {
    label: 'Gradle for Android XR', url: 'https://gradle.org/releases/',
    instructions: 'Install Gradle 9.5 or newer. Use a compatible JDK 17+ and add Gradle to PATH or set GRADLE_HOME.'
  },
  'android-sdk': {
    label: 'Android SDK 37', url: 'https://developer.android.com/studio/intro/update#sdk-manager',
    instructions: 'In Android Studio’s SDK Manager install the Android 37 SDK Platform and Build-Tools 37.0.0. Set ANDROID_HOME to the SDK folder.'
  },
  'android-ndk': {
    label: 'Android NDK r28c', url: 'https://developer.android.com/studio/projects/install-ndk',
    instructions: 'In Android Studio’s SDK Tools tab enable Show Package Details and install NDK (Side by side) 28.2.13676358.'
  },
  'android-cmake': {
    label: 'Android SDK CMake', url: 'https://developer.android.com/studio/projects/install-ndk',
    instructions: 'In Android Studio’s SDK Tools tab enable Show Package Details and install CMake 3.31.6.'
  },
  ruby: {
    label: 'Ruby', url: { win32: 'https://rubyinstaller.org/downloads/', linux: 'https://www.ruby-lang.org/en/downloads/' },
    instructions: 'Install the latest stable Ruby (3.0 or newer) and add ruby to PATH. On Windows, choose Ruby+Devkit for gems with native extensions.'
  },
  bundler: {
    label: 'Bundler', url: 'https://bundler.io/',
    instructions: 'Install Bundler for the selected Ruby with gem install bundler and make bundle available on PATH.'
  },
  php: {
    label: 'PHP', url: { win32: 'https://www.php.net/downloads.php?os=windows', linux: 'https://www.php.net/downloads' },
    instructions: 'Install a current PHP 8 release with its CLI and add php to PATH.'
  },
  lua: {
    label: 'Lua', url: 'https://www.lua.org/download.html',
    instructions: 'Install the latest Lua interpreter and make its executable available on PATH.',
    macos: 'brew install lua'
  },
  love: {
    label: 'LÖVE', url: 'https://love2d.org/',
    instructions: 'Install a current LÖVE release and add its command-line executable to PATH.'
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
  'next-node': {
    label: 'Node.js for Next.js', url: 'https://nodejs.org/en/download',
    instructions: 'Install the current Node.js LTS release. Next.js requires Node.js 20.9 or newer.'
  },
  'nuxt-node': {
    label: 'Node.js for Nuxt', url: 'https://nodejs.org/en/download',
    instructions: 'Install Node.js 22.22.3+ on 22.x, 24.15+ on 24.x, or Node.js 26 or newer.'
  },
  'electron-node': {
    label: 'Node.js for Electron Forge', url: 'https://nodejs.org/en/download',
    instructions: 'Install the current Node.js LTS release. This Electron starter requires Node.js 22.13 or newer.'
  },
  'tauri-windows': {
    label: 'Tauri Windows prerequisites', url: 'https://v2.tauri.app/start/prerequisites/#windows',
    instructions: 'Install Visual Studio C++ Build Tools and Microsoft Edge WebView2 Runtime. Use the MSVC Rust toolchain.'
  },
  'tauri-linux': {
    label: 'Tauri Linux development files', url: 'https://v2.tauri.app/start/prerequisites/#linux',
    instructions: 'Install your distribution’s WebKitGTK 4.1, OpenSSL, and other development packages listed in the Tauri guide.'
  },
  gtk4: {
    label: 'GTK 4 development files', url: 'https://www.gtk.org/docs/installations/',
    instructions: {
      linux: 'Install the GTK 4 development package and pkg-config (libgtk-4-dev on Debian or Ubuntu).',
      darwin: 'Install GTK 4 and pkgconf, for example with brew install gtk4 pkgconf.',
      win32: 'In MSYS2 UCRT64, install mingw-w64-ucrt-x86_64-gtk4, gcc, cmake, ninja, and pkgconf from the same UCRT64 package family. Open VS Code from that shell.'
    }
  },
  'gtkmm-4.0': {
    label: 'GTKmm 4 development files', url: 'https://www.gtk.org/docs/language-bindings/cpp/',
    instructions: {
      linux: 'Install the GTKmm 4 development package and pkg-config (libgtkmm-4.0-dev on Debian or Ubuntu).',
      darwin: 'Install GTKmm 4 and pkgconf, for example with brew install gtkmm4 pkgconf.',
      win32: 'In MSYS2 UCRT64, install mingw-w64-ucrt-x86_64-gtkmm-4.0, gcc, cmake, ninja, and pkgconf from the same UCRT64 package family. Open VS Code from that shell.'
    }
  },
  'godot-editor': {
    label: 'Godot 4 Editor', url: 'https://godotengine.org/download/',
    instructions: 'Install Godot 4.3 or newer. Put godot on PATH or set GODOT_PATH to the full path of the Godot executable.'
  },
  'unity-editor': {
    label: 'Unity Editor', url: 'https://unity.com/download',
    instructions: 'Install Unity Hub and a Unity 6.3 or newer Editor. For a custom installation, set UNITY_EDITOR_PATH to the editor executable.'
  },
  'unreal-editor': {
    label: 'Unreal Editor', url: 'https://www.unrealengine.com/download',
    instructions: 'Install Unreal Engine 5.3 or newer and its required C++ build tools. For a custom install, set UNREAL_ENGINE_ROOT to the directory that contains Engine.'
  },
  blender: {
    label: 'Blender 4.2+', url: 'https://www.blender.org/download/',
    instructions: 'Install a current Blender release. Add blender to PATH or set BLENDER_PATH to the Blender executable.'
  },
  'godot-rust': {
    label: 'Rust 1.94+ and Cargo', url: 'https://rust-lang.org/tools/install/',
    instructions: 'Install or update the stable Rust toolchain with rustup. Build for the same architecture as the Godot editor.'
  },
  'laravel-php': {
    label: 'PHP 8.3+ for Laravel', url: 'https://laravel.com/docs/13.x/installation',
    instructions: 'Install PHP 8.3 or newer and enable the required Laravel extensions, including SQLite and mbstring.'
  },
  composer: {
    label: 'Composer 2', url: 'https://getcomposer.org/download/',
    instructions: 'Install Composer 2 and add it to PATH. On Windows use the Composer installer with your PHP executable.'
  },
  latex: {
    label: 'pdfLaTeX and BibTeX', url: {
      win32: 'https://miktex.org/download', darwin: 'https://tug.org/mactex/', linux: 'https://tug.org/texlive/'
    },
    instructions: 'Install a TeX distribution with pdflatex and bibtex, and make both available on PATH.'
  },
  'ml-python': {
    label: 'Python 3.11+ or a Python environment manager', url: 'https://www.python.org/downloads/',
    instructions: 'Install a compatible Python interpreter or use uv or Conda to download one into a project-local environment.'
  },
  ollama: {
    label: 'Ollama', url: 'https://ollama.com/download',
    instructions: 'Install and start Ollama, then pull a model to use with the local chat example.'
  },
  'ios-sdk': {
    label: 'Xcode and iOS SDK', url: 'https://developer.apple.com/xcode/',
    instructions: 'Install Xcode and its iOS platform support. Select Xcode as the active developer directory.'
  },
  xcodegen: {
    label: 'XcodeGen', url: 'https://github.com/yonaskolb/XcodeGen#installing',
    instructions: 'Install XcodeGen to generate the Xcode project from project.yml.', macos: 'brew install xcodegen'
  },
  flutter: {
    label: 'Flutter SDK', url: 'https://docs.flutter.dev/install',
    instructions: 'Install the stable Flutter SDK and put its bin directory on PATH or set FLUTTER_ROOT. Run flutter doctor for Android and iOS setup.'
  },
  'compose-gradle': {
    label: 'Gradle for Android Compose', url: 'https://gradle.org/releases/',
    instructions: 'Install Gradle 9.5 or newer and set GRADLE_HOME or add Gradle to PATH. Use a compatible JDK 17 or newer.'
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
  'vulkan-dev': {
    label: 'Vulkan development files', url: 'https://vulkan.lunarg.com/sdk/home',
    instructions: {
      win32: 'Install the Vulkan SDK and restart VS Code so VULKAN_SDK is set. Use a graphics driver with Vulkan support.',
      darwin: 'Install the Vulkan SDK with MoltenVK. Set up the SDK environment for VS Code and your build shell.',
      linux: 'Install your distribution’s Vulkan loader development package and a Vulkan driver, or install and activate the Vulkan SDK.'
    }
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

function supportsNuxt(version) {
  return (version.startsWith('22.') && atLeast(version, 22, 22, 3)) ||
    (version.startsWith('24.') && atLeast(version, 24, 15)) || atLeast(version, 26);
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

async function findAndroidTools({ env, home, platform }) {
  const defaultSdk = platform === 'win32' && env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'Android', 'Sdk') :
    platform === 'darwin' ? path.join(home, 'Library', 'Android', 'sdk') : path.join(home, 'Android', 'Sdk');
  const roots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, defaultSdk].filter(root => root && path.isAbsolute(root));
  const exists = file => fs.access(file).then(() => true, () => false);
  const exe = name => platform === 'win32' ? name + '.exe' : name;
  for (const root of new Set(roots)) {
    const platformFiles = ['android-37.0', 'android-37'].map(id => path.join(root, 'platforms', id, 'android.jar'));
    const buildTools = path.join(root, 'build-tools', '37.0.0', exe('aapt2'));
    const ndk = path.join(root, 'ndk', '28.2.13676358', 'build', 'cmake', 'android.toolchain.cmake');
    const cmake = path.join(root, 'cmake', '3.31.6', 'bin', exe('cmake'));
    const [rootExists, modern, legacy, build, native, cmakeFound] = await Promise.all(
      [root, ...platformFiles, buildTools, ndk, cmake].map(exists));
    if (rootExists) return {
      'android-sdk': (modern || legacy) && build ? { version: '37', file: root } : undefined,
      'android-ndk': native ? { version: '28.2.13676358', file: ndk } : undefined,
      'android-cmake': cmakeFound ? { version: '3.31.6', file: cmake } : undefined
    };
  }
}

async function findVulkanSdk({ env, platform }) {
  const root = env.VULKAN_SDK;
  if (!root || !path.isAbsolute(root)) return;
  const windows = platform === 'win32';
  const header = path.join(root, windows ? 'Include' : 'include', 'vulkan', 'vulkan_core.h');
  const loaders = windows ? ['Lib/vulkan-1.lib', 'Lib32/vulkan-1.lib'] :
    platform === 'darwin' ? ['lib/libvulkan.dylib'] : ['lib/libvulkan.so', 'lib64/libvulkan.so'];
  const [contents, ...libraries] = await Promise.all([
    fs.readFile(header, 'utf8').catch(() => ''),
    ...loaders.map(file => fs.access(path.join(root, file)).then(() => true, () => false))
  ]);
  if (!contents || !libraries.some(Boolean)) return;
  const patch = contents.match(/^#define VK_HEADER_VERSION\s+(\d+)/m)?.[1];
  const version = contents.match(/^#define VK_HEADER_VERSION_COMPLETE\s+VK_MAKE_API_VERSION\(\s*\d+,\s*(\d+),\s*(\d+)/m);
  return { version: version && patch ? `${version[1]}.${version[2]}.${patch}` : 'SDK', file: root };
}

async function findGameEditors(settings, probe) {
  const { env, home, platform } = settings;
  const windows = platform === 'win32';
  const mac = platform === 'darwin';
  const programFiles = env.ProgramFiles || 'C:/Program Files';
  const isFile = file => file && path.isAbsolute(file) && fs.stat(file).then(stat => stat.isFile(), () => false);
  const unityRoot = windows ? path.join(programFiles, 'Unity', 'Hub', 'Editor') :
    mac ? '/Applications/Unity/Hub/Editor' : path.join(home, 'Unity', 'Hub', 'Editor');
  const unitySuffix = windows ? 'Editor/Unity.exe' : mac ? 'Unity.app/Contents/MacOS/Unity' : 'Editor/Unity';
  const unrealRoot = windows ? path.join(programFiles, 'Epic Games') : '/Users/Shared/Epic Games';
  const unrealSuffix = windows ? 'Engine/Binaries/Win64/UnrealEditor.exe' :
    mac ? 'Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor' : 'Engine/Binaries/Linux/UnrealEditor';
  const godotVersion = /^(\d+\.\d+(?:\.\d+)?)\./m;
  const [unityFiles, unrealRoots, godotOnPath, godotCustom] = await Promise.all([
    subdirectories(unityRoot, unitySuffix),
    (windows || mac) ? subdirectories(unrealRoot, '') : [],
    probe(['godot', 'godot4', 'Godot'], ['--version'], godotVersion,
      mac ? '/Applications/Godot.app/Contents/MacOS' : []),
    (async () => {
      const file = env.GODOT_PATH;
      if (!await isFile(file)) return;
      const output = await commandOutput(file, ['--version'], settings).catch(() => '');
      const version = output.match(godotVersion)?.[1];
      if (version) return { version, file };
    })()
  ]);
  let unity;
  for (const file of [env.UNITY_EDITOR_PATH, ...unityFiles]) {
    if (!await isFile(file)) continue;
    const editorVersion = file.match(/(?:^|[/\\])(\d{4}\.\d+\.\d+f\d+)(?=[/\\])/i)?.[1];
    if (!editorVersion && file !== env.UNITY_EDITOR_PATH) continue;
    if (editorVersion && !atLeast(editorVersion.split('f')[0], 6000, 3)) continue;
    unity = { file, editorVersion, version: editorVersion || 'Custom installation' };
    break;
  }
  let unreal;
  for (const root of [env.UNREAL_ENGINE_ROOT, ...unrealRoots]) {
    if (!root || !path.isAbsolute(root)) continue;
    const file = path.join(root, unrealSuffix);
    if (!await isFile(file)) continue;
    const build = await fs.readFile(path.join(root, 'Engine', 'Build', 'Build.version'), 'utf8')
      .then(data => JSON.parse(data.replace(/^\uFEFF/, ''))).catch(() => undefined);
    if (!Number.isInteger(build?.MajorVersion) || !Number.isInteger(build?.MinorVersion) || build.MajorVersion !== 5 || build.MinorVersion < 3) continue;
    const release = `${build.MajorVersion}.${build.MinorVersion}`;
    const association = unrealRoots.includes(root) ? release : '';
    unreal = { file, version: release + '.' + (Number.isInteger(build.PatchVersion) ? build.PatchVersion : 0), association };
    break;
  }
  return { 'unity-editor': unity, 'unreal-editor': unreal, 'godot-editor': requireVersion(godotCustom || godotOnPath, 4, 3) };
}

async function findWebView(settings) {
  const { env } = settings;
  const roots = [env['ProgramFiles(x86)'], env.ProgramFiles, env.LOCALAPPDATA].filter(Boolean);
  for (const root of roots) {
    for (const file of await subdirectories(path.join(root, 'Microsoft', 'EdgeWebView', 'Application'), 'msedgewebview2.exe')) {
      if (await fs.stat(file).then(stat => stat.isFile(), () => false)) return { version: path.basename(path.dirname(file)), file };
    }
  }
}

async function findSupplementalTools(settings, probe, directories, appleSdk) {
  const { env, home, platform } = settings;
  const windows = platform === 'win32';
  const mac = platform === 'darwin';
  const blenderFolders = windows && env.ProgramFiles ?
    await subdirectories(path.join(env.ProgramFiles, 'Blender Foundation'), '') : [];
  const flutterFolders = directories(env.FLUTTER_ROOT && path.join(env.FLUTTER_ROOT, 'bin'),
    path.join(home, 'flutter', 'bin'), path.join(home, 'development', 'flutter', 'bin'));
  const [blender, composer, latex, ollama, xcodegen, iosVersion, flutterFiles] = await Promise.all([
    probe(['blender'], ['--version'], /\bBlender (\d+\.\d+(?:\.\d+)?)/i, [
      ...blenderFolders, mac && '/Applications/Blender.app/Contents/MacOS',
      env.BLENDER_PATH && path.dirname(env.BLENDER_PATH)
    ]),
    probe(['composer'], ['--version'], /Composer(?: version)?\s+(\d+\.\d+\.\d+)/i),
    probe(['pdflatex'], ['--version'], /pdfTeX[^\r\n]*?(\d+\.\d+(?:\.\d+)?)/i),
    probe(['ollama'], ['--version'], /\bversion(?: is)?\s+(\d+\.\d+\.\d+)/i, [
      windows && env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Ollama'),
      mac && '/Applications/Ollama.app/Contents/Resources'
    ]),
    mac ? probe(['xcodegen'], ['--version'], /(\d+\.\d+\.\d+)/) : undefined,
    mac && appleSdk ? commandOutput('/usr/bin/xcrun', ['--sdk', 'iphoneos', '--show-sdk-version'], settings).catch(() => '') : '',
    candidates(['flutter'], flutterFolders, platform)
  ]);
  const bibtex = latex && (await candidates(['bibtex'], directories(path.dirname(latex.file)), platform))[0];
  let flutter;
  if (flutterFiles.length) {
    const file = flutterFiles[0];
    const resolved = await fs.realpath(file).catch(() => file);
    const metadata = await fs.readFile(path.join(path.dirname(resolved), 'cache', 'flutter.version.json'), 'utf8')
      .then(JSON.parse).catch(() => undefined);
    flutter = { file, version: typeof metadata?.frameworkVersion === 'string' ? metadata.frameworkVersion : 'SDK found' };
  }
  return {
    blender: requireVersion(blender, 4, 2),
    composer: requireVersion(composer, 2),
    latex: bibtex ? latex : undefined,
    ollama, xcodegen, flutter,
    'ios-sdk': /^\d+(?:\.\d+)+$/.test(iosVersion) ? { version: iosVersion, file: '/usr/bin/xcrun' } : undefined
  };
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
  const rubyDirs = [bin(env.RUBY_HOME), path.join(home, '.rbenv', 'shims')];
  const additionalTools = Promise.all([
    probe(['git'], ['--version'], /\bgit version (\d+\.\d+\.\d+)/i, [
      windows && programFiles && path.join(programFiles, 'Git', 'cmd'),
      windows && env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Git', 'cmd')
    ], file => /\.(?:cmd|bat)$/i.test(file) || (mac && !appleSdk && file === '/usr/bin/git')),
    probe(['ruby'], ['--version'], /\bruby (\d+\.\d+\.\d+)/, rubyDirs),
    probe(['bundle', 'bundler'], ['--version'], /\bBundler version (\d+\.\d+\.\d+)/i, rubyDirs),
    probe(['php'], ['--version'], /\bPHP (\d+\.\d+\.\d+)/, env.PHP_HOME),
    probe(['lua', 'lua5.5', 'lua5.4', 'lua5.3', 'lua5.2', 'lua5.1', 'lua55', 'lua54', 'lua53', 'luajit'],
      ['-v'], /\bLua(?:JIT)? (\d+\.\d+(?:\.\d+)?)/, env.LUA_HOME),
    probe(windows ? ['lovec', 'love'] : ['love'], ['--version'], /\bL[OÖ]VE (\d+\.\d+(?:\.\d+)?)/i,
      [windows && programFiles && path.join(programFiles, 'LOVE'), mac && '/Applications/love.app/Contents/MacOS']),
    probe(['gradle'], ['--version'], /\bGradle (\d+\.\d+(?:\.\d+)?)/,
      [bin(env.GRADLE_HOME), path.join(home, '.sdkman', 'candidates', 'gradle', 'current', 'bin')]),
    probe(['mvn'], ['--version'], /\bApache Maven (\d+\.\d+\.\d+)/,
      [bin(env.MAVEN_HOME), bin(env.M2_HOME), path.join(home, '.sdkman', 'candidates', 'maven', 'current', 'bin')]),
    probe(['emcc'], ['--version'], /\bemcc[^\r\n]*?\b(\d+\.\d+\.\d+)/,
      [env.EMSDK && path.join(env.EMSDK, 'upstream', 'emscripten')]),
    findAndroidTools(settings)
  ]);
  const [uv, conda, virtualenv, rustc, cargo, go, swift, javac, kotlin, zig, node, npm, cmake, compiler, cpp, cuda, qt, manager,
    [git, ruby, bundler, php, lua, love, gradle, maven, emscripten, android], vulkanSdk] = await Promise.all([
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
    findPackageManager(common, platform),
    additionalTools,
    findVulkanSdk(settings)
  ]);
  const pythonVersions = await findPythonVersions(directories(pythonInstallations,
    env.VIRTUAL_ENV && path.join(env.VIRTUAL_ENV, windows ? 'Scripts' : 'bin'),
    env.CONDA_PREFIX && path.join(env.CONDA_PREFIX, windows ? '' : 'bin')), { ...settings, appleSdk }, uv);
  const python = pythonVersions.find(runtime => runtime.usable) || pythonVersions[0];
  const tk = pythonVersions.find(runtime => runtime.usable && runtime.tkinter);
  const javaRuntime = javac && await detectExecutable(['java'], ['-version'], /version "(\d+(?:\.\d+)*)/, [path.dirname(javac.file), ...javaDirs], settings, file => mac && file === '/usr/bin/java');
  const emcmake = emscripten && (await candidates(['emcmake'], directories(path.dirname(emscripten.file)), platform))[0];
  const emscriptenGenerator = windows && await probe(['ninja', 'mingw32-make'], ['--version'], /^(?:GNU Make )?(\d+\.\d+(?:\.\d+)?)/);
  const systemCompiler = studio ? { version: 'MSVC', file: studio.file } : appleSdk ? { version: 'Apple Clang', file: appleSdk.file } : undefined;
  const virtualenvRuntime = pythonVersions.find(runtime => runtime.usable && runtime.virtualenv);
  const pkgConfig = (module) => probe(['pkg-config', 'pkgconf'], ['--modversion', module], /^(\d+(?:\.\d+)*)/);
  const linuxGraphics = platform === 'linux' ? Promise.all([
    probe(['wx-config'], ['--version'], /^(\d+\.\d+\.\d+)/),
    pkgConfig('gtk+-3.0'), pkgConfig('x11'), pkgConfig('wayland-client'), pkgConfig('gl')
  ]) : [];
  const gtkKit = async (module, compilerName) => {
    const kit = await pkgConfig(module);
    if (!windows || !kit) return kit;
    const tools = path.dirname(kit.file);
    const required = await Promise.all([compilerName, 'ninja', 'cmake'].map(name => candidates([name], [tools], platform)));
    return required.every(files => files.length) ? kit : undefined;
  };
  const [[wx, gtk, x11, wayland, gl], gtk4, gtkmm, webkit, ssl, webView, editors, supplemental] = await Promise.all([
    linuxGraphics, gtkKit('gtk4', 'gcc'), gtkKit('gtkmm-4.0', 'g++'),
    platform === 'linux' ? pkgConfig('webkit2gtk-4.1') : undefined,
    platform === 'linux' ? pkgConfig('openssl') : undefined,
    windows && studio ? findWebView(settings) : undefined,
    findGameEditors(settings, probe),
    findSupplementalTools(settings, probe, directories, appleSdk)
  ]);
  const results = {
    git,
    python, uv, conda, virtualenv: virtualenv || virtualenvRuntime && { version: 'Python module', file: virtualenvRuntime.file },
    tkinter: tk && { version: 'with Python ' + tk.version, file: tk.file },
    rust: rustc && cargo && { ...rustc, version: rustc.version + ' / Cargo ' + cargo.version },
    go: requireVersion(go, 1, 20),
    swift: requireVersion(swift, 5, 9),
    'apple-sdk': appleSdk,
    java: javac && javaRuntime ? javac : undefined,
    'java-17': javac && javaRuntime ? requireVersion(javac, 17) : undefined,
    maven: requireVersion(maven, 3, 9),
    emscripten: emcmake ? requireVersion(emscripten, 3, 1) : undefined,
    'emscripten-generator': emscriptenGenerator || undefined,
    kotlin,
    gradle: requireVersion(gradle, 8, 5),
    'kmp-gradle': gradle && { ...gradle, usable: atLeast(gradle.version, 9) && !atLeast(gradle.version, 9, 8) },
    'android-gradle': requireVersion(gradle, 9, 3, 1),
    'android-xr-gradle': requireVersion(gradle, 9, 5),
    'compose-gradle': requireVersion(gradle, 9, 5),
    'godot-rust': rustc && cargo ? requireVersion(rustc, 1, 94) : undefined,
    'laravel-php': requireVersion(php, 8, 3),
    'ml-python': pythonVersions.find(runtime => runtime.usable && atLeast(runtime.version, 3, 11)),
    ...android,
    ruby: requireVersion(ruby, 3), bundler, php: requireVersion(php, 8), lua, love: requireVersion(love, 11),
    zig,
    node: requireVersion(node, 18),
    'vite-node': node && supportsVite(node.version) ? node : undefined,
    'expo-node': requireVersion(node, 22, 13),
    'react-native-node': node && supportsReactNative(node.version) ? node : undefined,
    'next-node': requireVersion(node, 20, 9),
    'nuxt-node': node && { ...node, usable: supportsNuxt(node.version) },
    'electron-node': requireVersion(node, 22, 13),
    'tauri-windows': webView,
    'tauri-linux': ssl ? webkit : undefined,
    gtk4, 'gtkmm-4.0': gtkmm,
    npm,
    cmake: requireVersion(cmake, 3, 24),
    'c-compiler': systemCompiler || compiler,
    'cpp-compiler': systemCompiler || cpp,
    'wx-gtk': wx || gtk,
    'sdl-desktop': x11 || wayland,
    'opengl-dev': gl,
    'vulkan-dev': requireVersion(vulkanSdk || (!windows ? await pkgConfig('vulkan') : undefined), 1, 3, 216),
    cuda,
    ...qt,
    ...editors,
    ...supplemental
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
  if (template.language === 'Python' && (tools.uv || tools.conda)) {
    available.python = { usable: true };
    available['ml-python'] = { usable: true };
  }
  if (template.language === 'Python' && tools.conda) available.tkinter = { usable: true };
  const required = [...(template.tools || []), ...(template.platformTools?.[platform] || [])];
  const missing = required.filter(id => !available[id] || available[id].usable === false).map(id => getSetup(id, platform, manager));
  return { ready: supported && missing.length === 0, supported, missing };
}

module.exports = { detectToolchains, getSetup, supportsReactNative, supportsVite, templateAvailability, templatesForPlatform, toolchains };
