// 星星條件檢查：用束搜尋（beam search）對每關、每顆星找實際做得到的解
// node test/audit.js [前綴] [seeds=6] [beam=24]  → 印出每顆星在幾個盤面上找得到解
const L = require('../src/logic.js');
const LV = require('../src/levels.js');
const PRE = process.argv[2] || '', SEEDS = +process.argv[3] || 6, BEAM = +process.argv[4] || 24;

const clone = (s) => JSON.parse(JSON.stringify(s));
function progress(st) {
  let p = 0;
  for (const g of st.goals || []) { const [a, b] = L.goalProgress(st, g); p += Math.min(1, a / Math.max(1, b)); }
  return p / Math.max(1, (st.goals || []).length);
}
function actions(st, ban) {
  const out = [];
  for (const a of L.toolActions(st)) {
    const k = a.type === 'tool' ? a.k : a.type;
    if (ban && ban === k) continue;
    out.push(a);
  }
  if (st.charges.redraw > 0 && ban !== 'redraw') out.push({ type: 'redraw' });
  if (st.hand) { for (const a of puzzleActs(st)) out.push(a); return out; }
  const seen = new Set();
  for (const cid of L.candidates(st)) {
    for (let x = 0; x < L.W; x++) {
      if (!L.canPlace(st, x)) continue;
      // 同一欄高度相同、左右鄰居相同的欄位視為對稱，只留一個
      const key = cid + '|' + JSON.stringify([x > 0 ? st.grid[x - 1].map((c) => c && c.c) : 0, st.grid[x].map((c) => c && c.c), x < L.W - 1 ? st.grid[x + 1].map((c) => c && c.c) : 0]);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type: 'place', cid, x });
    }
  }
  return out;
}
function puzzleActs(st) {
  const out = [];
  for (const cid of new Set(st.hand)) for (let x = 0; x < L.W; x++) if (L.canPlace(st, x)) out.push({ type: 'place', cid, x });
  return out;
}
// 束搜尋：每一層 = 放一次分子；工具不花回合，可以在放之前或之後各用一次
const tag = (a) => (a.type === 'place' ? a.cid + '@' + (a.x + 1) : a.type === 'tool' ? a.k + (a.x != null ? '@' + (a.x + 1) : a.cat ? ':' + a.cat : '') : a.type + (a.dir ? (a.dir > 0 ? '+' : '-') : ''));
function apply(st, a) { const s = clone(st); if (!L.act(s, a)) return null; s._path = (st._path || []).concat(tag(a)); return s; }
function toolsOf(st, ban) {
  const out = [];
  for (const a of L.toolActions(st)) { const k = a.type === 'tool' ? a.k : a.type; if (ban !== k) out.push(a); }
  if (st.charges.redraw > 0 && ban !== 'redraw' && !st.hand) out.push({ type: 'redraw' });
  return out;
}
function placesOf(st) {
  const out = [], seen = new Set();
  const cands = st.hand ? [...new Set(st.hand)] : L.candidates(st);
  for (const cid of cands) {
    for (let x = 0; x < L.W; x++) {
      if (!L.canPlace(st, x)) continue;
      const key = cid + '|' + JSON.stringify([x > 0 ? st.grid[x - 1].map((c) => c && c.c) : 0, st.grid[x].map((c) => c && c.c), x < L.W - 1 ? st.grid[x + 1].map((c) => c && c.c) : 0]);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type: 'place', cid, x });
    }
  }
  return out;
}
function beam(def, seed, mode, ban) {
  let layer = [L.newLevel(def, seed)];
  let best = null;
  const better = (s) => {
    if (s.phase !== 'clear') return false;
    if (!best) return true;
    if (mode === 'chain') return s.best.chain > best.best.chain || (s.best.chain === best.best.chain && s.turnsLeft > best.turnsLeft);
    if (mode === 'moves') return s.moves < best.moves;
    return s.turnsLeft > best.turnsLeft;
  };
  const val = (s) => progress(s) * 1000 + s.score * 0.05 + (mode === 'chain' ? s.best.chain * 300 : 0) - (mode === 'moves' ? s.moves * 50 : 0)
    + Object.values(s.charges).reduce((a, b) => a + b, 0) * 3;
  // 只用工具就過關（例如最後一下火花）
  const closeOut = (s, out) => {
    if (s.phase === 'clear') { if (better(s)) best = s; return; }
    if (s.phase !== 'play') return;
    out.push(s);
    for (const t of toolsOf(s, ban)) {
      const s2 = apply(s, t);
      if (!s2) continue;
      if (s2.phase === 'clear') { if (better(s2)) best = s2; continue; }
      if (s2.phase === 'play') {
        out.push(s2);
        for (const t2 of toolsOf(s2, ban)) { const s3 = apply(s2, t2); if (s3 && s3.phase === 'clear' && better(s3)) best = s3; else if (s3 && s3.phase === 'play' && t2.type !== 'redraw') out.push(s3); }
      }
    }
  };
  // 第 0 層：一開始就可以先用工具
  let start = [];
  closeOut(layer[0], start);
  layer = start;
  for (let depth = 0; depth < 30 && layer.length; depth++) {
    const next = [];
    for (const st of layer) for (const a of placesOf(st)) { const s = apply(st, a); if (s) closeOut(s, next); }
    next.sort((a, b) => val(b) - val(a));
    const uniq = [], seen = new Set();
    for (const s of next) {
      const k = JSON.stringify([s.grid.map((c) => c.map((q) => (q ? q.c : 0))), s.T, s.tray, s.prog, s.cats, s.charges]);
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(s);
      if (uniq.length >= BEAM) break;
    }
    layer = uniq;
    if (best && mode !== 'chain' && mode !== 'moves') break; // 每層放一次，第一個過關的層就是剩最多回合
  }
  return best;
}

