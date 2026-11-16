const fs = require('node:fs/promises');
const { createWriteStream } = require('node:fs');
const { execFile } = require('node:child_process');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { promisify } = require('node:util');
const { ZipFile } = require('yazl');
const { version } = require('../package.json');
const lock = require('../package-lock.json');
const { generatorSources } = require('./generators');

const exec = promisify(execFile);
const root = path.resolve(__dirname, '..');
const build = path.join(__dirname, 'build');
const plugin = 'project-wizard-clion';

async function files(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const discovered = await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isFile()) return [file];
    if (entry.isDirectory() && entry.name !== 'node_modules') return files(file);
    return [];
  }));
  return discovered.flat();
}

function javaTool(name) {
  const executable = name + (process.platform === 'win32' ? '.exe' : '');
  return process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', executable) : executable;
}

function javacArgument(value) {
  return '"' + value.replaceAll('\\', '/').replaceAll('"', '\\"') + '"';
}

async function compile(ide, staging) {
  const clionApi = path.join(ide, 'plugins', 'clion', 'lib', 'modules', 'intellij.cidr.execution.jar');
  await fs.access(clionApi);
  const jars = [clionApi, ...(await files(path.join(ide, 'lib'))).filter(file => file.endsWith('.jar'))];
  const sources = (await files(path.join(__dirname, 'src', 'main', 'java'))).filter(file => file.endsWith('.java'));
  const registry = generatorSources();
  const generatedSource = path.join(staging, 'TemplateGenerators.java');
  await fs.writeFile(generatedSource, registry.source);
  sources.push(generatedSource);
  const classes = path.join(staging, 'classes');
  const argsFile = path.join(staging, 'javac.args');
  await fs.mkdir(path.join(classes, 'META-INF'), { recursive: true });
  await fs.writeFile(argsFile, [
    '--release', '21', '-encoding', 'UTF-8', '-classpath', javacArgument(jars.join(path.delimiter)),
    '-d', javacArgument(classes), ...sources.map(javacArgument)
  ].join('\n'));
  await exec(javaTool('javac'), ['@' + argsFile]);
  const resources = path.join(__dirname, 'src', 'main', 'resources');
  await fs.cp(resources, classes, { recursive: true });
  const descriptor = await fs.readFile(path.join(resources, 'META-INF', 'plugin.xml'), 'utf8');
  await fs.writeFile(path.join(classes, 'META-INF', 'plugin.xml'), descriptor
    .replace('__PROJECT_WIZARD_VERSION__', version)
    .replace('    <!-- GENERATED_PROJECT_GENERATORS -->', registry.extensions));
  const jar = path.join(staging, plugin + '.jar');
  const { stdout } = await exec(javaTool('jar'), ['--create', '-C', classes, '.'], { encoding: 'buffer' });
  await fs.writeFile(jar, stdout);
  return jar;
}

async function packagePlugin(jar, destination) {
  const zip = new ZipFile();
  const add = (file, relative) => zip.addFile(file, plugin + '/' + relative.split(path.sep).join('/'));
  const directories = ['src', 'templates'];
  for (const [directory, meta] of Object.entries(lock.packages)) {
    if (!directory || meta.dev) continue;
    const present = await fs.stat(path.join(root, directory)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (present?.isDirectory()) directories.push(directory);
    else if (!meta.optional) throw new Error(`Dependency ${directory} is missing. Run npm ci.`);
  }
  add(jar, 'lib/' + plugin + '.jar');
  for (const relative of ['clion/bridge.js', 'LICENSE']) add(path.join(root, relative), relative);
  for (const directory of directories) {
    for (const file of await files(path.join(root, directory))) add(file, path.relative(root, file));
  }
  const output = pipeline(zip.outputStream, createWriteStream(destination));
  zip.end();
  await output;
}

async function main() {
  const args = process.argv.slice(2);
  const idePath = args.length === 2 && args[0] === '--ide' ? args[1] : args.length === 0 ? process.env.CLION_HOME : undefined;
  if (!idePath) throw new Error('Run npm run package:clion -- --ide "<CLion installation directory>" or set CLION_HOME.');
  const selected = path.resolve(idePath);
  const ide = process.platform === 'darwin' && selected.endsWith('.app') ? path.join(selected, 'Contents') : selected;
  const info = JSON.parse(await fs.readFile(path.join(ide, 'product-info.json'), 'utf8'));
  if (info.productCode !== 'CL' || Number(info.buildNumber.split('.')[0]) < 262) {
    throw new Error('Use a CLion 2026.2 or newer installation to build this plugin.');
  }
  await fs.mkdir(build, { recursive: true });
  const staging = await fs.mkdtemp(path.join(build, '.package-'));
  try {
    const jar = await compile(ide, staging);
    const name = `${plugin}-${version}.zip`;
    await packagePlugin(jar, path.join(staging, name));
    const destination = path.join(build, name);
    await fs.copyFile(path.join(staging, name), destination);
    console.log(`Packaged ${destination}`);
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stderr || error.message);
  process.exitCode = 1;
});
