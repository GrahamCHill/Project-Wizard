function readCatalogSettings(value) {
  const strings = values => Array.isArray(values) ? [...new Set(values.filter(item => typeof item === 'string' && item))] : [];
  const disabled = new Set(strings(value?.disabledTemplates));
  for (const id of disabled) {
    const suffix = id.match(/^sdl2(-(?:(?:opengl|vulkan)-)?(?:c|cpp))$/)?.[1];
    if (suffix && disabled.has('sdl3' + suffix)) {
      disabled.delete(id);
      disabled.delete('sdl3' + suffix);
      disabled.add('sdl' + suffix);
    }
  }
  return {
    disabledLanguages: strings(value?.disabledLanguages),
    disabledTemplates: [...disabled],
    enableVrTemplates: value?.enableVrTemplates === true,
    enableLatexTemplates: value?.enableLatexTemplates === true,
    openOnStartup: value?.openOnStartup === true
  };
}

function enabledTemplates(templates, settings) {
  const languages = new Set(settings.disabledLanguages);
  const disabled = new Set(settings.disabledTemplates);
  return templates.filter(template => !languages.has(template.language) && !disabled.has(template.id) &&
    (template.group !== 'vr' || settings.enableVrTemplates) &&
    (template.language !== 'LaTeX' || settings.enableLatexTemplates)).flatMap(template => {
    if (!template.variants) return [template];
    const variants = template.variants.filter(variant => !languages.has(variant.language));
    return variants.length ? [{ ...template, variants }] : [];
  });
}

module.exports = { readCatalogSettings, enabledTemplates };
