// node test/logic.test.js
const assert = require('assert');
const L = require('../src/logic.js');

let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass++; };

// 1. 資料完整
for (const id in L.C) ok(L.parseFormula(id), id);
for (const rx of L.RX) {
  for (const s of [rx.a, rx.b, ...rx.full, ...rx.keep]) ok(L.C[s], `反應 ${rx.key} 的 ${s} 不在資料中`);
  ok(rx.keep.length <= 2 && rx.keep.every((k) => rx.full.includes(k)), `keep ⊆ full: ${rx.key}`);
}
for (const id in L.C) {
  const d = L.C[id].dec;
  if (!d) continue;
  for (const s of [...d.full, ...d.keep]) ok(L.C[s], `分解 ${id} 的 ${s} 不在資料中`);
  ok(d.keep.length <= 2 && d.keep.every((k) => d.full.includes(k)), `dec keep ⊆ full: ${id}`);
}

// 2. 全部配平、係數為正整數
const bad = [];
for (const rx of L.RX) if (!L.balance(rx.a === rx.b ? [rx.a] : [rx.a, rx.b], rx.full)) bad.push(rx.key);
for (const id in L.C) if (L.C[id].dec && !L.balance([id], L.C[id].dec.full)) bad.push('dec:' + id);
ok(bad.length === 0, '無法配平: ' + bad.join(', '));
const show = ['H2+O2', 'NH3+O2', 'CH3Cl+O2', 'Cl2+NaOH', 'NO2+H2O', 'F2+CH4', 'H2S+SO2', 'NaHCO3+H2SO4', 'Ca(OH)2+CH3COOH', 'CaC2+H2O', 'Mg+CO2'];
for (const k of show) { const rx = L.RX.find((r) => r.key === k); console.log('  ', L.rxEquation(rx, false)); }
for (const id of ['NaHCO3', 'Mg(NO3)2', 'HNO3', 'CH3COONa', 'Mg(CH3COO)2']) console.log('  ', L.decEquation(id, false), `(≥${L.C[id].dec.t}°C)`);
console.log(`  反應 ${L.RX.length} 條、物質 ${Object.keys(L.C).length} 種`);

// 3. 室溫物態
const R = L.ROOM;
const expect = { H2O: 'l', CO2: 'g', NaCl: 's', CH3COOH: 'l', HF: 'g', NO2: 'g', H2SO4: 'l', C6H6: 'l', Na: 's', SO3: 'l', CCl4: 'l', CH3CHO: 'g', I2: null };
for (const [id, ph] of Object.entries(expect)) if (ph) ok(L.phaseAt(id, R) === ph, `${id} 室溫應為 ${ph}`);
ok(L.phaseAt('O2', 0) === 'l' && L.phaseAt('N2', 0) === 'l' && L.phaseAt('CH4', 0) === 's', '液態氮溫度');
ok(L.phaseAt('CO2', 1) === 's' && L.phaseAt('NH3', 2) === 'l', '乾冰、冷凍');
ok(L.phaseAt('H2O', 4) === 'g' && L.phaseAt('Na', 4) === 'l' && L.phaseAt('S', 4) === 's', '110°C');
ok(L.phaseAt('H2SO4', 5) === 'g' && L.phaseAt('S', 5) === 'l' && L.phaseAt('NaCl', 6) === 'l' && L.phaseAt('Na', 6) === 'g', '高溫');

// 4. 平衡式抑制：高溫不會合成會分解的產物
const st0 = L.newRun(1);
st0.T = 6;
ok(!L.rxActive(st0, L.PAIR.get('N2|H2').rx, false), '900°C 不會合成氨');
st0.T = 5;
ok(L.rxActive(st0, L.PAIR.get('N2|H2').rx, false), '350°C 哈伯法');
ok(!L.rxActive(st0, L.PAIR.get('NH3|HCl').rx, false), '350°C 氯化銨分解，不會生成');

// 5. 具體情境：放 3 個水 → 收集
{
  const st = L.newRun(7);
  st.tray = ['H', 'H', 'H', 'H', 'H', 'H', 'O', 'O', 'O'].slice(0, 7);
  st.traySize = 7;
  st.tray = ['H', 'H', 'O', 'H', 'H', 'O', 'O'];
  let r = L.act(st, { type: 'place', cid: 'H2O', x: 0 });
  ok(r && r.total === 0, '第一杯水沒分數');
  st.tray = ['H', 'H', 'O', 'H', 'H', 'O', 'O'];
  L.act(st, { type: 'place', cid: 'H2O', x: 1 });
  st.tray = ['H', 'H', 'O', 'H', 'H', 'O', 'O'];
  r = L.act(st, { type: 'place', cid: 'H2O', x: 2 });
  ok(r.total > 0 && r.steps.some((s) => s.kind === 'cluster'), '三個水相連 → 收集');
  ok(L.colItems(st, 0).length === 0, '收集後杯子清空');
}
// 氣體往上、液體往下
{
  const st = L.newRun(8);
  st.tray = ['H', 'H', 'O', 'O', 'H', 'H', 'O'];
  L.act(st, { type: 'place', cid: 'H2O', x: 3 });
  st.tray = ['H', 'H', 'O', 'O', 'H', 'H', 'O'];
  L.act(st, { type: 'place', cid: 'H2', x: 3 });
  ok(st.grid[3][0] && st.grid[3][0].c === 'H2' && st.grid[3][L.H - 1].c === 'H2O', '氫氣在頂、水在底');
  // 加熱到 110°C → 水變氣體往上
  L.act(st, { type: 'temp', dir: +1 });
  ok(st.grid[3][0].c === 'H2' && st.grid[3][1].c === 'H2O', '水蒸氣升到氫氣下方');
}
// 火花：氫氧相鄰燃燒成水
{
  const st = L.newRun(9);
  st.tray = ['H', 'H', 'O', 'O', 'H', 'H', 'O'];
  L.act(st, { type: 'place', cid: 'H2', x: 0 });
  st.tray = ['H', 'H', 'O', 'O', 'H', 'H', 'O'];
  L.act(st, { type: 'place', cid: 'O2', x: 1 });
  ok(L.sparkable(st), '氫氧相鄰可點火');
  const r = L.act(st, { type: 'spark' });
  ok(r && r.steps.some((s) => s.kind === 'react'), '點火後燃燒');
  ok(L.colItems(st, 0).concat(L.colItems(st, 1)).every((c) => c.c === 'H2O'), '產物是水');
}

