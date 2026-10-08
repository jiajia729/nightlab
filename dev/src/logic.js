/* 夜間實驗室 v2 — 遊戲邏輯（純函式，不碰 DOM；Node 可直接 require 測試）
 *
 * 燒杯 7 欄 × 9 列。每格一個分子。
 *   - 依目前溫度與真實熔沸點決定物態：氣體從杯頂往下堆，液體／固體從杯底往上堆
 *   - 3 個以上相同分子相連 → 收集得分
 *   - 能反應的分子相鄰 → 自動反應（產物留在杯中，可能再引發連鎖）；每多一段連鎖，分數 ×2
 *   - 溫控、火花、紫外燈、儀器（蒸餾、過濾、電解…）、觸媒
 * 三種模式：story（故事關卡）、sandbox（沙盒）、endless（無限挑戰，v1 玩法）
 */
const Lab = (() => {
  'use strict';
  const CHEM = typeof module !== 'undefined' && typeof require === 'function' ? require('./chem.js') : NL_CHEM;

  const VERSION = 2;
  const W = 7, H = 9;
  const TRAY_START = 7, TRAY_MAX = 12, TURNS = 14;
  const BASE_MAX = { temp: 3, spark: 2, uv: 1, redraw: 3, undo: 3 };
  const { ELEMENTS, FLAME, ELEC } = CHEM;
  const ELEMENT_ORDER = Object.keys(ELEMENTS).sort((a, b) => ELEMENTS[a].z - ELEMENTS[b].z);
  const START_ELEMENTS = ['H', 'O'];
  const UNLOCK_ORDER = ELEMENT_ORDER.filter((e) => !START_ELEMENTS.includes(e));

  // ---------------------------------------------------------------- 實驗器材（無限挑戰的被動加成）
  const RELICS = {
    buret: { zh: '滴定管', desc: '酸鹼類反應（中和、金屬與酸、碳酸鹽與酸、沉澱）分數 ×2' },
    lighter: { zh: '點火槍', desc: '燃燒反應分數 ×2' },
    furnace: { zh: '坩堝', desc: '熱分解與需要加熱的反應分數 ×2' },
    condenser: { zh: '冷凝管', desc: '收集液體分數 ×2' },
    gasjar: { zh: '集氣瓶', desc: '收集氣體分數 ×2' },
    mortar: { zh: '研缽', desc: '收集固體分數 ×2' },
  };
  const ACID_KINDS = new Set(['酸鹼中和', '氧化物與酸', '金屬與酸', '碳酸鹽與酸', '沉澱', '產生氣體']);
  const has = (st, r) => !!(st.relics && st.relics.includes(r));

  // ---------------------------------------------------------------- 溫度段
  const TEMPS = [
    { t: -196, name: '液態氮' },
    { t: -80, name: '乾冰浴' },
    { t: 0, name: '冰浴' },
    { t: 25, name: '室溫' },
    { t: 80, name: '水浴' },
    { t: 110, name: '加熱板' },
    { t: 200, name: '油浴' },
    { t: 350, name: '本生燈' },
    { t: 900, name: '高溫爐' },
  ];
  const ROOM = 3;
  const ALL_TEMPS = TEMPS.map((_, i) => i);

  // ---------------------------------------------------------------- 儀器
  // aim：'col' 要選一欄；'cat' 要選觸媒；false 直接作用整杯
  const TOOLS = {
    spark: { zh: '火花', aim: false, desc: '點燃相鄰的可燃物與氧氣，或放電（氮＋氧、氧→臭氧）。溫度高過自燃溫度時不用火花也會燒。' },
    uv: { zh: '紫外燈', aim: false, desc: '照光：觸發光照反應（甲烷氯化、氫＋氯），讓鹵化銀等感光物質分解。' },
    distill: { zh: '簡單蒸餾', aim: 'col', desc: '選一欄，把這欄沸點最低的液體全部蒸出來收集。' },
    rotavap: { zh: '迴旋濃縮', aim: false, desc: '減壓抽走整杯沸點低於 100 °C 的液體（溶劑），一次收集。' },
    filter: { zh: '過濾', aim: 'col', desc: '選一欄，濾出這欄所有的固體（沉澱）收集。' },
    funnel: { zh: '分液漏斗', aim: 'col', desc: '選一欄，把這欄最上層和最下層的液體互換。' },
    centri: { zh: '離心機', aim: 'col', desc: '選一欄，固體和液體依密度重新排列：密度大的沉到底。' },
    dry: { zh: '乾燥管', aim: false, desc: '吸掉整杯的水。' },
    electro: { zh: '電解槽', aim: 'col', desc: '選一欄，電解這欄可以電解的物質（水、熔融鹽…）。' },
    flame: { zh: '焰色反應', aim: 'col', desc: '用白金絲沾這一欄含 Li、Na、K、Ca、Cu、Ba 的物質去燒，看火焰顏色並收集。' },
    cat: { zh: '觸媒', aim: 'cat', desc: '把觸媒加進燒杯（整關有效）：讓工業反應在較低溫發生。' },
  };
  const TOOL_KEYS = Object.keys(TOOLS);
  const CATALYSTS = {
    Fe: { zh: '鐵觸媒', desc: '哈伯法合成氨；苯的鹵化' },
    V2O5: { zh: '五氧化二釩', desc: '接觸法：SO₂ 氧化成 SO₃' },
    Pt: { zh: '鉑網', desc: '奧士華法：氨氧化成 NO' },
    Ni: { zh: '鎳', desc: '烯類、炔類加氫' },
  };

  // ---------------------------------------------------------------- 化學式
  function parseFormula(f) {
    let i = 0;
    function group() {
      const out = {};
      while (i < f.length && f[i] !== ')') {
        let part;
        if (f[i] === '(') {
          i++;
          part = group();
          if (f[i] !== ')') throw new Error('bad formula ' + f);
          i++;
        } else {
          const m = /^[A-Z][a-z]?/.exec(f.slice(i));
          if (!m) throw new Error('bad formula ' + f);
          part = { [m[0]]: 1 };
          i += m[0].length;
        }
        const d = /^\d+/.exec(f.slice(i));
        let k = 1;
        if (d) { k = +d[0]; i += d[0].length; }
        for (const e in part) out[e] = (out[e] || 0) + part[e] * k;
      }
      return out;
    }
    const r = group();
    if (i !== f.length) throw new Error('bad formula ' + f);
    return r;
  }
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const DISP = {};
  const disp = (f) => DISP[f] || f;
  const fText = (f) => disp(f).replace(/([A-Za-z)])(\d+)/g, (_, a, d) => a + [...d].map((ch) => SUB[+ch]).join(''));
  const fHTML = (f) => disp(f).replace(/([A-Za-z)])(\d+)/g, '$1<sub>$2</sub>');

  // ---------------------------------------------------------------- 物質
  const C = {};
  for (const [f, zh, mp, bp, d, x = {}] of CHEM.ROWS) {
    if (C[f]) throw new Error('duplicate substance ' + f);
    const counts = parseFormula(f);
    const n = Object.values(counts).reduce((a, b) => a + b, 0);
    const els = Object.keys(counts);
    for (const e of els) if (!ELEMENTS[e]) throw new Error('unknown element ' + e + ' in ' + f);
    const prio = els.slice().sort((a, b) => CHEM.COLOR_PRIORITY.indexOf(a) - CHEM.COLOR_PRIORITY.indexOf(b));
    C[f] = {
      id: f, zh, mp, bp, d, counts, n, els,
      c1: prio[0], c2: prio[1] || prio[0],
      col: x.col || null, colg: x.colg || null,
      ai: x.ai != null ? x.ai : null,
      dec: x.dec ? { t: x.dec[0], full: x.dec[1], keep: x.dec[2] } : null,
      pho: x.pho ? { full: x.pho[0], keep: x.pho[1] } : null,
      simp: !!x.simp,
      flame: els.filter((e) => FLAME[e]),
    };
    if (x.disp) DISP[f] = x.disp;
  }

  // ---------------------------------------------------------------- 反應
  const RX = [];
  const PAIR = new Map(); // 'a|b' -> [{rx, flip}]（同一對可能有好幾種反應，依序取第一個成立的）
  const RXKEY = new Map();
  function addRx(a, b, full, keep, cond, kind, note, opt = {}) {
    const key = a + '+' + b + (opt.cat ? '@' + opt.cat[0] : '');
    if (RXKEY.has(key)) throw new Error('duplicate reaction ' + key);
    for (const s of [a, b, ...full, ...keep]) if (!C[s]) throw new Error(`reaction ${key}: unknown ${s}`);
    const rx = {
      i: RX.length, a, b, full, keep, cond, kind, note: note || '', key,
      cat: opt.cat ? { k: opt.cat[0], t: opt.cat[1] } : null, via: !!opt.via, simp: !!opt.simp,
    };
    RX.push(rx);
    RXKEY.set(key, rx);
    const add = (k, flip) => { if (!PAIR.has(k)) PAIR.set(k, []); PAIR.get(k).push({ rx, flip }); };
    add(a + '|' + b, false);
    if (a !== b) add(b + '|' + a, true);
    // 有觸媒條件的排前面（同一對反應物，有觸媒時走另一條路）
    for (const k of [a + '|' + b, b + '|' + a]) if (PAIR.has(k)) PAIR.get(k).sort((x, y) => (y.rx.cat ? 1 : 0) - (x.rx.cat ? 1 : 0));
    return rx;
  }
  const pairHas = (a, b) => PAIR.has(a + '|' + b);
  CHEM.reactions(addRx, C);
  // 酸 × 鹼
  for (const [base, cat, type] of CHEM.BASES) {
    for (const [acid, an] of CHEM.ACIDS) {
      if (type === 'metal' && acid === 'HNO3') continue; // 硝酸是氧化性酸，產物不是 H₂
      if (type === 'metal' && acid === 'H3PO4' && cat !== 'Na') continue;
      const salt = CHEM.SALT[cat + '|' + an];
      if (!salt || !C[salt] || pairHas(base, acid)) continue;
      if (type === 'oh') addRx(base, acid, [salt, 'H2O'], [salt, 'H2O'], 'auto', '酸鹼中和');
      else if (type === 'ox') addRx(base, acid, [salt, 'H2O'], [salt, 'H2O'], 'auto', '氧化物與酸');
      else if (type === 'metal') addRx(base, acid, [salt, 'H2'], [salt, 'H2'], 'auto', '金屬與酸');
      else if (type === 'co3') addRx(base, acid, [salt, 'H2O', 'CO2'], [salt, 'CO2'], 'auto', '碳酸鹽與酸');
      else if (type === 's') addRx(base, acid, [salt, 'H2S'], [salt, 'H2S'], 'auto', '產生氣體', '硫化物遇酸放出臭雞蛋味的 H₂S');
      else if (type === 'so3') addRx(base, acid, [salt, 'SO2', 'H2O'], [salt, 'SO2'], 'auto', '產生氣體');
      else addRx(base, acid, [salt], [salt], 'auto', '酸鹼中和', acid === 'HCl' ? '產生白煙' : '');
    }
  }
  // 複分解（沉澱、銨鹽遇鹼）
  {
    const sol = Object.entries(CHEM.SOLUBLE).filter(([f]) => C[f]);
    for (let i = 0; i < sol.length; i++) {
      for (let j = i + 1; j < sol.length; j++) {
        const [A, [c1, a1]] = sol[i], [B, [c2, a2]] = sol[j];
        if (c1 === c2 || a1 === a2 || pairHas(A, B)) continue;
        let p1, p2, extra = [];
        const special = (c, a) => (c === 'NH4' && a === 'OH' ? ['NH3', 'H2O'] : c === 'Ag' && a === 'OH' ? ['Ag2O', 'H2O'] : null);
        const s1 = special(c1, a2), s2 = special(c2, a1);
        if (s1 && s2) continue;
        if (s1) { p1 = s1[0]; extra = [s1[1]]; p2 = CHEM.SALT[c2 + '|' + a1]; }
        else if (s2) { p2 = s2[0]; extra = [s2[1]]; p1 = CHEM.SALT[c1 + '|' + a2]; }
        else { p1 = CHEM.SALT[c1 + '|' + a2]; p2 = CHEM.SALT[c2 + '|' + a1]; }
        if (!p1 || !p2 || !C[p1] || !C[p2]) continue;
        const gas = p1 === 'NH3' || p2 === 'NH3';
        const pp = CHEM.PRECIP.has(p1) ? p1 : CHEM.PRECIP.has(p2) ? p2 : (p1 === 'Ag2O' || p2 === 'Ag2O') ? 'Ag2O' : null;
        if (!gas && !pp) continue;
        const both = CHEM.PRECIP.has(p1) && CHEM.PRECIP.has(p2);
        addRx(A, B, [p1, p2, ...extra], [p1, p2], 'auto', gas ? '產生氣體' : '沉澱',
          gas ? '銨鹽遇鹼放出氨，是檢驗銨根的方法' : both ? '兩種沉澱同時生成' : (CHEM.PRECIP_NOTE[pp] || ''));
      }
    }
  }
  const PRECIP = CHEM.PRECIP;

  // ---------------------------------------------------------------- 配平（求整數零空間）
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
  function balanceInfo(lhs, rhs) {
    const sp = [...lhs, ...rhs];
    const comps = sp.map(parseFormula);
    const els = [...new Set(comps.flatMap((o) => Object.keys(o)))];
    const n = sp.length;
    const norm = ([a, b]) => { if (b < 0) { a = -a; b = -b; } const g = gcd(a, b) || 1; return [a / g, b / g]; };
    const sub = (x, y) => norm([x[0] * y[1] - y[0] * x[1], x[1] * y[1]]);
    const mul = (x, y) => norm([x[0] * y[0], x[1] * y[1]]);
    const div = (x, y) => norm([x[0] * y[1], x[1] * y[0]]);
    const M = els.map((e) => sp.map((s, j) => [(comps[j][e] || 0) * (j < lhs.length ? 1 : -1), 1]));
    const piv = [];
    let r = 0;
    for (let c = 0; c < n && r < M.length; c++) {
      let p = -1;
      for (let k = r; k < M.length; k++) if (M[k][c][0] !== 0) { p = k; break; }
      if (p < 0) continue;
      [M[r], M[p]] = [M[p], M[r]];
      const pv = M[r][c];
      M[r] = M[r].map((v) => div(v, pv));
      for (let k = 0; k < M.length; k++) {
        if (k !== r && M[k][c][0] !== 0) {
          const f = M[k][c];
          M[k] = M[k].map((v, j) => sub(v, mul(f, M[r][j])));
        }
      }
      piv.push(c);
      r++;
    }
    const free = [];
    for (let c = 0; c < n; c++) if (!piv.includes(c)) free.push(c);
    if (free.length === 0) return { co: null, dim: 0 };
    if (free.length > 1) {
      // 不只一種配法：找係數和最小的正整數解
      const Z = els.map((e) => sp.map((s, j) => (comps[j][e] || 0) * (j < lhs.length ? 1 : -1)));
      let best = null;
      const v = new Array(n).fill(1);
      const rec = (j) => {
        if (j === n) {
          if (Z.every((row) => row.reduce((a, c, k) => a + c * v[k], 0) === 0)) {
            const s = v.reduce((a, b) => a + b, 0);
            if (!best || s < best.s) best = { s, v: v.slice() };
          }
          return;
        }
        for (let k = 1; k <= 8; k++) { v[j] = k; rec(j + 1); }
      };
      rec(0);
      return { co: best ? best.v : null, dim: free.length };
    }
    const x = new Array(n);
    x[free[0]] = [1, 1];
    piv.forEach((c, i) => { x[c] = norm([-M[i][free[0]][0], M[i][free[0]][1]]); });
    const l = x.reduce((a, [, d]) => (a / gcd(a, d)) * d, 1);
    let ints = x.map(([a, d]) => a * (l / d));
    const g = ints.reduce((a, v) => gcd(a, v), 0);
    ints = ints.map((v) => v / g);
    if (ints.every((v) => v < 0)) ints = ints.map((v) => -v);
    if (!ints.every((v) => v > 0)) return { co: null, dim: 1 };
    return { co: ints, dim: 1 };
  }
  const balance = (lhs, rhs) => balanceInfo(lhs, rhs).co;
  const eqCache = new Map();
  function equation(lhs, rhs, html = true, over = '') {
    const key = lhs.join('+') + '>' + rhs.join('+') + (html ? 'h' : 't') + over;
    if (eqCache.has(key)) return eqCache.get(key);
    const co = balance(lhs, rhs) || [...lhs, ...rhs].map(() => 1);
    const fmt = html ? fHTML : fText;
    const term = (s, k) => (k > 1 ? k : '') + fmt(s);
    const arrow = over ? (html ? ` <span class="arr">→<small>${over}</small></span> ` : ` →(${over}) `) : ' → ';
    const out = lhs.map((s, i) => term(s, co[i])).join(' + ') + arrow + rhs.map((s, i) => term(s, co[lhs.length + i])).join(' + ');
    eqCache.set(key, out);
    return out;
  }
  function rxSides(rx) {
    if (rx.via) return [[rx.a], rx.full];
    return [rx.a === rx.b ? [rx.a] : [rx.a, rx.b], rx.full];
  }
  const rxEquation = (rx, html) => { const [l, r] = rxSides(rx); return equation(l, r, html, rx.via ? fText(rx.b) : ''); };
  const decEquation = (id, html) => equation([id], C[id].dec.full, html);
  const phoEquation = (id, html) => equation([id], C[id].pho.full, html, 'hν');
  const elecEquation = (id, html) => equation([id], ELEC[id].full, html, '電解');

  // ---------------------------------------------------------------- 物態、分數
  function phaseAt(id, T) {
    const c = C[id], t = TEMPS[T].t;
    if (t < c.mp) return 's';
    if (t < c.bp) return 'l';
    return 'g';
  }
  const upMult = (st, e) => 1 + 0.5 * ((st.up && st.up[e]) || 0);
  /** 分子價值 = 原子底分總和 ×（越大的分子加成越多）× 每個已強化元素的倍率 */
  function value(st, id) {
    const c = C[id];
    let s = 0, m = 1;
    for (const e in c.counts) s += c.counts[e] * ELEMENTS[e].base;
    for (const e of c.els) m *= upMult(st, e);
    return Math.max(1, Math.round(s * (1 + 0.15 * (c.n - 1)) * m));
  }
  let TARGET_BASE = 60, TARGET_GROWTH = 1.17;
  function targetFor(level) { return Math.round(TARGET_BASE * Math.pow(TARGET_GROWTH, level - 1) / 5) * 5; }

  // ---------------------------------------------------------------- 亂數、元素袋、反應台
  function rand(st) {
    let t = (st.rng = (st.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** 故事模式：反應台上每種元素最多放「允許的分子裡最多需要幾個」，避免用不到的原子塞滿反應台 */
  function atomCap(st) {
    if (st._cap) return st._cap;
    const cap = {};
    for (const id of st.only || ALL_IDS) {
      const c = C[id];
      if (c.n > st.traySize || !c.els.every((e) => st.unlocked.includes(e))) continue;
      for (const e in c.counts) cap[e] = Math.max(cap[e] || 0, c.counts[e]);
    }
    Object.defineProperty(st, '_cap', { value: cap, enumerable: false, configurable: true });
    return cap;
  }
  function drawAtom(st) {
    if (st.mode === 'story') {
      const cap = atomCap(st);
      for (let k = 0; k < 12; k++) {
        const e = drawRaw(st);
        if (st.tray.filter((x) => x === e).length < (cap[e] || 0)) return e;
      }
    }
    return drawRaw(st);
  }
  function drawRaw(st) {
    let tot = 0;
    for (const e of st.unlocked) tot += st.bag[e] || 0;
    let r = rand(st) * tot;
    for (const e of st.unlocked) { r -= st.bag[e] || 0; if (r < 0) return e; }
    return st.unlocked[st.unlocked.length - 1];
  }
  function trayCounts(tray) { const m = {}; for (const e of tray) m[e] = (m[e] || 0) + 1; return m; }
  const ALL_IDS = Object.keys(C);
  /** 現在可以放進燒杯的分子 */
  function candidates(st) {
    if (st.mode === 'sandbox') return ALL_IDS.slice();
    if (st.hand) {
      const seen = [];
      for (const id of st.hand) if (!seen.includes(id)) seen.push(id);
      return seen;
    }
    const have = trayCounts(st.tray);
    const out = [];
    for (const id of st.only || ALL_IDS) {
      const c = C[id];
      if (c.n > st.traySize) continue;
      let ok = true;
      for (const e in c.counts) if (!st.unlocked.includes(e) || (have[e] || 0) < c.counts[e]) { ok = false; break; }
      if (ok) out.push(id);
    }
    out.sort((a, b) => value(st, b) - value(st, a) || C[a].n - C[b].n || (a < b ? -1 : 1));
    return out;
  }
  const sortTray = (st) => st.tray.sort((a, b) => ELEMENTS[a].z - ELEMENTS[b].z);
  function refill(st) {
    if (st.hand || st.mode === 'sandbox') return;
    for (let tries = 0; tries < 30; tries++) {
      while (st.tray.length < st.traySize) st.tray.push(drawAtom(st));
      sortTray(st);
      if (candidates(st).length) return;
      st.tray = []; // 完全合成不出東西 → 免費重抽
    }
  }
  /** 這個分子會用掉反應台上的哪幾格（index） */
  function atomsFor(st, id) {
    if (!st.tray || st.hand || st.mode === 'sandbox') return [];
    const need = { ...C[id].counts };
    const idx = [];
    st.tray.forEach((e, i) => { if (need[e] > 0) { need[e]--; idx.push(i); } });
    return idx;
  }

  // ---------------------------------------------------------------- 燒杯
  const colItems = (st, x) => st.grid[x].filter(Boolean);
  function settleCol(st, x) {
    const items = colItems(st, x);
    const gas = [], cond = [];
    for (const c of items) (phaseAt(c.c, st.T) === 'g' ? gas : cond).push(c);
    const col = new Array(H).fill(null);
    gas.forEach((c, i) => { col[i] = c; });
    cond.forEach((c, i) => { col[H - cond.length + i] = c; });
    let moved = false;
    for (let i = 0; i < H; i++) if (col[i] !== st.grid[x][i]) moved = true;
    st.grid[x] = col;
    return moved;
  }
  function settle(st) { let m = false; for (let x = 0; x < W; x++) m = settleCol(st, x) || m; return m; }
  const canPlace = (st, x) => x >= 0 && x < W && colItems(st, x).length < H;
  function place(st, id, x) {
    const items = colItems(st, x);
    const nGas = items.filter((c) => phaseAt(c.c, st.T) === 'g').length;
    const cell = { id: st.uid++, c: id };
    items.splice(nGas, 0, cell); // 氣體疊在既有氣體下方；液固體疊在既有液固體上方
    st.grid[x] = items.concat(new Array(H - items.length).fill(null));
    settleCol(st, x);
    return cell;
  }
  const snap = (st) => st.grid.map((col) => col.map((c) => (c ? { id: c.id, c: c.c } : null)));
  function posOf(st, id) {
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (st.grid[x][y] && st.grid[x][y].id === id) return [x, y];
    return null;
  }
  const emptyGrid = () => Array.from({ length: W }, () => new Array(H).fill(null));
  function countIn(st, id) { let n = 0; for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (st.grid[x][y] && (id == null || st.grid[x][y].c === id)) n++; return n; }

  // ---------------------------------------------------------------- 反應判定
  /** flags: {spark, uv} */
  function rxActive(st, rx, flags = {}) {
    const t = TEMPS[st.T].t;
    let ok = false;
    if (rx.cat && st.cats && st.cats.includes(rx.cat.k) && t >= rx.cat.t) ok = true;
    else if (rx.cond === 'auto') ok = true;
    else if (rx.cond === 'spark') ok = !!flags.spark;
    else if (rx.cond === 'uv') ok = !!flags.uv;
    else if (rx.cond === 'burn') ok = !!flags.spark || (C[rx.a].ai != null && t >= C[rx.a].ai);
    else if (typeof rx.cond === 'number') ok = t >= rx.cond;
    if (!ok) return false;
    // 產物在這個溫度會分解 → 平衡往回，不反應（例如高溫下 N₂ + H₂ 不會生成 NH₃）
    for (const p of rx.full) if (C[p].dec && t >= C[p].dec.t) return false;
    return true;
  }
  function activeRx(st, a, b, flags) {
    const list = PAIR.get(a + '|' + b);
    if (!list) return null;
    for (const r of list) if (rxActive(st, r.rx, flags)) return r;
    return null;
  }
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function findReactions(st, flags) {
    const used = new Set(), out = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = st.grid[x][y];
        if (!a || used.has(a.id)) continue;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const b = st.grid[nx][ny];
          if (!b || used.has(b.id)) continue;
          const r = activeRx(st, a.c, b.c, flags);
          if (!r) continue;
          used.add(a.id); used.add(b.id);
          out.push(r.flip ? { rx: r.rx, A: [nx, ny, b], B: [x, y, a] } : { rx: r.rx, A: [x, y, a], B: [nx, ny, b] });
          break;
        }
      }
    }
    return out;
  }
  function pairWith(st, test) {
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const a = st.grid[x][y];
        if (!a) continue;
        for (const [dx, dy] of DIRS.slice(0, 2)) {
          const nx = x + dx, ny = y + dy;
          if (nx >= W || ny >= H) continue;
          const b = st.grid[nx][ny];
          if (b && test(a.c, b.c)) return true;
        }
      }
    }
    return false;
  }
  /** 按火花會不會有事發生 */
  function sparkable(st) {
    return pairWith(st, (a, b) => !activeRx(st, a, b, {}) && !!activeRx(st, a, b, { spark: true }));
  }
  function uvable(st) {
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (st.grid[x][y] && C[st.grid[x][y].c].pho) return true;
    return pairWith(st, (a, b) => !activeRx(st, a, b, {}) && !!activeRx(st, a, b, { uv: true }));
  }
  function findDecomps(st) {
    const t = TEMPS[st.T].t, out = [];
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
      const a = st.grid[x][y];
      if (a && C[a.c].dec && t >= C[a.c].dec.t) out.push([x, y, a]);
    }
    return out;
  }
  function findClusters(st) {
    const seen = new Set(), groups = [];
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const a = st.grid[x][y];
        if (!a || seen.has(a.id)) continue;
        const group = [], stack = [[x, y]];
        seen.add(a.id);
        while (stack.length) {
          const [cx, cy] = stack.pop();
          group.push([cx, cy, st.grid[cx][cy]]);
          for (const [dx, dy] of DIRS) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const b = st.grid[nx][ny];
            if (b && b.c === a.c && !seen.has(b.id)) { seen.add(b.id); stack.push([nx, ny]); }
          }
        }
        if (group.length >= 3) groups.push(group);
      }
    }
    return groups;
  }

  // ---------------------------------------------------------------- 結算（連鎖）
  function newTally() { return { made: {}, coll: {}, fl: {} }; }
  const bump = (m, id, n = 1) => { m[id] = (m[id] || 0) + n; };
  /** 一格變成兩個產物：第一個留在原位，第二個插在它後面（同一欄）；放不下就逸出 */
  function splitCells(st, items, tally, found) {
    // items: [[x, y, keep0, keep1]]；回傳逸出的產物
    const extra = new Map();
    const vented = [];
    for (const [x, y, k0, k1] of items) {
      const p0 = { id: st.uid++, c: k0 };
      st.grid[x][y] = p0;
      bump(tally.made, k0); found.add(k0);
      if (k1) extra.set(p0, k1);
    }
    for (let x = 0; x < W; x++) {
      const its = colItems(st, x);
      const out = [];
      for (const c of its) {
        out.push(c);
        if (extra.has(c)) out.push({ id: st.uid++, c: extra.get(c), pending: true });
      }
      while (out.length > H) {
        const i = out.findIndex((c) => c.pending);
        vented.push(out.splice(i, 1)[0].c);
      }
      for (const c of out) if (c.pending) { delete c.pending; bump(tally.made, c.c); found.add(c.c); }
      st.grid[x] = out.concat(new Array(H - out.length).fill(null));
    }
    return vented;
  }
  /** opts: spark, uv, depth（起始連鎖段數）, tally */
  function resolve(st, opts = {}) {
    const steps = [];
    const found = new Set(), foundRx = new Set();
    const tally = opts.tally || newTally();
    let depth = opts.depth || 0, total = 0;
    let flags = { spark: !!opts.spark, uv: !!opts.uv };
    const newCell = (id) => { found.add(id); bump(tally.made, id); return { id: st.uid++, c: id }; };
    if (settle(st)) steps.push({ kind: 'settle', grid: snap(st) });
    // 0. 照光分解
    if (flags.uv) {
      const items = [], fx = [], logs = [];
      let gain = 0;
      for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
        const a = st.grid[x][y];
        if (!a || !C[a.c].pho) continue;
        const p = C[a.c].pho;
        items.push([x, y, p.keep[0], p.keep[1]]);
        const g = Math.round(value(st, a.c) * 0.75) * Math.min(64, 2 ** depth);
        gain += g;
        fx.push({ x, y, type: 'uv' });
        logs.push({ k: 'pho', c: a.c, gain: g, mult: Math.min(64, 2 ** depth), vent: [] });
        foundRx.add('pho:' + a.c);
      }
      if (items.length) {
        const v = splitCells(st, items, tally, found);
        if (v.length) logs[0].vent = v;
        settle(st);
        total += gain;
        steps.push({ kind: 'pho', fx, gain, mult: Math.min(64, 2 ** depth), grid: snap(st), logs });
        depth++;
      }
    }
    for (let wave = 0; wave < 60; wave++) {
      const mult = Math.min(64, 2 ** depth);
      // 1. 熱分解
      const dec = findDecomps(st);
      if (dec.length) {
        let gain = 0;
        const fx = [], logs = [], items = [];
        for (const [x, y, a] of dec) {
          const d = C[a.c].dec;
          items.push([x, y, d.keep[0], d.keep[1]]);
          const g = Math.round(value(st, a.c) * 0.5 * (has(st, 'furnace') ? 2 : 1)) * mult;
          gain += g;
          fx.push({ x, y, type: 'decomp' });
          logs.push({ k: 'dec', c: a.c, gain: g, mult, vent: [] });
          foundRx.add('dec:' + a.c);
        }
        const v = splitCells(st, items, tally, found);
        for (const c of v) { const lg = logs.find((l) => C[l.c].dec.keep[1] === c) || logs[0]; lg.vent.push(c); }
        settle(st);
        total += gain;
        steps.push({ kind: 'decomp', fx, gain, mult, grid: snap(st), logs });
        depth++;
        continue;
      }
      // 2. 相鄰反應
      const rxs = findReactions(st, flags);
      flags = {};
      if (rxs.length) {
        let gain = 0;
        const fx = [], logs = [];
        for (const { rx, A, B } of rxs) {
          let rm = 2;
          if (ACID_KINDS.has(rx.kind) && has(st, 'buret')) rm *= 2;
          if (rx.cond === 'burn' && has(st, 'lighter')) rm *= 2;
          if (typeof rx.cond === 'number' && has(st, 'furnace')) rm *= 2;
          const vb = rx.via ? 0 : value(st, B[2].c);
          const g = Math.round((value(st, A[2].c) + vb) * rm) * mult;
          gain += g;
          st.grid[A[0]][A[1]] = rx.keep[0] ? newCell(rx.keep[0]) : null;
          if (rx.via) { /* 觸媒留在原位 */ } else st.grid[B[0]][B[1]] = rx.keep[1] ? newCell(rx.keep[1]) : null;
          const t = rx.cond === 'burn' ? 'burn' : PRECIP.has(rx.keep[0]) || PRECIP.has(rx.keep[1]) ? 'precip' : 'react';
          fx.push({ x: A[0], y: A[1], type: t }, { x: B[0], y: B[1], type: t });
          logs.push({ k: 'rx', i: rx.i, gain: g, mult, vent: rx.full.filter((p) => !rx.keep.includes(p)) });
          foundRx.add(rx.key);
        }
        total += gain;
        steps.push({ kind: 'react', fx, gain, mult, grid: snap(st), logs });
        if (settle(st)) steps.push({ kind: 'settle', grid: snap(st) });
        depth++;
        continue;
      }
      // 3. 同種收集
      const groups = findClusters(st);
      if (groups.length) {
        let gain = 0;
        const fx = [], logs = [];
        for (const g of groups) {
          const n = g.length, id = g[0][2].c;
          const ph = phaseAt(id, st.T);
          const rel = (ph === 'l' && has(st, 'condenser')) || (ph === 'g' && has(st, 'gasjar')) || (ph === 's' && has(st, 'mortar')) ? 2 : 1;
          const pts = Math.round(value(st, id) * n * (1 + 0.5 * (n - 3)) * rel) * mult;
          gain += pts;
          for (const [x, y] of g) { st.grid[x][y] = null; fx.push({ x, y, type: 'collect' }); }
          logs.push({ k: 'cl', c: id, n, gain: pts, mult });
          bump(tally.coll, id, n);
        }
        total += gain;
        steps.push({ kind: 'cluster', fx, gain, mult, grid: snap(st), logs });
        if (settle(st)) steps.push({ kind: 'settle', grid: snap(st) });
        depth++;
        continue;
      }
      break;
    }
    return { steps, total, depth, found: [...found], foundRx: [...foundRx], tally };
  }

  // ---------------------------------------------------------------- 儀器動作
  function liquidRuns(st, x) {
    // 由下往上，液體段落（同種相連為一層）
    const runs = [];
    for (let y = H - 1; y >= 0; y--) {
      const c = st.grid[x][y];
      if (!c || phaseAt(c.c, st.T) !== 'l') continue;
      const last = runs[runs.length - 1];
      if (last && last.c === c.c && last.ys[last.ys.length - 1] === y + 1) last.ys.push(y);
      else runs.push({ c: c.c, ys: [y] });
    }
    return runs;
  }
  function canElectro(st, id) {
    const e = ELEC[id];
    if (!e) return false;
    if (e.ph && phaseAt(id, st.T) !== e.ph) return false;
    if (e.minT != null && TEMPS[st.T].t < e.minT) return false;
    return true;
  }
  /** 執行儀器的第一步；不會有效果就回傳 null */
  function toolStep(st, a, tally) {
    const k = a.k, x = a.x;
    const fx = [], logs = [];
    let gain = 0;
    const found = new Set(), foundRx = new Set();
    const removeCells = (cells, mult, kind) => {
      const by = {};
      for (const [cx, cy, c] of cells) { st.grid[cx][cy] = null; fx.push({ x: cx, y: cy, type: kind }); bump(by, c.c); }
      for (const id in by) {
        const g = Math.round(value(st, id) * by[id] * mult);
        gain += g;
        bump(tally.coll, id, by[id]);
        logs.push({ k: 'tool', t: k, c: id, n: by[id], gain: g, mult: 1 });
      }
    };
    const inCol = (pred) => { const out = []; for (let y = 0; y < H; y++) { const c = st.grid[x][y]; if (c && pred(c)) out.push([x, y, c]); } return out; };
    const inAll = (pred) => { const out = []; for (let cx = 0; cx < W; cx++) for (let y = 0; y < H; y++) { const c = st.grid[cx][y]; if (c && pred(c)) out.push([cx, y, c]); } return out; };
    const needCol = TOOLS[k] && TOOLS[k].aim === 'col';
    if (needCol && (x == null || x < 0 || x >= W)) return null;
    switch (k) {
      case 'distill': {
        const liq = inCol((c) => phaseAt(c.c, st.T) === 'l');
        if (!liq.length) return null;
        const low = liq.reduce((m, [, , c]) => (C[c.c].bp < C[m].bp ? c.c : m), liq[0][2].c);
        removeCells(liq.filter(([, , c]) => c.c === low), 1.5, 'distill');
        break;
      }
      case 'rotavap': {
        const liq = inAll((c) => phaseAt(c.c, st.T) === 'l' && C[c.c].bp < 100);
        if (!liq.length) return null;
        removeCells(liq, 1.2, 'distill');
        break;
      }
      case 'filter': {
        const sol = inCol((c) => phaseAt(c.c, st.T) === 's');
        if (!sol.length) return null;
        removeCells(sol, 1.2, 'filter');
        break;
      }
      case 'dry': {
        const w = inAll((c) => c.c === 'H2O');
        if (!w.length) return null;
        removeCells(w, 0.5, 'filter');
        break;
      }
      case 'flame': {
        const f = inCol((c) => C[c.c].flame.length > 0);
        if (!f.length) return null;
        for (const [cx, cy, c] of f) { st.grid[cx][cy] = null; fx.push({ x: cx, y: cy, type: 'flame', color: FLAME[C[c.c].flame[0]][0] }); }
        const by = {};
        for (const [, , c] of f) bump(by, c.c);
        for (const id in by) {
          const g = Math.round(value(st, id) * by[id] * 2);
          gain += g;
          bump(tally.coll, id, by[id]);
          logs.push({ k: 'tool', t: k, c: id, n: by[id], gain: g, mult: 1, flame: C[id].flame[0] });
          for (const e of C[id].flame) bump(tally.fl, e);
          foundRx.add('flame:' + C[id].flame[0]);
        }
        break;
      }
      case 'funnel': {
        const runs = liquidRuns(st, x);
        if (runs.length < 2) return null;
        const bot = runs[0], top = runs[runs.length - 1];
        // 把這欄液體重新排：最下層和最上層互換
        const liqYs = runs.flatMap((r) => r.ys).sort((p, q) => q - p); // 由下往上
        const order = [top, ...runs.slice(1, -1), bot];
        const cells = order.flatMap((r) => r.ys.map((y) => st.grid[x][y]));
        liqYs.forEach((y, i) => { st.grid[x][y] = cells[i]; fx.push({ x, y, type: 'react' }); });
        logs.push({ k: 'tool', t: k, c: top.c, c2: bot.c, gain: 0, mult: 1 });
        break;
      }
      case 'centri': {
        const ys = [], cells = [];
        for (let y = H - 1; y >= 0; y--) { const c = st.grid[x][y]; if (c && phaseAt(c.c, st.T) !== 'g') { ys.push(y); cells.push(c); } }
        if (cells.length < 2) return null;
        const sorted = cells.slice().sort((p, q) => C[q.c].d - C[p.c].d);
        if (sorted.every((c, i) => c === cells[i])) return null;
        ys.forEach((y, i) => { st.grid[x][y] = sorted[i]; fx.push({ x, y, type: 'react' }); });
        logs.push({ k: 'tool', t: k, gain: 0, mult: 1 });
        break;
      }
      case 'electro': {
        const el = inCol((c) => canElectro(st, c.c));
        if (!el.length) return null;
        // 陰極產物留在原位；陽極氣體（Cl₂、O₂）在另一極被收集走，不會馬上又和金屬反應回去
        for (const [cx, cy, c] of el) {
          const e = ELEC[c.c];
          st.grid[cx][cy] = { id: st.uid++, c: e.keep[0] };
          bump(tally.made, e.keep[0]); found.add(e.keep[0]);
          bump(tally.made, e.keep[1]); bump(tally.coll, e.keep[1]); found.add(e.keep[1]);
          fx.push({ x: cx, y: cy, type: 'zap' });
          const g = Math.round(value(st, c.c) + value(st, e.keep[1]));
          gain += g;
          logs.push({ k: 'el', c: c.c, gain: g, mult: 1, out: e.keep[1] });
          foundRx.add('el:' + c.c);
        }
        break;
      }
      case 'cat': {
        if (!a.cat || !CATALYSTS[a.cat] || (st.cats || []).includes(a.cat)) return null;
        if (st.mode !== 'sandbox' && !(st.catsAvail || []).includes(a.cat)) return null;
        st.cats = (st.cats || []).concat(a.cat);
        logs.push({ k: 'tool', t: k, cat: a.cat, gain: 0, mult: 1 });
        break;
      }
      default: return null;
    }
    settle(st);
    return { step: { kind: 'tool', tool: k, fx, gain, mult: 1, grid: snap(st), logs }, gain, found, foundRx };
  }

  // ---------------------------------------------------------------- 關卡狀態
  function baseState(mode, seed) {
    return {
      v: VERSION, mode, rng: seed >>> 0, uid: 1, T: ROOM, temps: ALL_TEMPS.slice(), cats: [], catsAvail: [],
      unlocked: [], bag: {}, up: {}, traySize: TRAY_START, tray: [], hand: null, only: null, relics: [],
      grid: emptyGrid(), score: 0, turnsLeft: TURNS, charges: {}, max: {}, phase: 'play', log: [],
      best: { chain: 0, turn: 0 }, prog: newTally(), moves: 0, goals: null, starRules: null, stars: 0, endReason: null,
    };
  }
  /** 故事關卡。def 見 levels.js */
  function newLevel(def, seed) {
    const st = baseState('story', seed);
    st.lv = def.id;
    st.bag = { ...def.bag };
    st.unlocked = Object.keys(def.bag || {}).sort((a, b) => ELEMENTS[a].z - ELEMENTS[b].z);
    st.traySize = def.tray || TRAY_START;
    st.turnsLeft = def.turns;
    st.temps = (def.temps || [ROOM]).slice().sort((a, b) => a - b);
    st.T = def.T != null ? def.T : st.temps.includes(ROOM) ? ROOM : st.temps[0];
    st.charges = { temp: 0, spark: 0, uv: 0, redraw: 0, undo: 3, ...(def.tools || {}) };
    for (const k of TOOL_KEYS) if (st.charges[k] == null) st.charges[k] = 0;
    st.max = { ...st.charges };
    st.catsAvail = (def.cats || []).slice();
    st.cats = (def.cats0 || []).slice();
    st.only = def.only ? def.only.slice() : null;
    st.hand = def.hand ? def.hand.slice() : null;
    st.goals = def.goals.map((g) => ({ ...g }));
    st.starRules = (def.stars || []).map((g) => ({ ...g }));
    if (def.grid) {
      def.grid.forEach((col, x) => { for (const id of col) place(st, id, x); });
    }
    refill(st);
    return st;
  }
  function newSandbox() {
    const st = baseState('sandbox', 1);
    st.unlocked = ELEMENT_ORDER.slice();
    st.turnsLeft = null;
    st.catsAvail = Object.keys(CATALYSTS);
    for (const k of ['temp', 'redraw', 'undo', ...TOOL_KEYS]) st.charges[k] = 99;
    st.max = { ...st.charges };
    return st;
  }
  // 無限挑戰（v1 玩法）
  function newRun(seed) {
    const st = baseState('endless', seed);
    st.level = 1;
    st.unlocked = START_ELEMENTS.slice();
    for (const e of START_ELEMENTS) st.bag[e] = ELEMENTS[e].w;
    st.max = { ...BASE_MAX };
    startLevel(st);
    return st;
  }
  function startLevel(st) {
    st.grid = emptyGrid();
    st.T = ROOM;
    st.score = 0;
    st.target = targetFor(st.level);
    st.goals = [{ t: 'score', n: st.target }];
    st.turnsLeft = TURNS;
    st.charges = { ...st.max };
    for (const k of TOOL_KEYS) if (st.charges[k] == null) st.charges[k] = 0;
    st.phase = 'play';
    st.offers = null;
    st.picks = 0;
    st.endReason = null;
    st.tray = [];
    st.log = [];
    st.prog = newTally();
    st.cats = [];
    refill(st);
    st.levelStart = null;
    st.levelStart = JSON.stringify(st);
  }
  function retryLevel(st, seed) {
    const s = JSON.parse(st.levelStart);
    s.levelStart = st.levelStart;
    s.rng = seed >>> 0;
    s.tray = [];
    refill(s);
    return s;
  }

  // ---------------------------------------------------------------- 目標、星星
  /** 回傳 [目前, 需要] */
  function goalProgress(st, g) {
    switch (g.t) {
      case 'score': return [st.score, g.n];
      case 'make': return [Math.min(g.n, st.prog.made[g.c] || 0), g.n];
      case 'collect': return [Math.min(g.n, st.prog.coll[g.c] || 0), g.n];
      case 'clear': { const left = countIn(st, g.c || null); return [left === 0 ? 1 : 0, 1]; }
      case 'flames': return [Math.min(g.n, Object.keys(st.prog.fl || {}).length), g.n];
    }
    return [0, 1];
  }
  const goalDone = (st, g) => { const [a, b] = goalProgress(st, g); return a >= b; };
  const goalsMet = (st) => !!st.goals && st.goals.every((g) => goalDone(st, g));
  function starOk(st, r) {
    switch (r.t) {
      case 'turns': return st.turnsLeft >= r.n;
      case 'score': return st.score >= r.n;
      case 'chain': return st.best.chain >= r.n;
      case 'moves': return st.moves <= r.n;
      case 'unused': return st.charges[r.k] >= st.max[r.k];
    }
    return false;
  }
  function countStars(st) { return 1 + (st.starRules || []).filter((r) => starOk(st, r)).length; }

  function checkEnd(st) {
    if (st.mode === 'sandbox') return;
    if (goalsMet(st)) {
      st.phase = 'clear';
      if (st.mode === 'story') st.stars = countStars(st);
      else { st.picks = st.turnsLeft >= 5 ? 2 : 1; st.offers = makeOffers(st); }
      return;
    }
    if (!st.hand && st.turnsLeft <= 0) { st.phase = 'fail'; st.endReason = 'turns'; return; }
    let any = false;
    for (let x = 0; x < W; x++) if (canPlace(st, x)) any = true;
    if (!any) { st.phase = 'fail'; st.endReason = 'full'; return; }
    if (st.hand && st.hand.length === 0 && !anyToolUsable(st)) { st.phase = 'fail'; st.endReason = 'hand'; }
  }
  function anyToolUsable(st) {
    for (const k of TOOL_KEYS) {
      if (!(st.charges[k] > 0)) continue;
      const opts = TOOLS[k].aim === 'col' ? [...Array(W).keys()].map((x) => ({ type: 'tool', k, x })) : TOOLS[k].aim === 'cat' ? st.catsAvail.map((c) => ({ type: 'tool', k, cat: c })) : [k === 'spark' ? { type: 'spark' } : k === 'uv' ? { type: 'uv' } : { type: 'tool', k }];
      for (const a of opts) if (simulateAction(st, a)) return true;
    }
    if (st.charges.temp > 0) for (const d of [1, -1]) if (simulateAction(st, { type: 'temp', dir: d })) return true;
    return false;
  }
  function consume(st, id) {
    if (st.mode === 'sandbox') return;
    if (st.hand) { st.hand.splice(st.hand.indexOf(id), 1); return; }
    const idx = new Set(atomsFor(st, id));
    st.tray = st.tray.filter((_, i) => !idx.has(i));
  }
  const useCharge = (st, k) => { if (st.mode === 'sandbox') return true; if (!(st.charges[k] > 0)) return false; st.charges[k]--; return true; };
  const hasCharge = (st, k) => st.mode === 'sandbox' || st.charges[k] > 0;
  function nextTemp(st, dir) {
    const i = st.temps.indexOf(st.T);
    if (i < 0) { // 目前溫度不在清單上（不該發生）：找最近的
      const c = st.temps.filter((t) => (dir > 0 ? t > st.T : t < st.T));
      return c.length ? (dir > 0 ? c[0] : c[c.length - 1]) : null;
    }
    const j = i + dir;
    return j >= 0 && j < st.temps.length ? st.temps[j] : null;
  }
  const emptyRes = () => ({ steps: [], total: 0, depth: 0, found: [], foundRx: [], tally: newTally() });

  /** 執行一個動作；回傳 {steps,total,depth,...}，不合法或沒效果則回傳 null */
  function act(st, a) {
    if (st.phase !== 'play') return null;
    let res;
    if (a.type === 'place') {
      const ok = st.mode === 'sandbox' ? !!C[a.cid] : candidates(st).includes(a.cid);
      if (!ok || !canPlace(st, a.x)) return null;
      consume(st, a.cid);
      const cell = place(st, a.cid, a.x);
      const afterPlace = snap(st);
      res = resolve(st);
      res.afterPlace = afterPlace;
      res.found.push(a.cid);
      res.placed = { id: cell.id, c: a.cid, x: a.x };
      if (st.mode !== 'sandbox') st.turnsLeft--;
      st.moves++;
      // 故事模式：每回合至少換 3 個新原子，用不到的原子不會一直卡在反應台上
      if (st.mode === 'story' && !st.hand) {
        while (st.tray.length > st.traySize - 3) st.tray.splice(Math.floor(rand(st) * st.tray.length), 1);
      }
      refill(st);
    } else if (a.type === 'temp') {
      const nt = nextTemp(st, a.dir);
      if (nt == null || !hasCharge(st, 'temp')) return null;
      useCharge(st, 'temp');
      st.T = nt;
      res = resolve(st);
      st.moves++;
    } else if (a.type === 'spark') {
      if (!hasCharge(st, 'spark') || !sparkable(st)) return null;
      useCharge(st, 'spark');
      res = resolve(st, { spark: true });
      st.moves++;
    } else if (a.type === 'uv') {
      if (!hasCharge(st, 'uv') || !uvable(st)) return null;
      useCharge(st, 'uv');
      res = resolve(st, { uv: true });
      st.moves++;
    } else if (a.type === 'redraw') {
      if (st.hand || st.mode === 'sandbox' || !hasCharge(st, 'redraw')) return null;
      useCharge(st, 'redraw');
      st.tray = [];
      refill(st);
      res = emptyRes();
    } else if (a.type === 'tool') {
      if (!TOOLS[a.k] || ['spark', 'uv'].includes(a.k) || !hasCharge(st, a.k)) return null;
      const tally = newTally();
      const t = toolStep(st, a, tally);
      if (!t) return null;
      useCharge(st, a.k);
      res = resolve(st, { depth: t.gain > 0 ? 1 : 0, tally });
      res.steps.unshift(t.step);
      res.total += t.gain;
      res.found.push(...t.found);
      res.foundRx.push(...t.foundRx);
      st.moves++;
    } else if (a.type === 'clear') {
      if (st.mode !== 'sandbox') return null;
      st.grid = emptyGrid();
      res = emptyRes();
    } else return null;
    st.score += res.total;
    for (const id in res.tally.made) bump(st.prog.made, id, res.tally.made[id]);
    for (const id in res.tally.coll) bump(st.prog.coll, id, res.tally.coll[id]);
    st.prog.fl = st.prog.fl || {};
    for (const e in res.tally.fl || {}) bump(st.prog.fl, e, res.tally.fl[e]);
    for (const s of res.steps) if (s.logs) for (const l of s.logs) st.log.unshift(l);
    st.log.length = Math.min(st.log.length, 40);
    st.best.chain = Math.max(st.best.chain, res.depth);
    st.best.turn = Math.max(st.best.turn, res.total);
    checkEnd(st);
    return res;
  }
  const lite = (st) => { const s = JSON.parse(JSON.stringify({ ...st, levelStart: null, log: [] })); return s; };
  /** 預覽：在副本上試放，回傳得分與落點 */
  function simulatePlace(st, cid, x) {
    if (!canPlace(st, x)) return null;
    const s = { grid: st.grid.map((c) => c.slice()), T: st.T, up: st.up, uid: st.uid, relics: st.relics, cats: st.cats };
    const cell = place(s, cid, x);
    const landing = posOf(s, cell.id);
    let adj = 0;
    for (const [dx, dy] of DIRS) {
      const nx = landing[0] + dx, ny = landing[1] + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const b = s.grid[nx][ny];
      if (b && b.c === cid) adj++;
    }
    const r = resolve(s);
    return { total: r.total, depth: r.depth, landing, adj, events: eventsOf(r), tally: r.tally };
  }
  const eventsOf = (r) => r.steps.flatMap((q) => q.logs || []);
  function simulateAction(st, a) {
    const s = lite(st);
    const r = act(s, a);
    return r ? { total: r.total, depth: r.depth, events: eventsOf(r), tally: r.tally, st: s } : null;
  }

  // ---------------------------------------------------------------- 提示
  /** 這個結果對目標的幫助（分數換算） */
  function goalGain(st, tally) {
    if (!st.goals) return 0;
    let g = 0;
    for (const go of st.goals) {
      if (go.t !== 'make' && go.t !== 'collect') continue;
      const have = (go.t === 'make' ? st.prog.made : st.prog.coll)[go.c] || 0;
      const need = Math.max(0, go.n - have);
      const got = (go.t === 'make' ? tally.made : tally.coll)[go.c] || 0;
      g += Math.min(need, got) * 120;
    }
    for (const go of st.goals) if (go.t === 'flames') for (const e in tally.fl || {}) if (!(st.prog.fl || {})[e]) g += 120;
    return g;
  }
  function toolActions(st) {
    const out = [];
    if (hasCharge(st, 'spark') && sparkable(st)) out.push({ type: 'spark' });
    if (hasCharge(st, 'uv') && uvable(st)) out.push({ type: 'uv' });
    if (hasCharge(st, 'temp')) { if (nextTemp(st, 1) != null) out.push({ type: 'temp', dir: 1 }); if (nextTemp(st, -1) != null) out.push({ type: 'temp', dir: -1 }); }
    for (const k of TOOL_KEYS) {
      if (k === 'spark' || k === 'uv' || !hasCharge(st, k)) continue;
      if (TOOLS[k].aim === 'col') for (let x = 0; x < W; x++) out.push({ type: 'tool', k, x });
      else if (TOOLS[k].aim === 'cat') for (const c of st.catsAvail) { if (!st.cats.includes(c)) out.push({ type: 'tool', k, cat: c }); }
      else out.push({ type: 'tool', k });
    }
    return out;
  }
  /** 這個反應在這一關有沒有辦法觸發 */
  function reachable(st, rx) {
    const maxT = TEMPS[Math.max(...st.temps)].t;
    const can = (k) => st.mode === 'sandbox' || st.charges[k] > 0;
    if (rx.cat && (st.cats.includes(rx.cat.k) || (st.catsAvail.includes(rx.cat.k) && can('cat'))) && maxT >= rx.cat.t) return true;
    if (rx.cond === 'auto') return true;
    if (typeof rx.cond === 'number') return maxT >= rx.cond;
    if (rx.cond === 'burn') return can('spark') || (C[rx.a].ai != null && maxT >= C[rx.a].ai);
    if (rx.cond === 'spark') return can('spark');
    if (rx.cond === 'uv') return can('uv');
    return false;
  }
  /** 這個分子對目標有沒有幫助（直接收集，或是能生成目標的反應物） */
  function goalReactant(st, cid) {
    let s = 0;
    for (const g of st.goals || []) {
      if (g.t !== 'make' && g.t !== 'collect') continue;
      if (g.t === 'collect' && cid === g.c) s += 40;
      for (const rx of RX) if ((rx.a === cid || rx.b === cid) && rx.full.includes(g.c) && reachable(st, rx)) { s += 30; break; }
      const c = C[cid];
      if (c.dec && c.dec.keep.includes(g.c)) s += 10;
      if (ELEC[cid] && ELEC[cid].keep.includes(g.c) && st.charges.electro > 0) s += 14;
      if (c.pho && c.pho.keep.includes(g.c) && st.charges.uv > 0) s += 14;
    }
    return s;
  }
  /** 落點旁邊的同種分子、之後可以觸發的反應夥伴 */
  function setupScore(st, cid, r) {
    if (!r.landing) return 0;
    const [lx, ly] = r.landing;
    let s = 0;
    const v = value(st, cid);
    for (const [dx, dy] of DIRS) {
      const c = st.grid[lx + dx] && st.grid[lx + dx][ly + dy];
      if (!c) continue;
      if (c.c === cid) s += v * 0.8;
      const list = PAIR.get(cid + '|' + c.c);
      if (list) for (const { rx } of list) {
        if (!reachable(st, rx)) continue;
        const goalHit = (st.goals || []).some((g) => (g.t === 'make' || g.t === 'collect') && rx.full.includes(g.c));
        s += goalHit ? 60 : 6;
      }
    }
    return s;
  }
  const actVal = (st, r) => r.total + goalGain(st, r.tally) + (r.st && r.st.phase === 'clear' ? 1e6 : 0);
  /** 放下去之後，再用一次工具（不花回合）能得到多少 */
  function followUp(st, a) {
    const s = lite(st);
    if (!act(s, a)) return { v: 0 };
    if (s.phase === 'clear') return { v: 1e6 };
    let best = { v: 0 };
    for (const t of toolActions(s)) {
      if (t.type === 'tool' && !['cat', 'electro', 'flame', 'filter', 'distill'].includes(t.k)) continue;
      const r = simulateAction(s, t);
      if (r) { const v = actVal(s, r); if (v > best.v) best = { v, a: t, s }; }
    }
    return best;
  }
  /** 下一步建議（提示列與電腦玩家共用）。rnd：電腦玩家用的隨機擾動 */
  function advise(st, rnd) {
    if (st.phase !== 'play' || st.mode === 'sandbox') return null;
    const noise = rnd || (() => 0);
    const cands = candidates(st);
    const deep = cands.length * W <= 90;
    let best = null;
    for (const cid of cands) {
      const v0 = value(st, cid);
      const gr = goalReactant(st, cid);
      for (let x = 0; x < W; x++) {
        const r = simulatePlace(st, cid, x);
        if (!r) continue;
        const now = r.total + goalGain(st, r.tally);
        const su = now === 0 ? setupScore(st, cid, r) : 0;
        let fu = { v: 0 };
        if (deep && now === 0 && (su > 0 || gr > 0)) fu = followUp(st, { type: 'place', cid, x });
        const score = now + su + gr + v0 * 0.05 - colItems(st, x).length * 0.6 + 0.85 * fu.v + noise() * 3;
        if (!best || score > best.score) best = { cid, x, score, now, fu, r };
      }
    }
    let tool = null;
    const goalLevel = (st.goals || []).some((g) => g.t !== 'score');
    for (const a of toolActions(st)) {
      const r = simulateAction(st, a);
      if (!r) continue;
      const gg = goalGain(st, r.tally);
      const win = r.st.phase === 'clear';
      let v = r.total + gg + (win ? 1e6 : 0);
      let worth = win || gg > 0 || r.depth >= 2 || r.total >= 20 || ((a.type === 'spark' || a.type === 'uv') && r.total > 0);
      if (goalLevel && a.type === 'tool' && a.k !== 'cat' && !win && gg <= 0) worth = false; // 有收集／製造目標時，不把儀器浪費在湊分數上
      let then = null;
      if (!worth && (a.type === 'temp' || (a.type === 'tool' && a.k === 'cat'))) {
        // 兩步：先調溫度／加觸媒（沒有立即效果），下一步再用工具
        let b2 = 0;
        for (const t of toolActions(r.st)) { if (t.type === 'temp') continue; const r2 = simulateAction(r.st, t); if (r2) { const vv = actVal(r.st, r2); if (vv > b2) { b2 = vv; then = t; } } }
        if (b2 >= 20) { v = 0.8 * b2; worth = true; }
      }
      if (worth && v > 0 && (!tool || v > tool.v)) tool = { a, v, r, then };
    }
    // 工具不花回合：只要不比最好的放法差太多（或放法本身也只是為了之後用工具），就先用工具
    if (tool && (!best || tool.v >= best.score * 0.7 || (best.now === 0 && best.fu.v <= tool.v * 1.5))) {
      const { r } = tool;
      return { kind: 'tool', action: tool.a, then: tool.then, v: tool.v, total: r.total, depth: r.depth, events: r.events, tally: r.tally };
    }
    if (!best) return null;
    const a = { type: 'place', cid: best.cid, x: best.x };
    const base = { action: a, cid: best.cid, x: best.x, total: best.r.total, depth: best.r.depth, events: best.r.events, adj: best.r.adj, landing: best.r.landing, tally: best.r.tally };
    if (best.now > 0) return { kind: 'place', ...base };
    if (best.fu.v > 0 && best.fu.a) return { kind: 'combo', then: best.fu.a, ...base };
    if (best.r.adj > 0) return { kind: 'setup', ...base };
    return { kind: 'start', ...base };
  }
  const hint = (st) => advise(st);

  // ---------------------------------------------------------------- 謎題求解（給測試與提示用）
  function puzzleActions(st) {
    const out = [];
    for (const cid of candidates(st)) for (let x = 0; x < W; x++) if (canPlace(st, x)) out.push({ type: 'place', cid, x });
    out.push(...toolActions(st));
    return out;
  }
  /** 深度優先找最少步數解（只適合手牌固定的謎題關）；回傳動作陣列或 null */
  function solve(st, maxDepth = 5, budget = 200000) {
    let nodes = 0;
    for (let d = 1; d <= maxDepth; d++) {
      const path = [];
      const seen = new Map();
      const dfs = (s, left) => {
        if (++nodes > budget) return null;
        if (s.phase === 'clear') return path.slice();
        if (left === 0 || s.phase !== 'play') return null;
        const key = JSON.stringify([s.grid.map((c) => c.map((q) => (q ? q.c : 0))), s.T, s.hand, s.charges, s.cats, s.prog, s.score]);
        if ((seen.get(key) || -1) >= left) return null;
        seen.set(key, left);
        for (const a of puzzleActions(s)) {
          const t = lite(s);
          if (!act(t, a)) continue;
          path.push(a);
          const r = dfs(t, left - 1);
          if (r) return r;
          path.pop();
        }
        return null;
      };
      const r = dfs(lite(st), d);
      if (r) return r;
      if (nodes > budget) return null;
    }
    return null;
  }

  // ---------------------------------------------------------------- 無限挑戰：補給站
  function makeOffers(st) {
    const locked = UNLOCK_ORDER.filter((e) => !st.unlocked.includes(e));
    const offers = locked.slice(0, 2).map((e) => ({ type: 'element', e }));
    const pool = [];
    if (st.traySize < TRAY_MAX) pool.push({ type: 'tray' }, { type: 'tray' });
    pool.push({ type: 'max', k: 'temp' }, { type: 'max', k: 'spark' }, { type: 'max', k: 'uv' }, { type: 'max', k: 'redraw' }, { type: 'max', k: 'undo' },
      { type: 'max', k: 'distill' }, { type: 'max', k: 'filter' }, { type: 'max', k: 'electro' });
    for (const e of st.unlocked) pool.push({ type: 'upgrade', e }, { type: 'upgrade', e }, { type: 'enrich', e });
    for (const r in RELICS) if (!has(st, r)) pool.push({ type: 'relic', r }, { type: 'relic', r });
    const same = (p, o) => p.type === o.type && p.e === o.e && p.r === o.r && p.k === o.k;
    while (offers.length < 4 && pool.length) {
      const o = pool.splice(Math.floor(rand(st) * pool.length), 1)[0];
      if (!offers.some((p) => same(p, o))) offers.push(o);
    }
    return offers;
  }
  function takeOffer(st, idx) {
    if (st.phase !== 'clear' || !st.offers || !st.offers[idx] || st.picks <= 0) return false;
    const o = st.offers[idx];
    if (o.type === 'element') { st.unlocked.push(o.e); st.bag[o.e] = ELEMENTS[o.e].w; (st.newEls = st.newEls || []).push(o.e); }
    else if (o.type === 'tray') st.traySize = Math.min(TRAY_MAX, st.traySize + 1);
    else if (o.type === 'max') st.max[o.k] = (st.max[o.k] || 0) + 1;
    else if (o.type === 'upgrade') st.up[o.e] = (st.up[o.e] || 0) + 1;
    else if (o.type === 'enrich') st.bag[o.e] = (st.bag[o.e] || 0) + 2;
    else if (o.type === 'relic') { if (!st.relics.includes(o.r)) st.relics.push(o.r); }
    st.offers.splice(idx, 1);
    st.picks--;
    return true;
  }
  function nextLevel(st) {
    st.level++;
    st.unlocked.sort((a, b) => ELEMENTS[a].z - ELEMENTS[b].z);
    startLevel(st);
  }

  /** 某物質參與的反應（只列出元素都在清單裡的） */
  function reactionsOf(id, unlocked) {
    const ok = (f) => C[f].els.every((e) => !unlocked || unlocked.includes(e));
    return RX.filter((r) => (r.a === id || r.b === id || (r.via && r.b === id)) && ok(r.a) && ok(r.b));
  }

  return {
    VERSION, W, H, TRAY_START, TRAY_MAX, TURNS, BASE_MAX, CHEM,
    ELEMENTS, ELEMENT_ORDER, START_ELEMENTS, UNLOCK_ORDER, TEMPS, ROOM, ALL_TEMPS, C, RX, PAIR, RXKEY, RELICS, ACID_KINDS, TOOLS, TOOL_KEYS, CATALYSTS, FLAME, ELEC, PRECIP,
    parseFormula, fText, fHTML, balance, balanceInfo, equation, rxEquation, rxSides, decEquation, phoEquation, elecEquation,
    phaseAt, value, upMult, targetFor, setTarget: (b, g) => { TARGET_BASE = b; TARGET_GROWTH = g; },
    candidates, atomsFor, canPlace, sparkable, uvable, rxActive, activeRx, colItems, posOf, countIn, canElectro, nextTemp, hasCharge,
    newLevel, newSandbox, newRun, startLevel, retryLevel, act, resolve, simulatePlace, simulateAction, hint, advise, toolActions, solve, lite,
    goalProgress, goalDone, goalsMet, starOk, countStars, goalGain,
    makeOffers, takeOffer, nextLevel, reactionsOf, rand,
  };
})();
if (typeof module !== 'undefined') module.exports = Lab;
