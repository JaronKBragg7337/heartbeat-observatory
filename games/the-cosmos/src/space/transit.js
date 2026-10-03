// ============================================================================
// transit.js — the drive between worlds. Pure: f64 vectors in, f64 vectors out; no three.js, no DOM, so the validator flies
// whole trips in Node.
//
// WHAT IT IS
// A "flip and burn" transit with a real flight computer's rules:
//   * Thrust acts ONLY along the nose, and at most `aMax`. The hull turns at `turnRate`; thrust is scaled by how well the nose
//     is lined up with what the computer wants, so a ship that has not finished turning is not pushing hard.
//   * It burns toward the goal, coasts if it reaches `vMax`, and starts the turn-over early enough (braking distance plus the
//     time the flip itself takes) to arrive with no speed left, at the point it was told, within a couple of metres.
//   * If the straight line to the goal passes through Mars it steers round it first (a waypoint outside a safety sphere).
//   * Time can be compressed (`warp`): the trip is run in sub-steps of at most a quarter of a second of ship time, so a 60x
//     warp is the same flight, not a different one.
// Mars's pull is ignored in transit (the computer is assumed to hold the line).
// ============================================================================

const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const unit = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/** Rotate a unit vector `a` toward unit vector `b` by at most `maxAng` radians. Returns a new unit vector. */
export function turnToward(a, b, maxAng) {
  const c = clampN(dot(a, b), -1, 1), ang = Math.acos(c);
  if (ang <= maxAng || ang < 1e-9) return { ...b };
  let axis = cross(a, b);
  if (len(axis) < 1e-9) axis = Math.abs(a.y) < 0.9 ? cross(a, { x: 0, y: 1, z: 0 }) : cross(a, { x: 1, y: 0, z: 0 });
  axis = unit(axis);
  const k = Math.cos(maxAng), s = Math.sin(maxAng), kx = cross(axis, a);
  // Rodrigues
  return unit({ x: a.x * k + kx.x * s + axis.x * dot(axis, a) * (1 - k), y: a.y * k + kx.y * s + axis.y * dot(axis, a) * (1 - k), z: a.z * k + kx.z * s + axis.z * dot(axis, a) * (1 - k) });
}

/** Does the segment p->q pass within `r` of `c`? Returns the closest point on the segment (and its distance). */
export function segmentClosest(p, q, c) {
  const d = sub(q, p), dd = dot(d, d) || 1;
  const t = clampN(dot(sub(c, p), d) / dd, 0, 1);
  const m = add(p, mul(d, t));
  return { t, point: m, dist: len(sub(m, c)) };
}

export const TRANSIT_DEFAULTS = {
  vMax: 30000, turnRate: 0.12, brakeFrac: 0.85, tau: 1.0,
  centre: { x: 0, y: 0, z: 0 }, safeR: 3_389_500 + 60_000, floorR: 3_389_500 + 25_000,
};

export class Transit {
  /**
   * @param o { pos, vel, nose, up, goal, aMax, vMax, turnRate, centre, safeR }  all f64 world vectors (unit nose/up)
   */
  constructor(o) {
    const D = TRANSIT_DEFAULTS;
    this.pos = { ...o.pos }; this.vel = { ...o.vel };
    this.nose = unit(o.nose || { x: 0, y: 0, z: -1 }); this.up = unit(o.up || { x: 0, y: 1, z: 0 });
    this.finalGoal = { ...o.goal };
    this.legs = Transit.planLegs(this.pos, this.finalGoal, o.centre || TRANSIT_DEFAULTS.centre, o.safeR ?? TRANSIT_DEFAULTS.safeR).map((p) => ({ ...p }));
    this.goal = this.legs.shift();
    this.aMax = o.aMax; this.vMax = o.vMax ?? D.vMax; this.turnRate = o.turnRate ?? D.turnRate;
    this.centre = o.centre || D.centre; this.safeR = o.safeR ?? D.safeR; this.floorR = o.floorR ?? D.floorR;
    this.brakeFrac = o.brakeFrac ?? D.brakeFrac; this.tau = D.tau;
    this.t = 0; this.phase = 'burn'; this.done = false; this.committed = false;
    this.thrust = 0;                   // 0..1 of aMax, this step (drives the flame)
    this.accel = { x: 0, y: 0, z: 0 };
    this.distance = len(sub(this.finalGoal, this.pos));
    this.peakSpeed = 0;
    this.flipT = Math.PI / this.turnRate;
  }

