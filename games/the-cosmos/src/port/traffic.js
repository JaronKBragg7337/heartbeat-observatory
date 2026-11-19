// ============================================================================
// port/traffic.js - Marineris Port's ambient traffic: ships that come and go by themselves, and a cargo tug on the apron.
//
// OWNS: a timetable, three parking spots no player is ever given, the ships that fly it and one ground vehicle. Decoration only:
//   nothing here collides, can be boarded, is saved, or is known to the server.
// DOES NOT OWN: any ship definition or exterior (src/ships/<type>/, used as built), the port (portSystem.js), the clock (space/clock.js).
//
// THE TIMETABLE IS A PURE FUNCTION OF THE WORLD CLOCK (space/clock.js `worldTimeS`, real UTC shared through the server), so everyone at
// the port sees the same ship touch down at the same moment, and somebody who walks up mid-approach finds it mid-approach.
//   - Visit n = 2k ("base") starts at k * SLOT_S (+ up to 30 s); visit n = 2k + 1 ("extra") starts half a slot later. No visit lasts
//     longer than a slot less that jitter, so at most one base and one extra are ever alive: two ships, never three.
//   - The phone tier flies the base visits only: one ship at a time, and the same ships a desktop player beside you sees.
//   - A base visit picks its spot from a hash of k; an extra takes a spot neither of its neighbours uses (there are three spots).
//   - A ship's pose is `poseAt(visit, t)`: straight in from 7 km out and 1.3 km up, a flare on the lift engines, a turn in the hover,
//     a vertical final, gear down, ramp down, a wait, then up, a turn, and away. No state is integrated, so nothing drifts.
// If a player's ship stands on the spot the visit is waved off: it overflies at hover height and climbs out.
//
// COST: one exterior per ship type in use (built the first time it is needed, kept, re-posed for every later visit), the port's and
// the fleet's own materials, no lights (additive cones and one sprite), nothing built or drawn while the camera is off Mars or more
// than ACTIVE_M from the port, and no allocation in the per-frame path.
// ============================================================================
import * as THREE from 'three';
import { shipDef } from '../ships/registry.js';
import { visualsFor } from '../ships/visuals.js';
import { Kit } from '../ship/shipKit.js';
import { makeShipMaterials } from '../ship/shipTextures.js';
import { worldTimeS } from '../space/clock.js';
import { getBody } from '../world/bodies.js';
import { surfaceRadiusFast } from '../world/field.js';
import { APRON, PADS } from './portSpec.js';

const DEG = Math.PI / 180;
export const SLOT_S = 480;                 // one base visit (and one extra) per slot
const JITTER_S = 30;
const VISIT_MAX_S = SLOT_S - JITTER_S - 5; // the longest a visit may last (see the header: this is what keeps it to two ships)
const ACTIVE_M = 8000;                     // beyond this from the port nothing is built, posed or drawn
const VEHICLE_M = 1500;
const D0 = 7000, H0 = 1300;                // where a ship is first seen: metres out, metres up
const DEND = 7000;                         // and how far out it is let go
const HC = 60;                             // the vertical climb before it turns for the corridor

/** Parking spots in port-local metres (x right, z back); a ship stands nose to -z. None is a pad the authority hands to a player
 *  (allocatedPad: Pad 01 at 0,0, then a grid east of x = 150), Pad 02 holds the shipyard's display hull. */
export const SPOTS = [
  { id: 'apron-a-north', name: 'Apron A north', type: 'hauler', x: APRON.x, z: APRON.z - 50, clearM: 45 },
  { id: 'pad-03', name: 'Pad 03', type: 'courier', x: PADS[2].x, z: PADS[2].z - 2, clearM: 26 },
  { id: 'apron-a-south', name: 'Apron A south', type: 'courier', x: APRON.x, z: APRON.z + 40, clearM: 26 },
];
/** How each class flies its visit. V cruise m/s, a braking m/s2 (the flare is atan(a / g) on the lift engines; Mars g = 3.72),
 *  af the drive's acceleration on the way out, av the vertical lift-off, Hh the hover height. */
const FLY = {
  hauler: { V: 110, a: 1.5, af: 2.2, av: 0.55, Hh: 70, descentS: 24, name: 'Tithonium Mule', registry: 'MR-3108', strobeY: 7.2 },
  courier: { V: 130, a: 1.8, af: 3.0, av: 0.7, Hh: 55, descentS: 20, name: 'Wayfarer', registry: 'MR-5521', strobeY: 4.2 },
};
for (const P of Object.values(FLY)) {
  P.cruiseS = (D0 - P.V * P.V / (2 * P.a)) / P.V; P.brakeS = P.V / P.a; P.flare = Math.atan(P.a / 3.72);
  P.liftS = Math.sqrt(2 * HC / P.av); P.liftV = P.av * P.liftS;
  P.departS = 2 + (-1 + Math.sqrt(1 + 2 * (DEND / P.af - 2 / 3)));          // d(tau) below, solved for DEND
}
const HOVER_S = 8, RAMP_WAIT_S = 8, RAMP_S = 6, BUTTON_UP_S = 9;
export const PHASES = ['cruise', 'braking', 'hover', 'final', 'landed', 'lifting', 'departing'];

