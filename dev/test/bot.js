// 貪婪機器人：校準各關目標分數
// node test/bot.js [runs] [levels] [mode=calib|play]
const L = require('../src/logic.js');
const RUNS = +process.argv[2] || 60, LEVELS = +process.argv[3] || 10, MODE = process.argv[4] || 'calib';

function sameNeighbors(st, land, cid) {
  if (!land) return 0;
  return 0;
}
function bestPlace(st) {
  let best = null;
  for (const cid of L.candidates(st)) {
    const v = L.value(st, cid);
    for (let x = 0; x < L.W; x++) {
      const r = L.simulatePlace(st, cid, x);
      if (!r) continue;
      // 鋪陳：落點旁邊有幾個同種分子（之後容易湊 3 個）
      let setup = 0;
      if (r.total === 0 && r.landing) {
        const [lx, ly] = r.landing;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c = st.grid[lx + dx] && st.grid[lx + dx][ly + dy];
          if (c && c.c === cid) setup++;
        }
      }
      const h = L.colItems(st, x).length;
      const score = r.total + setup * v * 0.8 + v * 0.05 - h * 0.3;
      if (!best || score > best.score) best = { cid, x, score, gain: r.total };
    }
  }
  return best;
}
function turn(st) {
  const p = bestPlace(st);
  // 工具：如果比放牌更賺就用
  for (const a of [{ type: 'spark' }, { type: 'temp', dir: 1 }, { type: 'temp', dir: -1 }]) {
    const r = L.simulateAction(st, a);
    if (r && r.total > Math.max(10, p ? p.gain : 0)) return L.act(st, a);
  }
  if (!p) return null;
  for (const e of L.C[p.cid].els) usage[e] = (usage[e] || 0) + L.C[p.cid].counts[e];
  return L.act(st, { type: 'place', cid: p.cid, x: p.x });
}
// 選補給：器材 > 最常用元素的強化 > 新元素（還不到 6 種時）> 反應台 > 其他
const usage = {};
function chooseOffer(st) {
  const o = st.offers;
  const score = (x) => {
    if (x.type === 'relic') return 100;
    if (x.type === 'upgrade') return 50 + (usage[x.e] || 0) / 10;
    if (x.type === 'element') return st.unlocked.length < 6 ? 60 : 20;
    if (x.type === 'tray') return 40;
    return 1;
  };
  let i = 0;
  o.forEach((x, k) => { if (score(x) > score(o[i])) i = k; });
  L.takeOffer(st, i);
}

const per = Array.from({ length: LEVELS }, () => []);
const clears = new Array(LEVELS).fill(0), reach = new Array(LEVELS).fill(0);
const t0 = Date.now();
for (let run = 0; run < RUNS; run++) {
  const st = L.newRun(50000 + run);
  for (const k in usage) delete usage[k];
  for (let lv = 0; lv < LEVELS; lv++) {
    reach[lv]++;
    if (MODE === 'calib') st.target = Infinity;
    while (st.phase === 'play') if (!turn(st)) break;
    per[lv].push(st.score);
    if (MODE === 'calib') {
      st.phase = 'clear'; st.picks = 1; st.offers = L.makeOffers(st);
    } else if (st.phase !== 'clear') break;
    clears[lv]++;
    while (st.picks > 0 && st.offers.length) chooseOffer(st);
    L.nextLevel(st);
  }
}
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
for (let lv = 0; lv < LEVELS; lv++) {
  const a = per[lv];
  if (!a.length) break;
  console.log(`Lv${lv + 1}  目標 ${L.targetFor(lv + 1)}  分數 p25 ${q(a, 0.25)}  中位 ${q(a, 0.5)}  p75 ${q(a, 0.75)}` + (MODE === 'play' ? `  過關 ${clears[lv]}/${reach[lv]}` : ''));
}
console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
