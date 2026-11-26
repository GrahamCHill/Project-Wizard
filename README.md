# Project Wizard for VS Code, and a Go CLI with Cobra |, and a browser extension for Chrome, Firefox, and Safari |, and Cloudflare Workers |

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

To keep projects in one place, enter or browse to a folder and click **Save as default** next to **Location**. Every new wizard then starts there, so you do not have to pick the folder each time. The button changes to **Clear default** while the current location is the saved one. A folder you open the wizard from, such as an Explorer right-click, still wins, and a saved folder that no longer exists is ignored in favor of your workspace or home folder. The choice is stored in the machine-scoped setting `projectWizard.defaultLocation`, which you can also edit in Settings or `settings.json`. It is per machine because paths differ between your computer, WSL, and remote hosts.

To scaffold inside your current workspace, use **Project Wizard: New Project in Workspace…** and select a workspace root if prompted. You can also right-click any folder in Explorer and select **New Project**. Both routes default to **Keep in current workspace**, which creates and reveals the project folder in Explorer.

**Initialize Git repository** is on by default when Git is installed. It starts off inside an existing repository, including a linked worktree, and you can override the choice before creating the project. The wizard initializes the repository without making a commit.

**Ready to use** is checked by default. Clear it to see starters and setup choices that need additional tools. Set the default in **Settings → Hide templates and choices that need toolchain setup**. Select a starter to see its requirements and installation guides. Expand **Detected toolchains** for versions and locations. Refresh templates after setup and restart VS Code if an installer changed PATH.

The wizard saves discovery results across VS Code restarts and shows the cached catalog as soon as it opens. On first use, the built-in catalog appears while discovery runs. While the wizard is visible, stale results refresh in the background. The .NET SDK and MonoGame templates are cached per destination folder so they respect its SDK selection. **Refresh templates** requests an immediate scan after you change your tools or templates.

## Wizard settings and recent projects

Open **Settings** in the New Project wizard. Clear a language to hide all its templates, or clear a specific template to hide it individually. Click **Save settings** to apply your choices across workspaces. The wizard stores them in the VS Code user setting `projectWizard.catalog`.

Select **Open Project Wizard when VS Code starts** and save to show the wizard on startup. This setting starts off. **Recent projects** below the creation form lists up to 10 folders and saved workspaces from VS Code’s **Open Recent** history. Select one to open it in the current window. If the VS Code history command is unavailable, the wizard uses the folders and workspaces it has seen in the current profile.

VR templates are off by default. Select **Enable VR templates** and save to show the **VR** category. You can still enable or disable each VR template individually.

LaTeX templates are off by default. Select **Enable LaTeX templates** and save to show **Documents** and its article starter.

## Templates

