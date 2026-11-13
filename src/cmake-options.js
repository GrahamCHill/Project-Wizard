const fs = require('node:fs/promises');
const path = require('node:path');
const { starterReadme } = require('./starters');
const { cmakeIf, documentLibraryExamples, writeLibraryExample } = require('./cmake-library-examples');

const libraries = [
  { id: 'yyjson', example: 'yyjson.c', label: 'yyjson (C JSON)', languages: ['C', 'C++'], target: 'yyjson',
    url: 'https://github.com/ibireme/yyjson/archive/refs/tags/0.13.0.tar.gz' },
  { id: 'fmt', example: 'fmt.cpp', label: 'fmt (C++ formatting)', languages: ['C++', 'CUDA'], target: 'fmt::fmt',
    url: 'https://github.com/fmtlib/fmt/archive/refs/tags/12.1.0.tar.gz' },
  { id: 'nlohmann_json', example: 'nlohmann_json.cpp', label: 'nlohmann/json (C++ JSON)', languages: ['C++', 'CUDA'], target: 'nlohmann_json::nlohmann_json',
    url: 'https://github.com/nlohmann/json/releases/download/v3.12.0/json.tar.xz',
    hash: '42f6e95cad6ec532fd372391373363b62a14af6d771056dbfc86160e6dfff7aa' },
  { id: 'cxxopts', example: 'cxxopts.cpp', label: 'cxxopts (C++ command-line options)', languages: ['C++'], target: 'cxxopts::cxxopts',
    url: 'https://codeload.github.com/jarro2783/cxxopts/tar.gz/refs/tags/v3.3.1' },
  { id: 'glm', example: 'glm.cpp', label: 'GLM (C++ graphics math)', languages: ['C++'], target: 'glm::glm',
    url: 'https://codeload.github.com/g-truc/glm/tar.gz/refs/tags/1.0.3',
    before: ['set(GLM_BUILD_LIBRARY OFF CACHE BOOL "Use header-only GLM")'] },
  { id: 'stb', example: 'stb.c', label: 'stb (C/C++ image, font and utility headers)', languages: ['C', 'C++'], target: 'stb_headers',
    url: 'https://codeload.github.com/nothings/stb/tar.gz/78770d85c4d94787a56c7859017da963bc4f3439',
    cmake: ['add_library(stb_headers INTERFACE)', 'target_include_directories(stb_headers INTERFACE "${stb_SOURCE_DIR}")'] },
  { id: 'libuv', example: 'libuv.c', label: 'libuv (C/C++ TCP and UDP)', languages: ['C', 'C++'], target: 'uv_a', desktopOnly: true,
    url: 'https://dist.libuv.org/dist/v1.53.0/libuv-v1.53.0.tar.gz',
    hash: 'cb0d6dd2128d5a95bd242c6cc982a24fe608fa93da57b6b4ec763b0018c53e64',
    before: ['enable_language(C)', 'set(LIBUV_BUILD_SHARED OFF CACHE BOOL "Build libuv as a static library")'],
    cmake: ['set_target_properties(uv_a PROPERTIES POSITION_INDEPENDENT_CODE ON)'] },
  { id: 'asio', example: 'asio.cpp', label: 'Asio (C++ TCP, UDP and async networking)', languages: ['C++'], target: 'asio', desktopOnly: true,
    url: 'https://codeload.github.com/chriskohlhoff/asio/tar.gz/refs/tags/asio-1-38-2',
    cmake: [
      'find_package(Threads REQUIRED)',
      'add_library(asio INTERFACE)',
      'target_include_directories(asio SYSTEM INTERFACE "${asio_SOURCE_DIR}/include")',
      'target_compile_definitions(asio INTERFACE ASIO_STANDALONE)',
      'target_link_libraries(asio INTERFACE Threads::Threads)',
      'if(WIN32)',
      '    target_link_libraries(asio INTERFACE ws2_32 mswsock)',
      'endif()'
    ] },
  { id: 'tinyfiledialogs', example: 'tinyfiledialogs.c', label: 'tinyfiledialogs (native dialogs)', languages: ['C', 'C++'],
    target: 'tinyfiledialogs', repository: 'https://git.code.sf.net/p/tinyfiledialogs/code',
    revision: '26a964253380e4d48c6d7dead03ca13e43e38c8a', desktopOnly: true,
    cmake: [
      'enable_language(C)',
      'add_library(tinyfiledialogs STATIC "${tinyfiledialogs_SOURCE_DIR}/tinyfiledialogs.c")',
      'target_include_directories(tinyfiledialogs PUBLIC "${tinyfiledialogs_SOURCE_DIR}")',
      'set_target_properties(tinyfiledialogs PROPERTIES POSITION_INDEPENDENT_CODE ON)',
      'if(WIN32)',
      '    target_link_libraries(tinyfiledialogs PUBLIC comdlg32 ole32 shell32 user32 gdi32)',
      'endif()'
    ] },
  { id: 'imgui', example: 'imgui.cpp', label: 'Dear ImGui (C++ core)', languages: ['C++'], target: 'imgui',
    url: 'https://codeload.github.com/ocornut/imgui/tar.gz/refs/tags/v1.92.8',
    cmake: [
      'add_library(imgui STATIC',
      ...['imgui', 'imgui_draw', 'imgui_tables', 'imgui_widgets'].map(file => `    "\${imgui_SOURCE_DIR}/${file}.cpp"`),
      ')',
      'target_include_directories(imgui PUBLIC "${imgui_SOURCE_DIR}")',
      'set_target_properties(imgui PROPERTIES POSITION_INDEPENDENT_CODE ON)'
    ] },
  { id: 'bgfx', example: 'bgfx.cpp', label: 'bgfx (C++ rendering, desktop)', languages: ['C++'], target: 'bgfx',
    content: 'bgfx_cmake', desktopOnly: true,
    url: 'https://codeload.github.com/bkaradzic/bgfx.cmake/tar.gz/refs/tags/v1.168.9624-612',
    before: ['BGFX_BUILD_TOOLS', 'BGFX_BUILD_EXAMPLES', 'BGFX_INSTALL'].map(option =>
      `set(${option} OFF CACHE BOOL "Build only the bgfx libraries")`) }
];

