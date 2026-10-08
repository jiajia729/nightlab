/* 夜間實驗室 — 畫面與操作 */
(() => {
  'use strict';
  const L = Lab;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const SAVE = 'nightlab.v1';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = RM ? { move: 60, flash: 80, pop: 60, gap: 40 } : { move: 260, flash: 300, pop: 220, gap: 150 };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const PHN = { s: '固態', l: '液態', g: '氣態' };
  const TCOL = ['#c6e8ff', '#94d2ff', '#78c4ff', '#9fe3c4', '#ffb547', '#ff8a3d', '#ff4d2e'];
  const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;

  let st = null, meta = null, sel = null, busy = false, undo = [], inspectId = null, shownScore = 0, cell = 60;
  let tut = null, lastHint = null, pulseX = null;
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
  const compStyle = (id) => { const c = L.C[id]; return `--c1:${EC(c.c1)};--c2:${EC(c.c2)};--ink:${inkFor(EC(c.c1))};--fs:${fsFor(id)}`; };
  const atomStyle = (e) => `--c:${EC(e)};--ink:${inkFor(EC(e))}`;
  function fsFor(id) {
    const w = id.replace(/\d/g, '').length + (id.match(/\d/g) || []).length * 0.6;
    return w <= 2.2 ? 0.34 : w <= 3.4 ? 0.3 : w <= 4.6 ? 0.25 : w <= 6 ? 0.21 : w <= 8 ? 0.175 : 0.15;
  }
  function tileInner(id) {
    const dots = L.C[id].els.slice().sort(byZ).map((e) => `<i style="background:${EC(e)}"></i>`).join('');
    return `<div class="body"><span class="f">${L.fHTML(id)}</span><span class="dots">${dots}</span></div>`;
  }
  const fmtT = (t) => (t === Infinity ? '—' : `${t} °C`);

  // ------------------------------------------------------------ 存檔
  function save() { try { localStorage.setItem(SAVE, JSON.stringify({ st, meta })); } catch (e) { /* 私密模式等 */ } }
  function load() { try { const r = localStorage.getItem(SAVE); return r ? JSON.parse(r) : null; } catch (e) { return null; } }

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
      c = Math.min(availW / 7, Math.max(40, (vh - padY - 620) / 9), 86);
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
      layer.appendChild(el);
      setTimeout(() => el.remove(), 750);
    }
  }
  function popScore(s) {
    if (!s.fx.length || !s.gain) return;
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
  function renderHeader() {
    $('#lvNum').textContent = st.level;
    $('#els').innerHTML = st.unlocked.slice().sort(byZ).map((e) => `<i style="${atomStyle(e)}" title="${L.ELEMENTS[e].zh}">${e}</i>`).join('');
    $('#score').textContent = shownScore;
    $('#target').textContent = st.target;
    $('#meter').style.width = Math.min(100, (shownScore / st.target) * 100) + '%';
    $('#turns').textContent = st.turnsLeft;
    $('#turnsBox').classList.toggle('low', st.turnsLeft <= 3);
  }
  function renderThermo() {
    const i = st.T;
    $$('#scale li').forEach((li) => li.classList.toggle('on', +li.dataset.i === i));
    $('#scale').style.setProperty('--tc', TCOL[i]);
    $('#merc').style.height = `calc(${((i + 0.5) / L.TEMPS.length) * 100}% - 6px)`;
    $('#tN').textContent = st.charges.temp;
    const play = st.phase === 'play';
    $('#heat').disabled = !play || st.charges.temp <= 0 || i >= L.TEMPS.length - 1;
    $('#cool').disabled = !play || st.charges.temp <= 0 || i <= 0;
    $('#vesselArea').dataset.temp = i;
    $('#srcLabel').textContent = `${L.TEMPS[i].name} ${L.TEMPS[i].t} °C`;
  }
  function renderTray() {
    const use = sel ? new Set(L.atomsFor(st, sel)) : null;
    const box = $('#tray');
    box.classList.toggle('dim', !!use);
    box.innerHTML = st.tray.map((e, i) => `<span class="atom${use && use.has(i) ? ' use' : ''}" style="${atomStyle(e)}" title="${L.ELEMENTS[e].zh}">${e}</span>`).join('');
    $('#trayHint').textContent = `${st.tray.length} 個原子`;
  }
  function renderCands() {
    const list = L.candidates(st);
    if (sel && !list.includes(sel)) sel = null;
    const box = $('#cands');
    if (!list.length) { box.innerHTML = '<div class="empty">合成不出東西了，試試重抽。</div>'; return; }
    box.innerHTML = list.map((id) => {
      const ph = L.phaseAt(id, st.T);
      return `<button class="cand${sel === id ? ' on' : ''}" type="button" data-id="${id}" style="${compStyle(id)}" aria-pressed="${sel === id}">` +
        `<span class="sw" data-phase="${ph}"></span><span class="cf">${L.fHTML(id)}</span><span class="cv">${L.value(st, id)}</span>` +
        `<span class="cn">${L.C[id].zh}</span><span class="cp">${PHN[ph]}</span></button>`;
    }).join('');
  }
  function renderTools() {
    const play = st.phase === 'play';
    $('#spark b').textContent = st.charges.spark;
    $('#spark').disabled = !play || st.charges.spark <= 0 || !L.sparkable(st);
    $('#redraw b').textContent = st.charges.redraw;
    $('#redraw').disabled = !play || st.charges.redraw <= 0;
    $('#undo b').textContent = st.charges.undo;
    $('#undo').disabled = !play || !undo.length || st.charges.undo <= 0;
  }
  function condLabel(rx) {
    if (rx.cond === 'auto') return ['相鄰即反應', 'auto'];
    if (rx.cond === 'spark') return ['火花／光照', 'spark'];
    if (rx.cond === 'burn') return [`火花，或 ≥${L.C[rx.a].ai} °C 自燃`, 'burn'];
    return [`≥${rx.cond} °C`, 'heat'];
  }
  function logItem(l) {
    const g = `<span class="g">+${l.gain}${l.mult > 1 ? `<i>×${l.mult}</i>` : ''}</span>`;
    const vent = l.vent && l.vent.length ? ` <small>（${l.vent.map(L.fHTML).join('、')} 逸出）</small>` : '';
    if (l.k === 'rx') { const rx = L.RX[l.i]; return `<li><span class="k">${rx.kind}</span><span class="eq">${L.rxEquation(rx, true)}${vent}</span>${g}</li>`; }
    if (l.k === 'dec') return `<li><span class="k">熱分解</span><span class="eq">${L.decEquation(l.c, true)}${vent}</span>${g}</li>`;
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
    f.push(`價值 <b>${L.value(st, id)}</b>`);
    return f.map((x) => `<span>${x}</span>`).join('');
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
    const rxs = L.reactionsOf(id, st.unlocked);
    let list = rxs.map((rx) => { const [lab, cls] = condLabel(rx); return `<li><span class="eq">${L.rxEquation(rx, true)}</span><span class="cond ${cls}">${lab}</span></li>`; });
    if (c.dec) list.unshift(`<li><span class="eq">${L.decEquation(id, true)}</span><span class="cond heat">≥${c.dec.t} °C 熱分解</span></li>`);
    box.innerHTML = `<button class="btn close" type="button" id="inspClose" aria-label="關閉">✕</button>
      <h3><span class="fm">${L.fHTML(id)}</span>${c.zh}</h3>
      <div class="facts"><span>現在是 <b>${PHN[ph]}</b></span>${compoundFacts(id)}</div>
      ${list.length ? `<ul class="rxlist">${list.slice(0, 14).join('')}</ul>` : '<div class="hint">以目前解鎖的元素，沒有會和它反應的物質。</div>'}
      ${c.simp ? '<p class="hint">這個分解產物為遊戲簡化。</p>' : ''}`;
    box.hidden = false;
    $('#inspClose').onclick = () => { inspectId = null; renderInspect(); };
  }
  function renderPreview() {
    const bad = $('#badges'), gh = $('#ghosts');
    bad.innerHTML = '';
    gh.innerHTML = '';
    const on = sel && st && st.phase === 'play';
    for (let x = 0; x < L.W; x++) {
      const b = h('div', 'badge');
      b.dataset.x = x;
      if (on) {
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
      }
      else { b.textContent = x + 1; b.classList.add('num'); }
      bad.appendChild(b);
    }
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
    renderHeader(); renderThermo(); renderTray(); renderCands(); renderTools(); renderLog();
    renderGrid(st.grid); renderPreview(); renderInspect(); markTiles(); renderCoach();
  }

  // ------------------------------------------------------------ 下一步提示
  const FM = (f) => `<b class="fm">${L.fHTML(f)}</b>`;
  const rich = (t) => t.replace(/\{([^}]+)\}/g, (_, f) => FM(f));
  function why(ev) {
    if (!ev) return '會得分';
    if (ev.k === 'cl') return `湊成 ${ev.n} 個 ${FM(ev.c)} 相連，收集`;
    if (ev.k === 'dec') return `${FM(ev.c)} 受熱分解`;
    const rx = L.RX[ev.i];
    return `${FM(rx.a)} 和 ${FM(rx.b)} 會${rx.cond === 'burn' ? '燃燒' : '反應'}（${rx.kind}）`;
  }
  function hintHTML(hn) {
    const pts = `<span class="pts">+${hn.total}</span>`;
    const chain = hn.depth >= 2 ? `，還會連鎖 ${hn.depth} 段` : '';
    switch (hn.kind) {
      case 'place': return `把 ${FM(hn.cid)} 放在第 <b>${hn.x + 1}</b> 欄：${why(hn.events[0])}${chain}，${pts}。`;
      case 'tool': {
        const a = hn.action;
        const what = a.type === 'spark' ? '按「火花」' : a.dir > 0 ? `加熱到 ${L.TEMPS[st.T + 1].t} °C` : `冷卻到 ${L.TEMPS[st.T - 1].t} °C`;
        return `${what}：${why(hn.events[0])}${chain}，${pts}（不花回合）。`;
      }
      case 'setup': return `把 ${FM(hn.cid)} 放在第 <b>${hn.x + 1}</b> 欄，和旁邊的 ${FM(hn.cid)} 湊成一對，之後再補一個就能收集。`;
      default: return `先放一個 ${FM(hn.cid)}（${L.C[hn.cid].zh}），之後在它旁邊再放兩個，3 個相連就會收集得分。`;
    }
  }
  function renderCoach() {
    const box = $('#coach');
    const off = !st || meta.hint === false || st.phase !== 'play';
    if (box.hidden !== off) { box.hidden = off; requestAnimationFrame(layout); }
    if (off) return;
    $('#coachNeed').textContent = `還差 ${Math.max(0, st.target - shownScore)} 分 · 剩 ${st.turnsLeft} 回合`;
    const show = $('#coachShow');
    if (tut) { $('#coachText').textContent = '跟著橘色的說明一步一步做。'; show.hidden = true; return; }
    if (sel) {
      $('#coachText').innerHTML = `${FM(sel)} 會落在虛線框的位置。<span class="k-match">白框</span>是同種分子（3 個相連就收集），<span class="k-partner">橘框</span>是會和它反應的分子；燒杯上方是馬上會得到的分數。`;
      show.hidden = true;
      return;
    }
    lastHint = L.hint(st);
    $('#coachText').innerHTML = lastHint ? hintHTML(lastHint) : '合成不出東西了，按「重抽」換一批原子。';
    show.hidden = !lastHint;
  }
  function flashPulse(el) { if (!el) return; el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 2600); }
  function showHint() {
    const hn = lastHint;
    if (!hn || busy) return;
    if (hn.kind === 'tool') { flashPulse($(hn.action.type === 'spark' ? '#spark' : hn.action.dir > 0 ? '#heat' : '#cool')); return; }
    selectCand(hn.cid);
    pulseX = hn.x;
    hoverCol(null);
    const chip = $(`.cand[data-id="${CSS.escape(hn.cid)}"]`);
    if (chip) chip.scrollIntoView({ block: 'nearest' });
    if (document.documentElement.dataset.layout === 'narrow') $('#beaker').scrollIntoView({ block: 'center', behavior: RM ? 'auto' : 'smooth' });
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
        else { const r = L.PAIR.get(sel + '|' + c.c); if (r && L.rxActive(st, r.rx, false)) el.classList.add('partner'); }
      }
    }
  }

  // ------------------------------------------------------------ 新手教學（第一關）
  const TUT = [
    { text: () => `這一關的目標：在 ${st.turnsLeft} 回合內，把分數湊到 <b>${st.target}</b> 分。`, target: () => $('.goal'), btn: '下一步' },
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
      // 目標太高（例如溫度計）：放在旁邊
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
    el.style.top = Math.max(8, top) + 'px';
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
  /** 教學中只允許照著做 */
  function tutAllows(a) {
    if (!tut) return true;
    const s = TUT[tut.i];
    if (a.type === 'select') return (tut.i >= 1 && tut.i <= 4 && a.id === 'H2O') || a.id == null;
    if (a.type === 'place') return s.col != null && a.x === s.col && a.cid === 'H2O';
    return false;
  }

  // ------------------------------------------------------------ 每關開場：新元素可以試什麼
  const TIPS = {
    C: ['碳氫化合物都能燒：讓 {CH4} 貼著 {O2}，按「火花」就會燃燒成 {CO2} 和 {H2O}。', '冷卻到 −80 °C，{CO2} 會變成乾冰（固體）掉到杯底。', '反應台變大以後可以做更大的分子，例如 {CH3OH}、{C2H5OH}，越大越值錢。'],
    N: ['{N2} 和 {H2} 加熱到 350 °C（本生燈）會合成 {NH3}（哈伯法）。', '{NO} 一碰到 {O2} 就變成紅棕色的 {NO2}；{NO2} 遇到 {H2O} 會變成硝酸 {HNO3}。'],
    F: ['{F2} 非常活潑：遇到 {H2} 立刻化合成 {HF}，連 {H2O} 都能氧化。', '{F2} 遇到 {CH4} 會變成 {CF4}。'],
    Na: ['鈉遇水會產生 {NaOH} 和 {H2}：把 {Na} 放在 {H2O} 旁邊試試。', '{NaOH} 是鹼，遇到酸（例如 {CH3COOH}、{HNO3}）就會中和。', '{NaHCO3}（小蘇打）加熱到 110 °C 會分解出 {CO2}。'],
    Mg: ['鎂點火會燃燒成 {MgO}，在 {CO2} 裡也能燒。', '鎂遇酸會產生 {H2}；加熱到 110 °C 時，連水蒸氣都能和鎂反應。'],
    S: ['{SO3} 遇水變成硫酸 {H2SO4}，硫酸遇鹼會中和。', '{H2S} 和 {SO2} 加熱到 110 °C 會生成硫（克勞斯法）。', '{CS2} 的自燃溫度只有 90 °C：放在 {O2} 旁邊再加熱，就會自己燒起來。'],
    Cl: ['{HCl} 遇到 {NaOH} 會中和成 {NaCl} 和 {H2O}；遇到 {NH3} 會生成白煙 {NH4Cl}。', '{H2} 和 {Cl2} 照光（火花）會化合成 {HCl}。', '{Cl2} 遇到 {NaOH} 會生成漂白水的成分 {NaClO}。'],
    Ca: ['生石灰 {CaO} 遇水變成 {Ca(OH)2}；{Ca(OH)2} 遇到 {CO2} 會生成 {CaCO3}（石灰水變混濁）。', '電石 {CaC2} 遇水會產生乙炔 {C2H2}。', '{CaCO3} 加熱到 900 °C 會分解成 {CaO} 和 {CO2}。'],
  };
  const tipOk = (t) => [...t.matchAll(/\{([^}]+)\}/g)].every((m) => L.C[m[1]] && L.C[m[1]].els.every((e) => st.unlocked.includes(e)));
  function openIntro() {
    const els = st.newEls || [];
    st.newEls = [];
    const blocks = els.map((e) => {
      const tips = (TIPS[e] || []).filter(tipOk);
      return `<div class="intro-el"><span class="atom" style="${atomStyle(e)}">${e}</span><div><h3>${L.ELEMENTS[e].zh}加入了（原子序 ${L.ELEMENTS[e].z}）</h3>${tips.length ? `<ul>${tips.map((t) => `<li>${rich(t)}</li>`).join('')}</ul>` : ''}</div></div>`;
    }).join('');
    showOverlay(`<h2>第 ${st.level} 關</h2><p class="sub">目標 <b>${st.target}</b> 分，${st.turnsLeft} 回合。上方的提示列會告訴你下一步可以怎麼做。</p>${blocks}<div class="acts"><button class="btn primary" type="button" id="introGo">開始</button></div>`);
    $('#introGo').onclick = () => { hideOverlay(); save(); firstTips(); };
  }

  // ------------------------------------------------------------ 第一次用到某功能時的小提示
  function bubble(id, target, html) {
    meta.seen = meta.seen || {};
    if (meta.seen[id] || tut || !target) return;
    meta.seen[id] = true;
    save();
    const old = $('#tip');
    if (old) old.remove();
    const b = h('div', 'tut', `<div>${html}</div><div class="row"><span></span><span><button type="button" id="tipOk">知道了</button></span></div>`);
    b.id = 'tip';
    document.body.appendChild(b);
    target.classList.add('pulse');
    placeBubble(b, target.getBoundingClientRect(), 'below');
    $('#tipOk').onclick = () => { b.remove(); target.classList.remove('pulse'); };
  }
  function firstTips() {
    if (!st || st.phase !== 'play' || tut) return;
    if (st.level >= 2) bubble('temp', $('#scale'), `加熱或冷卻會改變物態：例如加熱到 110 °C，水會變成水蒸氣往上飄。溫控<b>不花回合</b>，每關可以用 ${st.max.temp} 次。`);
    if (L.sparkable(st) && st.charges.spark > 0) bubble('spark', $('#spark'), '有可燃物貼著氧氣了！按「火花」點燃它們（不花回合）。');
  }

  // ------------------------------------------------------------ 浮層
  function toast(kind, html) {
    const t = h('div', 'toast', `<span class="k">${kind}</span><span class="v">${html}</span>`);
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3300);
  }
  function showOverlay(html) { $('#sheet').innerHTML = html; $('#overlay').hidden = false; $('#sheet').scrollTop = 0; }
  function hideOverlay() { $('#overlay').hidden = true; }
  const rxByKey = (k) => L.RX.find((r) => r.key === k);

  function discover(res) {
    let n = 0;
    for (const id of res.found || []) {
      if (!meta.found.includes(id)) { meta.found.push(id); if (n++ < 2) toast('新發現', `${L.fHTML(id)}<small>${L.C[id].zh}</small>`); }
    }
    for (const k of res.foundRx || []) {
      if (!meta.rx.includes(k)) {
        meta.rx.push(k);
        if (n++ < 3) toast('新反應', k.startsWith('dec:') ? L.decEquation(k.slice(4), true) : L.rxEquation(rxByKey(k), true));
      }
    }
  }

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
      case 'temp': return ['工具', '溫控 +1 次', '之後每一關都能多加熱或冷卻一次。'];
      case 'spark': return ['工具', '火花 +1 次', '之後每一關都能多點一次火。'];
      case 'redraw': return ['工具', '重抽 +1 次', '之後每一關都能多換一次原子。'];
      case 'undo': return ['工具', '復原 +1 次', '之後每一關都能多反悔一步。'];
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
        if (st.newEls && st.newEls.length) openIntro();
        else { toast(`第 ${st.level} 關`, `目標 ${st.target} 分，${st.turnsLeft} 回合`); firstTips(); }
      };
    });
  }
  function openFail() {
    const why = st.endReason === 'full' ? '燒杯滿了，沒有地方再放分子。' : `回合用完了，還差 ${st.target - st.score} 分。`;
    showOverlay(`<h2>實驗失敗</h2><p class="sub">${why}</p>
      <div class="facts"><span>來到 <b>第 ${st.level} 關</b></span><span>最長連鎖 <b>${st.best.chain}</b> 段</span><span>單步最高 <b>${st.best.turn}</b> 分</span><span>圖鑑 <b>${meta.found.length}</b> 種物質</span></div>
      <div class="acts"><button class="btn" type="button" id="failNew">重新開始一局</button><button class="btn primary" type="button" id="failRetry">重試這一關</button></div>`);
    $('#failRetry').onclick = () => { st = L.retryLevel(st, newSeed()); resetView(); };
    $('#failNew').onclick = () => { st = L.newRun(newSeed()); resetView(); };
  }
  function resetView() { undo = []; shownScore = st.score; sel = null; inspectId = null; hideOverlay(); clearTiles(); renderAll(); save(); }
  function openMenu() {
    showOverlay(`<h2>選單</h2><p class="sub">最佳紀錄：第 ${meta.best.level || 1} 關 · 圖鑑 ${meta.found.length} 種物質、${meta.rx.length} 個反應。</p>
      <label class="switch"><input type="checkbox" id="mHint" ${meta.hint === false ? '' : 'checked'}> 顯示「下一步提示」列</label>
      <div class="acts" style="justify-content:flex-start"><button class="btn" type="button" id="mTut">重看教學</button><button class="btn" type="button" id="mNew">重新開始一局</button><button class="btn primary" type="button" id="mBack">繼續實驗</button></div>
      <div id="mConfirm"></div>`);
    $('#mBack').onclick = hideOverlay;
    $('#mHint').onchange = (e) => { meta.hint = e.target.checked; save(); renderCoach(); };
    $('#mTut').onclick = () => {
      $('#mConfirm').innerHTML = '<p class="note">教學會從第 1 關重新開始一局（圖鑑會保留）。</p><div class="acts" style="justify-content:flex-start"><button class="btn primary" type="button" id="mTutYes">開始教學</button></div>';
      $('#mTutYes').onclick = () => { st = L.newRun(newSeed()); resetView(); tutStart(); };
    };
    $('#mNew').onclick = () => {
      $('#mConfirm').innerHTML = '<p class="note">目前這局的進度會清掉（圖鑑會保留）。確定要重新開始嗎？</p><div class="acts" style="justify-content:flex-start"><button class="btn primary" type="button" id="mYes">確定重新開始</button></div>';
      $('#mYes').onclick = () => { st = L.newRun(newSeed()); resetView(); };
    };
  }
  function swatch(ph, e) { return `<span class="sw" data-phase="${ph}" style="--c1:${EC(e)}"></span>`; }
  function openHelp(first) {
    showOverlay(`<div class="help"><h2>${first ? '歡迎來到夜間實驗室' : '怎麼玩'}</h2>
      <p class="sub">在回合用完之前，用化學反應湊到目標分數。</p>
      <ol>
        <li><b>合成</b>：右邊「可以合成」列出反應台上的原子能組成的分子。點一個，再點燒杯的某一欄放進去（也可以直接拖過去）。燒杯上方的數字是放在那一欄馬上會得到的分數。</li>
        <li><b>物態</b>：依燒杯目前的溫度和真實熔點、沸點決定：<span class="demo">${swatch('s', 'Na')}固 ${swatch('l', 'O')}液 ${swatch('g', 'N')}氣</span>。氣體從杯頂往下堆，液體和固體從杯底往上堆。</li>
        <li><b>收集</b>：3 個以上相同的分子上下左右相連，就會收集得分；一次連越多越高分。</li>
        <li><b>反應</b>：會反應的分子靠在一起就自動反應，例如酸鹼中和、鈉遇水、碳酸鹽遇酸。產物留在杯中，可能再引發下一個反應或收集。每多一段連鎖，分數 ×2。</li>
        <li><b>溫控</b>：加熱或冷卻讓物質熔化、沸騰、凝結而移動位置。有些物質加熱會分解（碳酸氫鈉 ≥80 °C），有些反應要夠熱才會發生（哈伯法 ≥350 °C）。</li>
        <li><b>火花</b>：點燃相鄰的可燃物和氧氣，或觸發光照反應（氫＋氯、甲烷氯化）。溫度高過自燃溫度時，不用火花也會燒起來。</li>
        <li><b>過關</b>：達到目標分數就過關，從補給挑新元素、強化或實驗器材。剩 5 回合以上就過關可以挑兩項。點燒杯裡的分子，可以看它的資料和會發生的反應。</li>
      </ol>
      <p class="note">熔點、沸點、自燃溫度、分解溫度都是真實數據，反應方程式由程式自動配平。為了遊戲：一格代表一份物質；需要觸媒或高壓的工業反應以溫度代替；硫酸銨的分解產物有簡化。</p>
      <div class="acts"><button class="btn primary" type="button" id="helpGo">${first ? '開始實驗' : '知道了'}</button></div></div>`);
    $('#helpGo').onclick = hideOverlay;
  }
  function openBook(tab = 'mol') {
    const found = new Set(meta.found);
    const all = Object.values(L.C).slice().sort((a, b) => {
      const za = Math.max(...a.els.map((e) => L.ELEMENTS[e].z)), zb = Math.max(...b.els.map((e) => L.ELEMENTS[e].z));
      return za - zb || a.n - b.n;
    });
    const nRx = L.RX.length + Object.values(L.C).filter((c) => c.dec).length;
    let body;
    if (tab === 'mol') {
      body = `<div class="legend"><span><i style="background:#8aa0bf"></i>固</span><span><i style="background:#4fb3ff"></i>液</span><span><i style="background:#ffd27a"></i>氣</span><span><i style="background:#c79bff"></i>分解</span><span>（由左到右：${L.TEMPS.map((t) => t.t).join('、')} °C）</span></div><div class="book">` +
        all.map((c) => {
          const dots = c.els.slice().sort(byZ).map((e) => `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${EC(e)};margin-right:2px"></i>`).join('');
          if (!found.has(c.id)) return `<div class="bcard locked"><span class="fm">？？？</span><span class="nm">${dots} ${c.n} 個原子</span></div>`;
          const phases = L.TEMPS.map((T, i) => `<i class="${c.dec && T.t >= c.dec.t ? 'x' : L.phaseAt(c.id, i)}"></i>`).join('');
          return `<div class="bcard"><span class="fm">${L.fHTML(c.id)}</span><span class="nm">${c.zh}</span><span class="phases">${phases}</span></div>`;
        }).join('') + '</div>';
    } else {
      const items = meta.rx.map((k) => {
        if (k.startsWith('dec:')) { const id = k.slice(4); return `<li><span class="eq">${L.decEquation(id, true)}</span><span class="meta"><span class="cond heat">≥${L.C[id].dec.t} °C 熱分解</span></span></li>`; }
        const rx = rxByKey(k);
        if (!rx) return '';
        const [lab, cls] = condLabel(rx);
        return `<li><span class="eq">${L.rxEquation(rx, true)}</span><span class="meta"><span>${rx.kind}</span><span class="cond ${cls}">${lab}</span>${rx.note ? `<span>${rx.note}</span>` : ''}</span></li>`;
      });
      body = items.length ? `<ul class="rxbook">${items.join('')}</ul>` : '<p class="hint">還沒發現任何反應。</p>';
    }
    showOverlay(`<h2>圖鑑</h2><div class="tabs"><button type="button" data-tab="mol" class="${tab === 'mol' ? 'on' : ''}">物質 ${found.size}/${Object.keys(L.C).length}</button><button type="button" data-tab="rx" class="${tab === 'rx' ? 'on' : ''}">反應 ${meta.rx.length}/${nRx}</button></div>${body}
      <div class="acts"><button class="btn primary" type="button" id="bookClose">關閉</button></div>`);
    $$('.tabs button').forEach((b) => { b.onclick = () => openBook(b.dataset.tab); });
    $('#bookClose').onclick = hideOverlay;
  }

  // ------------------------------------------------------------ 動作
  async function animate(res, a) {
    busy = true;
    document.body.classList.add('busy');
    if (res.afterPlace) { renderGrid(res.afterPlace, { drop: res.placed.id }); await wait(DUR.move + 60); }
    if (a.type === 'temp') { renderThermo(); refreshPhases(); await wait(DUR.flash); }
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
    sel = null;
    inspectId = null;
    renderPreview();
    hoverCol(null);
    renderInspect();
    $$('.cand').forEach((b) => b.classList.remove('on'));
    save();
    await animate(res, a);
    discover(res);
    meta.best.chain = Math.max(meta.best.chain || 0, res.depth);
    if (tut && a.type === 'place') { tut.i++; tutTray(); }
    save();
    renderAll();
    if (tut) tutRender();
    if (st.phase === 'clear') { if (tut) tutEnd(); banner('過關！'); setTimeout(openShop, 800); }
    else if (st.phase === 'fail') setTimeout(openFail, 500);
    else firstTips();
  }
  function doUndo() {
    if (busy || tut || !undo.length || st.charges.undo <= 0 || st.phase !== 'play') return;
    const left = st.charges.undo - 1;
    st = JSON.parse(undo.pop());
    st.charges.undo = left;
    sel = null; inspectId = null; shownScore = st.score;
    clearTiles(); renderAll(); save();
  }
  function selectCand(id) {
    if (!tutAllows({ type: 'select', id })) { tutShake(); return; }
    if (id !== sel) pulseX = null;
    sel = id;
    $$('.cand').forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    inspectId = null;
    renderInspect(); renderTray(); renderPreview(); hoverCol(null); markTiles(); renderCoach();
    if (tut) { if (tut.i === 1 && id === 'H2O') tut.i = 2; tutRender(); }
  }
  function colAt(cx, cy) {
    const r = $('#tiles').getBoundingClientRect();
    if (cy < r.top - 48 || cy > r.bottom + 24) return null;
    const x = Math.floor((cx - r.left) / cell);
    return x >= 0 && x < L.W ? x : null;
  }

  function bindEvents() {
    // 可合成清單：點選或拖曳
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

    // 燒杯：放入或查看
    const beaker = $('#beaker');
    beaker.addEventListener('pointermove', (e) => { if (sel && !busy && e.pointerType === 'mouse') hoverCol(colAt(e.clientX, e.clientY)); });
    beaker.addEventListener('pointerleave', () => { if (!drag) hoverCol(null); });
    beaker.addEventListener('click', (e) => {
      if (busy || st.phase !== 'play') return;
      const x = colAt(e.clientX, e.clientY);
      if (sel) { if (x != null && L.canPlace(st, x)) doAction({ type: 'place', cid: sel, x }); return; }
      const t = e.target.closest('.tile');
      inspectId = t ? +t.dataset.id : null;
      renderInspect();
    });
    $('#badges').addEventListener('click', (e) => {
      const b = e.target.closest('.badge');
      if (b && sel && !busy && L.canPlace(st, +b.dataset.x)) doAction({ type: 'place', cid: sel, x: +b.dataset.x });
    });

    $('#heat').onclick = () => doAction({ type: 'temp', dir: +1 });
    $('#cool').onclick = () => doAction({ type: 'temp', dir: -1 });
    $('#spark').onclick = () => doAction({ type: 'spark' });
    $('#redraw').onclick = () => doAction({ type: 'redraw' });
    $('#undo').onclick = doUndo;
    $('#coachShow').onclick = showHint;
    window.addEventListener('scroll', () => tutPosition(), { passive: true });
    $('#btnHelp').onclick = () => openHelp(false);
    $('#btnBook').onclick = () => openBook('mol');
    $('#btnMenu').onclick = openMenu;
    $('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay' && st.phase === 'play') hideOverlay(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#overlay').hidden && st.phase === 'play') hideOverlay();
        else if (sel) selectCand(null);
        else if (inspectId != null) { inspectId = null; renderInspect(); }
      } else if (sel && /^[1-7]$/.test(e.key) && $('#overlay').hidden) {
        const x = +e.key - 1;
        if (L.canPlace(st, x)) doAction({ type: 'place', cid: sel, x });
      }
    });
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); tutPosition(); }, 120); });
  }

  // ------------------------------------------------------------ 開始
  let started = false;
  function start(data) {
    if (started) return;
    started = true;
    const saved = data && data.st ? data : load();
    meta = (saved && saved.meta) || { found: [], rx: [], best: { level: 1, chain: 0 } };
    meta.best = meta.best || { level: 1, chain: 0 };
    st = saved && saved.st && saved.st.v === L.VERSION ? saved.st : L.newRun(newSeed());
    shownScore = st.score;
    buildScale();
    bindEvents();
    layout();
    renderAll();
    if (st.phase === 'clear') openShop();
    else if (st.phase === 'fail') openFail();
    else if (!meta.tut) {
      const fresh = st.level === 1 && st.score === 0 && st.turnsLeft === L.TURNS;
      if (!saved || fresh) { st = L.newRun(newSeed()); resetView(); tutStart(); }
      else {
        showOverlay(`<h2>新的教學</h2><p class="sub">加了一個 1 分鐘的互動教學，還有隨時告訴你下一步可以做什麼的提示列。要從第 1 關跟著教學玩一次嗎？</p>
          <div class="acts"><button class="btn" type="button" id="tNo">繼續目前這局</button><button class="btn primary" type="button" id="tYes">看教學（重新開始）</button></div>`);
        $('#tNo').onclick = () => { meta.tut = true; save(); hideOverlay(); };
        $('#tYes').onclick = () => { st = L.newRun(newSeed()); resetView(); tutStart(); };
      }
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout());
  }
  window.claude?.hot?.snapshot?.(() => ({ st, meta }));
  if (window.claude?.hot?.ready) window.claude.hot.ready(start);
  else start(window.claude?.hot?.data ?? {});
})();
