// ============================================================================
// flightAssist.js — FLIGHTFEEL: how a person flies the ship by hand.
//
// OWNS: the numbers and the control law of the two hand-flight modes the stick uses:
//   ASSIST    (the default). Point and go. The stick says where you want to be going, the flight computer works the pods
//             and jets to get the ship's velocity there and kills any drift when you let go. Climb, descent, speed and
//             agility all SCALE WITH HEIGHT: hover-car quick near the ground, fast in the air, very fast in space. There are
//             no fixed low caps (the old 12 m/s climb, 40 m/s cruise). A boost. Auto-level near the ground. A landing assist
//             that turns a hold on SINK (or the LAND button) into a soft touchdown, seeking a pad when one is close.
//   NEWTONIAN (expert). The stick commands THRUST, nothing else: the ship keeps whatever velocity it has, nothing brakes
//             it, nothing lands it. The hover trim still carries the ship's own weight (so a thumb is not needed to hold
//             her up); everything else is the ship's real engines at their real rated thrust.
// DOES NOT OWN: the springs, legs, ground and the integrator (shipFlight.js), the camera (shipSystem.js), the input
//       devices (ui/touch.js, shipUI.js). Pure maths: no DOM, no renderer. The browser (solo) and the authority (shared
//       world) run THIS file, so the ship flies the same in both and the server owns the answer.
//
// WHY ASSIST HAS MORE THRUST THAN THE RATED NUMBER
// The Meridian's rated lift is 6.5 m/s2 at the default power split: a hover on Mars with 2.8 m/s2 to spare. That is a
// freighter's honest number and it is what Newtonian mode flies. The flight computer in ASSIST runs the pods and the
// manoeuvring jets in overboost (LIFT_GAIN, DRIVE_GAIN): that is the hover-car agility. Route power away from the engines
// and both fall with it, and a ship that cannot lift her own weight at the rated thrust gets no overboost either, so the
// power split still decides whether she flies. It is a game, said plainly: the real physics is one toggle away.
//
// THE SERVER STAYS THE AUTHORITY
// A client sends INTENT only: numbers in -1..1, a boost flag, a mode name. Every one is finite-checked and clamped by the
// authority before it reaches this file (server/authority.mjs), and this file only ever moves the ship by force:
// there is no way to ask for a position.
// ============================================================================

export const MODES = ['assist', 'newtonian'];
export const isHandMode = (m) => m === 'assist' || m === 'newtonian';