  get speed() { return len(this.vel); }

  /**
   * Legs: a straight line, or (when the straight line would pass through Mars's safety sphere) two stops: a point out past the
   * sphere on the side the line grazes, then the goal. Each leg is a full flip-and-burn that comes to rest at its end.
   */
  static planLegs(pos, goal, centre, safeR) {
    const clear = (p, q) => segmentClosest(p, q, centre).dist >= safeR;
    if (clear(pos, goal)) return [goal];
    const sc = segmentClosest(pos, goal, centre);
    let out = sub(sc.point, centre);
    if (len(out) < 1e3) { const n = cross(sub(goal, pos), sub(pos, centre)); out = len(n) > 1 ? cross(n, sub(goal, pos)) : { x: 0, y: 1, z: 0 }; }
    out = unit(out);
    let k = 1.35;
    for (let i = 0; i < 8; i++, k *= 1.25) {
      const w = add(centre, mul(out, safeR * k));
      if (clear(pos, w) && clear(w, goal)) return [w, goal];
    }
    return [add(centre, mul(out, safeR * 3.5)), goal];
  }

  /** Advance by `dt` seconds of ship time (<= 0.25 is stable). `aMax` may change between steps (power routing). */
  step(dt, aMax = this.aMax) {
    if (this.done) return;
    this.aMax = aMax;
    const aim = this.goal, final = true;
    const toAim = sub(aim, this.pos), D = len(toAim), dir = D > 1e-6 ? mul(toAim, 1 / D) : this.nose;
    const v = this.speed, vh = v > 1e-9 ? mul(this.vel, 1 / v) : dir;
    const aD = this.aMax * this.brakeFrac;
    const STOP_SHORT = 700;                      // the main drive brings the ship to rest this far short; the manoeuvring jets do the rest

    let aWant = { x: 0, y: 0, z: 0 }, jets = false;
    // THE BRAKING ENVELOPE. The fastest speed the ship may have at distance D and still stop STOP_SHORT before the goal at
    // 85% of its thrust, after the turn-over it will have to make (its length in distance at the present speed is taken off first).
    const dEff = D - STOP_SHORT - v * this.flipT;
    const vEnv = Math.min(this.vMax, Math.sqrt(2 * aD * Math.max(0, dEff)));
    if (this.phase === 'creep' || (D <= STOP_SHORT + 300 && v <= 30)) this.phase = 'creep';
    if (this.phase === 'creep') {
      // manoeuvring jets: a gentle, direct approach onto the point (no turning needed, a few m/s2 at most)
      const vDes = Math.min(25, Math.sqrt(2 * 0.9 * Math.max(0, D - 0.5)));
      const want = mul(sub(mul(dir, vDes), this.vel), 1 / 2.0);
      const wl = len(want);
      aWant = wl > 2.5 ? mul(want, 2.5 / wl) : want;
      jets = true;
    } else {
      // follow the envelope: a velocity wanted along the line to the goal, and the acceleration that gets the ship onto it (a
      // sideways drift is part of the difference, so it is cancelled on the way, not left for the end)
      aWant = mul(sub(mul(dir, vEnv), this.vel), 1 / this.tau);
      let aw0 = len(aWant), nh = aw0 > 1e-9 ? mul(aWant, 1 / aw0) : this.nose;
      // once the turn-over has begun it is committed: from then on the main drive only ever slows the ship (it is never
      // turned back round to speed up again), and the envelope is followed by throttling
      if (!this.committed && v > vEnv + 1 && dot(vh, nh) < 0) this.committed = true;
      if (this.committed) {
        const along = dot(aWant, vh);
        if (along > 0) aWant = sub(aWant, mul(vh, along));
        aw0 = len(aWant); nh = aw0 > 1e-9 ? mul(aWant, 1 / aw0) : mul(vh, -1);
        if (aw0 < 1e-3) aWant = { x: 0, y: 0, z: 0 };
        this.phase = dot(this.nose, mul(vh, -1)) > 0.985 ? 'brake' : 'flip';
      } else this.phase = v >= this.vMax * 0.999 && aw0 < 1 ? 'coast' : 'burn';
    }

    // the hull turns toward the thrust direction at its turn rate; the main drive follows how well it is lined up
    const aw = len(aWant);
    let thr = 0, acc = { x: 0, y: 0, z: 0 };
    if (jets) {
      acc = aWant;
      if (v > 0.5) this.nose = turnToward(this.nose, mul(vh, -1), this.turnRate * 0.5 * dt);
    } else if (aw > 1e-6) {
      const aimNose = mul(aWant, 1 / aw);
      this.nose = turnToward(this.nose, aimNose, this.turnRate * dt);
      const align = clampN(dot(this.nose, aimNose), 0, 1);
      if (this.phase !== 'coast') {
        thr = Math.min(1, aw / this.aMax) * (align > 0.97 ? 1 : align * align * align);
        acc = mul(this.nose, thr * this.aMax);
      }
    }
    this.accel = acc; this.thrust = thr;
    this.vel = add(this.vel, mul(acc, dt));
    if (len(this.vel) > this.vMax) this.vel = mul(unit(this.vel), this.vMax);
    this.pos = add(this.pos, mul(this.vel, dt));
    // parallel-transport the hull's up vector so the roll never flips
    const upP = sub(this.up, mul(this.nose, dot(this.up, this.nose)));
    this.up = len(upP) > 1e-6 ? unit(upP) : this.up;
    this.t += dt; this.peakSpeed = Math.max(this.peakSpeed, this.speed);
    // never inside Mars
    const rel = sub(this.pos, this.centre), rr = len(rel), floor = this.floorR;
    if (rr < floor && rr > 1) { this.pos = add(this.centre, mul(rel, floor / rr)); }

    // arrived
    const dd = len(sub(this.goal, this.pos));
    if (this.phase === 'creep' && dd < 1.5 && this.speed < 0.12) {
      this.pos = { ...this.goal }; this.vel = { x: 0, y: 0, z: 0 };
      if (this.legs.length) { this.goal = this.legs.shift(); this.phase = 'burn'; this.committed = false; this.legIndex = (this.legIndex || 0) + 1; }
      else { this.done = true; this.phase = 'arrived'; this.thrust = 0; }
    }
  }

