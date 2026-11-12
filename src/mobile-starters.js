const fs = require('node:fs/promises');
const path = require('node:path');
const { replaceTokens } = require('./projects');

async function writeMobileSources(project, name, files) {
  for (const [source, destination] of files) {
    const text = await fs.readFile(path.join(__dirname, '..', 'templates', source), 'utf8');
    await fs.writeFile(path.join(project, destination), replaceTokens(text, name));
  }
}

module.exports = { writeMobileSources };
