const { randomBytes } = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const vscode = require('vscode');
const {
  createDotnetProject, createProject, detectFrameworks, existingDirectory,
  getSdk, installMonoGame, listMonoGame
} = require('./projects');
const { starters, writeStarter } = require('./starters');
const { detectToolchains, getSetup, templateAvailability, templatesForPlatform, toolchains } = require('./toolchains');
const { applyProjectOptions, projectOptions, readProjectOptions } = require('./project-options');
const { selectPython, setupPython } = require('./python-options');
const { createReactNativeProject } = require('./react-native');
const { extractZipTemplate, listZipTemplates } = require('./zip-templates');
const { readCatalogSettings, enabledTemplates } = require('./catalog');
const { gitProjectStatus, initializeProjectGit } = require('./git-project');
const { projectHistory } = require('./recent-projects');

const configurationKey = 'projectWizard.zipTemplatesDirectory';
const catalogKey = 'projectWizard.catalog';
const projectFiles = '**/{*.csproj,*.fsproj,*.vbproj,Directory.Packages.props,CMakeLists.txt}';
const generatedFiles = '**/{.git,node_modules,bin,obj,build,.project-wizard-*}/**';

function zipDirectory() {
  return vscode.workspace.getConfiguration().get(configurationKey, '').trim();
}

function folderPath(uri) {
  if (uri?.scheme === 'file' || (uri?.scheme === 'vscode-remote' && vscode.env.remoteName)) {
    return uri.fsPath;
  }
}

async function pickFolder(title, currentDirectory) {
  const directory = await existingDirectory(currentDirectory).catch(() => os.homedir());
  const selected = await vscode.window.showOpenDialog({
    title,
    defaultUri: vscode.Uri.file(directory),
    openLabel: 'Select Folder',
    canSelectFolders: true,
    canSelectFiles: false
  });
  return folderPath(selected?.[0]);
}

async function chooseZipDirectory() {
  const selected = await pickFolder('Choose ZIP Templates Folder', zipDirectory());
  if (selected) {
    await vscode.workspace.getConfiguration().update(configurationKey, selected, vscode.ConfigurationTarget.Global);
  }
  return selected;
}

async function workspaceFrameworks() {
  const files = await vscode.workspace.findFiles(projectFiles, generatedFiles, 100);
  const matches = await Promise.all(files.map(async uri => {
    try {
      if ((await vscode.workspace.fs.stat(uri)).size > 512 * 1024) return [];
      const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
      return detectFrameworks(path.basename(uri.fsPath), content);
    } catch {
      return [];
    }
  }));
  return [...new Set(matches.flat())].sort();
}

