#!/usr/bin/env node
// Erzeugt die App-Icons aus dem gemalten Quellbild art/source/icon.png
// (Herz-Praline in offener Schachtel, deckend auf cremefarbenem Grund #fbeee6).
//
//   npm i                       # einmalig (sharp, nur devDependency)
//   node tools/make-icons.mjs
//
// Ausgabe: icons/icon-192.png, icon-512.png, icon-maskable-512.png,
//          apple-touch-icon.png (180), favicon.png (48) – alle deckend, ohne Alpha.
//
// Optional: node tools/make-icons.mjs <quellbild> <zielordner>
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || join(ROOT, 'art', 'source', 'icon.png');
const OUT = process.argv[3] || join(ROOT, 'icons');
const BG = { r: 0xfb, g: 0xee, b: 0xe6 }; // --cream, wie background_color im Manifest

// scale: Anteil der Kante, den das Quellbild einnimmt; der Rest wird mit BG aufgefüllt.
// Maskable: Das Bild liegt komplett in den mittleren 80 % – Android beschneidet auf einen
// Kreis mit 40 % Radius (Safe Zone), die Bildecken sind ohnehin Hintergrund.
const ICONS = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, .8],
  ['apple-touch-icon.png', 180, 1],
  ['favicon.png', 48, 1],
];

if (!existsSync(SRC)) { console.error(`FEHLER: ${SRC} fehlt`); process.exit(1); }
const meta = await sharp(SRC).metadata();
if (meta.width !== meta.height || meta.width < 1024) console.warn(`Hinweis: icon.png ist ${meta.width}×${meta.height} (erwartet: quadratisch, mind. 1024 px)`);

// Quellbild deckend machen; weicht sein Rand sichtbar von BG ab, gäbe es beim maskable-Icon eine Kante.
const flat = await sharp(SRC).flatten({ background: BG }).removeAlpha().png().toBuffer();
const { data, info } = await sharp(flat).raw().toBuffer({ resolveWithObject: true });
const at = (x, y) => [0, 1, 2].map((i) => data[(y * info.width + x) * info.channels + i]);
const e = info.width - 1;
const off = Math.max(...[[0, 0], [e, 0], [0, e], [e, e]].map(([x, y]) => Math.max(...at(x, y).map((v, i) => Math.abs(v - [BG.r, BG.g, BG.b][i])))));
if (off > 6) console.warn(`Hinweis: Der Hintergrund von icon.png weicht von #fbeee6 ab (bis ${off}/255) – beim maskable-Icon kann eine Kante sichtbar sein`);

mkdirSync(OUT, { recursive: true });
for (const [name, size, scale] of ICONS) {
  const s = Math.round(size * scale), a = Math.floor((size - s) / 2), b = size - s - a;
  await sharp(flat).resize(s, s, { kernel: 'lanczos3' })
    .extend({ left: a, top: a, right: b, bottom: b, background: BG })
    .png({ compressionLevel: 9 }).toFile(join(OUT, name));
  console.log(`icons/${name}  ${size}x${size}`);
}
