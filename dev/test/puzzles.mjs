// 謎題關：在瀏覽器裡跟著「示範」走完六個謎題（先跑 node test/shot.mjs 產生 /tmp/claude-0/nl.html）
import { createRequire } from 'module';
const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');
const LV = require('./src/levels.js');
const stars = Object.fromEntries(LV.ALL.map((l) => [l.id, 2]));
const save = JSON.stringify({ meta: { found: [], rx: [], best: { level: 1 }, stars, scores: {}, slots: {}, tut: true, seen: { temp: 1, hand: 1, 'tool-spark': 1, 'tool-filter': 1, 'tool-uv': 1, 'tool-electro': 1, 'tool-distill': 1, 'tool-funnel': 1, 'tool-temp': 1 } }, mode: null });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
for (const id of ['1-7', '2-7', '3-7', '4-7', '5-7', '6-7']) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, hasTouch: true });
  await ctx.route(/fonts\./, (r) => r.abort());
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file:///tmp/claude-0/nl.html'); await page.evaluate((s) => localStorage.setItem('nightlab.v2', s), save); await page.reload(); await page.waitForTimeout(300);
  await page.click('#mStory'); await page.click(`.chtabs button[data-ch="${id[0]}"]`); await page.click(`.lvcard[data-lv="${id}"]`); await page.click('#liGo'); await page.waitForTimeout(300);
  for (let k = 0; k < 14; k++) {
    while (await page.isVisible('#tip')) await page.click('#tipOk');
    if (await page.isVisible('#overlay')) break;
    if (!(await page.isVisible('#coachShow'))) { await page.waitForTimeout(1500); continue; }
    await page.click('#coachShow'); await page.waitForTimeout(100);
    const x = await page.evaluate(() => { const c = document.querySelector('.colpulse'); return c ? Math.round(parseFloat(c.style.left) / parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell'))) : -1; });
    const tool = await page.$('.pulse.tool, .pulse#heat, .pulse#cool');
    if (tool) { await tool.click(); await page.waitForTimeout(200); if (x >= 0) await page.click(`.badge >> nth=${x}`); await page.waitForTimeout(1600); continue; }
    if (x >= 0) { await page.click(`.badge >> nth=${x}`); await page.waitForTimeout(1600); }
  }
  await page.waitForTimeout(900);
  const t = (await page.textContent('#sheet').catch(() => '')).replace(/\s+/g, ' ').slice(0, 30);
  
  console.log(id, t, errs.join('|') || 'ok');
  await ctx.close();
}
await browser.close();
