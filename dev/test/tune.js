// 自動調整門檻：node test/tune.js [runs] [前綴] > tune.json
// 每個 n 型目標 → 無限目標時電腦玩家做到的 p35；之後用新目標玩，★ 回合門檻 → 過關者剩餘回合的 p45 / p85
const L = require('../src/logic.js');
const LV = require('../src/levels.js');
const { playLevel } = require('./bot.js');
const RUNS = +process.argv[2] || 40, pre = process.argv[3] || '';
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : 0; };
const out = {};
for (const d of LV.ALL) {
  if (!d.id.startsWith(pre) || d.hand) continue;
  const prog = d.goals.map(() => []);
  for (let i = 0; i < RUNS; i++) {
    const r = playLevel({ ...d, turns: d.turns - 3, goals: d.goals.map((g) => ({ ...g, n: 1e9 })) }, 777 + i * 131);
    d.goals.forEach((g, k) => prog[k].push(L.goalProgress(r.st, { ...g, n: 1e9 })[0]));
  }
  const goals = d.goals.map((g, k) => {
    if (g.t === 'clear') return null;
    const multi = d.goals.filter((x) => x.t !== 'clear').length > 1;
    let n = q(prog[k], multi ? 0.25 : 0.35);
    if (g.t === 'score') n = Math.max(10, Math.round(n / 5) * 5);
    else n = Math.max(g.t === 'make' || g.t === 'collect' ? 2 : 1, Math.min(n, g.t === 'flames' ? 5 : 6));
    return n;
  });
  const nd = { ...d, goals: d.goals.map((g, k) => (goals[k] == null ? g : { ...g, n: goals[k] })) };
  const tl = [];
  let clr = 0;
  for (let i = 0; i < RUNS; i++) { const r = playLevel(nd, 99 + i * 17); if (r.clear) { clr++; tl.push(r.turnsLeft); } }
  let stars = (d.stars || []).map((r, k) => (r.t !== 'turns' ? null : Math.max(1, q(tl, k === 0 ? 0.45 : 0.85))));
  if (stars[0] != null && stars[1] != null && stars[1] <= stars[0]) stars[1] = stars[0] + 1;
  out[d.id] = { goals, stars, pass: Math.round((clr / RUNS) * 100) };
  console.error(d.id, JSON.stringify(out[d.id]));
}
console.log(JSON.stringify(out));
