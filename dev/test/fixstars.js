// 依「束搜尋＋電腦玩家」每個盤面的最佳結果，修正做不到的 ★ 回合門檻
// node test/fixstars.js [seeds=8]  → 直接改寫 src/levels.js，並印出改了哪些
const fs = require('fs');
const path = require('path');
const L = require('../src/logic.js');
const LV = require('../src/levels.js');
const { playLevel } = require('./bot.js');
const audit = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit.json'), 'utf8'));
const SEEDS = +process.argv[2] || 8;
const file = path.join(__dirname, '../src/levels.js');
let src = fs.readFileSync(file, 'utf8');
const changes = [];
for (const d of LV.ALL) {
  if (d.hand || !d.stars) continue;
  const a = audit.find((x) => x.id === d.id);
  // 每個盤面的最佳剩餘回合：束搜尋（a.bestTurnsLeft 只記過關的）與電腦玩家取大；沒過關記 -1
  const beamVals = (a ? a.bestTurnsLeft.slice() : []);
  while (beamVals.length < SEEDS) beamVals.push(-1);
  const botVals = [];
  for (let i = 0; i < SEEDS; i++) {
    let best = -1;
    for (let k = 0; k < 3; k++) { const r = playLevel(d, 31337 + i * 101 + k * 7); if (r.clear) best = Math.max(best, r.turnsLeft); }
    botVals.push(best);
  }
  beamVals.sort((x, y) => x - y);
  botVals.sort((x, y) => x - y);
  const vals = beamVals.map((v, i) => Math.max(v, botVals[i])).sort((x, y) => x - y);
  const rate = (n) => vals.filter((v) => v >= n).length / vals.length;
  const q = (p) => vals[Math.floor(p * (vals.length - 1))];
  const ns = d.stars.map((r) => ({ ...r }));
  const turnIdx = ns.map((r, k) => (r.t === 'turns' ? k : -1)).filter((k) => k >= 0);
  for (const k of turnIdx) {
    const isTop = k === ns.length - 1;
    const need = isTop ? 0.45 : 0.7;
    if (rate(ns[k].n) >= need) continue;
    ns[k].n = Math.max(1, Math.min(ns[k].n, q(isTop ? 0.5 : 0.25)));
  }
  // ★3 必須比 ★2 難：兩個都是回合條件時，★2 至少少 1
  if (ns.length === 2 && ns[0].t === 'turns' && ns[1].t === 'turns' && ns[0].n >= ns[1].n) ns[0].n = Math.max(1, ns[1].n - 1);
  const before = JSON.stringify(d.stars), after = JSON.stringify(ns);
  if (before === after) continue;
  const fmt = (arr) => '[' + arr.map((r) => '{ ' + Object.entries(r).map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : v}`).join(', ') + ' }').join(', ') + ']';
  const re = new RegExp(`(id: '${d.id}'[^\\n]*?stars: )\\[[^\\]]*\\]`);
  if (!re.test(src)) { console.log('找不到', d.id); continue; }
  src = src.replace(re, `$1${fmt(ns)}`);
  changes.push(`${d.id} ${d.title}：${d.stars.map((r) => r.t + r.n).join(' ')} → ${ns.map((r) => r.t + r.n).join(' ')}  （各盤面最佳剩回合 ${vals.join(',')}）`);
}
fs.writeFileSync(file, src);
console.log(changes.join('\n') || '沒有要改的');
