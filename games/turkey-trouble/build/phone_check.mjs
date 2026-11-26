// Turkey Trouble: a real phone-browser check. WebKit (the iPhone's engine), 375 x 812, touch, an iPhone's name.
//   node build/phone_check.mjs [base url] [modes, comma separated]
// For every mode: load the title, TAP the mode card (a real touch tap), wait for play, push the left thumb forward for
// two seconds, tap the action button, and report page errors, whether the player moved, and a screenshot.
// It needs nothing new: Playwright and its WebKit are already on the MSI (the Cosmos tests use them).
import { createRequire } from 'node:module';
import { join } from 'node:path';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:8766/games/turkey-trouble/';
const modes = (process.argv[3] || 'find,hunted,hunt,escape').split(',');
const OUT = process.env.TT_SHOTS_DIR || 'C:/Users/lilli/Projects/turkey-work/shots';
fs.mkdirSync(OUT, { recursive: true });

let pw = null;
for (const root of [import.meta.url, 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/', 'C:/Users/lilli/AI-Shared/tools/site-reel/node_modules/']) {
  for (const name of ['playwright', 'playwright-core']) {
    try { pw = createRequire(root)(name); break; } catch { /* next */ }
  }
  if (pw) break;
}
if (!pw) { console.log('NOT RUN: Playwright was not found on this machine'); process.exit(2); }
const browsers = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
const kits = fs.existsSync(browsers) ? fs.readdirSync(browsers).filter((d) => /^webkit-\d+$/.test(d)).sort() : [];
const IPHONE = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
};

async function launch() {
  for (const kit of [null, ...kits.slice().reverse()]) {
    try {
      return await pw.webkit.launch(kit ? { headless: true, executablePath: join(browsers, kit, 'Playwright.exe') } : { headless: true });
    } catch (e) { console.log(`webkit ${kit || '(default)'} did not start: ${String(e).split('\n')[0].slice(0, 140)}`); }
  }
  return null;
}

const browser = await launch();
if (!browser) { console.log('NOT RUN: no WebKit build started'); process.exit(2); }
let failed = 0;
const where = (page) => page.evaluate(() => { const t = window.__tt || {}, g = (t.app && t.app.game) || null, k = g && (g.kind === "escape" ? g.turkey : g.player); if (k && typeof k.x === "number") return { x: k.x, z: k.z }; const m = /P\s+(-?[\d.]+),\s*(-?[\d.]+)/.exec((document.getElementById('dev') || {}).textContent || ''); return m ? { x: +m[1], z: +m[2] } : null; });

for (const mode of modes) {
  const context = await browser.newContext(IPHONE);
  const page = await context.newPage();
  const errors = [], notes = []; let synthetic = false;
  page.on('pageerror', (e) => (synthetic ? notes : errors).push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) (synthetic ? notes : errors).push('console: ' + m.text().slice(0, 1400)); });
  const line = { mode };
  try {
    const t0 = Date.now();
    await page.goto(`${base}?mute=1&seed=7`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => { const l = document.getElementById('loading'); return window.__tt && (!l || l.hidden || getComputedStyle(l).display === 'none'); }, null, { timeout: 120000 });
    line.loadSeconds = +((Date.now() - t0) / 1000).toFixed(1);
    line.webgl = await page.evaluate(() => { const s = window.__tt.stage; if (!s) return 'no stage'; const gl = s.renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return (e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'webgl') + ' / ' + s.quality; });
    await page.tap(`button.mode[data-mode="${mode}"]`);
    await page.waitForFunction(() => window.__tt.app.screen === 'play', null, { timeout: 60000 }).catch(async () => {
      // a story line or a hint card may be in the way: tap the first big button shown, once
      const b = await page.$('#btnBetween, .btn-big:visible');
      if (b) await b.tap();
      await page.waitForFunction(() => window.__tt.app.screen === 'play', null, { timeout: 30000 });
    });
    await page.waitForTimeout(1500);
    const a = await where(page);
    // the left thumb: down at (90, 620), pushed up to the rim, held, released (pointer events, as a finger makes them)
    synthetic = true;
    await page.evaluate(async () => {
      const el = document.elementFromPoint(90, 620) || document.getElementById('c') || document.querySelector('canvas');
      const ev = (type, x, y) => { const init = { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }; el.dispatchEvent(new PointerEvent(type, init)); };
      ev('pointerdown', 90, 620);
      for (let i = 1; i <= 8; i++) { ev('pointermove', 90, 620 - i * 9); await new Promise((r) => setTimeout(r, 30)); }
      await new Promise((r) => setTimeout(r, 2000));
      ev('pointerup', 90, 548);
    });
    await page.waitForTimeout(200); synthetic = false;
    let b = await where(page);
    line.thumb = a && b ? +Math.hypot(b.x - a.x, b.z - a.z).toFixed(2) : null;
    if (!(line.thumb > 0.5)) {                               // a made-up finger may not be accepted: walk with the keys instead
      await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW');
      b = await where(page); line.keys = a && b ? +Math.hypot(b.x - a.x, b.z - a.z).toFixed(2) : null;
    }
    line.moved = Math.max(line.thumb || 0, line.keys || 0) || null;
    if (notes.length) line.notes = notes;
    const action = await page.$('#btnAction');
    if (action && await action.isVisible()) { await action.tap(); line.action = 'tapped'; } else line.action = 'not shown';
    await page.waitForTimeout(700);
    line.fps = await page.evaluate(() => { const m = /(\d+)\s*fps/.exec((document.getElementById('dev') || {}).textContent || ''); return m ? +m[1] : null; });
    line.screen = await page.evaluate(() => window.__tt.app.screen);
    await page.screenshot({ path: join(OUT, `webkit_${mode}.png`) });
  } catch (e) { errors.push('check: ' + String(e).split('\n')[0].slice(0, 300)); try { await page.screenshot({ path: join(OUT, `webkit_${mode}_FAILED.png`) }); } catch { /* nothing */ } }
  line.errors = errors;
  const ok = errors.length === 0 && line.moved !== null && line.moved > 0.5;
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(line)}`);
  await context.close();
}
await browser.close();
console.log(failed === 0 ? `phone check: all ${modes.length} modes pass in WebKit at 375 x 812` : `phone check: ${failed} of ${modes.length} modes FAIL`);
process.exit(failed === 0 ? 0 : 1);
