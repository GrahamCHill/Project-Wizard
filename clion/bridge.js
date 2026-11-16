const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createProject, existingDirectory, getSdk, installMonoGame, listMonoGame } = require('../src/projects');
const { starters } = require('../src/starters');
const { detectToolchains, templateAvailability, templatesForPlatform } = require('../src/toolchains');
const { projectOptions, readProjectOptions } = require('../src/project-options');
const { selectPython, setupPython } = require('../src/python-options');
const { listZipTemplates } = require('../src/zip-templates');
const { writeProjectFiles } = require('../src/generate-project');
const { loadExecutableIcons } = require('../src/native-app');

function availableTemplates(mono, zip) {
  return templatesForPlatform([...mono, ...starters, ...zip], process.platform);
}

async function catalog(request, log) {
  const parent = await existingDirectory(request.parent).catch(() => os.homedir());
  const archiveScan = request.zipDirectory ? listZipTemplates(request.zipDirectory) : { templates: [] };
  const [detection, sdk, zip] = await Promise.all([
    detectToolchains(), getSdk(parent, log).catch(error => ({ error: error.message })), archiveScan
  ]);
  const mono = sdk.version ? await listMonoGame(sdk, parent, log).catch(error => { log(error.message); return []; }) : [];
  const { results, manager, pythonVersions } = detection;
  const tools = { ...results, dotnet: sdk.version ? { version: sdk.version, file: sdk.executable } : undefined };
  const templates = availableTemplates(mono, zip.templates).map(template => {
    const availability = templateAvailability(template, tools, process.platform, manager);
    const options = projectOptions(template, tools, pythonVersions, process.platform, manager);
    const builds = options?.buildChoice || options?.targetChoice;
    const ready = options?.ready ?? (builds ? builds.options.some(option => option.ready) : availability.ready);
    const disabled = (template.needsSdk && !sdk.version) || (template.kind === 'react-native' && !ready) ||
      (template.generatorNode && (!tools[template.generatorNode] || tools[template.generatorNode].usable === false || !tools.npm)) ||
      template.generatorTools?.some(id => !tools[id] || tools[id].usable === false);
    const { id, label, description, group, language, requirement, variants } = template;
    return { id, label, description, group, language, requirement, variants, options, ready, disabled: Boolean(disabled) };
  });
  return { templates, context: { tools, pythonVersions, mono }, zipError: zip.error, canInstallMonoGame: Boolean(sdk.version) };
}

async function create(request, log) {
  const { tools, pythonVersions, mono } = request.context;
  const zip = request.zipDirectory ? await listZipTemplates(request.zipDirectory) : { templates: [] };
  const template = availableTemplates(mono, zip.templates).find(item => item.id === request.templateId);
  if (!template) throw new Error('Select an available project template.');
  const name = path.basename(request.destination);
  const parent = path.dirname(request.destination);
  const icons = request.iconPaths?.length ? await loadExecutableIcons(request.iconPaths) : undefined;
  const options = readProjectOptions(template, request.options, icons);
  const python = options?.type === 'python' && selectPython(options, tools, pythonVersions, template);
  if (options?.type === 'python' && !python) throw new Error('Install the selected Python version and environment manager.');
  const existingGit = await fs.lstat(path.join(request.destination, '.git')).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  const destination = await createProject(parent, name, (project, location) =>
    writeProjectFiles(project, location, { template, name, tools, options, initializeGit: existingGit ? false : request.initializeGit }, log),
  log, { allowedEntries: ['.idea', '.git'] });
  if (python) {
    try {
      await setupPython(destination, options, python, log);
    } catch (error) {
      log(error.message);
      throw new Error(`Python environment setup failed at ${destination}. Follow the generated README to finish setup.`);
    }
  }
  return { destination };
}

async function main() {
  const messages = [];
  const log = message => {
    messages.push(String(message).slice(-8000));
    if (messages.length > 20) messages.shift();
  };
  let data = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) data += chunk;
  let result;
  try {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 20 || (major === 20 && minor < 9)) throw new Error('Project Wizard requires Node.js 20.9 or newer.');
    const request = JSON.parse(data);
    if (request.action === 'catalog') result = await catalog(request, log);
    else if (request.action === 'create') result = await create(request, log);
    else if (request.action === 'installMonoGame') {
      const parent = await existingDirectory(request.parent).catch(() => os.homedir());
      await installMonoGame(parent, log);
      result = await catalog(request, log);
    } else throw new Error('Unknown project action.');
  } catch (error) {
    result = { error: error.message };
  }
  process.stdout.write(JSON.stringify({ ...result, log: messages }));
}

main().catch(error => {
  process.stderr.write(error.message);
  process.exitCode = 1;
});
