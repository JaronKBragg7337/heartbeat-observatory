// Phobos / Deimos pictures at four distances, desktop and phone width.
//   PHOBOS2_PORT=8472 PREFIX=before node views.mjs     (dev server: PORT=8472 node server.js)    MOON=phobos,deimos  DESK_ONLY=1  PHONE_ONLY=1
// A SwiftShader browser now and then dies mid-run: a dead browser is relaunched and the run resumes at the shot that failed.
import { open } from './lib.mjs';
const prefix = process.env.PREFIX || 'before';
const moons = (process.env.MOON || 'phobos,deimos').split(',');
const SETUP = (m) => {
  window.__moon = m;
  const c = window.cosmos; c.space.debugLand(m);
  for (const e of document.body.children) if (e.tagName !== 'CANVAS' && e.id !== 'game-canvas' && e.tagName !== 'SCRIPT') e.style.visibility = 'hidden';
  const mw = c.space.worlds.get(m), b = mw.body, pi = b.padInfo;
  const add = (p, e, n, u) => ({ x: p.x + pi.east.x * e + pi.north.x * n + pi.up.x * u, y: p.y + pi.east.y * e + pi.north.y * n + pi.up.y * u, z: p.z + pi.east.z * e + pi.north.z * n + pi.up.z * u });
  window.camAt = (eye, at, settle = 30) => {   // eye/at = [east, north, up] metres from the pad point
    c.engine.graphics && (c.engine.graphics.checked = 1e6);
    c.freeCam.set(add(pi.point, ...eye), add(pi.point, ...at));
    mw.force(add(pi.point, ...eye));
    window.quiet(settle);
  };
  // frames that only advance the simulation: drawing 30 of them under software GL is minutes, and the picture is drawn once at the end
  window.quiet = (frames) => { const r = c.engine.renderer, save = r.render; r.render = () => {}; try { for (let i = 0; i < frames; i++) c.step(1 / 30); } finally { r.render = save; } c.step(1 / 60); };
  // ground-following: [east, north, metres above the ground there]
  const gpt = (e, n, hh) => { const x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n, l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l) + hh; return { x: x / l * R, y: y / l * R, z: z / l * R }; };
  window.camGround = (eye, at, settle = 30) => { const E = gpt(...eye); c.freeCam.set(E, gpt(...at)); mw.force(E); window.quiet(settle); };
  // the tallest rock 45..110 m from the pad: [east, north, relief]
  window.bigRock = () => { let best = null; for (let e = -110; e <= 110; e += 2) for (let n = -110; n <= 110; n += 2) { const d = Math.hypot(e, n); if (d < 45 || d > 110) continue; const p = gpt(e, n, 0), l = Math.hypot(p.x, p.y, p.z), r = b.rockRelief(p.x / l, p.y / l, p.z / l); if (!best || r > best[2]) best = [e, n, r]; } return best; };
  window.camRaw = (eye, at) => { c.freeCam.set(eye, at); window.quiet(20); };
  window.quiet(20);
};
const STAGES = [
  ['1-orbit-whole', (R) => { const c = window.cosmos, b = c.space.worlds.get(window.__moon).body, pi = b.padInfo, s = b.sunDir; // 3.4 radii out, sun 60 degrees off the camera's line
    let d = { x: pi.up.x * 0.55 + s.x * 0.6 + pi.east.x * 0.45, y: pi.up.y * 0.55 + s.y * 0.6 + pi.east.y * 0.45, z: pi.up.z * 0.55 + s.z * 0.6 + pi.east.z * 0.45 };
    const l = Math.hypot(d.x, d.y, d.z); d = { x: d.x / l, y: d.y / l, z: d.z / l };
    window.camRaw({ x: d.x * R * 3.4, y: d.y * R * 3.4, z: d.z * R * 3.4 }, { x: 0, y: 0, z: 0 }); }],
  ['1-orbit-low-grooves', () => window.camAt([-3500, -6500, 4200], [600, 1500, -500], 40)],
  ['2-approach-700', () => window.camAt([-380, -520, 360], [0, 0, 0], 40)],
  ['2-approach-final', () => window.camAt([-90, -150, 90], [0, 0, 0], 40)],
  ['3-landing-ship', () => window.camAt([-26, -34, 7], [0, 0, 3], 40)],
  ['3-landing-wide', () => window.camAt([30, -52, 22], [0, 0, 3], 40)],
  ['4-ground-pad', () => window.camGround([14, -22, 1.8], [-5, 8, 1.2])],
  ['4-ground-rocks', () => { const [e, n, r] = window.bigRock(), d = Math.hypot(e, n), k = (d - 26) / d; window.camGround([e * k, n * k, 1.8], [e, n, Math.min(1.8, r * 0.6)]); }],
  ['4-ground-heroes', () => window.camGround([-16, 20, 1.8], [-47, 40, 1.4])],
  ['4-ground-horizon', () => window.camGround([0, 40, 1.8], [0, 400, 30])],
  ['5-aerial', () => {   // the aerial that used to show the black hexagon: the walker 300 m out, the camera 55 m over him, the ground tiers re-centred
    const c = window.cosmos, mw = c.space.worlds.get(window.__moon), b = mw.body, pi = b.padInfo, w = c.walker;
    const e = 300, n = 120, x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n;
    const l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l);
    w.worldPos.x = x / l * (R + 0.03); w.worldPos.y = y / l * (R + 0.03); w.worldPos.z = z / l * (R + 0.03); w.grounded = true; mw.force(w.worldPos);
    const eye = { x: x / l * (R + 55) - pi.east.x * 80, y: y / l * (R + 55) - pi.east.y * 80, z: z / l * (R + 55) - pi.east.z * 80 };
    const at = { x: x / l * (R - 4) + pi.east.x * 60, y: y / l * (R - 4) + pi.east.y * 60, z: z / l * (R - 4) + pi.east.z * 60 };
    c.freeCam.set(eye, at); window.quiet(20); }],
  ['4-pad-aerial', () => window.camAt([-70, -60, 45], [-20, 20, 0], 40)],
  ['4-hero-close', () => window.camGround([-38, 26, 2.5], [-47, 40, 1.8])],
  ['4-hero-lit', () => {   // the biggest named rock of the moon, seen from the Sun's side so its lit faces show
    const c = window.cosmos, b = c.space.worlds.get(window.__moon).body, pi = b.padInfo, sd = b.sunDir, he = window.__moon === 'phobos' ? [24, -60] : [-50, 34];
    const dE = sd.x * pi.east.x + sd.y * pi.east.y + sd.z * pi.east.z, dN = sd.x * pi.north.x + sd.y * pi.north.y + sd.z * pi.north.z, l = Math.hypot(dE, dN) || 1;
    window.camGround([he[0] + dE / l * 22, he[1] + dN / l * 22, 1.9], [he[0], he[1], 1.2]); }],
  ['6-cargo-module', () => {   // the drifting salvage module the low Sun used to leave black
    const c = window.cosmos, mw = c.space.worlds.get(window.__moon), b = mw.body, d = b.derelict, pi = b.padInfo; if (!d) { window.camAt([20, 20, 6], [0, 0, 2], 20); return; }
    const at = (e, n, u) => ({ x: d.point.x + pi.east.x * e + pi.north.x * n + d.up.x * u, y: d.point.y + pi.east.y * e + pi.north.y * n + d.up.y * u, z: d.point.z + pi.east.z * e + pi.north.z * n + d.up.z * u });
    const eye = at(-13, -9, 3.2); mw.force(eye); c.freeCam.set(eye, at(0, 0, 1.4)); window.quiet(20); }],
  ['6-sky-mars', () => {   // lying on the pad looking up: Mars in the sky over the ship
    const c = window.cosmos, mw = c.space.worlds.get(window.__moon), pi = mw.body.padInfo;
    const eye = { x: pi.point.x + pi.east.x * 30 + pi.north.x * -20 + pi.up.x * 1.8, y: pi.point.y + pi.east.y * 30 + pi.north.y * -20 + pi.up.y * 1.8, z: pi.point.z + pi.east.z * 30 + pi.north.z * -20 + pi.up.z * 1.8 };
    mw.force(eye); const m = c.space.moonCentre ? null : null;
    const toMars = { x: -mw.body.centre.x, y: -mw.body.centre.y, z: -mw.body.centre.z }, l = Math.hypot(toMars.x, toMars.y, toMars.z);
    c.freeCam.set(eye, { x: eye.x + toMars.x / l * 100, y: eye.y + toMars.y / l * 100, z: eye.z + toMars.z / l * 100 }); window.quiet(20); }],
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
async function run(moon, phone) {
  const tag = (phone ? 'p' : 'd') + '-' + moon;
  const stages = ONLY ? STAGES.filter((s) => ONLY.includes(s[0])) : STAGES;
  let next = 0, tries = 0;
  while (next < stages.length && tries < 6) {
    let h;
    try {
      h = await open({ w: phone ? 390 : 1280, h: phone ? 844 : 720, query: '?dev=1&solo=1&opening=off&' + (phone ? 'tier=low&depth=16' : 'tier=high'), wait: 9000 }, prefix + '-' + tag);
      const P = h.page;
      
      await P.evaluate(SETUP, moon);
      const R = await P.evaluate((m) => window.cosmos.space.worlds.get(m).body.radiusMean, moon);
      while (next < stages.length) {
        const [name, fn] = stages[next];
        await P.evaluate(fn, R);
        await h.shot(name);
        next++;
      }
    } catch (e) { tries++; console.log('retry', tag, stages[next] && stages[next][0], String(e).slice(0, 120)); }
    finally { if (h) await h.browser.close().catch(() => {}); }
  }
}
for (const m of moons) {
  if (!process.env.PHONE_ONLY) await run(m, false);
  if (!process.env.DESK_ONLY) await run(m, true);
}
