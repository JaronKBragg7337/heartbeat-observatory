// Review 6: trip logic in the real game: moon to moon, cancelling, the stick taking over, refusing, from space. Prints results (no pictures).
import { boot, S, FF } from './_sp.mjs';
const h = await boot({ w: 750, h: 470, query: '?tier=low', wait: 5000 });
const log = (...a) => console.log(...a);
const run = async (label, until = '() => !window.cosmos.space.trip', maxIter = 400, warpAt = 60) => {
  for (let i = 0; i < maxIter; i++) {
    await FF(h, 6, 0.1, until);
    const s = await S(h);
    if (s.phase === 'transit' && s.warp === 1 && warpAt) await h.page.evaluate((w) => window.cosmos.space.setWarp(w), warpAt);
    if (!s.phase) break;
  }
  log(label, JSON.stringify(await S(h)));
};
// 1. Phobos -> Deimos directly, then Deimos -> Phobos
await h.page.evaluate(() => { const c = window.cosmos; c.space.debugLand('phobos'); c.ship.teleport('pilot'); for (let i = 0; i < 5; i++) c.step(1 / 60); log2(c.space.engage('deimos')); function log2(x) { window.__e = x; } });
log('engage phobos->deimos', JSON.stringify(await h.page.evaluate(() => window.__e)));
await run('landed Deimos');
await h.page.evaluate(() => { window.__e = window.cosmos.space.engage('phobos'); });
log('engage deimos->phobos', JSON.stringify(await h.page.evaluate(() => window.__e)));
await run('landed Phobos again');
// 2. cancel mid-transit, then a new course from open space
await h.page.evaluate(() => { window.__e = window.cosmos.space.engage('orbit'); });
await FF(h, 400, 0.2, '() => window.cosmos.space.trip && window.cosmos.space.trip.phase === "transit"');
await FF(h, 30, 0.1);
const before = await S(h);
await h.page.evaluate(() => { window.__e = window.cosmos.space.cancel(); });
log('cancel', JSON.stringify(await h.page.evaluate(() => window.__e)), JSON.stringify(before));
await h.page.evaluate(() => window.cosmos.space.setWarp(60));
await FF(h, 600, 0.1, '() => !window.cosmos.space.trip');
log('after cancel (holding in space)', JSON.stringify(await S(h)));
await FF(h, 20, 0.1);
log('still holding', JSON.stringify(await S(h)));
await h.page.evaluate(() => { window.__e = window.cosmos.space.engage('port'); });
log('engage port from space', JSON.stringify(await h.page.evaluate(() => window.__e)));
await run('back at the port');
// 3. the stick takes over during the climb (below the air: refused above 60 m/s; allowed slow), then engines too low
await h.page.evaluate(() => { const c = window.cosmos; c.space.engage('phobos'); });
await FF(h, 400, 0.2, '() => window.cosmos.ship.flight.agl > 1000');
await h.page.evaluate(() => { const c = window.cosmos; c.desktop.keys.add('KeyW'); });
await FF(h, 3, 0.1);
await h.page.evaluate(() => { window.cosmos.desktop.keys.clear(); });
log('stick during a fast climb (refused: pods cannot brake)', JSON.stringify(await S(h)), JSON.stringify(await h.page.evaluate(() => window.cosmos.space.log.slice(-1)[0].text)));
await h.page.evaluate(() => { window.__e = window.cosmos.space.cancel(); });
log('cancel climb', JSON.stringify(await h.page.evaluate(() => window.__e)));
await run('climb run out', '() => !window.cosmos.space.trip', 400, 60);
log('state', JSON.stringify(await S(h)));
await h.page.evaluate(() => { const c = window.cosmos; c.ship.flight.routePower('engines', 12); window.__e = c.space.engage('phobos'); });
log('engines at 12%', JSON.stringify(await h.page.evaluate(() => window.__e)));
await h.browser.close();
