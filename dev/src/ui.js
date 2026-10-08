/* 夜間實驗室 v2 — 畫面與操作 */
(() => {
  'use strict';
  const L = Lab;
  const LV = NL_LEVELS;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const SAVE = 'nightlab.v2';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = RM ? { move: 60, flash: 80, pop: 60, gap: 40 } : { move: 260, flash: 300, pop: 220, gap: 150 };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const PHN = { s: '固態', l: '液態', g: '氣態' };
  const TCOL = ['#c6e8ff', '#a6dbff', '#8fd0ff', '#9fe3c4', '#ffd27a', '#ffb547', '#ff9a3d', '#ff7a3d', '#ff4d2e'];
  const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const KIND = { puzzle: '謎題', limit: '限制', boss: '關主' };

  let st = null, meta = null, sel = null, aim = null, busy = false, undo = [], inspectId = null, shownScore = 0, cell = 60;
  let tut = null, lastHint = null, pulseX = null, pickEl = null, pickQ = '';
  const tiles = new Map();

  // ------------------------------------------------------------ 顏色、字級
  const EC = (e) => L.ELEMENTS[e].color;
  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  }
  const inkFor = (hex) => (lum(hex) > 0.33 ? '#121822' : '#ffffff');
  const byZ = (a, b) => L.ELEMENTS[a].z - L.ELEMENTS[b].z;
  const mainCol = (id) => L.C[id].col || EC(L.C[id].c1);
  const compStyle = (id) => { const c = L.C[id], m = mainCol(id); return `--c1:${m};--cg:${c.colg || m};--ink:${inkFor(m)};--fs:${fsFor(id)}`; };
  const atomStyle = (e) => `--c:${EC(e)};--ink:${inkFor(EC(e))}`;
  function fsFor(id) {
    const f = L.fText(id);
    const w = f.length - (f.match(/[₀-₉·]/g) || []).length * 0.4;
    return w <= 2.2 ? 0.34 : w <= 3.4 ? 0.3 : w <= 4.6 ? 0.25 : w <= 6 ? 0.21 : w <= 8 ? 0.175 : w <= 10 ? 0.15 : 0.13;
  }
  function tileInner(id) {
    const dots = L.C[id].els.slice().sort(byZ).map((e) => `<i style="background:${EC(e)}"></i>`).join('');
    return `<div class="body"><span class="f">${L.fHTML(id)}</span><span class="dots">${dots}</span></div>`;
  }
  const fmtT = (t) => (t === Infinity ? '—' : `${t} °C`);
  const FM = (f) => `<b class="fm">${L.fHTML(f)}</b>`;
  const rich = (t) => t.replace(/\{([^}]+)\}/g, (_, f) => FM(f));

  // ------------------------------------------------------------ 圖示
  const IC = {
    spark: '<path d="M13 2.5 4.5 13.5H11L10 21.5l8.5-11H12z"/>',
    uv: '<circle cx="12" cy="11" r="4"/><path d="M12 2.5v2M4.5 5.5l1.5 1.5M19.5 5.5 18 7M3 11h2M19 11h2M9.5 19h5M10.5 21.5h3"/><path d="M10 15v4M14 15v4"/>',
    redraw: '<path d="M4 7h11l-3-3M20 17H9l3 3"/><path d="M20 7.5A8 8 0 0 0 15 4.6M4 16.5A8 8 0 0 0 9 19.4"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    distill: '<path d="M6 21h6a4 4 0 0 0 1-7.9V8H5v5.1A4 4 0 0 0 6 21z"/><path d="M5 8h8M13 9l7 6M18 15v5"/>',
    rotavap: '<circle cx="10" cy="14" r="6"/><path d="M10 8V3h9M16 14a6 6 0 0 1-2 4.5"/><path d="M7 14a3 3 0 0 1 3-3"/>',
    filter: '<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
    funnel: '<path d="M8 3h8M9 3v3a6 6 0 0 0-3 5.2c0 3.3 2.7 4.8 6 4.8s6-1.5 6-4.8A6 6 0 0 0 15 6V3"/><path d="M12 16v5M7 11h10"/>',
    centri: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.5"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>',
    dry: '<path d="M9 3h6v4l2 2v12H7V9l2-2z"/><path d="M7 13h10M9.5 16.5h.01M12 15.5h.01M14.5 17.5h.01"/>',
    electro: '<rect x="3" y="7" width="16" height="11" rx="2"/><path d="M19 11h2v3h-2M8 10.5v4M6 12.5h4M13 12.5h3"/>',
    flame: '<path d="M12 3c.6 3.2 4.6 5 4.6 9.6a4.6 4.6 0 0 1-9.2 0c0-2 .9-3.3 2-4.2.2 1.3.8 2.2 1.7 2.6C11 8.5 11.3 5.6 12 3z"/>',
    cat: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><circle cx="12" cy="12" r="2.5"/>',
    clear: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k] || ''}</svg>`;
  const TOOLNAME = (k) => (L.TOOLS[k] ? L.TOOLS[k].zh : { redraw: '重抽', undo: '復原', temp: '溫控' }[k] || k);

  // ------------------------------------------------------------ 存檔
  function save() {
    try {
      const slots = meta.slots;
      if (st) slots[st.mode] = st;
      localStorage.setItem(SAVE, JSON.stringify({ meta, mode: st ? st.mode : null }));
    } catch (e) { /* 私密模式等 */ }
  }
  function load() { try { const r = localStorage.getItem(SAVE); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  const defOf = (s) => (s && s.lv ? LV.byId(s.lv) : null);

  // ------------------------------------------------------------ 故事進度
  const starsOf = (id) => (meta.stars && meta.stars[id]) || 0;
  const chStars = (ch) => ch.levels.reduce((a, l) => a + starsOf(l.id), 0);
  const totalStars = () => LV.ALL.reduce((a, l) => a + starsOf(l.id), 0);
  function chapterOpen(ch) {
    const i = LV.CHAPTERS.indexOf(ch);
    if (i <= 0) return true;
    const prev = LV.CHAPTERS[i - 1];
    return starsOf(prev.levels[prev.levels.length - 1].id) > 0 && chStars(prev) >= (ch.need || 0);
  }
  function levelOpen(def) {
    const ch = LV.CHAPTERS.find((c) => c.id === def.ch);
    if (!chapterOpen(ch)) return false;
    const i = ch.levels.findIndex((l) => l.id === def.id);
    return i === 0 || starsOf(ch.levels[i - 1].id) > 0;
  }
  const nextDef = (def) => { const i = LV.ALL.findIndex((l) => l.id === def.id); return LV.ALL[i + 1] || null; };

  // ------------------------------------------------------------ 版面
  function layout() {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const wide = vw >= 960 && vh >= 540;
    document.documentElement.dataset.layout = wide ? 'wide' : 'narrow';
    const cs = getComputedStyle(document.documentElement);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    let c;
    if (wide) {
      const bar = $('.bar').getBoundingClientRect().height;
      const coach = $('#coach').hidden ? 0 : $('#coach').getBoundingClientRect().height + 10;
      const availH = vh - padY - bar - coach - 10 - 26 - 28 - 12 - 40 - 6;
      const availW = Math.min(1440, vw) - 32 - 96 - 28 - 380 - 34 - 20;
      c = Math.min(availH / 9, availW / 7, 86);
    } else {
      const availW = vw - 32 - 34 - 22;
      c = Math.min(availW / 7, Math.max(40, (vh - padY - 640) / 9), 86);
    }
    cell = Math.max(34, Math.floor(c));
    document.documentElement.style.setProperty('--cell', cell + 'px');
    buildTicks();
    for (const [, el] of tiles) { el.classList.add('instant'); posTile(el, +el.dataset.x, +el.dataset.y); }
    requestAnimationFrame(() => { for (const [, el] of tiles) el.classList.remove('instant'); });
    renderPreview();
  }
  function buildTicks() {
    let html = '';
    for (let r = 0; r <= L.H; r++) {
      const y = (L.H - r) * cell;
      const long = r % 2 === 0;
      html += `<i class="${long ? 'l' : ''}" style="top:${y}px"></i>`;
      if (long && r > 0) html += `<span style="top:${y}px">${r * 25}</span>`;
    }
    $('#ticks').innerHTML = html + '<em>mL</em>';
  }
  function buildScale() {
    const ol = $('#scale');
    ol.querySelectorAll('li').forEach((li) => li.remove());
    for (let i = L.TEMPS.length - 1; i >= 0; i--) {
      const T = L.TEMPS[i];
      const li = h('li', '', `<span class="t">${T.t}°</span><span class="n">${T.name}</span>`);
      li.dataset.i = i;
      li.style.setProperty('--tc', TCOL[i]);
      ol.appendChild(li);
    }
  }

  // ------------------------------------------------------------ 燒杯
  function posTile(el, x, y) { el.style.transform = `translate(${x * cell}px, ${y * cell}px)`; }
  function clearTiles() { for (const [, el] of tiles) el.remove(); tiles.clear(); }
  function renderGrid(grid, opt = {}) {
    const layer = $('#tiles');
    const alive = new Set();
    for (let x = 0; x < L.W; x++) {
      for (let y = 0; y < L.H; y++) {
        const c = grid[x][y];
        if (!c) continue;
        alive.add(c.id);
        let el = tiles.get(c.id);
        const ph = L.phaseAt(c.c, st.T);
        if (!el) {
          el = h('div', 'tile instant', tileInner(c.c));
          el.dataset.id = c.id;
          el.style.cssText = compStyle(c.c);
          el.dataset.phase = ph;
          tiles.set(c.id, el);
          layer.appendChild(el);
          if (opt.drop === c.id) {
            posTile(el, x, -1.3);
            el.getBoundingClientRect();
            el.classList.remove('instant');
            posTile(el, x, y);
          } else {
            el.classList.add('enter');
            posTile(el, x, y);
            el.getBoundingClientRect();
            el.classList.remove('instant');
            requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('enter')));
          }
        } else {
          el.dataset.phase = ph;
          posTile(el, x, y);
        }
        el.dataset.x = x;
        el.dataset.y = y;
      }
    }
    for (const [id, el] of tiles) {
      if (!alive.has(id)) {
        tiles.delete(id);
        el.classList.add('gone');
        setTimeout(() => el.remove(), 380);
      }
    }
  }
  function refreshPhases() { for (const [, el] of tiles) { const c = st.grid[+el.dataset.x] && st.grid[+el.dataset.x][+el.dataset.y]; if (c) el.dataset.phase = L.phaseAt(c.c, st.T); } }
  function fxBurst(fx) {
    const layer = $('#fx');
    for (const f of fx) {
      const el = h('div', 'fx fx-' + f.type);
      el.style.transform = `translate(${f.x * cell}px, ${f.y * cell}px)`;
      if (f.color) el.style.setProperty('--fxc', f.color);
      layer.appendChild(el);
      setTimeout(() => el.remove(), 900);
    }
  }
  function popScore(s) {
    if (!s.fx || !s.fx.length || !s.gain) return;
    const cx = s.fx.reduce((a, f) => a + f.x, 0) / s.fx.length + 0.5;
    const cy = s.fx.reduce((a, f) => a + f.y, 0) / s.fx.length + 0.5;
    const el = h('div', 'pop', `+${s.gain}${s.mult > 1 ? `<i>×${s.mult}</i>` : ''}`);
    el.style.left = cx * cell + 'px';
    el.style.top = cy * cell - 12 + 'px';
    $('#fx').appendChild(el);
    setTimeout(() => el.remove(), 1050);
  }
  function banner(text) {
    const el = h('div', 'banner', text);
    $('#beaker').appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  // ------------------------------------------------------------ 畫面各區
  function goalText(g) {
    const [a, b] = L.goalProgress(st, g);
    const done = a >= b;
    let t;
    switch (g.t) {
      case 'score': t = `分數 ${Math.min(shownScore, b)}/${b}`; break;
      case 'make': t = `做出 ${FM(g.c)} ${a}/${b}`; break;
      case 'collect': t = `收集 ${FM(g.c)} ${a}/${b}`; break;
      case 'clear': t = g.c ? `清掉所有 ${FM(g.c)}` : '清空燒杯'; break;
      case 'flames': t = `焰色 ${a}/${b} 種`; break;
      default: t = '';
    }
    return `<span class="gl${done ? ' done' : ''}">${done ? '✓ ' : ''}${t}</span>`;
  }
  function renderHeader() {
    const def = defOf(st);
    const mode = st.mode;
    $('#lvLabel').textContent = mode === 'story' ? def.id : mode === 'sandbox' ? '沙盒' : `第 ${st.level} 關`;
    $('#lvTitle').textContent = mode === 'story' ? def.title : mode === 'sandbox' ? '自由實驗' : '無限挑戰';
    $('#els').innerHTML = mode === 'sandbox' ? '' : st.unlocked.slice().sort(byZ).map((e) => `<i style="${atomStyle(e)}" title="${L.ELEMENTS[e].zh}">${e}</i>`).join('');
    $('#score').textContent = shownScore;
    const sg = st.goals && st.goals.find((g) => g.t === 'score');
    $('#targetBox').hidden = !sg;
    $('#meterBox').hidden = !sg;
    if (sg) { $('#target').textContent = sg.n; $('#meter').style.width = Math.min(100, (shownScore / sg.n) * 100) + '%'; }
    const others = (st.goals || []).filter((g) => g.t !== 'score');
    $('#goalList').innerHTML = others.map(goalText).join('');
    $('#goalList').hidden = !others.length;
    const showTurns = mode !== 'sandbox' && !st.hand;
    $('#turnsBox').hidden = !showTurns;
    if (showTurns) {
      $('#turns').textContent = st.turnsLeft;
      $('#turnsBox').classList.toggle('low', st.turnsLeft <= 3);
    }
  }
  const inf = (n) => (st.mode === 'sandbox' ? '∞' : n);
  function renderThermo() {
    const i = st.T;
    $$('#scale li').forEach((li) => {
      const k = +li.dataset.i;
      li.classList.toggle('on', k === i);
      li.classList.toggle('off', !st.temps.includes(k));
    });
    $('#scale').style.setProperty('--tc', TCOL[i]);
    $('#merc').style.height = `calc(${((i + 0.5) / L.TEMPS.length) * 100}% - 6px)`;
    $('#tN').textContent = inf(st.charges.temp);
    const play = st.phase === 'play';
    const can = L.hasCharge(st, 'temp');
    $('#heat').disabled = !play || !can || L.nextTemp(st, 1) == null;
    $('#cool').disabled = !play || !can || L.nextTemp(st, -1) == null;
    $('#vesselArea').dataset.temp = i;
    $('#srcLabel').textContent = `${L.TEMPS[i].name} ${L.TEMPS[i].t} °C`;
    $('#catBox').innerHTML = (st.cats || []).map((c) => `<span class="catchip" title="${L.CATALYSTS[c].desc}">${L.fHTML(c)} 觸媒</span>`).join('');
  }
  function renderTray() {
    const box = $('#tray');
    const trayP = $('.trayp');
    if (st.mode === 'sandbox') { trayP.hidden = true; return; }
    trayP.hidden = false;
    if (st.hand) {
      $('#trayTitle').textContent = '手牌';
      $('#trayHint').textContent = `剩 ${st.hand.length} 個分子`;
      box.classList.remove('dim');
      box.innerHTML = st.hand.map((id) => `<span class="hchip" style="${compStyle(id)}">${L.fHTML(id)}</span>`).join('') || '<span class="hint">手牌用完了</span>';
      return;
    }
    $('#trayTitle').textContent = '反應台';
    const use = sel ? new Set(L.atomsFor(st, sel)) : null;
    box.classList.toggle('dim', !!use);
    box.innerHTML = st.tray.map((e, i) => `<span class="atom${use && use.has(i) ? ' use' : ''}" style="${atomStyle(e)}" title="${L.ELEMENTS[e].zh}">${e}</span>`).join('');
    $('#trayHint').textContent = `${st.tray.length} 個原子`;
  }
  function sandboxList() {
    const q = pickQ.trim().toLowerCase();
    return Object.values(L.C).filter((c) => (!pickEl || c.els.includes(pickEl)) && (!q || c.id.toLowerCase().includes(q) || L.fText(c.id).toLowerCase().includes(q) || c.zh.includes(q)))
      .sort((a, b) => Math.max(...a.els.map((e) => L.ELEMENTS[e].z)) - Math.max(...b.els.map((e) => L.ELEMENTS[e].z)) || a.n - b.n).map((c) => c.id);
  }
  function renderPick() {
    const on = st.mode === 'sandbox';
    $('#pick').hidden = !on;
    if (!on) return;
    $('#pickEls').innerHTML = `<button type="button" class="pe${pickEl ? '' : ' on'}" data-e="">全部</button>` + L.ELEMENT_ORDER.map((e) => `<button type="button" class="pe${pickEl === e ? ' on' : ''}" data-e="${e}" style="${atomStyle(e)}">${e}</button>`).join('');
  }
  function renderCands() {
    const sandbox = st.mode === 'sandbox';
    const list = sandbox ? sandboxList() : L.candidates(st);
    if (sel && !list.includes(sel) && !sandbox) sel = null;
    $('#candTitle').textContent = sandbox ? `全部物質（${list.length}）` : st.hand ? '可以放的分子' : '可以合成';
    const box = $('#cands');
    if (!list.length) { box.innerHTML = `<div class="empty">${sandbox ? '找不到符合的物質。' : st.hand ? '手牌用完了。' : '合成不出東西了，試試重抽。'}</div>`; return; }
    box.innerHTML = list.map((id) => {
      const ph = L.phaseAt(id, st.T);
      return `<button class="cand${sel === id ? ' on' : ''}" type="button" data-id="${id}" style="${compStyle(id)}" aria-pressed="${sel === id}">` +
        `<span class="sw" data-phase="${ph}"></span><span class="cf">${L.fHTML(id)}</span><span class="cv">${L.value(st, id)}</span>` +
        `<span class="cn">${L.C[id].zh}</span><span class="cp">${PHN[ph]}</span></button>`;
    }).join('');
  }
  /** 這一關看得到的工具 */
  function toolList() {
    const out = [];
    const sb = st.mode === 'sandbox';
    for (const k of ['spark', 'uv']) if (sb || st.max[k] > 0) out.push(k);
    for (const k of L.TOOL_KEYS) if (k !== 'spark' && k !== 'uv' && (sb || st.max[k] > 0)) out.push(k);
    if (!st.hand && !sb) out.push('redraw');
    if (!sb) out.push('undo');
    else out.push('clear');
    return out;
  }
  function toolEnabled(k) {
    const play = st.phase === 'play';
    if (!play) return false;
    if (k === 'undo') return !!undo.length && st.charges.undo > 0;
    if (k === 'clear') return L.countIn(st) > 0;
    if (!L.hasCharge(st, k)) return false;
    if (k === 'spark') return L.sparkable(st);
    if (k === 'uv') return L.uvable(st);
    if (k === 'redraw') return true;
    if (k === 'cat') return st.catsAvail.some((c) => !st.cats.includes(c));
    if (L.TOOLS[k] && !L.TOOLS[k].aim) return !!L.simulateAction(st, { type: 'tool', k });
    if (L.TOOLS[k] && L.TOOLS[k].aim === 'col') return L.countIn(st) > 0;
    return true;
  }
  function renderTools() {
    const box = $('#tools');
    box.innerHTML = toolList().map((k) => {
      const n = k === 'clear' ? '' : `<b>${k === 'undo' || k === 'redraw' ? st.charges[k] : inf(st.charges[k])}</b>`;
      const title = L.TOOLS[k] ? L.TOOLS[k].desc : k === 'redraw' ? '把反應台上的原子全部換掉' : k === 'undo' ? '回到上一步' : '清空燒杯';
      return `<button class="btn tool${aim === k ? ' aiming' : ''}" type="button" data-k="${k}" title="${title}" ${toolEnabled(k) ? '' : 'disabled'}>${svg(k)}<span>${k === 'clear' ? '清空燒杯' : TOOLNAME(k)}</span>${n}</button>`;
    }).join('');
  }
  function condLabel(rx) {
    const out = [];
    if (rx.cat) out.push([`${L.fText(rx.cat.k)} 觸媒、≥${rx.cat.t} °C`, 'cat']);
    if (rx.cond === 'auto') out.push(['相鄰即反應', 'auto']);
    else if (rx.cond === 'spark') out.push(['火花（放電）', 'spark']);
    else if (rx.cond === 'uv') out.push(['紫外燈', 'uv']);
    else if (rx.cond === 'burn') out.push([L.C[rx.a].ai != null ? `火花，或 ≥${L.C[rx.a].ai} °C 自燃` : '火花點燃', 'burn']);
    else if (typeof rx.cond === 'number') out.push([`≥${rx.cond} °C`, 'heat']);
    return out;
  }
  const condHTML = (rx) => condLabel(rx).map(([l, c]) => `<span class="cond ${c}">${l}</span>`).join('');
  function logItem(l) {
    const g = `<span class="g">${l.gain ? '+' + l.gain : ''}${l.mult > 1 ? `<i>×${l.mult}</i>` : ''}</span>`;
    const vent = l.vent && l.vent.length ? ` <small>（${l.vent.map(L.fHTML).join('、')} 逸出）</small>` : '';
    if (l.k === 'rx') { const rx = L.RX[l.i]; return `<li><span class="k">${rx.kind}</span><span class="eq">${L.rxEquation(rx, true)}${vent}</span>${g}</li>`; }
    if (l.k === 'dec') return `<li><span class="k">熱分解</span><span class="eq">${L.decEquation(l.c, true)}${vent}</span>${g}</li>`;
    if (l.k === 'pho') return `<li><span class="k">光分解</span><span class="eq">${L.phoEquation(l.c, true)}${vent}</span>${g}</li>`;
    if (l.k === 'el') return `<li><span class="k">電解</span><span class="eq">${L.elecEquation(l.c, true)} <small>（${L.fHTML(l.out)} 在陽極收集）</small></span>${g}</li>`;
    if (l.k === 'tool') {
      const nm = TOOLNAME(l.t);
      if (l.t === 'cat') return `<li><span class="k">${nm}</span><span class="eq">加入 ${L.fHTML(l.cat)}（${L.CATALYSTS[l.cat].zh}）</span>${g}</li>`;
      if (l.t === 'funnel') return `<li><span class="k">${nm}</span><span class="eq">${L.fHTML(l.c)} 和 ${L.fHTML(l.c2)} 互換</span>${g}</li>`;
      if (l.t === 'centri') return `<li><span class="k">${nm}</span><span class="eq">依密度重新排列</span>${g}</li>`;
      if (l.t === 'flame') { const [col, zh] = L.FLAME[l.flame]; return `<li><span class="k">${nm}</span><span class="eq">${L.fHTML(l.c)} ×${l.n} <small style="color:${col}">● ${L.ELEMENTS[l.flame].zh}：${zh}色火焰</small></span>${g}</li>`; }
      return `<li><span class="k">${nm}</span><span class="eq">${L.fHTML(l.c)} ×${l.n} <small>${L.C[l.c].zh}</small></span>${g}</li>`;
    }
    return `<li><span class="k">收集</span><span class="eq">${L.fHTML(l.c)} ×${l.n} <small>${L.C[l.c].zh}</small></span>${g}</li>`;
  }
  function renderLog() {
    $('#log').innerHTML = st.log.length ? st.log.map(logItem).join('') : '<li class="empty" style="display:block;border:0">還沒有反應。把 3 個相同的分子連在一起，或讓會反應的分子靠在一起。</li>';
  }
  function compoundFacts(id) {
    const c = L.C[id];
    const f = [];
    if (c.mp === c.bp) f.push(`昇華點 <b>${fmtT(c.mp)}</b>`);
    else { f.push(`熔點 <b>${fmtT(c.mp)}</b>`); f.push(`沸點 <b>${fmtT(c.bp)}</b>`); }
    if (c.dec) f.push(`<b>≥${c.dec.t} °C</b> 分解`);
    if (c.ai != null) f.push(`自燃 <b>${c.ai} °C</b>`);
    f.push(`密度 <b>${c.d}</b>`);
    if (c.flame.length) f.push(`焰色 <b style="color:${L.FLAME[c.flame[0]][0]}">${L.FLAME[c.flame[0]][1]}</b>`);
    f.push(`價值 <b>${L.value(st, id)}</b>`);
    return f.map((x) => `<span>${x}</span>`).join('');
  }
  function knowList(id, els) {
    const c = L.C[id];
    const list = L.reactionsOf(id, els).map((rx) => `<li><span class="eq">${L.rxEquation(rx, true)}</span>${condHTML(rx)}</li>`);
    if (c.dec) list.unshift(`<li><span class="eq">${L.decEquation(id, true)}</span><span class="cond heat">≥${c.dec.t} °C 熱分解</span></li>`);
    if (c.pho) list.unshift(`<li><span class="eq">${L.phoEquation(id, true)}</span><span class="cond uv">紫外燈</span></li>`);
    if (L.ELEC[id]) list.unshift(`<li><span class="eq">${L.elecEquation(id, true)}</span><span class="cond auto">電解槽${L.ELEC[id].ph === 'l' ? '（要液態）' : ''}</span></li>`);
    return list;
  }
  function renderInspect() {
    const box = $('#inspect');
    $$('.tile.sel').forEach((e) => e.classList.remove('sel'));
    const pos = inspectId != null ? L.posOf(st, inspectId) : null;
    if (!pos) { box.hidden = true; inspectId = null; return; }
    const id = st.grid[pos[0]][pos[1]].c, c = L.C[id];
    const t = tiles.get(inspectId);
    if (t) t.classList.add('sel');
    const ph = L.phaseAt(id, st.T);
    const list = knowList(id, st.mode === 'sandbox' ? null : st.unlocked);
    box.innerHTML = `<button class="btn close" type="button" id="inspClose" aria-label="關閉">✕</button>
      <h3><span class="fm">${L.fHTML(id)}</span>${c.zh}</h3>
      <div class="facts"><span>現在是 <b>${PHN[ph]}</b></span>${compoundFacts(id)}</div>
      ${list.length ? `<ul class="rxlist">${list.slice(0, 16).join('')}</ul>` : '<div class="hint">以目前的元素，沒有會和它反應的物質。</div>'}
      ${c.simp ? '<p class="hint">這個物質的反應有簡化。</p>' : ''}`;
    box.hidden = false;
    $('#inspClose').onclick = () => { inspectId = null; renderInspect(); };
  }
  function renderPreview() {
    const bad = $('#badges'), gh = $('#ghosts');
    bad.innerHTML = '';
    gh.innerHTML = '';
    const play = st && st.phase === 'play';
    for (let x = 0; x < L.W; x++) {
      const b = h('div', 'badge');
      b.dataset.x = x;
      if (play && aim) {
        const p = L.simulateAction(st, { type: 'tool', k: aim, x });
        if (!p) { b.textContent = '—'; b.classList.add('num'); }
        else { b.textContent = p.total > 0 ? '+' + p.total : '✓'; b.classList.add('pos', 'aim'); if (p.depth >= 2) b.dataset.chain = p.depth; }
      } else if (play && sel) {
        const p = L.simulatePlace(st, sel, x);
        if (!p) { b.classList.add('full'); b.textContent = '滿'; }
        else {
          b.textContent = p.total > 0 ? '+' + p.total : '0';
          if (p.total > 0) b.classList.add('pos');
          if (p.depth >= 2) b.dataset.chain = p.depth;
          const g = h('div', 'ghost', '<div class="body"></div>');
          g.dataset.x = x;
          g.style.transform = `translate(${p.landing[0] * cell}px, ${p.landing[1] * cell}px)`;
          gh.appendChild(g);
        }
      } else { b.textContent = x + 1; b.classList.add('num'); }
      bad.appendChild(b);
    }
    $('#vesselArea').classList.toggle('aiming', !!aim);
  }
  function hoverCol(x) {
    const hi = $('#hiLayer');
    hi.innerHTML = '';
    if (pulseX != null) { const p = h('div', 'colpulse'); p.style.left = pulseX * cell + 'px'; hi.appendChild(p); }
    $$('.ghost').forEach((g) => g.classList.toggle('hot', x != null && +g.dataset.x === x));
    if (x == null) return;
    const c = h('div', 'colhi');
    c.style.left = x * cell + 'px';
    hi.appendChild(c);
  }
  function renderAll() {
    renderHeader(); renderThermo(); renderTray(); renderPick(); renderCands(); renderTools(); renderLog();
    renderGrid(st.grid); renderPreview(); renderInspect(); markTiles(); renderCoach();
  }

  // ------------------------------------------------------------ 下一步提示
  function why(ev) {
    if (!ev) return '會得分';
    if (ev.k === 'cl') return `湊成 ${ev.n} 個 ${FM(ev.c)} 相連，收集`;
    if (ev.k === 'dec') return `${FM(ev.c)} 受熱分解`;
    if (ev.k === 'pho') return `${FM(ev.c)} 照光分解`;
    if (ev.k === 'el') return `電解 ${FM(ev.c)}`;
    if (ev.k === 'tool') return ev.c ? `${TOOLNAME(ev.t)}：${FM(ev.c)}` : TOOLNAME(ev.t);
    const rx = L.RX[ev.i];
    return `${FM(rx.a)} 和 ${FM(rx.b)} 會${rx.cond === 'burn' ? '燃燒' : '反應'}（${rx.kind}）`;
  }
  function actText(a) {
    if (a.type === 'spark') return '按「火花」';
    if (a.type === 'uv') return '開「紫外燈」';
    if (a.type === 'temp') { const n = L.nextTemp(st, a.dir); return a.dir > 0 ? `加熱到 ${L.TEMPS[n].t} °C` : `冷卻到 ${L.TEMPS[n].t} °C`; }
    if (a.type === 'tool') {
      if (a.k === 'cat') return `加入 ${FM(a.cat)} 觸媒`;
      return L.TOOLS[a.k].aim === 'col' ? `用「${TOOLNAME(a.k)}」處理第 <b>${a.x + 1}</b> 欄` : `用「${TOOLNAME(a.k)}」`;
    }
    if (a.type === 'place') return `把 ${FM(a.cid)} 放在第 <b>${a.x + 1}</b> 欄`;
    return '';
  }
  function hintHTML(hn) {
    const pts = hn.total > 0 ? `，<span class="pts">+${hn.total}</span>` : '';
    const chain = hn.depth >= 2 ? `，還會連鎖 ${hn.depth} 段` : '';
    switch (hn.kind) {
      case 'place': return `把 ${FM(hn.cid)} 放在第 <b>${hn.x + 1}</b> 欄：${why(hn.events[0])}${chain}${pts}。`;
      case 'tool': return hn.then && !hn.total ? `先${actText(hn.action)}，接著${actText(hn.then)}（都不花回合）。` : `${actText(hn.action)}：${why(hn.events[0])}${chain}${pts}（不花回合）。`;
      case 'combo': return `把 ${FM(hn.cid)} 放在第 <b>${hn.x + 1}</b> 欄，然後${actText(hn.then)}。`;
      case 'setup': return `把 ${FM(hn.cid)} 放在第 <b>${hn.x + 1}</b> 欄，和旁邊的 ${FM(hn.cid)} 湊成一對，之後再補一個就能收集。`;
      case 'solve': return `謎題提示：先${actText(hn.action)}。`;
      default: return `先放一個 ${FM(hn.cid)}（${L.C[hn.cid].zh}）${st.goals && st.goals.some((g) => g.c === hn.cid) ? '，它就是這關的目標' : '，之後在它旁邊再放兩個，3 個相連就會收集得分'}。`;
    }
  }
  function computeHint() {
    if (st.hand) {
      const sol = L.solve(st, 5, 40000);
      if (sol && sol.length) return { kind: 'solve', action: sol[0], total: 0, depth: 0, events: [] };
      return null;
    }
    return L.hint(st);
  }
  function renderCoach() {
    const box = $('#coach');
    const off = !st || meta.hint === false || st.phase !== 'play' || st.mode === 'sandbox';
    if (box.hidden !== off) { box.hidden = off; requestAnimationFrame(layout); }
    if (off) return;
    $('#coachNeed').textContent = goalNeedText();
    const show = $('#coachShow');
    if (tut) { $('#coachText').textContent = '跟著橘色的說明一步一步做。'; show.hidden = true; return; }
    if (aim) {
      $('#coachText').innerHTML = `「${TOOLNAME(aim)}」：${L.TOOLS[aim].desc} 點燒杯的一欄使用，再點一次按鈕取消。`;
      show.hidden = true;
      return;
    }
    if (sel) {
      $('#coachText').innerHTML = `${FM(sel)} 會落在虛線框的位置。<span class="k-match">白框</span>是同種分子（3 個相連就收集），<span class="k-partner">橘框</span>是會和它反應的分子；燒杯上方是馬上會得到的分數。`;
      show.hidden = true;
      return;
    }
    lastHint = computeHint();
    $('#coachText').innerHTML = lastHint ? hintHTML(lastHint) : st.hand ? '試試看不同的順序；用「復原」退回上一步。' : '合成不出東西了，按「重抽」換一批原子。';
    show.hidden = !lastHint;
  }
  function goalNeedText() {
    if (st.mode === 'endless') return `還差 ${Math.max(0, st.target - shownScore)} 分 · 剩 ${st.turnsLeft} 回合`;
    if (st.hand) return `手牌 ${st.hand.length} · 已用 ${st.moves} 步`;
    return `剩 ${st.turnsLeft} 回合`;
  }
  function flashPulse(el) { if (!el) return; el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 2600); }
  function showHint() {
    const hn = lastHint;
    if (!hn || busy) return;
    const a = hn.action || (hn.cid != null ? { type: 'place', cid: hn.cid, x: hn.x } : null);
    if (!a) return;
    if (a.type === 'place') {
      selectCand(a.cid);
      pulseX = a.x;
      hoverCol(null);
      const chip = $(`.cand[data-id="${CSS.escape(a.cid)}"]`);
      if (chip) chip.scrollIntoView({ block: 'nearest' });
      if (document.documentElement.dataset.layout === 'narrow') $('#beaker').scrollIntoView({ block: 'center', behavior: RM ? 'auto' : 'smooth' });
      return;
    }
    if (a.type === 'temp') return flashPulse($(a.dir > 0 ? '#heat' : '#cool'));
    const k = a.type === 'tool' ? a.k : a.type;
    flashPulse($(`.tool[data-k="${k}"]`));
    if (a.type === 'tool' && a.x != null) { pulseX = a.x; hoverCol(null); }
  }
  function markTiles() {
    for (const [, el] of tiles) el.classList.remove('match', 'partner');
    if (!sel || !st) return;
    for (let x = 0; x < L.W; x++) {
      for (let y = 0; y < L.H; y++) {
        const c = st.grid[x][y];
        const el = c && tiles.get(c.id);
        if (!el) continue;
        if (c.c === sel) el.classList.add('match');
        else if (L.activeRx(st, sel, c.c, {})) el.classList.add('partner');
      }
    }
  }

  // ------------------------------------------------------------ 新手教學（1-1）
  const TUT = [
    { text: () => `這一關的目標：在 ${st.turnsLeft} 回合內，把分數湊到 <b>${st.goals[0].n}</b> 分。`, target: () => $('.goal'), btn: '下一步' },
    { text: () => `這些是反應台上的原子。點「${FM('H2O')} 水」，用 2 個 H 和 1 個 O 合成水。`, target: () => $('.cand[data-id="H2O"]'), wait: 'sel' },
    { text: () => '點燒杯發亮的<b>第 1 欄</b>，把水放進去。液體會沉到杯底。', col: 0 },
    { text: () => (sel === 'H2O' ? '放在<b>第 2 欄</b>，貼著剛剛那杯水。' : `很好！再點一次「${FM('H2O')}」。`), col: 1 },
    { text: () => (sel === 'H2O' ? '放在<b>第 3 欄</b>。3 個一樣的分子連在一起，就會<b>收集</b>得分！' : `第三個水：再點「${FM('H2O')}」。`), col: 2 },
    { text: () => '收集成功！3 個以上相同的分子上下左右相連就會得分，一次連越多個，分數越高。', target: () => $('.goal'), btn: '下一步' },
    { text: () => '還有其他得分方式：會反應的分子靠在一起會自動反應、加熱冷卻會讓物質移動。不知道下一步做什麼，就看這一列，或按「示範」。', target: () => $('#coach'), btn: '開始自己玩' },
  ];
  const tutTray = () => { st.tray = ['H', 'H', 'H', 'H', 'O', 'O', 'O']; };
  function tutStart() {
    tut = { i: 0 };
    tutTray();
    sel = null;
    renderAll();
    tutRender();
  }
  function tutEnd() {
    tut = null;
    pulseX = null;
    meta.tut = true;
    $$('.pulse').forEach((e) => e.classList.remove('pulse'));
    const b = $('#tut');
    if (b) b.remove();
    hoverCol(null);
    renderAll();
    save();
  }
  function tutShake() { const b = $('#tut'); if (!b) return; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
  function colRect(x) {
    const r = $('#badges').getBoundingClientRect();
    const t = $('#tiles').getBoundingClientRect();
    return { left: t.left + x * cell, width: cell, top: r.top, bottom: r.bottom, height: r.height };
  }
  function placeBubble(el, rect, prefer) {
    const bw = el.offsetWidth, bh = el.offsetHeight, m = 12;
    const fitsBelow = rect.bottom + bh + m <= innerHeight - 8, fitsAbove = rect.top - bh - m >= 8;
    let side = prefer || 'below';
    if (side === 'below' && !fitsBelow) side = fitsAbove ? 'above' : 'right';
    else if (side === 'above' && !fitsAbove) side = fitsBelow ? 'below' : 'right';
    el.dataset.side = side;
    if (side === 'right') {
      const left = Math.min(innerWidth - bw - 12, rect.left + rect.width + m);
      const top = Math.max(8, Math.min(innerHeight - bh - 8, rect.top + rect.height / 2 - bh / 2));
      el.style.left = Math.max(12, left) + 'px';
      el.style.top = top + 'px';
      el.style.setProperty('--ay', Math.max(14, Math.min(bh - 28, rect.top + rect.height / 2 - top - 7)) + 'px');
      return;
    }
    const top = side === 'below' ? rect.bottom + m : rect.top - bh - m;
    const cx = rect.left + rect.width / 2;
    const left = Math.max(12, Math.min(innerWidth - bw - 12, cx - bw / 2));
    el.style.top = Math.max(8, Math.min(innerHeight - bh - 8, top)) + 'px';
    el.style.left = left + 'px';
    el.style.setProperty('--ax', Math.max(14, Math.min(bw - 28, cx - left - 7)) + 'px');
  }
  function tutTarget() {
    const s = TUT[tut.i];
    if (s.col != null) {
      if (tut.i >= 3 && sel !== 'H2O') return { el: $('.cand[data-id="H2O"]') };
      return { rect: colRect(s.col), col: s.col, prefer: 'above' };
    }
    return { el: s.target ? s.target() : null };
  }
  function tutRender() {
    $$('.pulse').forEach((e) => e.classList.remove('pulse'));
    let b = $('#tut');
    if (!tut) { if (b) b.remove(); return; }
    if (!b) { b = h('div', 'tut'); b.id = 'tut'; document.body.appendChild(b); }
    const s = TUT[tut.i];
    b.innerHTML = `<div>${s.text()}</div><div class="row"><span class="step">${tut.i + 1} / ${TUT.length}</span><span>${s.btn ? `<button type="button" id="tutNext">${s.btn}</button>` : ''}<button type="button" class="skip" id="tutSkip">跳過教學</button></span></div>`;
    const tg = tutTarget();
    pulseX = tg.col != null ? tg.col : null;
    hoverCol(null);
    if (tg.el) { tg.el.classList.add('pulse'); tg.el.scrollIntoView({ block: 'nearest' }); }
    tutPosition();
    if (s.btn) $('#tutNext').onclick = () => { tut.i++; if (tut.i >= TUT.length) tutEnd(); else tutRender(); };
    $('#tutSkip').onclick = tutEnd;
  }
  function tutPosition() {
    const b = $('#tut');
    if (!b || !tut) return;
    const tg = tutTarget();
    const rect = tg.rect || (tg.el ? tg.el.getBoundingClientRect() : { left: innerWidth / 2 - 10, width: 20, top: 80, bottom: 80 });
    placeBubble(b, rect, tg.prefer);
  }
  function tutAllows(a) {
    if (!tut) return true;
    const s = TUT[tut.i];
    if (a.type === 'select') return (tut.i >= 1 && tut.i <= 4 && a.id === 'H2O') || a.id == null;
    if (a.type === 'place') return s.col != null && a.x === s.col && a.cid === 'H2O';
    return false;
  }

  // ------------------------------------------------------------ 新元素提示
  const TIPS = {
    C: ['碳氫化合物都能燒：讓 {CH4} 貼著 {O2}，按「火花」就會燃燒成 {CO2} 和 {H2O}。', '冷卻到 −80 °C，{CO2} 會變成乾冰（固體）掉到杯底。'],
    N: ['{N2} 和 {H2} 在 350 °C 加上鐵觸媒會合成 {NH3}（哈伯法）。', '{NO} 一碰到 {O2} 就變成紅棕色的 {NO2}。'],
    F: ['{F2} 非常活潑：遇到 {H2} 立刻化合成 {HF}，連 {H2O} 都能氧化。'],
    Na: ['鈉遇水會產生 {NaOH} 和 {H2}：把 {Na} 放在 {H2O} 旁邊試試。', '{NaHCO3}（小蘇打）在 80 °C 就會分解出 {CO2}。'],
    Mg: ['鎂點火會燃燒成 {MgO}，在 {CO2} 裡也能燒。'],
    S: ['{SO3} 遇水變成硫酸 {H2SO4}。', '{H2S} 和 {SO2} 加熱到 110 °C 會生成硫（克勞斯法）。'],
    Cl: ['{HCl} 和 {NH3} 都是氣體，在杯頂相遇會生成白煙 {NH4Cl}。', '{Cl2} 是氣體；冷到 −80 °C 會液化掉到杯底。'],
    K: ['{K} 遇水會燃起淡紫色火焰，生成 {KOH}。', '{KMnO4} 是紫色的；遇到 {HCl} 會放出氯氣。'],
    Ca: ['生石灰 {CaO} 遇水變成 {Ca(OH)2}；{Ca(OH)2} 遇到 {CO2} 生成 {CaCO3}（石灰水變混濁）。'],
    Cu: ['{CuSO4} 遇到 {NaOH} 生成藍色的 {Cu(OH)2}。', '鐵、鋅會把銅從 {CuSO4} 裡置換出來。'],
    Ag: ['{AgNO3} 遇到含氯、溴、碘離子的鹽，生成白、淡黃、黃色的沉澱。', '鹵化銀照紫外光會分解出銀。'],
    Br: ['{Br2} 是紅棕色液體，80 °C 就會沸騰。', '{Br2} 遇到 {C2H4} 會褪色（檢驗雙鍵）。'],
    I: ['{I2} 是紫黑色固體，200 °C 會昇華成紫色蒸氣。'],
    Ba: ['{BaCl2} 遇到硫酸根，生成白色的 {BaSO4} 沉澱。'],
    Li: ['{Li} 在室溫就能和 {N2} 反應生成 {Li3N}。'],
    Al: ['{Al} 和 {Fe2O3} 點火就是鋁熱反應。'],
    Fe: ['{Fe2O3} 和焦炭 {C} 在 900 °C 還原成鐵。'],
    P: ['{P4}（白磷）34 °C 就會自燃。'],
  };
  const tipOk = (t) => [...t.matchAll(/\{([^}]+)\}/g)].every((m) => L.C[m[1]] && L.C[m[1]].els.every((e) => st.unlocked.includes(e)));
  function elBlocks(els) {
    return els.map((e) => {
      const tips = (TIPS[e] || []).filter(tipOk);
      return `<div class="intro-el"><span class="atom" style="${atomStyle(e)}">${e}</span><div><h3>${L.ELEMENTS[e].zh}（原子序 ${L.ELEMENTS[e].z}）</h3>${tips.length ? `<ul>${tips.map((t) => `<li>${rich(t)}</li>`).join('')}</ul>` : ''}</div></div>`;
    }).join('');
  }

  // ------------------------------------------------------------ 浮層
  function toast(kind, html) {
    const t = h('div', 'toast', `<span class="k">${kind}</span><span class="v">${html}</span>`);
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3300);
  }
  function showOverlay(html, cls) { $('#sheet').innerHTML = html; $('#sheet').className = 'sheet' + (cls ? ' ' + cls : ''); $('#overlay').hidden = false; $('#sheet').scrollTop = 0; }
  function hideOverlay() { $('#overlay').hidden = true; }
  const overlayClosable = () => st && st.phase === 'play' && !$('#sheet').classList.contains('home');

  function discover(res) {
    let n = 0;
    for (const id of res.found || []) {
      if (!meta.found.includes(id)) { meta.found.push(id); if (n++ < 2) toast('新發現', `${L.fHTML(id)}<small>${L.C[id].zh}</small>`); }
    }
    for (const k of res.foundRx || []) {
      if (!meta.rx.includes(k)) {
        meta.rx.push(k);
        if (n++ < 3) toast('新反應', rxKeyHTML(k));
      }
    }
  }
  function rxKeyHTML(k) {
    const [p, id] = k.split(':');
    if (p === 'dec') return L.decEquation(id, true);
    if (p === 'pho') return L.phoEquation(id, true);
    if (p === 'el') return L.elecEquation(id, true);
    if (p === 'flame') return `${L.ELEMENTS[id].zh}的焰色：<span style="color:${L.FLAME[id][0]}">${L.FLAME[id][1]}色</span>`;
    const rx = L.RXKEY.get(k);
    return rx ? L.rxEquation(rx, true) : k;
  }

  // ----- 主選單
  function openHome() {
    aim = null; sel = null;
    const ts = totalStars(), max = LV.ALL.length * 3;
    const cur = meta.slots.story && meta.slots.story.phase === 'play' ? defOf(meta.slots.story) : null;
    const end = meta.slots.endless;
    showOverlay(`<div class="homehead"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6.2L4.6 18.6A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.4-2.4L14 9.2V3"/><path d="M7.2 15h9.6"/></svg><h2>夜間實驗室</h2></div>
      <p class="sub">用真實的熔點、沸點和化學反應解謎。</p>
      <div class="modes">
        <button class="mode" type="button" id="mStory"><span class="tag">故事模式</span><span class="tt">六章、${LV.ALL.length} 關</span><span class="dd">★ ${ts}/${max}${cur ? ` · 進行中：${cur.id} ${cur.title}` : ''}</span></button>
        <button class="mode" type="button" id="mSand"><span class="tag">沙盒</span><span class="tt">自由實驗</span><span class="dd">全部 ${Object.keys(L.C).length} 種物質、全部儀器，沒有回合限制。</span></button>
        <button class="mode" type="button" id="mEnd"><span class="tag">無限挑戰</span><span class="tt">補給與升級</span><span class="dd">v1 的玩法：一關一關湊分數。最佳紀錄第 ${meta.best.level || 1} 關${end && end.phase === 'play' ? ` · 進行中第 ${end.level} 關` : ''}。</span></button>
      </div>
      <div class="acts" style="justify-content:flex-start"><button class="btn" type="button" id="hBook">圖鑑 ${meta.found.length}/${Object.keys(L.C).length}</button><button class="btn" type="button" id="hHelp">規則</button><label class="switch"><input type="checkbox" id="hHint" ${meta.hint === false ? '' : 'checked'}> 顯示「下一步提示」</label></div>`, 'home');
    $('#mStory').onclick = () => openMap();
    $('#mSand').onclick = () => enter(meta.slots.sandbox || L.newSandbox());
    $('#mEnd').onclick = () => { const s = meta.slots.endless; enter(s && s.phase !== 'fail' ? s : L.newRun(newSeed())); if (st.phase === 'clear') openShop(); };
    $('#hBook').onclick = () => openBook('mol', openHome);
    $('#hHelp').onclick = () => openHelp(false, openHome);
    $('#hHint').onchange = (e) => { meta.hint = e.target.checked; save(); };
  }
  // ----- 選關
  function openMap(chId) {
    const open = LV.CHAPTERS.filter(chapterOpen);
    const ch = LV.CHAPTERS.find((c) => c.id === chId) || open[open.length - 1];
    const tabs = LV.CHAPTERS.map((c) => {
      const ok = chapterOpen(c);
      return `<button type="button" data-ch="${c.id}" class="${c === ch ? 'on' : ''}" ${ok ? '' : 'disabled'}>${ok ? '' : '🔒 '}${c.id}. ${c.title}</button>`;
    }).join('');
    const cards = ch.levels.map((l) => {
      const def = LV.byId(l.id);
      const ok = levelOpen(def), s = starsOf(l.id);
      const stars = [1, 2, 3].map((k) => `<i class="${s >= k ? 'on' : ''}">★</i>`).join('');
      return `<button type="button" class="lvcard${ok ? '' : ' locked'}${s ? ' done' : ''}" data-lv="${l.id}" ${ok ? '' : 'disabled'}><span class="id">${l.id}</span>${l.kind ? `<span class="kd ${l.kind}">${KIND[l.kind]}</span>` : ''}<span class="tt">${l.title}</span><span class="st">${stars}</span></button>`;
    }).join('');
    const nextCh = LV.CHAPTERS[LV.CHAPTERS.indexOf(ch) + 1];
    const need = nextCh && !chapterOpen(nextCh) ? `<p class="note">第 ${nextCh.id} 章：打完第 ${ch.id} 章關主，且本章拿到 ${nextCh.need} 顆星（目前 ${chStars(ch)} 顆）就會開啟。</p>` : '';
    showOverlay(`<h2>故事模式</h2><div class="tabs chtabs">${tabs}</div>
      <p class="sub chnote">${ch.note}</p>
      <div class="lvgrid">${cards}</div>${need}
      <div class="acts"><button class="btn" type="button" id="mapBack">主選單</button></div>`, 'home');
    $$('.chtabs button').forEach((b) => { b.onclick = () => openMap(+b.dataset.ch); });
    $$('.lvcard').forEach((b) => { b.onclick = () => openLevelIntro(LV.byId(b.dataset.lv)); });
    $('#mapBack').onclick = openHome;
  }
  function starRuleText(r) {
    switch (r.t) {
      case 'turns': return `過關時剩 ${r.n} 回合以上`;
      case 'score': return `分數達到 ${r.n}`;
      case 'chain': return `連鎖達到 ${r.n} 段`;
      case 'moves': return `${r.n} 步內完成`;
      case 'unused': return `不用「${TOOLNAME(r.k)}」`;
    }
    return '';
  }
  function goalPlain(g) {
    switch (g.t) {
      case 'score': return `分數達到 <b>${g.n}</b>`;
      case 'make': return `用反應做出 ${g.n} 份 ${FM(g.c)}（${L.C[g.c].zh}）`;
      case 'collect': return `收集 ${g.n} 份 ${FM(g.c)}（${L.C[g.c].zh}）`;
      case 'clear': return g.c ? `燒杯裡不剩 ${FM(g.c)}` : '清空燒杯';
      case 'flames': return `看到 ${g.n} 種不同的焰色`;
    }
    return '';
  }
  function openLevelIntro(def) {
    const ch = LV.CHAPTERS.find((c) => c.id === def.ch);
    const first = ch.levels[0].id === def.id;
    const tools = Object.entries(def.tools || {}).filter(([k, n]) => n > 0 && k !== 'undo' && k !== 'redraw').map(([k, n]) => `<span class="tchip">${svg(k === 'temp' ? 'flame' : k)}${TOOLNAME(k)} ×${n}</span>`).join('');
    const temps = (def.temps || [3]).map((i) => `${L.TEMPS[i].t}°`).join('、');
    const s = starsOf(def.id);
    const prevEls = LV.CHAPTERS.filter((c) => c.id < ch.id).flatMap((c) => c.els);
    const newEls = first ? ch.els.filter((e) => !prevEls.includes(e)) : [];
    const tmp = st; st = { unlocked: Object.keys(def.bag || {}).concat(def.hand ? def.hand.flatMap((x) => L.C[x].els) : []) };
    const blocks = newEls.length ? elBlocks(newEls.filter((e) => st.unlocked.includes(e))) : '';
    st = tmp;
    showOverlay(`${first ? `<p class="chlabel">第 ${ch.id} 章　${ch.title}</p><p class="sub chnote">${ch.note}</p>` : ''}
      <h2>${def.id}　${def.title}${def.kind ? ` <span class="kd ${def.kind}">${KIND[def.kind]}</span>` : ''}</h2>
      <p class="brief">${def.brief}</p>
      <div class="goals"><h3>過關條件</h3><ul>${def.goals.map((g) => `<li>${goalPlain(g)}</li>`).join('')}</ul>
      <h3>星星</h3><ul class="stars"><li>★ 過關</li>${(def.stars || []).map((r) => `<li>★ ${starRuleText(r)}</li>`).join('')}</ul></div>
      <div class="facts">${def.hand ? `<span>手牌 <b>${def.hand.length}</b> 個分子</span>` : `<span>回合 <b>${def.turns}</b></span><span>反應台 <b>${def.tray || L.TRAY_START}</b> 格</span>`}<span>溫度 <b>${temps}</b></span>${def.cats ? `<span>觸媒 <b>${def.cats.map(L.fText).join('、')}</b></span>` : ''}</div>
      ${tools ? `<div class="tchips">${tools}</div>` : ''}${blocks}
      <div class="acts"><button class="btn" type="button" id="liBack">選關</button><button class="btn primary" type="button" id="liGo">${s ? '再玩一次' : '開始'}</button></div>`);
    $('#liBack').onclick = () => openMap(def.ch);
    $('#liGo').onclick = () => { startLevel(def); };
  }
  function startLevel(def) {
    const s = L.newLevel(def, newSeed());
    enter(s);
    if (def.tut && !meta.tut) tutStart();
    else firstTips();
  }
  function enter(s) {
    st = s;
    undo = []; shownScore = st.score; sel = null; aim = null; inspectId = null; pulseX = null;
    if (tut) { tut = null; const b = $('#tut'); if (b) b.remove(); }
    hideOverlay(); clearTiles(); buildScale(); renderAll(); layout(); save();
  }
  // ----- 過關、失敗
  function openClear() {
    const def = defOf(st);
    const prev = starsOf(def.id);
    const n = st.stars;
    meta.stars[def.id] = Math.max(prev, n);
    meta.scores[def.id] = Math.max(meta.scores[def.id] || 0, st.score);
    const nx = nextDef(def);
    const ch = LV.CHAPTERS.find((c) => c.id === def.ch);
    const last = ch.levels[ch.levels.length - 1].id === def.id;
    const nextCh = LV.CHAPTERS[LV.CHAPTERS.indexOf(ch) + 1];
    let extra = '';
    if (last && nextCh) extra = chapterOpen(nextCh) ? `<p class="note good">第 ${nextCh.id} 章「${nextCh.title}」開啟了！</p>` : `<p class="note">第 ${nextCh.id} 章需要本章 ${nextCh.need} 顆星（目前 ${chStars(ch)} 顆）。回頭重玩，多拿幾顆星吧。</p>`;
    if (last && !nextCh) extra = '<p class="note good">恭喜破關！夜間實驗室的燈還亮著——沙盒模式裡還有全部的物質和儀器等你。</p>';
    const canNext = nx && levelOpen(nx);
    const stars = [1, 2, 3].map((k) => `<i class="${n >= k ? 'on' : ''}" style="animation-delay:${k * 160}ms">★</i>`).join('');
    const rules = [{ t: 'clear' }, ...(st.starRules || [])].map((r, i) => `<li class="${i === 0 || L.starOk(st, r) ? 'ok' : ''}">${i === 0 ? '過關' : starRuleText(r)}</li>`).join('');
    showOverlay(`<h2>${def.id} 完成</h2><div class="bigstars">${stars}</div>
      <ul class="srules">${rules}</ul>
      <div class="facts"><span>分數 <b>${st.score}</b></span>${st.hand ? `<span>步數 <b>${st.moves}</b></span>` : `<span>剩 <b>${st.turnsLeft}</b> 回合</span>`}<span>最長連鎖 <b>${st.best.chain}</b> 段</span>${prev ? `<span>之前最佳 <b>${'★'.repeat(prev)}</b></span>` : ''}</div>${extra}
      <div class="acts"><button class="btn" type="button" id="clMap">選關</button><button class="btn" type="button" id="clRe">重玩</button>${canNext ? '<button class="btn primary" type="button" id="clNext">下一關</button>' : ''}</div>`);
    save();
    $('#clMap').onclick = () => openMap(def.ch);
    $('#clRe').onclick = () => openLevelIntro(def);
    if (canNext) $('#clNext').onclick = () => openLevelIntro(nx);
  }
  function openFail() {
    if (st.mode === 'endless') return openEndlessFail();
    const def = defOf(st);
    const why = st.endReason === 'full' ? '燒杯滿了，沒有地方再放分子。' : st.endReason === 'hand' ? '手牌用完了。' : '回合用完了。';
    showOverlay(`<h2>實驗失敗</h2><p class="sub">${why}</p>
      <div class="goals"><ul>${st.goals.map((g) => `<li>${goalText(g)}</li>`).join('')}</ul></div>
      <div class="acts"><button class="btn" type="button" id="fMap">選關</button><button class="btn primary" type="button" id="fRetry">重試這一關</button></div>`);
    $('#fMap').onclick = () => openMap(def.ch);
    $('#fRetry').onclick = () => startLevel(def);
  }
  // ----- 無限挑戰
  function offerView(o) {
    const atom = (e) => `<span class="atom bigatom" style="${atomStyle(e)}">${e}</span>`;
    const E = o.e ? L.ELEMENTS[o.e] : null;
    switch (o.type) {
      case 'element': {
        const after = st.unlocked.concat(o.e);
        const n = Object.values(L.C).filter((c) => c.els.includes(o.e) && c.els.every((e) => after.includes(e))).length;
        return ['新元素', `${atom(o.e)}${E.zh}`, `原子序 ${E.z}。加入元素袋，馬上多出 ${n} 種含${E.zh}的物質可以合成。`];
      }
      case 'tray': return ['反應台', '反應台 +1 格', `一次拿 ${st.traySize + 1} 個原子，能合成更大的分子；分子越大越值錢。`];
      case 'max': return ['工具', `${TOOLNAME(o.k)} +1 次`, `之後每一關都能多用一次「${TOOLNAME(o.k)}」。`];
      case 'upgrade': { const now = L.upMult(st, o.e); return ['元素強化', `${atom(o.e)}${E.zh} 強化`, `所有含${E.zh}的分子價值 ×${now} → ×${now + 0.5}（多種元素強化會相乘）。`]; }
      case 'enrich': return ['元素袋', `${atom(o.e)}多一點${E.zh}`, `反應台更常出現${E.zh}（比重 +2）。`];
      case 'relic': return ['實驗器材', L.RELICS[o.r].zh, L.RELICS[o.r].desc + '。'];
    }
    return ['', '', ''];
  }
  function openShop() {
    const extra = st.picks > 1 ? `剩 ${st.turnsLeft} 回合就過關，可以選 <b>${st.picks}</b> 項。` : '選一項補給，然後進入下一關。';
    showOverlay(`<h2>第 ${st.level} 關完成</h2><p class="sub">得分 ${st.score}／目標 ${st.target}。${extra}</p>
      <div class="offers">${st.offers.map((o, i) => { const [tag, tt, dd] = offerView(o); return `<button class="offer" type="button" data-i="${i}"><span class="tag">${tag}</span><span class="tt">${tt}</span><span class="dd">${dd}</span></button>`; }).join('')}</div>`);
    $$('.offer').forEach((b) => {
      b.onclick = () => {
        const o = st.offers[+b.dataset.i];
        L.takeOffer(st, +b.dataset.i);
        if (o.type === 'element') toast('新元素', `${o.e}<small>${L.ELEMENTS[o.e].zh}（原子序 ${L.ELEMENTS[o.e].z}）</small>`);
        if (st.picks > 0 && st.offers.length) { openShop(); save(); return; }
        L.nextLevel(st);
        meta.best.level = Math.max(meta.best.level || 1, st.level);
        undo = []; shownScore = 0; sel = null; inspectId = null;
        hideOverlay(); clearTiles(); renderAll(); save();
        if (st.newEls && st.newEls.length) openEndlessIntro();
        else toast(`第 ${st.level} 關`, `目標 ${st.target} 分，${st.turnsLeft} 回合`);
      };
    });
  }
  function openEndlessIntro() {
    const els = st.newEls || [];
    st.newEls = [];
    showOverlay(`<h2>第 ${st.level} 關</h2><p class="sub">目標 <b>${st.target}</b> 分，${st.turnsLeft} 回合。</p>${elBlocks(els)}<div class="acts"><button class="btn primary" type="button" id="introGo">開始</button></div>`);
    $('#introGo').onclick = () => { hideOverlay(); save(); };
  }
  function openEndlessFail() {
    const why = st.endReason === 'full' ? '燒杯滿了，沒有地方再放分子。' : `回合用完了，還差 ${st.target - st.score} 分。`;
    showOverlay(`<h2>實驗失敗</h2><p class="sub">${why}</p>
      <div class="facts"><span>來到 <b>第 ${st.level} 關</b></span><span>最長連鎖 <b>${st.best.chain}</b> 段</span><span>單步最高 <b>${st.best.turn}</b> 分</span></div>
      <div class="acts"><button class="btn" type="button" id="failHome">主選單</button><button class="btn" type="button" id="failNew">重新開始一局</button><button class="btn primary" type="button" id="failRetry">重試這一關</button></div>`);
    $('#failRetry').onclick = () => enter(L.retryLevel(st, newSeed()));
    $('#failNew').onclick = () => enter(L.newRun(newSeed()));
    $('#failHome').onclick = openHome;
  }
  // ----- 選單、規則、圖鑑
  function openMenu() {
    const def = defOf(st);
    showOverlay(`<h2>選單</h2><p class="sub">${st.mode === 'story' ? `${def.id} ${def.title}` : st.mode === 'sandbox' ? '沙盒模式' : `無限挑戰 第 ${st.level} 關`} · 圖鑑 ${meta.found.length} 種物質、${meta.rx.length} 個反應。</p>
      <label class="switch"><input type="checkbox" id="mHint" ${meta.hint === false ? '' : 'checked'}> 顯示「下一步提示」列</label>
      <div class="acts" style="justify-content:flex-start">${st.mode === 'story' ? '<button class="btn" type="button" id="mRe">重來這一關</button><button class="btn" type="button" id="mMap">選關</button>' : ''}${st.mode === 'endless' ? '<button class="btn" type="button" id="mNew">重新開始一局</button>' : ''}<button class="btn" type="button" id="mTut">重看教學</button><button class="btn" type="button" id="mHome">主選單</button><button class="btn primary" type="button" id="mBack">繼續實驗</button></div>
      <div id="mConfirm"></div>`);
    $('#mBack').onclick = hideOverlay;
    $('#mHome').onclick = openHome;
    $('#mHint').onchange = (e) => { meta.hint = e.target.checked; save(); renderCoach(); };
    if ($('#mRe')) $('#mRe').onclick = () => startLevel(def);
    if ($('#mMap')) $('#mMap').onclick = () => openMap(def.ch);
    if ($('#mNew')) $('#mNew').onclick = () => {
      $('#mConfirm').innerHTML = '<p class="note">目前這局的進度會清掉（圖鑑會保留）。確定要重新開始嗎？</p><div class="acts" style="justify-content:flex-start"><button class="btn primary" type="button" id="mYes">確定重新開始</button></div>';
      $('#mYes').onclick = () => enter(L.newRun(newSeed()));
    };
    $('#mTut').onclick = () => { meta.tut = false; startLevel(LV.byId('1-1')); };
  }
  function swatch(ph, e) { return `<span class="sw" data-phase="${ph}" style="--c1:${EC(e)};--cg:${EC(e)}"></span>`; }
  function openHelp(first, back) {
    const tools = L.TOOL_KEYS.map((k) => `<li><b>${L.TOOLS[k].zh}</b>：${L.TOOLS[k].desc}</li>`).join('');
    showOverlay(`<div class="help"><h2>${first ? '歡迎來到夜間實驗室' : '怎麼玩'}</h2>
      <ol>
        <li><b>合成</b>：「可以合成」列出反應台上的原子能組成的分子。點一個，再點燒杯的某一欄放進去（也可以直接拖過去）。燒杯上方的數字是放在那一欄馬上會得到的分數。每放一個分子花一回合。</li>
        <li><b>物態</b>：依燒杯目前的溫度和真實熔點、沸點決定：<span class="demo">${swatch('s', 'Na')}固 ${swatch('l', 'O')}液 ${swatch('g', 'N')}氣</span>。氣體從杯頂往下堆，液體和固體從杯底往上堆——所以氣體和杯底的固體通常碰不到，要靠溫度讓它們液化、沸騰或昇華。</li>
        <li><b>收集</b>：3 個以上相同的分子上下左右相連，就會收集得分；一次連越多越高分。</li>
        <li><b>反應</b>：會反應的分子靠在一起就自動反應（酸鹼中和、沉澱、金屬置換…）。產物留在杯中，可能再引發下一個反應。每多一段連鎖，分數 ×2。</li>
        <li><b>溫控</b>：加熱或冷卻（不花回合，有次數限制）。有些物質加熱會分解（碳酸氫鈉 ≥80 °C），有些反應要夠熱才會發生；可燃物超過自燃溫度會自己燒起來。</li>
        <li><b>儀器</b>（不花回合，有次數限制）：<ul class="tl">${tools}</ul></li>
        <li><b>故事模式</b>：每關有過關條件和三顆星。「做出」只算反應、分解、電解產生的物質，直接放進去的不算。星星夠多才會開下一章。點燒杯裡的分子可以看它的資料和會發生的反應。</li>
      </ol>
      <p class="note">熔點、沸點、自燃溫度、分解溫度、密度都是真實數據；反應方程式由程式自動配平。為了遊戲：一格代表一份物質；需要觸媒或高壓的工業反應以溫度和觸媒代替；酯化等需要催化劑、長時間加熱的反應簡化成相鄰就反應；電解時陽極氣體直接收集；部分分解產物有簡化（在圖鑑中註明）。</p>
      <div class="acts"><button class="btn primary" type="button" id="helpGo">${first ? '開始實驗' : '知道了'}</button></div></div>`);
    $('#helpGo').onclick = () => (back ? back() : hideOverlay());
  }
  function openBook(tab = 'mol', back) {
    const found = new Set(meta.found);
    const all = Object.values(L.C).slice().sort((a, b) => {
      const za = Math.max(...a.els.map((e) => L.ELEMENTS[e].z)), zb = Math.max(...b.els.map((e) => L.ELEMENTS[e].z));
      return za - zb || a.n - b.n;
    });
    const nRx = L.RX.length + Object.values(L.C).filter((c) => c.dec).length + Object.values(L.C).filter((c) => c.pho).length + Object.keys(L.ELEC).length + Object.keys(L.FLAME).length;
    let body;
    if (tab === 'mol') {
      body = `<div class="legend"><span><i style="background:#8aa0bf"></i>固</span><span><i style="background:#4fb3ff"></i>液</span><span><i style="background:#ffd27a"></i>氣</span><span><i style="background:#c79bff"></i>分解</span><span>（由左到右：${L.TEMPS.map((t) => t.t).join('、')} °C）</span></div><div class="book">` +
        all.map((c) => {
          const dots = c.els.slice().sort(byZ).map((e) => `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${EC(e)};margin-right:2px"></i>`).join('');
          if (!found.has(c.id)) return `<div class="bcard locked"><span class="fm">？？？</span><span class="nm">${dots} ${c.n} 個原子</span></div>`;
          const phases = L.TEMPS.map((T, i) => `<i class="${c.dec && T.t >= c.dec.t ? 'x' : L.phaseAt(c.id, i)}"></i>`).join('');
          return `<button type="button" class="bcard" data-id="${c.id}" style="--c1:${mainCol(c.id)}"><span class="fm">${L.fHTML(c.id)}</span><span class="nm">${c.zh}</span><span class="phases">${phases}</span></button>`;
        }).join('') + '</div>';
    } else {
      const items = meta.rx.map((k) => {
        const [p, id] = k.split(':');
        if (['dec', 'pho', 'el', 'flame'].includes(p) && id) {
          const lab = p === 'dec' ? `<span class="cond heat">≥${L.C[id].dec.t} °C 熱分解</span>` : p === 'pho' ? '<span class="cond uv">紫外燈</span>' : p === 'el' ? `<span class="cond auto">電解</span>${L.ELEC[id].note ? `<span>${L.ELEC[id].note}</span>` : ''}` : '<span class="cond burn">焰色反應</span>';
          return `<li><span class="eq">${rxKeyHTML(k)}</span><span class="meta">${lab}</span></li>`;
        }
        const rx = L.RXKEY.get(k);
        if (!rx) return '';
        return `<li><span class="eq">${L.rxEquation(rx, true)}</span><span class="meta"><span>${rx.kind}</span>${condHTML(rx)}${rx.note ? `<span>${rx.note}</span>` : ''}</span></li>`;
      });
      body = items.length ? `<ul class="rxbook">${items.join('')}</ul>` : '<p class="hint">還沒發現任何反應。</p>';
    }
    showOverlay(`<h2>圖鑑</h2><div class="tabs"><button type="button" data-tab="mol" class="${tab === 'mol' ? 'on' : ''}">物質 ${found.size}/${Object.keys(L.C).length}</button><button type="button" data-tab="rx" class="${tab === 'rx' ? 'on' : ''}">反應 ${meta.rx.length}/${nRx}</button></div>${body}
      <div class="acts"><button class="btn primary" type="button" id="bookClose">${back ? '返回' : '關閉'}</button></div>`, back ? 'home' : '');
    $$('.tabs button').forEach((b) => { b.onclick = () => openBook(b.dataset.tab, back); });
    $$('.bcard[data-id]').forEach((b) => { b.onclick = () => openBookEntry(b.dataset.id, back); });
    $('#bookClose').onclick = () => (back ? back() : hideOverlay());
  }
  function openBookEntry(id, back) {
    const c = L.C[id];
    const tmp = st; if (!st) st = L.newSandbox();
    const list = knowList(id, null);
    const facts = compoundFacts(id);
    st = tmp;
    showOverlay(`<h2><span class="fm">${L.fHTML(id)}</span>　${c.zh}</h2><div class="facts">${facts}</div>
      <ul class="rxlist">${list.slice(0, 30).join('')}</ul>${list.length > 30 ? `<p class="hint">還有 ${list.length - 30} 個反應…</p>` : ''}
      <div class="acts"><button class="btn primary" type="button" id="beBack">返回圖鑑</button></div>`, back ? 'home' : '');
    $('#beBack').onclick = () => openBook('mol', back);
  }

  // ------------------------------------------------------------ 第一次用到某功能時的小提示
  function bubble(id, target, html) {
    meta.seen = meta.seen || {};
    if (meta.seen[id] || tut || !target || !$('#overlay').hidden) return;
    meta.seen[id] = true;
    save();
    const old = $('#tip');
    if (old) old.remove();
    const b = h('div', 'tut', `<div>${html}</div><div class="row"><span></span><span><button type="button" id="tipOk">知道了</button></span></div>`);
    b.id = 'tip';
    document.body.appendChild(b);
    target.scrollIntoView({ block: 'nearest' });
    target.classList.add('pulse');
    placeBubble(b, target.getBoundingClientRect(), 'below');
    $('#tipOk').onclick = () => { b.remove(); target.classList.remove('pulse'); };
  }
  function firstTips() {
    if (!st || st.phase !== 'play' || tut || st.mode === 'sandbox') return;
    if (st.temps.length > 1 && st.charges.temp > 0) bubble('temp', $('#scale'), `加熱或冷卻會改變物態：例如加熱到 110 °C，水會變成水蒸氣往上飄。溫控<b>不花回合</b>，這關可以用 ${st.charges.temp} 次。`);
    for (const k of L.TOOL_KEYS) if (st.max[k] > 0) bubble('tool-' + k, $(`.tool[data-k="${k}"]`), `<b>${L.TOOLS[k].zh}</b>：${L.TOOLS[k].desc}${L.TOOLS[k].aim === 'col' ? ' 按下按鈕後，點燒杯的一欄使用。' : ''}（不花回合）`);
    if (st.hand) bubble('hand', $('.trayp'), '謎題關：沒有反應台，只能用手上這幾個分子。走錯了可以按「復原」。');
  }

  // ------------------------------------------------------------ 動作
  async function animate(res, a) {
    busy = true;
    document.body.classList.add('busy');
    if (res.afterPlace) { renderGrid(res.afterPlace, { drop: res.placed.id }); await wait(DUR.move + 60); }
    if (a.type === 'temp') { renderThermo(); refreshPhases(); await wait(DUR.flash); }
    if (a.type === 'tool' && a.k === 'cat') renderThermo();
    for (const s of res.steps) {
      if (s.kind === 'settle') { renderGrid(s.grid); await wait(DUR.move); continue; }
      fxBurst(s.fx);
      await wait(DUR.flash);
      renderGrid(s.grid);
      shownScore += s.gain;
      renderHeader();
      popScore(s);
      if (s.mult >= 2) banner(`連鎖 ×${s.mult}`);
      await wait(DUR.pop + DUR.gap);
    }
    shownScore = st.score;
    busy = false;
    document.body.classList.remove('busy');
  }
  async function doAction(a) {
    if (busy || !st || st.phase !== 'play') return;
    if (!tutAllows(a)) { tutShake(); return; }
    pulseX = null;
    const tipEl = $('#tip');
    if (tipEl) tipEl.remove();
    $$('.pulse').forEach((e) => e.classList.remove('pulse'));
    const before = JSON.stringify(st);
    const res = L.act(st, a);
    if (!res) return;
    undo.push(before);
    if (undo.length > 40) undo.shift();
    if (st.mode !== 'sandbox') sel = null;
    aim = null;
    inspectId = null;
    renderPreview();
    hoverCol(null);
    renderInspect();
    renderTools();
    $$('.cand').forEach((b) => b.classList.toggle('on', b.dataset.id === sel));
    save();
    await animate(res, a);
    discover(res);
    meta.best.chain = Math.max(meta.best.chain || 0, res.depth);
    if (tut && a.type === 'place') { tut.i++; tutTray(); }
    save();
    renderAll();
    if (tut) tutRender();
    if (st.phase === 'clear') {
      if (tut) tutEnd();
      banner('過關！');
      setTimeout(st.mode === 'story' ? openClear : openShop, 800);
    } else if (st.phase === 'fail') setTimeout(openFail, 500);
    else firstTips();
  }
  function doUndo() {
    if (busy || tut || !undo.length || st.phase !== 'play') return;
    if (st.mode !== 'sandbox' && st.charges.undo <= 0) return;
    const left = st.charges.undo - 1;
    st = JSON.parse(undo.pop());
    if (st.mode !== 'sandbox') st.charges.undo = left;
    sel = null; aim = null; inspectId = null; shownScore = st.score;
    clearTiles(); renderAll(); save();
  }
  function selectCand(id) {
    if (!tutAllows({ type: 'select', id })) { tutShake(); return; }
    if (id !== sel) pulseX = null;
    sel = id;
    aim = null;
    $$('.cand').forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    inspectId = null;
    renderInspect(); renderTray(); renderPreview(); hoverCol(null); markTiles(); renderCoach(); renderTools();
    if (tut) { if (tut.i === 1 && id === 'H2O') tut.i = 2; tutRender(); }
  }
  function setAim(k) {
    aim = aim === k ? null : k;
    sel = null;
    $$('.cand').forEach((b) => b.classList.remove('on'));
    renderTray(); renderTools(); renderPreview(); hoverCol(null); markTiles(); renderCoach();
  }
  function useTool(k) {
    if (busy || !st || st.phase !== 'play') return;
    if (tut) { tutShake(); return; }
    if (k === 'undo') return doUndo();
    if (k === 'clear') { doAction({ type: 'clear' }); return; }
    if (k === 'redraw') return doAction({ type: 'redraw' });
    if (k === 'spark' || k === 'uv') return doAction({ type: k });
    const T = L.TOOLS[k];
    if (T.aim === 'col') return setAim(k);
    if (T.aim === 'cat') return openCatPicker();
    return doAction({ type: 'tool', k });
  }
  function openCatPicker() {
    const opts = (st.mode === 'sandbox' ? Object.keys(L.CATALYSTS) : st.catsAvail).filter((c) => !st.cats.includes(c));
    if (opts.length === 1 && st.mode !== 'sandbox') return doAction({ type: 'tool', k: 'cat', cat: opts[0] });
    showOverlay(`<h2>加入觸媒</h2><p class="sub">觸媒加進燒杯後，這一關都有效。</p><div class="offers">${opts.map((c) => `<button class="offer" type="button" data-c="${c}"><span class="tag">觸媒</span><span class="tt">${L.fHTML(c)}　${L.CATALYSTS[c].zh}</span><span class="dd">${L.CATALYSTS[c].desc}</span></button>`).join('')}</div><div class="acts"><button class="btn" type="button" id="catNo">取消</button></div>`);
    $$('.offer[data-c]').forEach((b) => { b.onclick = () => { hideOverlay(); doAction({ type: 'tool', k: 'cat', cat: b.dataset.c }); }; });
    $('#catNo').onclick = hideOverlay;
  }
  function colAt(cx, cy) {
    const r = $('#tiles').getBoundingClientRect();
    if (cy < r.top - 48 || cy > r.bottom + 24) return null;
    const x = Math.floor((cx - r.left) / cell);
    return x >= 0 && x < L.W ? x : null;
  }
  function clickCol(x) {
    if (x == null || busy || st.phase !== 'play') return false;
    if (aim) { if (L.simulateAction(st, { type: 'tool', k: aim, x })) doAction({ type: 'tool', k: aim, x }); return true; }
    if (sel) { if (L.canPlace(st, x)) doAction({ type: 'place', cid: sel, x }); return true; }
    return false;
  }

  function bindEvents() {
    let drag = null;
    const cands = $('#cands');
    cands.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.cand');
      if (!b || busy || e.button > 0) return;
      drag = { id: b.dataset.id, x0: e.clientX, y0: e.clientY, moved: false, el: null, pid: e.pointerId, btn: b };
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    });
    cands.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.pid) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10) {
        drag.moved = true;
        selectCand(drag.id);
        drag.el = h('div', 'drag', tileInner(drag.id));
        drag.el.dataset.phase = L.phaseAt(drag.id, st.T);
        drag.el.style.cssText = compStyle(drag.id);
        document.body.appendChild(drag.el);
      }
      if (drag.moved) {
        drag.el.style.transform = `translate(${e.clientX - cell / 2}px, ${e.clientY - cell / 2}px)`;
        hoverCol(colAt(e.clientX, e.clientY));
      }
    });
    const endDrag = (e, cancel) => {
      if (!drag || e.pointerId !== drag.pid) return;
      const d = drag;
      drag = null;
      if (d.el) d.el.remove();
      hoverCol(null);
      if (cancel) return;
      if (!d.moved) { selectCand(sel === d.id ? null : d.id); return; }
      const x = colAt(e.clientX, e.clientY);
      if (x != null && L.canPlace(st, x)) doAction({ type: 'place', cid: d.id, x });
    };
    cands.addEventListener('pointerup', (e) => endDrag(e, false));
    cands.addEventListener('pointercancel', (e) => endDrag(e, true));
    cands.addEventListener('keydown', (e) => {
      const b = e.target.closest('.cand');
      if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectCand(sel === b.dataset.id ? null : b.dataset.id); }
    });
    $('#pickEls').addEventListener('click', (e) => { const b = e.target.closest('.pe'); if (!b) return; pickEl = b.dataset.e || null; renderPick(); renderCands(); });
    $('#pickQ').addEventListener('input', (e) => { pickQ = e.target.value; renderCands(); });

    const beaker = $('#beaker');
    beaker.addEventListener('pointermove', (e) => { if ((sel || aim) && !busy && e.pointerType === 'mouse') hoverCol(colAt(e.clientX, e.clientY)); });
    beaker.addEventListener('pointerleave', () => { if (!drag) hoverCol(null); });
    beaker.addEventListener('click', (e) => {
      if (busy || !st || st.phase !== 'play') return;
      if (clickCol(colAt(e.clientX, e.clientY))) return;
      const t = e.target.closest('.tile');
      inspectId = t ? +t.dataset.id : null;
      renderInspect();
    });
    $('#badges').addEventListener('click', (e) => { const b = e.target.closest('.badge'); if (b) clickCol(+b.dataset.x); });
    $('#tools').addEventListener('click', (e) => { const b = e.target.closest('.tool'); if (b && !b.disabled) useTool(b.dataset.k); });
    $('#heat').onclick = () => doAction({ type: 'temp', dir: +1 });
    $('#cool').onclick = () => doAction({ type: 'temp', dir: -1 });
    $('#coachShow').onclick = showHint;
    window.addEventListener('scroll', () => tutPosition(), { passive: true });
    $('#btnHelp').onclick = () => openHelp(false);
    $('#btnBook').onclick = () => openBook('mol');
    $('#btnMenu').onclick = openMenu;
    $('#btnHome').onclick = openHome;
    $('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay' && overlayClosable()) hideOverlay(); });
    document.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') {
        if (!$('#overlay').hidden && overlayClosable()) hideOverlay();
        else if (aim) setAim(aim);
        else if (sel) selectCand(null);
        else if (inspectId != null) { inspectId = null; renderInspect(); }
      } else if ((sel || aim) && /^[1-7]$/.test(e.key) && $('#overlay').hidden) clickCol(+e.key - 1);
    });
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); tutPosition(); }, 120); });
  }

  // ------------------------------------------------------------ 開始
  let started = false;
  function start(data) {
    if (started) return;
    started = true;
    const saved = data && data.meta ? data : load();
    meta = (saved && saved.meta) || {};
    meta.found = meta.found || [];
    meta.rx = meta.rx || [];
    meta.best = meta.best || { level: 1, chain: 0 };
    meta.stars = meta.stars || {};
    meta.scores = meta.scores || {};
    meta.slots = meta.slots || {};
    for (const k of Object.keys(meta.slots)) if (!meta.slots[k] || meta.slots[k].v !== L.VERSION) delete meta.slots[k];
    // 存檔裡的關卡如果已經不存在，就丟掉
    if (meta.slots.story && !defOf(meta.slots.story)) delete meta.slots.story;
    const mode = saved && saved.mode;
    st = (mode && meta.slots[mode]) || meta.slots.story || L.newLevel(LV.byId('1-1'), newSeed());
    shownScore = st.score;
    buildScale();
    bindEvents();
    layout();
    renderAll();
    if (!saved) {
      // 第一次玩：直接進 1-1 教學
      startLevel(LV.byId('1-1'));
    } else if (st.phase === 'clear') { if (st.mode === 'story') openClear(); else openShop(); }
    else if (st.phase === 'fail') openFail();
    else openHome();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout());
  }
  window.claude?.hot?.snapshot?.(() => ({ meta, mode: st && st.mode }));
  if (window.claude?.hot?.ready) window.claude.hot.ready(start);
  else start(window.claude?.hot?.data ?? {});
})();
