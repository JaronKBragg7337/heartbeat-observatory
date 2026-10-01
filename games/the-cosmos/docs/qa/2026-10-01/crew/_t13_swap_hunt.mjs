import { SIM } from './_lib2.mjs';
const W = Number(process.env.W || 750), H = Number(process.env.H || 470), pre = process.env.PRE || 'a';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: H, query: process.env.QUERY || '' });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(SIM);
  await page.evaluate(() => { ['pilot', 'captain', 'nav', 'gunner_dorsal', 'gunner_ventral'].forEach(id => window.cosmos.crew.hire(id)); window.__sim(75); const c = window.cosmos; c.ship.aboard = true; c.ship.sw.place(0, 6, -12.6, 0); window.__sim(0.3); });
  // 1. the player sits in the pilot's seat: Ada gets up and stands clear
  await page.evaluate(() => { const c = window.cosmos; c.ship.takeSeat('pilot'); window.__sim(2.5); });
  const ada = await page.evaluate(() => { const m = window.cosmos.crew.members.get('pilot'); return `${m.mode} displaced=${m.displaced} at (${m.sw.x.toFixed(1)},${m.sw.z.toFixed(1)})`; });
  console.log('Ada after the player sat:', ada);
  await page.evaluate(() => { const c = window.cosmos; c.ship.look.yaw = 1.4; c.ship.look.pitch = -0.1; window.__sim(0.2); c.step(1 / 60); });
  await shot(pre + '_swap01_player_in_pilot_seat_ada_stands_aside');
  await page.evaluate(() => { const c = window.cosmos; c.ship.look.yaw = -0.8; c.ship.look.pitch = -0.05; window.__sim(0.2); c.step(1 / 60); });
  await shot(pre + '_swap02_looking_at_the_captain');
  await page.evaluate(() => { const c = window.cosmos; c.ship.stations.stand(); window.__sim(6); });
  console.log('Ada after the player stood:', await page.evaluate(() => { const m = window.cosmos.crew.members.get('pilot'); return `${m.mode} seated=${m.seated} displaced=${m.displaced}`; }));
  // 2. a hunt, seen from outside: wait for bolts
  await page.evaluate(() => { const c = window.cosmos; c.ship.aboard = true; c.ship.sw.place(0, 3, 0, 0); console.log(JSON.stringify(c.crew.order('hunt'))); window.__sim(185); });
  let n = 0, got = false;
  while (n++ < 120 && !got) {
    got = await page.evaluate(() => {
      window.__sim(0.5, 1 / 30);
      const c = window.cosmos, g = c.ship.guns, D = c.ship.drones;
      const live = D.drones.filter(d => d.state !== 'away' && d.target.hp > 0);
      return g.bolts.length > 2 && live.length > 0 && Math.hypot(...['x', 'y', 'z'].map(k => live[0].pos[k] - c.ship.flight.pos[k])) < 500;
    });
  }
  console.log('bolts in flight:', got, 'after', n * 0.5, 's');
  const info = await page.evaluate(() => {
    const c = window.cosmos, f = c.ship.flight, D = c.ship.drones;
    const d = D.drones.filter(x => x.state !== 'away' && x.target.hp > 0)[0];
    const sp = { x: f.pos.x, y: f.pos.y, z: f.pos.z };
    // a camera off the ship's starboard quarter, looking toward the drone
    const eye = f.toWorld({ x: 22, y: 12, z: 18 }); const mid = d ? { x: (d.pos.x + sp.x) / 2, y: (d.pos.y + sp.y) / 2, z: (d.pos.z + sp.z) / 2 } : f.toWorld({ x: 0, y: 3, z: -30 });
    c.freeCam.set(eye, mid); for (let i = 0; i < 3; i++) c.step(1 / 60);
    return { drone: d ? Math.hypot(d.pos.x - sp.x, d.pos.y - sp.y, d.pos.z - sp.z).toFixed(0) : null, kills: c.crew.kills, hull: f.hull.toFixed(0) };
  });
  console.log(JSON.stringify(info));
  await shot(pre + '_hunt01_from_outside_with_bolts');
  await page.evaluate(() => { const c = window.cosmos, f = c.ship.flight; c.freeCam.set(f.toWorld({ x: -14, y: 4, z: -30 }), f.toWorld({ x: 0, y: 3, z: 0 })); for (let i = 0; i < 3; i++) c.step(1 / 60); });
  await shot(pre + '_hunt02_the_meridian_at_altitude');
  await page.evaluate(() => { window.cosmos.freeCam.off(); const c = window.cosmos; c.ship.teleport('gun_dorsal'); window.__sim(0.2); });
  await shot(pre + '_hunt03_in_the_dorsal_nest_while_the_npc_gunner_works');
  await browser.close();
};
