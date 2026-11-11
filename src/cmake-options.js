const fs = require('node:fs/promises');
const path = require('node:path');

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
  const names = new Set(['app', 'game', 'raylib', 'googletest', 'example_test', ...selected.map(library => library.id)]);
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

async function writeCmakeOptions(project, template, libraries, testing) {
  if (!libraries.length && !testing) return;
  const lines = [];
  if (libraries.length) {
    lines.push('include(FetchContent)');
    for (const library of libraries) {
      lines.push(...declare(library), 'FetchContent_MakeAvailable(' + library.id + ')',
        'target_link_libraries(' + template.cmakeTarget + ' PRIVATE ' + library.target + ')', '');
    }
  }
  if (testing) {
    const isC = template.language === 'C';
    lines.push('include(CTest)', 'if(BUILD_TESTING)');
    const testLines = isC ? [
      'add_executable(example_test tests/example_test.c)',
      'target_compile_features(example_test PRIVATE c_std_11)',
      'add_test(NAME example_test COMMAND example_test)'
    ] : [
      'include(FetchContent)',
      'set(gtest_force_shared_crt ON CACHE BOOL "Match the parent project runtime" FORCE)',
      ...declare({ id: 'googletest', url: 'https://github.com/google/googletest/archive/refs/tags/v1.18.0.tar.gz' }),
      'FetchContent_MakeAvailable(googletest)',
      'add_executable(example_test tests/example_test.cpp)',
      'target_compile_features(example_test PRIVATE cxx_std_17)',
      'target_link_libraries(example_test PRIVATE GTest::gtest_main)',
      'include(GoogleTest)',
      'gtest_discover_tests(example_test DISCOVERY_MODE PRE_TEST)'
    ];
    lines.push(...testLines.map(line => '    ' + line), 'endif()', '');
    const tests = path.join(project, 'tests');
    await fs.mkdir(tests);
    const source = isC ?
      'static int add(int left, int right)\n{\n    return left + right;\n}\n\nint main(void)\n{\n    return add(2, 3) == 5 ? 0 : 1;\n}\n' :
      '#include <gtest/gtest.h>\n\nnamespace {\nint add(int left, int right)\n{\n    return left + right;\n}\n}\n\nTEST(Example, AddsTwoNumbers)\n{\n    EXPECT_EQ(add(2, 3), 5);\n}\n';
    await fs.writeFile(path.join(tests, isC ? 'example_test.c' : 'example_test.cpp'), source, { flag: 'wx' });
    await fs.appendFile(path.join(project, 'README.md'),
      '\n## Tests\n\nConfigure and build with the commands above, then run:\n\n' +
      '~~~sh\nctest --test-dir build -C Debug --output-on-failure\n~~~\n\n' +
      'Use CMake’s -DBUILD_TESTING=OFF option for a build without tests.\n');
  }
  const cmake = path.join(project, 'cmake');
  await fs.mkdir(cmake);
  await fs.writeFile(path.join(cmake, 'ProjectOptions.cmake'), lines.join('\n'), { flag: 'wx' });
  await fs.appendFile(path.join(project, 'CMakeLists.txt'), '\ninclude(cmake/ProjectOptions.cmake)\n');
}

module.exports = { cmakeLibraries, parseCmakeLibraries, writeCmakeOptions };
