# Project Wizard for VS Code

Create command-line, desktop, mobile, web, and game projects from VS Code. Project Wizard detects local toolchains, offers setup help, and can also scaffold from ZIP files.

## Build and install

Use Node.js 24 and npm to build the extension. Use desktop VS Code 1.96 or newer to run it.

```sh
npm ci
npm test
npm run package
```

The build writes `project-wizard-<version>.vsix` in this folder, using the version in `package.json`. In VS Code, open **Extensions**, select **… → Install from VSIX…**, and choose that file.

For development, open this folder in VS Code and press `F5` to start the **Run Project Wizard** Extension Development Host. Open the wizard in that window to test the source directly.

## Open the project menu

1. Click the **Project Wizard** icon in VS Code’s left Activity Bar and select **New Project**. You can also run **Project Wizard: New Project** from the Command Palette.
2. Choose a project category and language, select a template, and enter a **Name** and **Location**. The location is the parent of the new project folder.
3. Set any **Project setup** options, choose where to open the result, and click **Create Project**.

To scaffold inside your current workspace, use **Project Wizard: New Project in Workspace…** and select a workspace root if prompted. You can also right-click any folder in Explorer and select **New Project**. Both routes default to **Keep in current workspace**, which creates and reveals the project folder in Explorer.

**Initialize Git repository** is on by default when Git is installed. It starts off inside an existing repository, including a linked worktree, and you can override the choice before creating the project. The wizard initializes the repository without making a commit.

**Ready to use** is checked by default. Clear it to see starters that need setup. Select one to see its tool requirements and installation guides. Expand **Detected toolchains** to see installed versions and executable locations. Use **Refresh templates** after setup, and restart VS Code if your installer changed PATH. The catalog shows platform-specific starters on their supported systems.

The wizard saves discovery results across VS Code restarts and shows the cached catalog as soon as it opens. On first use, the built-in catalog appears while discovery runs. While the wizard is visible, stale results refresh in the background. The .NET SDK and MonoGame templates are cached per destination folder so they respect its SDK selection. **Refresh templates** requests an immediate scan after you change your tools or templates.

## Wizard settings and recent projects

Open **Settings** in the New Project wizard. Clear a language to hide all its templates, or clear a specific template to hide it individually. Click **Save settings** to apply your choices across workspaces. The wizard stores them in the VS Code user setting `projectWizard.catalog`.

Select **Open Project Wizard when VS Code starts** and save to show the wizard on startup. This setting starts off. **Recent projects** below the creation form lists up to 10 folders and saved workspaces from VS Code’s **Open Recent** history. Select one to open it in the current window. If the VS Code history command is unavailable, the wizard uses the folders and workspaces it has seen in the current profile.

VR templates are off by default. Select **Enable VR templates** and save to show the **VR** category. You can still enable or disable each VR template individually.

LaTeX templates are off by default. Select **Enable LaTeX templates** and save to show **Documents** and its article starter.

## Templates

