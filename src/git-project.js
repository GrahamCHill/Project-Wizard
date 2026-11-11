const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { existingDirectory } = require('./projects');

const exec = promisify(execFile);
const repositoryVariables = new Set([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CEILING_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_CONFIG',
  'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS', 'GIT_DIR', 'GIT_DISCOVERY_ACROSS_FILESYSTEM',
  'GIT_IMPLICIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_NAMESPACE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX',
  'GIT_QUARANTINE_PATH', 'GIT_SHALLOW_FILE', 'GIT_WORK_TREE'
]);

function runGit(executable, args, cwd) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !repositoryVariables.has(key.toUpperCase())));
  return exec(executable, args, { cwd, env, windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024 });
}

function gitMetadata(directory) {
  return fs.lstat(path.join(directory, '.git')).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
}

async function isInsideRepository(directory, executable) {
  if (executable) {
    const result = await runGit(executable, ['rev-parse', '--git-dir'], directory).catch(() => undefined);
    if (result?.stdout.trim()) return true;
  }
  // Git can refuse to open a repository owned by another user. Its metadata still marks the boundary.
  let current = directory;
  for (;;) {
    if (await gitMetadata(current)) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

async function gitProjectStatus(location, executable) {
  const parent = await existingDirectory(location).catch(() => undefined);
  return {
    available: Boolean(executable),
    validLocation: Boolean(parent),
    insideRepository: Boolean(parent && await isInsideRepository(parent, executable))
  };
}

async function initializeProjectGit(project, parent, executable, choice, log) {
  if (choice === false) return;
  if (!executable) {
    if (choice === true) throw new Error('Install Git and refresh the wizard to initialize a repository.');
    return;
  }
  if (choice !== true && await isInsideRepository(parent, executable)) return;
  // An imported template can already contain its own Git metadata.
  if (await gitMetadata(project)) return;
  try {
    await runGit(executable, ['init', '--quiet'], project);
    log?.('Initialized Git repository for ' + path.basename(project) + '.');
  } catch (error) {
    log?.(error.stderr?.trim() || error.message);
    throw new Error('Could not initialize the Git repository. See Project Wizard output for details.');
  }
}

module.exports = { gitProjectStatus, initializeProjectGit };
