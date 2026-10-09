// A phone that is switched away from loses its WebGL context and gets it back: the game must carry on in normal graphics (no reload into safe mode, no red banner).
// A context that never comes back still falls back to safe mode (test/twoplayer-browser.mjs). iPhone-profile WebKit against a local server.
//   node test/context-restore-browser.mjs
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright'); }
const WEBKIT = process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe');
const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
let bad = 0; const ok = (n, p, d = '') => { if (!p) bad++; console.log((p ? 'PASS ' : 'FAIL ') + n + (p ? '' : '  ' + d)); };
const app = await startServer({ adapter: new MemoryAdapter(), port: 0, tick: true });
const wk = await pw.webkit.launch({ headless: true, executablePath: WEBKIT });
try {
  const page = await (await wk.newContext(IPHONE)).newPage(); page.setDefaultTimeout(120000);
  await page.goto(app.url.replace('ws:', 'http:') + '/?ws=' + app.url + '&dev=1&opening=off&tier=low');
  await page.waitForFunction(() => window.cosmos?.engine?.frameCount >= 5);
  const f0 = await page.evaluate(() => cosmos.engine.frameCount);
  await page.evaluate(() => { const g = cosmos.engine.renderer.getContext(), x = g.getExtension('WEBGL_lose_context'); window.__x = x; x.loseContext(); });
  await new Promise((r) => setTimeout(r, 1500));
  ok('while the context is lost no banner, no reload into safe mode yet', !page.url().includes('tier=safe') && !(await page.evaluate(() => !!document.getElementById('graphics-problem'))));
  await page.evaluate(() => window.__x.restoreContext());
  await new Promise((r) => setTimeout(r, 4000));
  const s = await page.evaluate(() => ({ lost: cosmos.engine.renderer.getContext().isContextLost(), frames: cosmos.engine.frameCount, safe: cosmos.engine.safe, banner: document.getElementById('graphics-problem')?.textContent || '', failures: cosmos.engine.graphics.failures }));
  ok('after the context returns the game runs on in normal graphics (frames advance, not safe, no banner, no failure)', !s.lost && s.frames > f0 + 3 && !s.safe && !s.banner && s.failures === 0 && !page.url().includes('tier=safe'), JSON.stringify(s));
} catch (e) { bad++; console.log('FAIL (threw)', e.message); }
await wk.close(); await app.close();
console.log(bad ? bad + ' FAILED' : 'ALL PASS'); process.exit(bad ? 1 : 0);
