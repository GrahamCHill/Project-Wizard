# Project Wizard for CLion

Open **File → New Project** or **New Project** on the welcome screen. Select **Raylib for C++** under **Raylib**, **SDL** under **Graphics**, or another starter from the grouped sidebar. Enter the project location and choose its options before clicking **Create**.

The plugin shares Project Wizard’s project generators and lists the starters available on the current platform. CLion’s own basic CMake, CUDA, and empty projects use the built-in entries. Other equivalent templates, such as Next.js, use the existing entry when its generator is installed. Select **Custom ZIP and MonoGame Templates** to import ZIPs or install the MonoGame templates when .NET is available.

Spring Boot includes Java and Kotlin JSON APIs, Thymeleaf web apps, and command-line applications, plus the Docker backend. Select **Choose Spring plugins…** to open a second dialog for Spring starters and H2, PostgreSQL, or MySQL. Maven manages the dependencies; the generated README describes connection settings, authentication, and optional context tests.

## Install

For Go desktop apps, select **Wails Desktop** under **Desktop**, then choose **Wails 2** or **Wails 3** using **Wails version**. Both versions include app icon support and a generated README with development and packaging commands.

The catalog also includes React, Vue, and Svelte TypeScript frontends, a TypeScript Express API, Python, Go, and Rust libraries, and C# class-library and worker-service templates. Follow each generated README to install dependencies, run tests, and build the project with its own toolchain.

1. Use CLion 2026.2 or newer, and put Node.js 20.9+ on PATH before launching CLion.
2. Download `project-wizard-clion-<version>.zip` from the GitHub release or build it below. In CLion, open **Settings → Plugins**, click the gear, and select **Install Plugin from Disk…**. Pick the ZIP and restart CLion. [JetBrains plugin installation guide](https://www.jetbrains.com/help/clion/managing-plugins.html#install_plugin_from_disk)
3. Select a starter in **New Project**. CLion configures its CMake toolchain when you open the generated project. Python and Wails check installed tools to populate their options. Generators that invoke an external SDK look it up when you click **Create**.

## Build the plugin ZIP

Use Node.js, npm, a JDK 25 installation, and the extracted or installed CLion 2026.2+ SDK. Run the commands from the repository root. On macOS, pass the path to `CLion.app`.

```sh
npm ci
npm run package:clion -- --ide "/path/to/CLion"
```

You can also set `CLION_HOME` and run `npm run package:clion`. The ZIP is written to `clion/build/project-wizard-clion-<version>.zip` using the version in the root manifest.

## Build and index CMake projects

For the **SDL** starter, choose **Vulkan** or **OpenGL** to generate a colored triangle with vertex and fragment shaders under `shaders/`. Both examples work with SDL 2 or 3 in C or C++. CMake embeds the shaders when building; Vulkan also needs `glslc` or `glslangValidator` from the Vulkan SDK. Edit the GLSL files and rebuild to see your changes.

For a desktop project, let CLion load its root `CMakeLists.txt` and configure a CMake profile using your local toolchain. Once configuration succeeds, CLion gets the library include paths and compiler flags from CMake for navigation and autocomplete. The first configure may download Raylib, SDL, or other selected dependencies. [CLion CMake profiles](https://www.jetbrains.com/help/clion/cmake-profile.html)

For a browser-only project, activate the Emscripten SDK and configure a CLion CMake profile using its toolchain file. Add `-DCMAKE_TOOLCHAIN_FILE=<emsdk>/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake` to **CMake options** and use the SDK environment for the profile. The generated README includes terminal build commands and itch.io and website publishing instructions. [CLion toolchain settings](https://www.jetbrains.com/help/clion/how-to-create-toolchain-in-clion.html)

For mixed projects whose CMake file lives under `native/`, open that CMake file as the CMake project when working on C or C++ code. Use the generated README to build the rest of the project with its own SDK.
