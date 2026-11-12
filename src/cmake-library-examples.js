const fs = require('node:fs/promises');
const path = require('node:path');

const sources = path.join(__dirname, '..', 'templates', '_shared', 'cmake-examples');

function cmakeIf(condition, lines) {
  return [`if(${condition})`, ...lines.map(line => line && '    ' + line), 'endif()'];
}

async function writeLibraryExample(project, template, library) {
  const c = template.language === 'C';
  const target = 'example_' + library.id;
  const file = library.id + (c ? '.c' : '.cpp');
  const directory = path.join(project, 'examples');
  await fs.mkdir(directory, { recursive: true });
  await fs.copyFile(path.join(sources, library.example), path.join(directory, file));

  const condition = template.androidCmake ? 'PROJECT_BUILD_LIBRARY_EXAMPLES AND NOT ANDROID' : 'PROJECT_BUILD_LIBRARY_EXAMPLES';
  const cmake = cmakeIf(condition, [
    `add_executable(${target} examples/${file})`,
    `target_compile_features(${target} PRIVATE ${c ? 'c_std_11' : 'cxx_std_17'})`,
    `target_link_libraries(${target} PRIVATE ${library.target})`,
    `set_target_properties(${target} PROPERTIES RUNTIME_OUTPUT_DIRECTORY "\${CMAKE_CURRENT_BINARY_DIR}/examples/$<CONFIG>")`,
    ...(!library.desktopOnly && template.webTarget ? cmakeIf('EMSCRIPTEN', [
      `set_target_properties(${target} PROPERTIES SUFFIX ".html")`,
      `target_link_options(${target} PRIVATE --emrun)`
    ]) : [])
  ]);
  return { target, file, library, cmake };
}

async function documentLibraryExamples(project, examples, targets) {
  const sections = ['\n## Library examples\n',
    'Each selected preset adds a standalone program in `examples/`. The application and example link the same CMake library.\n'];
  for (const { target, file, library } of examples) {
    sections.push(`- \`${target}\` builds \`examples/${file}\`${library.desktopOnly ? ' for the desktop target' : ''}.`);
  }
  if (targets.includes('native')) {
    sections.push('', 'Build an example with your desktop compiler. Executables are under `build/examples/Debug/`.', '',
      '~~~sh', 'cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug',
      `cmake --build build --config Debug --target ${examples[0].target}`, '~~~', '',
      `Run \`build/examples/Debug/${examples[0].target}\` after the build. Windows executables have an \`.exe\` extension.`);
  }
  const web = examples.find(({ library }) => !library.desktopOnly);
  if (targets.includes('emscripten') && web) {
    sections.push('', 'Build and open a web example with Emscripten.', '', '~~~sh',
      'emcmake cmake -S . -B build-web -DCMAKE_BUILD_TYPE=Debug',
      `cmake --build build-web --config Debug --target ${web.target}`,
      `emrun build-web/examples/Debug/${web.target}.html`, '~~~');
  }
  if (examples.some(({ library }) => library.id === 'tinyfiledialogs')) {
    sections.push('', 'Pass `--dialog` to `example_tinyfiledialogs` to open a message box.');
  }
  sections.push('', 'Configure with `-DPROJECT_BUILD_LIBRARY_EXAMPLES=OFF` to skip the examples.', '');
  await fs.appendFile(path.join(project, 'README.md'), sections.join('\n'));
}

module.exports = { cmakeIf, documentLibraryExamples, writeLibraryExample };
