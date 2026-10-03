// Same walk-up-the-ramp check, but against the LIVE site as a flagged test visitor (?test=1: swept by the server shortly after it leaves).
// Real network, real tick, real WebKit iPhone profile. usage: node test/ramp-live.mjs [origin]
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';
const pw = createRequire(import.meta.url)(join(homedir(), '.codex/runtime/unfinished-island/node_modules/') + 'playwright');
const origin = process.argv[2] || 'https://cosmos.heartbeatobservatory.com';
const browser = await pw.webkit.launch({ headless: true, executablePath: join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 200)));
await p.goto(`${origin}/?dev=1&test=1&opening=off&tier=low`, { waitUntil: 'commit', timeout: 240000 });
await p.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 }); await p.waitForTimeout(2500);
console.log('connected', await p.evaluate(() => ({ remote: !cosmos.world.remote === false, aboard: cosmos.ship.aboard, ships: Object.keys(cosmos.world.snapshot.ships).length, me: cosmos.world.snapshot.players[cosmos.world.playerId].name })));
const THUMB = { id: 71, x: 80, y: 650 };
const thumb = (type, dy = 0) => p.evaluate(({ t, type, dy }) => { document.querySelector('canvas').dispatchEvent(new PointerEvent(type, { pointerId: t.id, pointerType: 'touch', isPrimary: false, clientX: t.x, clientY: t.y - dy, bubbles: true, cancelable: true })); }, { t: THUMB, type, dy });
const info = () => p.evaluate(() => { const c = cosmos, s = c.world.snapshot, me = s.players[c.world.playerId], sh = s.ships[me.shipId], l = c.ship.flight.toLocal(c.walker.worldPos, {}); return { aboard: c.ship.aboard, pending: c.multiplayer.boardPending, ramp: sh.state.ramps.cargo, loc: [l.x, l.y, l.z].map((v) => +v.toFixed(2)), type: sh.type, pad: sh.pad.number }; });
console.log('start', JSON.stringify(await info()));
// walk to a point 8 m beyond the ramp tip, then turn and walk in, steering by yaw only
const steer = (target) => p.evaluate((tg) => { const c = cosmos, f = c.ship.flight, w = c.walker, d = f.toWorld(tg, {}), fr = w.updateFrame(), dx = d.x - w.worldPos.x, dy = d.y - w.worldPos.y, dz = d.z - w.worldPos.z;
  w.yaw = Math.atan2(dx * fr.east.x + dy * fr.east.y + dz * fr.east.z, dx * fr.north.x + dy * fr.north.y + dz * fr.north.z); const l = f.toLocal(w.worldPos, {}); return Math.hypot(l.x - tg.x, l.z - tg.z); }, target);
const run = async (sec) => p.evaluate(async (sec) => { const c = cosmos; await new Promise((r) => setTimeout(r, sec * 1000)); }, sec);
const st = (await info()); const R = { hinge: 20.9, len: st.type === 'courier' ? 10.6 : 20.9 };
const rampDef = await p.evaluate(async () => { const { shipDef } = await import('/src/ships/registry.js'); const c = cosmos, me = c.world.snapshot.players[c.world.playerId], sh = c.world.snapshot.ships[me.shipId], r = shipDef(sh.type).ramps.cargo; return { hinge: r.hinge, dir: r.dir, run: r.length * Math.cos(sh.state.ramps.cargo.angle) }; });
const out = { x: rampDef.hinge.x + rampDef.dir.x * (rampDef.run + 9), z: rampDef.hinge.z + rampDef.dir.z * (rampDef.run + 9) }, tip = { x: rampDef.hinge.x + rampDef.dir.x * (rampDef.run - 1.5), z: rampDef.hinge.z + rampDef.dir.z * (rampDef.run - 1.5) };
let loc = 0;
const goto = async (tg, y, max = 120) => { await thumb('pointerdown'); await thumb('pointermove', 60); try { for (let i = 0; i < max; i++) { const d = await p.evaluate((a) => { const c = cosmos, f = c.ship.flight, w = c.walker, l = f.toLocal(w.worldPos, {}); const d = f.toWorld({ x: a.x, y: l.y, z: a.z }, {}), fr = w.updateFrame(), dx = d.x - w.worldPos.x, dy = d.y - w.worldPos.y, dz = d.z - w.worldPos.z;
      w.yaw = Math.atan2(dx * fr.east.x + dy * fr.east.y + dz * fr.east.z, dx * fr.north.x + dy * fr.north.y + dz * fr.north.z); return { dist: Math.hypot(l.x - a.x, l.z - a.z), aboard: c.ship.aboard }; }, tg);
    if (d.aboard) return 'aboard'; if (d.dist < .6) return 'reached'; await p.waitForTimeout(120); } return 'timeout'; } finally { await thumb('pointerup'); } };
console.log('walk out ->', await goto(out, 0)); console.log('after out', JSON.stringify(await info()));
console.log('walk in ->', await goto(tip, 0, 120)); const fin = await info(); console.log('final', JSON.stringify(fin));
if (fin.aboard) { // now leave by the ramp and come back in: boarding must work a second time
  await p.waitForTimeout(2500);
  await thumb('pointerdown'); await thumb('pointermove', 60);
  for (let i = 0; i < 80; i++) { await p.evaluate(() => { const c = cosmos; if (c.ship.aboard) c.ship.sw.yaw = Math.PI; }); await p.waitForTimeout(120); if (!(await info()).aboard) break; }
  await thumb('pointerup'); const left = await info(); console.log('after walking off', JSON.stringify(left));
  if (!left.aboard) { await p.waitForTimeout(2500); console.log('walk back in ->', await goto(tip, 0, 120)); const again = await info(); console.log('second boarding', JSON.stringify(again)); fin.second = again.aboard; }
  else console.log('did not leave (maybe not at the ramp)');
}
await p.screenshot({ path: new URL('../docs/qa/2026-10-02/ramp/live-ramp.png', import.meta.url).pathname.replace(/^\//, '') });
await browser.close();
console.log(fin.aboard ? 'PASS boarded by walking up the live ramp' : 'FAIL did not board', 'second:', fin.second); process.exit(fin.aboard ? 0 : 1);
