// A walking body: smooth acceleration, run with stamina, knock-back, collide and slide. Plain numbers only.
import { DT } from './tuning.js';

export function makeMover(x, z, heading = 0, P) {
  return { x, z, heading, vx: 0, vz: 0, speed: 0, P, stamina: 1, exhausted: false, sinceRun: 9, running: false, kx: 0, kz: 0, px: x, pz: z };
}

function turnToward(h, target, maxStep) {
  let d = target - h;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (d > maxStep) d = maxStep; else if (d < -maxStep) d = -maxStep;
  return h + d;
}
export { turnToward };

// mx, mz: wanted direction in world space, length 0..1. run: wants to run. speedScale: optional multiplier.
// clampFn(m, r): keeps the body inside its area. Returns true if it bumped into something.
export function stepMover(m, mx, mz, run, world, clampFn, speedScale = 1, useFences = true) {
  const P = m.P;
  let mag = Math.hypot(mx, mz);
  if (mag > 1) { mx /= mag; mz /= mag; mag = 1; }
  const wantRun = run && mag > 0.3 && !m.exhausted && m.stamina > 0;
  m.running = wantRun;
  if (P.runTime !== Infinity) {
    if (wantRun) { m.stamina -= DT / P.runTime; m.sinceRun = 0; if (m.stamina <= 0) { m.stamina = 0; m.exhausted = true; } }
    else { m.sinceRun += DT; if (m.sinceRun > P.regenDelay) m.stamina = Math.min(1, m.stamina + DT / P.regenTime); }
    if (m.exhausted && m.stamina >= P.exhaustedUntil) m.exhausted = false;
  }
  const top = (wantRun ? P.run : P.walk) * speedScale;
  const tx = mag > 1e-4 ? (mx / mag) * mag * top : 0, tz = mag > 1e-4 ? (mz / mag) * mag * top : 0;
  const a = Math.min(1, DT * P.accel);
  m.vx += (tx - m.vx) * a; m.vz += (tz - m.vz) * a;
  // knock-back decays on its own
  const kd = Math.max(0, 1 - DT * 6); m.kx *= kd; m.kz *= kd;
  m.px = m.x; m.pz = m.z;
  m.x += (m.vx + m.kx) * DT; m.z += (m.vz + m.kz) * DT;
  const hit = world.collide(m, P.r, useFences);
  if (clampFn) clampFn(m, P.r);
  const ax = (m.x - m.px) / DT, az = (m.z - m.pz) / DT;
  m.speed = Math.hypot(ax, az);
  if (hit) { m.vx = ax - m.kx; m.vz = az - m.kz; }      // sliding along a wall keeps only the part that worked
  if (mag > 0.15 && m.speed > 0.15) m.heading = turnToward(m.heading, Math.atan2(mx, mz), P.turn * DT);
  return hit;
}

// Move straight toward a point at a fixed speed with collisions (for AI bodies). Returns distance left.
export function stepToward(m, tx, tz, speed, world, clampFn, turnRate = 10, useFences = true) {
  const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
  m.px = m.x; m.pz = m.z;
  if (d > 1e-4) {
    const s = Math.min(d, speed * DT);
    m.x += (dx / d) * s + m.kx * DT; m.z += (dz / d) * s + m.kz * DT;
    m.heading = turnToward(m.heading, Math.atan2(dx, dz), turnRate * DT);
  }
  const kd = Math.max(0, 1 - DT * 6); m.kx *= kd; m.kz *= kd;
  world.collide(m, m.P.r, useFences);
  if (clampFn) clampFn(m, m.P.r);
  m.vx = (m.x - m.px) / DT; m.vz = (m.z - m.pz) / DT;
  m.speed = Math.hypot(m.vx, m.vz);
  return d;
}

// Follow a nav path (from makePath). Replans are the caller's job. Returns true when the end is reached.
export function followPath(m, path, speed, world, clampFn, turnRate = 10, reach = 0.45) {
  while (path.i < path.n) {
    const p = path.pts[path.i];
    if (Math.hypot(p.x - m.x, p.z - m.z) > reach || path.i === path.n - 1) break;
    path.i++;
  }
  if (path.i >= path.n) { m.speed = 0; m.vx = m.vz = 0; return true; }
  const p = path.pts[path.i];
  const left = stepToward(m, p.x, p.z, speed, world, clampFn, turnRate);
  if (path.i === path.n - 1 && left < 0.12) { path.i = path.n; return true; }
  return false;
}
