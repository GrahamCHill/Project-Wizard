const vscode = acquireVsCodeApi();
const byId = id => document.getElementById(id);
const categories = byId('categories');
const search = byId('search');
const languageSelect = byId('language');
const readyOnly = byId('ready-only');
const list = byId('template-list');
const nameInput = byId('name');
const locationInput = byId('location');
const openMode = byId('open-mode');
const initializeGit = byId('initialize-git');
const projectSetup = byId('project-options');
const buildChoiceSelect = byId('build-choice');
const targetChoices = byId('target-choices');
const executableIcon = byId('executable-icon');
const environmentSelect = byId('python-environment');
const pythonVersion = byId('python-version');
const testFramework = byId('test-framework');
const errorMessage = byId('error');
const operation = byId('operation');
const settingsDialog = byId('catalog-settings');
const settingsSearch = byId('settings-search');
const settingsLanguages = byId('settings-languages');
const settingsTemplates = byId('settings-templates');
const recentList = byId('recent-project-list');
const groupTitles = {
  all: 'Templates', cli: 'Command Line', desktop: 'Desktop', mobile: 'Mobile', graphics: 'Graphics', frontend: 'Web Frontend', server: 'Web Server',
  monogame: 'MonoGame', raylib: 'Raylib', games: 'Game Engines', blender: 'Blender', ai: 'ML & AI',
  documents: 'Documents', zip: 'Custom ZIPs', vr: 'VR'
};

let catalog;
let group = 'all';
let selected;
let visibleTemplates = [];
let pending = false;
let loading = true;
let editedLocation = false;
let renderedMissing;
let optionTemplate;
let executableIconNames = {};
let catalogDraft;
let gitLocation;
let gitStatus;
let gitOverride;
let gitRequest = 0;
let gitTimer;

function searchText(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function checkboxLabel(value, text, checked) {
  const label = document.createElement('label');
  label.className = 'option-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = value;
  input.checked = checked;
  label.append(input, text);
  return label;
}

function filterSettingsTemplates() {
  const query = searchText(settingsSearch.value.trim());
  let matches = 0;
  for (const label of settingsTemplates.children) {
    label.hidden = !label.dataset.search.includes(query);
    if (!label.hidden) matches++;
  }
  byId('settings-empty').hidden = matches > 0;
}

function openSettings() {
  const { settings, availableTemplates } = catalog;
  catalogDraft = {
    disabledLanguages: new Set(settings.disabledLanguages),
    disabledTemplates: new Set(settings.disabledTemplates)
  };
  byId('settings-error').hidden = true;
  byId('open-on-startup').checked = settings.openOnStartup;
  byId('enable-vr').checked = settings.enableVrTemplates;
  byId('enable-latex').checked = settings.enableLatexTemplates;
  settingsSearch.value = '';
  const languages = [...new Set(availableTemplates.map(template => template.language).filter(Boolean))].sort();
  settingsLanguages.replaceChildren(...languages.map(language =>
    checkboxLabel(language, language, !catalogDraft.disabledLanguages.has(language))));
  const templates = [...availableTemplates].sort((a, b) => a.label.localeCompare(b.label));
  settingsTemplates.replaceChildren(...templates.map(template => {
    const label = checkboxLabel(template.id, template.label, !catalogDraft.disabledTemplates.has(template.id));
    label.dataset.search = searchText(`${template.label} ${template.language || ''} ${groupTitles[template.group] || ''}`);
    return label;
  }));
  filterSettingsTemplates();
  settingsDialog.showModal();
}

function setSettingsSaving(saving) {
  for (const control of settingsDialog.querySelectorAll('button, input')) control.disabled = saving;
}

function renderRecentProjects(projects) {
  const focused = recentList.contains(document.activeElement) && document.activeElement.dataset.projectId;
  recentList.replaceChildren(...projects.map(project => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.projectId = project.id;
    button.title = project.location;
    const name = document.createElement('span');
    name.className = 'recent-project-name';
    name.textContent = project.name;
    const location = document.createElement('span');
    location.className = 'recent-project-location';
    location.textContent = project.location;
    button.append(name, location);
    item.append(button);
    return item;
  }));
  const empty = byId('recent-empty');
  empty.textContent = 'Folders and workspaces you open in VS Code will appear here.';
  empty.hidden = projects.length > 0;
  updateForm();
  if (focused) [...recentList.querySelectorAll('button')].find(button => button.dataset.projectId === focused)?.focus();
}

