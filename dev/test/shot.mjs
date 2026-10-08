// 截圖 + 自動點一局
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/home/claude/majsoul-hud/package.json');
const { chromium } = require('playwright');
const html = '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + fs.readFileSync(new URL('../dist/nightlab.html', import.meta.url), 'utf8') + '</body></html>';
fs.writeFileSync('/tmp/claude-0/nl.html', html);
const out = process.argv[2] || '/tmp/claude-0/shots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const sizes = [['tab-land', 1280, 720, 2], ['tab-port', 800, 1220, 2], ['phone', 412, 860, 2.6]];
for (const [name, w, h, dpr] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: name !== 'tab-land' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file:///tmp/claude-0/nl.html');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}-0-help.png` });
  await page.click('#helpGo');
  // 玩幾步：每次選第一個候選，放在預估分最高的欄
  for (let k = 0; k < 9; k++) {
    if (await page.isVisible('#overlay')) break;
    await page.click('.cand >> nth=0');
    await page.waitForTimeout(80);
    const best = await page.evaluate(() => { const b = [...document.querySelectorAll('.badge')]; let bi = 0, bv = -1; b.forEach((x, i) => { const v = parseInt(x.textContent.replace('+', '')) || 0; if (!x.classList.contains('full') && v > bv) { bv = v; bi = i; } }); return bi; });
    if (k === 3) await page.screenshot({ path: `${out}/${name}-1-select.png` });
    await page.click(`.badge >> nth=${best}`);
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${out}/${name}-2-play.png` });
  if (await page.isVisible('#overlay')) {
    await page.screenshot({ path: `${out}/${name}-2b-overlay.png` });
    const offer = await page.$('.offer');
    if (offer) { await offer.click(); await page.waitForTimeout(200); if (await page.$('.offer')) await page.click('.offer'); }
    else if (await page.$('#failRetry')) await page.click('#failRetry');
    await page.waitForTimeout(300);
    for (let k = 0; k < 6; k++) {
      await page.click('.cand >> nth=0'); await page.waitForTimeout(60);
      await page.click('.badge >> nth=' + (k % 7)); await page.waitForTimeout(1400);
      if (await page.isVisible('#overlay')) break;
    }
  }
  // 加熱一次
  if (!(await page.isVisible('#overlay')) && await page.isEnabled('#heat')) { await page.click('#heat'); await page.waitForTimeout(1800); }
  await page.screenshot({ path: `${out}/${name}-3-heat.png` });
  // 點一個分子看資料
  const t = (await page.isVisible('#overlay')) ? null : await page.$('.tile');
  if (t) { await t.click(); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/${name}-4-inspect.png` }); }
  const info = await page.evaluate(() => ({ score: document.querySelector('#score').textContent, turns: document.querySelector('#turns').textContent, tiles: document.querySelectorAll('.tile').length, docW: document.documentElement.scrollWidth, winW: innerWidth, cell: getComputedStyle(document.documentElement).getPropertyValue('--cell') }));
  console.log(name, JSON.stringify(info), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await ctx.close();
}
await browser.close();
