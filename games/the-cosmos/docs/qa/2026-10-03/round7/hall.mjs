// Crew hall name tags, before (live tree on 8379) | after (this tree on 8378): one isolated authority, one iPhone-profile WebKit phone per client build.
import '../../../../server/runtime.mjs';
import { createRequire } from 'node:module'; import { mkdtemp, rm } from 'node:fs/promises'; import { tmpdir, homedir } from 'node:os'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { startServer } from '../../../../server/index.mjs'; import { FileAdapter } from '../../../../server/storage.mjs';
const pw = createRequire(join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); const here = dirname(fileURLToPath(import.meta.url));
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const dir = await mkdtemp(join(tmpdir(), 'cosmos-hall-')); const app = await startServer({ adapter: new FileAdapter(join(dir, 'w.json')), port: 0, tick: true }); const w = app.world;
const me = await w.join('h'.repeat(48), 'Hall');
await w.enqueue(() => { const p = w.state.players[me.id]; p.pose.worldPos = w.site.toWorld(-28, 0.02, -54); p.pose.velocity = { x: 0, y: 0, z: 0 }; p.poseAt = Date.now(); w.state.revision++; }); w.advance(25);
const browser = await pw.webkit.launch({ headless: true, executablePath: join(process.env.LOCALAPPDATA, 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
for (const [tag, port] of [['before', 8379], ['after', 8378]]) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('cosmos-device-v2', JSON.stringify({ key: 'h'.repeat(48), name: 'Hall' })); localStorage.setItem('hb-look', 'isaiah'); });
  const page = await ctx.newPage(); await page.goto(`http://localhost:${port}/?dev=1&opening=off&tier=low&ws=${app.url}`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 }); await page.waitForTimeout(6000);
  await page.evaluate(() => { const c = cosmos, w = c.walker, p = c.port.site.toWorld(-28, 0.3, -54); w.worldPos.x = p.x; w.worldPos.y = p.y; w.worldPos.z = p.z; w.yaw = 0; w.pitch = 0; });
  await page.waitForTimeout(2500); console.log(tag, 'tags', JSON.stringify(await page.evaluate(() => [...cosmos.multiplayer.bodies.values()].filter(b => b.tag).map(b => ({ n: b.name, vis: b.tag.visible, w: +b.tag.scale.x.toFixed(2), h: +b.tag.scale.y.toFixed(3) })).slice(0, 8)))); await page.screenshot({ path: join(here, `hall-${tag}.png`) }); console.log('shot', tag); await ctx.close();
}
await browser.close(); await app.close(); await rm(dir, { recursive: true, force: true }); setTimeout(() => process.exit(0), 300);
