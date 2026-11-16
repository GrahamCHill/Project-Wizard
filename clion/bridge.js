const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createProject, existingDirectory, getSdk, installMonoGame, listMonoGame } = require('../src/projects');
const { starters } = require('../src/starters');
const { detectGenerationTools, detectProjectGit, templatesForPlatform, usesPythonEnvironment } = require('../src/toolchains');
const { projectOptions, readProjectOptions } = require('../src/project-options');
const { selectPython, setupPython } = require('../src/python-options');
const { listZipTemplates } = require('../src/zip-templates');
const { writeProjectFiles } = require('../src/generate-project');
const { loadExecutableIcons } = require('../src/native-app');

function builtInTemplate(id) {
  return templatesForPlatform(starters, process.platform).find(template => template.id === id);
}

function describeTemplate(template, tools, versions) {
  const { id, label, description, group, language, requirement, variants } = template;
  return { id, label, description, group, language, requirement, variants, options: projectOptions(template, tools, versions) };
}

async function customCatalog(request, log) {
  const parent = await existingDirectory(request.parent).catch(() => os.homedir());
  const [sdk, zip] = await Promise.all([
    getSdk(parent, log).catch(() => undefined),
    request.zipDirectory ? listZipTemplates(request.zipDirectory) : { templates: [] }
  ]);
  const mono = sdk ? await listMonoGame(sdk, parent, log).catch(error => { log(error.message); return []; }) : [];
  const templates = [...mono, ...zip.templates].map(template => describeTemplate(template));
  return { templates, zipError: zip.error, canInstallMonoGame: Boolean(sdk), canRefresh: true };
}

async function catalog(request, log) {
  if (!request.templateId) return customCatalog(request, log);
  const template = builtInTemplate(request.templateId);
  if (!template) throw new Error('Select an available project template.');
  const canRefresh = usesPythonEnvironment(template) || template.kind === 'wails';
  const detection = canRefresh ? await detectGenerationTools(template) : {};
  return { templates: [describeTemplate(template, detection.results, detection.pythonVersions)], canRefresh };
}

async function getSelectedTemplate(request, parent, log) {
  const { templateId, zipDirectory } = request;
  if (zipDirectory && templateId?.startsWith('zip:')) {
    const zip = await listZipTemplates(zipDirectory);
    return zip.templates.find(template => template.id === templateId);
  }
  if (templateId?.startsWith('monogame:')) {
    const sdk = await getSdk(parent, log);
    const templates = await listMonoGame(sdk, parent, log);
    return templates.find(template => template.id === templateId);
  }
  return builtInTemplate(templateId);
}

async function create(request, log) {
  const name = path.basename(request.destination);
  const parent = path.dirname(request.destination);
  const template = await getSelectedTemplate(request, parent, log);
  if (!template) throw new Error('Select an available project template.');
  const icons = request.iconPaths?.length ? await loadExecutableIcons(request.iconPaths) : undefined;
  const options = readProjectOptions(template, request.options, icons);
  const existingGit = await fs.lstat(path.join(request.destination, '.git')).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  const initializeGit = existingGit ? false : request.initializeGit;
  const { results: tools, pythonVersions } = await detectGenerationTools(template);
  if (initializeGit !== false && !Object.hasOwn(tools, 'git')) tools.git = await detectProjectGit();
  const python = options?.type === 'python' && selectPython(options, tools, pythonVersions, template);
  if (options?.type === 'python' && !python) throw new Error('Install the selected Python version and environment manager.');
  const destination = await createProject(parent, name, (project, location) =>
    writeProjectFiles(project, location, { template, name, tools, options, initializeGit }, log),
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
      result = await customCatalog(request, log);
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
