#!/usr/bin/env node
// Erzeugt die App-Icons aus der Erdbeer-Herz-Praline (prShape Typ 1 in index.html)
// auf cremefarbenem Grund. Keine Abhängigkeiten – nur Node (>= 18).
//
//   node tools/make-icons.mjs
//
// Ausgabe: icons/icon-192.png, icon-512.png, icon-maskable-512.png,
//          apple-touch-icon.png (180), favicon.png (48)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const BG = [0xfb, 0xee, 0xe6];   // --bg
const ROSE = [0xff, 0x5c, 0x8a]; // PR[1].c
const SS = 4;                    // Supersampling je Achse

// Herz-Pfad aus prShape(1, r), in Einheiten von r:
// M0 .95 C-1.4 -.05 -.65 -1.15 0 -.4 C.65 -1.15 1.4 -.05 0 .95 Z
const CURVES = [
  [[0, .95], [-1.4, -.05], [-.65, -1.15], [0, -.4]],
  [[0, -.4], [.65, -1.15], [1.4, -.05], [0, .95]],
];
const POLY = [];
for (const [a, b, c, d] of CURVES) {
  for (let k = 0; k < 48; k++) {
    const t = k / 48, u = 1 - t;
    POLY.push([0, 1].map((i) => u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i]));
  }
}
const ys = POLY.map((p) => p[1]);
const CY = (Math.min(...ys) + Math.max(...ys)) / 2; // optische Mitte des Herzens
const STROKE_W = .1, STROKE_A = .28;                // Kontur rgba(0,0,0,.28), fürs Icon etwas feiner als im Spiel
const HL = { cx: -.3, cy: -.45, rx: .32, ry: .16, a: .38 };

function inside(x, y) {
  let c = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, yi] = POLY[i], [xj, yj] = POLY[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function dist2(x, y) {
  let m = Infinity;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [ax, ay] = POLY[j], [bx, by] = POLY[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const ex = x - ax - t * dx, ey = y - ay - t * dy;
    m = Math.min(m, ex * ex + ey * ey);
  }
  return m;
}
const mix = (c, o, a) => c.map((v, i) => v + (o[i] - v) * a);

// Farbe an Position (x, y) in r-Einheiten, Ebenen wie im SVG: Füllung, Kontur, Glanzlicht.
function sample(x, y) {
  if (Math.abs(x) > 1.2 || y < -1 || y > 1.2) return BG;
  const inH = inside(x, y);
  let c = inH ? ROSE : BG;
  if (dist2(x, y) <= (STROKE_W / 2) ** 2) c = mix(c, [0, 0, 0], STROKE_A);
  // Glanzlicht auf das Herz begrenzt, damit es nicht auf den Hintergrund ragt
  if (inH && ((x - HL.cx) / HL.rx) ** 2 + ((y - HL.cy) / HL.ry) ** 2 <= 1) c = mix(c, [255, 255, 255], HL.a);
  return c;
}

// size: Kantenlänge in px, scale: Herz-Radius r als Anteil der Kantenlänge
function render(size, scale) {
  const r = size * scale, px = Buffer.alloc(size * size * 3);
  for (let Y = 0; Y < size; Y++) for (let X = 0; X < size; X++) {
    const acc = [0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const c = sample((X + (sx + .5) / SS - size / 2) / r, (Y + (sy + .5) / SS - size / 2) / r + CY);
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    const o = (Y * size + X) * 3;
    for (let i = 0; i < 3; i++) px[o + i] = Math.round(acc[i] / (SS * SS));
  }
  return px;
}

const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let c = 0xffffffff;
  for (const b of body) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  const len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, crc]);
}
function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 Bit, RGB (deckend – wichtig für apple-touch-icon und maskable)
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Das Herz ist ca. 1,87 r breit. Normal: ~62 % der Kante.
// Maskable: ~49 % der Kante – liegt komplett in der Safe Zone (Kreis mit 40 % Radius).
const ICONS = [
  ['icon-192.png', 192, .33],
  ['icon-512.png', 512, .33],
  ['icon-maskable-512.png', 512, .26],
  ['apple-touch-icon.png', 180, .33],
  ['favicon.png', 48, .42],
];
mkdirSync(OUT, { recursive: true });
for (const [name, size, scale] of ICONS) {
  writeFileSync(join(OUT, name), png(size, render(size, scale)));
  console.log(`icons/${name}  ${size}x${size}`);
}
