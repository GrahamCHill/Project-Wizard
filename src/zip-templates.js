const { createWriteStream } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Transform } = require('node:stream');
const { buffer } = require('node:stream/consumers');
const { pipeline } = require('node:stream/promises');
const crc32 = require('buffer-crc32');
const yauzl = require('yauzl');
const { existingDirectory, isPortablePathPart, replaceTokens } = require('./projects');

const maxFiles = 10000;
const maxBytes = 1024 ** 3;
const maxTextBytes = 1024 ** 2;
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

async function listZipTemplates(configuredPath) {
  if (!configuredPath) return { templates: [], directory: '' };
  try {
    const directory = await existingDirectory(configuredPath);
    const files = await fs.readdir(directory, { withFileTypes: true });
    const templates = files.filter(file => file.isFile() && /\.zip$/i.test(file.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ name }) => ({
        id: `zip:${name}`, group: 'zip', kind: 'zip', archive: path.join(directory, name),
        label: name.slice(0, -4) || name, language: 'ZIP', description: name,
        requirement: 'Uses the files in this archive as the starting point for your project.',
        next: 'Follow any setup instructions included in the archive.'
      }));
    return { templates, directory: configuredPath };
  } catch (error) {
    return { templates: [], directory: configuredPath, error: error.message };
  }
}

async function readEntries(zip) {
  if (zip.entryCount > maxFiles) throw new Error('The ZIP contains more than 10,000 entries.');
  const entries = [];
  let size = 0;
  for await (const entry of zip.eachEntry()) {
    const mode = entry.externalFileAttributes >>> 16;
    const fileType = mode & 0o170000;
    const directory = entry.fileName.endsWith('/') || fileType === 0o040000 ||
      Boolean(entry.externalFileAttributes & 0x10);
    if ((fileType && fileType !== 0o040000 && fileType !== 0o100000) ||
        entry.externalFileAttributes & 0x400) {
      throw new Error(`The ZIP contains a link or special file: ${entry.fileName}`);
    }
    if (entry.generalPurposeBitFlag & 1) throw new Error('Password-protected ZIP entries are unsupported.');
    const parts = entry.fileName.replace(/\/$/, '').split('/');
    if (!parts.every(isPortablePathPart)) throw new Error(`Invalid path in ZIP: ${entry.fileName}`);
    if (parts[0] === '__MACOSX' || parts.at(-1) === '.DS_Store') continue;
    size += entry.uncompressedSize;
    if (size > maxBytes) throw new Error('The ZIP expands to more than 1 GiB.');
    entries.push({ entry, parts, directory, mode: (mode & 0o111) ? 0o755 : 0o644 });
  }
  if (!entries.length) throw new Error('The ZIP contains no project files or folders.');
  return entries;
}

function planExtraction(entries, name, project) {
  const root = entries[0].parts[0];
  const stripRoot = entries.some(item => item.parts.length > 1) && entries.every(item =>
    item.parts[0] === root && (item.parts.length > 1 || item.directory));
  const seen = new Map();
  const plan = [];

  for (const item of entries) {
    const parts = (stripRoot ? item.parts.slice(1) : item.parts).map(part => replaceTokens(part, name));
    if (!parts.length) continue;
    if (!parts.every(isPortablePathPart)) throw new Error(`Invalid template output path: ${parts.join('/')}`);

    for (let i = 0; i < parts.length; i++) {
      const relative = parts.slice(0, i + 1).join('/');
      const directory = i < parts.length - 1 || item.directory;
      const key = relative.normalize('NFC').toLowerCase();
      const existing = seen.get(key);
      if (existing && (existing.relative !== relative || !existing.directory || !directory)) {
        throw new Error(`Conflicting paths in ZIP: ${relative}`);
      }
      seen.set(key, { relative, directory });
    }
    plan.push({ ...item, target: path.join(project, ...parts) });
  }
  return plan;
}

function substituteText(data, name) {
  if (data.includes(0) || !['__PROJECT_NAME__', '__PROJECT_IDENTIFIER__', '__PROJECT_SLUG__'].some(token => data.includes(token))) {
    return data;
  }
  let text;
  try {
    text = utf8.decode(data);
  } catch {
    return data;
  }
  return replaceTokens(text, name);
}

function verifyChecksum(entry) {
  let checksum = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      checksum = crc32.unsigned(chunk, checksum);
      callback(null, chunk);
    },
    flush(callback) {
      callback(checksum === entry.crc32 ? undefined : new Error(`Corrupt ZIP entry: ${entry.fileName}`));
    }
  });
}

async function extractZipTemplate(archive, project, name) {
  const zip = await yauzl.openPromise(archive, { autoClose: false, lazyEntries: true });
  try {
    const entries = await readEntries(zip);
    for (const { entry, target, directory, mode } of planExtraction(entries, name, project)) {
      if (directory) {
        await fs.mkdir(target, { recursive: true });
        continue;
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      const stream = await zip.openReadStreamPromise(entry);
      if (entry.uncompressedSize <= maxTextBytes) {
        const data = await buffer(stream);
        if (crc32.unsigned(data) !== entry.crc32) throw new Error(`Corrupt ZIP entry: ${entry.fileName}`);
        await fs.writeFile(target, substituteText(data, name), { flag: 'wx', mode });
      } else {
        await pipeline(stream, verifyChecksum(entry), createWriteStream(target, { flags: 'wx', mode }));
      }
    }
  } finally {
    zip.close();
  }
}

module.exports = { extractZipTemplate, listZipTemplates };
