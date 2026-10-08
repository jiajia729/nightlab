// 校準：把每關目標設成無限大，讓電腦玩家玩完所有回合，看各目標能做到多少
// node test/calib.js [runs=40] [關卡前綴]
// 建議值：目標 = p30（電腦玩家約 70% 過關）；★2 剩餘回合 = 中位數、★3 = p80
const L = require('../src/logic.js');
const LV = require('../src/levels.js');
const { playLevel } = require('./bot.js');
const RUNS = +process.argv[2] || 40, pre = process.argv[3] || '';
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : 0; };
for (const d of LV.ALL) {
  if (!d.id.startsWith(pre) || d.hand) continue;
  const inf = { ...d, goals: d.goals.map((g) => ({ ...g, n: 1e9 })) };
  const prog = d.goals.map(() => []);
  for (let i = 0; i < RUNS; i++) {
    const r = playLevel(inf, 777 + i * 131);
    d.goals.forEach((g, k) => prog[k].push(L.goalProgress(r.st, { ...g, n: 1e9 })[0]));
  }
  const sug = d.goals.map((g, k) => `${g.t}${g.c ? ' ' + g.c : ''} 現 ${g.n} → p20/30/50 ${q(prog[k], 0.2)}/${q(prog[k], 0.3)}/${q(prog[k], 0.5)}`);
  // 用現在的目標玩，看剩餘回合
  const tl = [];
  let clr = 0;
  for (let i = 0; i < RUNS; i++) { const r = playLevel(d, 99 + i * 17); if (r.clear) { clr++; tl.push(r.turnsLeft); } }
  console.log(`${d.id.padEnd(4)} ${sug.join(' ｜ ')} ｜ 過關 ${Math.round((clr / RUNS) * 100)}% 剩回合 p50 ${q(tl, 0.5)} p80 ${q(tl, 0.8)}`);
}