if (process.env.TRACE) { const d = LV.ALL.find((l) => l.id === process.env.TRACE); const b = beam(d, 4242, 'turns'); console.log(b ? b._path.join(' ') + ' 剩' + b.turnsLeft : '無解'); process.exit(0); }
const report = [];
const t0 = Date.now();
for (const d of LV.ALL) {
  if (!d.id.startsWith(PRE)) continue;
  const seeds = d.hand ? [1] : Array.from({ length: SEEDS }, (_, i) => 4242 + i * 977);
  const res = (d.stars || []).map(() => 0);
  let clearN = 0;
  const tl = [], ch = [], mv = [];
  for (const seed of seeds) {
    const b = beam(d, seed, 'turns');
    if (b) { clearN++; tl.push(b.turnsLeft); mv.push(b.moves); }
    (d.stars || []).forEach((r, k) => {
      let ok = false;
      if (r.t === 'turns') ok = !!b && b.turnsLeft >= r.n;
      else if (r.t === 'score') ok = !!b && b.score >= r.n;
      else if (r.t === 'chain') { const c = beam(d, seed, 'chain'); ok = !!c && c.best.chain >= r.n; if (c) ch.push(c.best.chain); }
      else if (r.t === 'moves') { const m = beam(d, seed, 'moves'); ok = !!m && m.moves <= r.n; if (m) mv.push(m.moves); }
      else if (r.t === 'unused') { const u = beam(d, seed, 'turns', r.k); ok = !!u; }
      if (ok) res[k]++;
    });
  }
  const line = { id: d.id, title: d.title, seeds: seeds.length, clear: clearN, stars: (d.stars || []).map((r, k) => ({ ...r, ok: res[k] })), bestTurnsLeft: tl.sort((a, b) => a - b), chain: ch, moves: mv };
  report.push(line);
  const fmt = (r) => `${r.t}${r.k ? ':' + r.k : ''}${r.n != null ? '≥' + r.n : ''} ${r.ok}/${seeds.length}`.replace('moves≥', 'moves≤');
  const flag = line.stars.some((r) => r.ok === 0) || clearN === 0 ? '  ← 有問題' : '';
  console.log(`${d.id.padEnd(5)} 過關 ${clearN}/${seeds.length}  ${line.stars.map(fmt).join('  ')}  最佳剩回合 [${tl.join(',')}]${flag}`);
}
require('fs').writeFileSync(require('path').join(__dirname, 'audit.json'), JSON.stringify(report, null, 1));
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
