#!/usr/bin/env node
/**
 * Draws the Arlo brand mark into public/icons/*.png.
 *
 * The geometry is the design system's assets/arlo-mark.svg, transcribed exactly:
 * a 28x28 rounded square (rx 7) in --color-accent, with the "A" drawn as three
 * round-capped 2.5-unit strokes rather than set in type.
 *
 * No image dependencies: zlib and a CRC are all a valid PNG needs. The shapes
 * are signed distances, supersampled, so the 16px toolbar icon has clean edges.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SIZES = [16, 32, 48, 128];
const OUT_DIR = resolve(process.cwd(), 'public/icons');

/** --color-accent, from the design system's tokens/colors.css. */
const ACCENT = [0x58, 0x56, 0xd6];
const SAMPLES = 4;

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

/** Distance from p to the segment ab, negative inside a stroke of that radius. */
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  const t =
    length2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * The mark, in the SVG's own 28-unit space:
 *   <rect width=28 height=28 rx=7 fill=#5856D6>
 *   <path d="M8 20L14 8L20 20" stroke-width=2.5 round>
 *   <path d="M10.6 15.4H17.4"  stroke-width=2.5 round>
 */
const UNITS = 28;
const STROKE = 2.5 / 2;

function coverage(u, v) {
  const x = u * UNITS;
  const y = v * UNITS;

  // Rounded square: rx 7 of 28.
  const r = 7;
  const qx = Math.abs(x - 14) - (14 - r);
  const qy = Math.abs(y - 14) - (14 - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  if (outside > 0) return null;

  const legs = Math.min(segmentDistance(x, y, 8, 20, 14, 8), segmentDistance(x, y, 14, 8, 20, 20));
  const bar = segmentDistance(x, y, 10.6, 15.4, 17.4, 15.4);
  return Math.min(legs, bar) - STROKE < 0 ? 'glyph' : 'field';
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4); // leading filter byte 0
    for (let x = 0; x < size; x += 1) {
      let covered = 0;
      let glyph = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const hit = coverage(
            (x + (sx + 0.5) / SAMPLES) / size,
            (y + (sy + 0.5) / SAMPLES) / size,
          );
          if (hit === null) continue;
          covered += 1;
          if (hit === 'glyph') glyph += 1;
        }
      }

      const total = SAMPLES * SAMPLES;
      const offset = 1 + x * 4;
      if (covered === 0) continue; // transparent, already zeroed
      // Blend the white glyph over the accent field, then apply shape coverage.
      const mix = glyph / covered;
      row[offset] = Math.round(ACCENT[0] + (255 - ACCENT[0]) * mix);
      row[offset + 1] = Math.round(ACCENT[1] + (255 - ACCENT[1]) * mix);
      row[offset + 2] = Math.round(ACCENT[2] + (255 - ACCENT[2]) * mix);
      row[offset + 3] = Math.round((covered / total) * 255);
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
