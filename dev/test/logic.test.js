// node test/logic.test.js
const assert = require('assert');
const L = require('../src/logic.js');
const LV = require('../src/levels.js');

let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass++; };
const t0all = Date.now();

// ------------------------------------------------------------ 1. 資料完整
ok(Object.keys(L.ELEMENTS).length >= 22, '元素至少 22 種');
ok(Object.keys(L.C).length >= 180, '物質至少 180 種：' + Object.keys(L.C).length);
ok(L.RX.length >= 300, '反應至少 300 條：' + L.RX.length);
for (const id in L.C) {
  const c = L.C[id];
  ok(L.parseFormula(id), id);
  ok(typeof c.mp === 'number' && typeof c.bp === 'number' && c.mp <= c.bp, `${id} 熔點 ≤ 沸點`);
  ok(c.d > 0 && c.d < 25, `${id} 密度合理`);
  if (c.dec) {
    for (const s of [...c.dec.full, ...c.dec.keep]) ok(L.C[s], `分解 ${id} 的 ${s} 不在資料中`);
    ok(c.dec.keep.length <= 2 && c.dec.keep.every((k) => c.dec.full.includes(k)), `dec keep ⊆ full: ${id}`);
  }
  if (c.pho) ok(c.pho.keep.every((k) => c.pho.full.includes(k)), `pho keep ⊆ full: ${id}`);
}
for (const rx of L.RX) {
  for (const s of [rx.a, rx.b, ...rx.full, ...rx.keep]) ok(L.C[s], `反應 ${rx.key} 的 ${s} 不在資料中`);
  ok(rx.keep.length <= 2 && rx.keep.every((k) => rx.full.includes(k) || (rx.via && k === rx.b)), `keep ⊆ full: ${rx.key}`);
  if (rx.cond === 'cat') ok(rx.cat && L.CATALYSTS[rx.cat.k], `觸媒反應要有觸媒: ${rx.key}`);
}
for (const id in L.ELEC) ok(L.C[id] && L.ELEC[id].full.every((p) => L.C[p]), '電解 ' + id);

// ------------------------------------------------------------ 2. 全部配平、係數為正整數
const bad = [];
for (const rx of L.RX) { const [l, r] = L.rxSides(rx); if (!L.balance(l, r)) bad.push(rx.key); }
for (const id in L.C) {
  if (L.C[id].dec && !L.balance([id], L.C[id].dec.full)) bad.push('dec:' + id);
  if (L.C[id].pho && !L.balance([id], L.C[id].pho.full)) bad.push('pho:' + id);
}
for (const id in L.ELEC) if (!L.balance([id], L.ELEC[id].full)) bad.push('el:' + id);
ok(bad.length === 0, '無法配平: ' + bad.join(', '));
const eq = (k) => L.rxEquation(L.RXKEY.get(k), false);
const expectEq = {
  'H2+O2': '2H₂ + O₂ → 2H₂O',
  'NH3+O2@Pt': '4NH₃ + 5O₂ → 4NO + 6H₂O',
  'KMnO4+HCl': '2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 5Cl₂ + 8H₂O',
  'Cu+HNO3': 'Cu + 4HNO₃ → Cu(NO₃)₂ + 2NO₂ + 2H₂O',
  'Al+Fe2O3': '2Al + Fe₂O₃ → Al₂O₃ + 2Fe',
  'Na2S2O3+I2': '2Na₂S₂O₃ + I₂ → 2NaI + Na₂S₄O₆',
  'H2O2+MnO2': '2H₂O₂ →(MnO₂) 2H₂O + O₂',
  'CuSO4+H2O': 'CuSO₄ + 5H₂O → CuSO₄·5H₂O',
};
for (const [k, v] of Object.entries(expectEq)) ok(eq(k) === v, `${k}: ${eq(k)} ≠ ${v}`);
ok(L.elecEquation('H2O', false) === '2H₂O →(電解) 2H₂ + O₂', L.elecEquation('H2O', false));
ok(L.activeRx(L.newSandbox(), 'AgNO3', 'NaCl', {}), '氯化銀沉澱');
console.log(`  反應 ${L.RX.length} 條、物質 ${Object.keys(L.C).length} 種、元素 ${Object.keys(L.ELEMENTS).length} 種`);