function setupButton(label, action, toolId) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary';
  button.textContent = label;
  button.dataset.setup = action;
  button.dataset.toolId = toolId;
  return button;
}

function renderSetup(requirements) {
  const missing = requirements || [];
  const state = JSON.stringify(missing);
  if (renderedMissing === state) return;
  renderedMissing = state;
  const setup = byId('setup-tools');
  setup.replaceChildren();
  setup.hidden = missing.length === 0;
  byId('setup-feedback').hidden = true;

  for (const tool of missing) {
    const item = document.createElement('div');
    item.className = 'setup-tool';
    const heading = document.createElement('p');
    heading.className = 'setup-title';
    heading.textContent = tool.label + ' setup';
    const instructions = document.createElement('p');
    instructions.textContent = tool.instructions;
    const controls = document.createElement('div');
    controls.className = 'setup-actions';
    controls.append(setupButton('Open setup guide', 'setupGuide', tool.id));
    if (tool.command) controls.append(setupButton('Copy install command', 'copyInstallCommand', tool.id));
    item.append(heading, instructions, controls);
    setup.append(item);
  }
  if (missing.length) {
    const refreshNote = document.createElement('p');
    refreshNote.textContent = 'Refresh templates after setup. Restart VS Code if your PATH changed.';
    setup.append(refreshNote);
  }
}

function pythonEnvironmentReady() {
  const options = optionTemplate?.options;
  if (options?.type !== 'python') return true;
  const environment = options?.environments?.find(item => item.id === environmentSelect.value);
  const version = pythonVersion.value.trim();
  const local = ['venv', 'virtualenv'].includes(environment?.id);
  const versionMissing = local && version && !environment.versions.some(value =>
    value === version || value.startsWith(version + '.'));
  const unavailable = !environment?.available;
  const help = byId('python-environment-help');
  help.textContent = unavailable ? 'Install the selected environment manager or choose another one.' :
    versionMissing ? 'Install this Python version or choose uv or Conda to download it.' :
    'Project Wizard creates .venv and installs the selected packages.';
  const guide = byId('python-manager-guide');
  guide.hidden = !unavailable || !environment?.tool;
  guide.dataset.toolId = environment?.tool || '';
  return !unavailable && !versionMissing;
}

function updateVersionSuggestions() {
  const environment = optionTemplate?.options?.environments?.find(item => item.id === environmentSelect.value);
  byId('python-versions').replaceChildren(...(environment?.versions || []).map(version => new Option(version)));
}

function updateTestFrameworkField() {
  byId('test-framework-field').hidden = !byId('testing').checked || (optionTemplate?.options?.frameworks?.length || 0) < 2;
}

function selectedBuild() {
  return optionTemplate?.options?.buildChoice?.options.find(option => option.id === buildChoiceSelect.value);
}

function selectedTargets() {
  const choices = optionTemplate?.options?.targetChoice;
  const selected = new Set([...targetChoices.querySelectorAll('input:checked')].map(input => input.value));
  return choices?.options.filter(option => selected.has(option.id)) || [];
}

function updateExecutableIcon(targets) {
  const options = optionTemplate?.options;
  const formats = options?.executableIconFormats || [];
  const available = formats.length > 0 && (!options.targetChoice || targets.some(target => target.id === 'native'));
  const enabled = available && executableIcon.checked;
  byId('executable-icon-field').hidden = !available;
  byId('executable-icon-picker').hidden = !enabled;
  const names = formats.map(format => executableIconNames[format]).filter(Boolean);
  const namesLabel = byId('executable-icon-names');
  const description = names.join(', ');
  if (namesLabel.textContent !== description) namesLabel.textContent = description;
  namesLabel.hidden = !names.length;
  byId('executable-icon-help').textContent = formats.length === 2 ?
    'Choose a Windows .ico, a macOS .icns, or both.' : 'Choose a Windows .ico file.';
  return enabled && names.length === 0;
}

function updateDependencyField() {
  const options = optionTemplate?.options;
  byId('dependency-options').hidden = !options?.dependencies || (options.type === 'java' && buildChoiceSelect.value === 'jdk');
}

