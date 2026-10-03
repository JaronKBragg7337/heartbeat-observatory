// Rover pictures: node rover.mjs <prefix>. Opening scenes (the ride) and the hold (the shared vehicle).
import { open } from './lib.mjs';
const prefix = process.env.PREFIX || 'before';
async function opening(phone) {
  const tag = phone ? 'p' : 'd';
  const h = await open({ w: phone ? 390 : 1280, h: phone ? 844 : 720, query: '?dev=1&solo=1&' + (phone ? 'tier=low&depth=16' : 'tier=high'), wait: 9000 }, prefix + '-' + tag);
  try {
    await h.page.waitForFunction(() => window.cosmos?.opening && cosmos.engine.frameCount >= 2, null, { timeout: 120000 });
    await h.page.evaluate(async () => { cosmos.engine.stop(); await cosmos.opening.ready; cosmos.opening.savePose = () => {}; cosmos.step(0); });
    const toward = (n, stage) => h.page.evaluate(({ n }) => {
      const o = cosmos.opening, m = o.model, w = m.walker;
      o.state.stage = 3; o.stage = 3; o.contactSeconds = 9; o.state.ride = false; o.elapsed = 60; o.cabin.root.visible = true;
      const [x, z, tx, ty, tz, y] = n;
      m.place({ x, y: y ?? m.height(x, z), z, yaw: 0, pitch: 0 }); cosmos.step(0);
      const e = w.eyeWorldPos({}), p = m.toWorld(tx, ty, tz), f = w.updateFrame();
      const d = { x: p.x - e.x, y: p.y - e.y, z: p.z - e.z }, l = Math.hypot(d.x, d.y, d.z), dot = u => d.x * u.x + d.y * u.y + d.z * u.z;
      w.yaw = Math.atan2(dot(f.east), dot(f.north)); w.pitch = Math.asin(dot(f.up) / l); cosmos.step(0); cosmos.step(0);
    }, { n });
    // rover stands at (-7, 23); camera positions around it
    const SPOTS = [['front34', [-2.5, 17.5, -7, 1.1, 23]], ['side', [-2, 23.5, -7, 1.1, 23]], ['rear34', [-11, 29, -7, 1.1, 23]], ['close-cab', [-4.6, 20.2, -7, 1.35, 23]], ['high', [-9, 20, -7, 1.0, 23, null]]];
    for (const [name, n] of SPOTS) { await toward(n); await h.shot('rover-' + name); }
    const ride = (secs, yaw, pitch) => h.page.evaluate(([secs, yaw, pitch]) => {
      const o = cosmos.opening; o.state.stage = 4; o.stage = 4; o.state.ride = true; o.rideSeconds = secs; o.state.rideSeconds = secs; o.rideYaw = yaw; o.ridePitch = pitch; o.elapsed = 60;
      cosmos.step(0); cosmos.step(0);
    }, [secs, yaw, pitch]);
    await ride(3, 0, 0); await h.shot('ride-1-start');
    await ride(3, -0.7, -0.1); await h.shot('ride-2-driver');
    await ride(3, 0.6, 0.05); await h.shot('ride-3-window');
    await ride(30, 0, 0.05); await h.shot('ride-4-lights');
    await ride(30, 0, -0.55); await h.shot('ride-5-dash');
  } finally { await h.browser.close(); }
}
await opening(false);
await opening(true);
