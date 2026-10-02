// Looks review, 2026-10-02. Writes jpg into this folder. Run from games/the-cosmos:
//   $env:PORT=8442; node server.js
//   node docs/qa/2026-10-02/looks/shoot.mjs
// Does not touch the 2026-10-01 harness. Port 8442 on purpose (the old space shots use 8421).
import { launch } from '../../2026-10-01/shot.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8442;

async function open(opts) {
  const h = await launch({ w: opts.w, h: opts.h, query: opts.query || '', port: PORT });
  h.shot = async (name) => {
    await h.page.screenshot({ path: path.join(here, name + '.jpg'), type: 'jpeg', quality: 84, timeout: 180000 });
    console.log('shot', name);
  };
  await h.page.waitForTimeout(opts.wait ?? 8000);
  await h.page.evaluate(() => {
    const c = window.cosmos;
    window.ff = (sec, dt = 0.05) => {
      const r = c.engine.renderer, save = r.render;
      r.render = () => {};
      let t = 0;
      try { while (t < sec) { c.step(dt); t += dt; } } finally { r.render = save; }
      return t;
    };
    window.ext = (off, look) => {
      const f = c.ship.flight;
      const e = f.toWorld({ x: off[0], y: off[1], z: off[2] }, {});
      const t = f.toWorld({ x: look[0], y: look[1], z: look[2] }, {});
      c.freeCam.set(e, t);
      for (let i = 0; i < 8; i++) c.step(1 / 60);
    };
  });
  return h;
}

/** On foot, east/north metres from the Phobos pad, compass yaw (0 = north), pitch up. */
async function stand(h, e, n, yaw = 0, pitch = 0) {
  return h.page.evaluate(([e, n, yaw, pitch]) => {
    const c = window.cosmos, sp = c.space;
    if (sp.frameId !== 'phobos') sp.debugLand('phobos');
    const sh = c.ship; sh.aboard = false; if (sh.seat) sh.stations.stand();
    c.freeCam.off();
    const mw = sp.worlds.get('phobos'), b = mw.body, pi = b.padInfo;
    const x = pi.point.x + pi.east.x * e + pi.north.x * n;
    const y = pi.point.y + pi.east.y * e + pi.north.y * n;
    const z = pi.point.z + pi.east.z * e + pi.north.z * n;
    const l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l);
    const w = c.walker;
    w.worldPos.x = x / l * (R + 0.03); w.worldPos.y = y / l * (R + 0.03); w.worldPos.z = z / l * (R + 0.03);
    w.velocity = { x: 0, y: 0, z: 0 }; w.yaw = yaw; w.pitch = pitch; w.grounded = true;
    mw.force(w.worldPos);
    for (let i = 0; i < 10; i++) c.step(1 / 30);
    return { grounded: w.grounded, rock: b.rockRelief(x / l, y / l, z / l) };
  }, [e, n, yaw, pitch]);
}

/** Stand a few metres from a world point on Phobos and look at it. */
async function lookAt(h, point, eastM, northM, pitch) {
  return h.page.evaluate(([px, py, pz, eastM, northM, pitch]) => {
    const c = window.cosmos, sp = c.space, mw = sp.worlds.get('phobos'), b = mw.body, w = c.walker;
    const sh = c.ship; sh.aboard = false; if (sh.seat) sh.stations.stand();
    c.freeCam.off();
    const pi = b.padInfo;
    const x = px + pi.east.x * eastM + pi.north.x * northM;
    const y = py + pi.east.y * eastM + pi.north.y * northM;
    const z = pz + pi.east.z * eastM + pi.north.z * northM;
    const l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l);
    w.worldPos.x = x / l * (R + 0.03); w.worldPos.y = y / l * (R + 0.03); w.worldPos.z = z / l * (R + 0.03);
    w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = true;
    mw.force(w.worldPos);
    for (let i = 0; i < 4; i++) c.step(1 / 30);
    const f = w.updateFrame();
    const d = { x: px - w.worldPos.x, y: py - w.worldPos.y, z: pz - w.worldPos.z };
    w.yaw = Math.atan2(d.x * f.east.x + d.y * f.east.y + d.z * f.east.z, d.x * f.north.x + d.y * f.north.y + d.z * f.north.z);
    w.pitch = pitch;
    for (let i = 0; i < 8; i++) c.step(1 / 30);
    return { yaw: w.yaw, dist: Math.hypot(d.x, d.y, d.z) };
  }, [point.x, point.y, point.z, eastM, northM, pitch]);
}

async function landPhobos(h) {
  const t0 = Date.now();
  const r = await h.page.evaluate(() => {
    const c = window.cosmos;
    const landed = c.space.debugLand('phobos');
    for (let i = 0; i < 20; i++) c.step(1 / 30);
    const jobs = c.space.jobs;
    return {
      landed,
      sites: jobs.sites.length,
      derelict: !!jobs.markers && !!jobs.markers.derelict,
      beacons: jobs.markers ? jobs.markers.sites.size : 0,
    };
  });
  console.log('land', JSON.stringify(r), 'ms', Date.now() - t0);
  return r;
}

async function tallestRock(h) {
  return h.page.evaluate(() => {
    const b = window.cosmos.space.worlds.get('phobos').body, pi = b.padInfo;
    let best = { rock: -1, e: 0, n: 0 };
    for (let e = 90; e <= 420; e += 4) {
      for (let n = -120; n <= 220; n += 4) {
        const x = pi.point.x + pi.east.x * e + pi.north.x * n;
        const y = pi.point.y + pi.east.y * e + pi.north.y * n;
        const z = pi.point.z + pi.east.z * e + pi.north.z * n;
        const l = Math.hypot(x, y, z);
        const rock = b.rockRelief(x / l, y / l, z / l);
        if (rock > best.rock) best = { rock, e, n };
      }
    }
    return best;
  });
}