export const ASSIST = {
  // speed scaling with height above the ground (m)
  speedNear: 50,            // m/s with the legs at the ground
  speedPerM: 0.40,          // + this per metre of height, up to speedAirMax
  speedAirMax: 1800,        // m/s: the top of the air
  speedSpaceMax: 6000,      // m/s: very fast in space (reached by 300 km)
  climbNear: 24,            // m/s up or down at the ground
  climbPerM: 0.30,
  reverseFrac: 0.5,         // backing up is half as fast
  strafeFrac: 0.45,
  // agility (m/s2 of the flight computer's overboost); a quick ship is quick: the time to reach speed stays a few seconds at every height
  accelH: 26, accelHtime: 4.2,   // horizontal: at least 26 m/s2, and enough to reach the height's top speed in 4.2 s
  brakeMul: 1.5,                 // slowing down is quicker than speeding up
  downPodFrac: 0.8,              // the pods are ducted both ways: they push the ship DOWN (a fraction of the up authority)
  LIFT_GAIN: 3.2, DRIVE_GAIN: 3.6,
  kV: 3.0, kVv: 5.0,                      // 1/s: how hard the computer chases the commanded velocity
  turnRate: 2.0, pitchRate: 1.5, turnSpeedK: 700, // rad/s at full stick
  turnLag: 8, 
  boostSpeed: 2.2, boostAccel: 1.8, boostDrainS: 5.5, boostRefillS: 9,
  // landing
  settleAgl: 4, settleSpeed: 4, settleSink: 1.2, padSeekM: 150, padSeekDownM: 60, padApproach: 22,
  levelRate: 1.4,                // 1/s: the nose comes back to the horizon when level is asked for
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Top speed (m/s) at a height above the ground, no boost: hover-car near the ground, fast in the air, very fast in space. */
export function vmaxAt(A) {
  const air = Math.min(ASSIST.speedAirMax, ASSIST.speedNear + ASSIST.speedPerM * A);
  if (A <= 100_000) return air;
  return air + (ASSIST.speedSpaceMax - ASSIST.speedAirMax) * smooth(100_000, 300_000, A);
}
/** Fastest vertical speed (m/s) the stick asks for at a height. */
export const vclimbAt = (A) => Math.min(vmaxAt(A), ASSIST.climbNear + ASSIST.climbPerM * A);
/** The most the pitch of the aim may be at a height: a few degrees at the ground (the legs and hull want a level ship there), free in the air. */
export const pitchLimitAt = (A) => 0.24 + 1.1 * smooth(4, 120, A);


// ---------------------------------------------------------------------------------------------------------------------------------
// FLAT GROUND FOR THE LEGS. The four legs reach 1.4 to 3.6 m below the hull: ground that differs by more than about that under the four feet and
// the hull's ends cannot be levelled on, and the ship ends up standing on her belly in the air. The landing assist looks for flat ground around
// her and slides there before it sets her down (three looks a second, only while it is landing).
// ---------------------------------------------------------------------------------------------------------------------------------
const LEGS = [[-5.6, -14.6], [5.6, -14.6], [-6.6, 13.5], [6.6, 13.5]];
const HULL = [[0, -19], [0, -9], [0, 0], [0, 9], [0, 18], [-6, 0], [6, 0], [-3, 12], [3, 12]];
export const FLAT_LEG_M = 1.7, FLAT_HUMP_M = 1.1;
/**
 * How bad the ground under her would be if she sat at `p` (a world point on her own vertical) with her present heading: 1 or more means the legs
 * cannot level on it. Two things stop her: the four feet differ in height by more than the legs' reach (legs 1.4 to 3.6 m), or the ground under the
 * hull between them stands more than a metre above the lowest foot (she is held up on her belly and the feet hang in the air).
 */
export function reliefAt(S, p) {
  const f = S.fwdH, rt = S.rightH;
  const at = (lx, lz) => {
    const wx = p.x + rt.x * lx - f.x * lz, wy = p.y + rt.y * lx - f.y * lz, wz = p.z + rt.z * lx - f.z * lz;
    const r = Math.hypot(wx, wy, wz) || 1, gR = S.ground(wx / r, wy / r, wz / r);
    return gR === null || gR === undefined ? null : gR - r;          // ground height relative to the point's own radius: the planet's curve is inside this
  };
  let lo = Infinity, hi = -Infinity;
  for (const [lx, lz] of LEGS) { const h = at(lx, lz); if (h === null) return 0; if (h < lo) lo = h; if (h > hi) hi = h; }
  let hump = -Infinity;
  for (const [lx, lz] of HULL) { const h = at(lx, lz); if (h !== null && h > hump) hump = h; }
  return Math.max((hi - lo) / FLAT_LEG_M, (hump - lo) / FLAT_HUMP_M);
}
/** Nearest flat place (a horizontal world offset from where she is) for the landing assist, or null (here is flat / none found). Cached; asks about three times a second. */
export function findSite(S, up) {
  const c = S._site;
  if (c && S.time - c.t < 0.3) return c.res;
  const here = S.pos, relHere = reliefAt(S, here);
  let res = null;
  if (relHere >= 1.5) {
    let best = null;
    for (const R of [8, 16, 28, 45]) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, ox = Math.cos(a) * R, oz = Math.sin(a) * R;
        const q = { x: here.x + S.rightH.x * ox + S.fwdH.x * oz, y: here.y + S.rightH.y * ox + S.fwdH.y * oz, z: here.z + S.rightH.z * ox + S.fwdH.z * oz };
        const rel = reliefAt(S, q);
        if (rel < 1 && (!best || rel < best.rel)) best = { dx: q.x - here.x, dy: q.y - here.y, dz: q.z - here.z, d: R, rel };     // only ground the legs can really level on is worth sliding for
      }
      if (best) break;
    }
    res = best || { none: true, dx: 0, dy: 0, dz: 0, d: 0 };
  }
  S._site = { t: S.time, res };
  return res;
}

