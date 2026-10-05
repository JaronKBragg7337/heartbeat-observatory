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
//
// A MOVING GOAL (F2). Every number here is in INERTIAL axes (Mars-centred, not turning). A goal may move: `goalFn(t)` gives its
// { pos, vel, acc } t seconds into the trip (a moon's standoff point, the gate over a port that turns with Mars). The computer then
// works on the goal-RELATIVE state: it burns toward where the goal is, brakes the speed it has RELATIVE to the goal, feeds the goal's
// acceleration forward, and arrives at rest relative to it (its velocity is then the goal's). With no goalFn nothing changed: a
// static goal is a goal whose velocity is zero.
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
    this.T0 = o.T0 ?? 0;
    this.inertial = !!o.inertial;                            // flown in the inertial axes of Mars's region (the ship's own coordinates turn); a far world's region is flown in its own frame                                     // game time at the start of the trip: goalFn(t) is the goal at T0 + t
    // not enumerable: a trip is saved with structuredClone, which cannot take a function (the owner re-binds it: bindGoal)
    Object.defineProperty(this, 'goalFn', { value: o.goalFn || null, writable: true, enumerable: false, configurable: true });
    this.pos = { ...o.pos }; this.vel = { ...o.vel };
    this.nose = unit(o.nose || { x: 0, y: 0, z: -1 }); this.up = unit(o.up || { x: 0, y: 1, z: 0 });
    this.finalGoal = { ...o.goal };
    const planGoal = this.goalFn ? Transit.interceptPoint(this.pos, this.goalFn, o.aMax, o.vMax ?? D.vMax, o.turnRate ?? D.turnRate) : this.finalGoal;
    this.legs = Transit.planLegs(this.pos, planGoal, o.centre || TRANSIT_DEFAULTS.centre, o.safeR ?? TRANSIT_DEFAULTS.safeR).map((p) => ({ ...p }));
    if (this.goalFn) this.legs[this.legs.length - 1].moving = true;     // the last leg chases the goal; waypoints before it are fixed points
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
  /** Speed relative to the goal (the closing speed that matters at the end): the same as `speed` for a goal that stands still. */
  get relSpeed() { return this._gv ? len(sub(this.vel, this._gv)) : len(this.vel); }
  bindGoal(fn) { Object.defineProperty(this, 'goalFn', { value: fn, writable: true, enumerable: false, configurable: true }); return this; }

  /** Where a moving goal will be about when a ship starting at `pos` reaches it (a few passes of "how long to get there"). Used to plan the legs round Mars. */
  static interceptPoint(pos, goalFn, aMax, vMax, turnRate) {
    const a = Math.max(1e-6, (aMax || 1) * 0.85), flip = Math.PI / (turnRate || 0.12), dAcc = vMax * vMax / a;
    let g = goalFn(0).pos;
    for (let k = 0; k < 6; k++) {
      const D = len(sub(g, pos)), t = D <= dAcc ? 2 * Math.sqrt(D / a) + 2 * flip : 2 * vMax / a + (D - dAcc) / vMax + 2 * flip;
      g = goalFn(Math.min(t, 6 * 3600)).pos;
    }
    return g;
  }
  /** The moving goal's state now: refreshed every step near it, every two seconds far off (and carried along by its velocity between). */
  _chase() {
    const near = this._gD !== undefined && this._gD < 60_000;
    if (!this._g || this.t - this._gT >= (near ? 0.25 : 2.0) - 1e-9) { this._g = this.goalFn(this.t); this._gT = this.t; }
    const g = this._g, dt = this.t - this._gT;
    if (dt < 1e-9) return g;
    return { pos: add(add(g.pos, mul(g.vel, dt)), mul(g.acc, 0.5 * dt * dt)), vel: add(g.vel, mul(g.acc, dt)), acc: g.acc };
  }

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
    const mov = !!(this.goal.moving && this.goalFn), ZERO = { x: 0, y: 0, z: 0 };
    let aim = this.goal, gv = ZERO, ga = ZERO;
    if (mov) { const g = this._chase(); aim = g.pos; gv = g.vel; ga = g.acc; this.finalGoal = { ...aim }; }
    this._gv = mov ? gv : null;
    const toAim = sub(aim, this.pos), D = len(toAim), dir = D > 1e-6 ? mul(toAim, 1 / D) : this.nose;
    if (mov) this._gD = D;
    const vrel = mov ? sub(this.vel, gv) : this.vel;
    const v = len(vrel), vh = v > 1e-9 ? mul(vrel, 1 / v) : dir;
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
      let want = mul(sub(mul(dir, vDes), vrel), 1 / 2.0);
      if (mov) want = add(want, ga);
      const wl = len(want);
      aWant = wl > 2.5 ? mul(want, 2.5 / wl) : want;
      jets = true;
    } else {
      // follow the envelope: a velocity wanted along the line to the goal, and the acceleration that gets the ship onto it (a
      // sideways drift is part of the difference, so it is cancelled on the way, not left for the end)
      aWant = mul(sub(mul(dir, vEnv), vrel), 1 / this.tau);
      if (mov) aWant = add(aWant, ga);
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
      } else this.phase = this.speed >= this.vMax * 0.999 && aw0 < 1 ? 'coast' : 'burn';
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
    let aim2 = this.goal, gv2 = ZERO;
    if (mov) { const g2 = this._chase(); aim2 = g2.pos; gv2 = g2.vel; this.finalGoal = { ...aim2 }; this._gv = gv2; }
    const dd = len(sub(aim2, this.pos));
    if (this.phase === 'creep' && dd < 1.5 && len(sub(this.vel, gv2)) < 0.12) {
      this.pos = { ...aim2 }; this.vel = { ...gv2 };
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
  const t = new Transit(o), CAP = 4 * 3600 * 24;       // o.goalFn (optional): a moving goal, as in Transit       // four days of ship time is far beyond any course here
  const D = len(sub(o.goal, o.pos)), a = Math.max(1e-6, (o.aMax || 1) * (t.brakeFrac || 0.85)), vMax = o.vMax ?? TRANSIT_DEFAULTS.vMax;
  const dAcc = vMax * vMax / a, flip = Math.PI / (o.turnRate ?? TRANSIT_DEFAULTS.turnRate);
  const secs = D <= dAcc ? 2 * Math.sqrt(D / a) + 2 * flip : 2 * vMax / a + (D - dAcc) / vMax + 2 * flip;
  // A world a long way off (a planet at real distance) would cost over a million sub-steps to fly just to ask how long it takes: past six
  // hours the closed form is within a percent of the flown time (the same one the four-day fallback below used), so say that at once.
  if (secs > 6 * 3600) return { seconds: secs, peakSpeed: Math.min(vMax, Math.sqrt(D * a)), arrived: false, error: NaN, closedForm: true };
  // FIX-R3: engines with no power (the drained lifeboat) can never arrive: flying 345,600 steps per destination, every redraw of the Course sheet, froze the phone
  if (!(o.aMax > 1e-9)) return { seconds: secs, peakSpeed: 0, arrived: false, error: NaN, closedForm: true, noThrust: true };
  let guard = 0;
  while (!t.done && t.t < CAP && guard++ < 2_000_000) t.step(0.25, o.aMax);
  if (t.done) return { seconds: t.t, peakSpeed: t.peakSpeed, arrived: true, error: len(sub(t.pos, o.goal)) };
  return { seconds: secs, peakSpeed: Math.min(vMax, Math.sqrt(D * a)), arrived: false, error: len(sub(t.pos, o.goal)) };
}

export const _v = { sub, add, mul, unit, dot, len, cross };