The **React**, **Vue**, and **Svelte TypeScript Frontend** entries use the official Vite generator. They create the project without installing dependencies or starting a server; run `npm install` and follow the generated README. **TypeScript Express API** includes health and greeting routes, validation, HTTP tests, and a compiled production build. [Vite templates](https://vite.dev/guide/) · [Express](https://expressjs.com/en/5x/starter/installing/)

**Python Package and CLI** uses a `src` layout, `pyproject.toml`, and an editable install in the selected environment. **Go Library** and **Rust Cargo Library** include tests for their public APIs. **Go Command Line** and **Go HTTP Server** also ship with `go test` suites: the CLI exposes a `run` function that tests call with their own arguments and output buffers, and the server exposes `newHandler` so `httptest` can exercise it without opening a port. **C# Class Library** builds a reusable assembly and NuGet package; **C# Worker Service** creates a background service with logging and cancellation. These entries also appear in the CLion plugin. [Python packaging](https://packaging.python.org/en/latest/tutorials/packaging-projects/) · [.NET templates](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-new-sdk-templates)

| Category | Examples |
| --- | --- |
| Command line | C and C++ with CMake, CUDA kernel and library, Dart, Python, Ruby, PHP, Lua, Rust, Go, Swift, Java, Kotlin/JVM, Zig, and .NET |
| Systems | x86 and x86-64 NASM, ARM64 assembly for Windows, Linux, and Apple silicon, Raspberry Pi OS and Pico firmware, Arduino AVR, ESP32, STM32 and Nordic with Zephyr, and Linux kernel modules |
| Desktop & Mobile | Qt, wxWidgets, GTK, GTKmm, and C++ + Lua with CMake, plus Flutter, Tauri, Electron, Wails, Python Tkinter, Java and Kotlin Swing, macOS SwiftUI and AppKit, and Windows Forms, and for phones React Native, Android Views (Java), Android Jetpack Compose (Kotlin), iOS UIKit or SwiftUI (Swift), and Flutter |
| Games & Graphics | MonoGame, Raylib for C, C++, or C#, and a mixed C++ and C# Raylib app, SFML and SFML + Dear ImGui in C++, SDL with graphics options in C or C++, a mixed C# + C++ + Lua example, LÖVE for Lua, and the engines Unity 6 (C#), Unreal Engine 5 (C++), Godot 4 (GDScript), and Godot 4 GDExtension (C++ or Rust) |
| Web | React, Vue, and Svelte with TypeScript and Vite, Flutter Web, Next.js, Nuxt, static HTML/CSS/JavaScript, vanilla TypeScript with Vite, a browser extension, and servers in TypeScript with Express, Dart, FastAPI, Django, Flask, Ruby with Sinatra, PHP and Laravel + Vue, Rust with Axum, Go, Java, Kotlin/JVM, Node.js, Spring Boot, ASP.NET Core, and Cloudflare Workers |
| Blender | An installable add-on extension and a headless scene automation script |
| Data & AI | DuckDB analytics, scikit-learn classification, a NumPy neural network, PyTorch digit classification, ONNX export and inference, time-series forecasting, and local Ollama chat and document Q&A, a chat client for Claude, Groq, and OpenAI-compatible models in Python and TypeScript, and MCP servers in Python and TypeScript |
| Cloud & DevOps | Docker projects for Python, Spring Boot, Go, and Rust backends, a Node.js frontend, Qdrant, local RAG, a cloud-ready ONNX inference API, and an API with PostgreSQL and Redis, plus infrastructure as code: Terraform on AWS, Google Cloud, Azure, and Linode, Terraform with a development root and bootstrap roots, AWS SAM, AWS CloudFormation, Azure Bicep, Kubernetes with Kustomize, a Helm chart, and an Ansible playbook |
| Misc | A Blender scene loaded as a walkable world in Raylib, SDL, and Bevy |
| Documents (opt-in) | A LaTeX article with a BibTeX bibliography |
| Libraries and packages | Python package and CLI, Go module, Rust crate, C# class library, and Kotlin Multiplatform with JVM and Node.js targets |
| VR (opt-in) | Kotlin with Jetpack Compose for XR, plus native Android Raylib for C and C++ |

The generated README provides build and run commands. Use a Qt kit that matches your C++ compiler and set `CMAKE_PREFIX_PATH` to that kit. CUDA projects require the NVIDIA CUDA Toolkit and a supported host compiler. Running a CUDA sample also needs a compatible GPU and driver. Expo uses Node.js 22.13 or newer and a compatible Expo SDK 57 client or development build. [Qt setup](https://doc.qt.io/qt-6/qt-online-installation.html) · [CUDA Toolkit](https://developer.nvidia.com/cuda-downloads) · [Expo device setup](https://docs.expo.dev/get-started/set-up-your-environment/)

Under **Systems**, each assembly starter generates a README with toolchain setup, build commands, and instructions to run the app or flash a board. Clear **Ready to use** to see starters that need a compiler or board SDK.

| Assembly starter | Target and build |
| --- | --- |
| x86 (32-bit NASM) | Windows with `-A Win32` or Linux with a 32-bit compiler and libraries. On x86-64 Linux, configure with `-DCMAKE_C_FLAGS=-m32`. |
| x86-64 (NASM) | x64 Windows with `-A x64`, x86-64 Linux, and Intel macOS. |
| ARM64 | Linux or Apple silicon macOS with GCC or Clang. Windows has a separate Visual Studio `armasm64` starter built with `-A ARM64`. |
| Raspberry Pi OS | Build on a Pi running 64-bit Raspberry Pi OS or cross-compile from Linux with the included AArch64 CMake toolchain file. |
| Raspberry Pi Pico / Pico 2 | Build Thumb firmware with the Pico SDK and copy the `.uf2` to the board in BOOTSEL mode. |
| Arduino Uno R3 | Compile and upload the AVR sketch using Arduino CLI or Arduino IDE. |
| ESP32 / ESP32-C3 | Build and flash with ESP-IDF. The serial output reports the result of the Xtensa or RISC-V routine. |
| STM32 Nucleo-F401RE / Nordic nRF52840 DK | Use `west build` and `west flash` from a configured Zephyr workspace. |

For the desktop starters, the C launcher and CTest call the same assembly routine. Run `cmake --build build` and `ctest --test-dir build --output-on-failure` after configuring. With Visual Studio, add `--config Debug` to the build and `-C Debug` to CTest. The board examples check the assembly result on startup. [NASM](https://www.nasm.us/docs.html) · [Pico SDK](https://www.raspberrypi.com/documentation/microcontrollers/c_sdk.html) · [Arduino CLI](https://arduino.github.io/arduino-cli/latest/getting-started/) · [ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c3/get-started/index.html) · [Zephyr](https://docs.zephyrproject.org/latest/develop/getting_started/index.html)

On Linux, the wizard also offers a kernel module with load and unload hooks and a read-only character device. The modules use GNU Make and kbuild. The wizard checks for build headers for the running kernel or the prepared build tree set in `KDIR`. [Linux external modules](https://docs.kernel.org/kbuild/modules.html)

The CMake desktop starters, including SDL2, SDL3, and their OpenGL and Vulkan variants, include a `distribution` build target. Configure a Release build and run `cmake --build build --config Release --target distribution` to collect the app and its runtime libraries in `build/dist/Release/`. Share the entire folder for the target OS and architecture. Windows Vulkan packages include the loader. The macOS packaging step copies linked dylibs and frameworks into the `.app`, rewrites their paths, and adds MoltenVK for Vulkan apps. Graphics drivers and OS libraries come from the destination system. Other desktop starters provide packaging commands for their toolchains in the generated README. [CMake BundleUtilities](https://cmake.org/cmake/help/latest/module/BundleUtilities.html)

### Publish Raylib and SDL on itch.io or a website

**Browser builds.** Choose **Web (Emscripten)** in Project setup for Raylib C or C++. New SDL C and C++ projects with **SDL 2D (automatic)** include both desktop and Emscripten builds for SDL 2 and SDL 3. The OpenGL, Vulkan, and DirectX SDL starters ship as native downloads. For an older SDL project you want to port, follow SDL’s guide to adapting the main loop and renderer for the browser. [SDL Emscripten guide](https://wiki.libsdl.org/SDL3/README-emscripten)

Activate the Emscripten SDK, then run these commands from the generated project folder. On Windows, put Ninja or MinGW Make on PATH. [Emscripten SDK setup](https://emscripten.org/docs/getting_started/downloads.html)

```sh
emcmake cmake -S . -B build-web -DCMAKE_BUILD_TYPE=Release -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
cmake --build build-web --config Release
emrun build-web/index.html
```

Package `build-web/index.html`, `index.js`, and `index.wasm` together. For an unmodified starter, run these commands from the project root to create the ZIP. If you add assets or preload data, include the extra runtime files and keep their relative paths.

```sh
cd build-web
cmake -E tar cf game-web.zip --format=zip index.html index.js index.wasm
```

- **itch.io** — Set **Kind of Game** to **HTML Game**, upload the ZIP with `index.html` at its root, and preview the game on the project page. [itch.io HTML5 guide](https://itch.io/docs/creators/html5)
- **Website** — Upload the runtime files to a static host, open the hosted `index.html` over HTTP or HTTPS, and serve `.wasm` as `application/wasm`. [Emscripten hosting guide](https://emscripten.org/docs/compiling/WebAssembly.html#web-server-setup)

**Desktop downloads.** Generate one ZIP per OS and architecture. For C or C++ starters, build the `distribution` target and ZIP the complete `build/dist/Release/` output. For C# and mixed-language starters, use the generated README’s `dotnet publish` or macOS app bundle instructions and ZIP the complete output. On itch.io, upload the ZIPs as downloads and tag each by platform. On a website, link each archive for download. [itch.io first project guide](https://itch.io/docs/creators/getting-started)

Next.js, Nuxt, and Tauri use their official generators with npm. The wizard downloads the starter during creation. Run `npm install` in the generated project and follow its README for development and build commands. Tauri uses a TypeScript frontend and a Rust backend. Electron comes with separate main, preload, and renderer files and uses Electron Forge to package the app. [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/create-next-app) · [Nuxt starters](https://github.com/nuxt/starter) · [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) · [Electron Forge packaging](https://www.electronforge.io/cli#package)

Under **Desktop**, filter the language to **Go** and choose **Wails Desktop**. Select **Wails 2** or **Wails 3** under **Wails version** in Project setup, with Wails 3 preferred when both are ready. The wizard detects the matching CLI and uses its official generator to create a Go backend and Vite frontend. Clear **Ready to use** to see the entry when its toolchain needs setup. The generated README covers development and packaging on Windows, macOS, and Linux. A selected PNG or WebP becomes the source image for the Wails packaging tools. Both versions include a Go test for the greeting method (`app_test.go` for Wails 2, `greetservice_test.go` for Wails 3) and a `frontend/dist` placeholder so `go test ./...` compiles before the first frontend build. Because Git ignores `frontend/dist`, a fresh clone or CI job needs `npm --prefix frontend install && npm --prefix frontend run build` first. The generated README explains this and the Linux webview libraries that compiling needs. [Wails 3 installation](https://v3.wails.io/getting-started/installation/) · [Wails 2 installation](https://v2.wails.io/docs/gettingstarted/installation/)

The GTK and GTKmm starters use CMake and pkg-config. On Windows, install the GTK development packages and CMake toolchain in MSYS2 UCRT64 and launch VS Code from that shell. On Linux or macOS, install GTK 4 or GTKmm 4 from your package manager. [GTK installation](https://www.gtk.org/docs/installations/) · [GTKmm](https://www.gtk.org/docs/language-bindings/cpp/)

The wxWidgets starter builds the `app` target with an installed SDK or the official wxWidgets 3.2.10 source archive. Use `-DPROJECT_USE_SYSTEM_WXWIDGETS=OFF` to select the source build. The generated README includes the Linux prerequisites and Windows Visual Studio instructions. [wxWidgets 3.2.10](https://github.com/wxWidgets/wxWidgets/releases/tag/v3.2.10)

The native Godot starters use GDExtension. Build the C++ library with CMake or the Rust library with Cargo, then open the Godot project and run the scene that calls the native class. The C++ + Lua desktop starter uses CMake to fetch Raylib and Lua and deploys an editable Lua script alongside the executable. [Godot GDExtension](https://docs.godotengine.org/en/stable/engine_details/engine_api/gdextension/what_is_gdextension.html) · [godot-rust](https://godot-rust.github.io/)

The Blender extension builds an installable ZIP. The automation script generates a scene and saves it as a `.blend` file from the command line. Both use Blender’s bundled Python. The ML, AI, FastAPI, Django, and Flask starters install their required packages in a project-local virtual environment. [Blender extensions](https://docs.blender.org/manual/en/latest/advanced/extensions/getting_started.html) · [Ollama API](https://docs.ollama.com/api/chat)

Laravel + Vue uses Composer to download the official starter. The generated README covers SQLite, dependency setup, and the development server. The native iOS SwiftUI template appears on macOS and uses XcodeGen. The Android Compose template builds with Gradle and includes a counter unit test. [Laravel starter kits](https://laravel.com/docs/13.x/starter-kits) · [XcodeGen](https://github.com/yonaskolb/XcodeGen)

The standalone Dart starters support the Dart SDK or the Dart SDK bundled with Flutter. The Flutter starters use the SDK generator to create platform files for Mobile (Android and iOS), Desktop (Windows, macOS, and Linux), or Web. Each Flutter starter includes a widget test and a README with build commands. [Dart SDK setup](https://dart.dev/get-dart) · [Flutter setup](https://docs.flutter.dev/install) · [Flutter desktop distribution](https://docs.flutter.dev/platform-integration/desktop)

Under **Games & Graphics**, the Unity includes a demo scene with a rotating cube and dedicated scripts, scenes, art, audio, and prefab folders. Unreal includes a C++ game module, game and editor targets, organized content folders, and a spinning actor to place in a level. Godot includes a runnable 2D scene with arrow-key movement and a reusable player scene. Clear **Ready to use** to create a starter before installing its editor. For custom editor locations, set `UNITY_EDITOR_PATH`, `UNREAL_ENGINE_ROOT`, or `GODOT_PATH` as shown in the wizard’s setup guides. [Unity Editor installation](https://docs.unity.com/en-us/hub/add-editor) · [Unreal directory structure](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-directory-structure) · [Godot project organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html)

In **Graphics**, pick **SDL**. In the right-hand **Project setup** pane, choose C or C++, SDL 2 or 3, and a renderer. **Vulkan** and **OpenGL** each draw a colored triangle using editable `shaders/triangle.vert` and `shaders/triangle.frag` files. Vulkan uses a resize-aware swapchain and graphics pipeline; CMake compiles its GLSL to SPIR-V with `glslc` or `glslangValidator` from the Vulkan SDK. OpenGL uses a 3.3 core context, loads shader functions through SDL, and reports shader compile/link errors at startup. Edit the shaders and rebuild. Both examples embed their shaders, so the packaged app needs no external shader files. DirectX 11 and 12 appear on Windows and use SDL’s explicitly selected Direct3D driver. The automatic SDL 2D option chooses an available driver. Clear **Ready to use** to see options that need additional setup. [SDL render drivers](https://wiki.libsdl.org/SDL3/SDL_HINT_RENDER_DRIVER) · [Vulkan SDK](https://vulkan.lunarg.com/sdk/home)

**C# + C++ + Lua Graphics** uses SDL 3. Choose the renderer in **Project setup**. `dotnet run` builds the native bridge and launches the example. Press **R** to reload the Lua script while the window is open. The generated README covers self-contained publishing and macOS app bundles. [SDL renderer selection](https://wiki.libsdl.org/SDL3/SDL_CreateRenderer)

The **SFML** and **SFML + Dear ImGui** starters offer **SFML 3.1.0** and **SFML 2.6.2** in Project setup. The choice sets the C++ API, pinned libraries, and Linux prerequisites. The first starter has a circle you can move with the arrow keys. The second adds an ImGui panel that changes the circle’s size and color and uses the backend compatible with the selected SFML version. Both support app icons and the `distribution` target. [SFML CMake setup](https://www.sfml-dev.org/tutorials/3.1/getting-started/cmake/) · [ImGui-SFML releases](https://github.com/SFML/imgui-sfml/releases)

Under **ML & AI**, the PyTorch and ONNX starters train on bundled datasets and save model artifacts. The forecasting starter measures accuracy on a chronological holdout and compares it with a weekly baseline. Ollama Document Q&A retrieves passages from local Markdown files and prints cited sources. Its README includes commands to download the required Ollama models. All four starters use the wizard’s project-local Python environment. [PyTorch quickstart](https://docs.pytorch.org/tutorials/beginner/basics/quickstart_tutorial.html) · [ONNX Runtime Python](https://onnxruntime.ai/docs/get-started/with-python.html) · [Ollama embeddings](https://docs.ollama.com/capabilities/embeddings)

### Qt and native starters

Choose **Desktop → Qt Desktop**, then select **Widgets** or **Quick (QML)** and **Qt 5** or **Qt 6**. The wizard checks installed kits per interface and uses the selected Qt major in the CMake project. Use Qt 5.15 or Qt 6.5 and newer. On Linux, install the matching Qt runtime libraries and platform or QML plugins on the destination. [Qt 5 and Qt 6 compatibility](https://doc.qt.io/qt-6/cmake-qt5-and-qt6-compatibility.html)

**Mobile** includes separate native iOS UIKit and SwiftUI starters in Swift, plus Android Views in Java and Jetpack Compose in Kotlin. iOS starters appear on macOS. **Desktop** includes macOS AppKit in Objective-C and an Objective-C++ version that calls a separate C++ source file. [UIKit](https://developer.apple.com/documentation/uikit) · [Android Views](https://developer.android.com/develop/ui/views/layout/declaring-layout)

### Docker projects

Open **Cloud & DevOps** in the category list on the left for the Docker starters, next to the infrastructure ones. The wizard detects Docker, the Compose plugin, and a running Linux container engine. Clear **Ready to use** to show the starters and setup guides while Docker is unavailable. Start Docker and select **Refresh templates** to update the detection. Run the generated README commands to start the containers. [Docker Compose quickstart](https://docs.docker.com/compose/gettingstarted/)

- **Python Backend** offers FastAPI, Flask, or Django. Dependencies install into a virtual environment inside the image.
- **Spring Boot Backend** offers Java or Kotlin. Both build a runnable JAR with Maven in Docker. Use **Project setup → Choose Spring plugins…** to select Spring starters and a SQL database in a separate dialog.
- **Go Backend** uses the standard HTTP library. **Rust Backend** uses Axum and Tokio.
- **Node.js Frontend** offers React, Vue, or vanilla JavaScript. Vite builds the app and Nginx serves the result.
- **Qdrant Vector Database** includes a persistent volume and an example similarity search. **Local RAG (Ollama)** lets you choose **Qdrant** or **PostgreSQL (pgvector)** under **Vector database**. Both variants retrieve passages from local Markdown files and return the source excerpts with the answer. [Qdrant quickstart](https://qdrant.tech/documentation/quickstart/) · [pgvector](https://github.com/pgvector/pgvector)
- **Cloud ONNX Inference API** includes an Iris model. It can load your trained ONNX model from a mounted file or a checksum-verified HTTPS URL. The generated README covers local prediction and deployment to a container host. [ONNX Runtime](https://onnxruntime.ai/docs/api/python/api_summary.html)

### AI, MCP, and services

**LLM Chat** (Python and TypeScript) is one streaming chat client for **Claude**, **Groq**, and any **OpenAI-compatible** server, with tool use. Claude goes through the official Anthropic SDK and Groq through its own SDK. OpenAI, Together, Mistral, OpenRouter, DeepSeek, xAI, Gemini, Ollama, LM Studio, and your own server use the OpenAI SDK with a base URL. Pick the provider with `--provider`, and the model with `--model`. Claude defaults to `claude-opus-5-5` with adaptive thinking and refusal fallbacks, and all of it is configurable by environment variable. The tests point the real SDKs at a local mock server, so they check the exact requests and need no key or network.

**MCP Server** (Python and TypeScript) is a Model Context Protocol server with three tools, a resource, and a prompt, built on the current v2 SDKs (`mcp` 2.x and `@modelcontextprotocol/server` 2.x). The generated README shows how to connect it to Claude Code, Claude Desktop, and the MCP Inspector. Its tests cover the server in memory and as a real stdio subprocess.

**Browser Extension (Chrome, Firefox, Safari)** builds one Manifest V3 source into `dist/chrome` (Chrome, Edge, Brave, and Opera), `dist/firefox`, and `dist/safari`. Only the manifest differs. `npm run run:firefox` starts Firefox with it, `npm run lint` runs Mozilla's linter, and `npm run safari` creates the Xcode project on a Mac. The icons are drawn by the build script, so no binary files live in your repository.

**Cloudflare Worker** is a small JSON API with optional Workers KV and unit tests that call it without a server. **Go Command Line with Cobra** has subcommands, flags, validation, and distinct exit codes, with tests that run the whole command line. **API + PostgreSQL + Redis Stack** is a Docker Compose project with health-gated startup, a non-root, read-only API container, a Redis cache, and a smoke test for the running stack.

**AWS SAM Serverless API** is a Lambda function behind an HTTP API with DynamoDB and unit tests. **AWS CloudFormation** and **Azure Bicep** mirror the Terraform AWS and Azure starters, each with a GitHub Actions workflow that lints without credentials and previews and deploys only when you opt in, using OIDC so no keys are stored.

**DuckDB Analytics (Python)** is an embedded analytics warehouse with no server to run. It loads CSV files into tables with keys and `CHECK` rules, checks data quality, runs four SQL reports (monthly revenue with a running total, the top five customers by rank, category sales by quarter with `PIVOT`, and customer cohorts), runs ad-hoc queries on a read-only connection, and exports Parquet. Reports are plain `.sql` files, and only the ones listed in the project can be run by name. Its 23 tests use the real DuckDB engine in memory.

### Misc: a Blender world in Raylib, SDL, and Bevy

Three examples load the same scene made in Blender and let you walk around in it with collision and lamp lighting. Blender exports a glTF file, and each example reads it into triangles, collision boxes, lamps, and a spawn point.

| Template | Language | How it draws |
| --- | --- | --- |
| **Blender World in Raylib** | C | Raylib 6.0 meshes with a small lighting shader |
| **Blender World in SDL** | C | SDL 3.4 for the window and input, and a software 3D renderer written in plain C: clipping, projection, depth buffer, per-pixel lighting |
| **Blender World in Bevy** | Rust | Bevy 0.20 meshes and point lights, with the glTF read by the `gltf` crate |

In Blender, mark every solid object with the custom property `collider` set to `box`, add an Empty named `spawn_player`, and add point lights. Each project includes `tools/export_world.py`, which runs inside Blender (`blender --background scene.blend --python tools/export_world.py -- assets/world.gltf`), checks the scene, and writes the file. The projects start with a small sample room, so they run before you open Blender. The loader and player are shared, tested code: the two C examples use identical copies, and the Bevy version is the same logic in Rust, with the same tests. Each project runs with `--screenshot file.png` to save a picture of the first view, which makes it easy to check in CI.

### Infrastructure

Choose **Infrastructure → Terraform Infrastructure** for a starter with `infra/envs/dev`, separate state and scan-access bootstrap roots, and reusable private network and ingestion modules. Its example can plan and test locally. The generated README explains how to add environments and configure an Azure Storage backend. [Terraform module structure](https://developer.hashicorp.com/terraform/language/modules/develop/structure)

Four provider starters create a single Terraform root with a network and storage, hardened defaults, and a `tests/main.tftest.hcl` suite. The tests plan against mock providers, so they need no cloud account or credentials. `terraform init` still downloads the providers. Each includes remote state examples that stay inactive until you copy them.

| Starter | Creates | Remote state example |
| --- | --- | --- |
| **Terraform on AWS** | VPC with public and private subnets, and a versioned, encrypted S3 bucket with public access blocked | S3 |
| **Terraform on Google Cloud** | Custom VPC and subnet, internal and IAP-only SSH firewall rules, and a versioned Cloud Storage bucket | Cloud Storage |
| **Terraform on Azure** | Resource group, virtual network with subnets, a network security group, and a TLS 1.2 storage account | Azure Storage |
| **Terraform on Linode (Akamai Cloud)** | VPC, an SSH-key server, and a firewall that drops everything except SSH from your addresses | Object Storage (S3-compatible) |

Every Terraform starter includes a `SETUP.md` with the tools to install, the accounts and permissions to prepare, the commands that create a remote state bucket, and the cloud-side steps that let CI sign in. It also ships CI pipelines that run `terraform fmt`, `validate`, and the mock-provider tests on every pull request, with no cloud account. `.github/workflows/terraform.yml` is ready for GitHub Actions. `ci/gitlab-ci.yml` and `ci/bitbucket-pipelines.yml` are examples to copy to `.gitlab-ci.yml` and `bitbucket-pipelines.yml`. Planning and applying are off until you set the repository variable `TERRAFORM_DEPLOY` to `true`. They then refuse to run without a committed `backend.tf`, so CI cannot lose track of its own state. Pull requests from forks never receive credentials, and Apply waits for a manual approval where the host supports one. GitHub signs in to AWS, Google Cloud, and Azure with OIDC, so no long-lived keys are stored. Linode, GitLab, and Bitbucket use secrets, and `SETUP.md` points to OIDC alternatives.

**Kubernetes with Kustomize** has a base and `dev` and `prod` overlays for a workload that follows the restricted Pod Security Standard, and `kubectl kustomize` renders it without a cluster. **Helm Chart** includes a values schema, optional Ingress and autoscaling, and a `helm test` connection check. **Ansible Playbook** configures Debian or Ubuntu servers with a common role and an NGINX role behind a default-deny firewall. It needs ansible-core on Linux, macOS, or WSL, so it is hidden on native Windows. The wizard detects Terraform 1.9+, kubectl 1.27+, Helm 3.8+, and ansible-core 2.15+ and offers install help for any that are missing. [Kustomize](https://kubectl.docs.kubernetes.io/guides/introduction/kustomize/) · [Helm](https://helm.sh/docs/) · [Ansible](https://docs.ansible.com/ansible/latest/getting_started/index.html)

The test suite checks that every generated infrastructure project is complete. It also renders the Kubernetes overlays with `kubectl` when it is installed, and lints and renders the Helm chart when Helm is installed. It also runs `actionlint` on the generated GitHub workflows, and `ansible-playbook --syntax-check` when Ansible and the `community.general` collection are installed. Two checks download modules or providers, so they run only on request and need network access. `PROJECT_WIZARD_TERRAFORM=1` runs `terraform fmt`, `validate`, and `test` on each Terraform starter. `PROJECT_WIZARD_WAILS=1` generates real Wails 2 and Wails 3 projects with their CLIs and runs `go vet` and `go test` on them. `PROJECT_WIZARD_CMAKE=1` configures, builds, and runs the tests of the Raylib and SDL Blender world examples, which downloads yyjson and the engine and needs the usual Linux system packages. `PROJECT_WIZARD_CARGO=1` runs `cargo test` on the Bevy one, which compiles Bevy and takes several minutes. `PROJECT_WIZARD_BPY` points to a Python that has the `bpy` package, so the Blender export script runs against a scene built with real Blender code. `PROJECT_WIZARD_ONLINE=1` runs `npm install` and the tests in the generated TypeScript, extension, and Worker projects, and `go mod tidy` and `go test` in the Cobra CLI. `PROJECT_WIZARD_PYTHON` points to a Python that has the `anthropic`, `groq`, `openai`, `mcp`, `fastapi`, `httpx`, `psycopg_pool`, and `redis` packages, so the generated Python starters can run their own tests. The suite also runs `cfn-lint`, `sam validate`, `bicep build`, and `docker compose config` on the matching starters when those tools are installed. In PowerShell, set the variable first, for example `$env:PROJECT_WIZARD_TERRAFORM = "1"`, then run `npm test`.

The **C++ Plugin Host**, **C++ Plugin Host + Lua**, and **C# Plugin Host + Lua** starters scan a `plugins/` folder next to the executable at launch. The pure C++ starter builds with a C++ compiler and CMake and includes a native sample plugin with a versioned C ABI. The Lua variants also include a sample script. The C# host uses a shared `IPlugin` contract and a separate assembly load context per plugin.

GTK, GTKmm, and wxWidgets desktop starters include an Increment and Reset counter example. Follow the `clicked` handlers in GTK, `signal_clicked().connect()` in GTKmm, or `Bind(wxEVT_BUTTON, ...)` in wxWidgets to see how both buttons update the same label.

MonoGame and built-in .NET generators require an active .NET SDK 8 or newer. Use **MonoGame → Install MonoGame templates** if the project templates are missing.

**Raylib (C++ + C#)** draws a window in C# and calls a CMake-built C++ library for movement. `dotnet run` builds both parts. Choose xUnit or NUnit to test the same native function without opening a window. Use the generated README to publish the app, its .NET runtime, Raylib, and the native library together.

The mobile starters include Home and About tabs that share a counter. The React Native Community CLI starter generates the official Android and iOS project files and includes a Jest navigation test. The Flutter starter includes a widget test. Use the generated README to install dependencies, configure the platform SDK, and run the app. [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)

The Kotlin Android XR starter demonstrates a spatial panel and switching between Home Space and Full Space on an Android XR headset or emulator. The Raylib Android VR starters build a `NativeActivity` APK with the Android NDK and CMake. They show stereoscopic rendering, lens distortion, and rotation tracking on an ARM64 Android phone in a landscape VR viewer. Follow each generated README for Gradle and SDK requirements. [Jetpack XR setup](https://developer.android.com/develop/xr/jetpack-xr-sdk/set-up-sdk) · [Android NDK and CMake setup](https://developer.android.com/studio/projects/install-ndk)

## Project setup

- **Python** requires a project-local `.venv`. Choose built-in `venv`, `uv`, Conda, or `virtualenv` and select a Python version. The wizard creates the environment and installs the selected packages before opening the project. If setup fails, the generated README and Project Wizard output show how to finish setup.
- **CMake** offers a library picker that fills in the dependencies text box. The list is filtered by language and target and includes libuv for TCP and UDP in C and C++, Asio for C++ networking, tinyfiledialogs, stb, yyjson, fmt, nlohmann/json, cxxopts, GLM, Dear ImGui, and bgfx. Each preset adds a standalone program under `examples/` and an `example_<library>` CMake target. The generated README shows how to build and run them. For custom CMake archives, enter `name target https://example.com/library.tar.gz [sha256]`, one dependency per line. CMake fetches and links the selected libraries with `FetchContent`.
- **C#** offers the same picker for NuGet packages, including LiteNetLib for reliable UDP, SuperSimpleTcp for TCP clients and servers, RestSharp for HTTP, and bindings for Dear ImGui, OpenGL, and Vulkan. Enter custom packages as `Package.Id 1.2.3`, one per line. The mixed Raylib starter accepts both NuGet and CMake entries and adds them to the corresponding build files.
- **C/C++ build targets** include **Web (Emscripten)** for Raylib and the basic CMake applications. In **Project setup**, select native desktop, web, or both. The native build uses `build/` and the web build produces `build-web/index.html`, JavaScript, and WebAssembly from the same sources. The generated README includes the build and run commands for each selected target. [Emscripten setup](https://emscripten.org/docs/getting_started/downloads.html)
- **Set app icon** accepts PNG or WebP for desktop, game, and mobile starters. Project Wizard converts the image locally into the formats the app needs, including Windows ICO, macOS ICNS, Linux launcher PNG, Android resources, and iOS app icon assets. Native ICO and ICNS files are also accepted where the template uses them. Desktop MonoGame uses its executable and window icon resources, Unity imports a texture into Player Settings, and Unreal uses its platform build resources. Follow the generated README to package the app or install its Linux launcher. Graphical CMake apps build as `.app` bundles on macOS. [CMake app bundles](https://cmake.org/cmake/help/latest/prop_tgt/MACOSX_BUNDLE.html) · [Apple app icon assets](https://developer.apple.com/documentation/xcode/configuring-your-app-icon)
- **Java** offers **JDK (javac and java)**, **Maven**, and **Gradle** under **Build system** for command-line, Swing, and HTTP server projects. Maven and Gradle starters use `src/main/java`, accept dependencies as `group:artifact:version`, and run the optional JUnit example through the selected build system. The optional JUnit example for the direct JDK starter uses a separate Maven test project.
- **Spring Boot** also includes **JSON API**, **Thymeleaf Web App**, and **Command Line** templates for Java and Kotlin without Docker. These use Maven and JDK 17+. **Choose Spring plugins…** opens a separate dialog with Actuator, Validation, Security, JPA, JDBC, Thymeleaf, Cache, Mail, and DevTools. The web app includes Thymeleaf. SQL starters default to in-memory H2; PostgreSQL and MySQL write connection configuration and an environment example. Security keeps health checks public. Optional Spring Boot context tests run with `mvn test`. [Spring Boot starters](https://docs.spring.io/spring-boot/reference/using/build-systems.html)
- **npm** starters accept one dependency per line, for example `@scope/package@^1.0.0`. The selected packages go into `package.json`.
- **Tests** are optional. C can use CTest, C++ and CUDA can use GoogleTest or Catch2, Python can use pytest or `unittest`, and JavaScript and TypeScript can use the Node.js test runner or Vitest where supported. C# offers xUnit and NUnit, Java and Kotlin offer JUnit with Maven, and Swift packages offer XCTest. Dart, Go, Rust, and Zig offer their native test runners. Follow the generated README to run the example.
- **CMake test examples** call the same `starter_add` function that the app uses. The implementation is in `src/starter.c` or `src/starter.cpp`, with a declaration in `include/starter.h`. The native Android Raylib samples run these tests on the host compiler.
- **Kotlin Multiplatform** includes a shared `kotlin.test` suite by default. Run `gradle jvmTest jsNodeTest` to test the same function on the JVM and Node.js.

### Fix C/C++ IntelliSense and autocomplete in VS Code

Open the generated project folder in VS Code or VSCodium so its workspace settings apply. CMake fetches libraries and computes each source file’s include paths and compiler flags during configuration. Reconfigure when you change dependencies.

**Microsoft C/C++ and CMake Tools.** Install both extensions. New desktop CMake starters set CMake Tools as the IntelliSense provider. For an existing project, run **C/C++: Change Configuration Provider** and choose **CMake Tools**, or merge this setting into `.vscode/settings.json`.

```json
{
  "C_Cpp.default.configurationProvider": "ms-vscode.cmake-tools"
}
```

Run **CMake: Select a Kit** to choose your compiler, then **CMake: Configure**. For an existing mixed C# and C++ starter, also set `cmake.sourceDirectory` to `${workspaceFolder}/native` and `cmake.buildDirectory` to `${workspaceFolder}/native/build/vscode`. For standalone or mixed C# starters, install the C# extension and run `dotnet restore` so it can resolve NuGet libraries such as Raylib-cs. [VS Code IntelliSense guide](https://code.visualstudio.com/docs/cpp/configure-intellisense)

**clangd.** Keep one C/C++ language server enabled in the workspace. With Ninja and the native compiler available, generate the compile database below. For MSVC, run the command in a Developer PowerShell. A separate directory preserves your existing CMake generator and build. For a mixed C# and C++ starter, use `-S native -B native/build/clangd`.

```sh
cmake -S . -B build/clangd -G Ninja -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
```

New starters include `.clangd`. For existing projects, create or update `.clangd` in the project root. Adjust the path if you generated the database in a different directory.

```yaml
CompileFlags:
  CompilationDatabase: build/clangd
```

**Web-only projects.** Run the Emscripten configure command from the publishing section with a Ninja or Makefiles generator. New projects point both language servers at `build-web/compile_commands.json`. In older projects, set `CompilationDatabase` to `build-web` for clangd, or set `C_Cpp.default.compileCommands` to `["${workspaceFolder}/build-web/compile_commands.json"]` for Microsoft C/C++. If the C/C++ extension is still using a configuration provider for that workspace, select the compile database with **C/C++: Select IntelliSense Configuration**. [CMake compile database](https://cmake.org/cmake/help/latest/variable/CMAKE_EXPORT_COMPILE_COMMANDS.html) · [clangd configuration](https://clangd.llvm.org/config#compilationdatabase)

For clangd to recognize the Emscripten target and SDK headers, add a `--query-driver` argument to `clangd.arguments` in `.vscode/settings.json`. Use the compiler paths from `compile_commands.json`. An SDK installed at `C:/emsdk` on Windows uses the following setting. [clangd compiler queries](https://clangd.llvm.org/guides/system-headers#query-driver)

```json
{
  "clangd.arguments": ["--query-driver=C:/emsdk/upstream/emscripten/emcc.exe,C:/emsdk/upstream/emscripten/em++.exe"]
}
```

Use **Go to Definition** on `InitWindow` in Raylib or `SDL_Init` in SDL to check that your editor can find the library header.

## Custom ZIP templates

1. Put each starter project in a separate `.zip` file in one directory.
2. Run **Project Wizard: Choose ZIP Templates Folder**, or use **Custom ZIPs → Choose ZIP folder…**. The wizard saves the location in `projectWizard.zipTemplatesDirectory`.
3. Choose an archive by filename. The wizard removes a single wrapper directory and preserves the rest of the project structure.

Paths and UTF-8 text files up to 1 MiB can contain `__PROJECT_NAME__`, `__PROJECT_IDENTIFIER__`, or `__PROJECT_SLUG__`. For a project named `My Game`, they expand to `My Game`, `My_Game`, and `my-game`. Identifiers starting with a digit receive a leading underscore. ZIPs must be unencrypted and may contain up to 10,000 entries and 1 GiB of uncompressed data.

## GitHub Actions

Commit this folder to a GitHub repository with Actions enabled. The **Build Project Wizard** workflow in `.github/workflows/build.yml` runs on pushes, pull requests, and manual dispatch. It runs tests on Windows, macOS, and Linux, then packages both plugins. Open a successful run in the **Actions** tab to download **project-wizard-vsix** and **project-wizard-clion** from **Artifacts**.

To publish a new version, update `package.json` and `package-lock.json` and push the commit to the default branch. After the tests and packaging pass, the workflow creates a versioned release and attaches the VS Code `.vsix` and CLion `.zip` under **Assets**. Each version belongs to one commit. Bump the version to publish later changes. You can also run the workflow manually on the default branch or push a tag matching the package version.

## Project Wizard for CLion

The CLion plugin adds individual starters such as **Raylib for C++** and **SDL** to the left side of CLion’s **New Project** dialog. It shares this extension’s generators and skips entries available in CLion. See the [CLion plugin guide](clion/README.md) for installation and build instructions.

## Add more starters

Register starters in `src/standard-templates.js` and add their source files under `templates/`. Toolchain detection and installation guides live in `src/toolchains.js`. Project setup choices are defined in `src/project-options.js`.

## License

Project Wizard is released under the [MIT License](LICENSE).
