/* 夜間實驗室 v2 — 故事模式關卡
 * 溫度段 index：0 −196 液態氮、1 −80 乾冰浴、2 0 冰浴、3 25 室溫、4 80 水浴、5 110 加熱板、6 200 油浴、7 350 本生燈、8 900 高溫爐
 * 關卡欄位：
 *   bag 元素袋比重（反應台從這裡抽原子）、tray 反應台格數、turns 回合、temps 可用溫度段、T 起始溫度
 *   tools 儀器次數、cats 可加入的觸媒、only 只能合成這些分子、hand 謎題關的固定手牌（不抽原子）、grid 預先擺好的燒杯（每欄由下往上）
 *   goals 過關條件（全部達成）：score 分數｜make 由反應做出｜collect 收集（相連收集或儀器）｜clear 清空（c：某物質）｜flames 焰色種類
 *   stars 第 2、3 顆星：turns 剩餘回合｜score｜chain 連鎖段數｜moves 步數｜unused 某工具沒用
 *   par 謎題最少步數（測試會驗證）
 */
const NL_LEVELS = (() => {
  'use strict';
  const RT = 3;
  const CHAPTERS = [
    {
      id: 1, title: '水與火', els: ['H', 'O', 'C'],
      note: '夜裡的實驗室只剩一盞鈉燈。先從最簡單的開始：水、氫、氧、碳。三個一樣的分子相連就會收集；溫度會讓物質熔化、沸騰、移動；一點火花，就能讓氫氣和甲烷燒起來。',
      levels: [
        { id: '1-1', title: '第一杯水', tut: true, brief: '把三個水分子連在一起，就會收集得分。', bag: { H: 5, O: 3 }, turns: 14, temps: [RT, 5], tools: { temp: 2, redraw: 2 }, goals: [{ t: 'score', n: 90 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 7 }] },
        { id: '1-2', title: '加熱板', brief: '加熱到 110 °C，水會變成水蒸氣往上飄；氣體從杯頂往下堆。用溫度把分子湊在一起。', bag: { H: 5, O: 3 }, turns: 12, temps: [RT, 5], tools: { temp: 3, redraw: 2 }, goals: [{ t: 'score', n: 105 }], stars: [{ t: 'turns', n: 5 }, { t: 'chain', n: 2 }] },
        { id: '1-3', title: '第一把火', brief: '氫氣貼著氧氣，按「火花」就會燃燒成水。燃燒產生的水才算「做出」。', bag: { H: 5, O: 4 }, turns: 10, temps: [RT], tools: { spark: 3, redraw: 1 }, only: ['H2', 'O2', 'H2O'], goals: [{ t: 'make', c: 'H2O', n: 6 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 5 }] },
        { id: '1-4', title: '碳加入了', brief: '甲烷、甲醇、一氧化碳都能燒。分子越大越值錢。', bag: { H: 4, C: 2, O: 3 }, tray: 8, turns: 12, temps: [RT, 5], tools: { temp: 3, spark: 2, redraw: 2 }, goals: [{ t: 'score', n: 85 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 7 }] },
        { id: '1-5', title: '乾冰', kind: 'limit', brief: '反應台只有 5 格，沒有火。二氧化碳在室溫是氣體；冷到 −80 °C 會變成乾冰沉到杯底。', bag: { H: 1, C: 3, O: 5 }, tray: 5, turns: 12, temps: [1, RT], tools: { temp: 3, redraw: 2 }, only: ['CO2', 'CO', 'O2', 'H2O', 'CH4'], goals: [{ t: 'collect', c: 'CO2', n: 6 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 5 }] },
        { id: '1-6', title: '燃燒', brief: '燒出二氧化碳。一氧化碳燒一次就有兩份 CO₂。', bag: { H: 3, C: 3, O: 4 }, tray: 8, turns: 12, temps: [RT], tools: { spark: 4, redraw: 2 }, only: ['CH4', 'CO', 'O2', 'H2', 'H2O'], goals: [{ t: 'make', c: 'CO2', n: 4 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 6 }] },
        { id: '1-7', title: '一根火柴', kind: 'puzzle', brief: '謎題：手上只有一個甲烷、一個氧氣和一次火花。讓燒杯清空。', hand: ['CH4', 'O2'], turns: 2, temps: [RT], tools: { spark: 1, undo: 9 },
          grid: [['CO2', 'H2O'], ['CO2', 'H2O'], [], ['CO2'], [], [], []], goals: [{ t: 'clear' }], par: 3, stars: [{ t: 'moves', n: 3 }, { t: 'unused', k: 'undo' }] },
        { id: '1-8', title: '第一章關主', kind: 'boss', brief: '綜合題：分數要夠，也要燒出二氧化碳。', bag: { H: 4, C: 2, O: 3 }, tray: 9, turns: 16, temps: [1, RT, 5], tools: { temp: 4, spark: 3, redraw: 2 }, goals: [{ t: 'score', n: 100 }, { t: 'make', c: 'CO2', n: 2 }], stars: [{ t: 'turns', n: 7 }, { t: 'turns', n: 9 }] },
      ],
    },
    {
      id: 2, title: '酸與鹼', els: ['N', 'Na', 'Cl'], need: 12,
      note: '鈉、氮、氯加入了。鈉丟進水裡會產生氫氧化鈉和氫氣；酸碰到鹼就中和成鹽和水；氨遇到氯化氫冒出白煙。這一章也會用到水浴、乾燥管和第一個觸媒。',
      levels: [
        { id: '2-1', title: '鈉遇水', brief: '把鈉放在水旁邊，會生成氫氧化鈉和氫氣。', bag: { H: 4, O: 3, Na: 2 }, turns: 10, temps: [RT], tools: { redraw: 2 }, goals: [{ t: 'make', c: 'NaOH', n: 5 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 5 }] },
        { id: '2-2', title: '液態氯', brief: '氯氣是氣體，碰不到杯底的鈉。冷到 −80 °C，氯氣會液化掉下來，和鈉或氫氧化鈉反應成食鹽。', bag: { H: 3, O: 2, Na: 3, Cl: 3 }, tray: 8, turns: 12, temps: [1, RT], tools: { temp: 4, redraw: 2 }, only: ['Na', 'NaOH', 'Cl2', 'HCl', 'H2O', 'H2', 'O2', 'NaCl'], goals: [{ t: 'make', c: 'NaCl', n: 5 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 6 }] },
        { id: '2-3', title: '白煙', brief: '氨和氯化氫都是氣體，在杯頂相遇就產生氯化銨的白煙。', bag: { H: 5, N: 2, Cl: 2 }, tray: 8, turns: 12, temps: [RT], tools: { redraw: 2 }, only: ['NH3', 'HCl', 'H2', 'N2', 'Cl2', 'NH4Cl'], goals: [{ t: 'make', c: 'NH4Cl', n: 4 }], stars: [{ t: 'turns', n: 3 }, { t: 'turns', n: 4 }] },
        { id: '2-4', title: '小蘇打', brief: '碳酸氫鈉在 80 °C 的水浴就會分解出二氧化碳；遇到醋（乙酸）也會冒泡。', bag: { H: 3, C: 2, O: 5, Na: 2 }, tray: 8, turns: 12, temps: [RT, 4], tools: { temp: 3, redraw: 2 }, only: ['NaHCO3', 'CH3COOH', 'Na2CO3', 'H2O', 'NaOH', 'CO2', 'Na'], goals: [{ t: 'make', c: 'CO2', n: 4 }], stars: [{ t: 'turns', n: 5 }, { t: 'turns', n: 7 }] },
        { id: '2-5', title: '乾燥管', kind: 'limit', brief: '不能加熱，只有 10 回合。乾燥管會吸掉整杯的水。', bag: { H: 4, O: 3, Na: 2, Cl: 2 }, tray: 8, turns: 10, temps: [RT], tools: { dry: 2, redraw: 1 }, only: ['Na', 'NaOH', 'H2O', 'NaCl', 'H2', 'Cl2', 'HCl', 'O2', 'H2O2', 'NaClO'], goals: [{ t: 'score', n: 45 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 5 }] },
        { id: '2-6', title: '哈伯法', brief: '燒杯已經在 350 °C。讓氮氣貼著氫氣，加入鐵觸媒就會合成氨；沒有觸媒不會反應。', bag: { H: 5, N: 3, O: 1 }, tray: 8, turns: 12, temps: [RT, 7], T: 7, tools: { temp: 2, cat: 1, redraw: 2 }, cats: ['Fe'], only: ['N2', 'H2', 'H2O', 'O2'], goals: [{ t: 'make', c: 'NH3', n: 4 }], stars: [{ t: 'turns', n: 5 }, { t: 'turns', n: 7 }] },
        { id: '2-7', title: '鈉與火', kind: 'puzzle', brief: '謎題：用鈉、水、氧氣和一次火花，讓燒杯清空。', hand: ['Na', 'H2O', 'O2'], turns: 3, temps: [RT], tools: { spark: 1, undo: 9 },
          grid: [['NaOH', 'NaOH'], [], [], ['H2O'], [], [], []], goals: [{ t: 'clear' }], par: 4, stars: [{ t: 'moves', n: 4 }, { t: 'unused', k: 'undo' }] },
        { id: '2-8', title: '第二章關主', kind: 'boss', brief: '酸、鹼、鹽、氨，全部用上。', bag: { H: 4, C: 1, N: 2, O: 3, Na: 2, Cl: 2 }, tray: 10, turns: 16, temps: [1, RT, 4, 7], tools: { temp: 4, spark: 2, dry: 1, cat: 1, redraw: 3 }, cats: ['Fe'], goals: [{ t: 'score', n: 195 }, { t: 'make', c: 'NaCl', n: 2 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 8 }] },
      ],
    },
    {
      id: 3, title: '沉澱與顏色', els: ['S', 'K', 'Cu', 'Br', 'Ag', 'I', 'Ba'], need: 12,
      note: '這一章是顏色的實驗：白色的氯化銀、淡黃的溴化銀、黃色的碘化銀、藍色的氫氧化銅、紅棕色的溴、紫黑色的碘。過濾把沉澱留在濾紙上；白金絲沾一點樣品去燒，火焰的顏色會告訴你是哪種金屬。',
      levels: [
        { id: '3-1', title: '氯化銀', brief: '硝酸銀遇到含氯離子的物質，立刻生成白色的氯化銀沉澱。', bag: { Ag: 3, N: 2, O: 4, Na: 2, Cl: 2 }, tray: 9, turns: 12, temps: [RT], tools: { redraw: 2 }, only: ['AgNO3', 'NaCl', 'NaNO3', 'Ag', 'Na', 'NaOH', 'Cl2', 'O2'], goals: [{ t: 'make', c: 'AgCl', n: 4 }], stars: [{ t: 'turns', n: 3 }, { t: 'turns', n: 4 }] },
        { id: '3-2', title: '藍色沉澱', brief: '硫酸銅加氫氧化鈉，得到藍色的氫氧化銅。小心，它 80 °C 就會分解成黑色的氧化銅。', bag: { Cu: 2, S: 2, O: 5, Na: 2, H: 2 }, tray: 9, turns: 12, temps: [RT], tools: { redraw: 2 }, only: ['CuSO4', 'CuSO4(H2O)5', 'NaOH', 'Cu', 'Na2SO4', 'CuO', 'Na2O'], goals: [{ t: 'make', c: 'Cu(OH)2', n: 4 }], stars: [{ t: 'turns', n: 3 }, { t: 'turns', n: 4 }] },
        { id: '3-3', title: '過濾', brief: '硫酸鋇是白色沉澱。用過濾把一欄的固體全部濾出來收集。', bag: { Ba: 2, Cl: 2, Na: 2, S: 2, O: 5, H: 2 }, tray: 9, turns: 12, temps: [RT], tools: { filter: 3, redraw: 2 }, only: ['BaCl2', 'Na2SO4', 'H2SO4', 'NaCl', 'H2O'], goals: [{ t: 'collect', c: 'BaSO4', n: 2 }], stars: [{ t: 'turns', n: 5 }, { t: 'turns', n: 7 }] },
        { id: '3-4', title: '焰色', brief: '把含鋰、鈉、鉀、鈣、銅、鋇的物質放進燒杯，用「焰色反應」看火焰顏色。找出 3 種顏色。', bag: { Li: 1, Na: 2, K: 2, Ca: 1, Cu: 1, Ba: 1, Cl: 3 }, tray: 8, turns: 10, temps: [RT], tools: { flame: 4, redraw: 2 }, goals: [{ t: 'flames', n: 3 }], stars: [{ t: 'turns', n: 6 }, { t: 'unused', k: 'redraw' }] },
        { id: '3-5', title: '鹵素置換', brief: '活潑的鹵素把不活潑的鹵素趕出來：溴遇到碘化鉀放出紫黑色的碘；氯氣要冷到 −80 °C 液化才碰得到杯底的溴化鉀。', bag: { K: 3, Br: 2, I: 2, Cl: 2, Na: 1 }, tray: 8, turns: 12, temps: [1, RT], tools: { temp: 3, redraw: 2 }, only: ['Cl2', 'Br2', 'KBr', 'KI', 'NaBr', 'NaI', 'KCl', 'K'], goals: [{ t: 'make', c: 'I2', n: 3 }, { t: 'make', c: 'Br2', n: 2 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 5 }] },
        { id: '3-6', title: '鹵化銀', kind: 'limit', brief: '反應台只有 6 格、10 回合。白、淡黃、黃三種鹵化銀沉澱，湊到分數。', bag: { Ag: 2, N: 1, O: 3, K: 2, Cl: 1, Br: 1, I: 1 }, tray: 6, turns: 10, temps: [RT], tools: { filter: 1, redraw: 2 }, only: ['AgNO3', 'KCl', 'KBr', 'KI', 'KNO3', 'Ag', 'K', 'O2'], goals: [{ t: 'score', n: 35 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 8 }] },
        { id: '3-7', title: '濾紙', kind: 'puzzle', brief: '謎題：沉澱、相連收集、過濾，讓燒杯清空。', hand: ['AgNO3', 'AgNO3', 'Na2SO4'], turns: 3, temps: [RT], tools: { filter: 1, undo: 9 },
          grid: [[], ['Na2SO4', 'NaCl', 'NaCl'], [], ['Na2SO4', 'AgCl'], ['Na2SO4'], [], []], goals: [{ t: 'clear' }], par: 4, stars: [{ t: 'moves', n: 4 }, { t: 'unused', k: 'undo' }] },
        { id: '3-8', title: '第三章關主', kind: 'boss', brief: '白色的沉澱各做幾份，再湊到分數。', bag: { Ag: 2, Ba: 2, Cu: 1, Na: 2, Cl: 2, S: 2, O: 5, H: 1, N: 2 }, tray: 10, turns: 16, temps: [RT], tools: { filter: 2, flame: 2, redraw: 3 }, only: ['AgNO3', 'BaCl2', 'NaCl', 'Na2SO4', 'CuSO4', 'NaOH', 'H2O', 'CuCl2', 'NaNO3', 'Na', 'Cu'], goals: [{ t: 'make', c: 'AgCl', n: 2 }, { t: 'make', c: 'BaSO4', n: 2 }, { t: 'score', n: 250 }], stars: [{ t: 'turns', n: 1 }, { t: 'turns', n: 8 }] },
      ],
    },
    {
      id: 4, title: '分離與純化', els: ['C', 'Cl', 'Br'], need: 12,
      note: '有機實驗室的日常：反應做完，最花時間的是分離。蒸餾靠沸點、分液漏斗靠密度分層、迴旋濃縮在減壓下把溶劑抽乾、離心機讓重的東西沉下去。',
      levels: [
        { id: '4-1', title: '簡單蒸餾', brief: '選一欄蒸餾，沸點最低的液體會先被蒸出來收集。', bag: { C: 2, H: 5, O: 3 }, tray: 8, turns: 12, temps: [RT], tools: { distill: 4, redraw: 2 }, only: ['CH3OH', 'H2O', 'HCOOH', 'CH3COOH', 'H2O2', 'C2H5OH'], goals: [{ t: 'collect', c: 'CH3OH', n: 6 }], stars: [{ t: 'turns', n: 6 }, { t: 'turns', n: 7 }] },
        { id: '4-2', title: '迴旋濃縮', brief: '迴旋濃縮一次抽走整杯沸點低於 100 °C 的溶劑。先把溶劑裝滿，再一口氣抽乾。', bag: { C: 3, H: 5, O: 2, Cl: 2 }, tray: 9, turns: 12, temps: [RT], tools: { rotavap: 2, redraw: 2 }, only: ['CH2Cl2', 'CHCl3', 'CCl4', 'CH3OH', '(CH3)2CO', 'H2O', 'CH3COOH', 'C2H5OH'], goals: [{ t: 'score', n: 95 }], stars: [{ t: 'turns', n: 3 }, { t: 'turns', n: 5 }] },
        { id: '4-3', title: '酯化', brief: '乙酸和乙醇反應生成乙酸乙酯（有水果香）。', bag: { C: 3, H: 6, O: 2 }, tray: 12, turns: 12, temps: [RT], tools: { distill: 2, redraw: 2 }, only: ['CH3COOH', 'C2H5OH', 'H2O', 'CH3OH', 'HCOOH'], goals: [{ t: 'make', c: 'CH3COOC2H5', n: 4 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 5 }] },
        { id: '4-4', title: '分液漏斗', brief: '分液漏斗把一欄最上層和最下層的液體互換。把同樣的液體換到一起。', bag: { C: 2, H: 4, O: 2, Cl: 3 }, tray: 8, turns: 12, temps: [RT], tools: { funnel: 3, redraw: 2 }, only: ['CCl4', 'H2O', 'CHCl3', 'CH2Cl2', 'CH3OH', 'C6H6'],
          grid: [['CCl4', 'H2O'], ['H2O', 'CCl4'], ['CCl4', 'H2O'], [], [], [], []], goals: [{ t: 'score', n: 155 }], stars: [{ t: 'turns', n: 5 }, { t: 'chain', n: 2 }] },
        { id: '4-5', title: '溴水褪色', brief: '乙烯是氣體、溴是液體。加熱到 80 °C 讓溴沸騰變成蒸氣，和杯頂的乙烯相遇：紅棕色褪去，生成 1,2-二溴乙烷。', bag: { C: 2, H: 4, Br: 2 }, tray: 8, turns: 12, temps: [RT, 4], tools: { temp: 3, redraw: 2 }, only: ['C2H4', 'Br2', 'H2', 'HBr', 'C2H2', 'CH4'], goals: [{ t: 'make', c: 'C2H4Br2', n: 4 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 5 }] },
        { id: '4-6', title: '離心機', kind: 'limit', brief: '離心機讓一欄的固體和液體依密度重新排列：密度大的沉到底。只有 10 回合。', bag: { C: 2, H: 4, O: 2, Cl: 3 }, tray: 8, turns: 10, temps: [RT], tools: { centri: 3, redraw: 2 }, only: ['CCl4', 'H2O', 'CHCl3', 'CH2Cl2', 'CH3OH', 'C2H5OH', 'CH3COOH'],
          grid: [['CCl4', 'H2O'], ['H2O', 'CCl4'], ['H2O', 'CCl4'], [], [], [], []], goals: [{ t: 'score', n: 175 }], stars: [{ t: 'turns', n: 2 }, { t: 'chain', n: 2 }] },
        { id: '4-7', title: '分層', kind: 'puzzle', brief: '謎題：蒸餾一次、補兩個分子，讓燒杯清空。', hand: ['C6H6', 'H2O'], turns: 2, temps: [RT], tools: { distill: 1, funnel: 1, undo: 9 },
          grid: [['C6H6', 'C6H6'], ['CCl4'], ['C6H6', 'H2O'], [], ['H2O'], [], []], goals: [{ t: 'clear' }], par: 3, stars: [{ t: 'moves', n: 3 }, { t: 'unused', k: 'undo' }] },
        { id: '4-8', title: '第四章關主', kind: 'boss', brief: '合成、分離、純化：做出乙酸乙酯，再湊到分數。', bag: { C: 3, H: 6, O: 2, Cl: 1 }, tray: 12, turns: 16, temps: [RT, 4], tools: { temp: 3, distill: 2, rotavap: 1, funnel: 2, redraw: 3 }, only: ['CH3COOH', 'C2H5OH', 'H2O', 'CH3OH', 'CH2Cl2', 'CHCl3', '(CH3)2CO', 'HCOOH'], goals: [{ t: 'make', c: 'CH3COOC2H5', n: 2 }, { t: 'score', n: 390 }], stars: [{ t: 'turns', n: 11 }, { t: 'turns', n: 12 }] },
      ],
    },
    {
      id: 5, title: '電與光', els: ['Li', 'Mg', 'Al', 'Zn', 'Cu'], need: 12,
      note: '1807 年，戴維用電池電解熔融的氫氧化鉀，第一次看見鉀燃燒的紫色火焰。電能把化合物拆開，光也可以：紫外光能打斷氯分子，底片上的溴化銀照光就變成銀。',
      levels: [
        { id: '5-1', title: '電解水', brief: '選一欄電解：這一欄的水全部分解，氫氣留下、氧氣在陽極被收集。先把水疊高再電解比較划算。', bag: { H: 4, O: 2 }, turns: 10, temps: [RT], tools: { electro: 3, redraw: 2 }, only: ['H2O', 'H2', 'O2', 'H2O2'], goals: [{ t: 'make', c: 'H2', n: 6 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 5 }] },
        { id: '5-2', title: '熔融鹽', brief: '燒杯在 900 °C 的高溫爐裡，鹽都熔化了。電解熔融的氯化鈉或氯化鎂，在陽極收集氯氣。', bag: { Na: 2, Mg: 1, Cl: 3, K: 1 }, tray: 7, turns: 10, temps: [RT, 8], T: 8, tools: { temp: 2, electro: 3, redraw: 2 }, only: ['NaCl', 'MgCl2', 'KCl', 'Na', 'Mg', 'K', 'Cl2'], goals: [{ t: 'collect', c: 'Cl2', n: 6 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 5 }] },
        { id: '5-3', title: '紫外燈', brief: '甲烷和氯氣在紫外光下發生自由基取代，生成氯甲烷。', bag: { C: 2, H: 5, Cl: 3 }, tray: 7, turns: 10, temps: [RT], tools: { uv: 4, redraw: 2 }, only: ['CH4', 'Cl2', 'HCl', 'H2'], goals: [{ t: 'make', c: 'CH3Cl', n: 2 }], stars: [{ t: 'turns', n: 6 }, { t: 'turns', n: 7 }] },
        { id: '5-4', title: '底片', brief: '溴化銀照光會分解出銀，這就是傳統底片的原理。先做出溴化銀，再照光。', bag: { Ag: 2, N: 2, O: 3, K: 2, Br: 2 }, tray: 9, turns: 12, temps: [RT], tools: { uv: 3, redraw: 2 }, only: ['AgNO3', 'KBr', 'KNO3', 'Ag', 'K', 'Br2', 'O2'], goals: [{ t: 'make', c: 'Ag', n: 3 }], stars: [{ t: 'turns', n: 6 }, { t: 'turns', n: 7 }] },
        { id: '5-5', title: '金屬置換', brief: '比較活潑的金屬會把銅從銅鹽中置換出來：鐵釘泡硫酸銅，表面鍍上紅色的銅。', bag: { Zn: 2, Fe: 1, Cu: 2, S: 1, O: 4, Cl: 2 }, tray: 9, turns: 12, temps: [RT], tools: { redraw: 2 }, only: ['Zn', 'Fe', 'CuSO4', 'CuCl2', 'ZnSO4', 'Cu', 'ZnCl2', 'FeCl2'], goals: [{ t: 'make', c: 'Cu', n: 4 }], stars: [{ t: 'turns', n: 3 }, { t: 'turns', n: 4 }] },
        { id: '5-6', title: '氮化鋰', kind: 'limit', brief: '反應台 6 格、10 回合。氮化鋰遇水放出氨。', bag: { Li: 4, N: 2, H: 3, O: 2 }, tray: 6, turns: 10, temps: [RT], tools: { redraw: 2 }, only: ['Li3N', 'Li', 'H2O', 'LiOH', 'N2', 'H2', 'Li2O'], goals: [{ t: 'make', c: 'NH3', n: 2 }], stars: [{ t: 'turns', n: 3 }, { t: 'turns', n: 5 }] },
        { id: '5-7', title: '光與電', kind: 'puzzle', brief: '謎題：兩個水、一次電解、一次紫外燈，讓燒杯清空。', hand: ['H2O', 'H2O'], turns: 2, temps: [RT], tools: { uv: 1, electro: 1, undo: 9 },
          grid: [['Ag', 'Ag'], ['AgCl'], ['AgCl'], [], [], [], []], goals: [{ t: 'clear' }], par: 4, stars: [{ t: 'moves', n: 4 }, { t: 'unused', k: 'undo' }] },
        { id: '5-8', title: '第五章關主', kind: 'boss', brief: '電解、照光、置換，全部用上。', bag: { H: 3, O: 3, Na: 1, Cl: 2, Cu: 1, Zn: 1, S: 1, Ag: 1, Br: 1 }, tray: 10, turns: 16, temps: [RT, 8], tools: { temp: 2, electro: 3, uv: 2, redraw: 3 }, goals: [{ t: 'make', c: 'Cu', n: 2 }, { t: 'make', c: 'H2', n: 3 }, { t: 'score', n: 290 }], stars: [{ t: 'turns', n: 3 }, { t: 'turns', n: 6 }] },
      ],
    },
    {
      id: 6, title: '工業化學', els: ['Fe', 'Mn', 'Si', 'P', 'B'], need: 12,
      note: '最後一章，從燒杯走進工廠：接觸法製硫酸、奧士華法製硝酸、高爐煉鐵、鋁熱焊接。工業反應靠的是觸媒和高溫——還有一點點耐心。',
      levels: [
        { id: '6-1', title: '接觸法', brief: '燒杯在 350 °C。二氧化硫和氧氣在五氧化二釩觸媒上變成三氧化硫。', bag: { S: 2, O: 5, H: 2 }, tray: 8, turns: 12, temps: [RT, 7], T: 7, tools: { temp: 2, cat: 1, spark: 2, redraw: 2 }, cats: ['V2O5'], only: ['SO2', 'O2', 'H2O', 'H2S', 'S', 'H2'], goals: [{ t: 'make', c: 'SO3', n: 4 }], stars: [{ t: 'turns', n: 6 }, { t: 'turns', n: 7 }] },
        { id: '6-2', title: '奧士華法', brief: '燒杯在 350 °C。氨在鉑網上被氧化成 NO；NO 一碰到氧就變成紅棕色的 NO₂。', bag: { N: 2, H: 5, O: 4 }, tray: 8, turns: 12, temps: [RT, 7], T: 7, tools: { temp: 2, cat: 1, redraw: 2 }, cats: ['Pt'], only: ['NH3', 'O2', 'NO', 'NO2', 'H2O', 'N2', 'H2'], goals: [{ t: 'make', c: 'NO2', n: 6 }], stars: [{ t: 'turns', n: 6 }, { t: 'turns', n: 7 }] },
        { id: '6-3', title: '高爐', brief: '氧化鐵和焦炭在 900 °C 的高爐裡還原成鐵。', bag: { Fe: 3, O: 4, C: 3 }, tray: 8, turns: 12, temps: [RT, 8], tools: { temp: 3, spark: 2, redraw: 2 }, only: ['Fe2O3', 'C', 'CO', 'O2', 'CO2', 'Fe', 'Fe3O4'], goals: [{ t: 'make', c: 'Fe', n: 4 }], stars: [{ t: 'turns', n: 3 }, { t: 'turns', n: 4 }] },
        { id: '6-4', title: '鋁熱反應', brief: '鋁粉和氧化鐵點火，溫度超過 2500 °C，流出熔融的鐵。', bag: { Al: 2, Fe: 2, O: 3, Mn: 1 }, tray: 8, turns: 12, temps: [RT], tools: { spark: 4, redraw: 2 }, only: ['Al', 'Fe2O3', 'MnO2', 'Fe', 'O2', 'Mn', 'Fe3O4'], goals: [{ t: 'make', c: 'Fe', n: 4 }], stars: [{ t: 'turns', n: 4 }, { t: 'turns', n: 5 }] },
        { id: '6-5', title: '氫化', brief: '燒杯在 110 °C。乙烯和氫氣在鎳觸媒上加氫變成乙烷。', bag: { C: 3, H: 6 }, tray: 8, turns: 12, temps: [RT, 5], T: 5, tools: { temp: 2, cat: 1, redraw: 2 }, cats: ['Ni'], only: ['C2H4', 'H2', 'C2H2', 'CH4'], goals: [{ t: 'make', c: 'C2H6', n: 3 }], stars: [{ t: 'turns', n: 6 }, { t: 'turns', n: 7 }] },
        { id: '6-6', title: '膦', kind: 'limit', brief: '膦（PH₃）在 38 °C 就會自燃。燒杯在 80 °C，膦一碰到氧氣就燒起來，產生的十氧化四磷遇水變成磷酸。只有 10 回合。', bag: { P: 2, O: 4, H: 5 }, tray: 7, turns: 10, temps: [RT, 4], T: 4, tools: { temp: 2, redraw: 2 }, only: ['PH3', 'O2', 'H2O', 'H2', 'P4', 'O3'], goals: [{ t: 'make', c: 'H3PO4', n: 2 }], stars: [{ t: 'turns', n: 1 }, { t: 'turns', n: 3 }] },
        { id: '6-7', title: '布林法', kind: 'puzzle', brief: '謎題：過氧化鋇 800 °C 放出氧氣。只放一個分子，讓燒杯清空。', hand: ['BaO'], turns: 1, temps: [RT, 7, 8], tools: { temp: 2, undo: 9 },
          grid: [[], ['O2', 'BaO2'], ['BaO2'], [], [], [], []], goals: [{ t: 'clear' }], par: 3, stars: [{ t: 'moves', n: 3 }, { t: 'unused', k: 'undo' }] },
        { id: '6-8', title: '最終關', kind: 'boss', brief: '夜間實驗室的最後一夜：觸媒、高溫，做出鐵和三氧化硫，再湊到分數。', bag: { H: 2, O: 5, S: 2, Fe: 2, C: 2, Al: 1 }, tray: 11, turns: 18, temps: [RT, 7, 8], tools: { temp: 4, spark: 3, cat: 1, redraw: 3 }, cats: ['V2O5'], only: ['SO2', 'O2', 'SO3', 'H2O', 'Fe2O3', 'C', 'CO', 'Al', 'Fe', 'H2SO4', 'CO2', 'S'], goals: [{ t: 'make', c: 'Fe', n: 2 }, { t: 'make', c: 'SO3', n: 6 }, { t: 'score', n: 2000 }], stars: [{ t: 'turns', n: 3 }, { t: 'turns', n: 7 }] },
      ],
    },
  ];
  const ALL = CHAPTERS.flatMap((ch) => ch.levels.map((l) => ({ ...l, ch: ch.id })));
  const byId = (id) => ALL.find((l) => l.id === id);
  return { CHAPTERS, ALL, byId };
})();
if (typeof module !== 'undefined') module.exports = NL_LEVELS;
