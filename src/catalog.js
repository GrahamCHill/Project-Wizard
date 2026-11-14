function readCatalogSettings(value) {
  const strings = values => Array.isArray(values) ? [...new Set(values.filter(item => typeof item === 'string' && item))] : [];
  const disabled = new Set(strings(value?.disabledTemplates));
  const sdlSuffixes = ['', '-opengl', '-vulkan'].flatMap(renderer => ['-c', '-cpp'].map(language => renderer + language));
  if (sdlSuffixes.every(suffix => disabled.has('sdl' + suffix) ||
      (disabled.has('sdl2' + suffix) && disabled.has('sdl3' + suffix)))) {
    for (const suffix of sdlSuffixes) {
      for (const prefix of ['sdl', 'sdl2', 'sdl3']) disabled.delete(prefix + suffix);
    }
    disabled.add('sdl');
  }
  if (disabled.has('qt-widgets') && disabled.has('qt-quick')) {
    disabled.delete('qt-widgets');
    disabled.delete('qt-quick');
    disabled.add('qt');
  }
  const mixed = ['vulkan', 'opengl', 'directx'].map(renderer => 'sdl3-' + renderer + '-csharp-cpp-lua');
  if (mixed.every(id => disabled.has(id))) {
    for (const id of mixed) disabled.delete(id);
    disabled.add('mixed-graphics-csharp-cpp-lua');
  }
  return {
    disabledLanguages: strings(value?.disabledLanguages),
    disabledTemplates: [...disabled],
    enableVrTemplates: value?.enableVrTemplates === true,
    enableLatexTemplates: value?.enableLatexTemplates === true,
    hideUnavailableTemplates: value?.hideUnavailableTemplates !== false,
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
