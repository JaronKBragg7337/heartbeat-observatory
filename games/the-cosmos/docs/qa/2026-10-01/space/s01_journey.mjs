// Review 1: Mars -> Phobos on the nav computer, desktop (high tier). Writes s01_*.jpg next to this file.
import { boot, S, FF } from './_sp.mjs';
const h = await boot({ w: 1280, h: 720, query: '?tier=high', wait: 9000 });
const log = (...a) => console.log(...a);
const sh = (n) => h.shot('s01_' + n);
// a. Phobos from the spawn, through a long lens
await h.page.evaluate(() => {
  const c = window.cosmos, e = c.engine, P = c.space.worlds.get('phobos').body.centre; const cam = { x: c.walker.worldPos.x, y: c.walker.worldPos.y, z: c.walker.worldPos.z };
  const eye = { x: cam.x, y: cam.y, z: cam.z }; const up = Math.hypot(eye.x, eye.y, eye.z);
  eye.x *= 1 + 1.7 / up; eye.y *= 1 + 1.7 / up; eye.z *= 1 + 1.7 / up;
  c.freeCam.set(eye, P); e.camera.fov = 5; e.camera.updateProjectionMatrix(); for (let i = 0; i < 6; i++) c.step(1 / 60);
});
await sh('a_phobos_from_the_port_5deg_lens');
await h.page.evaluate(() => { const c = window.cosmos; c.freeCam.off(); c.engine.camera.fov = 72; c.engine.camera.updateProjectionMatrix(); c.ship.teleport('pilot'); c.step(1 / 60); });
await sh('b_pilot_seat_on_the_pad');
// open the nav sheet and plot the course
await h.page.evaluate(() => { window.cosmos.space.ui.toggle('course'); });
await FF(h, 1, 0.1);
await sh('c_nav_computer_course_list');
await h.page.evaluate(() => { window.cosmos.space.ui.toggle('jobs'); }); await h.page.evaluate(() => window.cosmos.step(1 / 30));
await h.page.evaluate(() => { window.cosmos.space.ui.tab = 'jobs'; window.cosmos.space.ui.draw(true); });
await sh('d_jobs_board');
await h.page.evaluate(() => { const sp = window.cosmos.space; sp.ui.tab = 'course'; sp.ui.draw(true); sp.engage('phobos'); });
// climb
const snapAt = async (alt, name, off = [38, 10, 46], look = [0, 2, -4]) => { await FF(h, 400, 0.2, `() => window.cosmos.ship.flight.agl >= ${alt}`); await sh(name + '_cockpit'); await h.page.evaluate(([o, l]) => window.ext(o, l), [off, look]); await sh(name + '_outside'); await h.page.evaluate(() => window.extOff()); log(name, JSON.stringify(await S(h))); };
await snapAt(900, 'e_900m');
await snapAt(1800, 'f_1800m_neutral_line');
await snapAt(30000, 'g_30km', [38, 10, 46], [0, 2, -4]);
await snapAt(95000, 'h_95km');
await FF(h, 400, 0.2, '() => window.cosmos.space.trip.phase === "transit"');
await h.page.evaluate(() => window.cosmos.space.ui.draw(true));
await FF(h, 3, 0.05);
await sh('i_main_drive_lit_panel_with_time_compression');
await h.page.evaluate(() => window.ext([40, 14, 50], [0, 2, -4])); await sh('j_ship_burning_from_outside'); await h.page.evaluate(() => window.extOff());
// the cabin during cruise: the lounge window and binoculars
await h.page.evaluate(() => { const c = window.cosmos; c.ship.stations.stand(); c.ship.boardAt(5.0, 3, 0.1, Math.PI / 2 + 0.35); c.space.setWarp(5); c.space.ui.close(); });
await FF(h, 40, 0.1);
await sh('k_lounge_window_during_cruise_x5');
await h.page.evaluate(() => { const c = window.cosmos; c.space.setWarp(20); });
await FF(h, 15, 0.1);
log('cruise', JSON.stringify(await S(h)));
await sh('l_lounge_window_x20');
await h.page.evaluate(() => window.ext([-45, 10, 60], [0, 2, -5])); await sh('m_mid_transit_from_outside'); await h.page.evaluate(() => window.extOff());
// the turn-over: run at x20 until the computer commits to it, then slow to x1 and watch the nose swing round
await FF(h, 600, 0.05, '() => window.cosmos.space.trip.progress.stage === "flip"');
await h.page.evaluate(() => { window.cosmos.space.setWarp(1); });
await FF(h, 6, 0.1);
log('flip', JSON.stringify(await S(h)));
await h.page.evaluate(() => window.ext([40, 14, 55], [0, 2, -4])); await sh('n_the_turn_over_nose_swinging_round'); await h.page.evaluate(() => window.extOff());
await FF(h, 14, 0.1);
await h.page.evaluate(() => window.ext([-40, 14, 55], [0, 2, -4])); await sh('n2_twenty_seconds_into_the_turn'); await h.page.evaluate(() => window.extOff());
await h.page.evaluate(() => { const c = window.cosmos; c.space.setWarp(60); });
await FF(h, 400, 0.1, '() => window.cosmos.space.trip.phase === "settle" || window.cosmos.space.trip.phase === "descent"');
await FF(h, 14, 0.1);
log('arrived', JSON.stringify(await S(h)));
await h.page.evaluate(() => window.ext([42, 10, 55], [0, 0, -4])); await sh('o_over_phobos_at_the_standoff_point'); await h.page.evaluate(() => window.extOff());
await FF(h, 400, 0.1, '() => window.cosmos.ship.flight.agl < 160');
await h.page.evaluate(() => window.cosmos.ship.stations.stand());
await h.page.evaluate(() => { const c = window.cosmos; c.ship.teleport('pilot'); c.ship.look.pitch = -0.9; c.ship.look.yaw = 0; });
await FF(h, 1, 0.05);
await sh('p_descent_looking_down_through_the_canopy');
await FF(h, 400, 0.1, '() => !window.cosmos.space.trip');
await FF(h, 5, 0.1);
log('landed', JSON.stringify(await S(h)));
await h.page.evaluate(() => window.ext([36, 8, 44], [0, 2, -3])); await sh('q_down_on_the_stickney_east_pad'); await h.page.evaluate(() => window.extOff());
await h.browser.close();