function cmakeLibraries(template) {
  return libraries.filter(library => library.languages.includes(template.language) &&
    !(library.desktopOnly && template.androidCmake));
}

function cmakeLibraryLine(library) {
  return library.repository ? library.id : [library.id, library.target, library.url, library.hash].filter(Boolean).join(' ');
}

function parseCmakeLibraries(template, chosen, lines, targets) {
  const available = cmakeLibraries(template);
  const selected = available.filter(library => chosen.includes(library.id));
  const bundled = template.id === 'cpp-lua-desktop' ? ['lua', 'lua_runtime', 'copy_script'] :
    template.id === 'godot-native-cpp' ? ['godot_cpp', 'godot-cpp'] :
      template.id === 'cpp-plugin-host' ? ['lua', 'lua_runtime', 'copy_lua', 'sample_plugin'] :
        template.id === 'cpp-native-plugin-host' ? ['sample_plugin'] :
          template.sdlBackend ? ['lua', 'lua_runtime'] : [];
  const names = new Set(['app', 'game', 'raylib', 'sdl2', 'sdl3', 'wxwidgets', 'googletest', 'catch2', 'example_test', 'starter_logic',
    template.cmakeTarget, 'bgfx_cmake', 'bx', 'bimg', 'stb_headers', ...bundled, ...selected.map(library => library.id)]);
  for (const line of lines) {
    const [id, target, url, hash, extra] = line.split(/\s+/);
    if (names.has(id)) throw new Error('Duplicate or reserved CMake dependency name: ' + id);
    const preset = available.find(library => library.id === id && (line === id || line === cmakeLibraryLine(library)));
    if (preset) {
      names.add(id);
      selected.push(preset);
      continue;
    }
    if (libraries.some(library => library.id === id && (library.cmake || library.content))) {
      throw new Error('Use the library picker for ' + id + ' on a supported language and target.');
    }
    if (!/^[a-z][a-z0-9_-]*$/.test(id) ||
        !/^[a-zA-Z_][a-zA-Z0-9_+.-]*(?:::[a-zA-Z_][a-zA-Z0-9_+.-]*)?$/.test(target || '') ||
        !/^https:\/\/[a-zA-Z0-9][a-zA-Z0-9:/?&=_%+~@.-]+$/.test(url || '') ||
        (hash && !/^[a-f0-9]{64}$/i.test(hash)) || extra) {
      throw new Error('Enter each CMake dependency as name target https://archive-url [sha256].');
    }
    const parsed = new URL(url);
    if (parsed.username || parsed.password) throw new Error('Use a CMake archive URL without embedded credentials.');
    names.add(id);
    selected.push({ id, target, url, hash });
  }
  const desktopOnly = selected.filter(library => library.desktopOnly);
  if (targets && !targets.includes('native') && desktopOnly.length) {
    throw new Error('Select the desktop target to use ' + desktopOnly.map(library => library.id).join(', ') + '.');
  }
  return selected;
}