/** Ground rising ahead: the climb rate (m/s) that keeps her origin 9 m clear of the ground over the next few seconds. Cached; looks about twelve times a second. */
function terrainClimb(S, X, vcl) {
  const c = S._terr;
  if (c && S.time - c.t < 0.08) return c.need;
  const up = X.up, v = X.v, hx = v.x - up.x * X.vUp, hy = v.y - up.y * X.vUp, hz = v.z - up.z * X.vUp, hl = Math.hypot(hx, hy, hz);
  let need = 0;
  if (hl > 8) {
    const dx = hx / hl, dy = hy / hl, dz = hz / hl, reach = clamp(hl * 1.6, 25, 400);
    for (const k of [0.3, 0.6, 1]) {
      const d = reach * k, px = S.pos.x + dx * d, py = S.pos.y + dy * d, pz = S.pos.z + dz * d, r = Math.hypot(px, py, pz) || 1;
      const g = S.ground(px / r, py / r, pz / r);
      if (g === null || g === undefined) continue;
      const clear = r - g, deficit = 9 - clear;                       // r is where she would be if she held her height over the planet's curve
      if (deficit > 0) need = Math.max(need, deficit * hl / d * 1.8);
    }
  }
  need = Math.min(need, vcl);
  S._terr = { t: S.time, need };
  return need;
}

/**
 * One substep of the hand-flight control law.
 * @param S   the ShipBody (reads c = S.controls, S.boosting, S.landingPads; writes nothing)
 * @param X   { dt, m, g, up, fwdH, rightH, v:{x,y,z}, vUp, agl, hFoot, contacts, onGround, eng, canLift, maxLiftN, maxDriveN, aimPitch }
 * @returns   { fUp (N along up), ax, ay, az (m/s2, horizontal plane + pitch component of the drive), fwdAcc, upIntent, landing }
 */
