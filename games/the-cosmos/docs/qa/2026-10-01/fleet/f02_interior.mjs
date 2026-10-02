// the Shrike from inside: every room, at Meridian-level detail
import { boot } from './_fl.mjs';
const h = await boot({ wait: 7000, w: 1000, h: 600 });
const A = async (name, room, x, z, yaw, pitch = 0) => {
  const r = await h.page.evaluate(([room, x, z, yaw, pitch]) => window.cosmos.at(room, x, z, yaw, pitch, 14), [room, x, z, yaw, pitch]);
  await h.page.waitForTimeout(500); await h.shot(name); console.log(name, JSON.stringify(r));
};
await A('f02_a_cockpit_from_the_door', 'cockpit', 0, -9.2, 0, -4);
await A('f02_b_cockpit_seats_from_the_side', 'cockpit', -2.3, -9.4, 52, -12);
await A('f02_c_corridor_looking_aft', 'corridor_main', 0, -7.4, 180, 0);
await A('f02_d_crew_quarters', 'crew_a', -1.8, -6.8, -65, -5);
await A('f02_e_mess', 'galley', 1.9, -7.0, 70, -5);
await A('f02_f_airlock', 'airlock', -1.6, 1.8, -90, -3);
await A('f02_g_armoury', 'armoury', 1.5, -0.7, 90, -3);
await A('f02_h_turret_niche_ladder', 'niche', 1.5, 2.6, 90, 0);
await A('f02_i_engine_room', 'engine', 0.0, 5.0, 150, -5);
await A('f02_j_cargo_hold_to_the_ramp', 'hold', 0, 10.4, 180, -4);
await A('f02_k_cargo_hold_looking_forward', 'hold', 0, 15.2, 0, 0);
await h.browser.close();
