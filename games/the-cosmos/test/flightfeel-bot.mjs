// FLIGHTFEEL: the "first-timer bot". A scripted stand-in for a person who has never flown her: it reacts a third of a second late, steers with
// a coarse proportional thumb, eases off as the goal gets close and holds SINK to land. The same bot policy flies the OLD stick (fwd/lift/yaw, the
// legacy flight law, what Jaron flew on 10/3) and the NEW one (assist, newtonian). Everything is the real ShipBody on the real Mars ground and the
// real Marineris Port pads; only the person is a script.
//   node test/flightfeel-bot.mjs            prints the table and writes docs/qa/2026-10-03/flightfeel/bot-results.json
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shim = join(ROOT, 'node_modules', 'three');
if (!existsSync(join(shim, 'package.json'))) {
  mkdirSync(shim, { recursive: true });
  writeFileSync(join(shim, 'package.json'), JSON.stringify({ name: 'three', version: '0.160.0-vendored', type: 'module', main: './index.js' }));
  writeFileSync(join(shim, 'index.js'), `export * from '../../lib/three.module.js';\n`);
}
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

export async function loadRig(given = null) {
  const { getBody } = await imp('src/world/bodies.js');
  const FIELD = await imp('src/world/field.js');
  const { createPortSite } = await imp('src/port/portSpec.js');
  const { ShipBody } = await imp('src/ship/shipFlight.js');
  const mars = given ? given.mars : getBody('mars');
  const site = given ? given.site : createPortSite(mars); if (!given) FIELD.attachGrades([site]);
  const ground = (x, y, z) => FIELD.surfaceRadiusFast(mars, x, y, z);
  const makeFlight = () => { const f = new ShipBody(mars, ground); f.setDown(site.toWorld(0, 3.8, 0), site.heading); for (let i = 0; i < 540; i++) f.step(1 / 60); return f; };
  const onGround = (lx, lz) => { const w = site.toWorld(lx, 0, lz), l = Math.hypot(w.x, w.y, w.z), g = ground(w.x / l, w.y / l, w.z / l); return { x: w.x / l * g, y: w.y / l * g, z: w.z / l * g }; };
  return { mars, site, ground, makeFlight, onGround, ShipBody };
}