  /** Run `seconds` of SHIP time in safe sub-steps. */
  advance(seconds, aMax = this.aMax) {
    let left = seconds;
    while (left > 1e-9 && !this.done) { const d = Math.min(0.25, left); this.step(d, aMax); left -= d; }
  }
}

/** How long a trip takes, by flying it, and the speed it peaks at.
 *  ROUND7: this used to step in whole seconds. The controller is only stable at 0.25 s or less (the same flight in 1 s steps chattered in
 *  the creep and never "arrived" for a standoff point 3 m higher: ETA 400,000 s, and 1,996 s instead of 1,801 s for another height).
 *  Now it flies the real 0.25 s steps, and if a flight still does not arrive it falls back to the plain flip-and-burn arithmetic
 *  (never a made-up number): `arrived` is false and `seconds` is that estimate, not the step cap. */
export function estimateTrip(o) {
  const t = new Transit(o), CAP = 4 * 3600 * 24;       // four days of ship time is far beyond any course here
  const D = len(sub(o.goal, o.pos)), a = Math.max(1e-6, (o.aMax || 1) * (t.brakeFrac || 0.85)), vMax = o.vMax ?? TRANSIT_DEFAULTS.vMax;
  const dAcc = vMax * vMax / a, flip = Math.PI / (o.turnRate ?? TRANSIT_DEFAULTS.turnRate);
  const secs = D <= dAcc ? 2 * Math.sqrt(D / a) + 2 * flip : 2 * vMax / a + (D - dAcc) / vMax + 2 * flip;
  // A world a long way off (a planet at real distance) would cost over a million sub-steps to fly just to ask how long it takes: past six
  // hours the closed form is within a percent of the flown time (the same one the four-day fallback below used), so say that at once.
  if (secs > 6 * 3600) return { seconds: secs, peakSpeed: Math.min(vMax, Math.sqrt(D * a)), arrived: false, error: NaN, closedForm: true };
  let guard = 0;
  while (!t.done && t.t < CAP && guard++ < 2_000_000) t.step(0.25, o.aMax);
  if (t.done) return { seconds: t.t, peakSpeed: t.peakSpeed, arrived: true, error: len(sub(t.pos, o.goal)) };
  return { seconds: secs, peakSpeed: Math.min(vMax, Math.sqrt(D * a)), arrived: false, error: len(sub(t.pos, o.goal)) };
}

export const _v = { sub, add, mul, unit, dot, len, cross };
