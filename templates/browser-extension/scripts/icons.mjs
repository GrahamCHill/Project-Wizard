// Draws the toolbar icons with no image library, so the project needs no binary files in Git.
// Replace this with your own artwork by putting PNG files in src/icons/. The build copies them over these.
import { deflateSync, crc32 } from 'node:zlib';

const ORANGE = [232, 89, 12];
const WHITE = [255, 255, 255];

/** Returns a color for a pixel, or null outside the icon. The icon is a rounded square with three lines of text. */
function pixel(x, y, size) {
  const u = (x + 0.5) / size;
  const v = (y + 0.5) / size;
  const radius = 0.22;
  const dx = Math.max(Math.abs(u - 0.5) - (0.5 - radius), 0);
  const dy = Math.max(Math.abs(v - 0.5) - (0.5 - radius), 0);
  if (dx * dx + dy * dy > radius * radius) return null;
  for (const [top, right] of [[0.28, 0.76], [0.46, 0.76], [0.64, 0.56]]) {
    if (v >= top && v < top + 0.1 && u >= 0.24 && u < right) return WHITE;
  }
  return ORANGE;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** Encodes a square RGBA PNG. */
export function createPng(size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // the first byte is the filter type, 0 for none
    for (let x = 0; x < size; x++) {
      const color = pixel(x, y, size);
      row.set(color ? [...color, 255] : [0, 0, 0, 0], 1 + x * 4);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

export const iconSizes = [16, 32, 48, 128];