function renderProjectOptions(template) {
  if (optionTemplate === template) return;
  const preserve = optionTemplate?.id === template?.id;
  optionTemplate = template;
  const options = template?.options;
  projectSetup.hidden = !options;
  if (!options) return;
  if (!preserve) {
    projectSetup.open = true;
    byId('dependencies').value = '';
    byId('testing').checked = false;
    executableIcon.checked = false;
    pythonVersion.value = '';
  }
  const build = options.buildChoice;
  byId('build-choice-field').hidden = !build;
  if (build) {
    const previous = preserve ? buildChoiceSelect.value : '';
    byId('build-choice-label').textContent = build.label;
    buildChoiceSelect.replaceChildren(...build.options.map(option =>
      new Option(option.label + (option.ready ? '' : ' (setup needed)'), option.id)));
    buildChoiceSelect.value = build.options.some(option => option.id === previous) ? previous : build.defaultId;
  }
  const targets = options.targetChoice;
  byId('target-choice-field').hidden = !targets;
  if (targets) {
    byId('target-choice-label').textContent = targets.label;
    const previous = preserve ? [...targetChoices.querySelectorAll('input:checked')].map(input => input.value) : [targets.defaultId];
    targetChoices.replaceChildren(...targets.options.map(option =>
      checkboxLabel(option.id, option.label + (option.ready ? '' : ' (setup needed)'), previous.includes(option.id))));
  }
  byId('python-options').hidden = options.type !== 'python';
  if (options.type === 'python') {
    const environment = preserve ? environmentSelect.value : options.defaultEnvironment;
    environmentSelect.replaceChildren(...options.environments.map(item =>
      new Option(item.label + (item.available === false ? ' (setup needed)' : ''), item.id)));
    environmentSelect.value = environment || options.defaultEnvironment;
    updateVersionSuggestions();
  }

  const choices = byId('library-choices');
  const checked = preserve ? new Set([...choices.querySelectorAll('input:checked')].map(input => input.value)) : new Set();
  choices.replaceChildren();
  for (const library of options.libraries || []) {
    const label = document.createElement('label');
    label.className = 'option-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = library.id;
    input.checked = checked.has(library.id);
    label.append(input, library.label);
    choices.append(label);
  }
  choices.hidden = !options.libraries?.length;
  updateDependencyField();
  byId('dependencies-label').textContent = options.dependencies || '';
  byId('dependencies').placeholder = options.example || '';
  byId('dependency-hint').textContent = options.requiredDependencies?.length ?
    'Included packages: ' + options.requiredDependencies.join(', ') + '. Enter one additional package per line.' : 'One dependency per line.';
  byId('testing-option').hidden = !options.test;
  byId('testing-label').textContent = options.test || '';
  const previousFramework = preserve ? testFramework.value : '';
  const frameworks = options.frameworks || [];
  testFramework.replaceChildren(...frameworks.map(item => new Option(item.label, item.id)));
  if (frameworks.some(item => item.id === previousFramework)) testFramework.value = previousFramework;
  updateTestFrameworkField();
}

function selectedOptions() {
  if (!optionTemplate?.options) return;
  return {
    build: selectedBuild()?.id,
    targets: optionTemplate.options.targetChoice ? selectedTargets().map(option => option.id) : undefined,
    executableIcon: !byId('executable-icon-picker').hidden,
    environment: environmentSelect.value,
    pythonVersion: pythonVersion.value,
    testing: byId('testing').checked,
    framework: testFramework.value,
    dependencies: byId('dependency-options').hidden ? '' : byId('dependencies').value,
    libraries: [...byId('library-choices').querySelectorAll('input:checked')].map(input => input.value)
  };
}

function checkGitLocation(delay = 0) {
  const location = locationInput.value.trim();
  if (location !== gitLocation) gitOverride = undefined;
  gitLocation = location;
  gitStatus = undefined;
  clearTimeout(gitTimer);
  const requestId = ++gitRequest;
  if (catalog && location) {
    gitTimer = setTimeout(() => vscode.postMessage({ type: 'checkGitLocation', requestId, location }), delay);
  }
}

