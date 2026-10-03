// Fast look: node peek.mjs <outprefix> <stage:0|1|2|3> "name:x,z,tx,ty,tz[,y]" ... (stage 1: "name:x,z,yaw,pitch"; stage 0: "name:t,yaw,pitch")   [PHONE=1 for 390x844 low tier]
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../../../server/index.mjs';
import { MemoryAdapter } from '../../../../src/world-state/storage.js';
const { chromium } = createRequire(join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright');
const out = fileURLToPath(new URL('./', import.meta.url));
const [prefix, stageArg, ...views] = process.argv.slice(2), stage = +stageArg, phone = !!process.env.PHONE;
const app = await startServer({ adapter: new MemoryAdapter(), port: 0, tick: false, now: () => Date.now() });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, isMobile: phone, hasTouch: phone });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 500)));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 300)); });
await page.goto(app.url.replace('ws:', 'http:') + '/?dev=1&ws=' + app.url + '&' + (phone ? 'tier=low&depth=16&' : 'tier=high&') + 'solo=1');
await page.waitForFunction(() => window.cosmos?.opening && cosmos.engine.frameCount >= 2, null, { timeout: 120000 });
await page.evaluate(async () => { cosmos.engine.stop(); await cosmos.opening.ready; cosmos.opening.savePose = () => {}; cosmos.step(0); });
await page.evaluate(({ stage }) => { const o = cosmos.opening; o.state.stage = stage; o.stage = stage; o.elapsed = 60; o.contactSeconds = 9; o.model.place(o.state.pose); window.__dt = 0; }, { stage });
if (process.env.HIDE) await page.evaluate((h) => { const names = h.split(','), o = cosmos.opening, L = o.look, orig = L.frame.bind(L); L.frame = (...a) => { orig(...a); for (const n of names) { o.root.children.forEach(c => { if (c.name === n) c.visible = false; }); if (n === 'cabin') o.cabin.root.visible = false; if (n === 'blob') L.site.group.children.forEach(c => { if (c.material?.map) c.visible = false; }); if (n === 'soil') L.site.group.children.forEach(c => { if (c.material?.transparent && !c.material.map) c.visible = false; }); } }; }, process.env.HIDE);
for (const v of views) {
  const [name, rest] = v.split(':'), n = rest.split(',').map(Number);
  await page.evaluate(({ stage, n }) => {
    const o = cosmos.opening, m = o.model, w = m.walker;
    if (stage === 0) { o.state.stage = 0; o.stage = 0; o.elapsed = n[0]; o.sw.yaw = n[1] || 0; o.sw.pitch = n[2] || 0; cosmos.step(0); cosmos.step(0); return; }
    if (stage === 1) { o.sw.place(n[0], 0, n[1], n[2]); o.sw.pitch = n[3] || 0; cosmos.step(0); cosmos.step(0); return; }
    if (n[0] === 999) { m.place(o.state.pose); cosmos.step(0); cosmos.step(0); return; }
    const [x, z, tx, ty, tz, y] = n;
    m.place({ x, y: y ?? m.height(x, z), z, yaw: 0, pitch: 0 }); cosmos.step(0);
    const e = w.eyeWorldPos({}), p = m.toWorld(tx, ty, tz), f = w.updateFrame();
    const d = { x: p.x - e.x, y: p.y - e.y, z: p.z - e.z }, l = Math.hypot(d.x, d.y, d.z), dot = u => d.x * u.x + d.y * u.y + d.z * u.z;
    w.yaw = Math.atan2(dot(f.east), dot(f.north)); w.pitch = Math.asin(dot(f.up) / l); cosmos.step(0); cosmos.step(0);
  }, { stage, n });
  if (process.env.WAIT) await page.waitForTimeout(+process.env.WAIT);
  await page.screenshot({ path: join(out, `${prefix}-${name}.png`) });
  console.log('shot', name);
}
if (process.env.INFO) console.log(JSON.stringify(await page.evaluate(() => { const i = cosmos.engine.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, buildMs: cosmos.opening.buildMs }; })));
await browser.close(); await app.close();
