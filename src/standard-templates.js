function starter(id, group, language, label, description, tools, files, commands, options = {}) {
  return {
    id, group, language, label, description, tools, files, commands, kind: 'starter',
    requirement: options.requirement,
    platforms: options.platforms,
    platformTools: options.platformTools,
    sourceDirectory: options.sourceDirectory,
    note: options.note,
    cmakeTarget: options.cmakeTarget,
    cmakeLibrary: options.cmakeLibrary,
    embeddedPython: options.embeddedPython,
    pythonMinimum: options.pythonMinimum,
    pythonPackages: options.pythonPackages,
    webTarget: options.webTarget,
    androidCmake: options.androidCmake,
    sdlVersion: options.sdlVersion,
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

function gtkStarter(cpp) {
  const pkg = cpp ? 'gtkmm-4.0' : 'gtk4';
  const label = cpp ? 'GTKmm 4 Desktop (C++)' : 'GTK 4 Desktop (C)';
  const note = 'Install the ' + pkg + ' development package and make it visible to pkg-config.\n\n' +
    '### Linux and macOS\n\n```sh\n' + cmakeBuild.join('\n') + '\n```\n\n' +
    'On Linux run `./build/app`. On macOS open the .app bundle in the build directory.\n\n' +
    '### Windows\n\nUse an MSYS2 UCRT64 shell with its GCC, CMake, Ninja, pkgconf, and ' + pkg + ' packages.\n\n' +
    '```sh\ncmake -S . -B build -G Ninja\ncmake --build build\n./build/app.exe\n```';
  return starter(cpp ? 'gtk-cpp' : 'gtk-c', 'desktop', cpp ? 'C++' : 'C', label,
    'A native GTK 4 window with a clickable example and a CMake build.',
    ['cmake', cpp ? 'cpp-compiler' : 'c-compiler', pkg],
    ['CMakeLists.txt', cpp ? 'src/main.cpp' : 'src/main.c', 'gitignore'], [],
    { cmakeTarget: 'app', note, requirement: 'CMake 3.24+, pkg-config, and the ' + pkg + ' development package.' });
}

function sdlPair(id, label, description, options = {}) {
  return ['C', 'C++'].map(language => {
    const cpp = language === 'C++';
    return starter(id + (cpp ? '-cpp' : '-c'), 'graphics', language, label + ' for ' + language, description,
      ['cmake', cpp ? 'cpp-compiler' : 'c-compiler', ...(options.tools || [])],
      ['CMakeLists.txt', 'src/main.c', 'gitignore'], cmakeBuild, {
        cmakeTarget: 'app',
        sourceDirectory: options.sourceDirectory || (cpp ? id + '-c' : undefined),
        platformTools: { linux: ['sdl-desktop', ...(options.linuxTools || [])] },
        sdlVersion: options.sdlVersion,
        requirement: options.requirement,
        note: options.note ? sdlRun + ' ' + options.note : sdlRun
      });
  });
}

const sdlGraphics = ['2.32.10', '3.4.16'].flatMap(sdlVersion => {
  const sdl = 'SDL' + sdlVersion[0];
  const id = sdl.toLowerCase();
  return [
    ...sdlPair(id + '-opengl', sdl + ' + OpenGL', 'An OpenGL 3.3 core context and a render loop.', {
      sourceDirectory: 'sdl-opengl', sdlVersion, linuxTools: ['opengl-dev']
    }),
    ...sdlPair(id + '-vulkan', sdl + ' + Vulkan', 'A Vulkan swapchain with a resize-aware color-clear render loop.', {
      sourceDirectory: 'sdl-vulkan', sdlVersion, tools: ['vulkan-dev'],
      requirement: 'CMake, a native compiler, and Vulkan development files 1.3.216 or newer. Run with a Vulkan 1.1 driver or MoltenVK.',
      note: 'On Windows, install the Vulkan SDK and restart your shell so VULKAN_SDK is set. On Linux, install your distribution’s Vulkan loader development package and a Vulkan driver. On macOS, install the Vulkan SDK with MoltenVK and load its setup-env.sh before building and running.'
    })
  ];
});

function raylibVr(language) {
  return starter(language === 'C' ? 'raylib-vr-android-c' : 'raylib-vr-android-cpp', 'vr', language,
    'Raylib Android VR for ' + language, 'An Android NativeActivity with a stereoscopic 3D scene and gyroscope head tracking for a phone viewer.',
    ['android-gradle', 'android-sdk', 'android-ndk', 'android-cmake'],
    ['settings.gradle.kts', 'build.gradle.kts', 'gradle.properties', 'CMakeLists.txt',
      'src/main/AndroidManifest.xml', 'src/main/assets/lens.frag', 'src/main.c', 'gitignore'],
    ['gradle assembleDebug', 'gradle installDebug'], {
      sourceDirectory: 'raylib-vr-android', cmakeTarget: 'game', androidCmake: true,
      requirement: 'Gradle 9.3.1+, a compatible JDK 17+, Android SDK 37, NDK r28c, and Android SDK CMake 3.31.6.',
      note: 'Open the project in Android Studio or set ANDROID_HOME and JAVA_HOME for the command line. Run on an ARM64 Android 8+ phone in a landscape VR viewer. Tap while facing forward to recenter. The lens settings are generic and can be tuned in the source for your viewer.'
    });
}

const standardTemplates = [
  starter('blender-extension', 'blender', 'Python', 'Blender Add-on Extension',
    'A Blender extension that adds an animated turntable operator to the 3D View Add menu.',
    ['blender'], ['blender_manifest.toml', '__init__.py', 'gitignore'],
    ['blender --command extension validate', 'blender --command extension build'],
    { embeddedPython: true, requirement: 'Blender 4.2 or newer.',
      note: 'Install the resulting ZIP through Blender Preferences → Extensions → Install from Disk. Search for **Add Animated Turntable** with F3 in the 3D View. Parent an object to the turntable and play the timeline. The add-on uses Blender’s bundled Python.' }),
  starter('blender-automation', 'blender', 'Python', 'Blender Scene Automation',
    'A headless Python script that generates a .blend scene with geometry, lighting, and a camera.',
    ['blender'], ['create_scene.py', 'gitignore'],
    ['blender --background --python-exit-code 1 --python create_scene.py -- --output output/scene.blend'],
    { embeddedPython: true, requirement: 'Blender 4.2 or newer.',
      note: 'Open the output .blend file in Blender. Use the full path to Blender in the command if it is outside PATH. The script uses Blender’s bundled Python.' }),
  starter('godot-native-cpp', 'games', 'C++', 'Godot 4 GDExtension (C++)',
    'A Godot demo scene that calls a C++ GDExtension built with CMake and godot-cpp.',
    ['godot-editor', 'cmake', 'cpp-compiler', 'python'], ['CMakeLists.txt', 'build_profile.json', 'src/native.cpp',
      'project.godot', 'native.gdextension', 'demo/main.tscn', 'demo/show_greeting.gd', 'gitignore'],
    cmakeBuild, { cmakeTarget: 'pw_native', cmakeLibrary: true,
      requirement: 'Godot 4.3+, CMake 3.24+, Python 3 for binding generation, and a C++ compiler.',
      note: 'Build the library for the architecture of your Godot editor, then import project.godot and press F5. The scene displays a message returned by NativeGreeting. The first build fetches godot-cpp.' }),
  starter('godot-native-rust', 'games', 'Rust', 'Godot 4 GDExtension (Rust)',
    'A Godot demo scene that calls a Rust GDExtension built with Cargo and godot-rust.',
    ['godot-editor', 'godot-rust'], ['Cargo.toml', 'src/lib.rs', 'project.godot', 'native.gdextension',
      'demo/main.tscn', 'demo/show_greeting.gd', 'gitignore'],
    ['cargo build --target-dir target'],
    { requirement: 'Godot 4.3+, Rust 1.94+, and Cargo.',
      note: 'Build the library for the architecture of your Godot editor, then import project.godot and press F5. The scene displays a message returned by NativeGreeting. Use cargo build --release --target-dir target for the release library.' }),
  starter('latex-article', 'documents', 'LaTeX', 'LaTeX Article',
    'An article with an abstract, section structure, an example citation, and a BibTeX bibliography.',
    ['latex'], ['article.tex', 'references.bib', 'gitignore'],
    ['pdflatex -interaction=nonstopmode -halt-on-error article.tex', 'bibtex article',
      'pdflatex -interaction=nonstopmode -halt-on-error article.tex', 'pdflatex -interaction=nonstopmode -halt-on-error article.tex'],
    { note: 'Open article.pdf after compilation. You can also run latexmk -pdf article.tex if latexmk and its prerequisites are installed.' }),
  starter('ml-classifier', 'ai', 'Python', 'scikit-learn Classifier',
    'Train a logistic regression pipeline on the bundled Iris dataset and report held-out accuracy.',
    ['ml-python'], ['train.py', 'gitignore'], ['python3 train.py'],
    { pythonMinimum: '3.11', pythonPackages: ['scikit-learn>=1.7,<2'],
      note: 'The Iris dataset ships with scikit-learn. The split is stratified and uses a fixed random seed.' }),
  starter('ml-numpy', 'ai', 'Python', 'NumPy Neural Network',
    'Train a small neural network from scratch to learn XOR, with an explicit forward pass and backpropagation.',
    ['ml-python'], ['train.py', 'gitignore'], ['python3 train.py'],
    { pythonMinimum: '3.11', pythonPackages: ['numpy>=2,<3'],
      note: 'The example trains on four generated inputs and runs on the CPU.' }),
  starter('ai-ollama', 'ai', 'Python', 'Ollama Local Chat CLI',
    'Send a prompt to a locally running Ollama model using Python’s HTTP client.',
    ['ml-python', 'ollama'], ['chat.py', 'gitignore'], ['python3 chat.py --model MODEL_NAME "Explain what an embedding is."'],
    { pythonMinimum: '3.11', note: 'Start Ollama. Use ollama list to find an installed model, or use ollama pull MODEL_NAME to download one. Replace MODEL_NAME with that model’s name. The script calls the loopback API at port 11434.' }),
  starter('python-fastapi', 'server', 'Python', 'FastAPI JSON API',
    'A typed JSON API with health and addition endpoints and interactive API documentation.',
    ['ml-python'], ['api.py', 'gitignore'], ['python3 -m uvicorn api:app --reload'],
    { pythonMinimum: '3.11', pythonPackages: ['fastapi>=0.120,<1', 'uvicorn>=0.35,<1'],
      note: 'Open http://127.0.0.1:8000/docs to try the endpoints.' }),
  starter('cpp-lua-desktop', 'desktop', 'C++', 'C++ + Lua Desktop App',
    'A Raylib window that passes a C++ value to Lua and displays the returned text on Windows, macOS, and Linux.',
    ['cmake', 'cpp-compiler', 'c-compiler'], ['CMakeLists.txt', 'src/main.cpp', 'scripts/message.lua', 'gitignore'],
    cmakeBuild, { cmakeTarget: 'app', requirement: 'CMake 3.24+, C and C++ compilers, and Raylib system prerequisites.',
      note: 'Run app from build/ or build/Debug/ on Windows or Linux, or open the .app on macOS. CMake fetches Raylib and Lua and copies scripts/message.lua next to the executable. Edit that script and rebuild to update the copied file.' }),
  starter('ios-swiftui', 'mobile', 'Swift', 'iOS SwiftUI App',
    'A native iPhone and iPad counter app with a SwiftUI view and an XcodeGen project specification.',
    ['ios-sdk', 'xcodegen'], ['project.yml', 'Sources/MobileApp.swift', 'gitignore'],
    ['xcodegen generate', 'open MobileApp.xcodeproj'],
    { platforms: ['darwin'], requirement: 'macOS with Xcode, the iOS SDK, and XcodeGen.',
      note: 'Select an iOS simulator in Xcode and press Run. Set your development team and bundle identifier before deploying to a physical device.' }),
  starter('android-compose', 'mobile', 'Kotlin', 'Android Jetpack Compose App',
    'A native Material 3 counter app with saved state and a JUnit test that calls the same counter function.',
    ['compose-gradle', 'android-sdk'], ['settings.gradle.kts', 'build.gradle.kts', 'gradle.properties',
      'src/main/AndroidManifest.xml', 'src/main/kotlin/com/example/projectwizard/mobile/MainActivity.kt',
      'src/test/kotlin/com/example/projectwizard/mobile/CounterTest.kt', 'gitignore'],
    ['gradle assembleDebug testDebugUnitTest'],
    { requirement: 'Gradle 9.5+, a compatible JDK 17+, and Android SDK 37.',
      note: 'Open the folder in Android Studio and choose an emulator or connected device. For command-line deployment, run gradle installDebug after configuring Android SDK access.' }),
  starter('c-cmake', 'cli', 'C', 'C CMake Application', 'A portable C11 executable with a CMake build.',
    ['cmake', 'c-compiler'], ['CMakeLists.txt', 'src/main.c', 'gitignore'], cmakeBuild,
    { cmakeTarget: 'app', webTarget: true, note: cmakeRun }),
  starter('cpp-cmake', 'cli', 'C++', 'C++ CMake Application', 'A portable C++17 executable with a CMake build.',
    ['cmake', 'cpp-compiler'], ['CMakeLists.txt', 'src/main.cpp', 'gitignore'], cmakeBuild,
    { cmakeTarget: 'app', webTarget: true, note: cmakeRun }),
  starter('qt-widgets', 'desktop', 'C++', 'Qt Widgets Desktop', 'A native Qt 6 Widgets application with a CMake build.',
    ['cmake', 'cpp-compiler', 'qt-widgets'], ['CMakeLists.txt', 'src/main.cpp', 'gitignore'], qtBuild,
    { cmakeTarget: 'app', note: qtRun, requirement: 'Qt 6.5+ Widgets, CMake, and a compatible C++ compiler.' }),
  starter('qt-quick', 'desktop', 'C++', 'Qt Quick Desktop', 'A Qt 6 C++ application with a QML interface and a CMake build.',
    ['cmake', 'cpp-compiler', 'qt-quick'], ['CMakeLists.txt', 'src/main.cpp', 'Main.qml', 'gitignore'], qtBuild,
    { cmakeTarget: 'app', note: qtRun, requirement: 'Qt 6.5+ Quick, CMake, and a compatible C++ compiler.' }),
  starter('wxwidgets', 'desktop', 'C++', 'wxWidgets Desktop', 'A native cross-platform C++ desktop window built with wxWidgets and CMake.',
    ['cmake', 'cpp-compiler'], ['CMakeLists.txt', 'src/main.cpp', 'gitignore'], cmakeBuild,
    { cmakeTarget: 'app', platformTools: { linux: ['wx-gtk'] }, note: 'CMake uses an installed wxWidgets or downloads wxWidgets 3.2.9. ' + cmakeRun }),
  gtkStarter(false),
  gtkStarter(true),
  starter('electron', 'desktop', 'JavaScript', 'Electron Desktop', 'An Electron window with an isolated renderer, a preload bridge, and Forge packaging.',
    ['electron-node', 'npm'], ['package.json', 'forge.config.cjs', 'src/main.cjs', 'src/preload.cjs',
      'src/renderer/index.html', 'src/renderer/renderer.js', 'src/renderer/style.css', 'gitignore'],
    ['npm install', 'npm start'],
    { requirement: 'Node.js 22.13 or newer and npm.',
      note: 'Run `npm run package` to create an unpacked app in `out/`. The preload bridge exposes only the Electron version to the local renderer.' }),
  starter('unity', 'games', 'C#', 'Unity 6 Game', 'A structured Unity 3D project with a demo scene and a rotating cube.',
    ['unity-editor'], ['Assets/Game/Scenes/Demo.unity', 'Assets/Game/Scenes/Demo.unity.meta',
      'Assets/Game/Scripts/DemoScene.cs', 'Assets/Game/Scripts/DemoScene.cs.meta', 'Assets/Game/Art/.gitkeep',
      'Assets/Game/Audio/.gitkeep', 'Assets/Game/Prefabs/.gitkeep', 'Packages/manifest.json',
      'ProjectSettings/EditorBuildSettings.asset', 'ProjectSettings/ProjectVersion.txt', 'gitignore'],
    [], { requirement: 'Unity 6.3 or newer.',
      note: 'Add this folder under Projects in Unity Hub. Open `Assets/Game/Scenes/Demo.unity` and press Play. ' +
        'Keep your game assets under `Assets/Game` and commit the .meta files generated by Unity alongside them.' }),
  starter('unreal', 'games', 'C++', 'Unreal Engine 5 Game', 'An Unreal C++ gameplay module with a rotating mesh actor and organized content folders.',
    ['unreal-editor', 'cpp-compiler'], ['__UNREAL_MODULE__.uproject',
      'Config/DefaultEngine.ini', 'Config/DefaultGame.ini', 'Content/Game/Maps/.gitkeep', 'Content/Game/Blueprints/.gitkeep',
      'Content/Game/Art/.gitkeep', 'Content/Game/Audio/.gitkeep', 'Source/__UNREAL_MODULE__.Target.cs',
      'Source/__UNREAL_MODULE__Editor.Target.cs', 'Source/__UNREAL_MODULE__/__UNREAL_MODULE__.Build.cs',
      'Source/__UNREAL_MODULE__/Private/__UNREAL_MODULE__.cpp', 'Source/__UNREAL_MODULE__/Private/SpinningActor.cpp',
      'Source/__UNREAL_MODULE__/Public/SpinningActor.h', 'gitignore'],
    [], { requirement: 'Unreal Engine 5.3 or newer and the C++ toolchain required by that engine.',
      note: 'Open the .uproject with Unreal Editor and build the game module when prompted. ' +
        'Create a Basic level, save it under `Content/Game/Maps`, then place the Spinning Actor C++ class in the level and press Play. ' +
        'Use World Settings and Project Settings to choose a game mode and startup maps as the project grows.' }),
  starter('godot', 'games', 'GDScript', 'Godot 4 Game', 'A structured Godot 2D project with a keyboard-controlled player scene.',
    ['godot-editor'], ['project.godot', 'game/main.tscn', 'game/player/player.tscn', 'game/player/player.gd',
      'game/levels/.gitkeep', 'assets/.gitkeep', 'gitignore'],
    [], { requirement: 'Godot 4.3 or newer.',
      note: 'Import `project.godot` in the Godot Project Manager and press F6 with the main scene open, or F5 to run the project. ' +
        'Use the arrow keys to move. Add new levels under `game/levels` and keep each feature’s scenes and scripts together.' }),
  ...sdlPair('sdl2', 'SDL2', 'A resizable SDL2 window with a 2D rendering and input loop.'),
  ...sdlPair('sdl3', 'SDL3', 'A resizable SDL3 window with a 2D rendering and input loop.'),
  ...sdlGraphics,
  ...['C', 'C++'].map(raylibVr),
  starter('kotlin-android-xr', 'vr', 'Kotlin', 'Kotlin Android XR', 'A Jetpack Compose for XR spatial panel with Home Space and Full Space controls.',
    ['android-xr-gradle', 'android-sdk'], ['settings.gradle.kts', 'build.gradle.kts', 'gradle.properties',
      'src/main/AndroidManifest.xml', 'src/main/kotlin/com/example/projectwizard/xr/MainActivity.kt', 'gitignore'],
    ['gradle assembleDebug', 'gradle installDebug'], {
      requirement: 'Gradle 9.5+, a compatible JDK 17+, and Android SDK 37. Use an Android XR headset or emulator to see the spatial UI.',
      note: 'Open the project in Android Studio or set ANDROID_HOME and JAVA_HOME for the command line. Run on an Android XR headset or emulator, then select Enter Full Space. The app also shows a 2D screen on an ordinary Android device.'
    }),
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

  starter('ruby-cli', 'cli', 'Ruby', 'Ruby Command Line', 'A Ruby script with OptionParser arguments and help.',
    ['ruby'], ['main.rb'], ['ruby main.rb --help', 'ruby main.rb --name World']),
  starter('ruby-sinatra', 'server', 'Ruby', 'Ruby Sinatra Server', 'A Sinatra JSON endpoint with dependencies managed by Bundler.',
    ['ruby', 'bundler'], ['app.rb', 'Gemfile'], ['bundle install', 'bundle exec ruby app.rb'],
    { note: 'Open http://127.0.0.1:8080 after starting the WEBrick development server.' }),
  starter('php-cli', 'cli', 'PHP', 'PHP Command Line', 'A PHP script with a named option and help.',
    ['php'], ['main.php'], ['php main.php --help', 'php main.php --name=World']),
  starter('php-server', 'server', 'PHP', 'PHP Web Server', 'A JSON endpoint served from a dedicated public directory.',
    ['php'], ['public/index.php'], ['php -S 127.0.0.1:8080 -t public'],
    { note: 'Open http://127.0.0.1:8080. PHP’s built-in web server is for local development.' }),
  starter('lua-cli', 'cli', 'Lua', 'Lua Command Line', 'A Lua script that reads an argument and prints a greeting.',
    ['lua'], ['main.lua'], ['lua main.lua World'],
    { note: 'Use the installed interpreter’s command, such as lua5.4, if your system uses a versioned name.' }),
  starter('lua-love', 'graphics', 'Lua', 'LÖVE 2D Game', 'A 2D window with a movable sprite using LÖVE’s update and draw callbacks.',
    ['love'], ['main.lua', 'conf.lua'], ['love .'],
    { note: 'Use the arrow keys to move. On Windows, you can also open the folder with love.exe.' }),

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

  starter('java-cli', 'cli', 'Java', 'Java Command Line', 'A Java command-line application with a greeting.',
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
  starter('kotlin-multiplatform', 'general', 'Kotlin', 'Kotlin Multiplatform Library', 'A shared Kotlin library with JVM and Node.js targets and a common test suite.',
    ['kmp-gradle'], ['settings.gradle.kts', 'build.gradle.kts', 'gradle.properties', 'src/commonMain/kotlin/Greeting.kt',
      'src/commonTest/kotlin/GreetingTest.kt', 'gitignore'], ['gradle jvmTest jsNodeTest'],
    { requirement: 'Gradle 9.0–9.7 running on a compatible JDK 17 or newer. Gradle downloads Kotlin and Node.js on the first build.',
      note: 'Put shared code in src/commonMain and shared tests in src/commonTest. The example tests the same public function on both targets.' }),

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
