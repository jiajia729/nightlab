// 電腦玩家：校準故事關卡難度
// node test/bot.js [runs=40] [關卡 id 前綴，例如 2- 或 3-4]
// 輸出每關：過關率、星數、剩餘回合、估計人類時間
const L = require('../src/logic.js');
const LV = require('../src/levels.js');

function turn(st, rnd) {
  const h = L.advise(st, rnd);
  if (h) return L.act(st, h.action);
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
