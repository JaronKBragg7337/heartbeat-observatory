// Review 2: on foot on Phobos, desktop (high tier). Writes s02_*.jpg.
import { boot, S, FF, stand } from './_sp.mjs';
const h = await boot({ w: 1280, h: 720, query: '?tier=high', wait: 9000 });
const log = (...a) => console.log(...a);
const sh = (n) => h.shot('s02_' + n);
const r = await h.page.evaluate(() => { const c = window.cosmos; const r = c.space.debugLand('phobos'); c.ship.teleport('cargo'); for (let i = 0; i < 5; i++) c.step(1 / 60); return r; });
log('land', JSON.stringify(r));
// the ramp, then walk off it with the real walker
await h.page.evaluate(() => { const c = window.cosmos; if (!c.ship.state.ramps.cargo.lowered && c.ship.rampCtl.cargo.target < 0.5) c.ship.toggleRamp('cargo'); });
await FF(h, 9, 0.1);
await h.page.evaluate(() => { const c = window.cosmos; c.ship.sw.place(0, 0, 14, 0); c.ship.sw.yaw = Math.PI; c.ship.sw.pitch = -0.25; });
await FF(h, 0.5, 0.05); await sh('a_cargo_bay_looking_down_the_ramp_at_phobos');
await h.page.evaluate(() => { window.cosmos.desktop.keys.add('KeyW'); });
for (let i = 0; i < 60; i++) { await FF(h, 0.5, 0.05); if (!(await h.page.evaluate(() => window.cosmos.ship.aboard))) break; }
await h.page.evaluate(() => window.cosmos.desktop.keys.clear());
await FF(h, 14, 0.05);
log('off', JSON.stringify(await h.page.evaluate(() => { const c = window.cosmos, w = c.walker; return { aboard: c.ship.aboard, grounded: w.grounded, body: w.body.id, talk: document.getElementById('crew-talk') && document.getElementById('crew-talk').style.display }; })));
await sh('b_stepped_off_the_ramp');
await h.page.evaluate(() => { const c = window.cosmos; c.walker.yaw += Math.PI; c.walker.pitch = -0.05; c.step(1 / 30); });
await sh('c_turned_round_the_ship_on_its_pad');
// spots around the pad
await stand(h, 70, 20, 4.7, -0.03); await sh('d_ship_and_pad_from_70m');
await stand(h, 70, 20, 1.2, 0.1); await sh('e_the_ground_to_the_east');
await h.page.evaluate(() => { const c = window.cosmos; c.walker.pitch = -0.7; c.step(1 / 30); }); await sh('f_regolith_underfoot');
await stand(h, 45, 20, 0, 0.95); await sh('g_mars_hanging_over_phobos');
// Stickney: look toward it
await stand(h, 40, 30, 0, 0.1);
await h.page.evaluate(() => { const c = window.cosmos, b = c.space.worlds.get('phobos').body, w = c.walker, L = b.landmarks[0], la = L.lat * Math.PI / 180, lo = L.bodyLon * Math.PI / 180; const T = b.fromBody(Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la), {}); const R = b.surfaceRadius(T.x, T.y, T.z); const f = w.updateFrame(); const d = { x: T.x * R - w.worldPos.x, y: T.y * R - w.worldPos.y, z: T.z * R - w.worldPos.z }; const e = d.x * f.east.x + d.y * f.east.y + d.z * f.east.z, n = d.x * f.north.x + d.y * f.north.y + d.z * f.north.z; w.yaw = Math.atan2(e, n); w.pitch = 0.05; c.step(1 / 30); });
await sh('h_toward_stickney_the_big_crater');
// the distress beacon's cargo module
await h.page.evaluate(() => { const c = window.cosmos, sp = c.space, b = sp.worlds.get('phobos').body, dl = b.derelict, w = c.walker, l = Math.hypot(dl.point.x, dl.point.y, dl.point.z); const f = w.updateFrame(); w.worldPos.x = dl.point.x * (1 + 0.03 / l) + f.east.x * 14 + f.north.x * 4; w.worldPos.y = dl.point.y * (1 + 0.03 / l) + f.east.y * 14 + f.north.y * 4; w.worldPos.z = dl.point.z * (1 + 0.03 / l) + f.east.z * 14 + f.north.z * 4; const k = Math.hypot(w.worldPos.x, w.worldPos.y, w.worldPos.z), R = b.surfaceRadius(w.worldPos.x / k, w.worldPos.y / k, w.worldPos.z / k); w.worldPos.x *= (R + 0.03) / k; w.worldPos.y *= (R + 0.03) / k; w.worldPos.z *= (R + 0.03) / k; w.grounded = true; sp.worlds.get('phobos').force(w.worldPos); const f2 = w.updateFrame(); const d = { x: dl.point.x - w.worldPos.x, y: dl.point.y - w.worldPos.y, z: dl.point.z - w.worldPos.z }; w.yaw = Math.atan2(d.x * f2.east.x + d.y * f2.east.y + d.z * f2.east.z, d.x * f2.north.x + d.y * f2.north.y + d.z * f2.north.z); w.pitch = 0.05; for (let i = 0; i < 8; i++) c.step(1 / 30); });
await sh('p_the_distress_beacon_cargo_module');
await h.page.evaluate(() => { const c = window.cosmos, b = c.space.worlds.get('phobos').body, dl = b.derelict, w = c.walker, l = Math.hypot(dl.point.x, dl.point.y, dl.point.z); const f = w.updateFrame(); w.worldPos.x = dl.point.x * (1 + 0.03 / l) + f.east.x * 4; w.worldPos.y = dl.point.y * (1 + 0.03 / l) + f.east.y * 4; w.worldPos.z = dl.point.z * (1 + 0.03 / l) + f.east.z * 4; for (let i = 0; i < 14; i++) c.step(1 / 30); });
log('ctx3', await h.page.evaluate(() => document.getElementById('btn-action').textContent));
await h.page.evaluate(() => { const c = window.cosmos; c.space.jobs.contextAction(false).run(); for (let i = 0; i < 4; i++) c.step(1 / 30); });
await sh('q_salvaged_toast_and_alloy_in_the_hold');
// a hop
await stand(h, 40, 30, 0.6, 0.05);
await h.page.evaluate(() => { const c = window.cosmos; c.desktop.keys.add('Space'); c.step(1 / 30); c.desktop.keys.delete('Space'); });
await FF(h, 60, 0.1);
log('hop', JSON.stringify(await h.page.evaluate(() => { const w = window.cosmos.walker; return { grounded: w.grounded, hud: document.getElementById('hud').innerText.split('\n')[2] }; })));
await h.page.evaluate(() => { window.cosmos.walker.pitch = -0.5; window.cosmos.step(1 / 30); }); await sh('i_mid_hop_sixty_seconds_up_looking_down');
await FF(h, 400, 0.2, '() => window.cosmos.walker.grounded');
// the sample marker, the sample
await h.page.evaluate(() => { const c = window.cosmos, sp = c.space, s = sp.jobs.sites[0], w = c.walker, f = w.updateFrame(); const l = Math.hypot(s.point.x, s.point.y, s.point.z); w.worldPos.x = s.point.x * (1 + 0.02 / l) + f.east.x * 6; w.worldPos.y = s.point.y * (1 + 0.02 / l) + f.east.y * 6; w.worldPos.z = s.point.z * (1 + 0.02 / l) + f.east.z * 6; const R = sp.worlds.get('phobos').body.surfaceRadius(w.worldPos.x / Math.hypot(w.worldPos.x, w.worldPos.y, w.worldPos.z), w.worldPos.y / Math.hypot(w.worldPos.x, w.worldPos.y, w.worldPos.z), w.worldPos.z / Math.hypot(w.worldPos.x, w.worldPos.y, w.worldPos.z)); const k = Math.hypot(w.worldPos.x, w.worldPos.y, w.worldPos.z); w.worldPos.x *= (R + 0.03) / k; w.worldPos.y *= (R + 0.03) / k; w.worldPos.z *= (R + 0.03) / k; w.grounded = true; sp.worlds.get('phobos').force(w.worldPos); const d = { x: s.point.x - w.worldPos.x, y: s.point.y - w.worldPos.y, z: s.point.z - w.worldPos.z }; const f2 = w.updateFrame(); w.yaw = Math.atan2(d.x * f2.east.x + d.y * f2.east.y + d.z * f2.east.z, d.x * f2.north.x + d.y * f2.north.y + d.z * f2.north.z); w.pitch = 0.05; for (let i = 0; i < 8; i++) c.step(1 / 30); });
await sh('j_a_sample_site_beacon_6m_away');
await h.page.evaluate(() => { const c = window.cosmos, w = c.walker, f = w.updateFrame(); const s = c.space.jobs.sites[0]; const l = Math.hypot(s.point.x, s.point.y, s.point.z); w.worldPos.x = s.point.x * (1 + 0.03 / l) + f.east.x * 1.5; w.worldPos.y = s.point.y * (1 + 0.03 / l) + f.east.y * 1.5; w.worldPos.z = s.point.z * (1 + 0.03 / l) + f.east.z * 1.5; for (let i = 0; i < 14; i++) c.step(1 / 30); });
log('ctx', await h.page.evaluate(() => document.getElementById('btn-action').textContent));
await sh('k_take_core_sample_button');
await h.page.evaluate(() => { const c = window.cosmos; const a = c.space.jobs.contextAction(false); const r = a.run(); for (let i = 0; i < 5; i++) c.step(1 / 30); });
await sh('l_sample_sealed_beacon_green');
// dig with the bucket, pour a heap
await h.page.evaluate(() => { const c = window.cosmos, w = c.walker; c.setTool(2); w.pitch = -0.75; w.yaw += 1.2; c.step(1 / 30); });
const dug = await h.page.evaluate(() => { const c = window.cosmos, out = []; for (let k = 0; k < 6; k++) { const r = c.doDig(); out.push(r.ok ? r.lot.materialName + ' ' + Math.round(r.lot.massKg) : r.msg); c.step(1 / 30); } return out; });
log('dug', JSON.stringify(dug));
await FF(h, 1, 0.05);
await sh('m_bucket_cuts_a_pit_in_phobos_regolith');
await h.page.evaluate(() => { const c = window.cosmos; c.walker.pitch = -0.2; for (let k = 0; k < 3; k++) c.doDump(); for (let i = 0; i < 40; i++) c.step(1 / 30); });
await sh('n_the_spoil_poured_as_a_heap_beside_the_pit');
// back to the hopper, stow
await h.page.evaluate(() => { const c = window.cosmos; c.setTool(2); c.walker.pitch = -0.9; c.step(1 / 30); for (let k = 0; k < 3; k++) c.doDig(); c.step(1 / 30); });
await stand(h, 20, 8, 3.0, 0.0);
log('ctx2', await h.page.evaluate(() => document.getElementById('btn-action').textContent));
await sh('o_near_the_ship_with_a_full_hopper');
await h.browser.close();
