#!/usr/bin/env node
// Misst per Bot-Simulation, wie schwer die Bestellungen sind (Zuglimit in P() in index.html).
//
//   node tools/balance.cjs
//
// Braucht Playwright (npm i -D playwright). Das Spiel wird per file:// geladen und über
// window.__cs mit der echten Spiellogik gespielt. Der Bot wertet jeden möglichen Zug aus
// (ein Zug Vorausschau), nutzt aber weder Ablage noch Drehen und plant keine sortenreinen
// Reihen – ein Mensch, der das tut, kommt weiter.
//
// Ausgabe je Bestellung: wie viele Partien sie erreichen, wie oft sie geliefert wird,
// wie oft sie platzt (♥ weg) und Züge-pro-Praline (Grundlage für die Faktoren in P()).
const { chromium } = require('playwright');
const path = require('path');
const RUNS = +process.argv[2] || 150;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  const out = await page.evaluate((RUNS) => {
    const cs = window.__cs, N = cs.N || 8, ROWS = cs.R || N; cs.fx = false;
    function pick() { const G = cs.G; let best = null;
      G.tray.forEach((pc, i) => { if (!pc) return;
        for (let r = 0; r <= ROWS - pc.h; r++) for (let c = 0; c <= N - pc.w; c++) { if (!cs.fits(pc, r, c)) continue;
          const sim = G.board.slice(); pc.cells.forEach(([a, b]) => sim[(r + a) * N + c + b] = { c: pc.c });
          const L = cs.fullLines(sim), gain = {}; L.forEach(l => { if (cs.isPure(sim, l)) gain[sim[l[0]].c] = (gain[sim[l[0]].c] || 0) + l.length; });
          new Set(L.flat()).forEach(k => { const v = sim[k]; if (v.c != null) gain[v.c] = (gain[v.c] || 0) + 1; });
          let g = 0; G.order.goals.forEach(o => g += Math.min(Math.max(0, o.need - o.have), gain[o.c] || 0));
          let adj = 0; pc.cells.forEach(([a, b]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => { const R = r + a + dr, C = c + b + dc; if (R < 0 || C < 0 || R >= ROWS || C >= N || sim[R * N + C] != null) adj += .5; }));
          const sc = g * 10 + L.length * 6 + adj + Math.random();
          if (!best || sc > best.sc) best = { i, r, c, sc }; } });
      return best; }
    const st = {};
    const rec = s => st[s] || (st[s] = { reached: 0, done: 0, failed: 0, ratio: [] });
    const scores = [], stages = [], ends = {};
    for (let k = 0; k < RUNS; k++) {
      cs.startGame('saison'); document.getElementById('help').classList.add('hidden');
      let G = cs.G, stage = 1, used = 0, hearts = 3; rec(1).reached++;
      while (!G.over) { const m = pick(); if (!m) break; const total = G.order.goals.reduce((a, o) => a + o.need, 0); cs.place(m.i, m.r, m.c); used++;
        if (G.stage > stage) { rec(stage).done++; rec(stage).ratio.push(used / total); stage = G.stage; used = 0; rec(stage).reached++; }
        else if (G.hearts < hearts) { rec(stage).failed++; used = 0; }
        hearts = G.hearts; }
      scores.push(G.score); stages.push(G.stage); ends[G.over] = (ends[G.over] || 0) + 1;
    }
    const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const rows = Object.keys(st).map(Number).sort((a, b) => a - b).filter(s => st[s].reached >= RUNS * .05).map(s => { const x = st[s], p = cs.P(s);
      return { bestellung: s, sorten: p.colors, ziele: p.ng + '×' + p.need, limit: p.moves, 'erreicht %': Math.round(x.reached / RUNS * 100), 'geliefert %': Math.round(x.done / x.reached * 100), 'geplatzt je Partie': +(x.failed / x.reached).toFixed(2), 'Züge/Praline (Median)': x.ratio.length ? +med(x.ratio).toFixed(2) : '-' }; });
    return { rows, medScore: med(scores), medStage: med(stages), maxStage: Math.max(...stages), ends };
  }, RUNS);
  console.table(out.rows);
  console.log(`Bot: Median ${out.medScore} Punkte, Median Bestellung ${out.medStage}, Maximum Bestellung ${out.maxStage}; Ende: ${JSON.stringify(out.ends)}`);
  await browser.close();
})();
