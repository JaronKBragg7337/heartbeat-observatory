// Turkey Trouble: look at the LIVE site the way a phone does (WebKit, 375 x 812, touch) and save pictures.
//   node build/live_check.mjs [site origin]
// Saves: the games page scrolled to the Turkey Trouble tile, the artifacts page, and the game's title screen.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import fs from 'node:fs';

const site = (process.argv[2] || 'https://heartbeatobservatory.com').replace(/\/$/, '');
const OUT = process.env.TT_SHOTS_DIR || 'C:/Users/lilli/Projects/turkey-work/shots/live';
fs.mkdirSync(OUT, { recursive: true });
let pw = null;
for (const root of [import.meta.url, 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/', 'C:/Users/lilli/AI-Shared/tools/site-reel/node_modules/']) {
  for (const name of ['playwright', 'playwright-core']) {
    try { pw = createRequire(root)(name); break; } catch { /* next */ }
  }
  if (pw) break;
}
if (!pw) { console.log('NOT RUN: Playwright was not found'); process.exit(2); }
const browsers = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
const kits = fs.existsSync(browsers) ? fs.readdirSync(browsers).filter((d) => /^webkit-\d+$/.test(d)).sort() : [];
let browser = null;
for (const kit of [null, ...kits.slice().reverse()]) {
  try { browser = await pw.webkit.launch(kit ? { headless: true, executablePath: join(browsers, kit, 'Playwright.exe') } : { headless: true }); break; } catch { /* next */ }
}
if (!browser) { console.log('NOT RUN: no WebKit build started'); process.exit(2); }
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
let bad = 0;
async function step(name, fn) {
  try { console.log(name + ':', await fn()); } catch (e) { bad += 1; console.log(name + ': FAILED', String(e).split('\n')[0].slice(0, 300)); }
}
await step('games page tile', async () => {
  await page.goto(site + '/games/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const link = page.locator('a[href="/games/turkey-trouble/"]').first();
  await link.scrollIntoViewIfNeeded({ timeout: 15000 });
  await page.evaluate(() => window.scrollBy(0, -120));
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, 'live_games_tile.png') });
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  return `found; page is ${wide} px wide at a 375 px screen` + (wide > 380 ? ' (SIDEWAYS SCROLL)' : '');
});
await step('artifacts page', async () => {
  await page.goto(site + '/artifacts/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  const has = await page.evaluate(() => document.body.innerText.includes('Turkey Trouble'));
  await page.screenshot({ path: join(OUT, 'live_artifacts.png') });
  return has ? 'shows Turkey Trouble' : 'Turkey Trouble NOT on the page';
});
await step('game title screen', async () => {
  await page.goto(site + '/games/turkey-trouble/?mute=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => { const l = document.getElementById('loading'); return window.__tt && (!l || l.hidden || getComputedStyle(l).display === 'none'); }, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, 'live_title.png') });
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  return `"${await page.title()}"; ${wide} px wide; stage quality ${await page.evaluate(() => window.__tt.stage && window.__tt.stage.quality)}`;
});
if (errors.length) { bad += 1; console.log('page errors:', JSON.stringify(errors)); }
await browser.close();
console.log(bad ? 'live check: PROBLEMS' : 'live check: all three pages fine at phone width');
process.exit(bad ? 1 : 0);
