// Turkey Trouble: play a mode for real in WebKit as an iPhone (375 x 812) with a bot on the pilot hook, and save pictures.
//   node build/play_modes.mjs find:win,hunted:win,hunted:lose,hunt:win,hunt:lose  [every seconds]
// win = the mode's own bot; lose = a bot that stands still (Hunt: the clock jumps to just before the bolt).
import { createRequire } from 'node:module';
import { join } from 'node:path';
import fs from 'node:fs';
const base = process.env.TT_BASE || 'http://localhost:8766/games/turkey-trouble/';
const runs = (process.argv[2] || 'find:win,hunted:win,hunted:lose,hunt:win,hunt:lose').split(',');
const every = +(process.argv[3] || 6);
const OUT = process.env.TT_PLAY_DIR || 'C:/Users/lilli/Projects/turkey-work/play';
fs.mkdirSync(OUT, { recursive: true });
let pw = null;
for (const root of [import.meta.url, 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/', 'C:/Users/lilli/AI-Shared/tools/site-reel/node_modules/']) {
  for (const name of ['playwright', 'playwright-core']) { try { pw = createRequire(root)(name); break; } catch { /* next */ } }
  if (pw) break;
}
const browsers = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
const kits = fs.existsSync(browsers) ? fs.readdirSync(browsers).filter((d) => /^webkit-\d+$/.test(d)).sort() : [];
let browser = null;
for (const kit of [null, ...kits.slice().reverse()]) { try { browser = await pw.webkit.launch(kit ? { headless: true, executablePath: join(browsers, kit, 'Playwright.exe') } : { headless: true }); break; } catch { /* next */ } }
const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
for (const run of runs) {
  const [mode, how] = run.split(':');
  const ctx = await browser.newContext(IPHONE); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(`${base}?mute=1&seed=7&q=mid`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => { const l = document.getElementById('loading'); return window.__tt && (!l || l.hidden || getComputedStyle(l).display === 'none'); }, null, { timeout: 120000 });
  await page.tap(`button.mode[data-mode="${mode}"]`);
  await page.waitForFunction(() => window.__tt.app.screen === 'play', null, { timeout: 60000 });
  await page.evaluate(async ([mode, how]) => {
    const B = await import('./src/game/bots.js');
    const mk = how === 'lose' ? B.idleBot : { find: B.findBot, hunted: B.huntedFleeBot, hunt: B.huntWinBot }[mode];
    let bot = null, gg = null;
    window.__tt.pilot = (input, g) => { if (gg !== g) { gg = g; bot = mk(g); } bot.think(input); };
    if (mode === 'hunt' && how === 'lose') window.__tt.app.game.t = 84;
  }, [mode, how]);
  const t0 = Date.now(); let k = 0, info = {};
  await page.screenshot({ path: join(OUT, `${mode}_${how}_00.png`) });
  while (Date.now() - t0 < 200000) {
    for (let w = 0; w < every * 4; w++) { await page.waitForTimeout(250); if (await page.evaluate(() => window.__tt.app.game.phase !== 'play')) { await page.waitForTimeout(900); await page.screenshot({ path: join(OUT, `${mode}_${how}_moment.png`) }); break; } }
    const s = await page.evaluate(async () => { const a = window.__tt.app, g = a.game, R = window.__tt.stage.renderer; R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const ri = { calls: R.info.render.calls, triangles: R.info.render.triangles }; R.info.autoReset = true; return { screen: a.screen, phase: g && g.phase, t: g && +g.t.toFixed(1), calls: ri.calls, tris: ri.triangles, q: window.__tt.stage.quality }; });
    info = s; k++;
    await page.screenshot({ path: join(OUT, `${mode}_${how}_${String(k).padStart(2, '0')}.png`) });
    console.log(run, JSON.stringify(s));
    if (s.screen !== 'play') { await page.waitForTimeout(1200); await page.screenshot({ path: join(OUT, `${mode}_${how}_end.png`) }); break; }
  }
  console.log(run, 'END', JSON.stringify(info), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await ctx.close();
}
await browser.close();
