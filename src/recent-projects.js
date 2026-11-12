const path = require('node:path');

const historyKey = 'recentProjects';
const startupKey = 'recentProjectStartup';
const recentLimit = 10;
const startupTimeout = 2 * 60 * 1000;

function latestProjects(projects) {
  if (!Array.isArray(projects)) return [];
  const entries = new Map();
  for (const project of projects) {
    if (typeof project?.id !== 'string' || typeof project.uri !== 'string' || entries.has(project.id)) continue;
    entries.set(project.id, project);
    if (entries.size === recentLimit) break;
  }
  return [...entries.values()];
}

function projectHistory(vscode, state, log) {
  let writes = Promise.resolve();
  function write(update) {
    writes = writes.then(update).catch(error => { log(error.message); });
    return writes;
  }

  function project(components, kind, remoteAuthority) {
    if (!components || !['file', 'vscode-remote'].includes(components.scheme) || typeof components.path !== 'string') return;
    const uri = vscode.Uri.from(components);
    const file = uri.toString();
    const location = uri.scheme === 'file' ? uri.fsPath : uri.path;
    const authority = uri.scheme === 'vscode-remote' ? uri.authority : remoteAuthority;
    const id = authority && uri.scheme === 'file' ? `${file} (${authority})` : file;
    const name = path.basename(location, kind === 'workspace' ? '.code-workspace' : undefined) || location;
    return { id, uri: file, name, location: authority ? `${location} (${authority})` : location, kind, remoteAuthority };
  }

  function current() {
    const workspace = vscode.workspace.workspaceFile;
    if (workspace) return project(workspace, 'workspace');
    const folders = vscode.workspace.workspaceFolders || [];
    if (folders.length === 1) return project(folders[0].uri, 'folder');
  }

  function rememberCurrent() {
    const entry = current();
    if (!entry) return writes;
    return write(async () => {
      const previous = latestProjects(state.get(historyKey, []));
      if (previous[0]?.id !== entry.id) await state.update(historyKey, latestProjects([entry, ...previous]));
    });
  }

  async function list() {
    try {
      // VS Code has no public command for reading File > Open Recent.
      const recent = await vscode.commands.executeCommand('_workbench.getRecentlyOpened');
      if (Array.isArray(recent?.workspaces)) {
        return latestProjects(recent.workspaces.map(item => item?.folderUri ?
          project(item.folderUri, 'folder', item.remoteAuthority) :
          project(item?.workspace?.configPath, 'workspace', item?.remoteAuthority)));
      }
    } catch (error) {
      log('Could not read the VS Code recent list: ' + error.message);
    }
    return latestProjects(state.get(historyKey, []));
  }

  function suppressStartup(uri) {
    const expires = Date.now() + startupTimeout;
    return write(async () => {
      const pending = state.get(startupKey, {});
      const active = Object.entries(pending).filter(([, deadline]) => deadline > Date.now());
      await state.update(startupKey, { ...Object.fromEntries(active), [uri]: expires });
      return expires;
    });
  }

  function takeStartupSuppression(uri, expected) {
    return write(async () => {
      const pending = state.get(startupKey, {});
      const expires = pending[uri];
      if (!expires || (expected !== undefined && expected !== expires)) return false;
      const { [uri]: consumed, ...rest } = pending;
      await state.update(startupKey, rest);
      return consumed > Date.now();
    });
  }

  return { current, rememberCurrent, list, suppressStartup, takeStartupSuppression };
}

module.exports = { projectHistory };
