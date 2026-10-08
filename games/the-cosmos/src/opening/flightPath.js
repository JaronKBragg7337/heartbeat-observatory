// ============================================================================
// opening/flightPath.js - where the two ships are, on ONE continuous path, for a given stage clock. Pure maths (no three.js): the picture
// reads it, the tests check it. THE RULE (Jaron, 10/3 7:34 PM): one seamless Solar System, no loading screens, hidden jumps or frame-swap cuts.
// So the Ares does not "switch" from space to the ground and the Kestrel does not "pop" from the pad to the sky: each is a position in the PORT'S
// OWN FRAME (metres; +Y up from the port; Mars's centre far below), and the world below is drawn at its true place in that same frame all the way.
// Time compression is honest and shown (the long cruise to Ceres); a cut is not.
// ============================================================================
import { LINER_PHASE, KESTREL_PHASE, KESTREL, linerDescentPose, linerDown, kestrelLift, restHeight } from './script.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const MARS_RADIUS = 3_389_500;
export const CERES_RADIUS = 469_700;

/**
 * A monotone-safe cubic through knots [[t, v], ...] (Fritsch-Carlson tangents, so it never overshoots between knots). `m0` optionally fixes the
 * slope at the first knot. Used on the LOG of an altitude or a distance, so a fall from a million metres to three thousand is one smooth curve.
 */