function declare(library) {
  return [
    'FetchContent_Declare(' + (library.content || library.id),
    ...(library.repository ? ['    GIT_REPOSITORY "' + library.repository + '"', '    GIT_TAG ' + library.revision] : [
      '    URL "' + library.url + '"',
      ...(library.hash ? ['    URL_HASH SHA256=' + library.hash] : []),
      '    DOWNLOAD_EXTRACT_TIMESTAMP TRUE'
    ]),
    ')'
  ];
}

const cppTestTarget = [
  'add_executable(example_test tests/example_test.cpp)',
  'target_compile_features(example_test PRIVATE cxx_std_17)'
];
const testExamples = {
  ctest: {
    file: 'example_test.c',
    cmake: [
      'add_executable(example_test tests/example_test.c)',
      'target_compile_features(example_test PRIVATE c_std_11)',
      'target_link_libraries(example_test PRIVATE starter_logic)',
      'add_test(NAME example_test COMMAND example_test)'
    ],
    source: '#include "starter.h"\n\nint main(void)\n{\n    return starter_add(2, 3) == 5 && starter_add(-2, 3) == 1 ? 0 : 1;\n}\n'
  },
  gtest: {
    file: 'example_test.cpp',
    cmake: [
      'include(FetchContent)',
      'set(gtest_force_shared_crt ON CACHE BOOL "Match the parent project runtime" FORCE)',
      ...declare({ id: 'googletest', url: 'https://github.com/google/googletest/archive/refs/tags/v1.18.0.tar.gz' }),
      'FetchContent_MakeAvailable(googletest)',
      ...cppTestTarget,
      'target_link_libraries(example_test PRIVATE starter_logic GTest::gtest_main)',
      'include(GoogleTest)',
      'gtest_discover_tests(example_test DISCOVERY_MODE PRE_TEST)'
    ],
    source: '#include "starter.h"\n#include <gtest/gtest.h>\n\nTEST(Starter, AddsTwoNumbers)\n{\n    EXPECT_EQ(starter_add(2, 3), 5);\n    EXPECT_EQ(starter_add(-2, 3), 1);\n}\n'
  },
  catch2: {
    file: 'example_test.cpp',
    cmake: [
      'include(FetchContent)',
      ...declare({ id: 'catch2', url: 'https://github.com/catchorg/Catch2/archive/refs/tags/v3.11.0.tar.gz' }),
      'FetchContent_MakeAvailable(catch2)',
      ...cppTestTarget,
      'target_link_libraries(example_test PRIVATE starter_logic Catch2::Catch2WithMain)',
      'add_test(NAME example_test COMMAND example_test)'
    ],
    source: '#include "starter.h"\n#include <catch2/catch_test_macros.hpp>\n\nTEST_CASE("adds two numbers")\n{\n    REQUIRE(starter_add(2, 3) == 5);\n    REQUIRE(starter_add(-2, 3) == 1);\n}\n'
  }
};