// 反應不能直接反過來（避免無限連鎖）
for (const rx of L.RX) {
  if (rx.keep.length < 2 || rx.via) continue;
  const back = L.PAIR.get(rx.keep[0] + '|' + rx.keep[1]) || [];
  for (const b of back) {
    const prods = new Set(b.rx.keep);
    ok(!(prods.has(rx.a) && prods.has(rx.b) && b.rx.cond === rx.cond), `正逆反應循環: ${rx.key} ⇄ ${b.rx.key}`);
  }
}

// ------------------------------------------------------------ 3. 物態（溫度段 index：0 −196、1 −78、2 0、3 25、4 80、5 110、6 200、7 350、8 900）
const R = L.ROOM;
const expect = { H2O: 'l', CO2: 'g', NaCl: 's', CH3COOH: 'l', HF: 'g', NO2: 'g', H2SO4: 'l', C6H6: 'l', Na: 's', SO3: 'l', CCl4: 'l', CH3CHO: 'g', Br2: 'l', I2: 's', K: 's', AgCl: 's', '(C2H5)2O': 'l' };
for (const [id, ph] of Object.entries(expect)) ok(L.phaseAt(id, R) === ph, `${id} 室溫應為 ${ph}`);
ok(L.phaseAt('O2', 0) === 'l' && L.phaseAt('N2', 0) === 'l' && L.phaseAt('CH4', 0) === 's', '液態氮溫度');
ok(L.phaseAt('CO2', 1) === 's' && L.phaseAt('Br2', 1) === 's' && L.phaseAt('H2O', 2) === 'l' && L.phaseAt('C6H6', 2) === 's', '乾冰、冰浴');
ok(L.phaseAt('C2H5OH', 4) === 'g' && L.phaseAt('C6H6', 4) === 'l' && L.phaseAt('K', 4) === 'l', '水浴 80 °C');
ok(L.phaseAt('H2O', 5) === 'g' && L.phaseAt('Na', 5) === 'l' && L.phaseAt('S', 5) === 's', '110°C');
ok(L.phaseAt('I2', 6) === 'g' && L.phaseAt('S', 6) === 'l', '油浴 200 °C 碘昇華');
ok(L.phaseAt('H2SO4', 7) === 'g' && L.phaseAt('S', 7) === 'l' && L.phaseAt('NaCl', 8) === 'l' && L.phaseAt('Na', 8) === 'g', '高溫');

// ------------------------------------------------------------ 4. 反應條件
const st0 = L.newSandbox();
st0.T = 8;
ok(!L.activeRx(st0, 'N2', 'H2', {}), '900°C 不會合成氨');
st0.T = 7;
ok(!L.activeRx(st0, 'N2', 'H2', {}), '沒有鐵觸媒不會合成氨');
st0.cats = ['Fe'];
ok(L.activeRx(st0, 'N2', 'H2', {}), '有鐵觸媒、350°C 哈伯法');
ok(!L.activeRx(st0, 'NH3', 'HCl', {}), '350°C 氯化銨分解，不會生成');
st0.cats = [];
ok(L.activeRx(st0, 'NH3', 'O2', { spark: true }).rx.key === 'NH3+O2', '沒鉑網：氨燃燒成 N₂');
st0.cats = ['Pt'];
ok(L.activeRx(st0, 'NH3', 'O2', {}).rx.key === 'NH3+O2@Pt', '有鉑網：奧士華法');
st0.T = 3; st0.cats = [];
ok(!L.activeRx(st0, 'CH4', 'Cl2', { spark: true }) && L.activeRx(st0, 'CH4', 'Cl2', { uv: true }), '甲烷氯化要紫外光');
ok(L.activeRx(st0, 'SiH4', 'O2', {}), '矽烷室溫自燃');
ok(!L.activeRx(st0, 'P4', 'O2', {}), '白磷室溫不自燃');
st0.T = 4;
ok(L.activeRx(st0, 'P4', 'O2', {}), '白磷 80 °C 自燃');