// 6. 隨機對局：不當機、不無限連鎖、燒杯結構正確
function checkGrid(st) {
  const ids = new Set();
  for (let x = 0; x < L.W; x++) {
    const col = st.grid[x];
    let seenGap = false, seenCond = false;
    for (let y = 0; y < L.H; y++) {
      const c = col[y];
      if (!c) { if (seenCond) throw new Error('液固體下方有空格'); seenGap = true; continue; }
      if (ids.has(c.id)) throw new Error('重複 id');
      ids.add(c.id);
      const g = L.phaseAt(c.c, st.T) === 'g';
      if (g && seenGap) throw new Error('氣體下方有空格又有氣體');
      if (!g) seenCond = true;
      if (g && seenCond) throw new Error('氣體在液固體下方');
    }
  }
}
let maxDepth = 0, actions = 0, t0 = Date.now();
for (let run = 0; run < 150; run++) {
  const st = L.newRun(1000 + run);
  for (let lv = 0; lv < 8; lv++) {
    while (st.phase === 'play') {
      const roll = L.rand(st);
      let r = null;
      if (roll < 0.08) r = L.act(st, { type: 'temp', dir: L.rand(st) < 0.5 ? 1 : -1 });
      else if (roll < 0.12) r = L.act(st, { type: 'spark' });
      else if (roll < 0.14) r = L.act(st, { type: 'redraw' });
      if (!r) {
        const cand = L.candidates(st);
        const cols = [...Array(L.W).keys()].filter((x) => L.canPlace(st, x));
        r = L.act(st, { type: 'place', cid: cand[Math.floor(L.rand(st) * cand.length)], x: cols[Math.floor(L.rand(st) * cols.length)] });
        if (!r) throw new Error('放不下');
      }
      actions++;
      maxDepth = Math.max(maxDepth, r.depth);
      checkGrid(st);
    }
    if (st.phase === 'fail') { st.score = st.target; st.phase = 'play'; st.turnsLeft = 1; }
    if (st.phase === 'play') continue;
    // 過關：把元素全部解鎖測試
    while (st.picks > 0 && st.offers.length) L.takeOffer(st, 0);
    L.nextLevel(st);
  }
}
ok(maxDepth < 60, '連鎖沒有卡在上限');
console.log(`  隨機對局 ${actions} 步，最長連鎖 ${maxDepth} 段，${Date.now() - t0}ms`);

console.log(`\n✓ ${pass} checks passed`);

// 7. 提示
{
  const st = L.newRun(42);
  st.tray = ['H', 'H', 'H', 'H', 'O', 'O', 'O'];
  let h = L.hint(st);
  ok(h && h.kind === 'start', '空燒杯 → 建議從頭開始: ' + JSON.stringify(h && h.kind));
  L.act(st, { type: 'place', cid: 'H2O', x: 0 });
  st.tray = ['H', 'H', 'H', 'H', 'O', 'O', 'O'];
  h = L.hint(st);
  ok(h && h.kind === 'setup' && h.cid === 'H2O' && h.adj === 1, '一個水 → 建議湊一對: ' + JSON.stringify([h.kind, h.cid, h.x]));
  L.act(st, { type: 'place', cid: 'H2O', x: 1 });
  st.tray = ['H', 'H', 'H', 'H', 'O', 'O', 'O'];
  h = L.hint(st);
  ok(h && h.kind === 'place' && h.cid === 'H2O' && h.total > 0 && h.events[0].k === 'cl', '兩個水 → 建議收集: ' + JSON.stringify([h.kind, h.cid, h.x, h.total]));
  // 火花提示
  const s2 = L.newRun(43);
  s2.tray = ['H', 'H', 'O', 'O', 'H', 'H', 'O'];
  L.act(s2, { type: 'place', cid: 'H2', x: 0 });
  s2.tray = ['H', 'H', 'O', 'O', 'H', 'H', 'O'];
  L.act(s2, { type: 'place', cid: 'O2', x: 1 });
  s2.tray = ['O', 'O', 'O', 'O', 'O', 'O', 'O'];
  h = L.hint(s2);
  ok(h && h.kind === 'tool' && h.action.type === 'spark', '氫氧相鄰 → 建議火花: ' + JSON.stringify(h && [h.kind, h.action]));
  // 效能
  const s3 = L.newRun(44);
  for (const e of L.UNLOCK_ORDER) { s3.unlocked.push(e); s3.bag[e] = 2; }
  s3.traySize = 12; s3.tray = []; 
  const t0 = Date.now();
  for (let i = 0; i < 10; i++) { s3.tray = ['H','H','H','C','N','O','O','Na','Cl','S','Ca','Mg']; L.hint(s3); }
  console.log(`  提示計算 ${((Date.now() - t0) / 10).toFixed(1)} ms/次（12 個原子、全部元素）`);
}
console.log(`\n✓ ${pass} checks passed (含提示)`);
