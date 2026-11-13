#!/usr/bin/env node
// Übernimmt gemalte Bilder aus einem Bildgenerator nach art/source/ und stellt sie frei.
//
//   node tools/import-art.mjs <ordner-mit-rohbildern>
//
// Erwartet die zehn Dateinamen aus art/PROMPTS.md. Die Sprites dürfen auf einfarbigem Magenta
// gemalt sein (auch nur als Rechteck in einem sonst transparenten Bild): Von außen her wird alles
// entfernt, was transparent oder magenta ist – eine Füllung über zusammenhängende Flächen, kein
// Farbschlüssel. Rosa im Motiv bleibt deshalb erhalten, solange eine Kontur es vom Hintergrund trennt.
// Danach wird der Rand um einen Pixel zurückgenommen und Magenta-Schimmer an der Kante entfernt.
// icon.png bleibt deckend; sein heller Hintergrund wird auf #fbeee6 gesetzt.
//
// Zwei Motive werden fürs Spiel angepasst (ADJUST unten; zum Abschalten den Eintrag entfernen):
// - pistachio: Die Schokolade wird grün eingefärbt. Im Spiel ist die Sorte über die Farbe erkennbar,
//   und ein brauner Kern wäre neben Zartbitter, Nougat und Krokant die vierte braune Praline.
// - coconut: wird zum Rand hin abgedunkelt und bekommt eine breite dunkle Kontur – die helle Kugel verschwindet sonst auf dem hellen Papierförmchen.
// - frost: Der Ring wird nach außen gestaucht (größeres Loch) und kreisrund gemacht, damit darunter
//   die Sorte und in der Mitte die Zahl sichtbar bleiben; Magenta-Reste an der Innenkante entfallen.
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const IN = process.argv[2];
const OUT = process.argv[3] || join(dirname(fileURLToPath(import.meta.url)), '..', 'art', 'source');
if (!IN) { console.error('Aufruf: node tools/import-art.mjs <ordner-mit-rohbildern>'); process.exit(1); }
const NAMES = ['truffle-dark', 'nougat', 'coconut', 'raspberry', 'pistachio', 'caramel', 'brittle', 'brittle-gold', 'frost'];
const BG = [0xfb, 0xee, 0xe6];
mkdirSync(OUT, { recursive: true });

// Magenta: viel Rot, kaum Grün, deutlich Blau
const isKey = (r, g, b) => r > 150 && g < r * .38 && b > r * .38 && b < r * 1.15;
const keyish = (r, g, b) => r > 110 && g < r * .55 && b > r * .45 && b > g * 1.5;   // Mischpixel an der Kante

function flood(w, h, start, pass) {
  const seen = new Uint8Array(w * h), stack = [];
  for (const i of start) if (!seen[i] && pass(i)) { seen[i] = 1; stack.push(i); }
  while (stack.length) { const i = stack.pop(), x = i % w, y = (i - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (!seen[j] && pass(j)) { seen[j] = 1; stack.push(j); } } }
  return seen;
}
const border = (w, h) => { const b = []; for (let x = 0; x < w; x++) b.push(x, (h - 1) * w + x); for (let y = 0; y < h; y++) b.push(y * w, y * w + w - 1); return b; };

function rgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, mx ? d / mx : 0, mx]; }
function hsv2rgb(h, s, v) { const f = (n) => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return [f(5), f(3), f(1)]; }
// Dunkle Kontur um die Silhouette: alles, was höchstens px vom Motiv entfernt liegt, wird in col gefüllt
function outline(data, w, h, px, col) { const a = Buffer.alloc(w * h); for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3] > 128 ? 255 : 0; const out = Buffer.from(data), r2 = px * px;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (a[i]) continue; let best = 1e9;
    for (let dy = -px; dy <= px && best > 0; dy++) { const Y = y + dy; if (Y < 0 || Y >= h) continue; for (let dx = -px; dx <= px; dx++) { const X = x + dx; if (X < 0 || X >= w || !a[Y * w + X]) continue; const d = dx * dx + dy * dy; if (d < best) best = d; } }
    if (best > r2) continue; const k = Math.max(0, Math.min(1, px - Math.sqrt(best) + .5)), al = data[i * 4 + 3] / 255;   // weiche Außenkante; vorhandene Kantenpixel bleiben obenauf
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(data[i * 4 + c] * al + col[c] * (1 - al)); out[i * 4 + 3] = Math.round(255 * Math.max(al, k)); }
  return out; }