export function handCommand(S, X) {
  const c = S.controls, mode = c.mode, m = X.m, g = X.g, up = X.up;
  const A = Number.isFinite(X.agl) ? Math.min(X.agl, 1e7) : 1e7;
  const boost = S.boosting;
  const fwdIn = Math.abs(c.fwd || 0) > 0.05, strIn = Math.abs(c.strafe || 0) > 0.05, liftIn = Math.abs(c.lift || 0) > 0.05;
  const out = { fUp: 0, fMin: -0.6 * X.maxLiftN, fMax: X.maxLiftN, ax: 0, ay: 0, az: 0, fwdAcc: 0, thrustFwdN: 0, landing: false };
  const cp = Math.cos(X.aimPitch), sp = Math.sin(X.aimPitch);
  // the way the nose points, and the other two axes
  const dx = X.fwdH.x * cp + up.x * sp, dy = X.fwdH.y * cp + up.y * sp, dz = X.fwdH.z * cp + up.z * sp;

  if (mode === 'newtonian') {
    // Thrust only. Rated numbers, no overboost, nothing kills the drift.
    const along = (c.fwd >= 0 ? c.fwd : c.fwd * 0.5) * (boost ? ASSIST.boostAccel : 1);
    const aD = (X.maxDriveN / m) * along, aS = (X.maxDriveN / m) * 0.35 * (c.strafe || 0);
    out.ax = dx * aD + X.rightH.x * aS; out.ay = dy * aD + X.rightH.y * aS; out.az = dz * aD + X.rightH.z * aS;
    // the aim's vertical part of the drive thrust is already inside (dx..dz carry the pitch); the lift lever works the pods on top of the hover trim
    const lever = c.lift || 0;
    const spare = Math.max(0, X.maxLiftN - m * g);
    out.fUp = m * g + (lever > 0 ? lever * spare : lever * 0.6 * X.maxLiftN);
    out.fwdAcc = aD; out.thrustFwdN = Math.hypot(aD, aS) * m;
    out.upIntent = fwdIn || strIn || liftIn;
    return out;
  }

  // ---------------- ASSIST -----------------------------------------------------------------------------------------
  const bm = boost ? ASSIST.boostSpeed : 1, am = boost ? ASSIST.boostAccel : 1;
  const vmax = vmaxAt(A) * bm, vcl = vclimbAt(A) * (boost ? 1.4 : 1);
  const engK = clamp(X.eng, 0.3, 1.8);
  const liftGain = X.canLift ? ASSIST.LIFT_GAIN : 1;
  out.fMax = X.maxLiftN * liftGain * am; out.fMin = -X.maxLiftN * liftGain * ASSIST.downPodFrac * am;
  const aUpNet = Math.max(0.5, (X.maxLiftN * liftGain) / m - g) * am;                  // net up acceleration the pods can make beyond holding her up
  const aDownMax = Math.max(0.5, (X.maxLiftN * liftGain * ASSIST.downPodFrac) / m) * am; // and down (pods ducted both ways) on top of gravity
  const aH = Math.max(ASSIST.accelH * engK, vmax / ASSIST.accelHtime) * (X.canLift ? 1 : 0.25) * am;                   // horizontal agility: a few seconds to the height's top speed

  // what the thumbs ask for, as a velocity
  const stickIdle = !fwdIn && !strIn;
  const landing = !!(c.land > 0.5) || (c.lift < -0.05 && A < 150);
  out.landing = landing;
  let along = (c.fwd >= 0 ? c.fwd : c.fwd * ASSIST.reverseFrac);
  if (landing && stickIdle) along = 0;
  let tx = dx * along * vmax, ty = dy * along * vmax, tz = dz * along * vmax;
  const sv = (c.strafe || 0) * ASSIST.strafeFrac * Math.min(vmax, 400);
  tx += X.rightH.x * sv; ty += X.rightH.y * sv; tz += X.rightH.z * sv;
  // vertical (relative to the local up) wanted by the lift lever
  let wantUp = (c.lift || 0) * vcl;
  if (c.land > 0.5) wantUp = -Math.min(vcl, 60);

  // take-off: pushing forward or up while sitting on the legs hops her off the pad first (a first-timer should never have to find "lift" before "go")
  const hop = X.contacts > 0 && (fwdIn || strIn || (c.lift || 0) > 0.05);
  if (hop) wantUp = Math.max(wantUp, 14);
  // just off the ground and going somewhere: keep a hover-car's height (the keel clear of the ground) instead of skimming the legs along it
  const gliding = !landing && (fwdIn || strIn) && X.contacts === 0;
  if (gliding && A < 12) wantUp = Math.max(wantUp, (12 - A) * 1.6);
  // terrain following: ground rising ahead of a ship that is going somewhere is climbed over before she reaches it
  if (gliding && A < 400 && S.ground) wantUp = Math.max(wantUp, terrainClimb(S, X, vcl));
  const hScale = X.contacts > 0 ? 0 : 1;

  // pad seeking: low and slow, hands off the stick, a pad close by pulls her in
  let seeking = false;
  if (landing && stickIdle && S.landingPads) {
    const pads = S.landingPads(), rng = c.land > 0.5 ? ASSIST.padSeekM : ASSIST.padSeekDownM;
    let best = null, bd = Infinity;
    for (const p of pads || []) {
      const rx = p.x - S.pos.x, ry = p.y - S.pos.y, rz = p.z - S.pos.z, ru = rx * up.x + ry * up.y + rz * up.z;
      const hx = rx - up.x * ru, hy = ry - up.y * ru, hz = rz - up.z * ru, d = Math.hypot(hx, hy, hz);
      if (d < bd) { bd = d; best = { hx, hy, hz, d }; }
    }
    if (best && bd < rng) {
      seeking = true; out.padDist = bd;
      const sp2 = bd < 2 ? 0 : Math.min(ASSIST.padApproach, Math.sqrt(2 * aH * 0.35 * bd), 0.7 * bd + 1);
      const k = sp2 / (bd || 1); tx = best.hx * k; ty = best.hy * k; tz = best.hz * k;
    }
  }
  // no pad close: find flat ground for the legs (only low and slow: the look costs a few ground samples)
  if (!seeking && (landing || (A < ASSIST.settleAgl + 2)) && stickIdle && A < 90 && (X.hSpeed ?? 0) < 18 && S.ground) {
    const site = findSite(S, up);
    if (site && !site.none) {
      seeking = true; out.siteDist = site.d;
      const hdx = site.dx - up.x * (site.dx * up.x + site.dy * up.y + site.dz * up.z), hdy = site.dy - up.y * (site.dx * up.x + site.dy * up.y + site.dz * up.z), hdz = site.dz - up.z * (site.dx * up.x + site.dy * up.y + site.dz * up.z);
      const dd = Math.hypot(hdx, hdy, hdz) || 1, sp2 = Math.min(10, Math.sqrt(2 * aH * 0.2 * dd) + 1), k = sp2 / dd;
      tx = hdx * k; ty = hdy * k; tz = hdz * k;
    }
    out.noFlat = !!(site && site.none);
  }
  out.seeking = seeking;

  // settle: slow and nearly down with nothing asked for: set her on her legs (the touch-down assist)
  const hv = X.hSpeed ?? 0;
  const settle = A < ASSIST.settleAgl + 2 && hv < ASSIST.settleSpeed && !liftIn && stickIdle && !c.land;
  if (settle && !hop) wantUp = Math.min(wantUp, -ASSIST.settleSink);
  if (out.siteDist && A < 12 && wantUp < 0) wantUp = Math.max(wantUp, 0.3);   // sliding to flat ground: hold her up until she is over it

  // the flare: the closer to the ground the slower she may sink, from the stopping distance the pods really have (with a margin); 0.6 m/s at the surface
  if (Number.isFinite(X.agl) && wantUp < 0) {
    const spare = Math.max(0.8, aUpNet * 0.4);
    wantUp = Math.max(wantUp, -(0.5 + Math.sqrt(2 * spare * Math.max(0, X.hFoot - 0.3))));
  }
  // a velocity target cannot go faster than the top speed
  const tl = Math.hypot(tx, ty, tz);
  if (tl > vmax) { const k = vmax / tl; tx *= k; ty *= k; tz *= k; }
  // split the target: the part along the local up joins the lift lever's, the rest is the plane
  const tU = tx * up.x + ty * up.y + tz * up.z;
  let tvx = (tx - up.x * tU) * hScale, tvy = (ty - up.y * tU) * hScale, tvz = (tz - up.z * tU) * hScale;
  const tUp = tU * hScale + wantUp;

  // horizontal: chase the target velocity within the agility; slowing is quicker than speeding up
  const hx = X.v.x - up.x * X.vUp, hy = X.v.y - up.y * X.vUp, hz = X.v.z - up.z * X.vUp;
  let ex = tvx - hx, ey = tvy - hy, ez = tvz - hz;
  const hl = Math.hypot(hx, hy, hz), tlh = Math.hypot(tvx, tvy, tvz);
  const lim = aH * (tlh < hl ? ASSIST.brakeMul : 1);
  let cx = ex * ASSIST.kV, cy = ey * ASSIST.kV, cz = ez * ASSIST.kV;
  const cl = Math.hypot(cx, cy, cz);
  if (cl > lim) { const k = lim / cl; cx *= k; cy *= k; cz *= k; }
  out.ax = cx; out.ay = cy; out.az = cz;
  out.fwdAcc = cx * X.fwdH.x + cy * X.fwdH.y + cz * X.fwdH.z;
  out.thrustFwdN = Math.hypot(cx, cy, cz) * m;

  // vertical: gravity plus a proportional term, within what the pods can make up and down
  const aCmd = clamp(ASSIST.kVv * (clamp(tUp, -vcl * 1.2, vcl * 1.2) - X.vUp), -aDownMax, aUpNet);
  out.fUp = m * (g + aCmd);
  out.upIntent = hop || fwdIn || strIn || liftIn || c.land > 0.5;
  out.aimUpTarget = tU;
  return out;
}
