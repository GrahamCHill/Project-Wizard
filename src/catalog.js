function readCatalogSettings(value) {
  const strings = values => Array.isArray(values) ? [...new Set(values.filter(item => typeof item === 'string' && item))] : [];
  return {
    disabledLanguages: strings(value?.disabledLanguages),
    disabledTemplates: strings(value?.disabledTemplates),
    enableVrTemplates: value?.enableVrTemplates === true
  };
}

function enabledTemplates(templates, settings) {
  const languages = new Set(settings.disabledLanguages);
  const disabled = new Set(settings.disabledTemplates);
  return templates.filter(template => !languages.has(template.language) && !disabled.has(template.id) &&
    (template.group !== 'vr' || settings.enableVrTemplates));
}

module.exports = { readCatalogSettings, enabledTemplates };
