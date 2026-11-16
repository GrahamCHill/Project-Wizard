# Project Wizard for CLion

Open **File → New Project** or **New Project** on the welcome screen. Select a starter such as **Raylib for C++** or **SDL** from the left sidebar under **Other**. Enter the project location and choose its options before clicking **Create**.

The plugin shares Project Wizard’s project generators and lists the starters available on the current platform. CLion’s own basic CMake, CUDA, and empty projects use the built-in entries. Other equivalent templates, such as Next.js, use the existing entry when its generator is installed. Select **Custom ZIP and MonoGame Templates** to import ZIPs or install the MonoGame templates when .NET is available.

## Install

1. Use CLion 2026.2 or newer, and put Node.js 20.9+ on PATH before launching CLion.
2. Download `project-wizard-clion-<version>.zip` from the GitHub release or build it below. In CLion, open **Settings → Plugins**, click the gear, and select **Install Plugin from Disk…**. Pick the ZIP and restart CLion. [JetBrains plugin installation guide](https://www.jetbrains.com/help/clion/managing-plugins.html#install_plugin_from_disk)
3. Select a starter in **New Project**. The first selection checks installed SDKs and build tools. The starter shows its requirements alongside its options.

## Build the plugin ZIP

Use Node.js, npm, a JDK 25 installation, and the extracted or installed CLion 2026.2+ SDK. Run the commands from the repository root. On macOS, pass the path to `CLion.app`.

```sh
npm ci
npm run package:clion -- --ide "/path/to/CLion"
```

You can also set `CLION_HOME` and run `npm run package:clion`. The ZIP is written to `clion/build/project-wizard-clion-<version>.zip` using the version in the root manifest.

## Build and index CMake projects

For a desktop project, let CLion load its root `CMakeLists.txt` and configure a CMake profile using your local toolchain. Once configuration succeeds, CLion gets the library include paths and compiler flags from CMake for navigation and autocomplete. The first configure may download Raylib, SDL, or other selected dependencies. [CLion CMake profiles](https://www.jetbrains.com/help/clion/cmake-profile.html)

For a browser-only project, activate the Emscripten SDK and configure a CLion CMake profile using its toolchain file. Add `-DCMAKE_TOOLCHAIN_FILE=<emsdk>/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake` to **CMake options** and use the SDK environment for the profile. The generated README includes terminal build commands and itch.io and website publishing instructions. [CLion toolchain settings](https://www.jetbrains.com/help/clion/how-to-create-toolchain-in-clion.html)

For mixed projects whose CMake file lives under `native/`, open that CMake file as the CMake project when working on C or C++ code. Use the generated README to build the rest of the project with its own SDK.
