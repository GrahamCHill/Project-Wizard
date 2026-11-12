const fs = require('node:fs/promises');
const path = require('node:path');
const { starterReadme } = require('./starters');

const libraries = [
  { id: 'yyjson', label: 'yyjson (C JSON)', languages: ['C'], target: 'yyjson',
    url: 'https://github.com/ibireme/yyjson/archive/refs/tags/0.13.0.tar.gz' },
  { id: 'fmt', label: 'fmt (C++ formatting)', languages: ['C++', 'CUDA'], target: 'fmt::fmt',
    url: 'https://github.com/fmtlib/fmt/archive/refs/tags/12.1.0.tar.gz' },
  { id: 'nlohmann_json', label: 'nlohmann/json (C++ JSON)', languages: ['C++', 'CUDA'], target: 'nlohmann_json::nlohmann_json',
    url: 'https://github.com/nlohmann/json/releases/download/v3.12.0/json.tar.xz',
    hash: '42f6e95cad6ec532fd372391373363b62a14af6d771056dbfc86160e6dfff7aa' }
];

function cmakeLibraries(template) {
  return libraries.filter(library => library.languages.includes(template.language));
}

function parseCmakeLibraries(template, chosen, lines) {
  const selected = cmakeLibraries(template).filter(library => chosen.includes(library.id));
  const bundled = template.id === 'cpp-lua-desktop' ? ['lua', 'lua_runtime', 'copy_script'] :
    template.id === 'godot-native-cpp' ? ['godot_cpp', 'godot-cpp'] : [];
  const names = new Set(['app', 'game', 'raylib', 'sdl2', 'sdl3', 'wxwidgets', 'googletest', 'catch2', 'example_test', 'starter_logic',
    template.cmakeTarget, ...bundled, ...selected.map(library => library.id)]);
  for (const line of lines) {
    const [id, target, url, hash, extra] = line.split(/\s+/);
    if (!/^[a-z][a-z0-9_-]*$/.test(id) ||
        !/^[a-zA-Z_][a-zA-Z0-9_+.-]*(?:::[a-zA-Z_][a-zA-Z0-9_+.-]*)?$/.test(target || '') ||
        !/^https:\/\/[a-zA-Z0-9][a-zA-Z0-9:/?&=_%+~@.-]+$/.test(url || '') ||
        (hash && !/^[a-f0-9]{64}$/i.test(hash)) || extra) {
      throw new Error('Enter each CMake dependency as name target https://archive-url [sha256].');
    }
    const parsed = new URL(url);
    if (parsed.username || parsed.password) throw new Error('Use a CMake archive URL without embedded credentials.');
    if (names.has(id)) throw new Error('Duplicate or reserved CMake dependency name: ' + id);
    names.add(id);
    selected.push({ id, target, url, hash });
  }
  return selected;
}

function declare(library) {
  return [
    'FetchContent_Declare(' + library.id,
    '    URL "' + library.url + '"',
    ...(library.hash ? ['    URL_HASH SHA256=' + library.hash] : []),
    '    DOWNLOAD_EXTRACT_TIMESTAMP TRUE',
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
    const dependencies = ['include(FetchContent)'];
    for (const library of libraries) {
      dependencies.push(...declare(library), 'FetchContent_MakeAvailable(' + library.id + ')',
        'target_link_libraries(' + template.cmakeTarget + ' PRIVATE ' + library.target + ')', '');
    }
    dependencies.pop();
    addSection('ANDROID', dependencies);
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
  await fs.mkdir(cmake);
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

module.exports = { cmakeLibraries, configureEmscripten, parseCmakeLibraries, writeCmakeOptions };
