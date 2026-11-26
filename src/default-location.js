const path = require('node:path');
const { existingDirectory } = require('./projects');

const defaultLocationKey = 'projectWizard.defaultLocation';

function readDefaultLocation(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Chooses the folder the wizard starts in. A folder the user opened the wizard from always wins. Next
// comes the saved default, but only while it still exists, so a deleted or unmounted folder cannot
// leave the wizard pointing nowhere. Then the first workspace folder and finally the home folder.
async function startLocation({ requested, saved, workspace, home }) {
  if (requested) return requested;
  const location = readDefaultLocation(saved);
  const usable = location ? await existingDirectory(location).then(() => path.resolve(location), () => undefined) : undefined;
  return usable || workspace || home;
}

// Returns the normalized folder to store, or throws a message that the wizard shows to the user.
async function validateDefaultLocation(value) {
  const location = readDefaultLocation(value);
  if (!location) throw new Error('Enter a location to save as the default.');
  await existingDirectory(location);
  return path.resolve(location);
}

module.exports = { defaultLocationKey, readDefaultLocation, startLocation, validateDefaultLocation };