async function phobosSet(h, tag, onlyGround = false) {
  await landPhobos(h);
  const rock = await tallestRock(h);
  console.log(tag, 'tallest rock', JSON.stringify(rock));

  // The graded pad, eye level, looking out to where the craters take the shade.
  await stand(h, 28, -8, Math.PI / 2, -0.08);
  await h.shot(tag + '_pad_eye_east');
  await stand(h, 18, 6, 0.35, -0.82);
  await h.shot(tag + '_pad_regolith_underfoot');

  // Stand off the stone, not on it, so the crest reads against the sky. The second step is close enough to see the face.
  await stand(h, rock.e - 11, rock.n, Math.atan2(11, 0), -0.04);
  await h.shot(tag + '_boulder_16m');
  await stand(h, rock.e - 5.2, rock.n + 1.4, Math.atan2(5.2, -1.4), -0.28);
  await h.shot(tag + '_boulder_7m');
  await stand(h, rock.e, rock.n, 0.6, -1.05);
  await h.shot(tag + '_boulder_underfoot');
  if (onlyGround) return rock;

  const props = await h.page.evaluate(() => {
    const b = window.cosmos.space.worlds.get('phobos').body;
    const s = b.sampleSites[0];
    return { site: s.point, derelict: b.derelict.point, siteId: s.id };
  });

  await lookAt(h, props.derelict, 14, 8, 0.02);
  await h.shot(tag + '_cargo_quarter');
  await lookAt(h, props.derelict, 5.5, 1.2, -0.02);
  await h.shot(tag + '_cargo_door');
  await lookAt(h, props.derelict, -9, 5, 0.04);
  await h.shot(tag + '_cargo_other_side');
  await lookAt(h, props.derelict, 2, -7, 0.12);
  await h.shot(tag + '_cargo_lamp');

  await lookAt(h, props.site, 6, 1.5, 0.06);
  await h.shot(tag + '_beacon_6m');
  await lookAt(h, props.site, 2.4, 0.6, 0.18);
  await h.shot(tag + '_beacon_close');
  return rock;
}

async function raiderSet(h, tag) {
  // The Shrike is already on the Mars pad when ?ship=raider.
  await h.page.evaluate(() => { for (let i = 0; i < 30; i++) window.cosmos.step(1 / 60); });
  const hull = await h.page.evaluate(() => {
    const s = window.cosmos.ship;
    return { type: s.def.type, paint: s.visuals && s.visuals.paint, name: s.def.name };
  });
  console.log(tag, 'ship', JSON.stringify(hull));
  await h.page.evaluate(() => window.ext([-22, 7, -32], [0, 2, -6]));
  await h.shot(tag + '_front_quarter');
  await h.page.evaluate(() => window.ext([26, 5, 4], [0, 1.5, 0]));
  await h.shot(tag + '_side');
  await h.page.evaluate(() => window.ext([-8, 6, 32], [0, 2, 8]));
  await h.shot(tag + '_rear');
  await h.page.evaluate(() => window.ext([4, 24, -6], [0, 0, 2]));
  await h.shot(tag + '_top');
  await h.page.evaluate(() => window.ext([-10, 3.2, -20], [1.2, 1.6, -12]));
  await h.shot(tag + '_nose');

  await h.page.evaluate(() => {
    const c = window.cosmos;
    c.freeCam.off();
    c.ship.teleport('pilot');
    c.ship.look.yaw = 0.4; c.ship.look.pitch = -0.05;
    for (let i = 0; i < 8; i++) c.step(1 / 30);
  });
  await h.shot(tag + '_cockpit');
  await h.page.evaluate(() => {
    const c = window.cosmos;
    c.ship.teleport('hold');
    c.ship.sw.yaw = 0.9;
    for (let i = 0; i < 8; i++) c.step(1 / 30);
  });
  await h.shot(tag + '_hold');
}

const onlyGround = process.env.LOOKS_ONLY === 'ground';
const desktop = await open({ w: 1280, h: 720, query: '?tier=high&dev=1&solo=1', wait: 9000 });
try {
  await phobosSet(desktop, 'd', onlyGround);
} finally {
  await desktop.browser.close();
}

const phone = await open({ w: 390, h: 844, query: '?tier=low&depth=16&dev=1&solo=1', wait: 9000 });
try {
  await phobosSet(phone, 'p', onlyGround);
} finally {
  await phone.browser.close();
}
if (onlyGround) { console.log('ground retake done'); process.exit(0); }

const raider = await open({ w: 1280, h: 720, query: '?ship=raider&tier=high&dev=1&solo=1', wait: 9000 });
try {
  await raiderSet(raider, 'r');
} finally {
  await raider.browser.close();
}

const raiderPhone = await open({ w: 390, h: 844, query: '?ship=raider&tier=low&depth=16&dev=1&solo=1', wait: 9000 });
try {
  await raiderPhone.page.evaluate(() => { for (let i = 0; i < 20; i++) window.cosmos.step(1 / 60); });
  await raiderPhone.page.evaluate(() => window.ext([24, 4.5, 2], [0, 1.4, 0]));
  await raiderPhone.shot('p_raider_side');
  await raiderPhone.page.evaluate(() => {
    const c = window.cosmos;
    c.freeCam.off();
    c.ship.teleport('pilot');
    for (let i = 0; i < 6; i++) c.step(1 / 30);
  });
  await raiderPhone.shot('p_raider_cockpit');
} finally {
  await raiderPhone.browser.close();
}

console.log('looks shots done');
