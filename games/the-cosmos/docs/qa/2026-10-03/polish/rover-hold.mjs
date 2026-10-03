// The shared rover in the Meridian's hold, its seats, and driven out: PREFIX=before node rover-hold.mjs
import { open } from './lib.mjs';
const prefix = process.env.PREFIX || 'before';
async function run(phone) {
  const tag = phone ? 'p' : 'd';
  const h = await open({ w: phone ? 390 : 1280, h: phone ? 844 : 720, query: '?dev=1&solo=1&opening=off&' + (phone ? 'tier=low&depth=16' : 'tier=high'), wait: 9000 }, prefix + '-' + tag);
  try {
    const sh = (n) => h.shot('hold-' + n);
    await h.page.evaluate(() => { const c = cosmos; if (!c.ship.state.ramps.cargo.lowered && c.ship.rampCtl.cargo.target < 0.5) c.ship.toggleRamp('cargo'); window.ff(9, 0.1); });
    await h.page.evaluate(() => window.ext([4.4, 2.3, 12.4], [0, 1.1, 16.4])); await sh('quarter');
    await h.page.evaluate(() => window.ext([-3.2, 1.7, 21.2], [0, 1.3, 16.4])); await sh('rear');
    await h.page.evaluate(() => window.ext([0.4, 1.9, 8.4], [0, 1.2, 16.4])); await sh('front');
    // driver's seat, then the right seat
    for (const seat of ['driver', 'right']) {
      await h.page.evaluate((seat) => { const c = cosmos; c.freeCam.off(); const v = c.vehicles; try { v._leave?.('hold-solo'); v._board('hold-solo', seat); } catch (e) { window.__boardError = String(e); } for (let i = 0; i < 12; i++) c.step(1 / 30); }, seat);
      await sh('seat-' + seat);
      await h.page.evaluate(() => { cosmos.vehicles.camPitch = 0.55; for (let i = 0; i < 4; i++) cosmos.step(1 / 30); }); await sh('seat-' + seat + '-down');
      await h.page.evaluate(() => { cosmos.vehicles.camPitch = 0; });
    }
    // drive down the ramp and out, then look back at it
    await h.page.evaluate(() => { const c = cosmos; try { c.vehicles._leave('hold-solo'); c.vehicles._board('hold-solo', 'driver'); } catch (e) { window.__boardError = String(e); } c.desktop.keys.add('KeyW'); });
    for (let i = 0; i < 30; i++) { await h.page.evaluate(() => window.ff(1, 0.05)); if (!(await h.page.evaluate(() => cosmos.vehicles.solo[0].parentShipId))) break; }
    await h.page.evaluate(() => window.ff(3, 0.05)); await sh('driving-out');
    await h.page.evaluate(() => { const c = cosmos; c.vehicles.camYaw = 2.7; c.vehicles.camPitch = 0.1; window.ff(0.2, 0.05); }); await sh('driving-look-back');
    await h.page.evaluate(() => { const c = cosmos; c.vehicles.camYaw = 0; c.desktop.keys.clear(); c.desktop.keys.add('KeyW'); window.ff(2, 0.05); const v = c.vehicles.solo[0], f = c.ship.flight; const w = v.world; c.freeCam.set({ x: w.x + 7, y: w.y + 2.6, z: w.z + 6 }, { x: w.x, y: w.y + 1, z: w.z }); for (let i = 0; i < 3; i++) c.step(1 / 30); });
    await sh('driving-chase');
  } finally { await h.browser.close(); }
}
if (!process.env.PHONE_ONLY) await run(false);
if (!process.env.DESK_ONLY) await run(true);