const ADJUST = {
  // Kokos: zum Rand hin abdunkeln (gibt der hellen Kugel Volumen) und eine breite dunkle Kontur darum
  async coconut(data, w, h) { const a = Buffer.alloc(w * h); for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3] > 128 ? 255 : 0;
    const soft = await sharp(a, { raw: { width: w, height: h, channels: 1 } }).blur(16).extractChannel(0).raw().toBuffer();
    for (let i = 0; i < w * h; i++) { if (!a[i]) continue; const k = .62 + .38 * Math.max(0, Math.min(1, (soft[i] / 255 - .5) * 2.2)); for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(data[i * 4 + c] * k); }
    return outline(data, w, h, 20, [0x33, 0x1f, 0x0b]); },
  // Braun (Farbton 0–45°) -> Pistaziengrün; gelbgrüne Krümel und weiße Glanzlichter bleiben
  pistachio(data, w, h) { for (let i = 0; i < w * h; i++) { if (!data[i * 4 + 3]) continue; const [hh, ss, vv] = rgb2hsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    if (hh > 48 && hh < 330) continue; const [r, g, b] = hsv2rgb(96, Math.min(1, ss * .8), Math.min(1, vv * 1.45 + .07)); data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; } return data; },
  // Ring: Loch von seinem gemessenen Innenradius auf 66 % des Außenradius aufweiten, auf einen Kreis normieren
  frost(data, w, h) { for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] && keyish(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) data[i * 4 + 3] = 0;
    let x0 = w, y0 = h, x1 = 0, y1 = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2, inner = [];
    for (let a = 0; a < 360; a += 3) { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180); for (let t = 0; t <= 1; t += .005) { const X = Math.round(cx + c * rx * t), Y = Math.round(cy + s * ry * t); if (data[(Y * w + X) * 4 + 3] > 40) { inner.push(t); break; } } }
    inner.sort((a, b) => a - b); const src0 = inner[Math.floor(inner.length * .25)], dst0 = .66, R = w / 2 - 6, out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x - w / 2) / R, dy = (y - h / 2) / R, rho = Math.hypot(dx, dy); if (rho < dst0 * .97 || rho > 1.01) continue;
      const t = src0 + (rho - dst0) / (1 - dst0) * (1 - src0); if (t < 0) continue; const sx = cx + dx / rho * t * rx, sy = cy + dy / rho * t * ry, X = Math.floor(sx), Y = Math.floor(sy); if (X < 0 || Y < 0 || X >= w - 1 || Y >= h - 1) continue;
      const fx = sx - X, fy = sy - Y, o = (y * w + x) * 4, P = (xx, yy) => (yy * w + xx) * 4; let A = 0; const acc = [0, 0, 0];
      for (const [xx, yy, wt] of [[X, Y, (1 - fx) * (1 - fy)], [X + 1, Y, fx * (1 - fy)], [X, Y + 1, (1 - fx) * fy], [X + 1, Y + 1, fx * fy]]) { const q = P(xx, yy), al = data[q + 3] / 255 * wt; A += al; for (let k = 0; k < 3; k++) acc[k] += data[q + k] * al; }
      if (A > .01) { for (let k = 0; k < 3; k++) out[o + k] = Math.round(acc[k] / A); out[o + 3] = Math.round(A * 255); } }
    return out; },
};

for (const name of NAMES) {
  const file = join(IN, name + '.png'); if (!existsSync(file)) { console.error(`FEHLT: ${name}.png`); process.exitCode = 1; continue; }
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const w = info.width, h = info.height;
  const bg = flood(w, h, border(w, h), (i) => data[i * 4 + 3] < 40 || isKey(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]));
  // Kante: Magenta-Mischpixel am Rand zum Hintergrund dazunehmen (zwei Durchgänge), dann 1 px zurücknehmen
  for (let pass = 0; pass < 3; pass++) { const add = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (bg[i]) continue;
      if (!(bg[i - 1] || bg[i + 1] || bg[i - w] || bg[i + w])) continue;
      if (pass === 2 || keyish(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) add.push(i); }
    add.forEach((i) => bg[i] = 1); }
  let kept = 0; for (let i = 0; i < w * h; i++) { if (bg[i]) data[i * 4 + 3] = 0; else kept++; }
  if (ADJUST[name]) { const d2 = await ADJUST[name](data, w, h); if (d2 !== data) d2.copy(data); }
  // Kante weichzeichnen: nur der Alphakanal, leicht
  const alpha = Buffer.alloc(w * h); for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];
  const soft = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(.8).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = Math.min(alpha[i], soft[i]);
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(join(OUT, name + '.png'));
  console.log(`${name}.png  ${w}×${h}  Motiv ${(kept / (w * h) * 100).toFixed(1)} % der Fläche`);
}

// Icon: deckend lassen, hellen Hintergrund (von den Ecken her) auf BG setzen
const icon = join(IN, 'icon.png');
if (existsSync(icon)) {
  const { data, info } = await sharp(icon).flatten({ background: { r: BG[0], g: BG[1], b: BG[2] } }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const w = info.width, h = info.height;
  const c0 = [data[0], data[1], data[2]];
  const bg = flood(w, h, border(w, h), (i) => Math.abs(data[i * 3] - c0[0]) + Math.abs(data[i * 3 + 1] - c0[1]) + Math.abs(data[i * 3 + 2] - c0[2]) < 40);
  let n = 0; for (let i = 0; i < w * h; i++) if (bg[i]) { n++; for (let k = 0; k < 3; k++) data[i * 3 + k] = Math.max(0, Math.min(255, data[i * 3 + k] + BG[k] - c0[k])); }
  await sharp(data, { raw: { width: w, height: h, channels: 3 } }).png({ compressionLevel: 9 }).toFile(join(OUT, 'icon.png'));
  console.log(`icon.png  ${w}×${h}  Hintergrund ${(n / (w * h) * 100).toFixed(1)} % auf #fbeee6 gesetzt`);
} else { console.error('FEHLT: icon.png'); process.exitCode = 1; }
