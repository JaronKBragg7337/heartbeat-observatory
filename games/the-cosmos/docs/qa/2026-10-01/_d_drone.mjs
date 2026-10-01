const q = process.env.QUERY || '';
const W = Number(process.env.W || 750), Hh = Number(process.env.H || 470);
const pre = process.env.PRE || 'drone';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: Hh, query: q });
  const { page, shot, browser } = h;
  const info = await page.evaluate(() => {
    const c = window.cosmos, f = c.ship.flight, D = c.drones();
    const sun = c.engine.scene.children.find((o) => o.isDirectionalLight);
    const sd = sun.position.clone().normalize();        // direction TO the sun, world axes
    const up = (p) => { const l = Math.hypot(p.x, p.y, p.z); return { x: p.x / l, y: p.y / l, z: p.z / l }; };
    const add = (a, b, k) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
    const sunV = { x: sd.x, y: sd.y, z: sd.z };
    window.__sun = sunV;
    window.__at = (p) => f.toWorld(p);
    // a point on the sun's side of `p`, `d` metres off, `lift` metres up, swung `side` metres sideways
    window.__lit = (p, d, lift, side) => {
      const u = up(p), s = sunV;
      const hs = { x: s.x - u.x * (s.x * u.x + s.y * u.y + s.z * u.z), y: s.y - u.y * (s.x * u.x + s.y * u.y + s.z * u.z), z: s.z - u.z * (s.x * u.x + s.y * u.y + s.z * u.z) };
      const hl = Math.hypot(hs.x, hs.y, hs.z); hs.x /= hl; hs.y /= hl; hs.z /= hl;
      const sideV = { x: u.y * hs.z - u.z * hs.y, y: u.z * hs.x - u.x * hs.z, z: u.x * hs.y - u.y * hs.x };
      return add(add(add(p, hs, d), u, lift), sideV, side);
    };
    window.__pose = (i, p, state = 'attack') => D.debugPose(i, window.__at(p), state);
    window.__camW = (eye, target) => { c.freeCam.set(eye, target); for (let i = 0; i < 4; i++) c.step(1 / 60); };
    return { neutral: D.neutral, states: D.drones.map((d) => d.state), sun: sunV };
  });
  console.log(JSON.stringify(info));
  const pose = async (i, p) => page.evaluate(([i, p]) => window.__pose(i, p).pos, [i, p]);
  // 1. one drone, close, on the lit side
  const dp = await pose(0, { x: 0, y: 13, z: -70 });
  const cam = async (d, lift, side, tgtLift = 0) => page.evaluate(([dp, d, lift, side, tgtLift]) => window.__camW(window.__lit(dp, d, lift, side), { x: dp.x, y: dp.y, z: dp.z }), [dp, d, lift, side, tgtLift]);
  await cam(6.2, 1.8, 2.4); await shot(`${pre}01_drone_lit_three_quarter`);
  await cam(4.6, 0.2, -1.2); await shot(`${pre}02_drone_lit_face_on`);
  await cam(5.5, 5.5, 0.5); await shot(`${pre}03_drone_lit_from_above`);
  // 2. next to the Meridian, for scale, the camera on the sunny side
  const bow = await pose(0, { x: 7, y: 6, z: -32 });
  await page.evaluate((bow) => { const f = window.cosmos.ship.flight; const mid = f.toWorld({ x: 2, y: 5, z: -26 }); window.__camW(window.__lit(mid, 32, 4, 6), mid); }, bow);
  await shot(`${pre}04_drone_beside_the_meridian_bow`);
  const wing = await pose(0, { x: 17, y: 4.5, z: -4 });
  await page.evaluate(() => { const f = window.cosmos.ship.flight; const mid = f.toWorld({ x: 6, y: 4, z: -6 }); window.__camW(window.__lit(mid, 30, 3, 5), mid); });
  await shot(`${pre}05_drone_beside_the_meridian_wing`);
  await pose(0, { x: 4, y: 12, z: -48 }); await pose(1, { x: -22, y: 16, z: -58 }); await pose(2, { x: 30, y: 21, z: -70 });
  await page.evaluate(() => { const f = window.cosmos.ship.flight; const mid = f.toWorld({ x: 0, y: 10, z: -40 }); window.__camW(window.__lit(mid, 90, 12, 0), mid); });
  await shot(`${pre}06_three_drones_and_the_meridian`);
  await browser.close();
};