function updateForm() {
  const template = visibleTemplates.find(item => item.id === selected);
  const location = locationInput.value.trim();
  const name = nameInput.value;
  const separator = catalog?.separator || '/';
  const joiner = location.endsWith(separator) || location.endsWith('/') ? '' : separator;
  const destination = byId('destination');
  destination.textContent = location && name ? `${location}${joiner}${name}` : '';
  destination.title = destination.textContent;
  destination.hidden = !destination.textContent;

  byId('selection').hidden = !template;
  byId('selected-name').textContent = template?.label || '';
  renderProjectOptions(template);
  const build = selectedBuild();
  const targets = selectedTargets();
  const hasTargets = Boolean(template?.options?.targetChoice);
  const requirement = hasTargets ? targets.map(option => option.requirement).filter(Boolean).join(' ') : build?.requirement || template?.requirement;
  byId('selected-requirement').textContent = requirement || '';
  byId('selected-requirement').hidden = !requirement;
  const missing = hasTargets ? [...new Map(targets.flatMap(option => option.missing).map(tool => [tool.id, tool])).values()] :
    build?.missing || template?.missing;
  renderSetup(missing);
  for (const button of list.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.id === selected));
  }

  const environmentReady = pythonEnvironmentReady();
  const checkingGit = Boolean(catalog && location && !gitStatus);
  const canInitialize = Boolean(gitStatus?.validLocation && gitStatus.available);
  initializeGit.checked = canInitialize && (gitOverride ?? !gitStatus.insideRepository);
  initializeGit.disabled = pending || !canInitialize;
  const gitMessage = byId('git-status');
  gitMessage.textContent = gitStatus?.error || (gitStatus?.insideRepository ? 'This location is inside an existing Git repository.' :
    gitStatus?.validLocation && !gitStatus.available ? 'Git is required to initialize a repository.' : '');
  gitMessage.hidden = !gitMessage.textContent;
  byId('git-setup-guide').hidden = !gitStatus?.validLocation || gitStatus.available;
  byId('git-setup-guide').disabled = pending;
  const missingTarget = hasTargets && targets.length === 0;
  const missingIcon = updateExecutableIcon(targets);
  byId('target-choice-help').hidden = !missingTarget;
  byId('create').disabled = pending || checkingGit || !template || template.disabled || !name.trim() || !location ||
    !environmentReady || missingTarget || missingIcon;
  byId('refresh').disabled = pending || loading;
  byId('settings').disabled = pending || !catalog;
  for (const control of [nameInput, locationInput, openMode, byId('browse'), byId('choose-zip'), byId('install')]) {
    control.disabled = pending;
  }
  for (const button of document.querySelectorAll('[data-setup]')) button.disabled = pending;
  for (const button of recentList.querySelectorAll('button')) button.disabled = pending;
  byId('option-fields').disabled = pending;
}

function templateButton(template) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'template';
  button.dataset.id = template.id;

  const title = document.createElement('span');
  title.className = 'template-title';
  title.textContent = template.label;
  button.append(title);

  const status = template.ready === false ? 'Setup needed' : '';
  if (template.language || status) {
    const metadata = document.createElement('span');
    metadata.className = 'language';
    metadata.textContent = [template.language, status].filter(Boolean).join(' · ');
    button.append(metadata);
  }

  const description = document.createElement('span');
  description.className = 'template-description';
  description.textContent = template.description;
  button.append(description);
  return button;
}

function updateCatalog() {
  const showVr = catalog?.settings.enableVrTemplates === true;
  categories.querySelector('[data-group="vr"]').hidden = !showVr;
  if (!showVr && group === 'vr') group = 'all';
  const showLatex = catalog?.settings.enableLatexTemplates === true;
  categories.querySelector('[data-group="documents"]').hidden = !showLatex;
  if (!showLatex && group === 'documents') group = 'all';
  byId('catalog-heading').textContent = groupTitles[group];
  for (const button of categories.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.group === group));
  }

  byId('source').hidden = group !== 'zip' || !catalog;
  byId('mono-setup').hidden = group !== 'monogame' || !catalog || Boolean(catalog.monoCount);
  if (catalog) {
    byId('source-path').textContent = catalog.zipError || catalog.zipDirectory || 'Choose the folder that contains your ZIP templates.';
    byId('source-path').title = catalog.zipDirectory;
    byId('mono-status').textContent = catalog.sdkError || catalog.monoError || 'No MonoGame project templates were detected.';
    byId('install').hidden = !catalog.sdkVersion;
    byId('mono-sdk-guide').hidden = Boolean(catalog.sdkVersion);
  }

  const categoryTemplates = (catalog?.templates || []).filter(template => group === 'all' || template.group === group);
  const languages = [...new Set(categoryTemplates.map(template => template.language).filter(Boolean))].sort();
  const previousLanguage = languageSelect.value;
  languageSelect.replaceChildren(new Option('All languages', ''), ...languages.map(language => new Option(language, language)));
  if (languages.includes(previousLanguage)) languageSelect.value = previousLanguage;
  const query = searchText(search.value.trim());
  visibleTemplates = categoryTemplates.filter(template =>
    (!languageSelect.value || template.language === languageSelect.value) && (!readyOnly.checked || template.ready) &&
    searchText(`${template.label} ${template.language || ''} ${template.description}`).includes(query))
    .sort((first, second) => Number(Boolean(second.ready)) - Number(Boolean(first.ready)));
  if (!visibleTemplates.some(template => template.id === selected)) {
    selected = visibleTemplates[0]?.id;
  }
  const focused = list.contains(document.activeElement) && document.activeElement.dataset.id;
  list.replaceChildren(...visibleTemplates.map(templateButton));
  if (focused) [...list.children].find(button => button.dataset.id === focused)?.focus();

  const status = byId('catalog-status');
  if (loading) status.textContent = 'Detecting templates…';
  else if (visibleTemplates.length) status.textContent = '';
  else if (query || languageSelect.value) status.textContent = 'No templates match your filters.';
  else if (group === 'zip' && catalog?.zipDirectory && !catalog.zipError) status.textContent = 'No ZIP files in this folder.';
  else if (group === 'monogame' || group === 'zip') status.textContent = '';
  else if (readyOnly.checked) status.textContent = 'No templates are ready in this category. Clear Ready to use to see setup options.';
  else status.textContent = 'No templates available.';
  status.hidden = !status.textContent;
  updateForm();
}