| Category | Examples |
| --- | --- |
| Command line | C and C++ with CMake, CUDA kernel and library, Dart, Python, Ruby, PHP, Lua, Rust, Go, Swift, Java, Kotlin/JVM, Zig, and .NET |
| Desktop | Qt, wxWidgets, GTK, GTKmm, and C++ + Lua with CMake, plus Flutter, Tauri, Electron, Python Tkinter, Java and Kotlin Swing, macOS SwiftUI and AppKit, and Windows Forms |
| Mobile | React Native with Expo or the Community CLI, Android Jetpack Compose, iOS SwiftUI, and Flutter for Android and iOS |
| Graphics | SDL2 and SDL3 with a choice of SDL 2D, OpenGL 3.3, or Vulkan in C and C++, plus LÖVE for Lua |
| Web frontend | Flutter Web, Next.js, Nuxt, static HTML/CSS/JavaScript, and TypeScript with Vite |
| Web server | Dart JSON API, FastAPI, Django, and Flask for Python, Ruby with Sinatra, PHP and Laravel + Vue, Rust with Axum, Go, Java, Kotlin/JVM, Node.js, and ASP.NET Core |
| Games | MonoGame, Raylib for C, C++, or C#, and a mixed C++ and C# Raylib app |
| Game Engines | Unity 6 (C#), Unreal Engine 5 (C++), Godot 4 (GDScript), and Godot 4 GDExtension (C++ or Rust) |
| Blender | An installable add-on extension and a headless scene automation script |
| ML & AI | scikit-learn classification, a NumPy neural network, and a local Ollama chat client |
| Documents (opt-in) | A LaTeX article with a BibTeX bibliography |
| Shared library | Kotlin Multiplatform with JVM and Node.js targets and shared Kotlin tests |
| VR (opt-in) | Kotlin with Jetpack Compose for XR, plus native Android Raylib for C and C++ |

The generated README provides build and run commands. Use a Qt kit that matches your C++ compiler and set `CMAKE_PREFIX_PATH` to that kit. CUDA projects require the NVIDIA CUDA Toolkit and a supported host compiler. Running a CUDA sample also needs a compatible GPU and driver. Expo uses Node.js 22.13 or newer and a compatible Expo SDK 57 client or development build. [Qt setup](https://doc.qt.io/qt-6/qt-online-installation.html) · [CUDA Toolkit](https://developer.nvidia.com/cuda-downloads) · [Expo device setup](https://docs.expo.dev/get-started/set-up-your-environment/)

The CMake desktop starters, including SDL2, SDL3, and their OpenGL and Vulkan variants, include a `distribution` build target. Configure a Release build and run `cmake --build build --config Release --target distribution` to collect the app and its runtime libraries in `build/dist/Release/`. Share the entire folder for the target OS and architecture. Windows Vulkan packages include the loader. The macOS packaging step copies linked dylibs and frameworks into the `.app`, rewrites their paths, and adds MoltenVK for Vulkan apps. Graphics drivers and OS libraries come from the destination system. Other desktop starters provide packaging commands for their toolchains in the generated README. [CMake BundleUtilities](https://cmake.org/cmake/help/latest/module/BundleUtilities.html)

Next.js, Nuxt, and Tauri use their official generators with npm. The wizard downloads the starter during creation. Run `npm install` in the generated project and follow its README for development and build commands. Tauri uses a TypeScript frontend and a Rust backend. Electron comes with separate main, preload, and renderer files and uses Electron Forge to package the app. [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/create-next-app) · [Nuxt starters](https://github.com/nuxt/starter) · [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) · [Electron Forge packaging](https://www.electronforge.io/cli#package)

The GTK and GTKmm starters use CMake and pkg-config. On Windows, install the GTK development packages and CMake toolchain in MSYS2 UCRT64 and launch VS Code from that shell. On Linux or macOS, install GTK 4 or GTKmm 4 from your package manager. [GTK installation](https://www.gtk.org/docs/installations/) · [GTKmm](https://www.gtk.org/docs/language-bindings/cpp/)

The wxWidgets starter builds the `app` target with an installed SDK or the official wxWidgets 3.2.10 source archive. Use `-DPROJECT_USE_SYSTEM_WXWIDGETS=OFF` to select the source build. The generated README includes the Linux prerequisites and Windows Visual Studio instructions. [wxWidgets 3.2.10](https://github.com/wxWidgets/wxWidgets/releases/tag/v3.2.10)

The native Godot starters use GDExtension. Build the C++ library with CMake or the Rust library with Cargo, then open the Godot project and run the scene that calls the native class. The C++ + Lua desktop starter uses CMake to fetch Raylib and Lua and deploys an editable Lua script alongside the executable. [Godot GDExtension](https://docs.godotengine.org/en/stable/engine_details/engine_api/gdextension/what_is_gdextension.html) · [godot-rust](https://godot-rust.github.io/)

The Blender extension builds an installable ZIP. The automation script generates a scene and saves it as a `.blend` file from the command line. Both use Blender’s bundled Python. The ML, AI, FastAPI, Django, and Flask starters install their required packages in a project-local virtual environment. [Blender extensions](https://docs.blender.org/manual/en/latest/advanced/extensions/getting_started.html) · [Ollama API](https://docs.ollama.com/api/chat)

Laravel + Vue uses Composer to download the official starter. The generated README covers SQLite, dependency setup, and the development server. The native iOS SwiftUI template appears on macOS and uses XcodeGen. The Android Compose template builds with Gradle and includes a counter unit test. [Laravel starter kits](https://laravel.com/docs/13.x/starter-kits) · [XcodeGen](https://github.com/yonaskolb/XcodeGen)

The standalone Dart starters support the Dart SDK or the Dart SDK bundled with Flutter. The Flutter starters use the SDK generator to create platform files for Mobile (Android and iOS), Desktop (Windows, macOS, and Linux), or Web. Each Flutter starter includes a widget test and a README with build commands. [Dart SDK setup](https://dart.dev/get-dart) · [Flutter setup](https://docs.flutter.dev/install) · [Flutter desktop distribution](https://docs.flutter.dev/platform-integration/desktop)

Under **Game Engines**, Unity includes a demo scene with a rotating cube and dedicated scripts, scenes, art, audio, and prefab folders. Unreal includes a C++ game module, game and editor targets, organized content folders, and a spinning actor to place in a level. Godot includes a runnable 2D scene with arrow-key movement and a reusable player scene. Clear **Ready to use** to create a starter before installing its editor. For custom editor locations, set `UNITY_EDITOR_PATH`, `UNREAL_ENGINE_ROOT`, or `GODOT_PATH` as shown in the wizard’s setup guides. [Unity Editor installation](https://docs.unity.com/en-us/hub/add-editor) · [Unreal directory structure](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-directory-structure) · [Godot project organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html)

In **Graphics**, choose your SDL version, graphics API, and language from the template names. The Vulkan starters clear and present a Vulkan swapchain and rebuild it on resize. Use a Vulkan 1.1 runtime and development files 1.3.216 or newer. On macOS, use the Vulkan SDK with MoltenVK. If a template needs setup, clear **Ready to use** to see the guide. [Vulkan SDK downloads](https://vulkan.lunarg.com/sdk/home)

MonoGame and built-in .NET generators require an active .NET SDK 8 or newer. Use **MonoGame → Install MonoGame templates** if the project templates are missing.

**Raylib (C++ + C#)** draws a window in C# and calls a CMake-built C++ library for movement. `dotnet run` builds both parts. Choose xUnit or NUnit to test the same native function without opening a window. Use the generated README to publish the app, its .NET runtime, Raylib, and the native library together.

The mobile starters include Home and About tabs that share a counter. The React Native Community CLI starter generates the official Android and iOS project files and includes a Jest navigation test. The Flutter starter includes a widget test. Use the generated README to install dependencies, configure the platform SDK, and run the app. [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)

The Kotlin Android XR starter demonstrates a spatial panel and switching between Home Space and Full Space on an Android XR headset or emulator. The Raylib Android VR starters build a `NativeActivity` APK with the Android NDK and CMake. They show stereoscopic rendering, lens distortion, and rotation tracking on an ARM64 Android phone in a landscape VR viewer. Follow each generated README for Gradle and SDK requirements. [Jetpack XR setup](https://developer.android.com/develop/xr/jetpack-xr-sdk/set-up-sdk) · [Android NDK and CMake setup](https://developer.android.com/studio/projects/install-ndk)

## Project setup

- **Python** requires a project-local `.venv`. Choose built-in `venv`, `uv`, Conda, or `virtualenv` and select a Python version. The wizard creates the environment and installs the selected packages before opening the project. If setup fails, the generated README and Project Wizard output show how to finish setup.
- **CMake** offers a library picker that fills in the dependencies text box. The list is filtered by language and target and includes libuv for TCP and UDP in C and C++, Asio for C++ networking, tinyfiledialogs, stb, yyjson, fmt, nlohmann/json, cxxopts, GLM, Dear ImGui, and bgfx. Each preset adds a standalone program under `examples/` and an `example_<library>` CMake target. The generated README shows how to build and run them. For custom CMake archives, enter `name target https://example.com/library.tar.gz [sha256]`, one dependency per line. CMake fetches and links the selected libraries with `FetchContent`.
- **C#** offers the same picker for NuGet packages, including LiteNetLib for reliable UDP, SuperSimpleTcp for TCP clients and servers, RestSharp for HTTP, and bindings for Dear ImGui, OpenGL, and Vulkan. Enter custom packages as `Package.Id 1.2.3`, one per line. The mixed Raylib starter accepts both NuGet and CMake entries and adds them to the corresponding build files.
- **C/C++ build targets** include **Web (Emscripten)** for Raylib and the basic CMake applications. In **Project setup**, select native desktop, web, or both. The native build uses `build/` and the web build produces `build-web/index.html`, JavaScript, and WebAssembly from the same sources. The generated README includes the build and run commands for each selected target. [Emscripten setup](https://emscripten.org/docs/getting_started/downloads.html)
- **Set app icon** accepts PNG or WebP for desktop, Godot, and mobile starters. Project Wizard converts the image locally into the formats the app needs, including multi-size Windows ICO, macOS ICNS, Android launcher resources, and iOS app icon assets. You can also supply native desktop ICO or ICNS files directly. Follow the generated README for each template’s packaging command. Graphical CMake apps build as `.app` bundles on macOS. [CMake app bundles](https://cmake.org/cmake/help/latest/prop_tgt/MACOSX_BUNDLE.html) · [Apple app icon assets](https://developer.apple.com/documentation/xcode/configuring-your-app-icon)
- **Java** offers **JDK (javac and java)**, **Maven**, and **Gradle** under **Build system** for command-line, Swing, and HTTP server projects. Maven and Gradle starters use `src/main/java`, accept dependencies as `group:artifact:version`, and run the optional JUnit example through the selected build system. The optional JUnit example for the direct JDK starter uses a separate Maven test project.
- **npm** starters accept one dependency per line, for example `@scope/package@^1.0.0`. The selected packages go into `package.json`.
- **Tests** are optional. C can use CTest, C++ and CUDA can use GoogleTest or Catch2, Python can use pytest or `unittest`, and JavaScript and TypeScript can use the Node.js test runner or Vitest where supported. C# offers xUnit and NUnit, Java and Kotlin offer JUnit with Maven, and Swift packages offer XCTest. Dart, Go, Rust, and Zig offer their native test runners. Follow the generated README to run the example.
- **CMake test examples** call the same `starter_add` function that the app uses. The implementation is in `src/starter.c` or `src/starter.cpp`, with a declaration in `include/starter.h`. The native Android Raylib samples run these tests on the host compiler.
- **Kotlin Multiplatform** includes a shared `kotlin.test` suite by default. Run `gradle jvmTest jsNodeTest` to test the same function on the JVM and Node.js.

## Custom ZIP templates

1. Put each starter project in a separate `.zip` file in one directory.
2. Run **Project Wizard: Choose ZIP Templates Folder**, or use **Custom ZIPs → Choose ZIP folder…**. The wizard saves the location in `projectWizard.zipTemplatesDirectory`.
3. Choose an archive by filename. The wizard removes a single wrapper directory and preserves the rest of the project structure.

Paths and UTF-8 text files up to 1 MiB can contain `__PROJECT_NAME__`, `__PROJECT_IDENTIFIER__`, or `__PROJECT_SLUG__`. For a project named `My Game`, they expand to `My Game`, `My_Game`, and `my-game`. Identifiers starting with a digit receive a leading underscore. ZIPs must be unencrypted and may contain up to 10,000 entries and 1 GiB of uncompressed data.

## GitHub Actions

Commit this folder to a GitHub repository with Actions enabled. The **Build Project Wizard** workflow in `.github/workflows/build.yml` runs on pushes, pull requests, and manual dispatch. It runs tests on Windows, macOS, and Linux, then packages a VSIX. Open a successful run in the **Actions** tab and download **project-wizard-vsix** from **Artifacts**.

To publish a new version, update `package.json` and `package-lock.json` and push the commit to the default branch. After all three test jobs pass, the workflow creates a versioned release such as `v0.5.4` and attaches the VSIX under **Assets**. Each version belongs to one commit. Bump the version to publish later changes. You can also run the workflow manually on the default branch or push a tag matching the package version.

## Add more starters

Register starters in `src/standard-templates.js` and add their source files under `templates/`. Toolchain detection and installation guides live in `src/toolchains.js`. Project setup choices are defined in `src/project-options.js`.

## License

Project Wizard is released under the [MIT License](LICENSE).
