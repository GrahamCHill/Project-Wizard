const fs = require('node:fs/promises');
const path = require('node:path');
const { getSdk, replaceTokens } = require('./projects');
const { standardTemplates } = require('./standard-templates');
const { generators } = require('./npm-generators');
const { externalGenerators } = require('./external-generators');
const { sdlMixedStarters, pluginStarters } = require('./mixed-starters');

async function readStarterText(file) {
  return (await fs.readFile(file, 'utf8')).replaceAll('\r\n', '\n');
}

const raylibC = {
  id: 'raylib-c', group: 'raylib', kind: 'starter', label: 'Raylib for C', language: 'C',
  description: 'A Raylib window and game loop for desktop or web.', tools: ['cmake', 'c-compiler'], cmakeTarget: 'game', webTarget: true,
  requirement: 'CMake 3.24+ and a C compiler. CMake can fetch Raylib during configuration.',
  next: 'Follow the build commands in README.md.',
  files: ['CMakeLists.txt', 'src/main.c', 'gitignore', 'README.md']
};

const starters = [
  {
    id: 'raylib-csharp', group: 'raylib', kind: 'starter', label: 'Raylib for C#', language: 'C#',
    description: 'A desktop window and game loop using Raylib-cs.', needsSdk: true, tools: ['dotnet'],
    requirement: '.NET SDK 8 or newer. The first build restores Raylib-cs from NuGet.',
    next: 'Run dotnet run from the project folder.',
    files: ['__PROJECT_NAME__.csproj', 'Program.cs', 'gitignore', 'README.md']
  },
  {
    id: 'cpp-csharp-raylib', group: 'raylib', kind: 'starter', label: 'Raylib (C++ + C#)', language: 'C#',
    description: 'A C# Raylib window that calls a CMake-built C++ library to move a circle.',
    needsSdk: true, tools: ['dotnet', 'cmake', 'cpp-compiler'], nativeTarget: 'pw_native',
    requirement: '.NET SDK 8+, CMake 3.24+, and a native C++ compiler for Windows, macOS, or Linux.',
    next: 'Run dotnet run from the project folder.',
    files: ['__PROJECT_NAME__.csproj', 'Program.cs', 'NativeMotion.cs', 'native/CMakeLists.txt', 'native/src/motion.cpp',
      'native/README.md', 'gitignore', 'README.md']
  },
  raylibC,
  {
    ...raylibC, id: 'raylib-cpp', label: 'Raylib for C++', language: 'C++', sourceDirectory: raylibC.id,
    tools: ['cmake', 'cpp-compiler'], requirement: 'CMake 3.24+ and a C++ compiler. CMake can fetch Raylib during configuration.'
  },
  {
    id: 'dotnet-console', group: 'cli', kind: 'dotnet', label: '.NET Console App',
    language: 'C#', shortName: 'console', needsSdk: true, tools: ['dotnet'],
    description: 'A C# command-line application using the active .NET SDK.',
    requirement: '.NET SDK 8 or newer.', next: 'Run dotnet run from the project folder.'
  },
  {
    id: 'dotnet-web', group: 'server', kind: 'dotnet', label: 'ASP.NET Core Server',
    language: 'C#', shortName: 'web', needsSdk: true, tools: ['dotnet'],
    description: 'A minimal ASP.NET Core application with a sample route.',
    requirement: '.NET SDK 8 or newer.', next: 'Run dotnet run from the project folder.'
  },
  {
    id: 'dotnet-winforms', group: 'desktop', kind: 'dotnet', label: '.NET Windows Forms Desktop',
    language: 'C#', shortName: 'winforms', needsSdk: true, tools: ['dotnet'], platforms: ['win32'],
    description: 'A native Windows desktop application using Windows Forms.',
    requirement: 'Windows with .NET SDK 8 or newer.', next: 'Run dotnet run from the project folder.'
  },
  ...sdlMixedStarters,
  ...pluginStarters,
  ...standardTemplates,
  ...generators,
  ...externalGenerators,
  {
    id: 'empty', group: 'general', kind: 'empty', label: 'Empty Project',
    description: 'An empty folder for a new project.', requirement: 'No SDK or build tools required.'
  }
];

