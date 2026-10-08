// 電腦玩家：校準故事關卡難度
// node test/bot.js [runs=40] [關卡 id 前綴，例如 2- 或 3-4]
// 輸出每關：過關率、星數、剩餘回合、估計人類時間
const L = require('../src/logic.js');
const LV = require('../src/levels.js');

/** 落點附近有沒有「之後可以觸發」的反應夥伴、同種分子 */
function setupScore(st, cid, r) {
  if (!r.landing) return 0;
  const [lx, ly] = r.landing;
  let s = 0;
  const v = L.value(st, cid);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = st.grid[lx + dx] && st.grid[lx + dx][ly + dy];
    if (!c) continue;
    if (c.c === cid) s += v * 0.8;
    const list = L.PAIR.get(cid + '|' + c.c);
    if (list) {
      for (const { rx } of list) {
        const goalHit = st.goals.some((g) => (g.t === 'make' || g.t === 'collect') && rx.full.includes(g.c));
        s += goalHit ? 60 : 6;
      }
    }
  }
  return s;
}
/** 這個反應在這一關有沒有辦法觸發 */
function reachable(st, rx) {
  const maxT = L.TEMPS[Math.max(...st.temps)].t;
  if (rx.cat && st.catsAvail.includes(rx.cat.k) && st.charges.cat > 0 && maxT >= rx.cat.t) return true;
  if (rx.cond === 'auto') return true;
  if (typeof rx.cond === 'number') return maxT >= rx.cond;
  if (rx.cond === 'burn') return st.charges.spark > 0 || (L.C[rx.a].ai != null && maxT >= L.C[rx.a].ai);
  if (rx.cond === 'spark') return st.charges.spark > 0;
  if (rx.cond === 'uv') return st.charges.uv > 0;
  return false;
}
function goalReactant(st, cid) {
  let s = 0;
  for (const g of st.goals) {
    if (g.t !== 'make' && g.t !== 'collect') continue;
    if (g.t === 'collect' && cid === g.c) s += 40;
    for (const rx of L.RX) if ((rx.a === cid || rx.b === cid) && rx.full.includes(g.c) && reachable(st, rx)) { s += 30; break; }
    const c = L.C[cid];
    if (c.dec && c.dec.keep.includes(g.c)) s += 10;
    if (L.ELEC[cid] && L.ELEC[cid].keep.includes(g.c) && st.charges.electro > 0) s += 14;
    if (c.pho && c.pho.keep.includes(g.c) && st.charges.uv > 0) s += 14;
  }
  return s;
}
const actVal = (st, r) => r.total + L.goalGain(st, r.tally) + (r.st && r.st.phase === 'clear' ? 1e6 : 0);
/** 放下去之後，再用一次工具（不花回合）能得到多少 */
function followUp(st, a) {
  const s = L.lite(st);
  const r0 = L.act(s, a);
  if (!r0) return 0;
  if (s.phase === 'clear') return 1e6;
  let best = 0;
  for (const t of L.toolActions(s)) {
    if (t.type === 'tool' && !['cat', 'electro', 'flame', 'filter', 'distill'].includes(t.k)) continue;
    const r = L.simulateAction(s, t);
    if (r) best = Math.max(best, actVal(s, r));
  }
  return best;
}
function turn(st, rnd) {
  let best = null;
  const cands = L.candidates(st);
  const deep = cands.length * L.W <= 90;
  for (const cid of cands) {
    const v0 = L.value(st, cid);
    const gr = goalReactant(st, cid);
    for (let x = 0; x < L.W; x++) {
      const r = L.simulatePlace(st, cid, x);
      if (!r) continue;
      const h = L.colItems(st, x).length;
      const now = r.total + L.goalGain(st, r.tally);
      let score = now + (r.total === 0 ? setupScore(st, cid, r) : 0) + gr + v0 * 0.05 - h * 0.6 + rnd() * 3;
      if (deep && now === 0 && (setupScore(st, cid, r) > 0 || gr > 0)) score += 0.85 * followUp(st, { type: 'place', cid, x });
      if (!best || score > best.score) best = { a: { type: 'place', cid, x }, score, gain: r.total };
    }
  }
  let tool = null;
  for (const a of L.toolActions(st)) {
    const r = L.simulateAction(st, a);
    if (!r) continue;
    const gg = L.goalGain(st, r.tally);
    const win = r.st.phase === 'clear';
    let v = r.total + gg + (win ? 1e6 : 0);
    let worth = win || gg > 0 || r.depth >= 2 || r.total >= 20;
    // 有收集／製造目標時，不把儀器浪費在湊分數上（玩家也不會）
    const goalLevel = st.goals.some((g) => g.t !== 'score');
    if (goalLevel && a.type === 'tool' && a.k !== 'cat' && !win && gg <= 0) worth = false;
    // 兩步：先調溫度／加觸媒（沒有立即效果），下一步再用工具
    if (!worth && (a.type === 'temp' || (a.type === 'tool' && a.k === 'cat'))) {
      let b2 = 0;
      for (const t of L.toolActions(r.st)) { if (t.type === 'temp') continue; const r2 = L.simulateAction(r.st, t); if (r2) b2 = Math.max(b2, actVal(r.st, r2)); }
      if (b2 >= 20) { v = 0.8 * b2; worth = true; }
    }
    if (worth && v > 0 && (!tool || v > tool.v)) tool = { a, v };
  }
  if (tool && (!best || tool.v >= best.score * 0.7)) return L.act(st, tool.a);
  if (best) return L.act(st, best.a);
  if (st.charges.redraw > 0) return L.act(st, { type: 'redraw' });
  return null;
}
function playLevel(def, seed) {
  const st = L.newLevel(def, seed);
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  let places = 0, tools = 0;
  for (let k = 0; k < 80 && st.phase === 'play'; k++) {
    const n0 = st.turnsLeft;
    const r = turn(st, rnd);
    if (!r) break;
    if (st.turnsLeft !== n0) places++; else tools++;
  }
  return { clear: st.phase === 'clear', stars: st.phase === 'clear' ? st.stars : 0, turnsLeft: st.turnsLeft, score: st.score, places, tools, chain: st.best.chain, st };
}
// 人類時間估計：每放一個分子 ~9 秒（看提示、選、放、看動畫）、每次用工具 ~6 秒、每關開場與結算 ~25 秒
const humanSec = (r) => r.places * 9 + r.tools * 6 + 25;