async function writeCmakeOptions(project, template, libraries, framework, targets = ['native']) {
  if (!libraries.length && !framework) return;
  const lines = [];
  function addSection(condition, section) {
    if (template.androidCmake) {
      lines.push(`if(${condition})`, ...section.map(line => line && '    ' + line), 'endif()', '');
    } else {
      lines.push(...section, '');
    }
  }
  if (libraries.length) {
    const examples = [];
    if (libraries.some(library => library.example)) {
      lines.push('option(PROJECT_BUILD_LIBRARY_EXAMPLES "Build the selected library examples" ON)', '');
    }
    const dependencies = ['include(FetchContent)'];
    for (const library of libraries) {
      const example = library.example && await writeLibraryExample(project, template, library);
      if (example) examples.push(example);
      const link = 'target_link_libraries(' + template.cmakeTarget + ' PRIVATE ' + library.target + ')';
      const setup = [...(library.before || []), ...declare(library),
        'FetchContent_MakeAvailable(' + (library.content || library.id) + ')', ...(library.cmake || []),
        ...(template.androidCmake ? cmakeIf('ANDROID', [link]) : [link]), ...(example?.cmake || [])];
      const condition = template.androidCmake ? (example ? 'ANDROID OR PROJECT_BUILD_LIBRARY_EXAMPLES' : 'ANDROID') :
        library.desktopOnly ? 'NOT EMSCRIPTEN' : undefined;
      dependencies.push(...(condition ? cmakeIf(condition, setup) : setup), '');
    }
    lines.push(...dependencies);
    if (examples.length) await documentLibraryExamples(project, examples, targets);
    if (libraries.some(library => library.id === 'tinyfiledialogs')) {
      await fs.appendFile(path.join(project, 'README.md'), '\nCMake uses Git to fetch tinyfiledialogs. In C sources, include `<stddef.h>` before `<tinyfiledialogs.h>` for Windows builds. On Linux, install Zenity or KDialog to use graphical file dialogs.\n');
    }
    if (libraries.some(library => library.id === 'imgui')) {
      await fs.appendFile(path.join(project, 'README.md'), '\nDear ImGui is linked as a C++ library. Add the [Dear ImGui backend sources](https://github.com/ocornut/imgui/blob/master/docs/BACKENDS.md) for your windowing and rendering APIs when integrating a UI.\n');
    }
    if (libraries.some(library => library.id === 'bgfx')) {
      await fs.appendFile(path.join(project, 'README.md'), '\nCMake uses Git to fetch the bgfx sources for desktop builds. On Linux, install the X11, OpenGL, and Wayland development packages used by bgfx. See the [bgfx API](https://bkaradzic.github.io/bgfx/bgfx.html) to initialize the renderer and add a draw loop.\n');
    }
  }
  if (framework) {
    const example = testExamples[framework];
    addSection('NOT ANDROID', ['include(CTest)', 'if(BUILD_TESTING)', ...example.cmake.map(line => '    ' + line), 'endif()']);
    const tests = path.join(project, 'tests');
    await fs.mkdir(tests);
    await fs.writeFile(path.join(tests, example.file), example.source, { flag: 'wx' });
    const builds = template.androidCmake ? ['build/host-tests'] : targets.map(target => target === 'emscripten' ? 'build-web' : 'build');
    const hostSetup = template.androidCmake ?
      `Build the tests with a desktop C or C++ compiler.\n\n~~~sh\ncmake -S . -B ${builds[0]}\ncmake --build ${builds[0]} --config Debug\n~~~\n\n` : '';
    const testCommands = builds.map(build => `ctest --test-dir ${build} -C Debug --output-on-failure`).join('\n');
    await fs.appendFile(path.join(project, 'README.md'),
      '\n## Tests\n\nThe app and test link the same implementation of `starter_add` in `src/`. Run CTest after configuring and building the project.\n\n' +
      hostSetup + `~~~sh\n${testCommands}\n~~~\n\n` +
      'Use CMake’s -DBUILD_TESTING=OFF option for a build without tests.\n');
  }
  const cmake = path.join(project, 'cmake');
  await fs.mkdir(cmake, { recursive: true });
  await fs.writeFile(path.join(cmake, 'ProjectOptions.cmake'), lines.join('\n'), { flag: 'wx' });
  await fs.appendFile(path.join(project, 'CMakeLists.txt'), '\ninclude(cmake/ProjectOptions.cmake)\n');
}

async function configureEmscripten(project, template, name, targets) {
  const file = path.join(project, 'CMakeLists.txt');
  const contents = await fs.readFile(file, 'utf8');
  const desktop = targets.includes('native');
  const guard = '\nif(NOT EMSCRIPTEN)\n' +
    '    message(FATAL_ERROR "Configure this web project with emcmake cmake -S . -B build-web")\n' +
    'endif()\n';
  const updated = desktop ? contents : contents.replace(/^project\([^\n]+\)\n/m, '$&' + guard);
  if (!desktop && updated === contents) throw new Error('Could not configure the Emscripten build for this template.');
  await fs.writeFile(file, updated + '\nif(EMSCRIPTEN)\n' +
    '    set_target_properties(' + template.cmakeTarget + ' PROPERTIES OUTPUT_NAME index SUFFIX ".html")\n' +
    '    target_link_options(' + template.cmakeTarget + ' PRIVATE --emrun)\nendif()\n');
  await fs.appendFile(path.join(project, '.gitignore'), '\nbuild-web/\n');
  const commands = ['emcmake cmake -S . -B build-web', 'cmake --build build-web', 'emrun build-web/index.html'];
  const note = 'Put CMake 3.24 or newer on PATH and activate the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) in your terminal. On Windows, also put Ninja or MinGW Make on PATH. Serve the generated HTML, JavaScript, and WebAssembly files together over HTTP.';
  const readme = path.join(project, 'README.md');
  if (desktop) {
    await fs.appendFile(readme, '\n## Web (Emscripten)\n\n' + note + '\n\n```sh\n' + commands.join('\n') + '\n```\n');
  } else {
    await fs.writeFile(readme, starterReadme(name, template.description, commands, note));
  }
}

module.exports = { cmakeLibraries, cmakeLibraryLine, configureEmscripten, parseCmakeLibraries, writeCmakeOptions };
