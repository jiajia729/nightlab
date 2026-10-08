/* 夜間實驗室 — 化學資料（元素、物質、反應）
 * 熔點、沸點、自燃溫度、分解溫度用真實數據（°C，1 atm）；密度 g/cm³（凝相，氣體用液態密度）。
 * 所有反應式只寫反應物與產物，係數由 logic.js 的 balance() 自動配平並在測試中檢查。
 */
const NL_CHEM = (() => {
  'use strict';
  const I = Infinity;

  // ---------------------------------------------------------------- 元素（CPK / Jmol 配色）
  // base：原子底分；w：無限挑戰模式的元素袋比重
  const ELEMENTS = {
    H:  { z: 1,  zh: '氫', color: '#eef2f6', base: 1, w: 5 },
    Li: { z: 3,  zh: '鋰', color: '#cc80ff', base: 3, w: 2 },
    B:  { z: 5,  zh: '硼', color: '#ffb5b5', base: 4, w: 2 },
    C:  { z: 6,  zh: '碳', color: '#7d8796', base: 3, w: 3 },
    N:  { z: 7,  zh: '氮', color: '#4f6dff', base: 3, w: 2 },
    O:  { z: 8,  zh: '氧', color: '#ff4b3e', base: 2, w: 3 },
    F:  { z: 9,  zh: '氟', color: '#bdf07f', base: 4, w: 2 },
    Na: { z: 11, zh: '鈉', color: '#ab6df3', base: 3, w: 2 },
    Mg: { z: 12, zh: '鎂', color: '#93d43c', base: 4, w: 2 },
    Al: { z: 13, zh: '鋁', color: '#bfa6a6', base: 4, w: 2 },
    Si: { z: 14, zh: '矽', color: '#f0c8a0', base: 4, w: 2 },
    P:  { z: 15, zh: '磷', color: '#ff8000', base: 4, w: 2 },
    S:  { z: 16, zh: '硫', color: '#f5d43e', base: 4, w: 2 },
    Cl: { z: 17, zh: '氯', color: '#33d466', base: 3, w: 2 },
    K:  { z: 19, zh: '鉀', color: '#8f40d4', base: 3, w: 2 },
    Ca: { z: 20, zh: '鈣', color: '#36a463', base: 4, w: 2 },
    Mn: { z: 25, zh: '錳', color: '#9c7ac7', base: 5, w: 1 },
    Fe: { z: 26, zh: '鐵', color: '#e06633', base: 4, w: 2 },
    Cu: { z: 29, zh: '銅', color: '#c88033', base: 4, w: 2 },
    Zn: { z: 30, zh: '鋅', color: '#7d80b0', base: 4, w: 2 },
    Br: { z: 35, zh: '溴', color: '#a62929', base: 4, w: 2 },
    Ag: { z: 47, zh: '銀', color: '#c0c0c0', base: 5, w: 1 },
    I:  { z: 53, zh: '碘', color: '#940094', base: 5, w: 1 },
    Ba: { z: 56, zh: '鋇', color: '#00c900', base: 5, w: 1 },
  };
  // 分子方塊主色：金屬優先，再來鹵素、非金屬
  const COLOR_PRIORITY = ['Ag', 'Cu', 'Fe', 'Mn', 'Zn', 'Ba', 'K', 'Li', 'Na', 'Mg', 'Ca', 'Al', 'I', 'Br', 'Cl', 'F', 'P', 'Si', 'B', 'S', 'N', 'C', 'O', 'H'];
  // 焰色反應
  const FLAME = { Li: ['#ff2f55', '洋紅'], Na: ['#ffc21a', '黃'], K: ['#c58cff', '淡紫'], Ca: ['#ff6a33', '磚紅'], Cu: ['#2fe08a', '綠'], Ba: ['#b4e85a', '黃綠'] };

  // ---------------------------------------------------------------- 物質
  // [化學式, 名稱, 熔點, 沸點, 密度, {ai 自燃溫度, dec:[分解溫度, 產物, 留在杯中的產物(≤2)], pho:[產物, 留下]（照紫外光分解）,
  //   col 物質本身顏色, colg 氣態顏色, simp 有簡化, disp 顯示用寫法}]
  // 熔點 = 沸點 → 昇華；I（Infinity）→ 在遊戲溫度範圍內不熔／不沸（多半先分解）
  const ROWS = [
    // 氫、氧
    ['H2', '氫氣', -259.2, -252.9, 0.07, { ai: 500 }],
    ['O2', '氧氣', -218.8, -183.0, 1.14],
    ['O3', '臭氧', -192.2, -111.9, 1.35, { dec: [100, ['O2'], ['O2', 'O2']], col: '#6f9dff' }],
    ['H2O', '水', 0, 100, 1.00],
    ['H2O2', '過氧化氫', -0.4, 150.2, 1.45, { dec: [100, ['H2O', 'O2'], ['H2O', 'O2']], pho: [['H2O', 'O2'], ['H2O', 'O2']] }],
    // 碳
    ['C', '石墨', 3642, 3642, 2.27, { ai: 700, col: '#3a3f47' }],
    ['CH4', '甲烷', -182.5, -161.5, 0.42, { ai: 580 }],
    ['C2H6', '乙烷', -182.8, -88.5, 0.54, { ai: 472, dec: [800, ['C2H4', 'H2'], ['C2H4', 'H2']] }],
    ['C2H4', '乙烯', -169.2, -103.7, 0.57, { ai: 490 }],
    ['C2H2', '乙炔', -84, -84, 0.62, { ai: 305 }],
    ['C3H8', '丙烷', -187.7, -42.1, 0.58, { ai: 470 }],
    ['C4H10', '丁烷', -138.3, -0.5, 0.60, { ai: 405 }],
    ['CO', '一氧化碳', -205.0, -191.5, 0.79, { ai: 609 }],
    ['CO2', '二氧化碳', -78.5, -78.5, 1.56],
    ['CH3OH', '甲醇', -97.6, 64.7, 0.79, { ai: 464 }],
    ['HCHO', '甲醛', -92, -19, 0.82, { ai: 424 }],
    ['HCOOH', '甲酸', 8.4, 100.8, 1.22, { ai: 601 }],
    ['C2H5OH', '乙醇', -114.1, 78.4, 0.79, { ai: 363 }],
    ['CH3CHO', '乙醛', -123.4, 20.2, 0.78, { ai: 175 }],
    ['CH3COOH', '乙酸', 16.6, 118.1, 1.05, { ai: 427 }],
    ['(CH3)2CO', '丙酮', -94.7, 56.1, 0.78, { ai: 465 }],
    ['CH3COOC2H5', '乙酸乙酯', -83.6, 77.1, 0.90, { ai: 426 }],
    ['(C2H5)2O', '乙醚', -116.3, 34.6, 0.71, { ai: 160 }],
    ['C6H6', '苯', 5.5, 80.1, 0.88, { ai: 498 }],
    ['C6H5Cl', '氯苯', -45.2, 131.7, 1.11, { ai: 593 }],
    ['C6H5Br', '溴苯', -30.8, 156, 1.50, { ai: 565 }],
    ['C6H5NO2', '硝基苯', 5.7, 210.9, 1.20, { ai: 480, col: '#e3cf62' }],
    ['CO(NH2)2', '尿素', 132.7, I, 1.32, { dec: [150, ['NH3', 'HNCO'], ['NH3', 'HNCO']] }],
    ['HNCO', '異氰酸', -86.8, 23.5, 1.14],
    // 有機鹵化物
    ['CH3Cl', '氯甲烷', -97.4, -24.2, 0.99, { ai: 632 }],
    ['CH2Cl2', '二氯甲烷', -96.7, 39.6, 1.33],
    ['CHCl3', '氯仿', -63.5, 61.2, 1.49],
    ['CCl4', '四氯化碳', -22.9, 76.7, 1.59],
    ['C2H4Cl2', '1,2-二氯乙烷', -35.7, 83.5, 1.25, { ai: 413 }],
    ['CH3Br', '溴甲烷', -93.7, 3.6, 1.73],
    ['C2H5Br', '溴乙烷', -118.6, 38.4, 1.46, { ai: 511 }],
    ['C2H4Br2', '1,2-二溴乙烷', 9.8, 131.6, 2.18],
    ['CH3I', '碘甲烷', -66.5, 42.4, 2.28],
    // 氮
    ['N2', '氮氣', -210.0, -195.8, 0.81],
    ['NH3', '氨', -77.7, -33.3, 0.68, { ai: 651, dec: [600, ['N2', 'H2'], ['N2', 'H2']] }],
    ['NO', '一氧化氮', -163.6, -151.8, 1.27],
    ['NO2', '二氧化氮', -11.2, 21.2, 1.45, { dec: [600, ['NO', 'O2'], ['NO', 'O2']], col: '#a8481e' }],
    ['N2O', '一氧化二氮', -90.9, -88.5, 1.23, { dec: [575, ['N2', 'O2'], ['N2', 'O2']] }],
    ['HNO3', '硝酸', -42, 83, 1.51, { dec: [100, ['NO2', 'H2O', 'O2'], ['NO2', 'H2O']], pho: [['NO2', 'H2O', 'O2'], ['NO2', 'O2']] }],
    ['N2H4', '聯氨', 1.4, 113.5, 1.02, { ai: 24 }],
    // 氟
    ['F2', '氟氣', -219.7, -188.1, 1.50, { col: '#e3ef9a' }],
    ['HF', '氟化氫', -83.6, 19.5, 0.99],
    ['CF4', '四氟甲烷', -183.6, -127.8, 1.60],
    ['SF6', '六氟化硫', -63.8, -63.8, 1.88],
    ['BF3', '三氟化硼', -126.8, -99.9, 1.60],
    ['SiF4', '四氟化矽', -86, -86, 1.66],
    // 鈉
    ['Na', '鈉', 97.8, 883, 0.97, { ai: 125 }],
    ['NaOH', '氫氧化鈉', 318, 1388, 2.13],
    ['Na2O', '氧化鈉', 1132, 1950, 2.27],
    ['NaH', '氫化鈉', I, I, 1.39, { dec: [638, ['Na', 'H2'], ['Na', 'H2']] }],
    ['NaCl', '氯化鈉', 801, 1465, 2.17],
    ['NaBr', '溴化鈉', 747, 1390, 3.21],
    ['NaI', '碘化鈉', 661, 1304, 3.67],
    ['NaF', '氟化鈉', 993, 1704, 2.56],
    ['NaNO3', '硝酸鈉', 308, I, 2.26, { dec: [380, ['NaNO2', 'O2'], ['NaNO2', 'O2']] }],
    ['NaNO2', '亞硝酸鈉', 271, I, 2.17],
    ['Na2SO4', '硫酸鈉', 884, 1429, 2.66],
    ['Na2SO3', '亞硫酸鈉', I, I, 2.63, { dec: [600, ['Na2SO4', 'Na2S'], ['Na2SO4', 'Na2S']] }],
    ['Na2S', '硫化鈉', 1176, I, 1.86],
    ['Na2S2O3', '硫代硫酸鈉', I, I, 1.67],
    ['Na2S4O6', '連四硫酸鈉', I, I, 2.10],
    ['CH3COONa', '乙酸鈉', 324, I, 1.53, { dec: [400, ['Na2CO3', '(CH3)2CO'], ['Na2CO3', '(CH3)2CO']] }],
    ['Na2CO3', '碳酸鈉', 851, I, 2.54],
    ['NaHCO3', '碳酸氫鈉', I, I, 2.20, { dec: [80, ['Na2CO3', 'H2O', 'CO2'], ['Na2CO3', 'CO2']] }],
    ['NaClO', '次氯酸鈉', I, I, 1.11, { dec: [100, ['NaCl', 'O2'], ['NaCl', 'O2']] }],
    ['Na3PO4', '磷酸鈉', 1583, I, 2.54],
    ['Na2SiO3', '矽酸鈉', 1088, I, 2.61],
    ['NaAlO2', '偏鋁酸鈉', 1650, I, 2.69, { simp: true }],
    ['NaBH4', '硼氫化鈉', I, I, 1.07, { dec: [400, ['NaH', 'B', 'H2'], ['NaH', 'B']] }],
    ['NaBO2', '偏硼酸鈉', 966, 1434, 2.46],
    ['NaN3', '疊氮化鈉', I, I, 1.85, { dec: [275, ['Na', 'N2'], ['Na', 'N2']] }],
    // 鎂
    ['Mg', '鎂', 650, 1091, 1.74, { ai: 473 }],
    ['MgO', '氧化鎂', 2852, 3600, 3.58],
    ['Mg(OH)2', '氫氧化鎂', I, I, 2.34, { dec: [332, ['MgO', 'H2O'], ['MgO', 'H2O']] }],
    ['MgCl2', '氯化鎂', 714, 1412, 2.32],
    ['MgBr2', '溴化鎂', 711, 1250, 3.72],
    ['MgCO3', '碳酸鎂', I, I, 2.96, { dec: [350, ['MgO', 'CO2'], ['MgO', 'CO2']] }],
    ['Mg(NO3)2', '硝酸鎂', I, I, 2.30, { dec: [330, ['MgO', 'NO2', 'O2'], ['MgO', 'NO2']] }],
    ['MgSO4', '硫酸鎂', 1124, I, 2.66],
    ['MgF2', '氟化鎂', 1263, 2260, 3.15],
    ['Mg(CH3COO)2', '乙酸鎂', I, I, 1.50, { dec: [323, ['MgO', '(CH3)2CO', 'CO2'], ['MgO', '(CH3)2CO']] }],
    ['Mg3N2', '氮化鎂', 1500, I, 2.71, { col: '#d6d27e' }],
    // 硫
    ['S', '硫', 115.2, 444.6, 2.07, { ai: 232, col: '#f2d43a' }],
    ['H2S', '硫化氫', -85.5, -60.3, 0.95, { ai: 232 }],
    ['SO2', '二氧化硫', -72.7, -10.0, 1.46],
    ['SO3', '三氧化硫', 16.9, 45, 1.92, { dec: [700, ['SO2', 'O2'], ['SO2', 'O2']] }],
    ['H2SO4', '硫酸', 10.3, 337, 1.83, { dec: [450, ['SO3', 'H2O'], ['SO3', 'H2O']] }],
    ['CS2', '二硫化碳', -111.6, 46.2, 1.26, { ai: 90 }],
    // 氯
    ['Cl2', '氯氣', -101.5, -34.0, 1.56, { col: '#c4dd4c' }],
    ['HCl', '氯化氫', -114.2, -85.1, 1.19],
    // 鉀
    ['K', '鉀', 63.5, 759, 0.86],
    ['KOH', '氫氧化鉀', 406, 1327, 2.04],
    ['K2O', '氧化鉀', 740, I, 2.35],
    ['KCl', '氯化鉀', 770, 1420, 1.98],
    ['KBr', '溴化鉀', 734, 1435, 2.74],
    ['KI', '碘化鉀', 681, 1330, 3.12],
    ['KF', '氟化鉀', 858, 1502, 2.48],
    ['KNO3', '硝酸鉀', 334, I, 2.11, { dec: [400, ['KNO2', 'O2'], ['KNO2', 'O2']] }],
    ['KNO2', '亞硝酸鉀', 440, I, 1.92],
    ['KClO3', '氯酸鉀', 356, I, 2.32, { dec: [400, ['KCl', 'O2'], ['KCl', 'O2']] }],
    ['K2SO4', '硫酸鉀', 1069, 1689, 2.66],
    ['K2CO3', '碳酸鉀', 891, I, 2.43],
    ['KMnO4', '過錳酸鉀', I, I, 2.70, { dec: [240, ['K2MnO4', 'MnO2', 'O2'], ['K2MnO4', 'O2']], col: '#6b1d84' }],
    ['K2MnO4', '錳酸鉀', I, I, 2.78, { col: '#2f7d3a' }],
    // 鈣
    ['Ca', '鈣', 842, 1484, 1.55, { ai: 790 }],
    ['CaO', '氧化鈣', 2613, 2850, 3.34],
    ['Ca(OH)2', '氫氧化鈣', I, I, 2.21, { dec: [512, ['CaO', 'H2O'], ['CaO', 'H2O']] }],
    ['CaCO3', '碳酸鈣', I, I, 2.71, { dec: [825, ['CaO', 'CO2'], ['CaO', 'CO2']] }],
    ['CaCl2', '氯化鈣', 772, 1935, 2.15],
    ['CaBr2', '溴化鈣', 730, 1815, 3.35],
    ['CaF2', '氟化鈣', 1418, 2533, 3.18],
    ['CaSO4', '硫酸鈣', 1460, I, 2.96],
    ['CaSO3', '亞硫酸鈣', I, I, 2.50, { dec: [600, ['CaO', 'SO2'], ['CaO', 'SO2']] }],
    ['Ca(NO3)2', '硝酸鈣', I, I, 2.50, { dec: [500, ['CaO', 'NO2', 'O2'], ['CaO', 'NO2']] }],
    ['Ca(CH3COO)2', '乙酸鈣', I, I, 1.50, { dec: [160, ['CaCO3', '(CH3)2CO'], ['CaCO3', '(CH3)2CO']] }],
    ['CaC2', '碳化鈣', 2160, I, 2.22],
    ['CaH2', '氫化鈣', 816, I, 1.70],
    ['Ca3(PO4)2', '磷酸鈣', 1670, I, 3.14],
    ['Ca(ClO)2', '次氯酸鈣', I, I, 2.35, { dec: [175, ['CaCl2', 'O2'], ['CaCl2', 'O2']] }],
    ['CaCN2', '氰氨化鈣', 1340, I, 2.29],
    // 銨鹽
    ['NH4Cl', '氯化銨', I, I, 1.53, { dec: [338, ['NH3', 'HCl'], ['NH3', 'HCl']] }],
    ['NH4Br', '溴化銨', I, I, 2.43, { dec: [452, ['NH3', 'HBr'], ['NH3', 'HBr']] }],
    ['NH4NO3', '硝酸銨', 169.6, I, 1.73, { dec: [210, ['N2O', 'H2O'], ['N2O', 'H2O']] }],
    ['(NH4)2SO4', '硫酸銨', I, I, 1.77, { dec: [235, ['NH3', 'H2SO4'], ['NH3', 'H2SO4']], simp: true }],
    ['NH4F', '氟化銨', I, I, 1.01, { dec: [100, ['NH3', 'HF'], ['NH3', 'HF']] }],
    ['CH3COONH4', '乙酸銨', I, I, 1.17, { dec: [113, ['NH3', 'CH3COOH'], ['NH3', 'CH3COOH']] }],
    ['NH4HCO3', '碳酸氫銨', I, I, 1.59, { dec: [36, ['NH3', 'H2O', 'CO2'], ['NH3', 'CO2']] }],
    // 鋰
    ['Li', '鋰', 180.5, 1342, 0.53, { ai: 179 }],
    ['LiOH', '氫氧化鋰', 462, 924, 1.46],
    ['Li2O', '氧化鋰', 1438, 2600, 2.01],
    ['LiH', '氫化鋰', 688.7, I, 0.78],
    ['LiCl', '氯化鋰', 605, 1382, 2.07],
    ['LiBr', '溴化鋰', 552, 1265, 3.46],
    ['LiI', '碘化鋰', 469, 1171, 4.08],
    ['LiF', '氟化鋰', 845, 1676, 2.64],
    ['Li2CO3', '碳酸鋰', 723, I, 2.11],
    ['Li3N', '氮化鋰', 813, I, 1.27, { col: '#9c3b4a' }],
    ['LiNO3', '硝酸鋰', 255, I, 2.38, { dec: [600, ['Li2O', 'NO2', 'O2'], ['Li2O', 'NO2']] }],
    ['Li2SO4', '硫酸鋰', 859, I, 2.22],
    ['LiAlH4', '氫化鋁鋰', I, I, 0.92],
    // 硼
    ['B', '硼', 2076, 3927, 2.34, { col: '#5a4a44' }],
    ['B2O3', '三氧化二硼', 450, 1860, 2.46],
    ['H3BO3', '硼酸', 170.9, I, 1.44, { dec: [300, ['B2O3', 'H2O'], ['B2O3', 'H2O']] }],
    ['BCl3', '三氯化硼', -107.3, 12.6, 1.35],
    ['B2H6', '二硼烷', -164.9, -92.5, 0.45, { ai: 38 }],
    ['H3NBF3', '氨－三氟化硼', 163, I, 1.86, { disp: 'H3N·BF3' }],
    // 鋁
    ['Al', '鋁', 660.3, 2470, 2.70],
    ['Al2O3', '氧化鋁', 2072, 2977, 3.95],
    ['Al(OH)3', '氫氧化鋁', I, I, 2.42, { dec: [300, ['Al2O3', 'H2O'], ['Al2O3', 'H2O']] }],
    ['AlCl3', '氯化鋁', 180, 180, 2.48],
    ['AlBr3', '溴化鋁', 97.5, 255, 3.20],
    ['AlI3', '碘化鋁', 188.3, 382, 3.98],
    ['Al2(SO4)3', '硫酸鋁', I, I, 2.67, { dec: [770, ['Al2O3', 'SO3'], ['Al2O3', 'SO3']] }],
    ['Al4C3', '碳化鋁', 2100, I, 2.36, { col: '#c9b27a' }],
    // 矽
    ['Si', '矽', 1414, 3265, 2.33, { col: '#6f7a86' }],
    ['SiO2', '二氧化矽', 1713, 2950, 2.65],
    ['SiH4', '矽烷', -185, -111.9, 0.68, { ai: 21 }],
    ['SiCl4', '四氯化矽', -68.7, 57.6, 1.48],
    // 磷
    ['P4', '白磷', 44.1, 280.5, 1.82, { ai: 34, dec: [250, ['P'], ['P', 'P']] }],
    ['P', '紅磷', 416, 416, 2.34, { ai: 260, col: '#a33a2a' }],
    ['P4O10', '十氧化四磷', 360, 360, 2.39],
    ['H3PO4', '磷酸', 42.4, 213, 1.88],
    ['H3PO3', '亞磷酸', 73.6, I, 1.65, { dec: [200, ['H3PO4', 'PH3'], ['H3PO4', 'PH3']] }],
    ['PCl3', '三氯化磷', -93.6, 76.1, 1.57],
    ['PCl5', '五氯化磷', 160, 160, 2.10],
    ['PH3', '膦', -132.8, -87.7, 0.75, { ai: 38 }],
    // 錳
    ['Mn', '錳', 1246, 2061, 7.21],
    ['MnO2', '二氧化錳', I, I, 5.03, { dec: [535, ['Mn2O3', 'O2'], ['Mn2O3', 'O2']], col: '#2b2521' }],
    ['Mn2O3', '三氧化二錳', I, I, 4.50, { col: '#3d2b22' }],
    ['MnCl2', '氯化錳', 654, 1225, 2.98, { col: '#efb4c3' }],
    ['MnSO4', '硫酸錳', 710, I, 3.25, { col: '#f3cfd6' }],
    // 鐵
    ['Fe', '鐵', 1538, 2862, 7.87],
    ['Fe2O3', '氧化鐵', 1565, I, 5.24, { col: '#94371a' }],
    ['Fe3O4', '四氧化三鐵', 1597, I, 5.17, { col: '#2e2e2e' }],
    ['FeCl2', '氯化亞鐵', 677, 1023, 3.16, { col: '#a9d08f' }],
    ['FeCl3', '氯化鐵', 307.6, 316, 2.90, { col: '#b8732a' }],
    ['FeSO4', '硫酸亞鐵', I, I, 3.65, { dec: [680, ['Fe2O3', 'SO2', 'SO3'], ['Fe2O3', 'SO2']], col: '#c8e4b6' }],
    ['Fe2(SO4)3', '硫酸鐵', I, I, 3.10, { dec: [480, ['Fe2O3', 'SO3'], ['Fe2O3', 'SO3']], col: '#ecd88a' }],
    ['Fe(OH)2', '氫氧化亞鐵', I, I, 3.40, { col: '#d0e6c4' }],
    ['Fe(OH)3', '氫氧化鐵', I, I, 3.40, { dec: [200, ['Fe2O3', 'H2O'], ['Fe2O3', 'H2O']], col: '#a24f26' }],
    ['FeS', '硫化亞鐵', 1194, I, 4.84, { col: '#3a3430' }],
    // 銅
    ['Cu', '銅', 1084.6, 2562, 8.96, { col: '#c8743a' }],
    ['CuO', '氧化銅', 1326, I, 6.31, { col: '#1f1c1a' }],
    ['Cu2O', '氧化亞銅', 1232, 1800, 6.00, { col: '#a3281c' }],
    ['CuCl2', '氯化銅', 498, 993, 3.39, { col: '#45a88c' }],
    ['CuSO4', '硫酸銅', I, I, 3.60, { dec: [650, ['CuO', 'SO3'], ['CuO', 'SO3']], col: '#e7e5dc' }],
    ['CuSO4(H2O)5', '五水硫酸銅', I, I, 2.29, { dec: [110, ['CuSO4', 'H2O'], ['CuSO4', 'H2O']], col: '#1f6fdc', disp: 'CuSO4·5H2O' }],
    ['Cu(OH)2', '氫氧化銅', I, I, 3.37, { dec: [80, ['CuO', 'H2O'], ['CuO', 'H2O']], col: '#4a9be8' }],
    ['Cu(NO3)2', '硝酸銅', I, I, 3.05, { dec: [256, ['CuO', 'NO2', 'O2'], ['CuO', 'NO2']], col: '#2a63c9' }],
    ['CuS', '硫化銅', I, I, 4.76, { col: '#141414' }],
    // 鋅
    ['Zn', '鋅', 419.5, 907, 7.14],
    ['ZnO', '氧化鋅', 1975, I, 5.61],
    ['ZnCl2', '氯化鋅', 290, 732, 2.91],
    ['ZnSO4', '硫酸鋅', I, I, 3.54, { dec: [680, ['ZnO', 'SO3'], ['ZnO', 'SO3']] }],
    ['Zn(OH)2', '氫氧化鋅', I, I, 3.05, { dec: [125, ['ZnO', 'H2O'], ['ZnO', 'H2O']] }],
    ['ZnS', '硫化鋅', 1850, I, 4.09],
    // 溴、碘
    ['Br2', '溴', -7.2, 58.8, 3.10, { col: '#8e2410' }],
    ['HBr', '溴化氫', -86.9, -66.8, 2.17],
    ['I2', '碘', 113.7, 184.3, 4.93, { col: '#2c1838', colg: '#a855f7' }],
    ['HI', '碘化氫', -50.8, -35.4, 2.85],
    // 銀
    ['Ag', '銀', 961.8, 2162, 10.49, { col: '#d9dde3' }],
    ['AgNO3', '硝酸銀', 209.7, I, 4.35, { dec: [440, ['Ag', 'NO2', 'O2'], ['Ag', 'NO2']] }],
    ['AgCl', '氯化銀', 455, 1547, 5.56, { col: '#f2f2ec', pho: [['Ag', 'Cl2'], ['Ag', 'Cl2']] }],
    ['AgBr', '溴化銀', 432, 1502, 6.47, { col: '#ede2a0', pho: [['Ag', 'Br2'], ['Ag', 'Br2']] }],
    ['AgI', '碘化銀', 558, 1506, 5.68, { col: '#efcf45', pho: [['Ag', 'I2'], ['Ag', 'I2']] }],
    ['Ag2O', '氧化銀', I, I, 7.14, { dec: [280, ['Ag', 'O2'], ['Ag', 'O2']], col: '#3b2b22' }],
    ['Ag2S', '硫化銀', 836, I, 7.23, { col: '#161616' }],
    ['Ag3PO4', '磷酸銀', 849, I, 6.37, { col: '#f0d040' }],
    // 鋇
    ['Ba', '鋇', 727, 1845, 3.51],
    ['BaO', '氧化鋇', 1923, 2000, 5.72],
    ['Ba(OH)2', '氫氧化鋇', 407, I, 3.74, { dec: [800, ['BaO', 'H2O'], ['BaO', 'H2O']] }],
    ['BaCl2', '氯化鋇', 962, 1560, 3.86],
    ['BaSO4', '硫酸鋇', 1580, I, 4.50, { col: '#fafafa' }],
    ['BaCO3', '碳酸鋇', 811, I, 4.29],
    ['Ba(NO3)2', '硝酸鋇', I, I, 3.24, { dec: [600, ['BaO', 'NO2', 'O2'], ['BaO', 'NO2']] }],
    ['BaO2', '過氧化鋇', 450, I, 4.96, { dec: [800, ['BaO', 'O2'], ['BaO', 'O2']] }],
  ];

  // ---------------------------------------------------------------- 電解（電解槽，選一欄）
  // ph：需要的物態（'l' 液態／熔融；null 不限）；minT：最低溫度
  const ELEC = {
    H2O: { ph: 'l', full: ['H2', 'O2'], keep: ['H2', 'O2'], note: '實際要加一點電解質（例如硫酸鈉）才導電' },
    NaCl: { ph: 'l', full: ['Na', 'Cl2'], keep: ['Na', 'Cl2'], note: '熔融電解（當斯法）' },
    KCl: { ph: 'l', full: ['K', 'Cl2'], keep: ['K', 'Cl2'] },
    LiCl: { ph: 'l', full: ['Li', 'Cl2'], keep: ['Li', 'Cl2'] },
    MgCl2: { ph: 'l', full: ['Mg', 'Cl2'], keep: ['Mg', 'Cl2'], note: '工業上製鎂的方法' },
    CaCl2: { ph: 'l', full: ['Ca', 'Cl2'], keep: ['Ca', 'Cl2'] },
    ZnCl2: { ph: 'l', full: ['Zn', 'Cl2'], keep: ['Zn', 'Cl2'] },
    CuCl2: { ph: null, full: ['Cu', 'Cl2'], keep: ['Cu', 'Cl2'], note: '水溶液電解，陰極析出銅' },
    NaOH: { ph: 'l', full: ['Na', 'O2', 'H2O'], keep: ['Na', 'O2'], note: '1807 年戴維用這個方法第一次製得鈉' },
    KOH: { ph: 'l', full: ['K', 'O2', 'H2O'], keep: ['K', 'O2'], note: '戴維同年也用它製得鉀' },
    Al2O3: { ph: null, minT: 900, full: ['Al', 'O2'], keep: ['Al', 'O2'], note: '霍爾–埃魯法：實際溶在約 950 °C 的熔融冰晶石中電解' },
    HCl: { ph: 'l', full: ['H2', 'Cl2'], keep: ['H2', 'Cl2'] },
  };

  // ---------------------------------------------------------------- 反應
  // addRx(a, b, 產物, 留下(≤2), 條件, 類別, 說明, 選項)
  // 條件：'auto' 相鄰就反應 | 數字 = 至少要這個溫度 | 'burn' 火花，或溫度 ≥ a 的自燃溫度 | 'spark' 只有火花（放電）
  //       'uv' 只有紫外燈 | 'cat' 沒有觸媒就不會發生
  // 選項：cat:[觸媒, 溫度] 有這種觸媒時在這個溫度就會發生；via: b 是不被消耗的觸媒（方程式寫在箭頭上）
  function reactions(addRx, C) {
    const burn = (fuel, prods, keep, note) => addRx(fuel, 'O2', prods, keep, 'burn', '燃燒', note);
    // 燃燒
    burn('H2', ['H2O'], ['H2O', 'H2O']);
    burn('C', ['CO2'], ['CO2']);
    for (const f of ['CH4', 'C2H6', 'C2H4', 'C2H2', 'C3H8', 'C4H10', 'CH3OH', 'HCHO', 'HCOOH', 'CH3CHO', 'CH3COOH', 'C2H5OH', 'C6H6', '(CH3)2CO', 'CH3COOC2H5', '(C2H5)2O']) {
      burn(f, ['CO2', 'H2O'], ['CO2', 'H2O']);
    }
    burn('CO', ['CO2'], ['CO2', 'CO2']);
    addRx('NH3', 'O2', ['NO', 'H2O'], ['NO', 'H2O'], 'cat', '奧士華法', '鉑銠網上約 900 °C 把氨氧化成 NO，是製硝酸的第一步', { cat: ['Pt', 350] });
    burn('NH3', ['N2', 'H2O'], ['N2', 'H2O']);
    burn('N2H4', ['N2', 'H2O'], ['N2', 'H2O'], '聯氨是火箭燃料');
    burn('H2S', ['SO2', 'H2O'], ['SO2', 'H2O']);
    burn('S', ['SO2'], ['SO2']);
    burn('CS2', ['CO2', 'SO2'], ['CO2', 'SO2']);
    burn('CH3Cl', ['CO2', 'H2O', 'HCl'], ['CO2', 'HCl']);
    burn('Na', ['Na2O'], ['Na2O']);
    burn('Li', ['Li2O'], ['Li2O']);
    burn('Mg', ['MgO'], ['MgO', 'MgO'], '發出刺眼的白光');
    burn('Ca', ['CaO'], ['CaO', 'CaO']);
    burn('Al', ['Al2O3'], ['Al2O3']);
    burn('Fe', ['Fe3O4'], ['Fe3O4'], '鋼絲絨在純氧中燃燒，火星四射');
    burn('Zn', ['ZnO'], ['ZnO']);
    burn('B', ['B2O3'], ['B2O3']);
    burn('P4', ['P4O10'], ['P4O10'], '白磷在空氣中約 34 °C 就會自燃，所以要泡在水裡保存');
    burn('P', ['P4O10'], ['P4O10']);
    burn('PH3', ['P4O10', 'H2O'], ['P4O10', 'H2O']);
    burn('SiH4', ['SiO2', 'H2O'], ['SiO2', 'H2O'], '矽烷一接觸空氣就自燃');
    burn('B2H6', ['B2O3', 'H2O'], ['B2O3', 'H2O']);
    addRx('Mg', 'CO2', ['MgO', 'C'], ['MgO', 'C'], 'burn', '燃燒', '鎂在二氧化碳中也能燃燒');
    addRx('Mg', 'N2', ['Mg3N2'], ['Mg3N2'], 'burn', '燃燒', '鎂在空氣中燃燒時，也會生成一些氮化鎂');
    addRx('Al', 'Fe2O3', ['Al2O3', 'Fe'], ['Al2O3', 'Fe'], 'burn', '鋁熱反應', '溫度超過 2500 °C，生成熔融的鐵，用來焊接鐵軌');
    addRx('Al', 'MnO2', ['Al2O3', 'Mn'], ['Al2O3', 'Mn'], 'burn', '鋁熱反應', '用來冶煉錳等高熔點金屬');
    // 放電、紫外光
    addRx('N2', 'O2', ['NO'], ['NO', 'NO'], 'spark', '放電固氮', '閃電就是這樣固定空氣中的氮');
    addRx('O2', 'O2', ['O3'], ['O3', 'O3'], 'spark', '放電', '臭氧產生器的原理');
    addRx('H2', 'Cl2', ['HCl'], ['HCl', 'HCl'], 'uv', '光照化合', '氫氯混合氣照光會爆炸');
    addRx('CH4', 'Cl2', ['CH3Cl', 'HCl'], ['CH3Cl', 'HCl'], 'uv', '光照取代', '自由基連鎖反應');
    addRx('CH3Cl', 'Cl2', ['CH2Cl2', 'HCl'], ['CH2Cl2', 'HCl'], 'uv', '光照取代');
    addRx('CH2Cl2', 'Cl2', ['CHCl3', 'HCl'], ['CHCl3', 'HCl'], 'uv', '光照取代');
    addRx('CHCl3', 'Cl2', ['CCl4', 'HCl'], ['CCl4', 'HCl'], 'uv', '光照取代');
    addRx('CH4', 'Br2', ['CH3Br', 'HBr'], ['CH3Br', 'HBr'], 'uv', '光照取代');
    addRx('NO2', 'O2', ['NO', 'O3'], ['NO', 'O3'], 'uv', '光化學煙霧', '汽機車排出的 NO₂ 在陽光下產生臭氧');
    // 相鄰就反應：化合
    addRx('H2', 'F2', ['HF'], ['HF', 'HF'], 'auto', '化合', '氟和氫在黑暗、低溫下也會爆炸');
    for (const [m, x, p, k] of [['Na', 'Cl2', 'NaCl', 2], ['Na', 'F2', 'NaF', 2], ['K', 'Cl2', 'KCl', 2], ['Li', 'Cl2', 'LiCl', 2], ['Li', 'F2', 'LiF', 2], ['K', 'F2', 'KF', 2],
      ['Mg', 'F2', 'MgF2', 1], ['Ca', 'F2', 'CaF2', 1], ['Na', 'Br2', 'NaBr', 2], ['K', 'Br2', 'KBr', 2], ['B', 'F2', 'BF3', 1], ['Si', 'F2', 'SiF4', 1]]) {
      addRx(m, x, [p], k === 2 ? [p, p] : [p], 'auto', '化合');
    }
    addRx('Al', 'Br2', ['AlBr3'], ['AlBr3'], 'auto', '化合', '鋁片丟進溴裡會自己燃燒起來');
    addRx('Al', 'I2', ['AlI3'], ['AlI3'], 'auto', '化合', '實際要滴一滴水當觸媒，冒出紫色碘蒸氣');
    addRx('Li', 'N2', ['Li3N'], ['Li3N'], 'auto', '化合', '鋰是唯一在室溫就能和氮氣反應的金屬');
    addRx('P4', 'Cl2', ['PCl3'], ['PCl3'], 'auto', '化合');
    addRx('PCl3', 'Cl2', ['PCl5'], ['PCl5'], 'auto', '化合');
    addRx('NH3', 'BF3', ['H3NBF3'], ['H3NBF3'], 'auto', '路易斯酸鹼', 'NH₃ 提供孤對電子給缺電子的 BF₃');
    // 金屬、氫化物、碳化物、氮化物與水
    for (const [m, oh] of [['Li', 'LiOH'], ['Na', 'NaOH'], ['K', 'KOH'], ['Ca', 'Ca(OH)2'], ['Ba', 'Ba(OH)2']]) {
      addRx(m, 'H2O', [oh, 'H2'], [oh, 'H2'], 'auto', '金屬與水', m === 'K' ? '鉀遇水會燃起淡紫色火焰' : '');
    }
    addRx('Mg', 'H2O', ['MgO', 'H2'], ['MgO', 'H2'], 110, '金屬與水蒸氣');
    addRx('Fe', 'H2O', ['Fe3O4', 'H2'], ['Fe3O4', 'H2'], 900, '金屬與水蒸氣', '赤熱的鐵和水蒸氣反應');
    for (const [h, oh] of [['NaH', 'NaOH'], ['CaH2', 'Ca(OH)2'], ['LiH', 'LiOH']]) addRx(h, 'H2O', [oh, 'H2'], [oh, 'H2'], 'auto', '氫化物水解');
    addRx('LiAlH4', 'H2O', ['LiOH', 'Al(OH)3', 'H2'], ['Al(OH)3', 'H2'], 'auto', '氫化物水解', '有機化學常用的強還原劑，遇水劇烈反應');
    addRx('NaBH4', 'H2O', ['NaBO2', 'H2'], ['NaBO2', 'H2'], 'auto', '氫化物水解', '實際在中性水中很慢，加酸或觸媒才快');
    addRx('CaC2', 'H2O', ['C2H2', 'Ca(OH)2'], ['Ca(OH)2', 'C2H2'], 'auto', '電石水解', '電石燈的原理');
    addRx('Al4C3', 'H2O', ['Al(OH)3', 'CH4'], ['Al(OH)3', 'CH4'], 'auto', '碳化物水解');
    addRx('Mg3N2', 'H2O', ['Mg(OH)2', 'NH3'], ['Mg(OH)2', 'NH3'], 'auto', '氮化物水解');
    addRx('Li3N', 'H2O', ['LiOH', 'NH3'], ['LiOH', 'NH3'], 'auto', '氮化物水解');
    addRx('CaCN2', 'H2O', ['CaCO3', 'NH3'], ['CaCO3', 'NH3'], 'auto', '水解', '氰氨化鈣是早期的氮肥');
    // 氧化物與水
    for (const [o, oh] of [['Li2O', 'LiOH'], ['Na2O', 'NaOH'], ['K2O', 'KOH'], ['CaO', 'Ca(OH)2'], ['BaO', 'Ba(OH)2']]) addRx(o, 'H2O', [oh], o === 'CaO' || o === 'BaO' ? [oh] : [oh, oh], 'auto', '氧化物與水', o === 'CaO' ? '生石灰遇水放熱' : '');
    addRx('SO3', 'H2O', ['H2SO4'], ['H2SO4'], 'auto', '氧化物與水');
    addRx('P4O10', 'H2O', ['H3PO4'], ['H3PO4', 'H3PO4'], 'auto', '氧化物與水', '十氧化四磷是很強的乾燥劑');
    addRx('B2O3', 'H2O', ['H3BO3'], ['H3BO3', 'H3BO3'], 'auto', '氧化物與水');
    addRx('NO2', 'H2O', ['HNO3', 'NO'], ['HNO3', 'NO'], 'auto', '氧化物與水', '奧士華法製硝酸的最後一步');
    addRx('CuSO4', 'H2O', ['CuSO4(H2O)5'], ['CuSO4(H2O)5'], 'auto', '水合', '無水硫酸銅遇水由白變藍，用來檢驗水');
    // 五水硫酸銅（藍色晶體）溶在水裡就是硫酸銅溶液
    addRx('CuSO4(H2O)5', 'NaOH', ['Cu(OH)2', 'Na2SO4', 'H2O'], ['Cu(OH)2', 'Na2SO4'], 'auto', '沉澱', '藍色沉澱');
    addRx('CuSO4(H2O)5', 'KOH', ['Cu(OH)2', 'K2SO4', 'H2O'], ['Cu(OH)2', 'K2SO4'], 'auto', '沉澱', '藍色沉澱');
    addRx('CuSO4(H2O)5', 'BaCl2', ['BaSO4', 'CuCl2', 'H2O'], ['BaSO4', 'CuCl2'], 'auto', '沉澱', '白色沉澱：檢驗硫酸根');
    addRx('Fe', 'CuSO4(H2O)5', ['FeSO4', 'Cu', 'H2O'], ['FeSO4', 'Cu'], 'auto', '金屬置換', '鐵釘表面鍍上一層紅色的銅');
    addRx('Zn', 'CuSO4(H2O)5', ['ZnSO4', 'Cu', 'H2O'], ['ZnSO4', 'Cu'], 'auto', '金屬置換');
    addRx('Mg', 'CuSO4(H2O)5', ['MgSO4', 'Cu', 'H2O'], ['MgSO4', 'Cu'], 'auto', '金屬置換');
    addRx('HNCO', 'H2O', ['NH3', 'CO2'], ['NH3', 'CO2'], 'auto', '水解');
    // 鹵化物水解
    addRx('SiCl4', 'H2O', ['SiO2', 'HCl'], ['SiO2', 'HCl'], 'auto', '水解', '在潮濕空氣中冒白煙');
    addRx('BCl3', 'H2O', ['H3BO3', 'HCl'], ['H3BO3', 'HCl'], 'auto', '水解');
    addRx('PCl3', 'H2O', ['H3PO3', 'HCl'], ['H3PO3', 'HCl'], 'auto', '水解');
    addRx('PCl5', 'H2O', ['H3PO4', 'HCl'], ['H3PO4', 'HCl'], 'auto', '水解');
    addRx('B2H6', 'H2O', ['H3BO3', 'H2'], ['H3BO3', 'H2'], 'auto', '水解');
    // 氧化
    addRx('NO', 'O2', ['NO2'], ['NO2', 'NO2'], 'auto', '氧化', '無色的 NO 一碰到氧就變成紅棕色');
    addRx('O3', 'NO', ['NO2', 'O2'], ['O2', 'NO2'], 'auto', '氧化');
    addRx('FeCl2', 'Cl2', ['FeCl3'], ['FeCl3', 'FeCl3'], 'auto', '氧化');
    addRx('Fe(OH)2', 'O2', ['Fe2O3', 'H2O'], ['Fe2O3', 'H2O'], 'auto', '氧化', '白色的氫氧化亞鐵很快就變成紅褐色', { simp: true });
    addRx('Na2SO3', 'O2', ['Na2SO4'], ['Na2SO4'], 'auto', '氧化');
    addRx('Cu', 'O2', ['CuO'], ['CuO', 'CuO'], 350, '氧化', '紅色的銅加熱後變黑');
    addRx('BaO', 'O2', ['BaO2'], ['BaO2'], 350, '氧化', '布林法製氧：約 500 °C 吸氧、800 °C 放氧');
    addRx('H2S', 'Cl2', ['S', 'HCl'], ['S', 'HCl'], 'auto', '置換');
    addRx('H2S', 'Br2', ['S', 'HBr'], ['S', 'HBr'], 'auto', '置換');
    addRx('H2S', 'I2', ['S', 'HI'], ['S', 'HI'], 'auto', '置換');
    addRx('F2', 'H2O', ['HF', 'O2'], ['HF', 'O2'], 'auto', '氧化', '氟連水都能氧化');
    addRx('F2', 'CH4', ['CF4', 'HF'], ['CF4', 'HF'], 'auto', '氟化');
    addRx('F2', 'S', ['SF6'], ['SF6'], 'auto', '氟化');
    // 吸收酸性氣體
    addRx('NaOH', 'CO2', ['NaHCO3'], ['NaHCO3'], 'auto', '吸收二氧化碳');
    addRx('Ca(OH)2', 'CO2', ['CaCO3', 'H2O'], ['CaCO3', 'H2O'], 'auto', '石灰水變混濁');
    addRx('Ba(OH)2', 'CO2', ['BaCO3', 'H2O'], ['BaCO3', 'H2O'], 'auto', '吸收二氧化碳');
    addRx('LiOH', 'CO2', ['Li2CO3', 'H2O'], ['Li2CO3', 'H2O'], 'auto', '吸收二氧化碳', '太空船用氫氧化鋰吸收太空人呼出的 CO₂');
    addRx('KOH', 'CO2', ['K2CO3', 'H2O'], ['K2CO3', 'H2O'], 'auto', '吸收二氧化碳');
    addRx('CaO', 'CO2', ['CaCO3'], ['CaCO3'], 'auto', '化合');
    addRx('Na2O', 'CO2', ['Na2CO3'], ['Na2CO3'], 'auto', '化合');
    addRx('NaOH', 'SO2', ['Na2SO3', 'H2O'], ['Na2SO3', 'H2O'], 'auto', '吸收二氧化硫');
    addRx('CaO', 'SO2', ['CaSO3'], ['CaSO3'], 'auto', '排煙脫硫', '燃煤電廠用石灰吸收 SO₂');
    addRx('NaOH', 'H2S', ['Na2S', 'H2O'], ['Na2S', 'H2O'], 'auto', '酸鹼中和');
    addRx('Cl2', 'NaOH', ['NaCl', 'NaClO', 'H2O'], ['NaCl', 'NaClO'], 'auto', '製漂白水');
    addRx('Cl2', 'Ca(OH)2', ['CaCl2', 'Ca(ClO)2', 'H2O'], ['Ca(ClO)2', 'CaCl2'], 'auto', '製漂白粉');
    addRx('NaClO', 'HCl', ['NaCl', 'Cl2', 'H2O'], ['NaCl', 'Cl2'], 'auto', '產生氯氣', '千萬別把漂白水和酸性清潔劑混著用');
    addRx('Ca(ClO)2', 'HCl', ['CaCl2', 'Cl2', 'H2O'], ['CaCl2', 'Cl2'], 'auto', '產生氯氣');
    // 鹵素置換
    addRx('F2', 'NaCl', ['NaF', 'Cl2'], ['NaF', 'Cl2'], 'auto', '鹵素置換');
    for (const [x2, salt, ns, nx] of [['Cl2', 'NaBr', 'NaCl', 'Br2'], ['Cl2', 'KBr', 'KCl', 'Br2'], ['Cl2', 'NaI', 'NaCl', 'I2'], ['Cl2', 'KI', 'KCl', 'I2'],
      ['Br2', 'NaI', 'NaBr', 'I2'], ['Br2', 'KI', 'KBr', 'I2'], ['Cl2', 'HBr', 'HCl', 'Br2'], ['Cl2', 'HI', 'HCl', 'I2'], ['Br2', 'HI', 'HBr', 'I2'], ['Cl2', 'MgBr2', 'MgCl2', 'Br2']]) {
      addRx(x2, salt, [ns, nx], [ns, nx], 'auto', '鹵素置換', x2 === 'Cl2' && salt === 'MgBr2' ? '從海水提溴就是用氯氣把溴離子氧化' : '');
    }
    addRx('Na2S2O3', 'I2', ['NaI', 'Na2S4O6'], ['NaI', 'Na2S4O6'], 'auto', '碘滴定', '碘的紫色褪去，是碘滴定法的反應');
    addRx('Na2S2O3', 'HCl', ['NaCl', 'S', 'SO2', 'H2O'], ['S', 'SO2'], 'auto', '硫沉澱', '溶液慢慢變混濁，析出黃色的硫');
    addRx('Na2SO3', 'S', ['Na2S2O3'], ['Na2S2O3'], 110, '化合', '亞硫酸鈉溶液和硫一起煮沸');
    // 有機
    addRx('C2H4', 'Cl2', ['C2H4Cl2'], ['C2H4Cl2'], 'auto', '加成');
    addRx('C2H4', 'Br2', ['C2H4Br2'], ['C2H4Br2'], 'auto', '加成', '溴的紅棕色褪去：檢驗雙鍵');
    addRx('C2H4', 'HBr', ['C2H5Br'], ['C2H5Br'], 'auto', '加成');
    addRx('C6H6', 'Br2', ['C6H5Br', 'HBr'], ['C6H5Br', 'HBr'], 'cat', '取代', '鐵粉（變成 FeBr₃）當觸媒', { cat: ['Fe', 25] });
    addRx('C6H6', 'Cl2', ['C6H5Cl', 'HCl'], ['C6H5Cl', 'HCl'], 'cat', '取代', '鐵粉（變成 FeCl₃）當觸媒', { cat: ['Fe', 25] });
    addRx('C6H6', 'HNO3', ['C6H5NO2', 'H2O'], ['C6H5NO2', 'H2O'], 80, '硝化', '實際用濃硫酸當觸媒、約 50–60 °C');
    addRx('CH3COOH', 'C2H5OH', ['CH3COOC2H5', 'H2O'], ['CH3COOC2H5', 'H2O'], 'auto', '酯化', '實際要用濃硫酸當觸媒、加熱回流好幾個小時；遊戲簡化成相鄰就反應');
    addRx('CH3COOC2H5', 'NaOH', ['CH3COONa', 'C2H5OH'], ['CH3COONa', 'C2H5OH'], 'auto', '皂化');
    addRx('C2H5OH', 'C2H5OH', ['(C2H5)2O', 'H2O'], ['(C2H5)2O', 'H2O'], 110, '脫水', '實際用濃硫酸、約 140 °C');
    addRx('C2H5OH', 'Al2O3', ['C2H4', 'H2O'], ['C2H4', 'Al2O3'], 350, '脫水', '氧化鋁當觸媒，乙醇脫水成乙烯', { via: true });
    addRx('C2H5OH', 'CuO', ['CH3CHO', 'Cu', 'H2O'], ['CH3CHO', 'Cu'], 350, '氧化', '熱的黑色氧化銅變回紅色的銅');
    addRx('CH3OH', 'CuO', ['HCHO', 'Cu', 'H2O'], ['HCHO', 'Cu'], 350, '氧化');
    addRx('CH3Cl', 'NaOH', ['CH3OH', 'NaCl'], ['CH3OH', 'NaCl'], 80, '取代');
    addRx('CH3Br', 'NaOH', ['CH3OH', 'NaBr'], ['CH3OH', 'NaBr'], 80, '取代');
    addRx('CH3I', 'NaOH', ['CH3OH', 'NaI'], ['CH3OH', 'NaI'], 80, '取代');
    addRx('C2H5Br', 'NaOH', ['C2H5OH', 'NaBr'], ['C2H5OH', 'NaBr'], 80, '取代', 'S<sub>N</sub>2 反應');
    addRx('CH3OH', 'HI', ['CH3I', 'H2O'], ['CH3I', 'H2O'], 'auto', '取代');
    addRx('CH3OH', 'HBr', ['CH3Br', 'H2O'], ['CH3Br', 'H2O'], 80, '取代');
    addRx('C2H5OH', 'HBr', ['C2H5Br', 'H2O'], ['C2H5Br', 'H2O'], 80, '取代');
    addRx('HCOOH', 'H2SO4', ['CO', 'H2O'], ['CO', 'H2SO4'], 80, '脫水', '濃硫酸把甲酸脫水，實驗室製 CO', { via: true });
    addRx('NH3', 'CO2', ['CO(NH2)2', 'H2O'], ['CO(NH2)2', 'H2O'], 110, '尿素合成', '實際約 190 °C、高壓');
    addRx('N2H4', 'H2O2', ['N2', 'H2O'], ['N2', 'H2O'], 'auto', '氧化', '火箭推進劑組合');
    // 觸媒
    addRx('H2O2', 'MnO2', ['H2O', 'O2'], ['O2', 'MnO2'], 'auto', '催化分解', '二氧化錳只是觸媒，反應後還在', { via: true });
    addRx('H2O2', 'KI', ['H2O', 'O2'], ['O2', 'KI'], 'auto', '催化分解', '「大象牙膏」實驗', { via: true });
    addRx('KClO3', 'MnO2', ['KCl', 'O2'], ['KCl', 'MnO2'], 200, '催化分解', '加入二氧化錳，氯酸鉀在較低溫就放出氧氣', { via: true });
    addRx('N2', 'H2', ['NH3'], ['NH3', 'NH3'], 'cat', '哈伯法', '實際約 400–450 °C、200 大氣壓、鐵觸媒', { cat: ['Fe', 350] });
    addRx('SO2', 'O2', ['SO3'], ['SO3', 'SO3'], 'cat', '接觸法', '實際約 400–450 °C、V₂O₅ 觸媒', { cat: ['V2O5', 350] });
    addRx('C2H4', 'H2', ['C2H6'], ['C2H6'], 'cat', '氫化', '鎳觸媒', { cat: ['Ni', 110] });
    addRx('C2H2', 'H2', ['C2H4'], ['C2H4'], 'cat', '氫化', '實際常用林德拉鈀觸媒停在烯類', { cat: ['Ni', 110] });
    addRx('CO', 'H2', ['CH3OH'], ['CH3OH'], 350, '甲醇合成', '實際約 250 °C、高壓、銅鋅觸媒');
    addRx('CO', 'H2O', ['CO2', 'H2'], ['CO2', 'H2'], 350, '水煤氣轉移', '實際需觸媒');
    addRx('C2H4', 'H2O', ['C2H5OH'], ['C2H5OH'], 350, '乙烯水合', '實際約 300 °C、磷酸觸媒');
    addRx('CH3OH', 'CO', ['CH3COOH'], ['CH3COOH'], 350, '羰基化', '孟山都法，實際需銠觸媒');
    // 加熱化合
    addRx('H2S', 'SO2', ['S', 'H2O'], ['S', 'H2O'], 110, '克勞斯法', '實際約 200–350 °C，需觸媒');
    for (const [m, h, p, n] of [['Na', 'H2', 'NaH', 2], ['Ca', 'H2', 'CaH2', 1], ['Li', 'H2', 'LiH', 2]]) addRx(m, h, [p], n === 2 ? [p, p] : [p], 350, '化合');
    for (const [m, x, p] of [['Mg', 'Cl2', 'MgCl2'], ['Ca', 'Cl2', 'CaCl2'], ['Fe', 'Cl2', 'FeCl3'], ['Si', 'Cl2', 'SiCl4'], ['B', 'Cl2', 'BCl3'], ['Fe', 'S', 'FeS'], ['Zn', 'S', 'ZnS']]) addRx(m, x, [p], [p], 350, '化合');
    addRx('Cu', 'Cl2', ['CuCl2'], ['CuCl2'], 110, '化合');
    addRx('Al', 'Cl2', ['AlCl3'], ['AlCl3'], 110, '化合');
    addRx('H2', 'Br2', ['HBr'], ['HBr', 'HBr'], 350, '化合');
    addRx('H2', 'I2', ['HI'], ['HI', 'HI'], 350, '化合', '可逆反應，教科書上的化學平衡例子');
    addRx('CH3COONa', 'NaOH', ['CH4', 'Na2CO3'], ['Na2CO3', 'CH4'], 350, '脫羧', '實驗室製甲烷的方法');
    addRx('NaNO2', 'NH4Cl', ['N2', 'NaCl', 'H2O'], ['N2', 'NaCl'], 80, '製氮氣', '實驗室製氮氣的方法');
    addRx('NaCl', 'H2SO4', ['Na2SO4', 'HCl'], ['Na2SO4', 'HCl'], 200, '製氯化氫', '濃硫酸不揮發，把揮發性的 HCl 趕出來');
    addRx('CaF2', 'H2SO4', ['CaSO4', 'HF'], ['CaSO4', 'HF'], 200, '製氟化氫', '螢石加濃硫酸，工業製氫氟酸');
    addRx('NaNO3', 'H2SO4', ['Na2SO4', 'HNO3'], ['Na2SO4', 'HNO3'], 80, '製硝酸', '智利硝石加濃硫酸');
    addRx('BaO2', 'H2SO4', ['BaSO4', 'H2O2'], ['BaSO4', 'H2O2'], 'auto', '製過氧化氫', '早期製雙氧水的方法');
    addRx('KMnO4', 'HCl', ['KCl', 'MnCl2', 'Cl2', 'H2O'], ['MnCl2', 'Cl2'], 'auto', '製氯氣', '紫色褪去，冒出黃綠色氯氣');
    addRx('MnO2', 'HCl', ['MnCl2', 'Cl2', 'H2O'], ['MnCl2', 'Cl2'], 80, '製氯氣', '1774 年舍勒用這個反應發現氯');
    addRx('Cu', 'HNO3', ['Cu(NO3)2', 'NO2', 'H2O'], ['Cu(NO3)2', 'NO2'], 'auto', '氧化性酸', '濃硝酸，冒出紅棕色 NO₂');
    addRx('Ag', 'HNO3', ['AgNO3', 'NO2', 'H2O'], ['AgNO3', 'NO2'], 'auto', '氧化性酸');
    addRx('Cu', 'H2SO4', ['CuSO4', 'SO2', 'H2O'], ['CuSO4', 'SO2'], 110, '氧化性酸', '熱濃硫酸');
    addRx('Cu2O', 'H2SO4', ['Cu', 'CuSO4', 'H2O'], ['Cu', 'CuSO4'], 'auto', '自身氧化還原', 'Cu⁺ 在酸中歧化成 Cu 和 Cu²⁺');
    // 金屬置換
    for (const [m, salt, ns, nm] of [['Zn', 'CuSO4', 'ZnSO4', 'Cu'], ['Fe', 'CuSO4', 'FeSO4', 'Cu'], ['Mg', 'CuSO4', 'MgSO4', 'Cu'], ['Al', 'CuSO4', 'Al2(SO4)3', 'Cu'],
      ['Zn', 'CuCl2', 'ZnCl2', 'Cu'], ['Fe', 'CuCl2', 'FeCl2', 'Cu'], ['Al', 'CuCl2', 'AlCl3', 'Cu'], ['Cu', 'AgNO3', 'Cu(NO3)2', 'Ag'],
      ['Mg', 'ZnSO4', 'MgSO4', 'Zn'], ['Zn', 'FeSO4', 'ZnSO4', 'Fe'], ['Mg', 'FeSO4', 'MgSO4', 'Fe'], ['Zn', 'FeCl2', 'ZnCl2', 'Fe'], ['Mg', 'MnSO4', 'MgSO4', 'Mn']]) {
      addRx(m, salt, [ns, nm], [ns, nm], 'auto', '金屬置換', m === 'Cu' ? '銅線上長出閃亮的「銀樹」' : m === 'Fe' && salt === 'CuSO4' ? '鐵釘表面鍍上一層紅色的銅' : '');
    }
    addRx('Cu', 'FeCl3', ['CuCl2', 'FeCl2'], ['CuCl2', 'FeCl2'], 'auto', '氧化還原', '印刷電路板就是用氯化鐵蝕刻銅');
    addRx('Fe', 'FeCl3', ['FeCl2'], ['FeCl2', 'FeCl2'], 'auto', '氧化還原');
    // 還原（冶金）
    addRx('CuO', 'H2', ['Cu', 'H2O'], ['Cu', 'H2O'], 350, '還原', '黑色的氧化銅變回紅色的銅');
    addRx('CuO', 'CO', ['Cu', 'CO2'], ['Cu', 'CO2'], 350, '還原');
    addRx('CuO', 'C', ['Cu', 'CO2'], ['Cu', 'CO2'], 900, '還原');
    addRx('CuO', 'Cu', ['Cu2O'], ['Cu2O', 'Cu2O'], 900, '化合');
    addRx('Fe2O3', 'CO', ['Fe', 'CO2'], ['Fe', 'CO2'], 900, '高爐煉鐵');
    addRx('Fe2O3', 'H2', ['Fe', 'H2O'], ['Fe', 'H2O'], 900, '還原', '氫氣煉鐵，不排 CO₂');
    addRx('Fe2O3', 'C', ['Fe', 'CO2'], ['Fe', 'CO2'], 900, '還原');
    addRx('ZnO', 'C', ['Zn', 'CO'], ['Zn', 'CO'], 900, '還原');
    addRx('SiO2', 'Mg', ['Si', 'MgO'], ['Si', 'MgO'], 900, '還原');
    addRx('B2O3', 'Mg', ['B', 'MgO'], ['B', 'MgO'], 900, '還原', '莫瓦桑製硼的方法');
    addRx('SiO2', 'HF', ['SiF4', 'H2O'], ['SiF4', 'H2O'], 'auto', '蝕刻玻璃', '氫氟酸會腐蝕玻璃，所以要裝在塑膠瓶');
    addRx('SiO2', 'NaOH', ['Na2SiO3', 'H2O'], ['Na2SiO3', 'H2O'], 350, '酸鹼', '所以裝鹼液的玻璃瓶不能用玻璃塞');
    addRx('SiO2', 'Na2CO3', ['Na2SiO3', 'CO2'], ['Na2SiO3', 'CO2'], 900, '製玻璃');
    addRx('C', 'H2O', ['CO', 'H2'], ['CO', 'H2'], 900, '水煤氣');
    addRx('CH4', 'H2O', ['CO', 'H2'], ['CO', 'H2'], 900, '蒸汽重組', '現在大部分的氫氣是這樣製造的');
    addRx('C', 'CO2', ['CO'], ['CO', 'CO'], 900, '布杜阿爾反應');
    addRx('C', 'S', ['CS2'], ['CS2'], 900, '化合');
    addRx('CaC2', 'N2', ['CaCN2', 'C'], ['CaCN2', 'C'], 900, '弗蘭克–卡羅法');
  }

  // ---------------------------------------------------------------- 自動產生：酸 × 鹼、複分解沉澱
  const ACIDS = [['HCl', 'Cl'], ['HBr', 'Br'], ['HI', 'I'], ['HNO3', 'NO3'], ['H2SO4', 'SO4'], ['HF', 'F'], ['CH3COOH', 'Ac'], ['H3PO4', 'PO4']];
  const SALT = {
    'Li|Cl': 'LiCl', 'Li|Br': 'LiBr', 'Li|I': 'LiI', 'Li|NO3': 'LiNO3', 'Li|SO4': 'Li2SO4', 'Li|F': 'LiF', 'Li|CO3': 'Li2CO3', 'Li|OH': 'LiOH',
    'Na|Cl': 'NaCl', 'Na|Br': 'NaBr', 'Na|I': 'NaI', 'Na|NO3': 'NaNO3', 'Na|SO4': 'Na2SO4', 'Na|F': 'NaF', 'Na|Ac': 'CH3COONa', 'Na|PO4': 'Na3PO4', 'Na|CO3': 'Na2CO3', 'Na|OH': 'NaOH', 'Na|S': 'Na2S',
    'K|Cl': 'KCl', 'K|Br': 'KBr', 'K|I': 'KI', 'K|NO3': 'KNO3', 'K|SO4': 'K2SO4', 'K|F': 'KF', 'K|CO3': 'K2CO3', 'K|OH': 'KOH',
    'Mg|Cl': 'MgCl2', 'Mg|Br': 'MgBr2', 'Mg|NO3': 'Mg(NO3)2', 'Mg|SO4': 'MgSO4', 'Mg|F': 'MgF2', 'Mg|Ac': 'Mg(CH3COO)2', 'Mg|OH': 'Mg(OH)2', 'Mg|CO3': 'MgCO3',
    'Ca|Cl': 'CaCl2', 'Ca|Br': 'CaBr2', 'Ca|NO3': 'Ca(NO3)2', 'Ca|SO4': 'CaSO4', 'Ca|F': 'CaF2', 'Ca|Ac': 'Ca(CH3COO)2', 'Ca|PO4': 'Ca3(PO4)2', 'Ca|OH': 'Ca(OH)2', 'Ca|CO3': 'CaCO3',
    'Ba|Cl': 'BaCl2', 'Ba|NO3': 'Ba(NO3)2', 'Ba|SO4': 'BaSO4', 'Ba|OH': 'Ba(OH)2', 'Ba|CO3': 'BaCO3',
    'Al|Cl': 'AlCl3', 'Al|Br': 'AlBr3', 'Al|I': 'AlI3', 'Al|SO4': 'Al2(SO4)3', 'Al|OH': 'Al(OH)3',
    'Zn|Cl': 'ZnCl2', 'Zn|SO4': 'ZnSO4', 'Zn|OH': 'Zn(OH)2', 'Zn|S': 'ZnS',
    'Fe2|Cl': 'FeCl2', 'Fe2|SO4': 'FeSO4', 'Fe2|OH': 'Fe(OH)2', 'Fe2|S': 'FeS',
    'Fe3|Cl': 'FeCl3', 'Fe3|SO4': 'Fe2(SO4)3', 'Fe3|OH': 'Fe(OH)3',
    'Cu|Cl': 'CuCl2', 'Cu|SO4': 'CuSO4', 'Cu|NO3': 'Cu(NO3)2', 'Cu|OH': 'Cu(OH)2', 'Cu|S': 'CuS',
    'Mn|Cl': 'MnCl2', 'Mn|SO4': 'MnSO4',
    'Ag|Cl': 'AgCl', 'Ag|Br': 'AgBr', 'Ag|I': 'AgI', 'Ag|NO3': 'AgNO3', 'Ag|PO4': 'Ag3PO4', 'Ag|S': 'Ag2S',
    'H|Cl': 'HCl', 'H|Br': 'HBr', 'H|I': 'HI', 'H|NO3': 'HNO3', 'H|SO4': 'H2SO4', 'H|F': 'HF', 'H|PO4': 'H3PO4',
    'NH4|Cl': 'NH4Cl', 'NH4|Br': 'NH4Br', 'NH4|NO3': 'NH4NO3', 'NH4|SO4': '(NH4)2SO4', 'NH4|F': 'NH4F', 'NH4|Ac': 'CH3COONH4',
  };
  // 鹼性物質：[物質, 陽離子, 類型]
  const BASES = [
    ['LiOH', 'Li', 'oh'], ['NaOH', 'Na', 'oh'], ['KOH', 'K', 'oh'], ['Mg(OH)2', 'Mg', 'oh'], ['Ca(OH)2', 'Ca', 'oh'], ['Ba(OH)2', 'Ba', 'oh'],
    ['Al(OH)3', 'Al', 'oh'], ['Zn(OH)2', 'Zn', 'oh'], ['Fe(OH)2', 'Fe2', 'oh'], ['Fe(OH)3', 'Fe3', 'oh'], ['Cu(OH)2', 'Cu', 'oh'],
    ['Li2O', 'Li', 'ox'], ['Na2O', 'Na', 'ox'], ['K2O', 'K', 'ox'], ['MgO', 'Mg', 'ox'], ['CaO', 'Ca', 'ox'], ['BaO', 'Ba', 'ox'],
    ['Al2O3', 'Al', 'ox'], ['ZnO', 'Zn', 'ox'], ['CuO', 'Cu', 'ox'], ['Fe2O3', 'Fe3', 'ox'], ['Ag2O', 'Ag', 'ox'],
    ['Li', 'Li', 'metal'], ['Na', 'Na', 'metal'], ['K', 'K', 'metal'], ['Mg', 'Mg', 'metal'], ['Ca', 'Ca', 'metal'], ['Ba', 'Ba', 'metal'],
    ['Al', 'Al', 'metal'], ['Zn', 'Zn', 'metal'], ['Fe', 'Fe2', 'metal'], ['Mn', 'Mn', 'metal'],
    ['Li2CO3', 'Li', 'co3'], ['Na2CO3', 'Na', 'co3'], ['NaHCO3', 'Na', 'co3'], ['K2CO3', 'K', 'co3'], ['CaCO3', 'Ca', 'co3'], ['MgCO3', 'Mg', 'co3'], ['BaCO3', 'Ba', 'co3'], ['NH4HCO3', 'NH4', 'co3'],
    ['Na2S', 'Na', 's'], ['FeS', 'Fe2', 's'], ['ZnS', 'Zn', 's'],
    ['Na2SO3', 'Na', 'so3'], ['CaSO3', 'Ca', 'so3'],
    ['NH3', 'NH4', 'nh3'],
  ];
  // 複分解：可溶的離子化合物 → [陽離子, 陰離子]
  const SOLUBLE = {
    NaOH: ['Na', 'OH'], KOH: ['K', 'OH'], LiOH: ['Li', 'OH'], 'Ba(OH)2': ['Ba', 'OH'], 'Ca(OH)2': ['Ca', 'OH'],
    NaCl: ['Na', 'Cl'], KCl: ['K', 'Cl'], LiCl: ['Li', 'Cl'], MgCl2: ['Mg', 'Cl'], CaCl2: ['Ca', 'Cl'], BaCl2: ['Ba', 'Cl'], AlCl3: ['Al', 'Cl'], ZnCl2: ['Zn', 'Cl'],
    FeCl2: ['Fe2', 'Cl'], FeCl3: ['Fe3', 'Cl'], CuCl2: ['Cu', 'Cl'], MnCl2: ['Mn', 'Cl'], NH4Cl: ['NH4', 'Cl'],
    NaBr: ['Na', 'Br'], KBr: ['K', 'Br'], LiBr: ['Li', 'Br'], MgBr2: ['Mg', 'Br'], CaBr2: ['Ca', 'Br'], NH4Br: ['NH4', 'Br'], NaI: ['Na', 'I'], KI: ['K', 'I'], LiI: ['Li', 'I'],
    NaNO3: ['Na', 'NO3'], KNO3: ['K', 'NO3'], LiNO3: ['Li', 'NO3'], 'Mg(NO3)2': ['Mg', 'NO3'], 'Ca(NO3)2': ['Ca', 'NO3'], 'Ba(NO3)2': ['Ba', 'NO3'], 'Cu(NO3)2': ['Cu', 'NO3'], AgNO3: ['Ag', 'NO3'], NH4NO3: ['NH4', 'NO3'],
    Na2SO4: ['Na', 'SO4'], K2SO4: ['K', 'SO4'], Li2SO4: ['Li', 'SO4'], MgSO4: ['Mg', 'SO4'], ZnSO4: ['Zn', 'SO4'], FeSO4: ['Fe2', 'SO4'], CuSO4: ['Cu', 'SO4'], MnSO4: ['Mn', 'SO4'],
    'Al2(SO4)3': ['Al', 'SO4'], 'Fe2(SO4)3': ['Fe3', 'SO4'], '(NH4)2SO4': ['NH4', 'SO4'],
    HCl: ['H', 'Cl'], HBr: ['H', 'Br'], HI: ['H', 'I'], HNO3: ['H', 'NO3'], H2SO4: ['H', 'SO4'],
    Na2CO3: ['Na', 'CO3'], K2CO3: ['K', 'CO3'], Na3PO4: ['Na', 'PO4'], Na2S: ['Na', 'S'], NaF: ['Na', 'F'], KF: ['K', 'F'], NH4F: ['NH4', 'F'],
  };
  const PRECIP = new Set(['AgCl', 'AgBr', 'AgI', 'Ag3PO4', 'Ag2S', 'BaSO4', 'BaCO3', 'CaCO3', 'Ca3(PO4)2', 'CaF2', 'MgF2', 'Mg(OH)2',
    'Cu(OH)2', 'Fe(OH)2', 'Fe(OH)3', 'Al(OH)3', 'Zn(OH)2', 'CuS', 'ZnS', 'FeS']);
  const PRECIP_NOTE = {
    AgCl: '白色沉澱：檢驗氯離子', AgBr: '淡黃色沉澱', AgI: '黃色沉澱', Ag3PO4: '黃色沉澱', BaSO4: '白色沉澱：檢驗硫酸根',
    'Cu(OH)2': '藍色沉澱', 'Fe(OH)3': '紅褐色沉澱：檢驗 Fe³⁺', 'Fe(OH)2': '白色沉澱，接觸空氣會變色', CaCO3: '白色沉澱', CuS: '黑色沉澱',
  };

  return { ELEMENTS, COLOR_PRIORITY, FLAME, ROWS, ELEC, reactions, ACIDS, SALT, BASES, SOLUBLE, PRECIP, PRECIP_NOTE };
})();
if (typeof module !== 'undefined') module.exports = NL_CHEM;
