// space-fix: the hired pilot flies; talk to them for the course status and time compression; compression in the climb and the landing.
import { boot, S, FF } from './_sp.mjs';
const h = await boot({ w: 900, h: 640, query: '?tier=low', wait: 4000 });
await h.page.waitForFunction(() => window.cosmos.crew, null, { timeout: 90000 });
await h.page.waitForTimeout(3000);
const log = (...a) => console.log(...a);
await h.page.evaluate(() => { const c = window.cosmos; c.ship.boardAt(0, 0, 14, 0); c.crew.debugCrewUp(); });
await FF(h, 90, 0.05);
await h.page.evaluate(() => { const c = window.cosmos; c.ship.stations.stand(); c.ship.teleport('bridge'); });
await FF(h, 2, 0.05);
log('order', JSON.stringify(await h.page.evaluate(() => window.cosmos.crew.order('goto', { id: 'sp:phobos' }))));
// talk to the pilot (the one flying)
const open = () => h.page.evaluate(() => { const c = window.cosmos, ui = c.crewUI; const m = c.crew.members.get('pilot'); ui.openFor(m); ui._sig = ''; ui._draw(); return ui.panel.innerText.split('\n').slice(0, 14).join(' | '); });
await FF(h, 20, 0.1);
log('panel in the climb:', await open());
await h.shot('f01_a_pilot_panel_in_the_climb');
// press x20 in the panel
await h.page.evaluate(() => { const b = document.querySelector('#crew-panel [data-a="warp"][data-w="20"]'); b.click(); });
let tClimb = 0; const t0 = await h.page.evaluate(() => window.cosmos.engine.timeSec);
for (let i = 0; i < 400; i++) { await FF(h, 1, 0.05); const s = await S(h); if (s.phase !== 'ascent' && s.phase !== 'lift') break; if (i === 4) { await open(); await h.shot('f01_b_x20_in_the_climb_effective_warp_shown'); } }
log('climb real seconds at x20:', ((await h.page.evaluate(() => window.cosmos.engine.timeSec)) - t0).toFixed(0), JSON.stringify(await S(h)));
log('panel in the drive:', await open());
await h.shot('f01_c_pilot_panel_in_the_drive');
await h.page.evaluate(() => document.querySelector('#crew-panel [data-a="warp"][data-w="60"]').click());
await FF(h, 900, 0.1, '() => window.cosmos.space.trip.phase !== "transit"');
log('after drive', JSON.stringify(await S(h)));
// landing on Phobos at x60: how long, and the last 400 m
const t1 = await h.page.evaluate(() => window.cosmos.engine.timeSec); const eff = [];
for (let i = 0; i < 600; i++) { await FF(h, 0.5, 0.05); const s = await h.page.evaluate(() => ({ p: window.cosmos.space.trip && window.cosmos.space.trip.phase, e: window.cosmos.space.trip && window.cosmos.space.trip.eff, agl: window.cosmos.ship.flight.agl })); if (!s.p) break; if (s.p === 'descent') eff.push([Math.round(s.agl), s.e]); }
log('Phobos descent real seconds at x60:', ((await h.page.evaluate(() => window.cosmos.engine.timeSec)) - t1).toFixed(0), 'effective x by height (every ~10th):', JSON.stringify(eff.filter((_, i) => i % 10 === 0)));
log('landed', JSON.stringify(await S(h)));
// home: Mars descent from 120 km, compressed
await h.page.evaluate(() => { const c = window.cosmos; c.ship.stations.stand(); c.ship.teleport('bridge'); window.__r = c.crew.order('goto', { id: 'sp:port' }); });
log('order home', JSON.stringify(await h.page.evaluate(() => window.__r)));
await FF(h, 60, 0.1, '() => window.cosmos.space.trip && window.cosmos.space.trip.phase === "transit"');
await h.page.evaluate(() => window.cosmos.space.setWarp(60));
await FF(h, 900, 0.1, '() => window.cosmos.space.trip.phase === "descent"');
await h.page.evaluate(() => { const ui = window.cosmos.crewUI, c = window.cosmos; ui.openFor(c.crew.members.get('pilot')); });
const t2 = await h.page.evaluate(() => window.cosmos.engine.timeSec); const eff2 = []; let shot = false;
for (let i = 0; i < 1200; i++) { await FF(h, 0.5, 0.05); const s = await h.page.evaluate(() => ({ p: window.cosmos.space.trip && window.cosmos.space.trip.phase, e: window.cosmos.space.trip && window.cosmos.space.trip.eff, agl: window.cosmos.ship.flight.agl, v: window.cosmos.ship.flight.verticalSpeed })); if (!s.p) break; eff2.push([Math.round(s.agl), s.e, Math.round(s.v)]); if (!shot && s.agl < 60000) { shot = true; await open(); await h.shot('f01_d_mars_descent_at_x60_panel_with_time_left'); } }
log('Mars descent (120 km) real seconds at x60:', ((await h.page.evaluate(() => window.cosmos.engine.timeSec)) - t2).toFixed(0));
log('(height, effective x, vs) samples:', JSON.stringify(eff2.filter((_, i) => i % 12 === 0)));
log('home', JSON.stringify(await S(h)), 'hull', await h.page.evaluate(() => window.cosmos.ship.flight.hull), 'lastTouchdown', JSON.stringify(await h.page.evaluate(() => window.cosmos.ship.flight.lastTouchdown)));
await h.browser.close();
