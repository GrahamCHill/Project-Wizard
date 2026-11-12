const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readCatalogSettings } = require('../src/catalog');
const { projectHistory } = require('../src/recent-projects');

const file = path => ({ scheme: 'file', path });

function fixture(recent) {
  const data = new Map();
  const workspace = {};
  const vscode = {
    workspace,
    Uri: { from: uri => ({ ...uri, fsPath: uri.path, toString: () => `${uri.scheme}://${uri.authority || ''}${uri.path}` }) },
    commands: {
      executeCommand: async command => {
        assert.equal(command, '_workbench.getRecentlyOpened');
        if (!recent) throw new Error('Command unavailable');
        return recent;
      }
    }
  };
  const state = {
    get: (key, fallback) => data.get(key) ?? fallback,
    update: async (key, value) => { data.set(key, value); }
  };
  return { history: projectHistory(vscode, state, () => {}), workspace, data };
}

test('shows ten distinct recent folders and saved workspaces in VS Code order', async () => {
  const folders = Array.from({ length: 14 }, (_, index) => ({ folderUri: file(`/projects/Project ${index + 1}`) }));
  const recent = {
    workspaces: [
      { workspace: { configPath: file('/projects/Shared.code-workspace') } },
      { workspace: { configPath: { scheme: 'untitled', path: '/workspace' } } },
      folders[0], ...folders
    ],
    files: [{ fileUri: file('/projects/readme.md') }]
  };
  const { history } = fixture(recent);
  const projects = await history.list();
  assert.equal(projects.length, 10);
  assert.deepEqual(projects.map(project => project.name), ['Shared', ...folders.slice(0, 9).map((_, index) => `Project ${index + 1}`)]);
  assert.equal(projects[0].kind, 'workspace');
  assert.equal(projects[1].kind, 'folder');
});

test('falls back to recorded workspaces and consumes startup suppression once', async () => {
  const { history, workspace } = fixture();
  assert.equal(readCatalogSettings().openOnStartup, false);
  assert.equal(readCatalogSettings({ openOnStartup: true }).openOnStartup, true);
  for (let i = 0; i < 12; i++) {
    workspace.workspaceFolders = [{ uri: file(`/projects/Folder ${i}`) }];
    await history.rememberCurrent();
  }
  workspace.workspaceFolders = [{ uri: file('/projects/Folder 5') }];
  await history.rememberCurrent();
  const recent = await history.list();
  assert.equal(recent.length, 10);
  assert.equal(recent[0].name, 'Folder 5');
  assert.equal(recent.filter(project => project.name === 'Folder 5').length, 1);

  const [first, second] = recent.map(project => project.uri);
  const [marker] = await Promise.all([history.suppressStartup(first), history.suppressStartup(second)]);
  assert.equal(await history.takeStartupSuppression(first, marker + 1), false);
  assert.equal(await history.takeStartupSuppression(first), true);
  assert.equal(await history.takeStartupSuppression(first), false);
  assert.equal(await history.takeStartupSuppression(second), true);
});
