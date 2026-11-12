const fs = require('node:fs/promises');
const path = require('node:path');

const packages = [
  ['LiteNetLib', '2.1.5', 'reliable UDP networking'],
  ['SuperSimpleTcp', '3.2.3', 'TCP client and server'],
  ['RestSharp', '114.1.0', 'HTTP API client'],
  ['Newtonsoft.Json', '13.0.4', 'JSON serialization'],
  ['Serilog', '4.4.0', 'structured logging'],
  ['Spectre.Console', '0.57.2', 'terminal UI'],
  ['CommunityToolkit.Mvvm', '8.4.2', 'desktop app models and commands'],
  ['ImGui.NET', '1.91.6.1', 'Dear ImGui bindings'],
  ['OpenTK', '4.9.4', 'OpenGL and windowing'],
  ['Silk.NET.Vulkan', '2.23.0', 'Vulkan bindings']
];

const packageChoices = packages.map(([name, version, description]) => ({
  id: name.toLowerCase(), label: `${name} (${description})`, line: `${name} ${version}`
}));

function parseNuGetPackages(lines) {
  const selected = new Map();
  for (const line of lines) {
    const [name, version, extra] = line.split(/\s+/);
    if (!/^[a-z0-9_][a-z0-9_.-]{0,99}$/i.test(name) || extra ||
        !/^\d+(?:\.\d+){0,3}(?:-[a-z0-9-]+(?:\.[a-z0-9-]+)*)?(?:\+[a-z0-9-]+(?:\.[a-z0-9-]+)*)?$/i.test(version || '')) {
      throw new Error('Enter each NuGet dependency as a package ID and version, for example LiteNetLib 2.1.5.');
    }
    const id = name.toLowerCase();
    if (selected.has(id)) throw new Error('Duplicate NuGet package: ' + name);
    selected.set(id, { name, version });
  }
  return selected;
}

async function writeNuGetPackages(project, selected) {
  if (!selected.size) return;
  const projects = (await fs.readdir(project)).filter(file => /\.csproj$/i.test(file));
  if (projects.length !== 1) throw new Error('NuGet setup needs one C# project in the generated folder.');
  const file = path.join(project, projects[0]);
  const source = await fs.readFile(file, 'utf8');
  const existing = new Map();
  for (const [, attributes, body] of source.replace(/<!--[\s\S]*?-->/g, '').matchAll(
    /<PackageReference\b([^>]*?)(?:\s*\/>|>([\s\S]*?)<\/PackageReference>)/gi)) {
    const name = attributes.match(/\bInclude\s*=\s*["']([^"']+)["']/i)?.[1];
    const version = attributes.match(/\bVersion\s*=\s*["']([^"']+)["']/i)?.[1] ||
      body?.match(/<Version>\s*([^<]+?)\s*<\/Version>/i)?.[1];
    if (name) existing.set(name.toLowerCase(), version);
  }
  const references = [];
  for (const [id, { name, version }] of selected) {
    if (existing.has(id)) {
      if (existing.get(id)?.toLowerCase() !== version.toLowerCase()) {
        throw new Error('The template already includes ' + name + '. Use its package reference to change the version.');
      }
      continue;
    }
    references.push(`    <PackageReference Include="${name}" Version="${version}" />`);
  }
  if (!references.length) return;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const updated = source.replace(/<\/Project>\s*$/, [
    '  <ItemGroup>', ...references, '  </ItemGroup>', '</Project>', ''
  ].join(newline));
  if (updated === source) throw new Error('Could not add package references to the generated C# project.');
  await fs.writeFile(file, updated);
  await fs.appendFile(path.join(project, 'README.md'),
    '\n## NuGet packages\n\nThe selected packages are listed in the project file. `dotnet build` and `dotnet run` restore them automatically.\n');
}

module.exports = { packageChoices, parseNuGetPackages, writeNuGetPackages };
