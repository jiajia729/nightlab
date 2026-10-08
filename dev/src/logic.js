/* 夜間實驗室 — 遊戲邏輯（純函式，不碰 DOM；Node 可直接 require 測試）
 *
 * 燒杯 7 欄 × 9 列。每格一個分子。
 *   - 依目前溫度與真實熔沸點決定物態：氣體從杯頂往下堆，液體／固體從杯底往上堆
 *   - 3 個以上相同分子相連 → 收集得分
 *   - 能反應的分子相鄰 → 自動反應（產物留在杯中，可能再引發連鎖）
 *   - 每多一段連鎖，分數 ×2
 *   - 溫控：改變物態、觸發熱分解與需要加熱的反應；火花：點燃可燃物、觸發光照反應
 */
const Lab = (() => {
  'use strict';

  const VERSION = 1;
  const W = 7, H = 9;
  const TRAY_START = 7, TRAY_MAX = 12, TURNS = 14;
  const BASE_MAX = { temp: 3, spark: 2, redraw: 3, undo: 3 };

  // ---------------------------------------------------------------- 元素（CPK 配色）
  const ELEMENTS = {
    H:  { z: 1,  zh: '氫', color: '#eef2f6', base: 1, w: 5 },
    C:  { z: 6,  zh: '碳', color: '#7d8796', base: 3, w: 3 },
    N:  { z: 7,  zh: '氮', color: '#4f6dff', base: 3, w: 2 },
    O:  { z: 8,  zh: '氧', color: '#ff4b3e', base: 2, w: 3 },
    F:  { z: 9,  zh: '氟', color: '#bdf07f', base: 4, w: 2 },
    Na: { z: 11, zh: '鈉', color: '#ab6df3', base: 3, w: 2 },
    Mg: { z: 12, zh: '鎂', color: '#93d43c', base: 4, w: 2 },
    S:  { z: 16, zh: '硫', color: '#f5d43e', base: 4, w: 2 },
    Cl: { z: 17, zh: '氯', color: '#33d466', base: 3, w: 2 },
    Ca: { z: 20, zh: '鈣', color: '#36a463', base: 4, w: 2 },
  };
  const START_ELEMENTS = ['H', 'O'];
  const UNLOCK_ORDER = ['C', 'N', 'F', 'Na', 'Mg', 'S', 'Cl', 'Ca']; // 依原子序
  const COLOR_PRIORITY = ['Na', 'Mg', 'Ca', 'Cl', 'F', 'S', 'N', 'C', 'O', 'H'];

  // ---------------------------------------------------------------- 實驗器材（被動加成）
  const RELICS = {
    buret: { zh: '滴定管', desc: '酸鹼類反應（中和、金屬與酸、碳酸鹽與酸）分數 ×2' },
    lighter: { zh: '點火槍', desc: '燃燒反應分數 ×2' },
    furnace: { zh: '坩堝', desc: '熱分解與需要加熱的反應分數 ×2' },
    condenser: { zh: '冷凝管', desc: '收集液體分數 ×2' },
    gasjar: { zh: '集氣瓶', desc: '收集氣體分數 ×2' },
    mortar: { zh: '研缽', desc: '收集固體分數 ×2' },
  };
  const ACID_KINDS = new Set(['酸鹼中和', '氧化物與酸', '金屬與酸', '碳酸鹽與酸']);
  const has = (st, r) => !!(st.relics && st.relics.includes(r));

  // ---------------------------------------------------------------- 溫度段
  const TEMPS = [
    { t: -196, name: '液態氮' },
    { t: -80, name: '乾冰浴' },
    { t: -40, name: '冷凍庫' },
    { t: 25, name: '室溫' },
    { t: 110, name: '加熱板' },
    { t: 350, name: '本生燈' },
    { t: 900, name: '高溫爐' },
  ];
  const ROOM = 3;

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
  const fText = (f) => f.replace(/([A-Za-z)])(\d+)/g, (_, a, d) => a + [...d].map((ch) => SUB[+ch]).join(''));
  const fHTML = (f) => f.replace(/([A-Za-z)])(\d+)/g, '$1<sub>$2</sub>');

  // ---------------------------------------------------------------- 物質資料
  // [化學式, 名稱, 熔點°C, 沸點°C, {ai 自燃溫度, dec:[分解溫度, 完整產物, 留在杯中的產物], simp 簡化}]
  // 熔點 = 沸點 → 昇華；Infinity → 在遊戲溫度範圍內不熔／不沸（多半是先分解）
  const I = Infinity;
  const ROWS = [
    // 氫、氧
    ['H2', '氫氣', -259.2, -252.9, { ai: 500 }],
    ['O2', '氧氣', -218.8, -183.0],
    ['O3', '臭氧', -192.2, -111.9, { dec: [100, ['O2'], ['O2', 'O2']] }],
    ['H2O', '水', 0, 100],
    ['H2O2', '過氧化氫', -0.4, 150.2, { dec: [100, ['H2O', 'O2'], ['H2O', 'O2']] }],
    // 碳
    ['C', '石墨', 3642, 3642, { ai: 700 }],
    ['CH4', '甲烷', -182.5, -161.5, { ai: 580 }],
    ['C2H6', '乙烷', -182.8, -88.5, { ai: 472, dec: [800, ['C2H4', 'H2'], ['C2H4', 'H2']] }],
    ['C2H4', '乙烯', -169.2, -103.7, { ai: 490 }],
    ['C2H2', '乙炔', -84, -84, { ai: 305 }],
    ['CO', '一氧化碳', -205.0, -191.5, { ai: 609 }],
    ['CO2', '二氧化碳', -78.5, -78.5],
    ['CH3OH', '甲醇', -97.6, 64.7, { ai: 464 }],
    ['HCHO', '甲醛', -92, -19, { ai: 424 }],
    ['CH3CHO', '乙醛', -123.4, 20.2, { ai: 175 }],
    ['CH3COOH', '乙酸', 16.6, 118.1, { ai: 427 }],
    ['C2H5OH', '乙醇', -114.1, 78.4, { ai: 363 }],
    ['C3H8', '丙烷', -187.7, -42.1, { ai: 470 }],
    ['C6H6', '苯', 5.5, 80.1, { ai: 498 }],
    ['(CH3)2CO', '丙酮', -94.7, 56.1, { ai: 465 }],
    ['CH3COOC2H5', '乙酸乙酯', -83.6, 77.1, { ai: 426 }],
    // 氮
    ['N2', '氮氣', -210.0, -195.8],
    ['NH3', '氨', -77.7, -33.3, { ai: 651, dec: [600, ['N2', 'H2'], ['N2', 'H2']] }],
    ['NO', '一氧化氮', -163.6, -151.8],
    ['NO2', '二氧化氮', -11.2, 21.2, { dec: [600, ['NO', 'O2'], ['NO', 'O2']] }],
    ['N2O', '一氧化二氮', -90.9, -88.5, { dec: [575, ['N2', 'O2'], ['N2', 'O2']] }],
    ['HNO3', '硝酸', -42, 83, { dec: [100, ['NO2', 'H2O', 'O2'], ['NO2', 'H2O']] }],
    // 氟
    ['F2', '氟氣', -219.7, -188.1],
    ['HF', '氟化氫', -83.6, 19.5],
    ['CF4', '四氟甲烷', -183.6, -127.8],
    ['SF6', '六氟化硫', -63.8, -63.8],
    // 鈉
    ['Na', '鈉', 97.8, 883, { ai: 125 }],
    ['NaOH', '氫氧化鈉', 318, 1388],
    ['Na2O', '氧化鈉', 1132, 1950],
    ['NaH', '氫化鈉', 638, I, { dec: [638, ['Na', 'H2'], ['Na', 'H2']] }],
    ['NaCl', '氯化鈉', 801, 1465],
    ['NaNO3', '硝酸鈉', 308, I, { dec: [380, ['NaNO2', 'O2'], ['NaNO2', 'O2']] }],
    ['NaNO2', '亞硝酸鈉', 271, I],
    ['Na2SO4', '硫酸鈉', 884, 1429],
    ['NaF', '氟化鈉', 993, 1704],
    ['CH3COONa', '乙酸鈉', 324, I, { dec: [400, ['Na2CO3', '(CH3)2CO'], ['Na2CO3', '(CH3)2CO']] }],
    ['Na2CO3', '碳酸鈉', 851, I],
    ['NaHCO3', '碳酸氫鈉', I, I, { dec: [80, ['Na2CO3', 'H2O', 'CO2'], ['Na2CO3', 'CO2']] }],
    ['NaClO', '次氯酸鈉', I, I, { dec: [100, ['NaCl', 'O2'], ['NaCl', 'O2']] }],
    // 鎂
    ['Mg', '鎂', 650, 1091, { ai: 473 }],
    ['MgO', '氧化鎂', 2852, 3600],
    ['Mg(OH)2', '氫氧化鎂', I, I, { dec: [332, ['MgO', 'H2O'], ['MgO', 'H2O']] }],
    ['MgCl2', '氯化鎂', 714, 1412],
    ['MgCO3', '碳酸鎂', I, I, { dec: [350, ['MgO', 'CO2'], ['MgO', 'CO2']] }],
    ['Mg(NO3)2', '硝酸鎂', I, I, { dec: [330, ['MgO', 'NO2', 'O2'], ['MgO', 'NO2']] }],
    ['MgSO4', '硫酸鎂', 1124, I],
    ['MgF2', '氟化鎂', 1263, 2260],
    ['Mg(CH3COO)2', '乙酸鎂', I, I, { dec: [323, ['MgO', '(CH3)2CO', 'CO2'], ['MgO', '(CH3)2CO']] }],
    // 硫
    ['S', '硫', 115.2, 444.6, { ai: 232 }],
    ['H2S', '硫化氫', -85.5, -60.3, { ai: 232 }],
    ['SO2', '二氧化硫', -72.7, -10.0],
    ['SO3', '三氧化硫', 16.9, 45, { dec: [700, ['SO2', 'O2'], ['SO2', 'O2']] }],
    ['H2SO4', '硫酸', 10.3, 337, { dec: [450, ['SO3', 'H2O'], ['SO3', 'H2O']] }],
    ['CS2', '二硫化碳', -111.6, 46.2, { ai: 90 }],
    // 氯
    ['Cl2', '氯氣', -101.5, -34.0],
    ['HCl', '氯化氫', -114.2, -85.1],
    ['CH3Cl', '氯甲烷', -97.4, -24.2, { ai: 632 }],
    ['CH2Cl2', '二氯甲烷', -96.7, 39.6],
    ['CHCl3', '氯仿', -63.5, 61.2],
    ['CCl4', '四氯化碳', -22.9, 76.7],
    ['C2H4Cl2', '1,2-二氯乙烷', -35.7, 83.5],
    // 鈣
    ['Ca', '鈣', 842, 1484, { ai: 790 }],
    ['CaO', '氧化鈣', 2613, 2850],
    ['Ca(OH)2', '氫氧化鈣', I, I, { dec: [512, ['CaO', 'H2O'], ['CaO', 'H2O']] }],
    ['CaCO3', '碳酸鈣', I, I, { dec: [825, ['CaO', 'CO2'], ['CaO', 'CO2']] }],
    ['CaCl2', '氯化鈣', 772, 1935],
    ['CaF2', '氟化鈣', 1418, 2533],
    ['CaSO4', '硫酸鈣', 1460, I],
    ['Ca(NO3)2', '硝酸鈣', I, I, { dec: [500, ['CaO', 'NO2', 'O2'], ['CaO', 'NO2']] }],
    ['Ca(CH3COO)2', '乙酸鈣', I, I, { dec: [160, ['CaCO3', '(CH3)2CO'], ['CaCO3', '(CH3)2CO']] }],
    ['CaC2', '碳化鈣', 2160, I],
    ['CaH2', '氫化鈣', 816, I],
    // 銨鹽
    ['NH4Cl', '氯化銨', I, I, { dec: [338, ['NH3', 'HCl'], ['NH3', 'HCl']] }],
    ['NH4NO3', '硝酸銨', 169.6, I, { dec: [210, ['N2O', 'H2O'], ['N2O', 'H2O']] }],
    ['(NH4)2SO4', '硫酸銨', I, I, { dec: [235, ['NH3', 'H2SO4'], ['NH3', 'H2SO4']], simp: true }],
    ['NH4F', '氟化銨', I, I, { dec: [100, ['NH3', 'HF'], ['NH3', 'HF']] }],
    ['CH3COONH4', '乙酸銨', I, I, { dec: [113, ['NH3', 'CH3COOH'], ['NH3', 'CH3COOH']] }],
  ];

  const C = {};
  for (const [f, zh, mp, bp, x = {}] of ROWS) {
    const counts = parseFormula(f);
    const n = Object.values(counts).reduce((a, b) => a + b, 0);
    const els = Object.keys(counts);
    const prio = els.slice().sort((a, b) => COLOR_PRIORITY.indexOf(a) - COLOR_PRIORITY.indexOf(b));
    C[f] = {
      id: f, zh, mp, bp, counts, n, els,
      c1: prio[0], c2: prio[1] || prio[0],
      ai: x.ai != null ? x.ai : null,
      dec: x.dec ? { t: x.dec[0], full: x.dec[1], keep: x.dec[2] } : null,
      simp: !!x.simp,
    };
  }

  // ---------------------------------------------------------------- 反應
  // cond: 'auto' 相鄰就反應 | 數字 = 至少要這個溫度(°C) | 'burn' 燃燒(火花，或溫度 ≥ 燃料自燃溫度) | 'spark' 只有火花/光照
  const RX = [];
  const PAIR = new Map();
  function addRx(a, b, full, keep, cond, kind, note) {
    const rx = { i: RX.length, a, b, full, keep, cond, kind, note: note || '', key: a + '+' + b };
    RX.push(rx);
    const k1 = a + '|' + b, k2 = b + '|' + a;
    if (PAIR.has(k1) || PAIR.has(k2)) throw new Error('duplicate reaction ' + k1);
    PAIR.set(k1, { rx, flip: false });
    if (a !== b) PAIR.set(k2, { rx, flip: true });
  }
  const burn = (fuel, prods, keep) => addRx(fuel, 'O2', prods, keep, 'burn', '燃燒');
  // 燃燒
  burn('H2', ['H2O'], ['H2O', 'H2O']);
  burn('C', ['CO2'], ['CO2']);
  for (const f of ['CH4', 'C2H6', 'C2H4', 'C2H2', 'CH3OH', 'HCHO', 'CH3CHO', 'CH3COOH', 'C2H5OH', 'C3H8', 'C6H6', '(CH3)2CO', 'CH3COOC2H5']) {
    burn(f, ['CO2', 'H2O'], ['CO2', 'H2O']);
  }
  burn('CO', ['CO2'], ['CO2', 'CO2']);
  burn('NH3', ['N2', 'H2O'], ['N2', 'H2O']);
  burn('H2S', ['SO2', 'H2O'], ['SO2', 'H2O']);
  burn('S', ['SO2'], ['SO2']);
  burn('CS2', ['CO2', 'SO2'], ['CO2', 'SO2']);
  burn('CH3Cl', ['CO2', 'H2O', 'HCl'], ['CO2', 'HCl']);
  burn('Na', ['Na2O'], ['Na2O']);
  burn('Mg', ['MgO'], ['MgO', 'MgO']);
  burn('Ca', ['CaO'], ['CaO', 'CaO']);
  addRx('Mg', 'CO2', ['MgO', 'C'], ['MgO', 'C'], 'burn', '燃燒', '鎂在二氧化碳中也能燃燒');
  // 火花／光照
  addRx('H2', 'Cl2', ['HCl'], ['HCl', 'HCl'], 'spark', '光照化合');
  addRx('N2', 'O2', ['NO'], ['NO', 'NO'], 'spark', '放電固氮', '閃電就是這樣固定空氣中的氮');
  addRx('CH4', 'Cl2', ['CH3Cl', 'HCl'], ['CH3Cl', 'HCl'], 'spark', '光照取代');
  addRx('CH3Cl', 'Cl2', ['CH2Cl2', 'HCl'], ['CH2Cl2', 'HCl'], 'spark', '光照取代');
  addRx('CH2Cl2', 'Cl2', ['CHCl3', 'HCl'], ['CHCl3', 'HCl'], 'spark', '光照取代');
  addRx('CHCl3', 'Cl2', ['CCl4', 'HCl'], ['CCl4', 'HCl'], 'spark', '光照取代');
  // 相鄰就反應
  addRx('H2', 'F2', ['HF'], ['HF', 'HF'], 'auto', '化合', '氟和氫在黑暗、低溫下也會爆炸');
  addRx('Na', 'Cl2', ['NaCl'], ['NaCl', 'NaCl'], 'auto', '化合');
  addRx('Na', 'F2', ['NaF'], ['NaF', 'NaF'], 'auto', '化合');
  addRx('Mg', 'F2', ['MgF2'], ['MgF2'], 'auto', '化合');
  addRx('Ca', 'F2', ['CaF2'], ['CaF2'], 'auto', '化合');
  addRx('Na', 'H2O', ['NaOH', 'H2'], ['NaOH', 'H2'], 'auto', '金屬與水');
  addRx('Ca', 'H2O', ['Ca(OH)2', 'H2'], ['Ca(OH)2', 'H2'], 'auto', '金屬與水');
  addRx('NaH', 'H2O', ['NaOH', 'H2'], ['NaOH', 'H2'], 'auto', '氫化物水解');
  addRx('CaH2', 'H2O', ['Ca(OH)2', 'H2'], ['Ca(OH)2', 'H2'], 'auto', '氫化物水解');
  addRx('CaC2', 'H2O', ['C2H2', 'Ca(OH)2'], ['Ca(OH)2', 'C2H2'], 'auto', '電石水解', '電石燈的原理');
  addRx('Na2O', 'H2O', ['NaOH'], ['NaOH', 'NaOH'], 'auto', '氧化物與水');
  addRx('CaO', 'H2O', ['Ca(OH)2'], ['Ca(OH)2'], 'auto', '氧化物與水', '生石灰遇水放熱');
  addRx('SO3', 'H2O', ['H2SO4'], ['H2SO4'], 'auto', '氧化物與水');
  addRx('NO2', 'H2O', ['HNO3', 'NO'], ['HNO3', 'NO'], 'auto', '氧化物與水', '奧士華法製硝酸的最後一步');
  addRx('NO', 'O2', ['NO2'], ['NO2', 'NO2'], 'auto', '氧化', '無色的 NO 一碰到氧就變成紅棕色');
  addRx('O3', 'NO', ['NO2', 'O2'], ['O2', 'NO2'], 'auto', '氧化');
  addRx('NaOH', 'CO2', ['NaHCO3'], ['NaHCO3'], 'auto', '吸收二氧化碳');
  addRx('Ca(OH)2', 'CO2', ['CaCO3', 'H2O'], ['CaCO3', 'H2O'], 'auto', '石灰水變混濁');
  addRx('CaO', 'CO2', ['CaCO3'], ['CaCO3'], 'auto', '化合');
  addRx('Na2O', 'CO2', ['Na2CO3'], ['Na2CO3'], 'auto', '化合');
  addRx('Cl2', 'NaOH', ['NaCl', 'NaClO', 'H2O'], ['NaCl', 'NaClO'], 'auto', '製漂白水');
  addRx('H2S', 'Cl2', ['S', 'HCl'], ['S', 'HCl'], 'auto', '置換');
  addRx('C2H4', 'Cl2', ['C2H4Cl2'], ['C2H4Cl2'], 'auto', '加成');
  addRx('F2', 'H2O', ['HF', 'O2'], ['HF', 'O2'], 'auto', '氧化', '氟連水都能氧化');
  addRx('F2', 'CH4', ['CF4', 'HF'], ['CF4', 'HF'], 'auto', '氟化');
  addRx('F2', 'S', ['SF6'], ['SF6'], 'auto', '氟化');
  addRx('F2', 'NaCl', ['NaF', 'Cl2'], ['NaF', 'Cl2'], 'auto', '鹵素置換');
  // 需要加熱
  addRx('Mg', 'H2O', ['MgO', 'H2'], ['MgO', 'H2'], 110, '金屬與水蒸氣');
  addRx('H2S', 'SO2', ['S', 'H2O'], ['S', 'H2O'], 110, '克勞斯法', '實際約 200–350 °C，需觸媒');
  addRx('CH3COOH', 'C2H5OH', ['CH3COOC2H5', 'H2O'], ['CH3COOC2H5', 'H2O'], 110, '酯化', '實際需酸催化、加熱回流');
  addRx('C2H2', 'H2', ['C2H4'], ['C2H4'], 110, '氫化', '實際需金屬觸媒');
  addRx('C2H4', 'H2', ['C2H6'], ['C2H6'], 110, '氫化', '實際需鎳觸媒');
  addRx('N2', 'H2', ['NH3'], ['NH3', 'NH3'], 350, '哈伯法', '實際約 400–450 °C、高壓、鐵觸媒');
  addRx('SO2', 'O2', ['SO3'], ['SO3', 'SO3'], 350, '接觸法', '實際約 400–450 °C、V₂O₅ 觸媒');
  addRx('CO', 'H2O', ['CO2', 'H2'], ['CO2', 'H2'], 350, '水煤氣轉移', '實際需觸媒');
  addRx('CO', 'H2', ['CH3OH'], ['CH3OH'], 350, '甲醇合成', '實際約 250 °C、高壓、銅鋅觸媒');
  addRx('C2H4', 'H2O', ['C2H5OH'], ['C2H5OH'], 350, '乙烯水合', '實際約 300 °C、磷酸觸媒');
  addRx('CH3OH', 'CO', ['CH3COOH'], ['CH3COOH'], 350, '羰基化', '孟山都法，實際需銠觸媒');
  addRx('Na', 'H2', ['NaH'], ['NaH', 'NaH'], 350, '化合');
  addRx('Ca', 'H2', ['CaH2'], ['CaH2'], 350, '化合');
  addRx('Mg', 'Cl2', ['MgCl2'], ['MgCl2'], 350, '化合');
  addRx('Ca', 'Cl2', ['CaCl2'], ['CaCl2'], 350, '化合');
  addRx('CH3COONa', 'NaOH', ['CH4', 'Na2CO3'], ['Na2CO3', 'CH4'], 350, '脫羧', '實驗室製甲烷的方法');
  addRx('C', 'H2O', ['CO', 'H2'], ['CO', 'H2'], 900, '水煤氣');
  addRx('CH4', 'H2O', ['CO', 'H2'], ['CO', 'H2'], 900, '蒸汽重組');
  addRx('C', 'CO2', ['CO'], ['CO', 'CO'], 900, '布杜阿爾反應');
  addRx('C', 'S', ['CS2'], ['CS2'], 900, '化合');

  // 酸 × 鹼（含鹼性氧化物、活潑金屬、碳酸鹽、氨）→ 自動產生
  const ACIDS = [['HCl', 'Cl'], ['HNO3', 'NO3'], ['H2SO4', 'SO4'], ['HF', 'F'], ['CH3COOH', 'Ac']];
  const SALT = {
    'Na|Cl': 'NaCl', 'Na|NO3': 'NaNO3', 'Na|SO4': 'Na2SO4', 'Na|F': 'NaF', 'Na|Ac': 'CH3COONa',
    'Ca|Cl': 'CaCl2', 'Ca|NO3': 'Ca(NO3)2', 'Ca|SO4': 'CaSO4', 'Ca|F': 'CaF2', 'Ca|Ac': 'Ca(CH3COO)2',
    'Mg|Cl': 'MgCl2', 'Mg|NO3': 'Mg(NO3)2', 'Mg|SO4': 'MgSO4', 'Mg|F': 'MgF2', 'Mg|Ac': 'Mg(CH3COO)2',
    'NH4|Cl': 'NH4Cl', 'NH4|NO3': 'NH4NO3', 'NH4|SO4': '(NH4)2SO4', 'NH4|F': 'NH4F', 'NH4|Ac': 'CH3COONH4',
  };
  const BASES = [
    ['NaOH', 'Na', 'oh'], ['Ca(OH)2', 'Ca', 'oh'], ['Mg(OH)2', 'Mg', 'oh'],
    ['Na2O', 'Na', 'ox'], ['CaO', 'Ca', 'ox'], ['MgO', 'Mg', 'ox'],
    ['Na', 'Na', 'metal'], ['Ca', 'Ca', 'metal'], ['Mg', 'Mg', 'metal'],
    ['NaHCO3', 'Na', 'co3'], ['Na2CO3', 'Na', 'co3'], ['CaCO3', 'Ca', 'co3'], ['MgCO3', 'Mg', 'co3'],
    ['NH3', 'NH4', 'nh3'],
  ];
  for (const [base, cat, type] of BASES) {
    for (const [acid, an] of ACIDS) {
      if (type === 'metal' && acid === 'HNO3') continue; // 硝酸是氧化性酸，產物複雜，不放
      const salt = SALT[cat + '|' + an];
      if (type === 'oh') addRx(base, acid, [salt, 'H2O'], [salt, 'H2O'], 'auto', '酸鹼中和');
      else if (type === 'ox') addRx(base, acid, [salt, 'H2O'], [salt, 'H2O'], 'auto', '氧化物與酸');
      else if (type === 'metal') addRx(base, acid, [salt, 'H2'], [salt, 'H2'], 'auto', '金屬與酸');
      else if (type === 'co3') addRx(base, acid, [salt, 'H2O', 'CO2'], [salt, 'CO2'], 'auto', '碳酸鹽與酸');
      else addRx(base, acid, [salt], [salt], 'auto', '酸鹼中和');
    }
  }

  // ---------------------------------------------------------------- 配平（求整數零空間）
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
  function balance(lhs, rhs) {
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
    if (free.length === 0) return null;
    if (free.length > 1) {
      // 不只一種配法（例如 O₃ + NO → NO₂ + O₂）：找係數和最小的正整數解
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
      return best ? best.v : null;
    }
    const x = new Array(n);
    x[free[0]] = [1, 1];
    piv.forEach((c, i) => { x[c] = norm([-M[i][free[0]][0], M[i][free[0]][1]]); });
    const l = x.reduce((a, [, d]) => (a / gcd(a, d)) * d, 1);
    let ints = x.map(([a, d]) => a * (l / d));
    const g = ints.reduce((a, v) => gcd(a, v), 0);
    ints = ints.map((v) => v / g);
    if (ints.every((v) => v < 0)) ints = ints.map((v) => -v);
    if (!ints.every((v) => v > 0)) return null;
    return ints;
  }
  const eqCache = new Map();
  function equation(lhs, rhs, html = true) {
    const key = lhs.join('+') + '>' + rhs.join('+') + (html ? 'h' : 't');
    if (eqCache.has(key)) return eqCache.get(key);
    const co = balance(lhs, rhs) || [...lhs, ...rhs].map(() => 1);
    const fmt = html ? fHTML : fText;
    const term = (s, k) => (k > 1 ? k + (html ? '' : '') : '') + fmt(s);
    const out = lhs.map((s, i) => term(s, co[i])).join(' + ') + ' → ' + rhs.map((s, i) => term(s, co[lhs.length + i])).join(' + ');
    eqCache.set(key, out);
    return out;
  }
  const rxEquation = (rx, html) => equation(rx.a === rx.b ? [rx.a] : [rx.a, rx.b], rx.full, html);
  const decEquation = (id, html) => equation([id], C[id].dec.full, html);

  // ---------------------------------------------------------------- 物態、分數
  function phaseAt(id, T) {
    const c = C[id], t = TEMPS[T].t;
    if (t < c.mp) return 's';
    if (t < c.bp) return 'l';
    return 'g';
  }
  const upMult = (st, e) => 1 + 0.5 * ((st.up && st.up[e]) || 0);
  /** 分子價值 = 原子底分總和 ×（越大的分子加成越多）× 每個已強化元素的倍率（相乘） */
  function value(st, id) {
    const c = C[id];
    let s = 0, m = 1;
    for (const e in c.counts) s += c.counts[e] * ELEMENTS[e].base;
    for (const e of c.els) m *= upMult(st, e);
    return Math.max(1, Math.round(s * (1 + 0.15 * (c.n - 1)) * m));
  }
  function targetFor(level) {
    return Math.round(TARGET_BASE * Math.pow(TARGET_GROWTH, level - 1) / 5) * 5;
  }
  let TARGET_BASE = 60, TARGET_GROWTH = 1.17;

  // ---------------------------------------------------------------- 亂數、元素袋、反應台
  function rand(st) {
    let t = (st.rng = (st.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function drawAtom(st) {
    let tot = 0;
    for (const e of st.unlocked) tot += st.bag[e] || 0;
    let r = rand(st) * tot;
    for (const e of st.unlocked) { r -= st.bag[e] || 0; if (r < 0) return e; }
    return st.unlocked[st.unlocked.length - 1];
  }
  function trayCounts(tray) { const m = {}; for (const e of tray) m[e] = (m[e] || 0) + 1; return m; }
  function candidates(st) {
    const have = trayCounts(st.tray);
    const out = [];
    for (const id in C) {
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
    for (let tries = 0; tries < 20; tries++) {
      while (st.tray.length < st.traySize) st.tray.push(drawAtom(st));
      sortTray(st);
      if (candidates(st).length) return;
      st.tray = []; // 完全合成不出東西 → 免費重抽
    }
  }
  /** 這個分子會用掉反應台上的哪幾格（index） */
  function atomsFor(st, id) {
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

  // ---------------------------------------------------------------- 反應判定
  function rxActive(st, rx, spark) {
    const t = TEMPS[st.T].t;
    if (rx.cond === 'spark') { if (!spark) return false; }
    else if (rx.cond === 'burn') { if (!spark && !(C[rx.a].ai != null && t >= C[rx.a].ai)) return false; }
    else if (typeof rx.cond === 'number') { if (t < rx.cond) return false; }
    // 產物在這個溫度會分解 → 平衡往回，不反應（例如高溫下 N₂ + H₂ 不會生成 NH₃）
    for (const p of rx.full) if (C[p].dec && t >= C[p].dec.t) return false;
    return true;
  }
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function findReactions(st, spark) {
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
          const r = PAIR.get(a.c + '|' + b.c);
          if (!r || !rxActive(st, r.rx, spark)) continue;
          used.add(a.id); used.add(b.id);
          out.push(r.flip ? { rx: r.rx, A: [nx, ny, b], B: [x, y, a] } : { rx: r.rx, A: [x, y, a], B: [nx, ny, b] });
          break;
        }
      }
    }
    return out;
  }
  function sparkable(st) {
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const a = st.grid[x][y];
        if (!a) continue;
        for (const [dx, dy] of DIRS.slice(0, 2)) {
          const nx = x + dx, ny = y + dy;
          if (nx >= W || ny >= H) continue;
          const b = st.grid[nx][ny];
          if (!b) continue;
          const r = PAIR.get(a.c + '|' + b.c);
          if (r && (r.rx.cond === 'spark' || r.rx.cond === 'burn') && rxActive(st, r.rx, true)) return true;
        }
      }
    }
    return false;
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
  function resolve(st, opts = {}) {
    const steps = [];
    const found = new Set(), foundRx = new Set();
    let depth = 0, total = 0, spark = !!opts.spark;
    const newCell = (id) => { found.add(id); return { id: st.uid++, c: id }; };
    if (settle(st)) steps.push({ kind: 'settle', grid: snap(st) });
    for (let wave = 0; wave < 60; wave++) {
      const mult = Math.min(64, 2 ** depth);
      // 1. 熱分解
      const dec = findDecomps(st);
      if (dec.length) {
        let gain = 0;
        const fx = [], logs = [];
        const extra = new Map(); // cell -> 第二個產物
        for (const [x, y, a] of dec) {
          const d = C[a.c].dec;
          const p0 = newCell(d.keep[0]);
          st.grid[x][y] = p0;
          if (d.keep[1]) extra.set(p0, d.keep[1]);
          const g = Math.round(value(st, a.c) * 0.5 * (has(st, 'furnace') ? 2 : 1)) * mult;
          gain += g;
          fx.push({ x, y, type: 'decomp' });
          logs.push({ k: 'dec', c: a.c, gain: g, mult, vent: [] });
          foundRx.add('dec:' + a.c);
        }
        // 第二個產物插在第一個產物之後（同一欄）；放不下就逸出杯外
        for (let x = 0; x < W; x++) {
          const items = colItems(st, x);
          const out = [];
          for (const c of items) {
            out.push(c);
            if (extra.has(c)) out.push({ id: st.uid++, c: extra.get(c), pending: true });
          }
          while (out.length > H) {
            const i = out.findIndex((c) => c.pending);
            const v = out.splice(i, 1)[0];
            const lg = logs.find((l) => C[l.c].dec.keep[1] === v.c && l.vent.length === 0) || logs[0];
            lg.vent.push(v.c);
          }
          for (const c of out) if (c.pending) { delete c.pending; found.add(c.c); }
          st.grid[x] = out.concat(new Array(H - out.length).fill(null));
        }
        settle(st);
        total += gain;
        steps.push({ kind: 'decomp', fx, gain, mult, grid: snap(st), logs });
        depth++;
        continue;
      }
      // 2. 相鄰反應
      const rxs = findReactions(st, spark);
      spark = false;
      if (rxs.length) {
        let gain = 0;
        const fx = [], logs = [];
        for (const { rx, A, B } of rxs) {
          let rm = 2;
          if (ACID_KINDS.has(rx.kind) && has(st, 'buret')) rm *= 2;
          if (rx.cond === 'burn' && has(st, 'lighter')) rm *= 2;
          if (typeof rx.cond === 'number' && has(st, 'furnace')) rm *= 2;
          const g = Math.round((value(st, A[2].c) + value(st, B[2].c)) * rm) * mult;
          gain += g;
          st.grid[A[0]][A[1]] = rx.keep[0] ? newCell(rx.keep[0]) : null;
          st.grid[B[0]][B[1]] = rx.keep[1] ? newCell(rx.keep[1]) : null;
          fx.push({ x: A[0], y: A[1], type: rx.cond === 'burn' ? 'burn' : 'react' }, { x: B[0], y: B[1], type: rx.cond === 'burn' ? 'burn' : 'react' });
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
        }
        total += gain;
        steps.push({ kind: 'cluster', fx, gain, mult, grid: snap(st), logs });
        if (settle(st)) steps.push({ kind: 'settle', grid: snap(st) });
        depth++;
        continue;
      }
      break;
    }
    return { steps, total, depth, found: [...found], foundRx: [...foundRx] };
  }

  // ---------------------------------------------------------------- 一局
  function newRun(seed) {
    const st = {
      v: VERSION, rng: seed >>> 0, level: 1,
      unlocked: START_ELEMENTS.slice(), bag: {}, up: {},
      traySize: TRAY_START, max: { ...BASE_MAX }, uid: 1, relics: [],
      log: [], best: { chain: 0, turn: 0 },
    };
    for (const e of START_ELEMENTS) st.bag[e] = ELEMENTS[e].w;
    startLevel(st);
    return st;
  }
  function startLevel(st) {
    st.grid = Array.from({ length: W }, () => new Array(H).fill(null));
    st.T = ROOM;
    st.score = 0;
    st.target = targetFor(st.level);
    st.turnsLeft = TURNS;
    st.charges = { ...st.max };
    st.phase = 'play';
    st.offers = null;
    st.picks = 0;
    st.endReason = null;
    st.tray = [];
    st.log = [];
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
  function checkEnd(st) {
    if (st.score >= st.target) {
      st.phase = 'clear';
      st.picks = st.turnsLeft >= 5 ? 2 : 1;
      st.offers = makeOffers(st);
    } else if (st.turnsLeft <= 0) {
      st.phase = 'fail';
      st.endReason = 'turns';
    } else {
      let any = false;
      for (let x = 0; x < W; x++) if (canPlace(st, x)) any = true;
      if (!any) { st.phase = 'fail'; st.endReason = 'full'; }
    }
  }
  function consume(st, id) {
    const idx = new Set(atomsFor(st, id));
    st.tray = st.tray.filter((_, i) => !idx.has(i));
  }
  /** 執行一個動作；回傳 {steps,total,depth,...}，不合法則回傳 null */
  function act(st, a) {
    if (st.phase !== 'play') return null;
    let res;
    if (a.type === 'place') {
      if (!candidates(st).includes(a.cid) || !canPlace(st, a.x)) return null;
      consume(st, a.cid);
      const cell = place(st, a.cid, a.x);
      const afterPlace = snap(st);
      res = resolve(st);
      res.afterPlace = afterPlace;
      res.found.push(a.cid);
      res.placed = { id: cell.id, c: a.cid, x: a.x };
      st.turnsLeft--;
      refill(st);
    } else if (a.type === 'temp') {
      const nt = st.T + a.dir;
      if (nt < 0 || nt >= TEMPS.length || st.charges.temp <= 0) return null;
      st.charges.temp--;
      st.T = nt;
      res = resolve(st);
    } else if (a.type === 'spark') {
      if (st.charges.spark <= 0 || !sparkable(st)) return null;
      st.charges.spark--;
      res = resolve(st, { spark: true });
    } else if (a.type === 'redraw') {
      if (st.charges.redraw <= 0) return null;
      st.charges.redraw--;
      st.tray = [];
      refill(st);
      res = { steps: [], total: 0, depth: 0, found: [], foundRx: [] };
    } else return null;
    st.score += res.total;
    for (const s of res.steps) if (s.logs) for (const l of s.logs) st.log.unshift(l);
    st.log.length = Math.min(st.log.length, 40);
    st.best.chain = Math.max(st.best.chain, res.depth);
    st.best.turn = Math.max(st.best.turn, res.total);
    checkEnd(st);
    return res;
  }
  /** 預覽：在副本上試放，回傳得分與落點 */
  function simulatePlace(st, cid, x) {
    if (!canPlace(st, x)) return null;
    const s = { grid: st.grid.map((c) => c.slice()), T: st.T, up: st.up, uid: st.uid, relics: st.relics };
    const cell = place(s, cid, x);
    const landing = posOf(s, cell.id);
    // 落點旁邊有幾個同種分子（鋪陳用）
    let adj = 0;
    for (const [dx, dy] of DIRS) {
      const nx = landing[0] + dx, ny = landing[1] + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const b = s.grid[nx][ny];
      if (b && b.c === cid) adj++;
    }
    const r = resolve(s);
    return { total: r.total, depth: r.depth, landing, adj, events: eventsOf(r) };
  }
  const eventsOf = (r) => r.steps.flatMap((q) => q.logs || []);
  function simulateAction(st, a) {
    const s = JSON.parse(JSON.stringify({ ...st, levelStart: null }));
    const r = act(s, a);
    return r ? { total: r.total, depth: r.depth, events: eventsOf(r) } : null;
  }

  /** 下一步建議：能馬上得分的放法／工具 > 鋪陳（湊成一對）> 從頭開始 */
  function hint(st) {
    if (st.phase !== 'play') return null;
    const cands = candidates(st);
    let best = null, setup = null;
    for (const cid of cands) {
      for (let x = 0; x < W; x++) {
        const r = simulatePlace(st, cid, x);
        if (!r) continue;
        if (r.total > 0) { if (!best || r.total > best.total) best = { kind: 'place', cid, x, ...r }; }
        else if (r.adj > 0) {
          const v = value(st, cid) * (1 + r.adj);
          if (!setup || v > setup.v) setup = { kind: 'setup', cid, x, v, ...r };
        }
      }
    }
    let tool = null;
    const tools = [];
    if (st.charges.spark > 0 && sparkable(st)) tools.push({ type: 'spark' });
    if (st.charges.temp > 0) { if (st.T < TEMPS.length - 1) tools.push({ type: 'temp', dir: 1 }); if (st.T > 0) tools.push({ type: 'temp', dir: -1 }); }
    for (const a of tools) {
      const r = simulateAction(st, a);
      if (r && r.total > 0 && (!tool || r.total > tool.total)) tool = { kind: 'tool', action: a, ...r };
    }
    // 工具不花回合：只要不比最好的放法差太多就先建議工具
    if (tool && (!best || tool.total >= best.total * 0.8)) return tool;
    if (best) return best;
    if (setup) return setup;
    // 從頭開始：挑「價值 × 之後還容易再做出來」最高的分子
    let tot = 0;
    for (const e of st.unlocked) tot += st.bag[e] || 0;
    let pick = null, ps = -1;
    for (const cid of cands) {
      let p = Math.pow(value(st, cid), 1.5);
      for (const e in C[cid].counts) p *= Math.pow((st.bag[e] || 0) / tot, C[cid].counts[e]);
      if (p > ps) { ps = p; pick = cid; }
    }
    if (!pick) return null;
    let x = 0;
    for (let k = 0; k < W; k++) if (canPlace(st, k) && colItems(st, k).length < colItems(st, x).length) x = k;
    return { kind: 'start', cid: pick, x };
  }

  // ---------------------------------------------------------------- 補給站
  function makeOffers(st) {
    const locked = UNLOCK_ORDER.filter((e) => !st.unlocked.includes(e));
    const offers = locked.slice(0, 2).map((e) => ({ type: 'element', e }));
    const pool = [];
    if (st.traySize < TRAY_MAX) pool.push({ type: 'tray' }, { type: 'tray' });
    pool.push({ type: 'temp' }, { type: 'spark' }, { type: 'redraw' }, { type: 'undo' });
    for (const e of st.unlocked) pool.push({ type: 'upgrade', e }, { type: 'upgrade', e }, { type: 'enrich', e });
    for (const r in RELICS) if (!has(st, r)) pool.push({ type: 'relic', r }, { type: 'relic', r });
    const same = (p, o) => p.type === o.type && p.e === o.e && p.r === o.r;
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
    else if (o.type === 'temp') st.max.temp++;
    else if (o.type === 'spark') st.max.spark++;
    else if (o.type === 'redraw') st.max.redraw++;
    else if (o.type === 'undo') st.max.undo++;
    else if (o.type === 'upgrade') st.up[o.e] = (st.up[o.e] || 0) + 1;
    else if (o.type === 'enrich') st.bag[o.e] = (st.bag[o.e] || 0) + 2;
    else if (o.type === 'relic') { if (!st.relics) st.relics = []; if (!st.relics.includes(o.r)) st.relics.push(o.r); }
    st.offers.splice(idx, 1);
    st.picks--;
    return true;
  }
  function nextLevel(st) {
    st.level++;
    st.unlocked.sort((a, b) => ELEMENTS[a].z - ELEMENTS[b].z);
    startLevel(st);
  }

  /** 某物質參與的反應（只列出元素都已解鎖的） */
  function reactionsOf(id, unlocked) {
    const ok = (f) => C[f].els.every((e) => !unlocked || unlocked.includes(e));
    return RX.filter((r) => (r.a === id || r.b === id) && ok(r.a) && ok(r.b));
  }

  return {
    VERSION, W, H, TRAY_START, TRAY_MAX, TURNS, BASE_MAX,
    ELEMENTS, START_ELEMENTS, UNLOCK_ORDER, TEMPS, ROOM, C, RX, PAIR, RELICS, ACID_KINDS,
    parseFormula, fText, fHTML, balance, equation, rxEquation, decEquation,
    phaseAt, value, upMult, targetFor, setTarget: (b, g) => { TARGET_BASE = b; TARGET_GROWTH = g; },
    candidates, atomsFor, canPlace, sparkable, rxActive, colItems, posOf,
    newRun, startLevel, retryLevel, act, resolve, simulatePlace, simulateAction, hint,
    makeOffers, takeOffer, nextLevel, reactionsOf, rand,
  };
})();
if (typeof module !== 'undefined') module.exports = Lab;