const wrap = (a) => { a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return a > Math.PI ? a - Math.PI * 2 : a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/**
 * Fly one leg: take off if on the ground, go to `goal` (a world point on the ground), land within `tol` of it.
 * style: 'legacy' | 'assist' | 'assist-pro' (climbs and boosts) | 'newtonian'
 */
export function flyLeg(f, goal, { style, tol = 30, maxS = 400, padLand = false, pads = null } = {}) {
  const dt = 1 / 30, delay = 0.33;
  const q = [];                               // the person's reaction delay: what the thumb does is what they decided a third of a second ago
  const hand = style !== 'legacy';
  const mode = style === 'newtonian' ? 'newtonian' : 'assist';
  if (pads) f.landingPads = () => pads;
  let t = 0, tOff = null, tNear = null, tDown = null, maxAgl = 0, maxSpeed = 0, hull0 = f.hull, boostT = 0, touch = null, arrived = false;
  let lastStick = null;
  const wantAlt = style === 'assist-pro' ? 160 : 25;
  while (t < maxS) {
    f.refreshOrientation();
    const fr = f._frame, p = f.pos;
    const d = { x: goal.x - p.x, y: goal.y - p.y, z: goal.z - p.z };
    const dUp = dot(d, f.up);
    const dh = { x: d.x - f.up.x * dUp, y: d.y - f.up.y * dUp, z: d.z - f.up.z * dUp };
    const dist = Math.hypot(dh.x, dh.y, dh.z);
    const bearing = Math.atan2(dot(dh, fr.east), dot(dh, fr.north));
    const err = wrap(bearing - f.heading);
    const agl = Number.isFinite(f.agl) ? f.agl : 1e6;
    const vH = f.groundSpeed, vUp = f.verticalSpeed;
    maxAgl = Math.max(maxAgl, agl); maxSpeed = Math.max(maxSpeed, f.speed);
    if (tOff === null && agl > 20 && !f.landed) tOff = t;
    // what the bot decides this tick
    let c = { fwd: 0, lift: 0, yaw: 0, pitch: 0, strafe: 0, boost: 0, land: 0, level: 1 };
    const yaw = clamp(err * 1.6, -1, 1);
    if (tOff === null) {                                                // 1. get off the ground
      if (hand) { c.fwd = Math.abs(err) < 0.35 ? 0.3 : 0; c.lift = 1; c.yaw = Math.abs(err) > 0.35 ? yaw : 0; }     // a person pushes UP and "forward" at once
      else c.lift = 1;
    } else if (!arrived) {                                              // 2. go there
      const settling = dist < tol * 0.8 && vH < 4;
      const closeIn = clamp(dist / (hand ? Math.max(60, vH * 3.2) : 140), 0.12, 1);                 // a coarse "ease off as it gets close"
      c.yaw = yaw;
      c.fwd = Math.abs(err) > 1.0 ? 0 : closeIn * (Math.abs(err) > 0.5 ? 0.5 : 1);
      if (style === 'assist-pro') {
        if (agl < wantAlt) c.lift = 1;
        else if (agl > wantAlt + 25 && dist > 400) c.lift = -0.3;
        if (dist > 700 && boostT < 99 && Math.abs(err) < 0.3 && c.fwd > 0.95 && f.boostCharge > 0.1) { c.boost = 1; }
        if (dist < 300) { c.lift = agl > 30 ? -0.5 : 0; }
      } else if (hand && agl < 14) c.lift = 0.6;                                                    // a person keeps a little height
      else if (!hand && agl < 14) c.lift = 0.6;
      if (settling) arrived = true;
      if (dist < tol && tNear === null) tNear = t;
    } else {                                                            // 3. land
      c.fwd = 0; c.yaw = 0; c.lift = -1;
      if (hand && padLand) { c.lift = 0; c.land = 1; }
    }
    if (style === 'newtonian') {
      // an expert in real physics: nothing brakes her, so the pilot does. Burn along the bearing to the speed the remaining distance allows (a coast, a flip-free
      // reverse burn to brake), cancel the sideways drift with the slide jets, and fly the height by the lift lever against the vertical speed.
      const vel = f.vel, ve = dot(vel, fr.east), vn = dot(vel, fr.north);
      const bx = Math.sin(bearing), by = Math.cos(bearing);                                // the bearing in the local east/north axes
      const vAlong = ve * bx + vn * by, vLat = ve * Math.cos(f.heading) - vn * Math.sin(f.heading);   // speed toward the goal, and sideways (right of the nose)
      const aBrake = 5.0, vDes = arrived ? 0 : Math.min(180, Math.sqrt(2 * aBrake * 0.55 * Math.max(0, dist - 12)));
      c = { fwd: clamp((vDes - vAlong) * 0.3, -1, 1), strafe: 0, yaw, pitch: 0, boost: 0, land: 0, level: 1, lift: 0 };
      const nose = Math.abs(err) < 0.2 ? 1 : 0;
      if (!nose) c.fwd = clamp(c.fwd, -1, 0.25);
      c.strafe = clamp(-vLat * 0.3, -1, 1);
      const wantH = arrived ? -(0.5 + Math.sqrt(2 * 3.5 * Math.max(0, agl - 3.5))) : clamp((30 - agl) * 0.4, -6, 14);
      c.lift = tOff === null ? 1 : clamp((wantH - vUp) * 0.35, -1, 1);
      if (!arrived && dist < tol * 0.8 && vH < 4) arrived = true;
      if (dist < tol && tNear === null) tNear = t;
    }
    if (!hand) { c.pitch = 0; c.strafe = 0; c.boost = 0; c.land = 0; c.level = 0; }
    if (hand) c.mode = mode;
    q.push(c); const act = q.length > delay / dt ? q.shift() : { fwd: 0, lift: 0, yaw: 0, pitch: 0, strafe: 0, boost: 0, land: 0, level: 0, mode: hand ? mode : undefined };
    if (!hand) delete act.mode;
    Object.assign(f.controls, act);
    if (hand && act.mode) f.controls.mode = act.mode; else delete f.controls.mode;
    f.step(dt); t += dt;
    if (process.env.BOTDEBUG && Math.round(t * 30) % 45 === 0) console.log(t.toFixed(1), style, 'dist', dist.toFixed(0), 'err', err.toFixed(2), 'agl', agl.toFixed(0), 'vH', vH.toFixed(0), 'vUp', vUp.toFixed(1), 'arrived', arrived, 'landed', f.landed, JSON.stringify({ f: act.fwd, l: act.lift, y: +act.yaw.toFixed(2) }));
    for (const e of f.events) if (e.type === 'touchdown') touch = e.speed;
    if (f.landed && arrived && tDown === null) { tDown = t; break; }
  }
  const endP = f.pos; const off = Math.hypot(goal.x - endP.x, goal.y - endP.y, goal.z - endP.z);
  f.controls.fwd = f.controls.lift = f.controls.yaw = 0; delete f.controls.mode;
  return { style, ok: tDown !== null && off < tol * 1.5, t: +t.toFixed(1), tTakeoff: tOff === null ? null : +tOff.toFixed(1), tNear: tNear === null ? null : +tNear.toFixed(1), tLanded: tDown === null ? null : +tDown.toFixed(1),
    off: +off.toFixed(1), touchdown: touch === null ? null : +touch.toFixed(2), hullLost: +(hull0 - f.hull).toFixed(1), maxAgl: Math.round(maxAgl), maxSpeed: Math.round(maxSpeed) };
}

/** The benchmark: from the Meridian's pad take off, fly 2 km out, land; then fly 2 km back and land on the pad. */
export async function bench(styles = ['legacy', 'assist', 'assist-pro', 'newtonian'], az = [0, 1.9, 3.8], given = null) {
  const R = await loadRig(given);
  const { createPortSite } = await imp('src/port/portSpec.js');
  const rows = [];
  for (const style of styles) {
    for (const a of az) {
      const f = R.makeFlight();
      const goal = R.onGround(2000 * Math.cos(a), 2000 * Math.sin(a));
      const pad = R.onGround(0, 0);
      const out = flyLeg(f, goal, { style, tol: 35, maxS: 420 });
      const back = flyLeg(f, pad, { style, tol: 20, maxS: 420, padLand: style !== 'legacy', pads: [pad] });
      rows.push({ style, azimuth: a, out, back, total: +(out.t + back.t).toFixed(1) });
    }
  }
  return rows;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const rows = await bench();
  const sum = {};
  for (const r of rows) {
    console.log(r.style.padEnd(11), 'az', String(r.azimuth).padEnd(4), 'OUT', JSON.stringify(r.out), '\n            BACK', JSON.stringify(r.back), '\n            total', r.total);
    (sum[r.style] ||= []).push(r);
  }
  const avg = (a) => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  const table = Object.entries(sum).map(([s, a]) => ({ style: s, timeToTakeoff: avg(a.map((r) => r.out.tTakeoff ?? 999)), time2km: avg(a.map((r) => r.out.tNear ?? 999)), landOut: avg(a.map((r) => r.out.tLanded ?? 999)), landedOutOk: a.filter((r) => r.out.ok).length + '/' + a.length, landedPadOk: a.filter((r) => r.back.ok).length + '/' + a.length,
    total: avg(a.map((r) => r.total)), hardLandings: a.filter((r) => (r.out.touchdown ?? 0) > 5.5 || (r.back.touchdown ?? 0) > 5.5).length, hullLost: avg(a.map((r) => r.out.hullLost + r.back.hullLost)) }));
  console.table(table);
  const dir = join(ROOT, 'docs', 'qa', '2026-10-03', 'flightfeel'); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'bot-results.json'), JSON.stringify({ table, rows }, null, 1));
}
