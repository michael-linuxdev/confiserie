#!/usr/bin/env node
// Zeichnet die Quellbilder in art/source/ als Vektor-Illustrationen und rendert sie zu PNG (1024 px).
//
//   npm i                     # einmalig (sharp, nur devDependency)
//   node tools/make-art.mjs   # -> art/source/*.png
//
// Alle Sorten teilen sich Aufbau und Licht: Blick schräg von oben (Deckfläche + sichtbare
// Seitenwand), Licht von links oben, kräftige Kontur, weiches Glanzlicht, derselbe
// „Pinsel“-Filter (leichtes Verwackeln der Kanten + fleckige Lasur). Kein Schlagschatten.
//
// Wer gemalte Bilder hat, legt sie einfach unter demselben Namen nach art/source/ und lässt
// dieses Skript weg – make-sprites.mjs und make-icons.mjs nehmen, was dort liegt.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'art', 'source');
const S = 1024;

function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const f = (n) => +n.toFixed(1);

const DEFS = `
<filter id="paint" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency=".009" numOctaves="2" seed="3" result="w"/>
  <feDisplacementMap in="SourceGraphic" in2="w" scale="18" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="2" seed="7" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .5 0 0 0 -.2" result="hl"/>
  <feComposite in="hl" in2="d" operator="in" result="hlc"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 .15  0 0 0 0 .05  0 0 0 0 0  0 .55 0 0 -.22" result="sh"/>
  <feComposite in="sh" in2="d" operator="in" result="shc"/>
  <feMerge><feMergeNode in="d"/><feMergeNode in="hlc"/><feMergeNode in="shc"/></feMerge>
</filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
<filter id="soft2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
<!-- Deckkraft sehr klein: die Seitenwand wird aus vielen Lagen aufgebaut, die sich addieren -->
<linearGradient id="sideShade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".012"/><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".035"/></linearGradient>
<radialGradient id="faceLight" cx=".3" cy=".25" r=".95"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>
<radialGradient id="ball" cx=".34" cy=".28" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>`;

