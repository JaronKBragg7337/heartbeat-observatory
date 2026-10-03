// The moon ground on iOS WebKit (iPhone 15 profile): do the new shaders compile, and does it draw?   PHOBOS2_PORT=8471 node webkit.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
let webkit, devices;
try { ({ webkit, devices } = createRequire(import.meta.url)('playwright')); }
catch { ({ webkit, devices } = createRequire('C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright')); }
const port = process.env.PHOBOS2_PORT || 8471, prefix = process.env.PREFIX || 'after';
const browser = await webkit.launch({ headless: true, executablePath: path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || /shader|program|compile/i.test(t)) errs.push(t.slice(0, 300)); });
page.on('pageerror', (e) => errs.push('pageerror ' + String(e).slice(0, 300)));
await page.goto(`http://localhost:${port}/?dev=1&solo=1&opening=off`, { waitUntil: 'load' });
await page.waitForFunction(() => window.cosmos && window.cosmos.engine, null, { timeout: 120000 });
await page.waitForTimeout(8000);
const shots = [['webkit-ground', [14, -22, 1.8], [-5, 8, 1.2]], ['webkit-orbit-low', [-3500, -6500, 4200], [600, 1500, -500]]];
for (const moon of ['phobos', 'deimos']) {
  await page.evaluate((m) => { window.__moon = m; const c = window.cosmos; c.engine.graphics && (c.engine.graphics.checked = 1e6); c.space.debugLand(m); for (const e of document.body.children) if (e.tagName !== 'CANVAS' && e.id !== 'game-canvas' && e.tagName !== 'SCRIPT') e.style.visibility = 'hidden'; }, moon);
  for (const [name, eye, at] of shots) {
    await page.evaluate(([m, eye, at]) => { const c = window.cosmos, mw = c.space.worlds.get(m), pi = mw.body.padInfo; const add = (e, n, u) => ({ x: pi.point.x + pi.east.x * e + pi.north.x * n + pi.up.x * u, y: pi.point.y + pi.east.y * e + pi.north.y * n + pi.up.y * u, z: pi.point.z + pi.east.z * e + pi.north.z * n + pi.up.z * u }); c.freeCam.set(add(...eye), add(...at)); mw.force(add(...eye)); const r = c.engine.renderer, s = r.render; r.render = () => {}; for (let i = 0; i < 20; i++) c.step(1 / 30); r.render = s; c.step(1 / 60); }, [moon, eye, at]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(here, `${prefix}-p-${moon}-${name}.png`) });
  }
}
console.log('WEBKIT errors:', errs.length, JSON.stringify(errs.slice(0, 5)));
await browser.close();