function clearMessage() {
  errorMessage.hidden = true;
  byId('show-output').hidden = true;
  operation.hidden = true;
}

function startOperation(type, message, fields) {
  clearMessage();
  pending = true;
  operation.textContent = message;
  operation.hidden = false;
  updateForm();
  vscode.postMessage({ type, location: locationInput.value.trim(), ...fields });
}

function refresh(type = 'refresh') {
  loading = true;
  updateCatalog();
  vscode.postMessage({ type, location: locationInput.value.trim() });
}

categories.addEventListener('click', event => {
  const button = event.target.closest('button[data-group]');
  if (!button) return;
  group = button.dataset.group;
  search.value = '';
  languageSelect.value = '';
  updateCatalog();
});
list.addEventListener('click', event => {
  const button = event.target.closest('button[data-id]');
  if (!button) return;
  selected = button.dataset.id;
  updateForm();
});
search.addEventListener('input', updateCatalog);
languageSelect.addEventListener('change', updateCatalog);
readyOnly.addEventListener('change', updateCatalog);
buildChoiceSelect.addEventListener('change', () => {
  updateDependencyField();
  updateForm();
});
targetChoices.addEventListener('change', updateForm);
executableIcon.addEventListener('change', updateForm);
byId('choose-executable-icons').addEventListener('click', () => {
  clearMessage();
  vscode.postMessage({ type: 'chooseExecutableIcons', templateId: selected });
});
environmentSelect.addEventListener('change', () => {
  updateVersionSuggestions();
  updateForm();
});
pythonVersion.addEventListener('input', updateForm);
byId('testing').addEventListener('change', updateTestFrameworkField);
byId('python-manager-guide').addEventListener('click', () => {
  vscode.postMessage({ type: 'setupGuide', toolId: byId('python-manager-guide').dataset.toolId });
});
nameInput.addEventListener('input', () => {
  clearMessage();
  updateForm();
});
locationInput.addEventListener('input', () => {
  editedLocation = true;
  clearMessage();
  checkGitLocation(180);
  updateForm();
});
locationInput.addEventListener('change', () => refresh('locationChanged'));
initializeGit.addEventListener('change', () => { gitOverride = initializeGit.checked; });
byId('git-setup-guide').addEventListener('click', () => vscode.postMessage({ type: 'setupGuide', toolId: 'git' }));
byId('refresh').addEventListener('click', () => refresh());
byId('settings').addEventListener('click', openSettings);
byId('cancel-settings').addEventListener('click', () => settingsDialog.close());
settingsSearch.addEventListener('input', filterSettingsTemplates);
for (const [list, key] of [[settingsLanguages, 'disabledLanguages'], [settingsTemplates, 'disabledTemplates']]) {
  list.addEventListener('change', ({ target }) => {
    const disabled = catalogDraft[key];
    if (target.checked) disabled.delete(target.value);
    else disabled.add(target.value);
  });
}
settingsDialog.addEventListener('cancel', event => {
  if (byId('save-settings').disabled) event.preventDefault();
});
byId('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  if (byId('save-settings').disabled) return;
  const settings = {
    disabledLanguages: [...catalogDraft.disabledLanguages].sort(),
    disabledTemplates: [...catalogDraft.disabledTemplates].sort(),
    enableVrTemplates: byId('enable-vr').checked,
    enableLatexTemplates: byId('enable-latex').checked,
    openOnStartup: byId('open-on-startup').checked
  };
  setSettingsSaving(true);
  byId('settings-error').hidden = true;
  vscode.postMessage({ type: 'saveCatalogSettings', settings });
});
byId('browse').addEventListener('click', () => vscode.postMessage({ type: 'browse', location: locationInput.value.trim() }));
byId('choose-zip').addEventListener('click', () => vscode.postMessage({ type: 'chooseZip' }));
byId('show-output').addEventListener('click', () => vscode.postMessage({ type: 'showOutput' }));
byId('install').addEventListener('click', () => startOperation('install', 'Installing MonoGame templates…'));
byId('mono-sdk-guide').addEventListener('click', () => vscode.postMessage({ type: 'setupGuide', toolId: 'dotnet' }));
byId('setup-tools').addEventListener('click', event => {
  const button = event.target.closest('button[data-setup]');
  if (button) vscode.postMessage({ type: button.dataset.setup, toolId: button.dataset.toolId });
});
byId('project-form').addEventListener('submit', event => {
  event.preventDefault();
  if (byId('create').disabled) return;
  startOperation('create', 'Creating project…', {
    templateId: selected, name: nameInput.value, openMode: openMode.value, options: selectedOptions(),
    initializeGit: gitStatus?.error ? false : gitOverride
  });
});
recentList.addEventListener('click', event => {
  const button = event.target.closest('button[data-project-id]');
  if (!button || pending) return;
  byId('recent-error').hidden = true;
  pending = true;
  updateForm();
  vscode.postMessage({ type: 'openRecentProject', projectId: button.dataset.projectId });
});

