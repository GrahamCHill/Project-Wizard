# Project Wizard for VS Code

Create command-line, desktop, mobile, web, and game projects from VS Code. Project Wizard detects local toolchains, offers setup help, and can also scaffold from ZIP files.

## Build and install

Use Node.js 24 and npm to build the extension. Use desktop VS Code 1.96 or newer to run it.

```sh
npm ci
npm test
npm run package
```

The build writes `project-wizard-0.5.1.vsix` in this folder. In VS Code, open **Extensions**, select **… → Install from VSIX…**, and choose that file.

For development, open this folder in VS Code and press `F5` to start the **Run Project Wizard** Extension Development Host. Open the wizard in that window to test the source directly.

## Open the project menu

1. Press `Ctrl+Shift+P` on Windows or Linux, or `Cmd+Shift+P` on macOS. Run **Project Wizard: New Project**.
2. Choose a project category and language, select a template, and enter a **Name** and **Location**. The location is the parent of the new project folder.
3. Set any **Project setup** options, choose where to open the result, and click **Create Project**.

To scaffold inside your current workspace, use **Project Wizard: New Project in Workspace…** and select a workspace root if prompted. You can also right-click any folder in Explorer and select **New Project**. Both routes default to **Keep in current workspace**, which creates and reveals the project folder in Explorer.

**Ready to use** is checked by default. Clear it to see starters that need setup. Select one to see its tool requirements and installation guides. Expand **Detected toolchains** to see installed versions and executable locations. Use **Refresh templates** after setup, and restart VS Code if your installer changed PATH. The catalog shows platform-specific starters on their supported systems.

## Template settings

Open **Settings** in the New Project wizard. Clear a language to hide all its templates, or clear a specific template to hide it individually. Click **Save settings** to apply your choices across workspaces. The wizard stores them in the VS Code user setting `projectWizard.catalog`.

VR templates are off by default. Select **Enable VR templates** and save to show the **VR** category. You can still enable or disable each VR template individually.

## Templates

| Category | Examples |
| --- | --- |
| Command line | C and C++ with CMake, CUDA kernel and library, Python, Ruby, PHP, Lua, Rust, Go, Swift, Java, Kotlin/JVM, Zig, and .NET |
| Desktop | Qt Widgets, Qt Quick, and wxWidgets with CMake, Python Tkinter, Java and Kotlin Swing, macOS SwiftUI and AppKit, and Windows Forms |
| Mobile | React Native for Android and iOS with Expo or the Community CLI |
| Graphics | SDL2 and SDL3 with a choice of SDL 2D, OpenGL 3.3, or Vulkan in C and C++, plus LÖVE for Lua |
| Web frontend | Static HTML/CSS/JavaScript and TypeScript with Vite |
| Web server | Python, Ruby with Sinatra, PHP, Rust with Axum, Go, Java, Kotlin/JVM, Node.js, and ASP.NET Core |
| Games | MonoGame and Raylib for C, C++, or C# |
| Shared library | Kotlin Multiplatform with JVM and Node.js targets and shared Kotlin tests |
| VR (opt-in) | Kotlin with Jetpack Compose for XR, plus native Android Raylib for C and C++ |

