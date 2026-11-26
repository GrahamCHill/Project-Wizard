const { starters } = require('../src/starters');
const { templatesForPlatform } = require('../src/toolchains');
const { displayGroup } = require('../src/groups');

const packageName = 'com.grahamchill.projectwizard';
const builtIn = new Set(['empty', 'c-cmake', 'cpp-cmake', 'cuda-cmake', 'cuda-library']);
const nativeNames = {
  'javascript-server': ['Node.js'],
  qt: ['Qt Widgets Executable'],
  'react-native-mobile': ['React Native'],
  'rust-cli': ['Rust'],
  'typescript-frontend': ['Vite']
};
const platforms = ['win32', 'darwin', 'linux'];

function generatorRegistry() {
  const supported = platforms.map(platform => new Set(templatesForPlatform(starters, platform).map(template => template.id)));
  const generators = starters.filter(template => !builtIn.has(template.id)).map(({ id, label, group }) => ({
    id, label, group: displayGroup(group),
    platforms: platforms.filter((_platform, index) => supported[index].has(id)),
    names: [label, ...(nativeNames[id] || [])]
  }));
  generators.push({ id: null, label: 'Custom ZIP and MonoGame Templates', group: 'custom', platforms, names: [] });
  return generators;
}

function generatorSources() {
  const javaString = value => JSON.stringify(value);
  const javaList = items => `java.util.List.of(${items.map(javaString).join(', ')})`;
  const entries = generatorRegistry().map(({ id, label, group, platforms, names }, index) => ({
    source: `    public static final class Entry${index} extends ProjectWizardGenerator {
        public Entry${index}() { super(${javaString(id)}, ${javaString(label)}, WizardGroup.${group.toUpperCase()}, ${javaList(platforms)}, ${javaList(names)}); }
    }`,
    extension: `    <directoryProjectGenerator implementation="${packageName}.TemplateGenerators$Entry${index}"/>`
  }));
  return {
    source: `package ${packageName};\n\npublic final class TemplateGenerators {\n${entries.map(entry => entry.source).join('\n')}\n}\n`,
    extensions: entries.map(entry => entry.extension).join('\n')
  };
}

module.exports = { generatorRegistry, generatorSources };
