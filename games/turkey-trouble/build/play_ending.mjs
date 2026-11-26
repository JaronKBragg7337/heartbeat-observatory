// Turkey Trouble: film the ending walk in WebKit as an iPhone. The turkey is put just past the last road, then the
// game's own rules take it through the spruce to the door. Pictures every 0.6 s.  node build/play_ending.mjs
import { createRequire } from 'node:module';
import { join } from 'node:path';
import fs from 'node:fs';
const base = process.env.TT_BASE || 'http://localhost:8766/games/turkey-trouble/';
const OUT = (process.env.TT_PLAY_DIR || 'C:/Users/lilli/Projects/turkey-work/play') + '/ending';
fs.mkdirSync(OUT, { recursive: true });
let pw = null;
for (const root of [import.meta.url, 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/', 'C:/Users/lilli/AI-Shared/tools/site-reel/node_modules/']) {
  for (const name of ['playwright', 'playwright-core']) { try { pw = createRequire(root)(name); break; } catch { /* next */ } }
  if (pw) break;
}
const browser = await pw.webkit.launch({ headless: true });
const W = +(process.env.TT_W || 375), H = +(process.env.TT_H || 812);
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`${base}?mute=1&seed=7&q=mid`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => { const l = document.getElementById('loading'); return window.__tt && (!l || l.hidden || getComputedStyle(l).display === 'none'); }, null, { timeout: 120000 });
await page.tap('button.mode[data-mode="escape"]');
await page.waitForFunction(() => window.__tt.app.screen === 'play', null, { timeout: 60000 });
await page.waitForTimeout(800);
await page.evaluate(async () => {
  const B = await import('./src/game/bots.js'); const g = window.__tt.app.game, L = window.__tt.stage.layout;
  const last = L.escape.lanes[L.escape.lanes.length - 1];
  const P = g.player; P.x = L.escape.finish.path[0].x; P.z = last.z1 - 0.6; P.px = P.x; P.pz = P.z;
  const bot = B.escapeBot(g); window.__tt.pilot = (input) => bot.think(input);
});
for (let k = 0; k < 40; k++) {
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => { const a = window.__tt.app, g = a.game, sh = window.__tt.cam.shot; return { shot: sh && [sh.from.x.toFixed(1), sh.from.z.toFixed(1), sh.at.x.toFixed(1), sh.at.z.toFixed(1)].join(' '), screen: a.screen, phase: g.phase, i: g.ending.path.i, st: g.ending.stage, x: +g.player.x.toFixed(1), z: +g.player.z.toFixed(1) }; });
  await page.screenshot({ path: join(OUT, `end_${String(k).padStart(2, '0')}.png`) });
  console.log(k, JSON.stringify(s));
  if (s.screen === 'ending') { await page.waitForTimeout(4200); await page.screenshot({ path: join(OUT, 'end_card.png') }); break; }
}
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
await browser.close();