const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const sm5 = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10));
/** A hash of two integers to [0, 1). */
function h01(n, salt) {
  let x = (Math.imul(n | 0, 0x9E3779B1) ^ Math.imul(salt + 1, 0x85EBCA6B)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7FEB352D); x ^= x >>> 15; x = Math.imul(x, 0x846CA68B); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const baseSpot = (k) => { const r = h01(k, 1); return r < 0.45 ? 0 : r < 0.8 ? 1 : 2; };

/** Visit n of the timetable, written into `v` (pure: the same n gives the same visit on every machine). */
export function visitAt(n, v = {}) {
  const k = Math.floor(n / 2), extra = n - 2 * k === 1;
  v.n = n; v.extra = extra; v.skip = false; v.diverted = false; v.seen = false;
  if (!extra) { v.spotIndex = baseSpot(k); v.start = k * SLOT_S + h01(k, 2) * JITTER_S; }
  else {
    const a = baseSpot(k), b = baseSpot(k + 1); let pick = -1, alt = -1;
    for (let i = 0; i < SPOTS.length; i++) if (i !== a && i !== b) { if (pick < 0) pick = i; else alt = i; }
    v.spotIndex = alt >= 0 && h01(k, 3) < 0.5 ? alt : pick;
    v.start = k * SLOT_S + SLOT_S / 2 + h01(k, 4) * JITTER_S;
    v.skip = h01(k, 5) < 0.25;                                           // a quiet half-slot now and then
  }
  const S = SPOTS[v.spotIndex], P = FLY[S.type];
  v.spot = S; v.type = S.type; v.P = P;
  v.da = (h01(n, 6) * 2 - 1) * 28 * DEG;                                 // the bearing it comes in on, off the pad's own line
  v.dd = (h01(n, 7) * 2 - 1) * 28 * DEG;                                 // and the one it leaves on
  const fixed = P.cruiseS + P.brakeS + HOVER_S + P.descentS + RAMP_WAIT_S + 2 * RAMP_S + BUTTON_UP_S + P.liftS + P.departS;
  v.dwell = Math.max(60, VISIT_MAX_S - fixed - h01(n, 8) * 45);          // ramp down, people at work
  v.t1 = P.cruiseS; v.t2 = v.t1 + P.brakeS; v.t3 = v.t2 + HOVER_S; v.t4 = v.t3 + P.descentS;
  v.t5 = v.t4 + RAMP_WAIT_S + 2 * RAMP_S + v.dwell + BUTTON_UP_S; v.t6 = v.t5 + P.liftS; v.t7 = v.t6 + P.departS;
  v.end = v.t7;
  return v;
}

/** Where visit `v` is `t` seconds after it started, written into `o`. Port-local metres; `alt` is the feet above the ground. */
export function poseAt(v, t, o = {}) {
  const P = v.P, S = v.spot;
  let d = 0, dir = v.da, sign = 1, alt = 0, yaw = 0, pitch = 0, gear = 1, ramp = 0, lift = 0, main = 0, phase = 0, ground = -1, hang = 1;
  if (t < v.t2) {
    if (t < v.t1) d = D0 - P.V * t; else { const u = v.t2 - t; d = 0.5 * P.a * u * u; phase = 1; }
    const q = d / D0, slope = 1.4 * (H0 - P.Hh) / D0 * Math.pow(q, 0.4);
    alt = P.Hh + (H0 - P.Hh) * Math.pow(q, 1.4);
    const flare = sm((t - v.t1) / 6) * (1 - sm((t - (v.t2 - 9)) / 9));
    yaw = v.da; pitch = -0.45 * Math.atan(slope) * (1 - flare) + P.flare * flare;
    gear = sm((t - (v.t2 - 34)) / 7);
    lift = 0.45 + 0.55 * sm((t - v.t1) / 4); main = 0.4 * (1 - sm((t - v.t1) / 3));
  } else if (t < v.t3) {
    phase = 2; alt = P.Hh; lift = 0.9;
    yaw = v.da + ((v.diverted ? v.dd : 0) - v.da) * sm((t - v.t2) / HOVER_S);
  } else if (v.diverted || t >= v.t6) {
    const tau = t - (v.diverted ? v.t3 : v.t6), u = tau - 2;
    d = tau < 2 ? P.af * tau * tau * tau / 12 : P.af * (2 / 3 + u + 0.5 * u * u);       // the drive comes up over two seconds
    dir = v.dd; sign = -1; phase = 6; yaw = v.dd;
    alt = (v.diverted ? P.Hh : HC + P.liftV * tau) + 0.2 * d;
    pitch = 11 * DEG * sm(tau / 8); gear = 1 - sm((tau - 5) / 7);
    lift = 1 - 0.5 * sm((tau - 8) / 10); main = sm(tau / 2.5);
  } else if (t < v.t4) {
    phase = 3; alt = P.Hh * (1 - sm5((t - v.t3) / P.descentS)); lift = 0.85;
  } else if (t < v.t5) {
    phase = 4; ground = t - v.t4;
    const up = sm((t - (v.t5 - 3)) / 3);                                 // the lift engines light three seconds before she goes
    lift = Math.max(1 - ground / 1.5, up) * 0.85; if (lift < 0) lift = 0;
    ramp = sm((ground - RAMP_WAIT_S) / RAMP_S) * (1 - sm((t - (v.t5 - BUTTON_UP_S - RAMP_S)) / RAMP_S));
    // the gear takes the weight (a short damped settle), and lets it go again as the lift comes up
    hang = Math.exp(-3.5 * ground) * Math.cos(7 * ground) + sm((t - (v.t5 - 1.5)) / 1.5);
  } else {
    const tau = t - v.t5; phase = 5; alt = 0.5 * P.av * tau * tau; lift = 1;
    yaw = v.dd * sm((tau - 3) / (P.liftS - 3));
  }
  o.x = S.x + sign * Math.sin(dir) * d; o.z = S.z + sign * Math.cos(dir) * d; o.alt = alt;
  o.yaw = yaw; o.pitch = pitch; o.gear = gear; o.hang = hang; o.ramp = ramp; o.lift = lift; o.main = main; o.phase = phase; o.ground = ground;
  const end = v.diverted ? v.t3 + P.departS : v.end;
  o.fade = sm(t / 4) * sm((end - t) / 4);
  return o;
}

// ---- the tug's round ---------------------------------------------------------------------------------------------------
// A rounded rectangle about Pad 01, driven depot -> south lane -> the taxi spine (west of its cones) -> north lane -> back.
// It keeps clear of the pads, the foot of every ramp, the masts and the market; the spine and the lanes are the port's own vehicle ways.
const R_TURN = 10, X_W = -42, X_E = 25, Z_N = -45, Z_S = 48, HALF_PI = Math.PI / 2;
const ROUTE = [
  { x0: X_W, z0: 20, x1: X_W, z1: Z_S - R_TURN },
  { cx: X_W + R_TURN, cz: Z_S - R_TURN, a0: Math.PI },
  { x0: X_W + R_TURN, z0: Z_S, x1: X_E - R_TURN, z1: Z_S },
  { cx: X_E - R_TURN, cz: Z_S - R_TURN, a0: HALF_PI },
  { x0: X_E, z0: Z_S - R_TURN, x1: X_E, z1: Z_N + R_TURN },
  { cx: X_E - R_TURN, cz: Z_N + R_TURN, a0: 0 },
  { x0: X_E - R_TURN, z0: Z_N, x1: X_W + R_TURN, z1: Z_N },
  { cx: X_W + R_TURN, cz: Z_N + R_TURN, a0: -HALF_PI },
  { x0: X_W, z0: Z_N + R_TURN, x1: X_W, z1: 20 },
];
let ROUTE_LEN = 0;
for (const s of ROUTE) { s.len = s.cx === undefined ? Math.hypot(s.x1 - s.x0, s.z1 - s.z0) : R_TURN * HALF_PI; s.s0 = ROUTE_LEN; ROUTE_LEN += s.len; }
const V_MAX = 3.5, V_ACC = 0.7;
// where it stops (metres along the round) and for how long: the depot, the Pad 03 branch, the Pad 02 branch
const STOPS = [
  { name: 'depot', s: 0, wait: 14 },
  { name: 'pad 03 branch', s: ROUTE[4].s0 + (Z_S - R_TURN - 30), wait: 7 },
  { name: 'pad 02 branch', s: ROUTE[4].s0 + (Z_S - R_TURN + 28), wait: 7 },
];
let ROUND_S = 0;
STOPS.forEach((st, i) => { const nx = STOPS[(i + 1) % STOPS.length]; st.dist = (nx.s - st.s + ROUTE_LEN) % ROUTE_LEN || ROUTE_LEN; st.driveS = st.dist / V_MAX + V_MAX / V_ACC; st.t0 = ROUND_S; ROUND_S += st.wait + st.driveS; });
/** A point `s` metres along the round: x, z and the way it heads (fx, fz), written into `o`. */
function routeAt(s, o) {
  s = ((s % ROUTE_LEN) + ROUTE_LEN) % ROUTE_LEN;
  let g = ROUTE[0]; for (let i = ROUTE.length - 1; i >= 0; i--) if (s >= ROUTE[i].s0) { g = ROUTE[i]; break; }
  const u = s - g.s0;
  if (g.cx === undefined) { const fx = (g.x1 - g.x0) / g.len, fz = (g.z1 - g.z0) / g.len; o.x = g.x0 + fx * u; o.z = g.z0 + fz * u; o.fx = fx; o.fz = fz; }
  else { const a = g.a0 - u / R_TURN, c = Math.cos(a), sn = Math.sin(a); o.x = g.cx + R_TURN * c; o.z = g.cz + R_TURN * sn; o.fx = sn; o.fz = -c; }
  return o;
}
/** Where the tug is on its round at world time `T`: metres along it, its speed, and the stop it is waiting at (or -1). */
function roundAt(T, o) {
  let t = ((T % ROUND_S) + ROUND_S) % ROUND_S, i = STOPS.length - 1;
  while (i > 0 && t < STOPS[i].t0) i--;
  const st = STOPS[i]; t -= st.t0;
  if (t < st.wait) { o.s = st.s; o.speed = 0; o.stop = i; return o; }
  t -= st.wait; const ta = V_MAX / V_ACC, tc = st.driveS - ta; let d;
  if (t < ta) { d = 0.5 * V_ACC * t * t; o.speed = V_ACC * t; }
  else if (t < tc) { d = 0.5 * V_ACC * ta * ta + V_MAX * (t - ta); o.speed = V_MAX; }
  else { const u = st.driveS - t; d = st.dist - 0.5 * V_ACC * u * u; o.speed = V_ACC * u; }
  o.s = st.s + d; o.stop = -1; return o;
}

const B = (k, key, x, y, z, w, h, d, c = 0.04, o) => k.bevelBox(key, x, y, z, w, h, d, c, o);
const WHEEL_R = 0.4, HITCH_M = 4.6;        // the trailer's axle centre rides this far behind the tug's

function buildTug(mats, low) {
  const seg = low ? 8 : 14, root = new THREE.Group(); root.name = 'port-traffic:tug';
  const axle = (r, track) => { const k = new Kit();
    for (const s of [-1, 1]) { k.cyl('rubber', s * track, 0, 0, r, 0.3, seg, { axis: 'x' }); k.cyl('steel', s * (track + 0.16), 0, 0, r * 0.5, 0.02, seg, { axis: 'x' }); k.box('steelDark', s * (track + 0.175), 0, 0, 0.02, r * 0.9, 0.09); }
    k.cyl('steelDark', 0, 0, 0, 0.06, track * 2, 6, { axis: 'x' });
    return k.toGroup(mats, { name: 'axle', cast: !low }); };
  // the tug: nose to -z, a low yellow body, a dark cab with lit glass, lamps at both ends
  const tug = new THREE.Group(), k = new Kit(); k.tiles = { paint: 8, metal: 1 };
  B(k, 'hazard', 0, 0.62, 0, 1.8, 0.5, 3.1, 0.06); B(k, 'steelDark', 0, 0.98, -0.85, 1.7, 0.26, 1.2, 0.04);
  for (let i = 0; i < 5; i++) k.box('gunmetal', -0.6 + i * 0.3, 1.12, -0.85, 0.08, 0.03, 1.0);
  B(k, 'plasticDark', 0, 1.36, 0.45, 1.6, 1.0, 1.4, 0.07);
  k.box('plasticDark', 0, 1.45, -0.26, 1.36, 0.5, 0.02, { col: [0.45, 0.6, 0.7] });
  for (const s of [-1, 1]) { k.box('plasticDark', s * 0.805, 1.45, 0.45, 0.02, 0.5, 1.0, { col: [0.45, 0.6, 0.7] });
    k.box('glowWhite', s * 0.6, 0.72, -1.56, 0.26, 0.14, 0.02); k.box('glowRed', s * 0.65, 0.72, 1.56, 0.2, 0.1, 0.02);
    B(k, 'plasticDark', s * 0.93, 0.74, -1.0, 0.1, 0.1, 1.0, 0.03); B(k, 'plasticDark', s * 0.93, 0.74, 1.0, 0.1, 0.1, 1.0, 0.03); }
  B(k, 'steelDark', 0, 0.46, -1.62, 1.7, 0.2, 0.14, 0.03); B(k, 'steelDark', 0, 0.46, 1.62, 1.5, 0.16, 0.12, 0.03);
  k.box('steelDark', 0, 1.9, 0.45, 0.14, 0.05, 0.14);
  k.pipe('steelDark', [0, 0.5, 1.6], [0, 0.5, 2.25], 0.045, 6); k.cyl('steelDark', 0, 0.5, 2.25, 0.1, 0.12, seg);
  tug.add(k.toGroup(mats, { name: 'tug-body', cast: !low }));
  const bk = new Kit(); bk.cyl('glowAmber', 0, 1.99, 0.45, 0.075, 0.12, 6);
  const beacon = bk.toGroup(mats, { name: 'tug-beacon' }); tug.add(beacon);
  const a0 = axle(WHEEL_R, 0.86), wheels = [];
  for (const z of [-1.0, 1.0]) { const a = wheels.length ? a0.clone() : a0; a.position.set(0, WHEEL_R, z); tug.add(a); wheels.push(a); }
  // the trailer: a flatbed with two strapped crates, its drawbar on the tug's hitch
  const trailer = new THREE.Group(), tk = new Kit(); tk.tiles = { paint: 8, metal: 1 };
  B(tk, 'steelDark', 0, 0.7, 0, 1.9, 0.14, 3.6, 0.03); B(tk, 'hazard', 0, 0.7, 1.81, 1.9, 0.14, 0.04, 0.01);
  for (const s of [-1, 1]) { tk.box('gunmetal', s * 0.9, 0.8, 0, 0.06, 0.08, 3.5); tk.box('glowRed', s * 0.75, 0.66, 1.84, 0.16, 0.08, 0.02); }
  tk.pipe('steelDark', [0, 0.6, -1.8], [0, 0.5, -HITCH_M + 2.3], 0.045, 6);
  B(tk, 'crateA', 0, 1.33, -0.8, 1.5, 1.1, 1.5, 0.04); B(tk, 'crateB', 0.1, 1.22, 0.9, 1.4, 0.9, 1.3, 0.04);
  for (const z of [-1.2, -0.4]) tk.box('hazard', 0, 1.33, z, 1.53, 1.13, 0.06);
  tk.box('plasticDark', 0.1, 1.22, 0.9, 1.43, 0.93, 0.06);
  trailer.add(tk.toGroup(mats, { name: 'trailer-body', cast: !low }));
  for (const z of [-0.55, 0.55]) { const a = a0.clone(); a.position.set(0, WHEEL_R, z); trailer.add(a); wheels.push(a); }
  root.add(tug, trailer);
  return { root, tug, trailer, beacon, wheels };
}

let _strobeMat = null;
function strobeMaterial() {
  if (_strobeMat) return _strobeMat;
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  _strobeMat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: false });
  return _strobeMat;
}