window.addEventListener('message', ({ data }) => {
  switch (data.type) {
    case 'catalog': {
      const firstCatalog = !catalog;
      catalog = data;
      loading = false;
      byId('workspace-mode').hidden = !data.hasWorkspace;
      if (firstCatalog && data.openMode) openMode.value = data.openMode;
      if (!editedLocation && !locationInput.value) locationInput.value = data.parent;
      checkGitLocation();
      byId('toolchain-status').textContent = data.detected.length ? `Detected toolchains (${data.detected.length})` : 'No toolchains detected';
      byId('toolchain-list').replaceChildren(...data.detected.map(tool => {
        const item = document.createElement('li');
        item.textContent = `${tool.label} ${tool.version}${tool.usable === false ? ' (update needed)' : ''}`;
        item.title = tool.file;
        return item;
      }));
      const frameworks = byId('frameworks');
      frameworks.textContent = data.frameworks.length ? `In workspace: ${data.frameworks.join(', ')}` : '';
      frameworks.hidden = !data.frameworks.length;
      updateCatalog();
      break;
    }
    case 'location':
      locationInput.value = data.location;
      if (data.openMode) openMode.value = data.openMode;
      editedLocation = true;
      clearMessage();
      checkGitLocation();
      updateForm();
      break;
    case 'gitLocation':
      if (data.requestId !== gitRequest) break;
      gitStatus = data;
      updateForm();
      break;
    case 'executableIcons':
      executableIconNames = data.names;
      updateForm();
      break;
    case 'recentProjects':
      renderRecentProjects(data.projects);
      break;
    case 'recentProjectError':
      byId('recent-error').textContent = data.message;
      byId('recent-error').hidden = false;
      pending = false;
      updateForm();
      break;
    case 'recentProjectOpened':
      pending = false;
      updateForm();
      break;
    case 'setupFeedback':
      byId('setup-feedback').textContent = data.message;
      byId('setup-feedback').hidden = false;
      break;
    case 'catalogSettingsSaved':
      setSettingsSaving(false);
      settingsDialog.close();
      break;
    case 'catalogSettingsError':
      setSettingsSaving(false);
      byId('settings-error').textContent = data.message;
      byId('settings-error').hidden = false;
      break;
    case 'success':
      pending = false;
      operation.textContent = data.message;
      operation.hidden = false;
      updateForm();
      break;
    case 'error':
      pending = false;
      loading = false;
      clearMessage();
      errorMessage.textContent = data.message;
      errorMessage.hidden = false;
      byId('show-output').hidden = false;
      updateCatalog();
      break;
  }
});

vscode.postMessage({ type: 'ready' });
