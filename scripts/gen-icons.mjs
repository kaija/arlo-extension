#!/usr/bin/env node
/**
 * Writes placeholder PNG icons with no image dependencies — zlib and a CRC are
 * all a valid PNG needs. Replace public/icons/* with the real artwork when the
 * visual design lands; this only exists so the extension loads.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SIZES = [16, 32, 48, 128];
const OUT_DIR = resolve(process.cwd(), 'public/icons');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  const radius = size * 0.18;
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4); // leading filter byte 0
    for (let x = 0; x < size; x += 1) {
      const inset = Math.min(x, y, size - 1 - x, size - 1 - y) < radius * 0.35 ? 0 : 1; // rounded corners
      const glyph = Math.abs(x - size / 2) + Math.abs(y - size / 2) < size * 0.28;
      const offset = 1 + x * 4;
      const [r, g, b] = glyph ? [255, 255, 255] : [51, 85, 230];
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
      row[offset + 3] = inset ? 255 : 0;
    }
    rows.push(row);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = resolve(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, png(size));
  console.log(`✓ ${file}`);
}