// ------------------------------------------------------------ 5. 具體情境
function lvl(over) {
  return L.newLevel({ id: 't', bag: { H: 4, O: 3 }, turns: 14, temps: L.ALL_TEMPS, goals: [{ t: 'score', n: 99999 }], tools: { temp: 9, spark: 9, uv: 9, undo: 3, distill: 3, rotavap: 3, filter: 3, funnel: 3, centri: 3, dry: 3, electro: 3, flame: 3, cat: 3 }, cats: ['Fe', 'Pt', 'V2O5', 'Ni'], ...over }, 7);
}
const H2O3 = ['H', 'H', 'H', 'H', 'O', 'O', 'O'];
{
  const st = lvl();
  st.tray = H2O3.slice();
  let r = L.act(st, { type: 'place', cid: 'H2O', x: 0 });
  ok(r && r.total === 0, '第一杯水沒分數');
  st.tray = H2O3.slice(); L.act(st, { type: 'place', cid: 'H2O', x: 1 });
  st.tray = H2O3.slice(); r = L.act(st, { type: 'place', cid: 'H2O', x: 2 });
  ok(r.total > 0 && r.steps.some((s) => s.kind === 'cluster'), '三個水相連 → 收集');
  ok(L.colItems(st, 0).length === 0 && st.prog.coll.H2O === 3, '收集後杯子清空、計入收集');
  ok(st.turnsLeft === 11 && st.moves === 3, '回合');
}
{ // 氣體往上、液體往下、加熱
  const st = lvl();
  st.tray = H2O3.slice(); L.act(st, { type: 'place', cid: 'H2O', x: 3 });
  st.tray = H2O3.slice(); L.act(st, { type: 'place', cid: 'H2', x: 3 });
  ok(st.grid[3][0].c === 'H2' && st.grid[3][L.H - 1].c === 'H2O', '氫氣在頂、水在底');
  L.act(st, { type: 'temp', dir: +1 });
  ok(st.T === 4 && st.grid[3][L.H - 1].c === 'H2O', '80°C 水還是液體');
  L.act(st, { type: 'temp', dir: +1 });
  ok(st.grid[3][0].c === 'H2' && st.grid[3][1].c === 'H2O', '110°C 水蒸氣升到氫氣下方');
}
{ // 溫度只能在允許的段之間跳
  const st = lvl({ temps: [3, 5, 7] });
  L.act(st, { type: 'temp', dir: 1 });
  ok(st.T === 5, '跳到 110 °C');
  L.act(st, { type: 'temp', dir: 1 });
  ok(st.T === 7 && !L.act(st, { type: 'temp', dir: 1 }), '最高 350 °C');
}
{ // 火花：氫氧相鄰燃燒成水，計入「做出」
  const st = lvl();
  st.tray = H2O3.slice(); L.act(st, { type: 'place', cid: 'H2', x: 0 });
  st.tray = H2O3.slice(); L.act(st, { type: 'place', cid: 'O2', x: 1 });
  ok(L.sparkable(st), '氫氧相鄰可點火');
  const r = L.act(st, { type: 'spark' });
  ok(r && r.steps.some((s) => s.kind === 'react'), '點火後燃燒');
  ok(st.prog.made.H2O === 2, '做出 2 份水: ' + JSON.stringify(st.prog.made));
}
function sb(cols, T = L.ROOM) { // 沙盒擺盤
  const st = L.newSandbox();
  st.T = T;
  cols.forEach((col, x) => col.forEach((id) => L.act(st, { type: 'place', cid: id, x })));
  return st;
}
{ // 蒸餾：沸點最低的液體
  const st = sb([[], [], ['H2O', 'C2H5OH', 'CH3OH']]);
  const r = L.act(st, { type: 'tool', k: 'distill', x: 2 });
  ok(r && r.total > 0 && !L.colItems(st, 2).some((c) => c.c === 'CH3OH') && L.colItems(st, 2).length === 2, '蒸餾出甲醇（沸點最低）');
  ok(st.prog.coll.CH3OH === 1, '蒸餾計入收集');
}
{ // 迴旋濃縮：bp < 100 的液體
  const st = sb([['CH2Cl2'], ['(CH3)2CO', 'H2O'], ['C6H6']]);
  L.act(st, { type: 'tool', k: 'rotavap' });
  ok(L.countIn(st) === 1 && L.countIn(st, 'H2O') === 1, '只剩水');
}
{ // 過濾：沉澱
  const st = sb([[], ['NaCl']]);
  L.act(st, { type: 'place', cid: 'AgNO3', x: 1 });
  ok(L.countIn(st, 'AgCl') === 1 && L.countIn(st, 'NaNO3') === 1, '硝酸銀＋氯化鈉 → 氯化銀沉澱');
  ok(st.prog.made.AgCl === 1, '計入做出 AgCl');
  L.act(st, { type: 'tool', k: 'filter', x: 1 });
  ok(L.countIn(st) === 0, '過濾後該欄固體清空');
}
{ // 分液漏斗：上下層互換
  const st = sb([['H2O', 'CCl4', 'C6H6']]);
  L.act(st, { type: 'tool', k: 'funnel', x: 0 });
  ok(st.grid[0][8].c === 'C6H6' && st.grid[0][6].c === 'H2O', '上下互換');
}
{ // 離心機：依密度
  const st = sb([['C6H6', 'H2O', 'CCl4', 'BaSO4']]);
  L.act(st, { type: 'tool', k: 'centri', x: 0 });
  ok(['BaSO4', 'CCl4', 'H2O', 'C6H6'].every((id, i) => st.grid[0][8 - i].c === id), '密度大的在下: ' + L.colItems(st, 0).map((c) => c.c));
}
{ // 電解水
  const st = sb([['H2O'], [], [], [], [], [], ['HCl']]);
  const r = L.act(st, { type: 'tool', k: 'electro', x: 0 });
  ok(r && L.countIn(st, 'H2') === 1 && L.countIn(st, 'O2') === 0, '電解水 → 氫留下、氧在陽極收集');
  ok(st.prog.made.H2 === 1 && st.prog.made.O2 === 1 && st.prog.coll.O2 === 1, '電解計入做出');
  ok(!L.act(st, { type: 'tool', k: 'electro', x: 6 }), 'HCl 室溫是氣體，不能電解');
}
{ // 熔融鹽電解要夠熱
  const st = sb([['NaCl']], 7);
  ok(!L.act(st, { type: 'tool', k: 'electro', x: 0 }), '350 °C NaCl 還是固體');
  st.T = 8;
  ok(L.act(st, { type: 'tool', k: 'electro', x: 0 }) && L.countIn(st, 'Na') === 1 && st.prog.coll.Cl2 === 1, '900 °C 熔融 NaCl 電解');
}
{ // 乾燥管
  const st = sb([['H2O', 'NaCl'], ['H2O']]);
  L.act(st, { type: 'tool', k: 'dry' });
  ok(L.countIn(st, 'H2O') === 0 && L.countIn(st, 'NaCl') === 1, '水全部吸掉');
}
{ // 焰色
  const st = sb([['NaCl', 'KCl', 'H2O']]);
  const r = L.act(st, { type: 'tool', k: 'flame', x: 0 });
  ok(r && L.countIn(st) === 1 && r.foundRx.includes('flame:Na') && r.foundRx.includes('flame:K'), '焰色反應收集 Na、K');
}
{ // 紫外燈：溴化銀感光
  const st = sb([['AgBr']]);
  ok(L.uvable(st), 'AgBr 可照光');
  const r = L.act(st, { type: 'uv' });
  ok(r && L.countIn(st, 'Ag') === 1 && L.countIn(st, 'Br2') === 1, 'AgBr → Ag + Br₂');
}
{ // 觸媒
  const st = sb([['N2'], ['H2']], 7);
  ok(L.countIn(st, 'NH3') === 0, '沒觸媒不反應');
  const r = L.act(st, { type: 'tool', k: 'cat', cat: 'Fe' });
  ok(r && L.countIn(st, 'NH3') === 2, '加鐵觸媒 → 合成氨: ' + L.countIn(st, 'NH3'));
}
{ // 二氧化錳催化：觸媒不消耗
  const st = sb([['MnO2'], ['H2O2']]);
  ok(L.countIn(st, 'MnO2') === 1 && L.countIn(st, 'H2O2') === 0 && st.prog.made.O2 === 1, 'MnO₂ 留著、放出氧氣');
}
{ // 目標、星星、觸媒不能重複
  const st = lvl({ bag: { H: 2, N: 2, O: 1 }, goals: [{ t: 'make', c: 'NH3', n: 2 }], stars: [{ t: 'turns', n: 10 }, { t: 'unused', k: 'spark' }], T: 7 });
  st.tray = ['H', 'H', 'N', 'N', 'O', 'O', 'O'];
  L.act(st, { type: 'place', cid: 'N2', x: 0 });
  st.tray = ['H', 'H', 'N', 'N', 'O', 'O', 'O'];
  L.act(st, { type: 'place', cid: 'H2', x: 1 });
  ok(st.phase === 'play' && L.goalProgress(st, st.goals[0])[0] === 0, '還沒做出氨');
  L.act(st, { type: 'tool', k: 'cat', cat: 'Fe' });
  ok(st.phase === 'clear' && st.stars === 3, '做出 2 個氨 → 過關 3 星: ' + st.phase + st.stars);
  const s2 = lvl({ T: 7 });
  L.act(s2, { type: 'tool', k: 'cat', cat: 'Fe' });
  ok(!L.act(s2, { type: 'tool', k: 'cat', cat: 'Fe' }), '同一種觸媒不能加兩次');
}
{ // 手牌謎題：用完手牌又沒工具 → 失敗
  const st = L.newLevel({ id: 'p', hand: ['H2O', 'H2O'], turns: 5, goals: [{ t: 'clear' }], grid: [['NaCl']] }, 1);
  L.act(st, { type: 'place', cid: 'H2O', x: 3 });
  L.act(st, { type: 'place', cid: 'H2O', x: 5 });
  ok(st.phase === 'fail' && st.endReason === 'hand', '手牌用完失敗');
}
{ // 求解器
  const st = L.newLevel({ id: 'p', hand: ['H2O', 'Na'], turns: 5, goals: [{ t: 'clear' }], grid: [['H2O', 'H2O']] }, 1);
  const sol = L.solve(st, 3);
  ok(sol && sol.length === 1 && sol[0].cid === 'H2O', '一步解：再放一個水湊三個: ' + JSON.stringify(sol));
}