export class PortTraffic {
  /** port: the built PortSystem (its engine, site, tier and the fleet's shared exterior materials are all that is used). */
  constructor(port) {
    this.port = port; this.engine = port.engine; this.site = port.site; this.low = port.tier === 'low';
    this.root = new THREE.Group(); this.root.name = 'port-traffic'; this.root.visible = false;
    this.engine.scene.add(this.root);
    this.entry = this.engine.track({ worldPos: this.site.center, quaternion: port.quaternion, object3d: this.root });
    this.shiftS = 0;                       // dev: moves the timetable's clock (seconds) without touching the sky's
    this.enabled = true; this.active = false; this.now = 0;
    this.ctx = { ship: null, world: null, opening: null };
    this.pool = [];                        // ship exteriors, kept and re-posed: { type, ext, root, n, ... }
    this.visits = [visitAt(0), visitAt(1), visitAt(2), visitAt(3)]; for (const v of this.visits) v.n = NaN;
    this.pose = {}; this.vehicle = null; this._route = { x: 0, z: 0, fx: 0, fz: 1 }; this._round = { s: 0, speed: 0, stop: -1 };
    this._blockAt = -1; this.buildMs = { last: 0, total: 0, count: 0 };
    this._tick = (dt) => this.update(dt);
    this.engine.addUpdater(this._tick);
  }
  /** What only main knows: the player's ship, the shared world (other players' ships) and the opening. All optional. */
  setContext(ctx) { Object.assign(this.ctx, ctx); return this; }
  time() { return worldTimeS() + this.shiftS; }

