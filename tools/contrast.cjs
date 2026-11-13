#!/usr/bin/env node
// Lesbarkeits-Prüfung: (1) Textfarben gegen ihren Hintergrund (WCAG-Kontrast, Ziel ≥ 4,5 für kleinen Text),
// (2) jede Praline gegen jedes Förmchen: Helligkeitsabstand (ΔL*) zwischen dem Rand des Sprites
// (äußere 12 % der Silhouette, inkl. Kontur) bzw. seiner Fläche und dem Förmchen. Unter ~20 verschwimmt es.
//
//   node tools/contrast.cjs
const sharp = require('sharp');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lin = (v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const Y = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const Ls = (c) => { const y = Y(c); return y > .008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };
const ratio = (a, b) => { const x = Y(hex(a)), y = Y(hex(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const v = (n) => (html.match(new RegExp('--' + n + ':(#[0-9a-fA-F]{3,6})')) || [])[1];

const TEXT = [['Fließtext', v('ink'), v('card')], ['Nebentext (Hinweis, Etiketten)', v('mut'), v('cream')], ['Nebentext auf Karte', v('mut'), v('card')],
  ['Sterne / Gold-Text', v('goldt') || v('gold'), '#ffffff'], ['Erledigt (grün)', v('ok'), '#ffffff'], ['Rosé-Text', v('roset') || v('rose'), v('card')], ['Knopf dunkel', '#fff3dc', v('box')], ['Knopf Rosé', '#fff3dc', (html.match(/\.btn\.rose\{background:(#[0-9a-f]{6})/) || [])[1]], ['Knopf hell', v('ink'), '#f3e3d6']];
console.log('Text'); console.table(TEXT.map(([n, f, b]) => ({ was: n, farbe: f, auf: b, kontrast: +ratio(f, b).toFixed(2), ok: ratio(f, b) >= 4.5 ? 'ja' : 'NEIN' })));

const cups = [...html.matchAll(/\{n:'([^']+)',at:\d+,v:\[([^\]]+)\]\}/g)].map((m) => ({ n: m[1], v: m[2].replace(/'/g, '').split(',') }));
const NAMES = ['truffle-dark', 'nougat', 'cassis', 'raspberry', 'pistachio', 'caramel', 'brittle', 'brittle-gold'];
(async () => {
  const rows = [];
  for (const n of NAMES) {
    const { data, info } = await sharp(path.join(__dirname, '..', 'sprites', n + '.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, A = (x, y) => (x < 0 || y < 0 || x >= W || y >= W ? 0 : data[(y * W + x) * 4 + 3]);
    let rim = [0, 0, 0, 0], body = [0, 0, 0, 0]; const D = Math.round(W * .06);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { if (A(x, y) < 200) continue; const i = (y * W + x) * 4;
      const edge = A(x - D, y) < 128 || A(x + D, y) < 128 || A(x, y - D) < 128 || A(x, y + D) < 128; const t = edge ? rim : body;
      t[0] += data[i]; t[1] += data[i + 1]; t[2] += data[i + 2]; t[3]++; }
    const m = (t) => t.slice(0, 3).map((c) => c / t[3]); const row = { sprite: n };
    for (const c of cups) { const cup = (Ls(hex(c.v[2])) + Ls(hex(c.v[3]))) / 2;   // Falten: das, was um die Praline herum sichtbar bleibt
      row[c.n] = Math.round(Math.abs(Ls(m(rim)) - cup)) + ' / ' + Math.round(Math.abs(Ls(m(body)) - cup)); }
    rows.push(row);
  }
  console.log('Praline gegen Förmchen: ΔL* Rand / Fläche'); console.table(rows);
})();