async function writeStarter(template, name, project, parent, log, tools = {}) {
  const sdk = template.needsSdk ? await getSdk(parent, log) : undefined;
  const templateRoot = path.join(__dirname, '..', 'templates', template.sourceDirectory || template.id);
  const cpp = template.language === 'C++';
  const moduleName = 'Game' + name.replace(/[^A-Za-z0-9]/g, '').slice(0, 48);
  const renderTokens = text => replaceTokens(text, name, sdk?.major)
    .replaceAll('__UNITY_VERSION__', tools['unity-editor']?.editorVersion || '6000.3.0f1')
    .replaceAll('__UNREAL_ASSOCIATION__', tools['unreal-editor']?.association || '')
    .replaceAll('__UNREAL_MODULE__', moduleName)
    .replaceAll('__UNREAL_API__', moduleName.toUpperCase() + '_API')
    .replaceAll('__SDL_BACKEND__', template.sdlBackend || '')
    .replaceAll('__SDL_BACKEND_LABEL__', template.sdlBackendLabel || '')
    .replaceAll('__SDL_BACKEND_NOTE__', template.sdlBackendNote || '');
  for (const file of template.files) {
    const contents = await readStarterText(path.join(templateRoot, file));
    const output = file === 'gitignore' ? '.gitignore' : cpp && template.sourceDirectory && file === 'src/main.c' ? 'src/main.cpp' : file;
    const target = path.join(project, renderTokens(output));
    await fs.mkdir(path.dirname(target), { recursive: true });
    const rendered = file === 'CMakeLists.txt' ? contents.replaceAll('__CMAKE_LANGUAGE__', cpp ? 'CXX' : 'C')
      .replaceAll('__NATIVE_EXTENSION__', cpp ? 'cpp' : 'c').replaceAll('__NATIVE_STANDARD__', cpp ? 'cxx_std_17' : 'c_std_99') : contents;
    let source = rendered.replaceAll('__NATIVE_LABEL__', cpp ? 'C++' : 'C');
    if (template.sdlVersion) {
      source = source.replaceAll('__SDL_VERSION__', template.sdlVersion).replaceAll('__SDL_MAJOR__', template.sdlVersion[0]);
    }
    await fs.writeFile(target, renderTokens(source), { flag: 'wx' });
  }
  for (const [file, output] of Object.entries(template.sharedFiles || {})) {
    const source = await readStarterText(path.join(__dirname, '..', 'templates', '_shared', file));
    const destination = path.join(project, output);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, renderTokens(source), { flag: 'wx' });
  }
  if (template.cmakeTarget) {
    const shared = path.join(__dirname, '..', 'templates', '_shared', 'native');
    const implementation = template.language === 'C' ? 'src/starter.c' : 'src/starter.cpp';
    await fs.mkdir(path.join(project, 'include'), { recursive: true });
    await fs.writeFile(path.join(project, 'include', 'starter.h'),
      await readStarterText(path.join(shared, 'starter.h')), { flag: 'wx' });
    await fs.writeFile(path.join(project, implementation),
      await readStarterText(path.join(shared, 'starter.c')), { flag: 'wx' });
    const link = `target_link_libraries(${template.cmakeTarget} PRIVATE starter_logic)`;
    await fs.appendFile(path.join(project, 'CMakeLists.txt'), `
add_library(starter_logic STATIC ${implementation})
${template.cmakeLibrary ? 'set_target_properties(starter_logic PROPERTIES POSITION_INDEPENDENT_CODE ON)\n' : ''}target_include_directories(starter_logic PUBLIC "\${CMAKE_CURRENT_SOURCE_DIR}/include")
${template.androidCmake ? `if(ANDROID)\n    ${link}\nendif()` : link}
`);
  }
  if (template.commands) {
    await fs.writeFile(path.join(project, 'README.md'),
      starterReadme(name, template.description, template.commands, template.note), { flag: 'wx' });
  }
}

function starterReadme(name, description, commands, note) {
  const lines = [`# ${name}`, '', description, ''];
  if (commands.length) lines.push('```sh', ...commands, '```', '');
  if (note) lines.push(note, '');
  return lines.join('\n');
}

module.exports = { starters, starterReadme, writeStarter };
