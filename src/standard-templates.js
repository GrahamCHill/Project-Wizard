function starter(id, group, language, label, description, tools, files, commands, options = {}) {
  return {
    id, group, language, label, description, tools, files, commands, kind: 'starter',
    requirement: options.requirement,
    platforms: options.platforms,
    platformTools: options.platformTools,
    sourceDirectory: options.sourceDirectory,
    note: options.note,
    cmakeTarget: options.cmakeTarget,
    next: 'Follow the run commands in README.md.'
  };
}

const pythonNote = 'On Windows, use `python` or `py -3` in place of `python3`.';
const cmakeBuild = ['cmake -S . -B build', 'cmake --build build --config Debug'];
const qtBuild = ['cmake -S . -B build -DCMAKE_PREFIX_PATH="<Qt kit folder>"', cmakeBuild[1]];
const cmakeRun = 'Run app from build/ or build/Debug/, depending on the generator. Windows adds the .exe extension.';
const qtRun = 'Use a Qt kit that matches your compiler and architecture. Run the app from Qt Creator or use the configured Qt runtime and the executable or macOS app bundle in the build directory.';
const cudaRun = 'Use a C++ compiler supported by your CUDA Toolkit. To target a specific GPU, set CMAKE_CUDA_ARCHITECTURES during configuration. Running the sample requires a compatible NVIDIA GPU and driver. ' + cmakeRun;
const sdlRun = 'CMake fetches SDL during the first configuration. On Linux, install the SDL build prerequisites for your distribution. ' + cmakeRun;

function sdlPair(id, label, description, extraLinuxTools = []) {
  return ['C', 'C++'].map(language => {
    const cpp = language === 'C++';
    return starter(id + (cpp ? '-cpp' : '-c'), 'graphics', language, label + ' for ' + language, description,
      ['cmake', cpp ? 'cpp-compiler' : 'c-compiler'], ['CMakeLists.txt', 'src/main.c', 'gitignore'], cmakeBuild, {
        cmakeTarget: 'app',
        sourceDirectory: cpp ? id + '-c' : undefined,
        platformTools: { linux: ['sdl-desktop', ...extraLinuxTools] },
        note: sdlRun
      });
  });
}