  // ---- one frame ---------------------------------------------------------------------------------------------------------
  update() {
    const eng = this.engine, c = this.site.center, cam = eng.cameraWorldPos;
    const op = this.ctx.opening; let on = this.enabled && eng.activeFrame === eng.rootFrame && !(op && (typeof op === 'function' ? op() : op)?.active);
    let camD = 0;
    if (on) { camD = Math.hypot(cam.x - c.x, cam.y - c.y, cam.z - c.z); on = camD < ACTIVE_M; }
    this.active = on;
    if (!on) { if (this.root.visible) { this.root.visible = false; for (const s of this.pool) { s.root.visible = false; s.n = null; } } return; }
    this.root.visible = true;
    const now = this.now = this.time(), k0 = Math.floor(now / SLOT_S);
    const check = now < this._blockAt || now - this._blockAt > 0.5; if (check) this._blockAt = now;
    // an exterior whose visit has left the timetable's window (or been replaced in it) is free again before anything asks for one
    for (const s of this.pool) { s.used = false; if (s.n !== null && (s.n < 2 * k0 - 1 || s.n > 2 * k0 + 1 || this.visits[s.n & 3].n !== s.n)) { s.n = null; s.root.visible = false; } }
    for (let n = 2 * k0 - 1; n <= 2 * k0 + 1; n++) {
      if (this.low && (n & 1)) continue;                                 // the phone flies the base visits only
      const v = this.visits[n & 3]; if (v.n !== n) visitAt(n, v);
      if (v.skip) continue;
      const t = now - v.start; if (t < 0) continue;
      if (!v.seen || (check && !v.diverted && t < v.t3)) {
        const blocked = this.spotBlocked(v.spot);
        if (blocked) { if (t < v.t3) v.diverted = true; else if (!v.seen) { v.skip = true; continue; } }     // somebody is parked there: wave it off (or, joining late, leave it out)
        v.seen = true;
      }
      if (t >= (v.diverted ? v.t3 + v.P.departS : v.end)) continue;
      const s = this.shipFor(v); if (!s) continue;
      s.used = true; this.poseShip(s, poseAt(v, t, this.pose), now);
    }
    for (const s of this.pool) if (!s.used && s.n !== null) { s.n = null; s.root.visible = false; }
    this.driveVehicle(now, camD);
  }