export function pchip(knots, m0, m1) {
  const n = knots.length, h = [], d = [];
  for (let i = 0; i < n - 1; i++) { h.push(knots[i + 1][0] - knots[i][0]); d.push((knots[i + 1][1] - knots[i][1]) / h[i]); }
  const m = new Array(n);
  m[0] = m0 !== undefined ? m0 : d[0]; m[n - 1] = m1 !== undefined ? m1 : d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  for (let i = 0; i < n - 1; i++) {                    // clamp so the segment stays monotone
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (t) => {
    if (t <= knots[0][0]) return knots[0][1] + m[0] * (t - knots[0][0]);
    if (t >= knots[n - 1][0]) return knots[n - 1][1] + m[n - 1] * (t - knots[n - 1][0]);
    let i = 0; while (t > knots[i + 1][0]) i++;
    const s = (t - knots[i][0]) / h[i], s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * knots[i][1] + (s3 - 2 * s2 + s) * h[i] * m[i] + (-2 * s3 + 3 * s2) * knots[i + 1][1] + (s3 - s2) * h[i] * m[i + 1];
  };
}

// ---- the Ares: from a million kilometres out to Apron A, one path ---------------------------------------------------------
// Height over the port: log-smooth from a high orbit (5,000 km) through the entry (the heat and the shaking, which is real and is the only thing between
// the cruise and the landing) to the old final approach at 136 s (3.2 km, 2.6 km south of the apron). Mars is to starboard in the cruise (the lounge's
// windows) and swings under the ship as it comes in.
const LINER_H_KNOTS = [[0, Math.log(5.0e6)], [60, Math.log(3.0e6)], [112, Math.log(1.0e6)], [124, Math.log(1.6e5)], [130, Math.log(2.0e4)], [LINER_PHASE.entryEnd, Math.log(3200)]];
let linerH = null;
export function linerPath(t, def) {
  const down = linerDown(def);
  if (t >= LINER_PHASE.entryEnd) { const p = linerDescentPose(Math.min(t, LINER_PHASE.touch), def); return { ...p, alt: p.y - down.y, mars: 0 }; }
  if (!linerH) linerH = pchip(LINER_H_KNOTS, undefined, -0.0425);       // the slope hands over to the final approach's (-136 m/s at 3.2 km)
  const h = Math.exp(linerH(t)), side = 1 - smooth(104, LINER_PHASE.entryEnd, t);
  const x = down.x - 1.35 * (h + MARS_RADIUS) * side;
  return { x, y: down.y + h, z: down.z + 2600 + 0.12 * h * side, pitch: 0, roll: 0, alt: h, mars: side };
}
/** How strongly the entry heat shows at liner clock t, 0..1 (it rises as the ship meets the air, and fades as the ship slows near 3 km). */
export const linerHeat = (t) => smooth(LINER_PHASE.cruiseEnd - 6, LINER_PHASE.cruiseEnd + 8, t) * (1 - smooth(LINER_PHASE.entryEnd - 4, LINER_PHASE.entryEnd + 6, t));

// ---- the Kestrel: from Pad 01 to the crash --------------------------------------------------------------------------------
/** Where the wreck site sits in the port's frame (script.js: the site's origin is 2.6 km east and 350 m south of the port). */
export const WRECK_LOCAL = { x: 2600, z: 350 };
const FAR_FLIGHT_COMPRESSED = [KESTREL_PHASE.spaceStart + 6, 48];     // the time-compressed cruise to another world, in Kestrel clock seconds
export const farFlightWindow = () => FAR_FLIGHT_COMPRESSED.slice();
/**
 * The Kestrel's position in the port frame at Kestrel clock t. Mars hop: up out of the port to the edge of space and down onto the desert 2.6 km away.
 * Another world: up and away (Mars falls behind, to port), the cruise is time compressed (shown to the player), then the world comes up under the ship.
 * `ceres` is the far world's centre relative to the ship (see ceresRelative). Heights are above the port.
 */
export function kestrelPath(t, def, far) {
  const r = restHeight(def), spot = KESTREL.spot;
  if (t < KESTREL_PHASE.lift) return { x: spot.x, y: r, z: spot.z, pitch: 0, alt: 0 };
  const lift = kestrelLift(Math.min(t, KESTREL_PHASE.climbEnd), def), up = (t - KESTREL_PHASE.lift);
  const pitchUp = 0.16 * smooth(3, 17, t) * (1 - smooth(18, 34, t)), flare = 0.07 * smooth(44, 54, t) * (1 - smooth(55, 61, t));
  if (!far) {
    if (!kestrelPath._mars) kestrelPath._mars = pchip([[KESTREL_PHASE.climbEnd, Math.log(2400)], [28, Math.log(5.8e4)], [35, Math.log(7.4e4)], [44, Math.log(2.6e4)], [53, Math.log(2200)], [KESTREL_PHASE.crash, Math.log(45)]], 0.17);
    const h = t <= KESTREL_PHASE.climbEnd ? lift.y - r : Math.exp(kestrelPath._mars(t)), u = smooth(10, KESTREL_PHASE.crash - 4, t);
    void up;
    return { x: spot.x + (WRECK_LOCAL.x - spot.x) * u, y: r + h, z: spot.z + (WRECK_LOCAL.z - spot.z) * u, pitch: pitchUp - flare, alt: h };
  }
  if (!kestrelPath._far) kestrelPath._far = pchip([[KESTREL_PHASE.climbEnd, Math.log(2400)], [26, Math.log(4.5e5)], [34, Math.log(7.0e6)], [FAR_FLIGHT_COMPRESSED[1], Math.log(3.0e8)]], 0.17, 0);
  const h = t <= KESTREL_PHASE.climbEnd ? lift.y - r : Math.exp(kestrelPath._far(Math.min(t, FAR_FLIGHT_COMPRESSED[1])));   // after the cruise the ship coasts: Mars stays a dot behind
  return { x: spot.x + 0.55 * h * smooth(17, 34, t), y: r + h, z: spot.z - 0.08 * h * smooth(17, 34, t), pitch: pitchUp, alt: h };
}
/**
 * Where a far world's centre is, relative to the Kestrel, and how far: a speck ahead and above that comes round to starboard and under the ship.
 * Returns { dir: {x,y,z} unit, dist (m) }. Before `spaceStart + 4` the world is too far to draw (dist is huge).
 */
export function ceresRelative(t, radiusM, finalAltM) {
  const a = smooth(30, KESTREL_PHASE.crash, t);
  const u0 = [0.55, 0.28, -0.78], u1 = [0.95, -0.3, -0.12];
  let v = u0.map((c, i) => c + (u1[i] - c) * a); const n = Math.hypot(...v); v = v.map((c) => c / n);
  if (kestrelPath._ceresR !== radiusM) { kestrelPath._ceresR = radiusM; kestrelPath._ceresD = null; }
  if (!kestrelPath._ceresD) kestrelPath._ceresD = pchip([[24, Math.log(9.5e8)], [34, Math.log(2.4e8)], [FAR_FLIGHT_COMPRESSED[1], Math.log(radiusM + 6.53e6)], [KESTREL_PHASE.crash, Math.log(radiusM + finalAltM)]], undefined);
  const dist = Math.exp(kestrelPath._ceresD(t));
  return { dir: { x: v[0], y: v[1], z: v[2] }, dist };
}
