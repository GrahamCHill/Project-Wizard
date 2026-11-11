const fs = require('node:fs/promises');
const path = require('node:path');
const { getSdk, replaceTokens } = require('./projects');
const { standardTemplates } = require('./standard-templates');

const starters = [
  {
    id: 'raylib-csharp', group: 'raylib', kind: 'starter', label: 'Raylib for C#', language: 'C#',
    description: 'A desktop window and game loop using Raylib-cs.', needsSdk: true, tools: ['dotnet'],
    requirement: '.NET SDK 8 or newer. The first build restores Raylib-cs from NuGet.',
    next: 'Run dotnet run from the project folder.',
    files: ['__PROJECT_NAME__.csproj', 'Program.cs', 'gitignore', 'README.md']
  },
  {
    id: 'raylib-c', group: 'raylib', kind: 'starter', label: 'Raylib for C', language: 'C',
    description: 'A desktop window and game loop with a CMake build.', tools: ['cmake', 'c-compiler'], cmakeTarget: 'game',
    requirement: 'CMake 3.24+ and a C compiler. CMake can fetch Raylib during configuration.',
    next: 'Follow the build commands in README.md.',
    files: ['CMakeLists.txt', 'src/main.c', 'gitignore', 'README.md']
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
  const templateRoot = path.join(__dirname, '..', 'templates', template.id);
  for (const file of template.files) {
    const contents = await fs.readFile(path.join(templateRoot, file), 'utf8');
    const target = path.join(project, replaceTokens(file === 'gitignore' ? '.gitignore' : file, name));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, replaceTokens(contents, name, sdk?.major), { flag: 'wx' });
  }
  if (template.commands) {
    const commands = template.commands.length ? ['```sh', ...template.commands, '```', ''] : [];
    const lines = [`# ${name}`, '', template.description, '', ...commands];
    if (template.note) lines.push(template.note, '');
    await fs.writeFile(path.join(project, 'README.md'), lines.join('\n'), { flag: 'wx' });
  }
}

module.exports = { starters, writeStarter };
