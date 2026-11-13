#!/usr/bin/env node
// Erzeugt die Spiel-Sprites aus den gemalten Quellbildern.
//
//   npm i                         # einmalig (sharp, nur devDependency)
//   node tools/make-sprites.mjs   # art/source/*.png -> sprites/*.webp
//
// Je Quellbild: auf das Motiv zuschneiden (Alpha), einheitlich skalieren und mittig auf
// 256×256 setzen, als WebP mit Alpha schreiben. Schatten kommen im Spiel per CSS dazu.
//
// Gleiche optische Größe: Alle Pralinen bekommen dieselbe deckende Fläche (nicht dieselbe
// Kantenlänge) – ein Herz oder Blatt füllt sein Rechteck schlechter als ein Quadrat und
// würde sonst kleiner wirken. Gedeckelt wird durch den Rand (PAD), damit nichts anstößt.
// Der Frostring ist ein Overlay und füllt stattdessen das ganze Feld.
//
// Optional: node tools/make-sprites.mjs <quellordner> <zielordner>
import sharp from 'sharp';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || join(ROOT, 'art', 'source');
const OUT = process.argv[3] || join(ROOT, 'sprites');

const SIZE = 256;            // Kantenlänge der Ausgabe
const PAD = 8;               // freier Rand je Seite für Pralinen
const ALPHA_MIN = 16;        // darunter gilt ein Pixel als leer (Halo vom Freistellen)
const MAX_FILE = 40 * 1024;  // je Datei
const MAX_TOTAL = 350 * 1024;

// fit 'area': gleiche deckende Fläche wie die anderen · 'frame': füllt das Feld (Overlay)
const SPRITES = [
  ['truffle-dark', 'area'], ['nougat', 'area'], ['cassis', 'area'], ['raspberry', 'area'],
  ['pistachio', 'area'], ['caramel', 'area'], ['brittle', 'area'], ['brittle-gold', 'area'],
  ['frost', 'frame'],
];

const problems = [], notes = [];

async function measure(name) {
  const file = join(SRC, name + '.png');
  if (!existsSync(file)) { problems.push(`${name}.png fehlt in ${SRC}`); return null; }
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  if (w !== h || w < 1024) notes.push(`${name}.png ist ${w}×${h} (erwartet: quadratisch, mind. 1024 px)`);
  let x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0, clear = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = data[(y * w + x) * 4 + 3];
    if (a < 255) clear++;
    if (a < ALPHA_MIN) continue;
    area += a / 255;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) { problems.push(`${name}.png ist komplett leer`); return null; }
  if (clear === 0) { problems.push(`${name}.png hat keinen transparenten Hintergrund (kein Alpha)`); return null; }
  if (x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1) notes.push(`${name}.png: Motiv berührt den Bildrand – möglicherweise abgeschnitten`);
  return { name, file, box: { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }, area };
}

async function encode(m, scale) {
  const w = Math.max(1, Math.round(m.box.width * scale)), h = Math.max(1, Math.round(m.box.height * scale));
  const left = Math.round((SIZE - w) / 2), top = Math.round((SIZE - h) / 2);
  const base = await sharp(m.file).ensureAlpha().extract(m.box)
    .resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
    .extend({ left, top, right: SIZE - w - left, bottom: SIZE - h - top, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  // Qualität schrittweise senken, bis die Datei unter das Limit passt
  let buf;
  for (const quality of [90, 86, 82, 76, 70, 62, 54, 46]) {
    buf = await sharp(base).webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true }).toBuffer();
    if (buf.length <= MAX_FILE) return { buf, quality, w, h };
  }
  problems.push(`${m.name}.webp bleibt über ${MAX_FILE / 1024} KB (${buf.length} Bytes)`);
  return { buf, quality: 46, w, h };
}

const measured = [];
for (const [name, fit] of SPRITES) { const m = await measure(name); if (m) measured.push({ ...m, fit }); }

// Zielfläche: der Median dessen, was jede Praline maximal erreichen könnte. Mit dem Median
// zieht eine einzelne ungewöhnlich schmale Form nicht alle anderen klein.
const inner = SIZE - 2 * PAD;
const maxScale = (m) => inner / Math.max(m.box.width, m.box.height);
const reach = measured.filter((m) => m.fit === 'area').map((m) => Math.sqrt(m.area) * maxScale(m)).sort((a, b) => a - b);
const target = reach.length ? reach[Math.floor((reach.length - 1) / 2)] : 0;

mkdirSync(OUT, { recursive: true });
let total = 0;
const rows = [];
for (const m of measured) {
  const scale = m.fit === 'frame' ? SIZE / Math.max(m.box.width, m.box.height) : Math.min(target / Math.sqrt(m.area), maxScale(m));
  const { buf, quality, w, h } = await encode(m, scale);
  writeFileSync(join(OUT, m.name + '.webp'), buf);
  total += buf.length;
  rows.push({ sprite: m.name + '.webp', motiv: `${w}×${h}`, 'fläche %': +(m.area * scale * scale / (SIZE * SIZE) * 100).toFixed(1), qualität: quality, kb: +(buf.length / 1024).toFixed(1) });
}
console.table(rows);
console.log(`Gesamt: ${(total / 1024).toFixed(1)} KB in ${rows.length} Dateien -> ${OUT}`);
if (total > MAX_TOTAL) problems.push(`Gesamtgröße ${(total / 1024).toFixed(1)} KB liegt über ${MAX_TOTAL / 1024} KB`);
notes.forEach((n) => console.warn('Hinweis: ' + n));
if (problems.length) { problems.forEach((p) => console.error('FEHLER: ' + p)); process.exit(1); }
