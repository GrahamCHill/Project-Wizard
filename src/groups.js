// Templates keep a precise group, such as "raylib" or "docker", because packaging and icon code depends on it.
// The wizard's category list is shorter: related groups are shown together. This module is the single place that
// says which. The extension, the webview, and the CLion plugin all read it, and tests check they agree.

const mergedGroups = {
  graphics: 'games',
  monogame: 'games',
  raylib: 'games',
  desktop: 'apps',
  mobile: 'apps',
  frontend: 'web',
  server: 'web',
  docker: 'cloud',
  infrastructure: 'cloud'
};

// Categories in the order the wizard lists them, with their titles. "hidden" ones appear only when they have a reason to.
const categories = [
  { id: 'all', title: 'All Templates' },
  { id: 'cli', title: 'Command Line' },
  { id: 'systems', title: 'Systems', hidden: true },
  { id: 'apps', title: 'Desktop & Mobile' },
  { id: 'games', title: 'Games & Graphics' },
  { id: 'blender', title: 'Blender' },
  { id: 'ai', title: 'Data & AI' },
  { id: 'documents', title: 'Documents', hidden: true },
  { id: 'vr', title: 'VR', hidden: true },
  { id: 'web', title: 'Web' },
  { id: 'cloud', title: 'Cloud & DevOps' },
  { id: 'misc', title: 'Misc' },
  { id: 'zip', title: 'Custom ZIPs' }
];

/** The category a template appears under. */
function displayGroup(group) {
  return mergedGroups[group] || group;
}

module.exports = { categories, displayGroup, mergedGroups };
