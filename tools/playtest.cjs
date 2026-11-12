#!/usr/bin/env node
// Bot-Playtest: spielt Partien mit der echten Spiellogik (window.__cs) und misst, was für Bindung und
// Bedienung zählt – Partielänge, Zeit bis zur ersten Lieferung, Hänger (kein Teil passt ohne Drehen),
// Ertrag für die Tagesziele – und ob Menü und Abrechnung ohne Scrollen auf kleine Bildschirme passen.
//
//   node tools/playtest.cjs [partien=200]
//
// Anders als tools/balance.cjs dreht dieser Bot, wenn nichts passt, und nutzt notfalls die Ablage.
// Ergebnisse stehen in docs/playtest/.
const { chromium } = require('playwright');
const path = require('path');
const RUNS = +process.argv[2] || 200;
const URL = 'file://' + path.join(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(URL);
  const sim = await page.evaluate((RUNS) => {
    const cs = window.__cs, N = cs.N || 8, ROWS = cs.R || N; cs.fx = false;
    function pick() { const G = cs.G; let best = null;
      [0, 1, 2, 3].forEach((i) => { const pc = i === 3 ? G.hold : G.tray[i]; if (!pc) return;
        for (let r = 0; r <= ROWS - pc.h; r++) for (let c = 0; c <= N - pc.w; c++) { if (!cs.fits(pc, r, c)) continue;
          const sim = G.board.slice(); pc.cells.forEach(([a, b]) => sim[(r + a) * N + c + b] = { c: pc.c });
          const L = cs.fullLines(sim), gain = {}; L.forEach(l => { if (cs.isPure(sim, l)) gain[sim[l[0]].c] = (gain[sim[l[0]].c] || 0) + l.length; });
          new Set(L.flat()).forEach(k => { const v = sim[k]; if (v.c != null) gain[v.c] = (gain[v.c] || 0) + 1; });
          let g = 0; G.order.goals.forEach(o => g += Math.min(Math.max(0, o.need - o.have), gain[o.c] || 0));
          let adj = 0; pc.cells.forEach(([a, b]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => { const R = r + a + dr, C = c + b + dc; if (R < 0 || C < 0 || R >= ROWS || C >= N || sim[R * N + C] != null) adj += .5; }));
          const sc = g * 10 + L.length * 6 + adj + Math.random();
          if (!best || sc > best.sc) best = { i, r, c, sc }; } });
      return best; }
    const games = [];
    for (let k = 0; k < RUNS; k++) {
      cs.startGame('saison'); document.getElementById('help').classList.add('hidden');
      const g = { moves: 0, stuck: 0, rots: 0, holds: 0, first: 0, multi: 0 }; let guard = 0;
      while (!cs.G.over && guard++ < 5000) { const G = cs.G; let m = pick();
        if (!m) { g.stuck++;   // Hänger: nichts passt, wie es liegt
          let done = false;
          for (const i of [0, 1, 2, 3]) { const pc = i === 3 ? G.hold : G.tray[i]; if (!pc || G.rot <= 0) continue;
            for (let t = 0; t < 3 && !done; t++) { const before = cs.G.rot; cs.rotate(i); if (cs.G.rot === before) break; g.rots++; if (cs.canFit(i === 3 ? cs.G.hold : cs.G.tray[i])) done = true; }
            if (done) break; }
          if (!done) { const i = G.tray.findIndex(Boolean); if (i < 0 || G.hold) break; cs.toHold(i); g.holds++; }
          continue; }
        const st = G.stage, l0 = G.stats.lines; cs.place(m.i, m.r, m.c); g.moves++;
        if (cs.G.stats.lines - l0 >= 2) g.multi++;
        if (!g.first && cs.G.stage > st) g.first = g.moves; }
      const G = cs.G; games.push(Object.assign(g, { score: G.score, stage: G.stage, lines: G.stats.lines, pure: G.stats.pure, orders: G.stats.orders, why: G.over || 'offen' }));
    }
    return games;
  }, RUNS);
  const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
  const col = (k) => sim.map((g) => g[k]);
  const row = (k) => ({ p10: q(col(k), .1), median: q(col(k), .5), p90: q(col(k), .9) });
  console.log(`Bot-Playtest, ${RUNS} Partien (Saison)`);
  console.table({ 'Züge je Partie': row('moves'), 'Züge bis 1. Lieferung': row('first'), Punkte: row('score'), 'Bestellung erreicht': row('stage'), 'Reihen je Partie': row('lines'), 'sortenrein je Partie': row('pure'), 'Lieferungen je Partie': row('orders'), '2+ Reihen in einem Zug': row('multi'), 'Hänger je Partie': row('stuck'), 'Drehungen je Partie': row('rots') });
  const ends = {}; sim.forEach((g) => ends[g.why] = (ends[g.why] || 0) + 1);
  console.log('Ende:', JSON.stringify(ends), '| Partien mit mindestens einem Hänger:', Math.round(sim.filter((g) => g.stuck).length / RUNS * 100) + ' %', '| ohne Lieferung:', Math.round(sim.filter((g) => !g.first).length / RUNS * 100) + ' %');

  // Passen die Dialoge ohne Scrollen?
  for (const [w, h] of [[390, 844], [390, 664], [360, 640], [320, 568]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); await p.goto(URL);
    const menu = await p.evaluate(() => { const c = document.getElementById('menuCard'); return c.scrollHeight - c.clientHeight; });
    await p.click('[data-a=new]'); if (await p.locator('[data-a=helpok]').isVisible()) await p.click('[data-a=helpok]');
    const r = await p.evaluate(async () => { const cs = window.__cs, G = cs.G; cs.fx = false; G.hearts = 1; G.order.left = 1; G.board.fill(null); const i = G.tray.findIndex(Boolean); cs.place(i, 0, 0);
      await new Promise((ok) => setTimeout(ok, 60));   // die Abrechnung erscheint einen Tick später
      const c = document.getElementById('overCard'), b = document.querySelector('#overCard [data-a=again]').getBoundingClientRect(), tr = document.getElementById('tray').getBoundingClientRect(), hint = document.getElementById('hint').getBoundingClientRect();
      return { over: c.scrollHeight - c.clientHeight, again: b.bottom <= innerHeight, tray: Math.round(innerHeight - tr.bottom), hint: Math.round(innerHeight - hint.bottom) }; });
    console.log(`${w}×${h}: Menü scrollt ${menu} px · Abrechnung scrollt ${r.over} px · „Neue Schachtel“ sichtbar: ${r.again} · Platz unter Teilen ${r.tray} px, unter Hinweis ${r.hint} px`);
    await ctx.close();
  }
  await browser.close();
})();