// ------------------------------------------------------------ 6. 隨機對局（無限挑戰 + 沙盒）：不當機、燒杯結構正確
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
      if (!L.C[c.c]) throw new Error('未知物質 ' + c.c);
      const g = L.phaseAt(c.c, st.T) === 'g';
      if (g && seenGap) throw new Error('氣體下方有空格又有氣體');
      if (!g) seenCond = true;
      if (g && seenCond) throw new Error('氣體在液固體下方');
    }
  }
}
let maxDepth = 0, actions = 0, t0 = Date.now();
for (let run = 0; run < 60; run++) {
  const st = L.newRun(1000 + run);
  for (let lv = 0; lv < 8; lv++) {
    while (st.phase === 'play') {
      const roll = L.rand(st);
      let r = null;
      if (roll < 0.08) r = L.act(st, { type: 'temp', dir: L.rand(st) < 0.5 ? 1 : -1 });
      else if (roll < 0.11) r = L.act(st, { type: 'spark' });
      else if (roll < 0.13) r = L.act(st, { type: 'uv' });
      else if (roll < 0.15) r = L.act(st, { type: 'redraw' });
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
    if (st.phase === 'fail') { st.phase = 'clear'; st.picks = 2; st.offers = L.makeOffers(st); }
    while (st.picks > 0 && st.offers.length) L.takeOffer(st, 0);
    L.nextLevel(st);
  }
}
// 沙盒：全部物質亂放、亂用儀器
{
  const st = L.newSandbox();
  let s = 99;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const ids = Object.keys(L.C);
  for (let i = 0; i < 4000; i++) {
    const roll = rnd();
    let r;
    if (roll < 0.06) r = L.act(st, { type: 'temp', dir: rnd() < 0.5 ? 1 : -1 });
    else if (roll < 0.08) r = L.act(st, { type: 'spark' });
    else if (roll < 0.1) r = L.act(st, { type: 'uv' });
    else if (roll < 0.2) { const k = ['distill', 'rotavap', 'filter', 'funnel', 'centri', 'dry', 'electro', 'flame'][Math.floor(rnd() * 8)]; r = L.act(st, { type: 'tool', k, x: Math.floor(rnd() * 7) }); }
    else if (roll < 0.21) r = L.act(st, { type: 'tool', k: 'cat', cat: ['Fe', 'Pt', 'V2O5', 'Ni'][Math.floor(rnd() * 4)] });
    else if (roll < 0.215) r = L.act(st, { type: 'clear' });
    else {
      const x = Math.floor(rnd() * 7);
      if (!L.canPlace(st, x)) { L.act(st, { type: 'clear' }); continue; }
      r = L.act(st, { type: 'place', cid: ids[Math.floor(rnd() * ids.length)], x });
    }
    if (r) { actions++; maxDepth = Math.max(maxDepth, r.depth); }
    checkGrid(st);
  }
  ok(st.phase === 'play' && st.turnsLeft === null, '沙盒不會結束');
}
ok(maxDepth < 40, '連鎖沒有卡在上限: ' + maxDepth);
console.log(`  隨機對局 ${actions} 步，最長連鎖 ${maxDepth} 段，${Date.now() - t0}ms`);

// ------------------------------------------------------------ 7. 提示
{
  const st = lvl({ goals: [{ t: 'score', n: 999 }] });
  st.tray = H2O3.slice();
  let h = L.hint(st);
  ok(h && h.kind === 'start', '空燒杯 → 建議從頭開始: ' + JSON.stringify(h && h.kind));
  L.act(st, { type: 'place', cid: 'H2O', x: 0 });
  st.tray = H2O3.slice();
  h = L.hint(st);
  ok(h && h.kind === 'setup' && h.cid === 'H2O' && h.adj === 1, '一個水 → 建議湊一對: ' + JSON.stringify([h.kind, h.cid, h.x]));
  L.act(st, { type: 'place', cid: 'H2O', x: 1 });
  st.tray = H2O3.slice();
  h = L.hint(st);
  ok(h && h.kind === 'place' && h.cid === 'H2O' && h.total > 0 && h.events[0].k === 'cl', '兩個水 → 建議收集: ' + JSON.stringify([h.kind, h.cid, h.x, h.total]));
  const s2 = lvl({ tools: { spark: 2 } });
  s2.tray = H2O3.slice(); L.act(s2, { type: 'place', cid: 'H2', x: 0 });
  s2.tray = H2O3.slice(); L.act(s2, { type: 'place', cid: 'O2', x: 1 });
  s2.tray = ['O', 'O', 'O', 'O', 'O', 'O', 'O'];
  h = L.hint(s2);
  ok(h && h.kind === 'tool' && h.action.type === 'spark', '氫氧相鄰 → 建議火花: ' + JSON.stringify(h && [h.kind, h.action]));
  const s3 = lvl({ bag: { H: 3, C: 2, N: 2, O: 3, Na: 2, Cl: 2, S: 2, Ca: 1, Mg: 1, Cu: 1, Ag: 1, Br: 1 }, tray: 12 });
  const t1 = Date.now();
  for (let i = 0; i < 5; i++) { s3.tray = ['H', 'H', 'H', 'C', 'N', 'O', 'O', 'Na', 'Cl', 'S', 'Cu', 'Br']; L.hint(s3); }
  console.log(`  提示計算 ${((Date.now() - t1) / 5).toFixed(1)} ms/次（12 個原子、全部儀器）`);
}

// ------------------------------------------------------------ 8. 關卡資料
{
  const ids = new Set();
  let n = 0;
  for (const ch of LV.CHAPTERS) {
    ok(ch.note && ch.levels.length >= 5, '章節 ' + ch.id);
    for (const d of ch.levels) {
      n++;
      ok(!ids.has(d.id), '關卡 id 重複 ' + d.id);
      ids.add(d.id);
      ok(d.goals && d.goals.length, d.id + ' 有目標');
      for (const g of d.goals) if (g.c) ok(L.C[g.c], `${d.id} 目標物質 ${g.c}`);
      if (d.bag) for (const e in d.bag) ok(L.ELEMENTS[e], `${d.id} 元素 ${e}`);
      if (d.only) for (const id of d.only) ok(L.C[id], `${d.id} only ${id}`);
      if (d.hand) for (const id of d.hand) ok(L.C[id], `${d.id} hand ${id}`);
      ok(d.bag || d.hand, d.id + ' 要有元素袋或手牌');
      const st = L.newLevel(d, 1);
      checkGrid(st);
      if (d.grid) {
        const r = L.resolve(L.lite(st));
        ok(r.steps.length === 0, `${d.id} 預設燒杯要穩定（不會自己反應）`);
      }
      ok(L.candidates(st).length > 0, d.id + ' 有東西可以放');
    }
  }
  console.log(`  關卡 ${n} 關、${LV.CHAPTERS.length} 章`);
  // 謎題關可解，且最少步數 = par
  const tp = Date.now();
  for (const ch of LV.CHAPTERS) for (const d of ch.levels) {
    if (!d.hand) continue;
    const sol = L.solve(L.newLevel(d, 1), d.par ? d.par : 6, 600000);
    ok(sol, `謎題 ${d.id} 無解`);
    if (d.par) ok(sol.length === d.par, `謎題 ${d.id} 最少 ${sol.length} 步，par 寫 ${d.par}`);
  }
  console.log(`  謎題驗證 ${Date.now() - tp}ms`);
}

console.log(`\n✓ ${pass} checks passed（${((Date.now() - t0all) / 1000).toFixed(1)}s）`);
