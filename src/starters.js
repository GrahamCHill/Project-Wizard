const fs = require('node:fs/promises');
const path = require('node:path');
const { getSdk, replaceTokens } = require('./projects');
const { standardTemplates } = require('./standard-templates');

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
  ...standardTemplates,
  {
    id: 'empty', group: 'general', kind: 'empty', label: 'Empty Project',
    description: 'An empty folder for a new project.', requirement: 'No SDK or build tools required.'
  }
];

async function writeStarter(template, name, project, parent, log) {
  const sdk = template.needsSdk ? await getSdk(parent, log) : undefined;
  const templateRoot = path.join(__dirname, '..', 'templates', template.sourceDirectory || template.id);
  const cpp = template.language === 'C++';
  for (const file of template.files) {
    const contents = await readStarterText(path.join(templateRoot, file));
    const output = file === 'gitignore' ? '.gitignore' : cpp && template.sourceDirectory && file === 'src/main.c' ? 'src/main.cpp' : file;
    const target = path.join(project, replaceTokens(output, name));
    await fs.mkdir(path.dirname(target), { recursive: true });
    const rendered = file === 'CMakeLists.txt' ? contents.replaceAll('__CMAKE_LANGUAGE__', cpp ? 'CXX' : 'C')
      .replaceAll('__NATIVE_EXTENSION__', cpp ? 'cpp' : 'c').replaceAll('__NATIVE_STANDARD__', cpp ? 'cxx_std_17' : 'c_std_99') : contents;
    let source = rendered.replaceAll('__NATIVE_LABEL__', cpp ? 'C++' : 'C');
    if (template.sdlVersion) {
      source = source.replaceAll('__SDL_VERSION__', template.sdlVersion).replaceAll('__SDL_MAJOR__', template.sdlVersion[0]);
    }
    await fs.writeFile(target, replaceTokens(source, name, sdk?.major), { flag: 'wx' });
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
target_include_directories(starter_logic PUBLIC "\${CMAKE_CURRENT_SOURCE_DIR}/include")
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
