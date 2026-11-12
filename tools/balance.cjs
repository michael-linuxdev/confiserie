#!/usr/bin/env node
// Kalibriert die Zuglimits (MOVES in index.html) per Bot-Simulation.
//
//   node tools/balance.cjs            Tabelle + Vorschlag für MOVES ausgeben
//   node tools/balance.cjs --check    Gewinnquoten mit den aktuell eingetragenen MOVES prüfen
//
// Braucht Playwright (npm i -D playwright). Das Spiel wird per file:// geladen und die echte
// Spiellogik (initLevel, refill, scoreLines …) benutzt – nur das Legen übernimmt ein Bot.
//
// Zwei Bots:
//   planer   wertet jeden möglichen Zug nach Gewinn für die Bestellung aus (ein Zug Vorausschau)
//   casual   legt "wo es passt" und nimmt Reihen mit, achtet aber nicht auf Sorten
// Das Limit wird so gesetzt, dass der Planer ein Level in etwa target(n) der Versuche schafft.
// Läuft die Schachtel voll ("voll %"), zählt der Versuch als verloren, geht aber nicht ins Limit ein.
// Beide Bots planen keine sortenreinen Reihen und keine Doppel-Reihen im Voraus – wer das tut,
// kommt mit weniger Zügen aus. Genau dieser Abstand ist der Spielraum für die Sterne.
const { chromium } = require('playwright');
const path = require('path');

const LEVELS = 40, RUNS = 60;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  const out = await page.evaluate(({ LEVELS, RUNS, check }) => {
    clearTimeout(idleT);
    const adj = (tmp, pc, r, c) => { let s = 0; pc.sh.forEach(([a, b]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => { const R = r + a + dr, C = c + b + dc; if (R < 0 || C < 0 || R >= N || C >= N || tmp[R][C] !== -1) s += .5; })); return s; };
    function pick(planner) {
      let best = null;
      G.tray.forEach((pc, k) => { if (!pc) return;
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (!fitsAt(pc, r, c)) continue;
          const tmp = G.grid.map(x => x.slice()); pc.sh.forEach(([a, b]) => tmp[r + a][c + b] = pc.t);
          const sl = scoreLines(tmp); let sc = adj(tmp, pc, r, c) + Math.random();
          if (planner) { let g = 0; G.goals.forEach(o => g += Math.min(Math.max(0, o.need - o.have), sl.gain[o.t] || 0)); sc += g * 10 + sl.lines.length * 4 + bonusMoves(sl.lines.length) * 25; }
          else sc += sl.lines.length * 10;
          if (!best || sc > best.sc) best = { k, r, c, sc }; } });
      return best;
    }
    // Liefert die netto verbrauchten Züge bis zum Sieg (geschenkte Züge abgezogen), Infinity wenn die Schachtel vollläuft.
    function sim(n, planner) {
      initLevel(n); let used = 0, bonus = 0, peak = 0;
      while (used < 150) {
        const m = pick(planner); if (!m) return Infinity;
        const pc = G.tray[m.k]; pc.sh.forEach(([a, b]) => G.grid[m.r + a][m.c + b] = pc.t); G.tray[m.k] = null; used++;
        peak = Math.max(peak, used - bonus);
        const sl = scoreLines(G.grid);
        if (sl.lines.length) { G.goals.forEach(o => { if (sl.gain[o.t]) o.have += sl.gain[o.t]; }); sl.seen.forEach(key => G.grid[Math.floor(key / N)][key % N] = -1); bonus += bonusMoves(sl.lines.length); }
        if (G.goals.every(o => o.have >= o.need)) return { peak, left: bonus - used };
        if (G.tray.every(x => !x)) refill();
      }
      return Infinity;
    }
    const target = n => n <= 1 ? 1 : n === 2 ? .9 : n <= 5 ? .7 : params(n).hard ? .45 : .6;
    const rows = [], moves = [];
    for (let n = 1; n <= LEVELS; n++) {
      const run = pl => [...Array(RUNS)].map(() => sim(n, pl));
      const A = run(true), B = run(false), pk = x => x === Infinity ? Infinity : x.peak;
      const sorted = A.map(pk).sort((a, b) => a - b), fin = sorted.filter(isFinite);
      const M0 = fin[Math.min(fin.length - 1, Math.ceil(target(n) * fin.length) - 1)];
      let M = check ? params(n).moves : M0;
      if (n === 1 && !check) M += 4;
      const p = params(n), s3 = check ? p.s3 : Math.max(2, Math.round(M * .15));
      const rate = (X, lim) => Math.round(X.filter(x => pk(x) <= lim).length / RUNS * 100);
      const star3 = Math.round(A.filter(x => x !== Infinity && x.peak <= M && M + x.left >= s3).length / RUNS * 100);
      moves.push(M);
      rows.push({ n, types: p.types, goals: p.ng + '×' + p.amt, clutter: p.clutter, median: fin[Math.floor(fin.length / 2)], M, 'planer %': rate(A, M), 'planer ★★★ %': star3, 'casual %': rate(B, M), 'voll %': Math.round(A.filter(x => x === Infinity).length / RUNS * 100) });
    }
    return { rows, moves };
  }, { LEVELS, RUNS, check: process.argv.includes('--check') });
  console.table(out.rows);
  console.log('const MOVES=[' + out.moves.join(',') + '];');
  await browser.close();
})();
