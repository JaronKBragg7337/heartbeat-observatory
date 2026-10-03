// Phone-tier frame cost at the port, before and after the polish: JS step time with the render stubbed (4x CPU throttle,
// iPhone-sized viewport, tier=low, solo), the renderer's draw calls and triangles for the real frame, and the port's own stats.
//   node docs/qa/2026-10-03/port-polish/perf.mjs <port>       (SwiftShader: GPU time means nothing here, draw calls and JS time do)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/playwright');
const port = Number(process.argv[2] || 8451);
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/lilli/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&tier=low`, { waitUntil: 'load' });
await p.waitForFunction(() => window.cosmos?.portTour && window.cosmos.engine.frameCount > 30, null, { timeout: 180000 });
await p.waitForTimeout(5000);
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const out = {};
for (const view of ['port-from-ship', 'market-eye', 'hall-door-outside', 'pad-01-eye']) {
  const r = await p.evaluate(async (view) => {
    const c = window.cosmos; try { c.portTour(view); } catch { c.portTour('port-from-ship'); }
    for (let i = 0; i < 10; i++) { c.step(1 / 30); c.portTour.update(); }
    const r = c.engine.renderer, render = r.render;
    r.render = () => {}; const t = []; for (let i = 0; i < 180; i++) { const a = performance.now(); c.step(1 / 60); t.push(performance.now() - a); } r.render = render;
    t.sort((a, b) => a - b);
    // the real frame, for draw calls and triangles
    const f = []; for (let i = 0; i < 12; i++) { const a = performance.now(); c.step(1 / 60); f.push(performance.now() - a); }
    f.sort((a, b) => a - b);
    const i = r.info;
    return { jsStepP50: +t[90].toFixed(2), jsStepP95: +t[171].toFixed(2), fullStepSwiftShaderP50: +f[6].toFixed(1), calls: i.render.calls, triangles: i.render.triangles, lights: c.port.lights.length };
  }, view);
  out[view] = r; console.log(view, JSON.stringify(r));
}
out.port = await p.evaluate(() => ({ ...window.cosmos.port.stats, depthLayers: window.cosmos.port.depthLayers.maxLayer, boxes: window.cosmos.port.boxes.length }));
console.log('port', JSON.stringify(out.port));
await browser.close(); process.exit(0);