// Körper mit Deckfläche und Seitenwand. shape(attrs) liefert das SVG-Element der Deckfläche.
function solid(shape, { depth = 80, top, side, line, ow = 15, round = 0 }) {
  const steps = []; for (let d = 0; d <= depth; d += 5) steps.push(d);
  const rj = `stroke-linejoin="round" stroke-linecap="round"`;
  const sweep = (attrs) => steps.map((d) => `<g transform="translate(0 ${d})">${shape(attrs)}</g>`).join('');
  return `<g transform="translate(0 ${-depth / 2})">
    ${sweep(`fill="${line}" stroke="${line}" stroke-width="${round + ow * 2}" ${rj}`)}
    ${sweep(`fill="${side}" stroke="${side}" stroke-width="${round}" ${rj}`)}
    ${sweep(`fill="url(#sideShade)" stroke="none"`)}
    ${shape(`fill="${top}" stroke="${top}" stroke-width="${round}" ${rj}`)}
    ${shape(`fill="url(#faceLight)" stroke="none"`)}
    ${shape(`fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="7" ${rj}`)}
    <g transform="translate(0 ${depth})">${shape(`fill="none" stroke="#000" stroke-opacity=".0" stroke-width="1"`)}</g>
    FACE
  </g>`;
}
const gloss = (x, y, rx, ry, rot = -30, o = .75) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity="${o * .55}" filter="url(#soft)"/><ellipse cx="${x}" cy="${y}" rx="${rx * .62}" ry="${ry * .5}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity="${o}" filter="url(#soft2)"/>`;
const dot = (x, y, r, o = .9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;

// ---- Sorten ----
function truffle() {
  const drizzle = [300, 400, 500, 600, 700].map((y, i) => {
    const d = `M110 ${y} Q 310 ${y - 70 + i * 6} 512 ${y + 6} T 920 ${y - 30}`;
    return `<path d="${d}" transform="translate(0 9)" fill="none" stroke="#1a0b05" stroke-opacity=".5" stroke-width="30" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#a9703f" stroke-width="27" stroke-linecap="round"/>
      <path d="${d}" transform="translate(0 -6)" fill="none" stroke="#e0b07c" stroke-width="8" stroke-linecap="round"/>`;
  }).join('');
  return `<clipPath id="c"><circle cx="512" cy="512" r="345"/></clipPath>
    <circle cx="512" cy="512" r="360" fill="#1c0c06"/>
    <circle cx="512" cy="512" r="345" fill="#5b3220"/>
    <g clip-path="url(#c)"><g transform="rotate(-24 512 512)">${drizzle}</g></g>
    <circle cx="512" cy="512" r="345" fill="url(#ball)"/>
    <circle cx="512" cy="512" r="338" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="8"/>
    ${gloss(385, 345, 120, 60, -38, .7)}${dot(300, 470, 14, .6)}`;
}

function nougat() {
  const sq = (a) => `<rect x="207" y="207" width="610" height="610" rx="96" ${a}/>`;
  const nut = `<ellipse cx="548" cy="560" rx="150" ry="120" fill="#3a1c0a" opacity=".5" filter="url(#soft2)"/>
    <path d="M512 352 C 590 368 650 430 650 505 C 650 590 588 648 512 648 C 436 648 374 590 374 505 C 374 430 434 368 512 352 Z" fill="#c98f4c" stroke="#55300f" stroke-width="16" stroke-linejoin="round"/>
    <path d="M512 352 C 590 368 650 430 650 505 C 650 590 588 648 512 648 C 436 648 374 590 374 505 C 374 430 434 368 512 352 Z" fill="url(#ball)"/>
    <path d="M430 610 Q 512 660 600 606" fill="none" stroke="#f0cf9a" stroke-width="12" stroke-linecap="round" opacity=".7"/>
    <path d="M512 366 Q 500 500 512 636 M560 380 Q 600 500 566 626 M462 380 Q 420 500 458 626" fill="none" stroke="#7a4a1c" stroke-opacity=".35" stroke-width="7" stroke-linecap="round"/>
    ${gloss(455, 440, 52, 28, -40, .85)}`;
  return solid(sq, { depth: 96, top: '#b9733d', side: '#7c4321', line: '#3d1e0c' })
    .replace('FACE', `<rect x="262" y="262" width="500" height="500" rx="62" fill="none" stroke="#6e3a1a" stroke-opacity=".45" stroke-width="12"/>
      <rect x="262" y="270" width="500" height="500" rx="62" fill="none" stroke="#f3c08a" stroke-opacity=".35" stroke-width="6"/>${nut}${gloss(318, 300, 70, 26, -35, .6)}`);
}

// Kokos: dunkle Kontur und kräftige Flockenränder, damit die weiße Kugel auf hellem Papier nicht verschwindet
function coconut() {
  const r = rng(11), flakes = [];
  for (let i = 0; i < 300; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 338, x = 512 + Math.cos(a) * d, y = 512 + Math.sin(a) * d;
    flakes.push([x, y, 34 + r() * 34, 11 + r() * 8, r() * 180, ['#ffffff', '#fffdf6', '#f4ead4', '#ffffff'][Math.floor(r() * 4)]]);
  }
  const fl = (attrs, col) => flakes.map(([x, y, w, h, rot, c]) => `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" transform="rotate(${f(rot)} ${f(x)} ${f(y)})" fill="${col || c}" ${attrs}/>`).join('');
  return `<circle cx="512" cy="512" r="340" fill="#4a3418"/>
    ${fl('stroke="#4a3418" stroke-width="34"', '#4a3418')}
    <circle cx="512" cy="512" r="322" fill="#fbf6ea"/>
    ${fl('stroke="#7d6238" stroke-opacity=".7" stroke-width="4"')}
    <circle cx="512" cy="512" r="372" fill="url(#ball)" opacity=".62"/>
    ${gloss(390, 360, 110, 60, -38, .5)}`;
}

const HEART = 'M512 838 C 150 610 96 392 196 266 C 290 150 452 180 512 300 C 572 180 734 150 828 266 C 928 392 874 610 512 838 Z';
function heartBody(depth = 84) {
  return solid((a) => `<path d="${HEART}" ${a}/>`, { depth, top: '#f0437a', side: '#a81d4d', line: '#5e0c2a', round: 14 })
    .replace('FACE', `<path d="M258 330 C 300 262 392 252 446 312" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" opacity=".9"/>
      <path d="M232 420 C 236 470 262 520 300 566" fill="none" stroke="#fff" stroke-width="20" stroke-linecap="round" opacity=".5"/>
      ${gloss(640, 300, 70, 34, 28, .6)}${dot(238, 372, 13, .95)}
      <path d="M512 770 C 690 640 792 520 806 400" fill="none" stroke="#ffb3cb" stroke-width="14" stroke-linecap="round" opacity=".5"/>
      <path d="M512 316 C 520 352 518 380 512 400" fill="none" stroke="#8f1740" stroke-opacity=".45" stroke-width="12" stroke-linecap="round"/>`);
}
const raspberry = () => heartBody();

function pistachio() {
  const LEAF = 'M150 760 C 150 420 420 160 874 176 C 890 560 640 850 150 760 Z';
  const r = rng(5), crumbs = [];
  const cols = ['#e9f5a8', '#d3e77c', '#a9c94f', '#f4f0c0', '#9a6f45', '#c9de6a'];
  for (let i = 0; i < 46; i++) {
    const t = .12 + r() * .76, off = (r() - .5) * 2 * (150 * Math.sin(Math.PI * (t * .9 + .05)) + 6);
    const cx = 190 + t * 650 + off * .68, cy = 735 - t * 530 + off * .74, s = 15 + r() * 19, n = 4 + Math.floor(r() * 3), a0 = r() * 6;
    const pts = [...Array(n)].map((_, k) => { const a = a0 + k / n * Math.PI * 2, q = s * (.7 + r() * .5); return f(cx + Math.cos(a) * q) + ',' + f(cy + Math.sin(a) * q); }).join(' ');
    crumbs.push(`<polygon points="${pts}" transform="translate(5 8)" fill="#2e4a10" opacity=".45"/><polygon points="${pts}" fill="${cols[Math.floor(r() * cols.length)]}" stroke="#3e5c18" stroke-width="5" stroke-linejoin="round"/>`);
  }
  return solid((a) => `<path d="${LEAF}" ${a}/>`, { depth: 80, top: '#8fb842', side: '#55791f', line: '#2a440c', round: 14 })
    .replace('FACE', `<path d="M215 716 Q 500 470 820 226" fill="none" stroke="#5f8724" stroke-width="16" stroke-linecap="round"/>
      <path d="M215 708 Q 500 462 820 218" fill="none" stroke="#d2ea8a" stroke-opacity=".6" stroke-width="6" stroke-linecap="round"/>
      ${crumbs.join('')}${gloss(400, 330, 90, 30, -44, .6)}`);
}

function caramel() {
  const hex = (a) => `<polygon points="852,512 682,806 342,806 172,512 342,218 682,218" ${a}/>`;
  const r = rng(23), salt = [];
  for (let i = 0; i < 17; i++) {
    const a = r() * Math.PI * 2, d = 40 + Math.sqrt(r()) * 200, x = 512 + Math.cos(a) * d, y = 512 + Math.sin(a) * d * .9, s = 22 + r() * 22, rot = r() * 90;
    salt.push(`<g transform="rotate(${f(rot)} ${f(x)} ${f(y)})"><rect x="${f(x - s / 2 + 5)}" y="${f(y - s / 2 + 8)}" width="${f(s)}" height="${f(s)}" rx="4" fill="#7a4410" opacity=".5"/>
      <rect x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${f(s)}" height="${f(s)}" rx="4" fill="#fff" stroke="#b9c7d6" stroke-width="4"/>
      <rect x="${f(x - s / 2 + s * .5)}" y="${f(y - s / 2 + s * .5)}" width="${f(s * .5)}" height="${f(s * .5)}" fill="#d9e4ee"/></g>`);
  }
  return solid(hex, { depth: 90, top: '#f2a730', side: '#b1661a', line: '#5c2f08', round: 60 })
    .replace('FACE', `<polygon points="770,512 641,735 383,735 254,512 383,289 641,289" fill="none" stroke="#b96c18" stroke-opacity=".5" stroke-width="12" stroke-linejoin="round"/>
      <polygon points="770,520 641,743 383,743 254,520 383,297 641,297" fill="none" stroke="#ffe19a" stroke-opacity=".55" stroke-width="6" stroke-linejoin="round"/>
      ${salt.join('')}${gloss(350, 300, 96, 34, -32, .8)}${dot(250, 430, 12, .8)}`);
}

const SHARD = '176,430 318,226 508,270 650,170 858,330 800,548 872,706 610,806 436,732 250,780';
function brittleParts(band) {
  const r = rng(41), nuts = [[360, 400, -25], [610, 330, 30], [700, 560, -50], [450, 610, 15], [280, 600, 60]];
  const almonds = nuts.map(([x, y, rot]) => `<g transform="rotate(${rot} ${x} ${y})"><ellipse cx="${x + 6}" cy="${y + 10}" rx="86" ry="50" fill="#5a2c08" opacity=".5"/>
    <ellipse cx="${x}" cy="${y}" rx="84" ry="48" fill="#f1d9a6" stroke="#8a531a" stroke-width="12"/>
    <ellipse cx="${x}" cy="${y}" rx="84" ry="48" fill="url(#ball)" opacity=".7"/>
    <path d="M${x - 56} ${y + 4} Q ${x} ${y - 16} ${x + 58} ${y + 2}" fill="none" stroke="#b98a4a" stroke-width="6" stroke-linecap="round"/></g>`).join('');
  const bubbles = [...Array(22)].map(() => { const x = 230 + r() * 570, y = 260 + r() * 480, q = 6 + r() * 11; return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(q)}" fill="#8a4a10" opacity=".4"/><circle cx="${f(x - 2)}" cy="${f(y - 3)}" r="${f(q * .5)}" fill="#ffe2a0" opacity=".55"/>`; }).join('');
  const face = `<clipPath id="fc"><polygon points="${SHARD}"/></clipPath><g clip-path="url(#fc)">${bubbles}
      <path d="M318 226 L 420 470 L 250 780 M420 470 L 640 500 L 800 548 M640 500 L 610 806" fill="none" stroke="#7a3f0c" stroke-opacity=".4" stroke-width="9" stroke-linejoin="round"/>
      ${almonds}</g>${gloss(420, 300, 80, 26, -20, .7)}${gloss(720, 420, 46, 18, 40, .55)}`;
  // dunkler als Karamell, damit beide nicht verwechselt werden
  let out = solid((a) => `<polygon points="${SHARD}" ${a}/>`, { depth: 70, top: '#b9691f', side: '#703608', line: '#3a1803', round: 16 }).replace('FACE', face + (band ? 'BAND' : ''));
  if (band) {
    // Goldfolie: läuft quer über Deckfläche und Seitenwand
    const sweep = [...Array(15)].map((_, i) => `<polygon points="${SHARD}" transform="translate(0 ${i * 5})" stroke="#000" stroke-width="16" stroke-linejoin="round"/>`).join('');
    out = out.replace('BAND', `<clipPath id="bc">${sweep}</clipPath>
      <linearGradient id="gold" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#b98718"/><stop offset=".18" stop-color="#ffe680"/><stop offset=".4" stop-color="#f3c330"/><stop offset=".62" stop-color="#fff6b8"/><stop offset=".82" stop-color="#e6ae24"/><stop offset="1" stop-color="#a87610"/></linearGradient>
      <g clip-path="url(#bc)"><g transform="rotate(-36 512 500)">
        <rect x="414" y="-100" width="196" height="1300" fill="#5a3c06"/>
        <rect x="426" y="-100" width="172" height="1300" fill="url(#gold)"/>
        <path d="M444 -100 V1200 M580 -100 V1200" stroke="#fffbe0" stroke-opacity=".8" stroke-width="6"/>
        <path d="M426 300 l172 60 M426 520 l172 -50 M426 700 l172 40" stroke="#a87610" stroke-opacity=".45" stroke-width="7"/>
      </g></g>`);
  }
  return out;
}

function frost() {
  const r = rng(77), parts = [];
  const star = (x, y, s, rot, o = 1) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})" opacity="${o}"><path d="M0 ${-s} L ${s * .2} ${-s * .2} L ${s} 0 L ${s * .2} ${s * .2} L 0 ${s} L ${-s * .2} ${s * .2} L ${-s} 0 L ${-s * .2} ${-s * .2} Z" fill="#fff" stroke="#6fb6e6" stroke-width="7" stroke-linejoin="round"/></g>`;
  for (let i = 0; i < 26; i++) { // Eiszacken nach innen und außen
    const a = i / 26 * Math.PI * 2 + r() * .1, inward = i % 2, len = inward ? 44 + r() * 30 : 46 + r() * 34, r0 = inward ? 376 : 448, w = .05 + r() * .03;
    const p = (rad, ang) => f(512 + Math.cos(ang) * rad) + ',' + f(512 + Math.sin(ang) * rad);
    parts.push(`<polygon points="${p(r0, a - w)} ${p(inward ? r0 - len : r0 + len, a)} ${p(r0, a + w)}" fill="#eaf7ff" stroke="#6fb6e6" stroke-width="9" stroke-linejoin="round"/>`);
  }
  const stars = [...Array(9)].map((_, i) => { const a = i / 9 * Math.PI * 2 + .3; return star(512 + Math.cos(a) * 412, 512 + Math.sin(a) * 412, 30 + r() * 20, r() * 45); }).join('');
  const dots = [...Array(34)].map(() => { const a = r() * Math.PI * 2, d = 382 + r() * 62; return `<circle cx="${f(512 + Math.cos(a) * d)}" cy="${f(512 + Math.sin(a) * d)}" r="${f(4 + r() * 7)}" fill="#fff" opacity=".9"/>`; }).join('');
  return `<g transform="translate(512 512) scale(.93) translate(-512 -512)">${parts.join('')}
    <circle cx="512" cy="512" r="412" fill="none" stroke="#6fb6e6" stroke-width="98"/>
    <circle cx="512" cy="512" r="412" fill="none" stroke="#cdeaff" stroke-width="78"/>
    <circle cx="512" cy="512" r="424" fill="none" stroke="#ffffff" stroke-width="30" stroke-dasharray="150 60 260 90" stroke-linecap="round" opacity=".95"/>
    <circle cx="512" cy="512" r="392" fill="none" stroke="#9ed3f5" stroke-width="12" stroke-dasharray="90 140" stroke-linecap="round" opacity=".8"/>
    ${dots}${stars}</g>`;
}

function icon() {
  const base = (a) => `<rect x="150" y="330" width="724" height="520" rx="54" ${a}/>`;
  const box = solid(base, { depth: 80, top: '#7b4a30', side: '#4b2a19', line: '#27130a', ow: 16 })
    .replace('FACE', `<rect x="196" y="376" width="632" height="428" rx="30" fill="#3a1e10"/>
      <rect x="196" y="392" width="632" height="412" rx="30" fill="#f6dfc0"/>
      <rect x="196" y="392" width="632" height="412" rx="30" fill="url(#faceLight)"/>
      <rect x="196" y="376" width="632" height="428" rx="30" fill="none" stroke="#e2b04a" stroke-width="12"/>
      <ellipse cx="512" cy="640" rx="230" ry="130" fill="#b88a5a" opacity=".5" filter="url(#soft)"/>`);
  const lid = `<polygon points="170,330 854,330 800,110 224,110" fill="#27130a" stroke="#27130a" stroke-width="32" stroke-linejoin="round"/>
    <polygon points="170,330 854,330 800,110 224,110" fill="#8d573a" stroke="#8d573a" stroke-width="6" stroke-linejoin="round"/>
    <polygon points="170,330 854,330 800,110 224,110" fill="url(#faceLight)"/>
    <polygon points="226,290 798,290 762,150 262,150" fill="none" stroke="#e2b04a" stroke-width="10" stroke-linejoin="round"/>`;
  return `<g filter="url(#paint)">${lid}${box}<g transform="translate(512 575) scale(.54) translate(-512 -512)">${heartBody(110)}</g></g>`;
}

const ART = {
  'truffle-dark': truffle, nougat, coconut, raspberry, pistachio, caramel,
  brittle: () => brittleParts(false), 'brittle-gold': () => brittleParts(true), frost,
};

mkdirSync(OUT, { recursive: true });
const svg = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs>${DEFS}</defs>${bg || ''}${body}</svg>`;
for (const [name, draw] of Object.entries(ART)) {
  await sharp(Buffer.from(svg(`<g filter="url(#paint)">${draw()}</g>`))).png({ compressionLevel: 9 }).toFile(join(OUT, name + '.png'));
  console.log(`art/source/${name}.png`);
}
// Icon: deckend auf --cream, der Hintergrund bleibt vom Pinsel-Filter unberührt
await sharp(Buffer.from(svg(icon(), `<rect width="${S}" height="${S}" fill="#fbeee6"/>`))).flatten({ background: '#fbeee6' }).removeAlpha().png({ compressionLevel: 9 }).toFile(join(OUT, 'icon.png'));
console.log('art/source/icon.png');