const standardTemplates = [
  starter('c-cmake', 'cli', 'C', 'C CMake Application', 'A portable C11 executable with a CMake build.',
    ['cmake', 'c-compiler'], ['CMakeLists.txt', 'src/main.c', 'gitignore'], cmakeBuild,
    { cmakeTarget: 'app', note: cmakeRun }),
  starter('cpp-cmake', 'cli', 'C++', 'C++ CMake Application', 'A portable C++17 executable with a CMake build.',
    ['cmake', 'cpp-compiler'], ['CMakeLists.txt', 'src/main.cpp', 'gitignore'], cmakeBuild,
    { cmakeTarget: 'app', note: cmakeRun }),
  starter('qt-widgets', 'desktop', 'C++', 'Qt Widgets Desktop', 'A native Qt 6 Widgets application with a CMake build.',
    ['cmake', 'cpp-compiler', 'qt-widgets'], ['CMakeLists.txt', 'src/main.cpp', 'gitignore'], qtBuild,
    { cmakeTarget: 'app', note: qtRun, requirement: 'Qt 6.5+ Widgets, CMake, and a compatible C++ compiler.' }),
  starter('qt-quick', 'desktop', 'C++', 'Qt Quick Desktop', 'A Qt 6 C++ application with a QML interface and a CMake build.',
    ['cmake', 'cpp-compiler', 'qt-quick'], ['CMakeLists.txt', 'src/main.cpp', 'Main.qml', 'gitignore'], qtBuild,
    { cmakeTarget: 'app', note: qtRun, requirement: 'Qt 6.5+ Quick, CMake, and a compatible C++ compiler.' }),
  starter('wxwidgets', 'desktop', 'C++', 'wxWidgets Desktop', 'A native cross-platform C++ desktop window built with wxWidgets and CMake.',
    ['cmake', 'cpp-compiler'], ['CMakeLists.txt', 'src/main.cpp', 'gitignore'], cmakeBuild,
    { cmakeTarget: 'app', platformTools: { linux: ['wx-gtk'] }, note: 'CMake uses an installed wxWidgets or downloads wxWidgets 3.2.9. ' + cmakeRun }),
  ...sdlPair('sdl2', 'SDL2', 'A resizable SDL2 window with a 2D rendering and input loop.'),
  ...sdlPair('sdl3', 'SDL3', 'A resizable SDL3 window with a 2D rendering and input loop.'),
  ...sdlPair('sdl3-opengl', 'SDL3 + OpenGL', 'An SDL3 window with an OpenGL 3.3 core context and a render loop.', ['opengl-dev']),
  starter('cuda-cmake', 'cli', 'CUDA', 'CUDA Kernel Application', 'A CUDA C++ executable that runs and checks a small GPU kernel.',
    ['cmake', 'cpp-compiler', 'cuda'], ['CMakeLists.txt', 'src/main.cu', 'gitignore'], cmakeBuild,
    { cmakeTarget: 'app', platforms: ['win32', 'linux'], note: cudaRun }),
  starter('cuda-library', 'cli', 'CUDA', 'CUDA Library and Demo', 'A CUDA static library with a C++ command-line consumer.',
    ['cmake', 'cpp-compiler', 'cuda'], ['CMakeLists.txt', 'src/main.cpp', 'src/sum.cu', 'include/sum.hpp', 'gitignore'], cmakeBuild,
    { cmakeTarget: 'app', platforms: ['win32', 'linux'], note: cudaRun }),
  starter('expo-mobile', 'mobile', 'JavaScript', 'React Native (Expo)', 'An Android and iOS starter with an Expo development server.',
    ['expo-node', 'npm'], ['package.json', 'app.json', 'index.js', 'App.js', 'gitignore'], ['npm install', 'npm start'],
    { requirement: 'Node.js 22.13+ and npm. Use an Expo SDK 57-compatible device, emulator, or development build.', note: 'Press a for an Android emulator or i for the iOS Simulator on macOS. Follow the Expo documentation to run a development build on a physical device.' }),
  {
    id: 'react-native-mobile', group: 'mobile', kind: 'react-native', label: 'React Native (Community CLI)',
    language: 'TypeScript', tools: ['react-native-node', 'npm'],
    description: 'A native Android and iOS project with Gradle, Xcode, Metro, and Jest.',
    requirement: 'Node.js and npm download the official starter. Building requires the Android SDK or Xcode.',
    next: 'Follow the generated README to install dependencies and run the app.'
  },

  starter('python-cli', 'cli', 'Python', 'Python Command Line', 'An argparse command-line app with no external dependencies.',
    ['python'], ['main.py', 'gitignore'], ['python3 main.py --help'], { note: pythonNote }),
  starter('python-desktop', 'desktop', 'Python', 'Python Tkinter Desktop', 'A desktop window built with Python’s Tkinter GUI library.',
    ['python', 'tkinter'], ['main.py', 'gitignore'], ['python3 main.py'], { note: pythonNote }),
  starter('python-server', 'server', 'Python', 'Python HTTP Server', 'A local JSON endpoint using the Python standard library.',
    ['python'], ['server.py', 'gitignore'], ['python3 server.py'], { note: 'Open http://127.0.0.1:8080 after starting the development server. ' + pythonNote }),

  starter('rust-cli', 'cli', 'Rust', 'Rust Cargo Application', 'A binary crate with a Cargo manifest and a main function.',
    ['rust'], ['Cargo.toml', 'src/main.rs', 'gitignore'], ['cargo run']),
  starter('rust-server', 'server', 'Rust', 'Rust Axum API', 'An async JSON endpoint built with Axum and Tokio.',
    ['rust'], ['Cargo.toml', 'src/main.rs', 'gitignore'], ['cargo run'], { note: 'The first build downloads crates. Open http://127.0.0.1:8080 after starting the server.' }),

  starter('go-cli', 'cli', 'Go', 'Go Command Line', 'A standalone Go module with a main package.',
    ['go'], ['go.mod', 'main.go'], ['go run .']),
  starter('go-server', 'server', 'Go', 'Go HTTP Server', 'A local JSON endpoint built with net/http.',
    ['go'], ['go.mod', 'main.go'], ['go run .'], { note: 'Open http://127.0.0.1:8080 after starting the server.' }),

  starter('swift-cli', 'cli', 'Swift', 'Swift Package Executable', 'A command-line executable managed with Swift Package Manager.',
    ['swift'], ['Package.swift', 'Sources/App/main.swift', 'gitignore'], ['swift run']),
  starter('swift-desktop', 'desktop', 'Swift', 'SwiftUI Desktop', 'A native macOS window in an executable Swift package.',
    ['swift', 'apple-sdk'], ['Package.swift', 'Sources/App/App.swift', 'gitignore'], ['swift run'],
    { platforms: ['darwin'], requirement: 'macOS 13 or newer with the macOS SDK.' }),
  starter('objc-desktop', 'desktop', 'Objective-C', 'Objective-C AppKit Desktop', 'A native macOS window using AppKit and Clang.',
    ['apple-sdk'], ['main.m', 'gitignore'], ['xcrun --sdk macosx clang -fobjc-arc main.m -framework AppKit -o app', './app'],
    { platforms: ['darwin'], requirement: 'macOS with the macOS SDK.' }),

  starter('java-cli', 'cli', 'Java', 'Java Command Line', 'A Java application compiled directly with the JDK.',
    ['java'], ['Main.java', 'gitignore'], ['javac -d out Main.java', 'java -cp out Main']),
  starter('java-desktop', 'desktop', 'Java', 'Java Swing Desktop', 'A desktop window using Swing from the Java standard library.',
    ['java'], ['Main.java', 'gitignore'], ['javac -d out Main.java', 'java -cp out Main']),
  starter('java-server', 'server', 'Java', 'Java HTTP Server', 'A local JSON endpoint using the JDK’s HTTP server.',
    ['java'], ['Main.java', 'gitignore'], ['javac -d out Main.java', 'java -cp out Main'],
    { note: 'Open http://127.0.0.1:8080 after starting the server.' }),

  starter('kotlin-cli', 'cli', 'Kotlin', 'Kotlin/JVM Command Line', 'A Kotlin application packaged as a runnable JAR.',
    ['java', 'kotlin'], ['Main.kt', 'gitignore'], ['kotlinc Main.kt -include-runtime -d app.jar', 'java -jar app.jar']),
  starter('kotlin-desktop', 'desktop', 'Kotlin', 'Kotlin Swing Desktop', 'A Kotlin/JVM desktop window using Java Swing.',
    ['java', 'kotlin'], ['Main.kt', 'gitignore'], ['kotlinc Main.kt -include-runtime -d app.jar', 'java -jar app.jar']),
  starter('kotlin-server', 'server', 'Kotlin', 'Kotlin HTTP Server', 'A local JSON endpoint using the JDK’s HTTP server from Kotlin.',
    ['java', 'kotlin'], ['Main.kt', 'gitignore'], ['kotlinc Main.kt -include-runtime -d app.jar', 'java -jar app.jar'],
    { note: 'Open http://127.0.0.1:8080 after starting the server.' }),

  starter('zig-cli', 'cli', 'Zig', 'Zig Command Line', 'A minimal Zig executable using the standard library.',
    ['zig'], ['src/main.zig', 'gitignore'], ['zig run src/main.zig']),

  starter('javascript-frontend', 'frontend', 'JavaScript', 'Static Web Frontend', 'A browser-ready page with HTML, CSS, and vanilla JavaScript.',
    [], ['index.html', 'style.css', 'app.js'], [], { note: 'Open index.html in a browser.' }),
  starter('javascript-server', 'server', 'JavaScript', 'Node.js HTTP Server', 'A local JSON endpoint using Node’s built-in HTTP module.',
    ['node'], ['server.mjs'], ['node server.mjs'], { note: 'Open http://127.0.0.1:8080 after starting the server.' }),
  starter('typescript-frontend', 'frontend', 'TypeScript', 'TypeScript Vite Frontend', 'A vanilla TypeScript site with a dev server and production build.',
    ['vite-node', 'npm'], ['package.json', 'tsconfig.json', 'index.html', 'src/main.ts', 'style.css', 'gitignore'],
    ['npm install', 'npm run dev'], { note: 'Use npm run build to type-check and build the site.' })
];

module.exports = { standardTemplates };