if (require.main === module) {
  const RUNS = +process.argv[2] || 40;
  const pre = process.argv[3] || '';
  let totalMin = 0, n = 0;
  const t0 = Date.now();
  for (const ch of LV.CHAPTERS) {
    let chMin = 0;
    for (const d of ch.levels) {
      if (!d.id.startsWith(pre)) continue;
      const rs = [];
      for (let i = 0; i < RUNS; i++) rs.push(playLevel(d, 9001 + i * 7919));
      const clr = rs.filter((r) => r.clear);
      const rate = clr.length / RUNS;
      const avg = (f, a = rs) => (a.length ? a.reduce((s, r) => s + f(r), 0) / a.length : 0);
      const sec = avg(humanSec);
      const tries = Math.min(3, rate > 0 ? 1 / rate : 3); // 期望嘗試次數（上限 3：之後玩家通常會想通）
      const min = (sec * tries) / 60;
      chMin += min;
      n++;
      const st3 = [1, 2, 3].map((k) => clr.filter((r) => r.stars >= k).length);
      const tl = clr.map((r) => r.turnsLeft).sort((a, b) => a - b);
      const q = (p) => (tl.length ? tl[Math.floor(p * (tl.length - 1))] : '-');
      console.log(`${d.id.padEnd(5)} ${(d.title || '').padEnd(8, '　')} 過關 ${(rate * 100).toFixed(0).padStart(3)}%  ★2 ${String(st3[1]).padStart(2)} ★3 ${String(st3[2]).padStart(2)}/${RUNS}  剩回合 ${q(0.25)}/${q(0.5)}/${q(0.75)}  分 ${avg((r) => r.score).toFixed(0).padStart(4)}  鏈 ${avg((r) => r.chain).toFixed(1)}  放 ${avg((r) => r.places).toFixed(1)} 具 ${avg((r) => r.tools).toFixed(1)}  ≈${min.toFixed(1)}分`);
    }
    if (chMin) console.log(`  ── 第 ${ch.id} 章 ≈ ${chMin.toFixed(0)} 分鐘`);
    totalMin += chMin;
  }
  console.log(`共 ${n} 關，估計 ${totalMin.toFixed(0)} 分鐘（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
}
module.exports = { playLevel, turn, humanSec };
