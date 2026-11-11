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
const projectSetup = byId('project-options');
const environmentSelect = byId('python-environment');
const environmentNow = byId('create-environment');
const errorMessage = byId('error');
const operation = byId('operation');
const groupTitles = {
  all: 'Templates', cli: 'Command Line', desktop: 'Desktop', mobile: 'Mobile', frontend: 'Web Frontend', server: 'Web Server',
  monogame: 'MonoGame', raylib: 'Raylib', zip: 'Custom ZIPs'
};

let catalog;
let group = 'all';
let selected;
let visibleTemplates = [];
let pending = false;
let loading = true;
let editedLocation = false;
let renderedSelection;
let optionTemplate;

function setupButton(label, action, toolId) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary';
  button.textContent = label;
  button.dataset.setup = action;
  button.dataset.toolId = toolId;
  return button;
}

function renderSetup(template) {
  if (renderedSelection === template) return;
  renderedSelection = template;
  const missing = template?.missing || [];
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

function pythonEnvironmentChanged() {
  const options = optionTemplate?.options;
  const environment = options?.environments?.find(item => item.id === environmentSelect.value);
  const existing = environment?.id === 'none';
  const unavailable = !existing && !environment?.available;
  environmentNow.disabled = existing || unavailable;
  if (environmentNow.disabled) environmentNow.checked = false;
  byId('python-version-field').hidden = existing;
  const help = byId('python-environment-help');
  help.textContent = unavailable ? 'Setup is required before the wizard can create this environment.' :
    ['uv', 'conda'].includes(environment?.id) ? 'The manager can install the requested Python version.' : '';
  help.hidden = !help.textContent;
  const guide = byId('python-manager-guide');
  guide.hidden = !unavailable || !environment?.tool;
  guide.dataset.toolId = environment?.tool || '';
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
    byId('python-version').value = '';
    environmentNow.checked = false;
  }
  byId('python-options').hidden = options.type !== 'python';
  if (options.type === 'python') {
    const environment = preserve ? environmentSelect.value : options.defaultEnvironment;
    environmentSelect.replaceChildren(...options.environments.map(item =>
      new Option(item.label + (item.available === false ? ' (setup needed)' : ''), item.id)));
    environmentSelect.value = environment || options.defaultEnvironment;
    byId('python-versions').replaceChildren(...options.versions.map(version => new Option(version)));
    pythonEnvironmentChanged();
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
  byId('dependency-options').hidden = !options.dependencies;
  byId('dependencies-label').textContent = options.dependencies || '';
  byId('dependencies').placeholder = options.example || '';
  byId('testing-option').hidden = !options.test;
  byId('testing-label').textContent = options.test || '';
}

function selectedOptions() {
  if (!optionTemplate?.options) return;
  return {
    environment: environmentSelect.value,
    pythonVersion: byId('python-version').value,
    createEnvironment: environmentNow.checked,
    testing: byId('testing').checked,
    dependencies: byId('dependencies').value,
    libraries: [...byId('library-choices').querySelectorAll('input:checked')].map(input => input.value)
  };
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
  byId('selected-requirement').textContent = template?.requirement || '';
  byId('selected-requirement').hidden = !template?.requirement;
  renderSetup(template);
  renderProjectOptions(template);
  for (const button of list.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.id === selected));
  }

  byId('create').disabled = pending || !template || template.disabled || !name.trim() || !location;
  byId('refresh').disabled = pending || loading;
  for (const control of [nameInput, locationInput, openMode, byId('browse'), byId('choose-zip'), byId('install')]) {
    control.disabled = pending;
  }
  for (const button of document.querySelectorAll('[data-setup]')) button.disabled = pending;
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
  const query = search.value.trim().toLowerCase();
  visibleTemplates = categoryTemplates.filter(template =>
    (!languageSelect.value || template.language === languageSelect.value) && (!readyOnly.checked || template.ready) &&
    `${template.label} ${template.language || ''} ${template.description}`.toLowerCase().includes(query))
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
environmentSelect.addEventListener('change', pythonEnvironmentChanged);
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
  updateForm();
});
locationInput.addEventListener('change', () => refresh('locationChanged'));
byId('refresh').addEventListener('click', () => refresh());
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
    templateId: selected, name: nameInput.value, openMode: openMode.value, options: selectedOptions()
  });
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
      updateForm();
      break;
    case 'setupFeedback':
      byId('setup-feedback').textContent = data.message;
      byId('setup-feedback').hidden = false;
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