  /** Is a real ship standing on (or low over) this spot? The player's own, and in a shared world everybody's. */
  spotBlocked(S) {
    const st = this.site, c = st.center, R = st.right, Bk = st.back, U = st.up, ctx = this.ctx;
    const near = (p) => { if (!p) return false; const x = p.x - c.x, y = p.y - c.y, z = p.z - c.z;
      return Math.hypot(x * R.x + y * R.y + z * R.z - S.x, x * Bk.x + y * Bk.y + z * Bk.z - S.z) < S.clearM && Math.abs(x * U.x + y * U.y + z * U.z) < 150; };
    if (ctx.ship && ctx.ship.flight && near(ctx.ship.flight.pos)) return true;
    const ships = ctx.world && ctx.world.snapshot && ctx.world.snapshot.ships;
    if (ships) for (const id in ships) { const s = ships[id]; if (s && s.frameId === 'mars' && s.pose && near(s.pose.pos)) return true; }
    return false;
  }

  /** The exterior that flies visit `v`: the one already on it, a free one of its class, or a new one (built once, kept for good). */
  shipFor(v) {
    let free = null;
    for (const s of this.pool) { if (s.n === v.n) return s; if (!free && s.n === null && s.type === v.type) free = s; }
    if (!free) free = this.buildShip(v.type);
    if (free) { free.n = v.n; free.rampP = -1; free.len = -1; }
    return free;
  }
  buildShip(type) {
    const t0 = performance.now(), def = shipDef(type), V = visualsFor(type), P = FLY[type];
    const mats = this.port.sharedMaterials || this._mats || (this._mats = makeShipMaterials({ tier: this.port.tier }));
    const tex = V.decalTexture ? V.decalTexture(THREE, def, P.name, P.registry) : null;
    const decal = tex ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }) : null;
    const ext = V.buildExterior(def.layout, mats, { tier: this.port.tier, def, remote: true, decal });
    V.applyNeutralPose(ext);
    const root = ext.root; root.name = 'port-traffic:' + type; root.rotation.order = 'YXZ'; root.visible = false;
    if (this.low) root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    // with the ramp down the hold is open and this exterior has no rooms behind it: a dark, dimly lit box stands in for them
    const door = def.layout.doors && def.layout.doors.find((d) => d.noZone && d.b === 'outside' && d.kind === 'portal');
    const R = def.ramps.cargo, G = def.gear, rest = G.nominal + G.soleOffset;
    const s = { type, def, ext, root, n: null, used: false, rampP: -1, len: -1, G, R,
      rampAngle: Math.min(0.72, Math.max(0.12, Math.asin(Math.min(0.9, Math.max(0.05, rest / R.length))))),
      rampYaw: Math.atan2(R.dir ? R.dir.x : 0, R.dir ? R.dir.z : 1), hold: null, strobe: null };
    const hinge = ext.ramps.cargo.hinge; hinge.rotation.order = 'YXZ';
    {
      const w = door ? door.w : R.width, h = door ? door.h : (R.raisedHeight || 2.6), y0 = door ? door.y : 0, depth = Math.min(9, def.envelope.depth * 0.3);
      const k = new Kit(), z1 = R.hinge.z - 0.05, z0 = z1 - depth, x0 = R.hinge.x - w / 2, x1 = R.hinge.x + w / 2, y1 = y0 + h, dark = [0.2, 0.2, 0.21];
      k.poly('plasticDark', [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], null, [0.5, 0.5, 0.5]);       // deck
      k.poly('plasticDark', [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], null, dark);                  // overhead
      k.poly('plasticDark', [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], null, dark);                  // forward wall
      k.poly('plasticDark', [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], null, dark);
      k.poly('plasticDark', [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], null, dark);
      k.box('glowAmber', 0 + R.hinge.x, y1 - 0.04, z1 - depth * 0.4, w * 0.5, 0.03, 0.18);
      k.box('crateB', x0 + w * 0.22, y0 + 0.5, z0 + 0.8, Math.min(1.2, w * 0.3), 1.0, 1.2); k.box('crateA', x1 - w * 0.2, y0 + 0.4, z0 + 1.6, Math.min(1.0, w * 0.26), 0.8, 1.0);
      s.hold = k.toGroup(mats, { name: 'traffic-hold' }); s.hold.visible = false; root.add(s.hold);
    }
    s.strobe = new THREE.Sprite(strobeMaterial()); s.strobe.position.set(0, P.strobeY, 2); s.strobe.scale.set(0.014, 0.014, 1); s.strobe.visible = false; root.add(s.strobe);
    for (const e of ext.engines) e.outer.visible = e.core.visible = false;
    for (const p of ext.liftPods) p.mesh.visible = p.core.visible = false;
    this.root.add(root); this.pool.push(s);
    this.buildMs.last = performance.now() - t0; this.buildMs.total += this.buildMs.last; this.buildMs.count++;
    return s;
  }

  poseShip(s, p, now) {
    const G = s.G, ext = s.ext, root = s.root;
    // gear: retracted in the cruise, hanging at full stroke on the way down, carrying the weight on the ground
    const down = G.nominal + 0.25 * p.hang, len = 0.35 + (down - 0.35) * p.gear;
    if (Math.abs(len - s.len) > 1e-4) { s.len = len; for (const leg of ext.legs) { leg.foot.position.y = -len; leg.piston.scale.y = len + 0.2; leg.piston.position.y = 0.2; } }
    root.visible = true;
    root.position.set(p.x, p.alt + G.soleOffset + len, p.z); root.rotation.set(p.pitch, p.yaw, 0);
    const f = p.fade < 0.02 ? 0.02 : p.fade; if (root.scale.x !== f) root.scale.setScalar(f);
    if (Math.abs(p.ramp - s.rampP) > 1e-4) {
      s.rampP = p.ramp; const h = ext.ramps.cargo.hinge;
      h.scale.set(1, 1, 1); h.rotation.set(-HALF_PI + (s.rampAngle + HALF_PI) * p.ramp, s.rampYaw, 0);
      s.hold.visible = p.ramp > 0.01;
    }
    // glow only while the engines fire: the drive in the cruise and on the way out, the lift engines whenever she is off her gear
    const fl = 0.92 + 0.08 * Math.sin(now * 41), m = p.main, mv = m > 0.02;
    for (const e of ext.engines) {
      e.outer.visible = e.core.visible = mv; if (!mv) continue;
      e.outer.scale.set(0.8 + 0.5 * m, 0.8 + 0.5 * m, 0.4 + 1.6 * m); e.outer.material.opacity = (0.15 + 0.6 * m) * fl * Math.min(1, m * 5);
      e.core.scale.set(0.8 + 0.4 * m, 0.8 + 0.4 * m, 0.4 + 1.5 * m); e.core.material.opacity = (0.2 + 0.7 * m) * fl * Math.min(1, m * 5);
    }
    const l = p.lift, lv = l > 0.02;
    for (const q of ext.liftPods) {
      q.mesh.visible = q.core.visible = lv; if (!lv) continue;
      q.mesh.scale.set(0.6, 0.7, 0.6); q.core.scale.set(0.6, 0.7, 0.6);
      q.core.material.opacity = 0.6 * l * fl; q.mesh.material.opacity = 0.5 * l * fl;
    }
    // anti-collision strobe: a double flash every 1.3 s, off once she is down and quiet
    const ph = now % 1.3; s.strobe.visible = lv && (ph < 0.07 || (ph > 0.2 && ph < 0.27));
  }

  // ---- the tug -----------------------------------------------------------------------------------------------------------
  buildVehicle() {
    const t0 = performance.now(), v = buildTug(this.port.materials, this.low);
    // the real ground under the round, sampled once (the graded apron is a plane, but this does not assume it)
    const body = getBody(this.site.bodyId), n = Math.ceil(ROUTE_LEN / 2), h = new Float32Array(n + 1), o = this._route;
    for (let i = 0; i <= n; i++) { routeAt(i * ROUTE_LEN / n, o); const w = this.site.toWorld(o.x, 0, o.z), l = Math.hypot(w.x, w.y, w.z), r = surfaceRadiusFast(body, w.x / l, w.y / l, w.z / l);
      h[i] = this.site.toLocal({ x: w.x / l * r, y: w.y / l * r, z: w.z / l * r }).y; }
    v.heights = h; v.step = ROUTE_LEN / n; v.root.visible = false;
    this.root.add(v.root); this.vehicle = v;
    this.buildMs.last = performance.now() - t0; this.buildMs.total += this.buildMs.last; this.buildMs.count++;
  }
  groundAt(s) { const v = this.vehicle, u = (((s % ROUTE_LEN) + ROUTE_LEN) % ROUTE_LEN) / v.step, i = Math.floor(u), f = u - i; return v.heights[i] * (1 - f) + v.heights[Math.min(i + 1, v.heights.length - 1)] * f; }
  driveVehicle(now, camD) {
    if (camD > VEHICLE_M) { if (this.vehicle) this.vehicle.root.visible = false; return; }
    if (!this.vehicle) this.buildVehicle();
    const v = this.vehicle, r = roundAt(now, this._round), o = this._route;
    v.root.visible = true;
    routeAt(r.s, o); v.tug.position.set(o.x, this.groundAt(r.s), o.z); v.tug.rotation.y = Math.atan2(-o.fx, -o.fz);
    routeAt(r.s - HITCH_M, o); v.trailer.position.set(o.x, this.groundAt(r.s - HITCH_M), o.z); v.trailer.rotation.y = Math.atan2(-o.fx, -o.fz);
    const roll = -r.s / WHEEL_R; for (const w of v.wheels) w.rotation.x = roll;
    v.beacon.visible = (now % 1) < 0.5;
  }

  // ---- for tests and review shots (window.cosmos.port.traffic) -------------------------------------------------------------
  /** Every ship in the air or on the ground right now, with its phase; and the tug. */
  status() {
    const now = this.time(), ships = [];
    for (const s of this.pool) { if (s.n === null) continue; const v = this.visits[s.n & 3], p = poseAt(v, now - v.start, {});
      ships.push({ n: v.n, type: v.type, spot: v.spot.id, phase: PHASES[p.phase], diverted: v.diverted, t: +(now - v.start).toFixed(2), x: p.x, y: s.root.position.y, z: p.z, alt: p.alt, yaw: p.yaw, pitch: p.pitch, gear: p.gear, ramp: p.ramp, lift: p.lift, main: p.main }); }
    const r = roundAt(now, {}), o = routeAt(r.s, {});
    return { time: now, active: this.active, phone: this.low, ships, built: this.pool.length, buildMs: { ...this.buildMs },
      vehicle: { x: o.x, z: o.z, speed: r.speed, stop: r.stop < 0 ? null : STOPS[r.stop].name, shown: !!(this.vehicle && this.vehicle.root.visible), roundS: ROUND_S, lengthM: ROUTE_LEN } };
  }
  /** The next `count` visits on the timetable (what, where, when it lands and leaves), from now. */
  timetable(count = 6) {
    const now = this.time(), out = [];
    for (let n = 2 * Math.floor(now / SLOT_S) - 1; out.length < count; n++) { const v = visitAt(n, {}); if (v.skip || (this.low && v.extra) || v.start + v.end < now) continue;
      out.push({ n, type: v.type, spot: v.spot.id, inS: Math.round(v.start - now), landsInS: Math.round(v.start + v.t4 - now), liftsInS: Math.round(v.start + v.t5 - now), goneInS: Math.round(v.start + v.end - now) }); }
    return out;
  }
  /** Move the timetable's clock so a ship is in `phase` ('cruise' | 'braking' | 'hover' | 'final' | 'landed' | 'lifting' | 'departing'), `into` (0..1) of the way through it.
   *  o.type picks the class ('hauler' | 'courier'), o.spot a spot id. Only base visits are used, so it works on the phone tier too. */
  jumpTo(phase, o = {}) {
    const now = this.time(), v = {}, i = PHASES.indexOf(phase); if (i < 0) throw new Error('phase is one of ' + PHASES.join(', '));
    for (let k = Math.floor(now / SLOT_S) + 1, tries = 0; tries < 400; k++, tries++) {
      visitAt(2 * k, v); if ((o.type && v.type !== o.type) || (o.spot && v.spot.id !== o.spot)) continue;
      const edge = [0, v.t1, v.t2, v.t3, v.t4, v.t5, v.t6, v.t7], into = o.into ?? (phase === 'landed' ? 0.3 : 0.6);
      this.shiftS += v.start + edge[i] + (edge[i + 1] - edge[i]) * into - now;
      return { n: v.n, type: v.type, spot: v.spot.id, shiftS: this.shiftS };
    }
    return null;
  }
  shift(seconds) { this.shiftS += seconds; return this.shiftS; }
}
