// Marineris Port polish: review shots from the port tour's named cameras, desktop and phone, noon and dusk.
//   node docs/qa/2026-10-03/port-polish/shots.mjs <prefix> [port]       (prefix: before | after; dev server: PORT=<port> node server.js)
// Writes <prefix>-d-<view>.jpg (1280x720, tier=high), <prefix>-p-<view>.jpg (390x844, tier=low, Chromium) and, with WEBKIT=1,
// <prefix>-w-<view>.jpg (iPhone 15 WebKit, tier=low). JPEGs are gitignored; sheet.py cuts the committed contact sheets.
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { chromium, webkit } = createRequire(import.meta.url)('C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/playwright');
const prefix = process.argv[2] || 'after', port = Number(process.argv[3] || 8451);
const DESK = ['port-from-ship', 'tower-mast-from-the-apron', 'hall-door-outside', 'hall-door-inside', 'hall-interior', 'depot-door-outside', 'depot-interior',
  'tower-door-outside', 'tower-reception', 'market-eye', 'market-trader-1', 'market-trader-2', 'fuel-eye', 'containers-eye', 'sign-eye', 'pad-01-eye',
  'pad-02-wear', 'ship-ramp-ground', 'tower-cab-south', 'port-one-km', 'pad-01-above'];
const PHONE = ['port-from-ship', 'hall-door-outside', 'hall-interior', 'depot-door-outside', 'market-trader-1', 'fuel-eye', 'pad-01-eye', 'tower-door-outside'];
const DUSK = ['port-from-ship', 'hall-door-outside', 'market-eye', 'tower-mast-from-the-apron', 'sign-eye', 'fuel-eye'];
// a few hand-placed cameras the tour does not have (port-local eye, target)
const EXTRA = { 'hall-bar': [[-28, 1.66, -63], [-28, 1.4, -72]], 'hall-corner': [[-22, 1.66, -66], [-16, 1.2, -72]], 'apron-tug': [[40, 1.66, -34], [46, .8, -41]],
  'depot-east-wall': [[-45, 1.66, 25], [-50, 1.5, 20]], 'market-row': [[-40, 1.66, 60], [-62, 1.8, 52]], 'hall-front-wide': [[-10, 2.2, -50], [-28, 2.5, -64]], 'dart-inside': [[-36, 1.66, -71], [-39.7, 1.7, -71]], 'east-outside': [[-11, 1.66, -71], [-16, 1.7, -71]], 'front-right-end': [[-12, 1.66, -52], [-20, 1.5, -61]], 'depot-west-wall': [[-80, 1.66, 12], [-74, 1.5, 15]] };
async function run(browser, device, tag, views, opts = {}) {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
  await page.goto(`${process.env.LIVE || `http://127.0.0.1:${port}`}/?dev=1&solo=1&opening=off&tier=${opts.tier || 'high'}`, { waitUntil: 'load' });   // LIVE=https://www.heartbeatobservatory.com/games/the-cosmos for the published build
  await page.waitForFunction(() => window.cosmos?.portTour && window.cosmos.engine.frameCount > 5, null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  await page.evaluate(() => { const c = window.cosmos; if (c.engine.graphics) c.engine.graphics.checked = 1e6; for (const e of document.body.children) if (e.tagName !== 'CANVAS' && e.tagName !== 'SCRIPT') e.style.visibility = 'hidden'; });
  for (const name of views) {
    const ok = await page.evaluate(async ([name, extra, dusk]) => {
      const c = window.cosmos;
      try {
        if (extra && !c.portTour.views.some((v) => v.name === name)) c.portTour.views.push({ name, eye: extra[0], target: extra[1], inside: false });
        c.portTour(name);
        if (dusk) {   // the cinema's dusk grade, applied by hand (cinema.grade only runs while a shot is filming)
          c.cinema.stageApi?.setSun?.(6, 250);
          const sun = c.engine.scene.children.find((o) => o.isDirectionalLight), sky = c.engine.scene.children.find((o) => o.isHemisphereLight);
          if (sun) { sun.color.setRGB(1, .5, .22); sun.intensity = 3.0; } if (sky) sky.intensity = .2; c.engine.renderer.toneMappingExposure = .75;
        }
        for (let i = 0; i < 6; i++) { c.step(1 / 30); c.portTour.update(); }
        await new Promise((r) => setTimeout(r, 400)); c.step(0); c.portTour.update();
        return true;
      } catch (e) { return String(e); }
    }, [name, EXTRA[name] || null, !!opts.dusk]);
    if (ok !== true) { console.log('skip', name, ok); continue; }
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(here, `${prefix}-${tag}-${name}${opts.dusk ? '-dusk' : ''}.jpg`), type: 'jpeg', quality: 86 });
    console.log('shot', prefix, tag, name, opts.dusk ? 'dusk' : '');
  }
  await ctx.close();
}
const chromeArgs = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
const ch = await chromium.launch({ headless: true, executablePath: 'C:/Users/lilli/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: chromeArgs });
try {
  if (process.env.WK_ONLY) {}
  else if (process.env.VIEWS) await run(ch, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, 'd', process.env.VIEWS.split(','), { dusk: !!process.env.DUSK });   // a quick look at a few
  else {
    await run(ch, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, 'd', [...DESK, ...Object.keys(EXTRA)]);
    await run(ch, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, 'd', DUSK, { dusk: true });
    await run(ch, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, 'p', PHONE, { tier: 'low' });
  }
} finally { await ch.close(); }
if ((process.env.WEBKIT && !process.env.VIEWS) || process.env.WK_ONLY) {
  const wk = await webkit.launch({ headless: true, executablePath: 'C:/Users/lilli/AppData/Local/ms-playwright/webkit-2336/Playwright.exe' });
  try {
    await run(wk, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'w', ['port-from-ship', 'hall-door-outside', 'hall-interior', 'market-trader-1'], { tier: 'low' });
  } finally { await wk.close(); }
}
process.exit(0);