function wizardHtml(webview, extensionUri) {
  const resource = file => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', file));
  const nonce = randomBytes(18).toString('base64');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'">
  <link rel="stylesheet" href="${resource('wizard.css')}">
  <title>New Project</title>
</head>
<body>
  <main class="wizard">
    <header class="page-header">
      <h1>New Project</h1>
      <div class="header-actions">
        <button id="refresh" type="button" class="secondary">Refresh templates</button>
        <button id="settings" type="button" class="secondary" disabled>Settings</button>
      </div>
    </header>
    <div class="workspace">
      <aside class="sidebar">
        <nav aria-label="Template categories" id="categories">
          <button type="button" data-group="all" aria-pressed="true">All Templates</button>
          <button type="button" data-group="cli" aria-pressed="false">Command Line</button>
          <button type="button" data-group="desktop" aria-pressed="false">Desktop</button>
          <button type="button" data-group="mobile" aria-pressed="false">Mobile</button>
          <button type="button" data-group="graphics" aria-pressed="false">Graphics</button>
          <button type="button" data-group="vr" aria-pressed="false" hidden>VR</button>
          <button type="button" data-group="frontend" aria-pressed="false">Web Frontend</button>
          <button type="button" data-group="server" aria-pressed="false">Web Server</button>
          <button type="button" data-group="monogame" aria-pressed="false">MonoGame</button>
          <button type="button" data-group="raylib" aria-pressed="false">Raylib</button>
          <button type="button" data-group="zip" aria-pressed="false">Custom ZIPs</button>
        </nav>
        <section class="environment" aria-label="Detected tools and frameworks">
          <details>
            <summary id="toolchain-status">Detecting toolchains…</summary>
            <ul id="toolchain-list"></ul>
          </details>
          <p id="frameworks" hidden></p>
        </section>
      </aside>
      <section class="catalog" aria-labelledby="catalog-heading">
        <h2 id="catalog-heading">Templates</h2>
        <label for="search" class="visually-hidden">Search templates</label>
        <input id="search" type="search" placeholder="Search templates" autocomplete="off">
        <div class="filters">
          <label for="language" class="visually-hidden">Language</label>
          <select id="language"><option value="">All languages</option></select>
          <label class="ready-filter"><input id="ready-only" type="checkbox" checked> Ready to use</label>
        </div>
        <div id="source" class="source" hidden>
          <p id="source-path"></p>
          <button id="choose-zip" type="button" class="secondary">Choose ZIP folder…</button>
        </div>
        <div id="mono-setup" class="source" hidden>
          <p id="mono-status"></p>
          <button id="install" type="button" class="secondary">Install MonoGame templates</button>
          <button id="mono-sdk-guide" type="button" class="secondary" hidden>Open .NET setup guide</button>
        </div>
        <div id="template-list" aria-label="Project templates"></div>
        <p id="catalog-status" role="status">Detecting templates…</p>
      </section>
      <section class="details" aria-labelledby="details-heading">
        <h2 id="details-heading">Project details</h2>
        <div class="selection" id="selection" hidden>
          <p id="selected-name"></p>
          <p id="selected-requirement"></p>
          <div id="setup-tools" hidden></div>
          <p id="setup-feedback" role="status" hidden></p>
        </div>
        <form id="project-form" novalidate>
          <label for="name">Name</label>
          <input id="name" type="text" autocomplete="off" maxlength="80" placeholder="MyProject" required>
          <label for="location">Location</label>
          <div class="location-row">
            <input id="location" type="text" autocomplete="off" spellcheck="false" required>
            <button id="browse" class="secondary" type="button">Browse…</button>
          </div>
          <p id="destination" class="destination"></p>
          <label for="open-mode">After creation</label>
          <select id="open-mode">
            <option value="new">Open in a new window</option>
            <option value="current">Open in this window</option>
            <option value="workspace" id="workspace-mode" hidden>Keep in current workspace</option>
            <option value="none">Leave folder closed</option>
          </select>
          <div class="git-options">
            <label class="option-check"><input id="initialize-git" type="checkbox" aria-describedby="git-status" disabled> Initialize Git repository</label>
            <p id="git-status" role="status" hidden></p>
            <button id="git-setup-guide" type="button" class="secondary" hidden>Open Git setup guide</button>
          </div>
          <details id="project-options" hidden>
            <summary>Project setup</summary>
            <fieldset id="option-fields">
              <div id="build-choice-field" hidden>
                <label id="build-choice-label" for="build-choice"></label>
                <select id="build-choice"></select>
              </div>
              <fieldset id="target-choice-field" hidden>
                <legend id="target-choice-label"></legend>
                <div id="target-choices"></div>
                <p id="target-choice-help" class="option-hint" hidden>Choose at least one target platform.</p>
              </fieldset>
              <div id="python-options" hidden>
                <label for="python-environment">Python environment</label>
                <select id="python-environment"></select>
                <div id="python-version-field">
                  <label for="python-version">Python version</label>
                  <input id="python-version" type="text" list="python-versions" maxlength="16" placeholder="Default">
                  <datalist id="python-versions"></datalist>
                </div>
                <p id="python-environment-help"></p>
                <button id="python-manager-guide" type="button" class="secondary" hidden>Open setup guide</button>
              </div>
              <div id="library-choices" hidden></div>
              <div id="dependency-options" hidden>
                <label for="dependencies" id="dependencies-label">Additional dependencies</label>
                <textarea id="dependencies" rows="2" maxlength="12000" spellcheck="false" autocomplete="off"></textarea>
                <p class="option-hint">One dependency per line.</p>
              </div>
              <label id="testing-option" class="option-check" hidden><input id="testing" type="checkbox"> <span id="testing-label"></span></label>
              <div id="test-framework-field" hidden>
                <label for="test-framework">Test framework</label>
                <select id="test-framework"></select>
              </div>
            </fieldset>
          </details>
          <p id="error" class="error" role="alert" hidden></p>
          <p id="operation" role="status" hidden></p>
          <div class="actions">
            <button id="show-output" type="button" class="secondary" hidden>Show Output</button>
            <button id="create" type="submit" disabled>Create Project</button>
          </div>
        </form>
      </section>
    </div>
    <section class="recent-projects" aria-labelledby="recent-heading">
      <h2 id="recent-heading">Recent projects</h2>
      <ul id="recent-project-list"></ul>
      <p id="recent-empty" role="status">Loading recent projects…</p>
      <p id="recent-error" class="error" role="alert" hidden></p>
    </section>
  </main>
  <dialog id="catalog-settings" aria-labelledby="settings-heading">
    <form id="settings-form">
      <h2 id="settings-heading">Project Wizard settings</h2>
      <label class="option-check"><input id="open-on-startup" type="checkbox"> Open Project Wizard when VS Code starts</label>
      <label class="option-check"><input id="enable-vr" type="checkbox"> Enable VR templates</label>
      <div class="settings-lists">
        <fieldset>
          <legend>Languages</legend>
          <div id="settings-languages"></div>
        </fieldset>
        <fieldset>
          <legend>Templates</legend>
          <label for="settings-search" class="visually-hidden">Search templates in settings</label>
          <input id="settings-search" type="search" placeholder="Search templates" autocomplete="off">
          <div id="settings-templates"></div>
          <p id="settings-empty" hidden>No templates match your search.</p>
        </fieldset>
      </div>
      <p id="settings-error" class="error" role="alert" hidden></p>
      <div class="actions">
        <button id="cancel-settings" type="button" class="secondary">Cancel</button>
        <button id="save-settings" type="submit">Save settings</button>
      </div>
    </form>
  </dialog>
  <script nonce="${nonce}" src="${resource('wizard.js')}"></script>
</body>
</html>`;
}

function activate(context) {
  const output = vscode.window.createOutputChannel('Project Wizard');
  const log = line => output.appendLine(line);
  const history = projectHistory(vscode, context.globalState, log);
  let active;

  const send = (session, message) => {
    if (session && active === session) return session.panel.webview.postMessage(message);
  };

  function catalogSettings() {
    return readCatalogSettings(vscode.workspace.getConfiguration().get(catalogKey));
  }

  async function showRecentProjects(session) {
    const scan = ++session.recentScan;
    const projects = await history.list();
    if (active !== session || scan !== session.recentScan) return;
    session.recentProjects = new Map(projects.map(project => [project.id, project]));
    await send(session, { type: 'recentProjects', projects });
  }

  async function openProject(uri, options, recent) {
    const target = uri.toString();
    const marker = catalogSettings().openOnStartup ? await history.suppressStartup(target) : undefined;
    try {
      let opened;
      if (recent?.remoteAuthority && uri.scheme === 'file') {
        const openable = recent.kind === 'workspace' ? { workspaceUri: uri } : { folderUri: uri };
        opened = await vscode.commands.executeCommand('_files.windowOpen', [openable], {
          ...options, remoteAuthority: recent.remoteAuthority
        });
      } else {
        opened = await vscode.commands.executeCommand('vscode.openFolder', uri, options);
      }
      if (opened === false && marker) await history.takeStartupSuppression(target, marker);
    } catch (error) {
      if (marker) await history.takeStartupSuppression(target, marker);
      throw error;
    }
  }

  async function openRecentProject(session, id) {
    const project = session.recentProjects.get(id);
    if (!project) throw new Error('Select a project from the recent list.');
    if (history.current()?.id === id) {
      session.panel.dispose();
      return;
    }
    const uri = vscode.Uri.parse(project.uri);
    const local = uri.scheme === 'file' && !project.remoteAuthority;
    if (local && !vscode.env.remoteName) {
      const entry = await vscode.workspace.fs.stat(uri).catch(() => undefined);
      const expected = project.kind === 'workspace' ? vscode.FileType.File : vscode.FileType.Directory;
      if (!(entry?.type & expected)) throw new Error(`${project.name} is unavailable at ${project.location}.`);
    }
    await openProject(uri, { forceReuseWindow: true, forceLocalWindow: local }, project);
  }

  async function refresh(session, requestedLocation, rescanTools = false) {
    const scan = ++session.scan;
    const preferred = requestedLocation || session.parent;
    const parent = await existingDirectory(preferred).catch(() => os.homedir());
    if (requestedLocation && scan === session.scan) session.parent = preferred;
    if (rescanTools || !session.toolchainScan) {
      session.toolchainScan = detectToolchains().catch(error => {
        log(error.message);
        return { results: {} };
      });
    }
    const [sdk, zip, frameworks, { results, manager, pythonVersions = [] }] = await Promise.all([
      getSdk(parent, log).catch(error => ({ error: error.message })),
      listZipTemplates(zipDirectory()),
      workspaceFrameworks().catch(error => { log(error.message); return []; }),
      session.toolchainScan
    ]);
    let mono = [];
    let monoError;
    if (sdk.version) {
      try {
        mono = await listMonoGame(sdk, parent, log);
      } catch (error) {
        monoError = error.message;
      }
    }
    if (session.scan !== scan || active !== session) return;

    const detected = { ...results, dotnet: sdk.version ? { version: sdk.version, file: sdk.executable } : undefined };
    const settings = catalogSettings();
    const availableTemplates = templatesForPlatform([...mono, ...starters, ...zip.templates], process.platform);
    const templates = enabledTemplates(availableTemplates, settings).map(template => {
      const availability = templateAvailability(template, detected, process.platform, manager);
      const options = projectOptions(template, detected, pythonVersions, process.platform, manager);
      const builds = options?.buildChoice || options?.targetChoice;
      const ready = builds ? builds.options.some(option => option.ready) : availability.ready;
      return { ...template, ...availability, options, ready };
    });
    session.templates = new Map(templates.map(template => [template.id, template]));
    session.manager = manager;
    session.tools = detected;
    session.pythonVersions = pythonVersions;
    await send(session, {
      type: 'catalog', parent: session.parent, separator: path.sep, openMode: session.openMode,
      hasWorkspace: Boolean(vscode.workspace.workspaceFolders?.length),
      settings, availableTemplates: availableTemplates.map(({ id, label, language, group }) => ({ id, label, language, group })),
      templates: templates.map(template => ({
        id: template.id, group: template.group, label: template.label, language: template.language,
        description: template.description, requirement: template.requirement, ready: template.ready, missing: template.missing,
        options: template.options,
        disabled: Boolean((template.needsSdk && !sdk.version) || (template.kind === 'react-native' && !template.ready))
      })),
      detected: Object.entries(detected).filter(([id, result]) =>
        !['vite-node', 'expo-node', 'react-native-node', 'android-gradle', 'android-xr-gradle', 'java-17', 'kmp-gradle'].includes(id) && result)
        .map(([id, result]) => ({ label: toolchains[id].label, ...result }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      sdkVersion: sdk.version, sdkError: sdk.error, monoError, monoCount: mono.length,
      zipDirectory: zip.directory, zipError: zip.error, zipCount: zip.templates.length, frameworks
    });
  }

  async function create(session, message) {
    const template = session.templates.get(message.templateId);
    const settings = catalogSettings();
    if (!template || !enabledTemplates([template], settings).length) throw new Error('Select a template from the list.');
    const options = readProjectOptions(template, message.options);
    const python = options?.type === 'python' && selectPython(options, session.tools, session.pythonVersions, template);
    if (options?.type === 'python' && !python) {
      throw new Error('Python projects require a virtual environment. Install the selected version or choose a different environment manager.');
    }
    if (message.openMode === 'workspace' && !vscode.workspace.getWorkspaceFolder(vscode.Uri.file(message.location))) {
      throw new Error('Choose a location inside the current workspace, or change After creation.');
    }
    const destination = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification, title: 'Creating project…'
    }, () => createProject(message.location, message.name, async (project, parent) => {
      if (template.kind === 'dotnet') await createDotnetProject(template, message.name, project, parent, log);
      if (template.kind === 'starter') await writeStarter(template, message.name, project, parent, log);
      if (template.kind === 'react-native') await createReactNativeProject(message.name, project, session.tools, log);
      if (template.kind === 'zip') await extractZipTemplate(template.archive, project, message.name);
      await applyProjectOptions(project, template, message.name, options, parent, log);
      await initializeProjectGit(project, parent, session.tools?.git?.file, message.initializeGit, log);
    }, log));

    if (python) {
      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification, title: 'Setting up Python environment…'
        }, () => setupPython(destination, options, python, log));
      } catch (error) {
        log(error.message);
        throw new Error('Python environment setup failed at ' + destination + '. The folder contains the starter files. See Project Wizard output and the generated README to finish setup.');
      }
    }
    const summary = `Created ${destination}.${template.next ? ` ${template.next}` : ''}`;
    await send(session, { type: 'success', message: summary });
    if (message.openMode === 'new' || message.openMode === 'current') {
      try {
        await openProject(vscode.Uri.file(destination), {
          forceNewWindow: message.openMode === 'new', forceReuseWindow: message.openMode === 'current'
        });
      } catch (error) {
        throw new Error(`Project created at ${destination}. Could not open it. ${error.message}`);
      }
    } else if (message.openMode === 'workspace') {
      await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(path.join(message.location, message.name)));
    } else if (active !== session) {
      void vscode.window.showInformationMessage(summary);
    }
  }

  async function handleMessage(session, message) {
    if (!message || typeof message.type !== 'string' || active !== session) return;
    if (message.type === 'showOutput') return output.show(true);
    if (message.type === 'checkGitLocation') {
      const status = await gitProjectStatus(message.location, session.tools?.git?.file).catch(error => {
        log(error.message);
        return { error: 'Could not check this location for an existing Git repository.' };
      });
      return send(session, { type: 'gitLocation', requestId: message.requestId, ...status });
    }
    if (session.busy) return;
    if (message.type === 'ready' || message.type === 'locationChanged' || message.type === 'refresh') {
      if (message.type !== 'locationChanged') void showRecentProjects(session).catch(error => log(error.message));
      return refresh(session, message.location, message.type === 'refresh');
    }
    if (message.type === 'openRecentProject') {
      session.busy = true;
      try {
        await openRecentProject(session, message.projectId);
        await send(session, { type: 'recentProjectOpened' });
      } catch (error) {
        log(error.message);
        await send(session, { type: 'recentProjectError', message: error.message });
      } finally {
        session.busy = false;
      }
      return;
    }
    if (message.type === 'saveCatalogSettings') {
      try {
        await vscode.workspace.getConfiguration().update(catalogKey, readCatalogSettings(message.settings),
          vscode.ConfigurationTarget.Global);
        await send(session, { type: 'catalogSettingsSaved' });
      } catch (error) {
        log(error.message);
        await send(session, { type: 'catalogSettingsError', message: error.message });
      }
      return;
    }
    if (message.type === 'setupGuide' || message.type === 'copyInstallCommand') {
      const setup = getSetup(message.toolId, process.platform, session.manager);
      if (setup && message.type === 'setupGuide') {
        await vscode.env.openExternal(vscode.Uri.parse(setup.url));
      } else if (setup?.command) {
        await vscode.env.clipboard.writeText(setup.command);
        await send(session, { type: 'setupFeedback', message: 'Install command copied.' });
      }
      return;
    }
    if (message.type === 'browse') {
      const selected = await pickFolder('Choose Project Location', message.location || session.parent);
      if (selected) {
        session.parent = selected;
        await send(session, { type: 'location', location: selected });
        await refresh(session, selected);
      }
      return;
    }
    if (message.type === 'chooseZip') return chooseZipDirectory();
    if (message.type !== 'install' && message.type !== 'create') return;

    session.busy = true;
    try {
      if (message.type === 'create') {
        await create(session, message);
      } else {
        const parent = await existingDirectory(message.location || session.parent);
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification, title: 'Installing MonoGame templates…'
        }, () => installMonoGame(parent, log));
        await refresh(session, parent);
        await send(session, { type: 'success', message: 'MonoGame templates installed.' });
      }
    } finally {
      session.busy = false;
    }
  }

  function reportError(session, error) {
    const message = error.message || String(error);
    log(message);
    if (session && active === session) void send(session, { type: 'error', message });
    else void vscode.window.showErrorMessage(message);
  }

  function openWizard(uri, openMode) {
    const requestedParent = folderPath(uri);
    if (active) {
      active.panel.reveal();
      if (requestedParent && !active.busy) {
        active.parent = requestedParent;
        active.openMode = openMode;
        void send(active, { type: 'location', location: requestedParent, openMode });
        void refresh(active, requestedParent).catch(error => reportError(active, error));
      }
      return;
    }
    const parent = requestedParent || folderPath(vscode.workspace.workspaceFolders?.[0]?.uri) || os.homedir();
    const panel = vscode.window.createWebviewPanel('projectWizard.newProject', 'New Project', vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
    });
    const session = { panel, parent, openMode, scan: 0, recentScan: 0, busy: false, templates: new Map(), recentProjects: new Map() };
    active = session;
    const messages = panel.webview.onDidReceiveMessage(message => {
      void handleMessage(session, message).catch(error => reportError(session, error));
    });
    panel.onDidDispose(() => {
      messages.dispose();
      if (active === session) active = undefined;
    });
    panel.webview.html = wizardHtml(panel.webview, context.extensionUri);
  }

  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('projectWizard.newProject', uri =>
      openWizard(uri, uri && folderPath(uri) && vscode.workspace.getWorkspaceFolder(uri) ? 'workspace' : undefined)),
    vscode.commands.registerCommand('projectWizard.newProjectInWorkspace', async () => {
      const folders = vscode.workspace.workspaceFolders || [];
      if (!folders.length) {
        void vscode.window.showInformationMessage('Open a workspace folder to create a project inside it.');
        return;
      }
      const folder = folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick({
        placeHolder: 'Choose a parent workspace folder'
      });
      if (folder) openWizard(folder.uri, 'workspace');
    }),
    vscode.commands.registerCommand('projectWizard.chooseZipDirectory', async () => {
      try {
        await chooseZipDirectory();
      } catch (error) {
        reportError(active, error);
      }
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      const session = active;
      if (session && (event.affectsConfiguration(configurationKey) || event.affectsConfiguration(catalogKey))) {
        void refresh(session).catch(error => reportError(session, error));
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await history.rememberCurrent();
      if (active) void showRecentProjects(active).catch(error => log(error.message));
    }),
    vscode.window.onDidChangeWindowState(({ focused }) => {
      if (focused && active) void showRecentProjects(active).catch(error => log(error.message));
    }),
    { dispose: () => active?.panel.dispose() }
  );

  void (async () => {
    const current = history.current();
    const skip = current && await history.takeStartupSuppression(current.uri);
    await history.rememberCurrent();
    if (!skip && !active && catalogSettings().openOnStartup) openWizard();
  })().catch(error => reportError(active, error));
}

module.exports = { activate };
