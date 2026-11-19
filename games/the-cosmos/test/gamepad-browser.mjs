// A controller plays the game: a fake standard gamepad drives the real page (desktop Chromium + iPhone WebKit profile).
// Run: node test/gamepad-browser.mjs   (starts its own static server; COSMOS_LOCAL_URL overrides)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/AI-Shared/tools/site-reel/node_modules/')('playwright-core'); }
const freePort = () => new Promise((r) => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, base = process.env.COSMOS_LOCAL_URL;
if (!base) {
  const port = await freePort(); server = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/build.json')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  base = 'http://127.0.0.1:' + port + '/';
}
const rows = []; const check = (name, ok, detail = '') => { rows.push([name, ok, detail]); console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : '  ' + detail)); };
const FAKE = `(() => { const pad = { id: "Test pad", index: 0, connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad; navigator.getGamepads = () => [pad]; window.padBtn = (i, on) => { pad.buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; }; })()`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const runs = [['desktop', pw.chromium, { viewport: { width: 1440, height: 900 } }, '&tier=high'], ['phone', pw.webkit, { userAgent: UA, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, '&tier=low']];
for (const [label, engine, ctxOpts, q] of runs) {
  const browser = await engine.launch({ headless: true, args: engine === pw.chromium ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
  const page = await (await browser.newContext(ctxOpts)).newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.addInitScript(FAKE);
  await page.goto(base + '?dev=1&solo=1&opening=off' + q, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.cosmos?.engine?.frameCount > 10 && window.cosmos.space, null, { timeout: 240000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const c = cosmos, w = c.walker, p = c.port.site.toWorld(200, 0.3, 250); c.ship.aboard = false; if (c.ship.seat) c.ship.stations.stand(); Object.assign(w.worldPos, p); w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = true; });
  await page.waitForTimeout(800);
  const at = () => page.evaluate(() => ({ ...cosmos.walker.worldPos, yaw: cosmos.walker.yaw }));
  const tap = async (i) => { await page.evaluate((i) => padBtn(i, true), i); await page.waitForTimeout(180); await page.evaluate((i) => padBtn(i, false), i); await page.waitForTimeout(300); };
  const a = await at();
  await page.evaluate(() => { __pad.axes[1] = -1; }); await page.waitForTimeout(1500); await page.evaluate(() => { __pad.axes[1] = 0; }); await page.waitForTimeout(300);
  const b = await at(); const moved = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  check(label + ': left stick forward walks (moved ' + moved.toFixed(2) + ' m)', moved > 0.5);
  check(label + ': the pad is noticed (input kind, help toast)', await page.evaluate(() => document.documentElement.dataset.input === 'gamepad' && !!document.getElementById('pad-toast')));
  await page.evaluate(() => { __pad.axes[2] = 1; }); await page.waitForTimeout(700); await page.evaluate(() => { __pad.axes[2] = 0; }); await page.waitForTimeout(200);
  const c2 = await at(); check(label + ': right stick turns the view (yaw ' + (c2.yaw - b.yaw).toFixed(2) + ' rad)', Math.abs(c2.yaw - b.yaw) > 0.3);
  const still = await at(); await page.waitForTimeout(500); const still2 = await at();
  check(label + ': releasing the stick stops (no stuck key)', Math.hypot(still2.x - still.x, still2.y - still.y, still2.z - still.z) < 0.3);
  const v0 = await page.evaluate(() => cosmos.view.mode); await tap(8);
  check(label + ': View button switches first / third person', (await page.evaluate(() => cosmos.view.mode)) !== v0);
  await tap(9);
  check(label + ': Menu opens settings', await page.evaluate(() => document.getElementById('settings-panel').classList.contains('open')));
  await tap(13); await tap(13);
  const f = await page.evaluate(() => { const el = document.querySelector('.pad-focus'); return el ? { tag: el.tagName, id: el.id, inPanel: !!el.closest('#settings-panel') } : null; });
  check(label + ': D-pad puts a focus ring on a control in the open panel', !!f && f.inPanel, JSON.stringify(f));
  await page.evaluate(() => { cosmos.gamepad.setFocus(document.getElementById('btn-close-settings')); }); await tap(0);
  check(label + ': A presses the focused button (settings closed)', await page.evaluate(() => !document.getElementById('settings-panel').classList.contains('open')));
  check(label + ': no page errors', errors.length === 0, errors.join(' | '));
  check(label + ': no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await browser.close();
}
if (server) server.kill();
const failed = rows.filter((r) => !r[1]).length; console.log(`RESULT: ${rows.length - failed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
