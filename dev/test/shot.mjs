// 截圖 + 自動點幾關：node test/shot.mjs [輸出資料夾]
// 檢查三種尺寸（平板橫、平板直、手機）沒有 JS 錯誤、沒有橫向捲動
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');
const tmp = '/tmp/claude-0';
fs.mkdirSync(tmp, { recursive: true });
const html = '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + fs.readFileSync(new URL('../dist/nightlab.html', import.meta.url), 'utf8') + '</body></html>';
fs.writeFileSync(tmp + '/nl.html', html);
const out = process.argv[2] || tmp + '/shots';
fs.mkdirSync(out, { recursive: true });
// 預裝的 Chromium（版本和 playwright 1.48 不同時用 executablePath）
const exe = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', '/opt/pw-browsers/chromium'].find((p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const sizes = [['tab-land', 1280, 720, 2], ['tab-port', 800, 1220, 2], ['phone', 412, 860, 2.6]];
// 已解鎖全部章節的存檔（給選關、後面章節截圖用）
const LV = require('./src/levels.js');
const stars = Object.fromEntries(LV.ALL.map((l) => [l.id, 2]));
const unlocked = JSON.stringify({ meta: { found: ['H2O', 'NaCl', 'AgCl', 'CuSO4'], rx: [], best: { level: 1, chain: 0 }, stars, scores: {}, slots: {}, tut: true, seen: { temp: 1 } }, mode: null });
let bad = 0;
for (const [name, w, hgt, dpr] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: dpr, hasTouch: name !== 'tab-land' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const shot = (n) => page.screenshot({ path: `${out}/${name}-${n}.png` });
  const hscroll = async (tag) => { const d = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (d[0] > d[1] + 1) { errs.push(`橫向捲動 ${tag} ${d}`); } };
  // 1. 第一次打開 → 1-1 教學
  await page.goto('file://' + tmp + '/nl.html');
  await page.waitForTimeout(500);
  await shot('01-tutorial'); await hscroll('tutorial');
  await page.click('#tutSkip').catch(() => {});
  // 2. 用提示玩 1-1 幾步
  for (let k = 0; k < 6; k++) {
    if (await page.isVisible('#overlay')) break;
    if (await page.isVisible('#tip')) await page.click('#tipOk');
    if (!(await page.isVisible('#coachShow'))) break;
    await page.click('#coachShow'); await page.waitForTimeout(80);
    const x = await page.evaluate(() => { const c = document.querySelector('.colpulse'); return c ? Math.round(parseFloat(c.style.left) / parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell'))) : -1; });
    if (x < 0) { const t = await page.$('.pulse.tool, .pulse#heat, .pulse#cool'); if (t) { await t.click(); await page.waitForTimeout(1500); continue; } break; }
    if (k === 2) await shot('02-select');
    await page.click(`.badge >> nth=${x}`); await page.waitForTimeout(1400);
  }
  await shot('03-play'); await hscroll('play');
  // 3. 解鎖全部，看主選單、選關、關卡說明
  await page.evaluate((s) => localStorage.setItem('nightlab.v2', s), unlocked);
  await page.reload(); await page.waitForTimeout(500);
  await shot('04-home'); await hscroll('home');
  await page.click('#mStory'); await page.waitForTimeout(200);
  await page.click('.chtabs button[data-ch="3"]'); await page.waitForTimeout(150);
  await shot('05-map'); await hscroll('map');
  await page.click('.lvcard[data-lv="3-3"]'); await page.waitForTimeout(150);
  await shot('06-intro');
  await page.click('#liGo'); await page.waitForTimeout(400);
  if (await page.isVisible('#tip')) await page.click('#tipOk');
  for (let k = 0; k < 5; k++) { if (await page.isVisible('#tip')) await page.click('#tipOk'); else break; }
  // 放幾個分子
  for (let k = 0; k < 5; k++) {
    if (await page.isVisible('#overlay')) break;
    while (await page.isVisible('#tip')) await page.click('#tipOk');
    await page.click('.cand >> nth=0'); await page.waitForTimeout(60);
    await page.click(`.badge >> nth=${k % 7}`); await page.waitForTimeout(1300);
  }
  // 過濾：選工具 → 選欄
  const f = await page.$('.tool[data-k="filter"]:not([disabled])');
  if (f) { await f.click(); await page.waitForTimeout(150); await shot('07-aim'); await page.click('.badge >> nth=0'); await page.waitForTimeout(1500); }
  await shot('08-tool'); await hscroll('tool');
  const t = (await page.isVisible('#overlay')) ? null : await page.$('.tile');
  if (t) { await t.click(); await page.waitForTimeout(200); await shot('09-inspect'); }
  // 4. 沙盒
  await page.click('#btnHome'); await page.waitForTimeout(150);
  await page.click('#mSand'); await page.waitForTimeout(300);
  await page.fill('#pickQ', 'Ag'); await page.waitForTimeout(150);
  await page.click('.cand[data-id="AgNO3"]'); await page.click('.badge >> nth=2'); await page.waitForTimeout(900);
  await page.fill('#pickQ', ''); await page.click('.pe[data-e="Na"]'); await page.waitForTimeout(150);
  await page.click('.cand[data-id="NaCl"]'); await page.click('.badge >> nth=2'); await page.waitForTimeout(1300);
  await page.click('.cand[data-id="NaCl"]'); await page.click('.badge >> nth=3'); await page.waitForTimeout(900);
  await page.click('.tool[data-k="uv"]'); await page.waitForTimeout(1500);
  await shot('10-sandbox'); await hscroll('sandbox');
  // 5. 無限挑戰
  await page.click('#btnHome'); await page.waitForTimeout(150);
  await page.click('#mEnd'); await page.waitForTimeout(300);
  await shot('11-endless'); await hscroll('endless');
  // 6. 圖鑑
  await page.click('#btnBook'); await page.waitForTimeout(150);
  await shot('12-book');
  const info = await page.evaluate(() => ({ docW: document.documentElement.scrollWidth, winW: innerWidth, cell: getComputedStyle(document.documentElement).getPropertyValue('--cell') }));
  console.log(name, JSON.stringify(info), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  if (errs.length) bad++;
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
