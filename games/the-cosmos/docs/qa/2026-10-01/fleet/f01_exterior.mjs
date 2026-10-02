// the Shrike raider from outside: several angles, on the pad, in daylight
import { boot } from './_fl.mjs';
const h = await boot({ wait: 7000, w: 1000, h: 600 });
await h.page.evaluate(() => { const s = window.cosmos.ship; s.aboard = false; });
const E = async (name, off, look) => { await h.page.evaluate(([o, l]) => window.ext(o, l), [off, look]); await h.page.waitForTimeout(700); await h.shot(name); };
await E('f01_a_three_quarter_front', [-20, 6, -26], [0, 1.5, -2]);
await E('f01_b_port_side', [-30, 3.5, 0], [0, 1.5, 0]);
await E('f01_c_stern_ramp_down', [8, 3.5, 30], [0, 1.2, 12]);
await E('f01_d_high_overhead', [-6, 28, 8], [0, 1, 0]);
await E('f01_e_nose_head_on', [3, 2.4, -30], [0, 1.2, -8]);
await E('f01_f_starboard_stern_quarter', [22, 5, 22], [0, 1.5, 3]);
await h.browser.close();
