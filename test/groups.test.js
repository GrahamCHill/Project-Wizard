const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { test } = require('node:test');
const { categories, displayGroup, mergedGroups } = require('../src/groups');
const { starters } = require('../src/starters');
const { generatorRegistry } = require('../clion/generators');

const read = file => fs.readFile(path.join(__dirname, '..', file), 'utf8');
const ids = categories.map(category => category.id);

test('merges related groups into one category and leaves the rest alone', () => {
  for (const group of ['graphics', 'games', 'monogame', 'raylib']) assert.equal(displayGroup(group), 'games', group);
  for (const group of ['desktop', 'mobile']) assert.equal(displayGroup(group), 'apps', group);
  for (const group of ['frontend', 'server']) assert.equal(displayGroup(group), 'web', group);
  for (const group of ['docker', 'infrastructure']) assert.equal(displayGroup(group), 'cloud', group);
  for (const group of ['cli', 'systems', 'blender', 'ai', 'documents', 'vr', 'misc', 'zip', 'general']) assert.equal(displayGroup(group), group, group);
  // Merging must never send a template to a category that is not listed.
  for (const target of Object.values(mergedGroups)) assert.ok(ids.includes(target), target);
});

test('every template lands in a listed category, so nothing is hidden by the merge', () => {
  const listed = new Set([...ids, 'general']); // "general" templates show under All Templates only
  for (const template of starters) assert.ok(listed.has(displayGroup(template.group)), `${template.id} is in ${template.group}`);
  const used = new Set(starters.map(template => displayGroup(template.group)));
  for (const id of ['cli', 'apps', 'games', 'blender', 'ai', 'web', 'cloud', 'misc']) assert.ok(used.has(id), `no template is in ${id}`);
});

test('the category list has no duplicates and starts with All Templates', () => {
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids[0], 'all');
  assert.deepEqual(categories.filter(category => category.hidden).map(category => category.id), ['systems', 'documents', 'vr']);
});

test('the extension builds its category buttons from the shared list', async () => {
  const extension = await read('src/extension.js');
  assert.match(extension, /require\('\.\/groups'\)/);
  assert.match(extension, /categories\.map\(/);
  assert.doesNotMatch(extension, /data-group="(?:raylib|monogame|graphics|frontend|server|docker|infrastructure|desktop|mobile)"/, 'old buttons are gone');
  assert.match(extension, /group: displayGroup\(template\.group\)/, 'the catalog sends merged groups');
});

test('the webview titles match the shared category titles and it knows the hidden categories', async () => {
  const webview = await read('media/wizard.js');
  const titles = Object.fromEntries([...webview.slice(webview.indexOf('const groupTitles'), webview.indexOf('};', webview.indexOf('const groupTitles')))
    .matchAll(/(\w+): '([^']+)'/g)].map(match => [match[1], match[2]]));
  for (const { id, title } of categories) if (id !== 'all') assert.equal(titles[id], title, id);
  for (const id of ['vr', 'documents', 'systems']) assert.match(webview, new RegExp(`data-group="${id}"`));
  assert.match(webview, /byId\('mono-setup'\)\.hidden = group !== 'games'/, 'the MonoGame setup panel follows MonoGame into Games');
  assert.doesNotMatch(webview, /group === 'monogame'|group === 'docker'|group !== 'monogame'/);
});

test('every group the CLion registry uses has a matching constant in its Java enum', async () => {
  const java = await read('clion/src/main/java/com/grahamchill/projectwizard/WizardGroup.java');
  const constants = new Set([...java.matchAll(/^\s+([A-Z]+)\("/gm)].map(match => match[1]));
  const groups = new Set(generatorRegistry().map(entry => entry.group));
  for (const group of groups) assert.ok(constants.has(group.toUpperCase()), `WizardGroup.${group.toUpperCase()} is missing`);
  assert.ok(groups.has('games') && groups.has('cloud') && groups.has('web') && groups.has('apps'));
  for (const old of ['RAYLIB', 'GRAPHICS', 'FRONTEND', 'SERVER', 'DOCKER', 'INFRASTRUCTURE', 'DESKTOP', 'MOBILE']) {
    assert.ok(!constants.has(old), `${old} should be merged away`);
  }
});
