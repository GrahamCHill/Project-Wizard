const maxPixels = 4096 * 4096;

function image(data) {
  return require('sharp')(data, { limitInputPixels: maxPixels });
}

async function validateRaster(data, extension) {
  try {
    const metadata = await image(data).metadata();
    return metadata.format === extension.slice(1) && metadata.width > 0 && metadata.height > 0 &&
      metadata.width <= 4096 && metadata.height <= 4096;
  } catch {
    return false;
  }
}

function rasterIcon(data) {
  const pngCache = new Map();
  const background = { r: 0, g: 0, b: 0, alpha: 0 };

  function resized(size) {
    return image(data).rotate().toColourspace('srgb').ensureAlpha()
      .resize(size, size, { fit: 'contain', background });
  }

  return {
    png(size, { opaque = false, inset = 1 } = {}) {
      const key = [size, opaque, inset].join(':');
      if (!pngCache.has(key)) {
        const inner = Math.round(size * inset);
        const operation = async () => {
          let pixels = resized(inner);
          if (inner < size) {
            const left = Math.floor((size - inner) / 2);
            const right = size - inner - left;
            pixels = pixels.extend({ top: left, bottom: right, left, right, background });
          }
          if (opaque) {
            const padded = await pixels.png().toBuffer();
            pixels = image(padded).flatten({ background: '#ffffff' });
          }
          return Buffer.from(await pixels.png().toBuffer());
        };
        pngCache.set(key, operation());
      }
      return pngCache.get(key);
    },
    async rgba(size) {
      return Buffer.from(await resized(size).raw().toBuffer());
    }
  };
}

async function ico(raster) {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const entries = Buffer.alloc(6 + 16 * sizes.length);
  entries.writeUInt16LE(1, 2);
  entries.writeUInt16LE(sizes.length, 4);
  let offset = entries.length;
  const images = [];
  for (const [index, size] of sizes.entries()) {
    const rowBytes = 4 * Math.ceil(size / 32);
    const rgba = await raster.rgba(size);
    const bitmap = Buffer.alloc(40 + rgba.length + rowBytes * size);
    bitmap.writeUInt32LE(40, 0);
    bitmap.writeInt32LE(size, 4);
    bitmap.writeInt32LE(size * 2, 8);
    bitmap.writeUInt16LE(1, 12);
    bitmap.writeUInt16LE(32, 14);
    bitmap.writeUInt32LE(rgba.length, 20);
    // ICO DIB rows are bottom-up BGRA, followed by a 1-bit transparency mask.
    for (let row = 0; row < size; row++) {
      for (let x = 0; x < size; x++) {
        const source = ((size - row - 1) * size + x) * 4;
        const pixel = 40 + (row * size + x) * 4;
        bitmap[pixel] = rgba[source + 2];
        bitmap[pixel + 1] = rgba[source + 1];
        bitmap[pixel + 2] = rgba[source];
        bitmap[pixel + 3] = rgba[source + 3];
        if (rgba[source + 3] === 0) {
          bitmap[40 + rgba.length + row * rowBytes + (x >> 3)] |= 0x80 >> (x % 8);
        }
      }
    }
    const entry = 6 + index * 16;
    entries[entry] = entries[entry + 1] = size % 256;
    entries.writeUInt16LE(1, entry + 4);
    entries.writeUInt16LE(32, entry + 6);
    entries.writeUInt32LE(bitmap.length, entry + 8);
    entries.writeUInt32LE(offset, entry + 12);
    images.push(bitmap);
    offset += bitmap.length;
  }
  return Buffer.concat([entries, ...images], offset);
}

async function icns(raster) {
  const sizes = { icp4: 16, icp5: 32, icp6: 64, ic07: 128, ic08: 256, ic09: 512, ic10: 1024,
    ic11: 32, ic12: 64, ic13: 256, ic14: 512 };
  const header = Buffer.from('icns\x00\x00\x00\x00');
  const chunks = [header];
  let size = header.length;
  for (const [tag, dimension] of Object.entries(sizes)) {
    const bytes = await raster.png(dimension);
    const chunk = Buffer.alloc(8);
    chunk.write(tag, 0, 'ascii');
    chunk.writeUInt32BE(chunk.length + bytes.length, 4);
    chunks.push(chunk, bytes);
    size += chunk.length + bytes.length;
  }
  header.writeUInt32BE(size, 4);
  return Buffer.concat(chunks, size);
}

async function iconVariants(icons, formats) {
  const source = icons.get('.png') || icons.get('.webp');
  const outputs = new Map([...icons].filter(([format]) => format === '.ico' || format === '.icns'));
  const raster = source && rasterIcon(source.data);
  if (raster && formats.includes('.ico') && !outputs.has('.ico')) outputs.set('.ico', { data: await ico(raster) });
  if (raster && formats.includes('.icns') && !outputs.has('.icns')) outputs.set('.icns', { data: await icns(raster) });
  return { outputs, raster };
}

module.exports = { iconVariants, validateRaster };
