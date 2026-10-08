// 走完教學 + 提示列 + 新元素開場，截圖
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');
const html = '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + fs.readFileSync(new URL('../dist/nightlab.html', import.meta.url), 'utf8') + '</body></html>';
fs.mkdirSync('/tmp/claude-0', { recursive: true });
fs.writeFileSync('/tmp/claude-0/nl.html', html);
const out = '/tmp/claude-0/tut';
fs.mkdirSync(out, { recursive: true });
const exe = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find((p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
for (const [name, w, hgt, dpr, touch] of [['tab', 1280, 720, 2, false], ['phone', 412, 860, 2.6, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: dpr, hasTouch: touch });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file:///tmp/claude-0/nl.html');
  await page.waitForTimeout(400);
  const shot = (n) => page.screenshot({ path: `${out}/${name}-${n}.png` });
  const bubble = () => page.$eval('#tut', (e) => e.innerText.split('\n')[0]).catch(() => null);
  const log = [];
  log.push(await bubble()); await shot('1-goal');
  await page.click('#tutNext');
  log.push(await bubble()); await shot('2-select');
  // 先故意點錯（O3），應該被擋下
  await page.click('.cand[data-id="O3"]');
  const sel0 = await page.$eval('.cand.on', (e) => e.dataset.id).catch(() => null);
  log.push('點錯被擋: ' + (sel0 === null));
  await page.click('.cand[data-id="H2O"]');
  log.push(await bubble()); await shot('3-col1');
  // 點錯欄（第 5 欄）應該被擋
  await page.click('.badge >> nth=4');
  await page.waitForTimeout(300);
  log.push('錯欄被擋 tiles=' + await page.$$eval('.tile', (t) => t.length));
  await page.click('.badge >> nth=0'); await page.waitForTimeout(1300);
  log.push(await bubble()); await shot('4-again');
  await page.click('.cand[data-id="H2O"]'); log.push(await bubble());
  await page.click('.badge >> nth=1'); await page.waitForTimeout(1300);
  await page.click('.cand[data-id="H2O"]'); log.push(await bubble()); await shot('5-third');
  await page.click('.badge >> nth=2'); await page.waitForTimeout(2200);
  log.push(await bubble()); await shot('6-collected');
  log.push('分數 ' + await page.textContent('#score'));
  await page.click('#tutNext'); log.push(await bubble()); await shot('7-coach');
  await page.click('#tutNext');
  await page.waitForTimeout(200);
  log.push('提示列: ' + await page.textContent('#coachText'));
  await shot('8-free');
  // 按示範
  await page.click('#coachShow'); await page.waitForTimeout(200);
  log.push('示範後選取: ' + await page.$eval('.cand.on', (e) => e.dataset.id).catch(() => '無'));
  log.push('選取時提示: ' + (await page.textContent('#coachText')).slice(0, 40));
  await shot('9-show');
  // 自己玩到過關
  for (let k = 0; k < 16; k++) {
    if (await page.isVisible('#overlay')) break;
    if (!(await page.isVisible('#coach'))) { await page.waitForTimeout(1200); break; }
    if (await page.isVisible('#tip')) await page.click('#tipOk');
    if (!(await page.isVisible('#coachShow'))) { await page.keyboard.press('Escape'); await page.waitForTimeout(80); }
    if (!(await page.isVisible('#coachShow'))) { await page.click('#redraw'); await page.waitForTimeout(300); continue; }
    await page.click('#coachShow'); await page.waitForTimeout(100);
    const tool = await page.$('.pulse.tool, .pulse#heat, .pulse#cool');
    if (tool) { await tool.click(); await page.waitForTimeout(1800); continue; }
    const x = await page.evaluate(() => { const c = document.querySelector('.colpulse'); return c ? Math.round(parseFloat(c.style.left) / parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell'))) : 0; });
    await page.click(`.badge >> nth=${x}`); await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(900);
  await shot('10-clear');
  log.push('結算: ' + ((await page.textContent('#sheet').catch(() => '')) || '').slice(0, 60));
  if (await page.$('#clNext')) {
    await page.click('#clNext'); await page.waitForTimeout(300);
    await shot('11-intro');
    log.push('下一關說明: ' + (await page.textContent('#sheet')).slice(0, 60));
    await page.click('#liGo'); await page.waitForTimeout(400);
    await shot('12-level2');
    log.push('第二關提示泡泡: ' + (await page.isVisible('#tip')));
  }
  const docW = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(`== ${name} (docW ${docW}/${w})\n  ` + log.join('\n  ') + (errs.length ? '\n  ERR ' + errs.join(' | ') : '\n  no page errors'));
  await ctx.close();
}
await browser.close();