The generated README provides build and run commands. Use a Qt kit that matches your C++ compiler and set `CMAKE_PREFIX_PATH` to that kit. CUDA projects require the NVIDIA CUDA Toolkit and a supported host compiler. Running a CUDA sample also needs a compatible GPU and driver. Expo uses Node.js 22.13 or newer and a compatible Expo SDK 57 client or development build. [Qt setup](https://doc.qt.io/qt-6/qt-online-installation.html) · [CUDA Toolkit](https://developer.nvidia.com/cuda-downloads) · [Expo device setup](https://docs.expo.dev/get-started/set-up-your-environment/)

In **Graphics**, choose your SDL version, graphics API, and language from the template names. The Vulkan starters clear and present a Vulkan swapchain and rebuild it on resize. Use a Vulkan 1.1 runtime and development files 1.3.216 or newer. On macOS, use the Vulkan SDK with MoltenVK. If a template needs setup, clear **Ready to use** to see the guide. [Vulkan SDK downloads](https://vulkan.lunarg.com/sdk/home)

MonoGame and built-in .NET generators require an active .NET SDK 8 or newer. Use **MonoGame → Install MonoGame templates** if the project templates are missing.

The React Native Community CLI starter downloads the official Android and iOS project files, including a Jest sample. Use the generated README to install dependencies, configure the platform SDK, and run the app. [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)

The Kotlin Android XR starter demonstrates a spatial panel and switching between Home Space and Full Space on an Android XR headset or emulator. The Raylib Android VR starters build a `NativeActivity` APK with the Android NDK and CMake. They show stereoscopic rendering, lens distortion, and rotation tracking on an ARM64 Android phone in a landscape VR viewer. Follow each generated README for Gradle and SDK requirements. [Jetpack XR setup](https://developer.android.com/develop/xr/jetpack-xr-sdk/set-up-sdk) · [Android NDK and CMake setup](https://developer.android.com/studio/projects/install-ndk)

## Project setup

- **Python** requires a project-local `.venv`. Choose built-in `venv`, `uv`, Conda, or `virtualenv` and select a Python version. The wizard creates the environment and installs the selected packages before opening the project. If setup fails, the generated README and Project Wizard output show how to finish setup.
- **CMake** offers curated libraries and accepts custom archive dependencies. The format is `name target https://example.com/library.tar.gz [sha256]`, one dependency per line. The generated project uses `FetchContent` to obtain and link the dependencies when you configure the build.
- **npm** starters accept one dependency per line, for example `@scope/package@^1.0.0`. The selected packages go into `package.json`.
- **Tests** are optional. C can use CTest, C++ and CUDA can use GoogleTest or Catch2, Python can use pytest or `unittest`, and JavaScript and TypeScript can use the Node.js test runner or Vitest where supported. C# offers xUnit and NUnit, Java and Kotlin offer JUnit with Maven, and Swift packages offer XCTest. Go, Rust, and Zig offer their native test runners. Follow the generated README to run the example.
- **CMake test examples** call the same `starter_add` function that the app uses. The implementation is in `src/starter.c` or `src/starter.cpp`, with a declaration in `include/starter.h`. The native Android Raylib samples run these tests on the host compiler.
- **Kotlin Multiplatform** includes a shared `kotlin.test` suite by default. Run `gradle jvmTest jsNodeTest` to test the same function on the JVM and Node.js.

## Custom ZIP templates

1. Put each starter project in a separate `.zip` file in one directory.
2. Run **Project Wizard: Choose ZIP Templates Folder**, or use **Custom ZIPs → Choose ZIP folder…**. The wizard saves the location in `projectWizard.zipTemplatesDirectory`.
3. Choose an archive by filename. The wizard removes a single wrapper directory and preserves the rest of the project structure.

Paths and UTF-8 text files up to 1 MiB can contain `__PROJECT_NAME__`, `__PROJECT_IDENTIFIER__`, or `__PROJECT_SLUG__`. For a project named `My Game`, they expand to `My Game`, `My_Game`, and `my-game`. Identifiers starting with a digit receive a leading underscore. ZIPs must be unencrypted and may contain up to 10,000 entries and 1 GiB of uncompressed data.

## GitHub Actions

Commit this folder to a GitHub repository with Actions enabled. The **Build Project Wizard** workflow in `.github/workflows/build.yml` runs on pushes, pull requests, and manual dispatch. It runs tests on Windows, macOS, and Linux, then packages a VSIX. Open a successful run in the **Actions** tab and download **project-wizard-vsix** from **Artifacts**.

To publish a release, commit the version in `package.json` and `package-lock.json`, then push a matching tag such as `v0.5.1`. After the three test jobs pass, the workflow creates the GitHub release and attaches `project-wizard-0.5.1.vsix` under **Assets**. It attaches the VSIX to an existing release for the same tag if needed.

```sh
git tag v0.5.1
git push origin v0.5.1
```

## Add more starters

Register starters in `src/standard-templates.js` and add their source files under `templates/`. Toolchain detection and installation guides live in `src/toolchains.js`. Project setup choices are defined in `src/project-options.js`.

## License

Project Wizard is released under the [MIT License](LICENSE).
