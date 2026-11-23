// ============================================================================
// worlds/ceres/activity.js - OCCATOR WORKS AT WORK: the two sides of Ceres, each seen doing its own job.
//
// Ceres is home to two factions (roles/seats.js): IRONCLAD (the pit, the foundry) and GREENHAVEN (water, filters, growing). Until now they
// were style sheets and one number. This file gives each side a place, people and a ship of its own at the Works:
//   IRONCLAD    an ore yard west of the foundry: a three-bay bunker, a skip on rails from the bins' chute to the bunker, yard hands in
//               amber-striped suits, and an ore hauler in Ironclad livery that lands beside the yard and carries the stockpile away.
//   GREENHAVEN  a grow hall behind Doctor Roth, salt trays, a filter skid and a row of clean-water tanks with level gauges, hands in
//               leaf-green stripes pushing a filter trolley, and a water tender in Greenhaven livery that lands by the tanks and fills them.
//   BETWEEN     a lit board by the pad that names both sides and says how they stand (the world's balance and home strength,
//               roles/balance.js, read from the shared world's snapshot; "no report" in a solo world).
//
// OWNS: decoration only. Nothing here collides, can be boarded or talked to, is saved, or is known to the server. It stands clear of the
//   main pad, the mission givers and every solid in layout.js. DOES NOT OWN: any ship exterior (src/ships/<type>/, used as built, tinted by
//   the faction style sheet), the people (the Loft rigs every world uses), the clock, the outpost (outpost.js) or its materials (borrowed).
//
// THE TIMETABLE IS A PURE FUNCTION OF THE WORLD CLOCK (space/clock.js `worldTimeS`, the same approach as port/traffic.js), so every player
// at the Works sees the same ship touch down at the same moment, and the same heap in the bunker:
//   - Slot k (SLOT_S long) holds ONE visit, starting up to JITTER_S into it: even slots the Ironclad hauler, odd slots the Greenhaven
//     tender. No visit outlasts its slot, so one ship is alive at a time on every tier.
//   - A ship's pose is `poseAt(visit, t)`. Ceres pulls at 0.284 m/s2: a hover costs almost nothing, so the approach is slow, the hover is
//     long (the hauler turns end for end in it), the final takes most of a minute and the lift-off is a crawl. The braking tilt is
//     atan(a / g): a ship that slows at 0.16 m/s2 here stands 29 degrees nose-up on its lift engines.
//   - The ore stockpile and the water gauges are functions of the same clock: the hauler's stay empties the bunker bay by bay and the pit
//     refills it before the next one; the tender's stay fills the tanks and the Works drinks them down.
// If a player's ship stands on a spot the visit is waved off at hover height, as at Marineris.
//
// COST: one merged mesh per material (the outpost's own materials), one sign texture, one board texture (redrawn only when its numbers
// change), one additive mesh for lamplight (no THREE lights), three people a side on the phone (four on a desktop), one ship exterior per
// side built the first time it is due. Nothing is built or ticked while the camera is more than ACTIVE_M from the pad, and the per-frame
// path allocates nothing.
// ============================================================================
import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { makePortMaterials } from '../../port/portArt.js';
import { shipDef } from '../../ships/registry.js';
import { visualsFor } from '../../ships/visuals.js';
import { worldTimeS } from '../../space/clock.js';
import { yardVoice, yardHush, yardSoundStatus } from '../_kit/sideYard.js';       // the yard ships' sound (Ceres has no air: felt through the ground only)
import { PortTraffic } from '../../port/traffic.js';            // its poseShip (gear, ramp, engine glow, strobe) is used as written
import { beatPose } from '../../port/portPeople.js';            // the walkers' beat: a pure function of time
import { factionStyle, shipMark, applyLiveryTint, css } from '../../factions/registry.js';
import { drawEmblem, drawSign } from '../../factions/emblems.js';
import { dressForWorld } from '../../crew/suitPolicy.js';
import { describe as describeHome, strengthOf } from '../../roles/balance.js';
import { leadersOf } from '../../roles/holders.js';

import { SLOT_S, SIDES, PHASES, SPOTS, visitAt, poseAt, ORE_MAX, oreLevelAt, waterLevelAt, JITTER_S, FLY, RAMP_WAIT_S, BUTTON_UP_S, sm, clamp01 } from './timetable.js';       // the timetable itself is pure and lives apart, so the server can read it too
export { SLOT_S, SIDES, PHASES, SPOTS, visitAt, poseAt, ORE_MAX, oreLevelAt, waterLevelAt };
const DEG = Math.PI / 180, HALF_PI = Math.PI / 2;
const ACTIVE_M = 6000;                     // beyond this from the pad nothing is built, posed or drawn
const PEOPLE_M = 320;                      // the workers are built and ticked inside this

// ---- people who push something ----------------------------------------------------------------------------------------------
/** A hand pushing a cart to and fro on the line a -> b: push out, stop, walk round to the other end, push back, stop, walk round. Pure.
 *  r: { a: [x, z], b: [x, z], speed, gap (the hand stands this far behind the cart's middle), side (how wide he walks round it), rest: [at a, at b] }.
 *  Writes the hand (x, z, yaw, moving) and the cart (cs: metres along the line; phase 0..5; ru: how far through a stop, 0..1) into `o`. */
export function pushPose(r, t, o = {}) {
  if (r._L === undefined) {
    const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1]; r._L = Math.hypot(dx, dz); r._ux = dx / r._L; r._uz = dz / r._L;
    r._leg = Math.hypot(r.gap, r.side); r._tp = r._L / r.speed; r._tr = 2 * r._leg / r.speed; r._cycle = 2 * (r._tp + r._tr) + r.rest[0] + r.rest[1];
  }
  let u = ((t % r._cycle) + r._cycle) % r._cycle, along, lat = 0, cs, phase, ru = 0, fx = 1, fl = 0, end = -1, s = 0; o.moving = true;
  const L = r._L, g = r.gap;
  if (u < r._tp) { phase = 0; cs = u * r.speed; along = cs - g; }
  else if ((u -= r._tp) < r.rest[1]) { phase = 1; cs = L; along = L - g; o.moving = false; ru = u / r.rest[1]; }
  else if ((u -= r.rest[1]) < r._tr) { phase = 2; cs = L; end = L; s = -1; }
  else if ((u -= r._tr) < r._tp) { phase = 3; cs = L - u * r.speed; along = cs + g; fx = -1; }
  else if ((u -= r._tp) < r.rest[0]) { phase = 4; cs = 0; along = g; fx = -1; o.moving = false; ru = u / r.rest[0]; }
  else { u -= r.rest[0]; phase = 5; cs = 0; end = 0; s = 1; }
  if (s) {                                                             // the walk round the end: out to the side, then in behind the other end
    const h = r._tr / 2; fx = -s * g;
    if (u < h) { const k = u / h; along = end + s * g * (1 - k); lat = r.side * k; fl = r.side; } else { const k = (u - h) / h; along = end - s * g * k; lat = r.side * (1 - k); fl = -r.side; }
  }
  const px = -r._uz, pz = r._ux;                                         // the side he walks round on
  o.x = r.a[0] + r._ux * along + px * lat; o.z = r.a[1] + r._uz * along + pz * lat;
  o.yaw = Math.atan2(r._ux * fx + px * fl, r._uz * fx + pz * fl);
  o.cs = cs; o.cx = r.a[0] + r._ux * cs; o.cz = r.a[1] + r._uz * cs; o.phase = phase; o.ru = ru;
  return o;
}

// ---- where everything stands (outpost-local metres: x east, z south) ----------------------------------------------------------
const TRACK_X = -37, TRACK_A = -84.4, TRACK_B = -101;          // the skip's rails: under the bin chute, and beside the bunker's middle bay
const BAYS = [-107, -101, -95];                                // the bunker's bays (z of each middle), drawn down south to north
const BAY_X = -42.2;
const TANKS = [56, 60, 64, 68], TANK_Z = 64;                   // Greenhaven's clean-water tanks
const BOARD = { x: -12, z: 34 };
const WALK_SPEED = 1.25;                                       // what beatPose walks at (port/portPeople.js)
const PUSH_SPEED = 0.8;
/** The people: `push` = a cart pusher (pushPose), `pts` = a walker's beat (beatPose). `full`: desktop tiers only. */
const HANDS = [
  { side: 'ironclad', id: 'skip-hand', push: { a: [TRACK_X, TRACK_A], b: [TRACK_X, TRACK_B], speed: PUSH_SPEED, gap: 1.5, side: 1.15, rest: [11, 9] }, cart: 'skip' },
  { side: 'ironclad', id: 'yard-hand', beat: { pts: [[-11.5, -85], [-30, -85], [-33.6, -92]], rest: [9, 12] } },
  { side: 'ironclad', id: 'stand-hand', beat: { pts: [[-34.5, -89.6], [-52, -88.6]], rest: [8, 10] } },
  { side: 'ironclad', id: 'bin-hand', full: true, beat: { pts: [[-40.5, -82.8], [-62, -83]], rest: [7, 9] } },
  { side: 'greenhaven', id: 'filter-hand', push: { a: [44.6, 51.6], b: [53.4, 62], speed: PUSH_SPEED, gap: 1.2, side: 0.95, rest: [10, 12] }, cart: 'trolley' },
  { side: 'greenhaven', id: 'valve-hand', beat: { pts: [[70.6, 61.4], [80.3, 62.3]], rest: [10, 9] } },
  { side: 'greenhaven', id: 'hose-hand', beat: { pts: [[60, 67.4], [57.4, 78.6]], rest: [9, 11] } },
  { side: 'greenhaven', id: 'tray-hand', full: true, beat: { pts: [[41, 59.6], [41, 74]], rest: [8, 8] } },
];

const rgb = (hex, k = 1) => [((hex >> 16) & 255) / 255 * k, ((hex >> 8) & 255) / 255 * k, (hex & 255) / 255 * k];

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

export class CeresActivity {
  /** o: { engine, world (the MoonWorld), space, outpost (what outpost.js built: its root and materials are used), tier } */
  constructor(o) {
    this.engine = o.engine; this.world = o.world; this.space = o.space; this.outpost = o.outpost; this.tier = o.tier; this.low = o.tier === 'low';
    this.body = o.world.body; this.pi = this.body.padInfo;
    this.root = new THREE.Group(); this.root.name = 'ceres-activity'; this.root.visible = false;
    o.outpost.root.add(this.root);                                       // the outpost's own frame: x east, y up, z south, origin the pad's middle
    this.shiftS = 0;                       // dev: moves the timetable's clock (seconds) without touching the sky's
    this.enabled = true; this.active = false; this.built = false; this.now = 0; this.night = 0; this.t = 0;
    this.ctx = { world: undefined };       // tests may hand in a shared world; otherwise the crew's own is read (see sharedWorld)
    this.ships = {};                       // side -> the exterior, built once and re-posed for every later visit
    this.cur = visitAt(0); this.cur.k = NaN;
    this.pose = {}; this._c = { x: 0, y: 0, z: 0 }; this._blockAt = -1; this._skipK = { ironclad: NaN, greenhaven: NaN };
    this.hands = []; this.handsBuilt = false; this._pp = {};
    this.ore = -1; this.water = -1; this._boardKey = ''; this._boardAt = 0;
    this.buildMs = { place: 0, ships: 0, count: 0 };
  }
  setContext(ctx) { Object.assign(this.ctx, ctx); return this; }
  time() { return worldTimeS() + this.shiftS; }
  /** The shared world, if this session has one (its snapshot carries `homes` and `roles`). */
  sharedWorld() { if (this.ctx.world !== undefined) return this.ctx.world; const c = this.space.ship && this.space.ship.crew; return (c && c.world) || null; }

  // ---- one frame ---------------------------------------------------------------------------------------------------------
  /** `focus`: the camera in Ceres's own coordinates (what MoonWorld.update hands a world's client). */
  update(dt, focus) {
    const pi = this.pi, c = this._c, dx = focus.x - pi.point.x, dy = focus.y - pi.point.y, dz = focus.z - pi.point.z;
    c.x = dx * pi.east.x + dy * pi.east.y + dz * pi.east.z; c.y = dx * pi.up.x + dy * pi.up.y + dz * pi.up.z; c.z = -(dx * pi.north.x + dy * pi.north.y + dz * pi.north.z);
    const camD = Math.hypot(c.x, c.y, c.z), on = this.enabled && camD < ACTIVE_M;
    this.active = on;
    if (!on) { if (this.root.visible) { this.root.visible = false; for (const id in this.ships) { this.ships[id].root.visible = false; this.ships[id].k = null; } } yardHush(this); return; }
    if (!this.built) this.build();
    this.root.visible = true; this.t += dt;
    const sp = this.space, now = this.now = this.time();
    if (sp.frameId === this.body.id) { const s = sp.sunLocal, up = pi.up, l = Math.hypot(s.x, s.y, s.z) || 1; this.night = clamp01((0.1 - (s.x * up.x + s.y * up.y + s.z * up.z) / l) / 0.2); }
    this.poolMesh.visible = this.night > 0.02; if (this.poolMesh.visible) this.poolMat.color.setScalar(this.night * 0.34);
    this.flyVisit(now);
    this.place(now);
    if (camD < PEOPLE_M) { if (!this.handsBuilt && sp.peopleLib) this.buildHands(); this.tickHands(dt, c); }
    else if (this.handsShown) { this.handsShown = false; for (const h of this.hands) { h.person.group.visible = false; if (h.cart) h.cart.root.visible = false; } }
    if (now < this._boardAt || now - this._boardAt > 1) { this._boardAt = now; this.syncBoard(); }
  }

  // ---- the ships -----------------------------------------------------------------------------------------------------------
  flyVisit(now) {
    const k = Math.floor(now / SLOT_S), v = this.cur;
    if (v.k !== k) visitAt(k, v);
    const other = this.ships[SIDES[(((k + 1) % 2) + 2) % 2]]; if (other && other.k !== null) { other.k = null; other.root.visible = false; }
    const s0 = this.ships[v.side], t = now - v.start;
    let alive = t >= 0 && !v.skip;
    if (alive) {
      const check = now < this._blockAt || now - this._blockAt > 0.5;
      if (!v.seen || (check && !v.diverted && t < v.t3)) {
        this._blockAt = now;
        if (this.spotBlocked(v.spot)) { if (t < v.t3) v.diverted = true; else if (!v.seen) v.skip = true; this._skipK[v.side] = k; }      // somebody is parked there: wave it off (or, joining late, leave it out)
        v.seen = true;
      }
      alive = !v.skip && t < (v.diverted ? v.t3 + v.P.departS : v.end);
    }
    if (!alive) { if (s0 && s0.k !== null) { s0.k = null; s0.root.visible = false; } yardHush(this); return; }
    const s = s0 || this.buildShip(v.side); if (!s) return;
    if (s.k !== k) { s.k = k; s.rampP = -1; s.len = -1; }
    const p = poseAt(v, t, this.pose);
    PortTraffic.prototype.poseShip.call(this, s, p, now);
    if (s.hose) s.hose.visible = p.phase === 4 && p.ground > RAMP_WAIT_S && t < v.t5 - BUTTON_UP_S;
    yardVoice(this, s, p, this._c);
  }
  soundStatus() { return yardSoundStatus(this); }
  /** Is a real ship standing on (or low over) this stand? The player's own, and in a shared world everybody's. */
  spotBlocked(S) {
    const pi = this.pi, sp = this.space, id = this.body.id;
    const near = (p) => { if (!p) return false; const x = p.x - pi.point.x, y = p.y - pi.point.y, z = p.z - pi.point.z;
      return Math.hypot(x * pi.east.x + y * pi.east.y + z * pi.east.z - S.x, -(x * pi.north.x + y * pi.north.y + z * pi.north.z) - S.z) < S.clearM && Math.abs(x * pi.up.x + y * pi.up.y + z * pi.up.z) < 150; };
    if (sp.frameId === id && sp.ship && sp.ship.flight && near(sp.ship.flight.pos)) return true;
    const w = this.sharedWorld(), ships = w && w.snapshot && w.snapshot.ships;
    if (ships) for (const sid in ships) { const s = ships[sid]; if (s && s.frameId === id && s.pose && near(s.pose.pos)) return true; }
    return false;
  }
  /** A side's ship: the type's own exterior (src/ships/<type>/), dressed in the faction's livery from its style sheet. Built once. */
  buildShip(side) {
    const t0 = performance.now(), S = SPOTS[side], P = FLY[side], type = S.type, def = shipDef(type), V = visualsFor(type), style = factionStyle(side);
    const mats = (this.space.ship && this.space.ship.matsExt) || null; if (!mats) return null;
    const mark = shipMark(side, P.n, P.name);
    const tex = V.decalTexture ? V.decalTexture(THREE, def, mark.name, mark.registry) : null;
    const decal = tex ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }) : null;
    const ext = V.buildExterior(def.layout, mats, { tier: this.tier, def, remote: true, decal });
    V.applyNeutralPose(ext);
    applyLiveryTint(THREE, ext.root, mats, side);                        // clones the four hull materials and recolours the clones: the player's ship is untouched
    const root = ext.root; root.name = 'ceres-activity:' + side + '-' + type; root.rotation.order = 'YXZ'; root.visible = false;
    if (this.low) root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const R = def.ramps.cargo, G = def.gear, rest = G.nominal + G.soleOffset;
    const s = { side, type, def, ext, root, k: null, rampP: -1, len: -1, G, R, mark,
      rampAngle: Math.min(0.72, Math.max(0.12, Math.asin(Math.min(0.9, Math.max(0.05, rest / R.length))))),
      rampYaw: Math.atan2(R.dir ? R.dir.x : 0, R.dir ? R.dir.z : 1), hold: null, strobe: null, hose: null };
    ext.ramps.cargo.hinge.rotation.order = 'YXZ';
    {   // with the ramp down the hold is open and this exterior has no rooms behind it: a dark box with the side's own cargo in it
      const door = def.layout.doors && def.layout.doors.find((d) => d.noZone && d.b === 'outside' && d.kind === 'portal');
      const w = door ? door.w : R.width, h = door ? door.h : (R.raisedHeight || 2.6), y0 = door ? door.y : 0, depth = Math.min(9, def.envelope ? def.envelope.depth * 0.3 : 6);
      const k = new Kit(), z1 = R.hinge.z - 0.05, z0 = z1 - depth, x0 = R.hinge.x - w / 2, x1 = R.hinge.x + w / 2, y1 = y0 + h, dark = [0.2, 0.2, 0.21];
      k.poly('plasticDark', [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], null, [0.5, 0.5, 0.5]);
      k.poly('plasticDark', [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], null, dark);
      k.poly('plasticDark', [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], null, dark);
      k.poly('plasticDark', [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], null, dark);
      k.poly('plasticDark', [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], null, dark);
      k.box(side === 'ironclad' ? 'glowAmber' : 'glowGreen', R.hinge.x, y1 - 0.04, z1 - depth * 0.4, w * 0.5, 0.03, 0.18);
      if (side === 'ironclad') { for (const sx of [-1, 1]) { k.box('steelDark', sx * w * 0.24, y0 + 0.55, z0 + 2.2, w * 0.36, 1.1, 3.2, { col: rgb(style.livery.hull, 0.9) }); k.dome('paint', sx * w * 0.24, y0 + 1.1, z0 + 2.2, w * 0.16, 8, 3, { thetaMax: HALF_PI, scaleY: 0.5, col: [0.5, 0.34, 0.26] }); } }
      else for (const sx of [-1, 1]) k.cyl('white', sx * w * 0.24, y0 + 0.7, z0 + 1.6, Math.min(0.55, w * 0.2), 1.4, 10, { col: rgb(style.palette.primary) });
      s.hold = k.toGroup(mats, { name: 'activity-hold' }); s.hold.visible = false; root.add(s.hold);
    }
    s.strobe = new THREE.Sprite(strobeMaterial()); s.strobe.position.set(0, P.strobeY, 2); s.strobe.scale.set(0.014, 0.014, 1); s.strobe.visible = false; root.add(s.strobe);
    for (const e of ext.engines) e.outer.visible = e.core.visible = false;
    for (const q of ext.liftPods) q.mesh.visible = q.core.visible = false;
    if (side === 'greenhaven') s.hose = this.hose;
    this.root.add(root); this.ships[side] = s;
    this.buildMs.ships += performance.now() - t0; this.buildMs.count++;
    return s;
  }

  // ---- the place: built once, the first time the camera comes near ----------------------------------------------------------
  build() {
    const t0 = performance.now(), low = this.low;
    // the outpost's own materials (one mesh per material there, one more per material here)
    const mats = {}, kit = this.outpost.root.getObjectByName('outpost-kit');
    if (kit) for (const m of kit.children) { const key = m.name.split(':')[1]; if (key && m.material) mats[key] = m.material; }
    if (!mats.concrete || !mats.metal || !mats.paint || !mats.glow) Object.assign(mats, makePortMaterials(this.tier, this.space.ship && this.space.ship.matsExt ? this.space.ship.matsExt : null).mats);
    this.mats = mats;
    const IC = factionStyle('ironclad'), GH = factionStyle('greenhaven');
    const k = new Kit(); k.defaultTile = 4; k.tiles = { paint: 8, metal: 1 };
    const B = (key, x, y, z, w, h, d, col, c = 0.04) => k.bevelBox(key, x, y, z, w, h, d, c, col ? { col } : {});
    const X = (key, x, y, z, w, h, d, col) => k.box(key, x, y, z, w, h, d, { col });
    const cyl = (key, x, y, z, r, h, seg, o) => k.cyl(key, x, y, z, r, h, low ? Math.min(seg, 10) : seg, o);
    const pipe = (key, a, b, r, seg = 8, o) => k.pipe(key, a, b, r, low ? 5 : seg, o);
    const pools = { pos: [], col: [] }, signs = [];
    /** Lamplight on the ground round (x, z): one additive mesh for the whole place, faded in after sunset. */
    const pool = (x, z, r, col, y = 0.06) => {
      const n = low ? 8 : 14, RING = [[0, 1], [0.25, 0.6], [0.55, 0.22], [1, 0]];
      for (let j = 0; j < RING.length - 1; j++) for (let i = 0; i < n; i++) {
        const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, [r0, k0] = RING[j], [r1, k1] = RING[j + 1];
        const Pt = (a, rr) => [x + Math.cos(a) * r * rr, y, z + Math.sin(a) * r * rr], C = (kk) => [col[0] * kk, col[1] * kk, col[2] * kk];
        if (j) { pools.pos.push(...Pt(a0, r0), ...Pt(a1, r0), ...Pt(a1, r1)); pools.col.push(...C(k0), ...C(k0), ...C(k1)); }
        pools.pos.push(...Pt(a0, r0), ...Pt(a1, r1), ...Pt(a0, r1)); pools.col.push(...C(k0), ...C(k1), ...C(k1));
      }
    };
    /** A work lamp on a post with a footing: an unlit lamp head and its light on the ground. */
    const lampPost = (x, z, h, glow, col, r = 8) => {
      B('concrete', x, 0.12, z, 0.5, 0.24, 0.5, null, 0.03); cyl('steelDark', x, h / 2, z, 0.06, h, 6, { r2: 0.045 });
      B('steelDark', x, h + 0.04, z, 0.8, 0.1, 0.32, null, 0.02); X(glow, x, h - 0.03, z, 0.68, 0.05, 0.22);
      pool(x, z, r, col);
    };
    /** A faction sign: a framed plate (and two posts unless `wall`), lettered from the style sheet into one shared texture. `face`: the way it looks ([x, z]). */
    const sign = (side, kind, text, x, y, z, w, h, face, o = {}) => {
      signs.push({ side, kind, text, x, y, z, w, h, face, emblem: o.emblem !== false });
      const rx = face[1], rz = -face[0];
      k.push(x - face[0] * 0.05, 0, z - face[1] * 0.05, Math.atan2(-rz, rx));
      B('steelDark', 0, y, 0, w + 0.12, h + 0.12, 0.06, null, 0.02);
      if (!o.wall) for (const s of [-1, 1]) { X('steelDark', s * w * 0.38, y / 2, -0.03, 0.09, y, 0.09); X('concrete', s * w * 0.38, 0.08, -0.03, 0.4, 0.16, 0.4); }
      if (o.lamp !== false) { X(side === 'ironclad' ? 'glowAmber' : 'glowWhite', 0, y + h / 2 + 0.11, 0.07, w * 0.7, 0.05, 0.1); X('steelDark', 0, y + h / 2 + 0.15, 0.03, w * 0.74, 0.04, 0.2); }
      k.pop();
    };
    const AMBER = [1.0, 0.66, 0.3], PALE = [0.86, 0.95, 0.8];
    const ORE = [0.66, 0.38, 0.26], OXIDE = rgb(IC.livery.hull), YEL = rgb(IC.palette.trim);
    const CREAM = rgb(GH.palette.primary), LEAF = rgb(GH.palette.accent), DEEP = rgb(GH.palette.trim), TIMBER = rgb(GH.palette.secondary), TERRA = rgb(GH.palette.extra[1]);

    // ======== IRONCLAD: the ore yard, west of the foundry ==========================================================================
    {
      // the bunker: a back wall and four push-walls making three bays, open to the rails
      X('concrete', BAY_X + 0.3, 0.03, -101, 7.4, 0.02, 18, [0.3, 0.23, 0.19]);
      B('concrete', -45.75, 1.3, -101, 0.5, 2.6, 18.9, [0.66, 0.64, 0.61], 0.05);
      for (const z of [-110.2, -104, -98, -91.8]) { B('concrete', -41.95, 1.2, z, 7.3, 2.4, 0.45, [0.66, 0.64, 0.61], 0.05); X('hazard', -38.29, 2.2, z, 0.03, 0.36, 0.47); }
      for (const z of BAYS) X('paint', -45.48, 2.05, z, 0.02, 0.5, 0.5, YEL);          // bay number plates on the back wall (painted squares; the sign texture carries the words)
      // the rails: sleepers, two rails, a buffer at each end
      for (let z = TRACK_A + 2.2; z > TRACK_B - 5.4; z -= 1.2) X('wood', TRACK_X, 0.04, z, 1.15, 0.08, 0.2, [0.5, 0.45, 0.42]);
      const zc = (TRACK_A + 2.5 + TRACK_B - 5.6) / 2, zl = (TRACK_A + 2.5) - (TRACK_B - 5.6);
      for (const s of [-1, 1]) X('steelDark', TRACK_X + s * 0.3, 0.12, zc, 0.06, 0.09, zl, [0.8, 0.74, 0.7]);
      for (const z of [TRACK_A + 2.6, TRACK_B - 5.7]) { B('hazard', TRACK_X, 0.42, z, 0.95, 0.5, 0.22, null, 0.03); for (const s of [-1, 1]) X('steelDark', TRACK_X + s * 0.3, 0.2, z, 0.1, 0.34, 0.3); }
      // the chute from bin three down to the skip, on its own legs
      pipe('steelDark', [TRACK_X, 5.7, -80.1], [TRACK_X, 2.75, -83.5], 0.42, 8, { col: [1.3, 0.8, 0.6] });
      B('steelDark', TRACK_X, 2.45, -83.95, 1.05, 0.7, 1.0, [1.2, 0.8, 0.6], 0.04);
      for (const s of [-1, 1]) { pipe('steelDark', [TRACK_X + s * 1.25, 0, -83.4], [TRACK_X + s * 1.25, 2.9, -83.4], 0.06, 6); X('concrete', TRACK_X + s * 1.25, 0.08, -83.4, 0.4, 0.16, 0.4); }
      X('steelDark', TRACK_X, 2.9, -83.4, 2.65, 0.1, 0.1); X('hazard', TRACK_X, 2.12, -84.46, 1.0, 0.1, 0.02);
      // spilt ore under the chute and at the tipping point; a shovel rack; two brine drums
      k.dome('concrete', TRACK_X + 0.9, 0, -84.9, 0.55, 8, 3, { thetaMax: HALF_PI, scaleY: 0.45, col: ORE });
      k.dome('concrete', -38.5, 0, -100.2, 0.7, 8, 3, { thetaMax: HALF_PI, scaleY: 0.4, col: ORE });
      for (const [x, z] of [[-34.4, -103.6], [-34.4, -104.4]]) { cyl('metal', x, 0.48, z, 0.3, 0.95, 10, { col: OXIDE }); cyl('steelDark', x, 0.3, z, 0.31, 0.05, 10); cyl('steelDark', x, 0.7, z, 0.31, 0.05, 10); }
      // work lamps along the rails and over the bays
      for (const z of [-87.5, -97, -106.5]) lampPost(-34.6, z, 4.6, 'glowAmber', AMBER, 9);
      for (const z of BAYS) { X('steelDark', -45.75, 2.95, z, 0.12, 0.7, 0.12); B('steelDark', -45.4, 3.3, z, 0.9, 0.1, 0.3, null, 0.02); X('glowAmber', -45.3, 3.23, z, 0.6, 0.05, 0.2); pool(-43.4, z, 4.5, AMBER); }
      // the hauler's stand: a sintered slab with painted edges, four low lamps, a marshal's line to the yard
      const S = SPOTS.ironclad;
      X('concrete', S.x, -0.1, S.z + 10, 18, 0.3, 40, [0.5, 0.47, 0.44]);
      for (const s of [-1, 1]) { X('hazard', S.x + s * 8.8, 0.06, S.z + 10, 0.3, 0.02, 40); X('hazard', S.x, 0.06, S.z + 10 + s * 19.85, 17.3, 0.02, 0.3); }
      X('hazard', S.x, 0.06, S.z, 8, 0.02, 0.25); X('hazard', S.x, 0.06, S.z, 0.25, 0.02, 8);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = S.x + sx * 9.6, z = S.z + 10 + sz * 20.6; cyl('steelDark', x, 0.3, z, 0.1, 0.6, 6); X('glowAmber', x, 0.66, z, 0.22, 0.12, 0.22); pool(x, z, 3, AMBER); }
      X('hazard', -51.5, 0.05, -88.6, 2.4, 0.02, 0.2);
      // signs, lettered the Ironclad way
      sign('ironclad', 'plate', 'Ore Yard · Pit 07 / Shift 2', -42, 3.0, -90.4, 4.4, 1.1, [0, 1]);
      sign('ironclad', 'banner', IC.signs.slogans[1], -15.5, 2.5, -87.66, 5.2, 1.3, [0, 1], { wall: true, lamp: false });
      sign('ironclad', 'warning', IC.signs.slogans[0], -33.2, 1.9, -86.2, 2.8, 0.7, [0, 1], { emblem: false, lamp: false });
      sign('ironclad', 'plate', 'Haulers · stand clear', -50.5, 2.3, -97.4, 3.2, 0.8, [0, 1]);
    }

    // ======== GREENHAVEN: the grow hall, the trays, the filters and the water, south-east of the pad ================================
    {
      // the grow hall: a pressure hull on saddles (air does not stay in a glass vault here), timber hoops, a lock on its north side
      const hx = 32, hz = 51, hy = 3.3, R = 3;
      for (const x of [26.5, 32, 37.5]) B('concrete', x, 0.55, hz, 1.0, 1.1, 5.0, [0.72, 0.72, 0.7], 0.06);
      cyl('paint', hx, hy, hz, R, 16, 20, { axis: 'x', col: CREAM });
      for (const x of [24.6, 28.3, 35.7, 39.4]) cyl('paint', x, hy, hz, R + 0.06, 0.28, 20, { axis: 'x', col: TIMBER, open: true });
      for (const s of [-1, 1]) { cyl('paint', hx + s * 8.2, hy, hz, 1.2, 0.4, 12, { axis: 'x', col: DEEP }); cyl('steelDark', hx + s * 8.45, hy, hz, 0.5, 0.1, 10, { axis: 'x' }); }
      // grow-light ports along both flanks and a strip of roof glazing: the purple-pink of the farm floors
      const PINK = [0.86, 0.4, 0.74];
      for (const s of [-1, 1]) for (const x of [26.4, 29.3, 34.7, 37.6]) { const z = hz + s * 2.9; B('steelDark', x, 4.05, z, 1.2, 0.8, 0.24, null, 0.04); X('glow', x, 4.05, z + s * 0.125, 0.95, 0.56, 0.02, PINK); pool(x, hz + s * 4.6, 2.6, [0.75, 0.3, 0.62]); }
      B('steelDark', hx, hy + R - 0.02, hz, 11, 0.12, 0.9, null, 0.03); X('glow', hx, hy + R + 0.045, hz, 10.4, 0.02, 0.6, PINK);
      // the lock toward the pad (Doctor Roth stands in front of it) and the one on the east end, where the filters go in and out
      B('paint', hx, 1.4, 47.85, 2.6, 2.8, 4.3, CREAM, 0.12); B('steelDark', hx, 1.2, 45.68, 1.25, 2.15, 0.08, null, 0.03); X('glow', hx, 1.65, 45.63, 0.42, 0.42, 0.02, [0.85, 1.0, 0.8]); X('glowGreen', hx, 2.5, 45.66, 0.5, 0.1, 0.05);
      B('paint', 41.2, 1.4, hz, 2.4, 2.8, 2.5, CREAM, 0.12); B('steelDark', 42.42, 1.2, hz, 0.08, 2.15, 1.25, null, 0.03); X('glow', 42.47, 1.65, hz, 0.02, 0.42, 0.42, [0.85, 1.0, 0.8]); X('glowGreen', 42.44, 2.5, hz, 0.05, 0.1, 0.5);
      pool(43.6, hz, 3.5, PALE);
      // the timber gate the lock's lamp hangs from (outpost.js lights it; this is what holds it up), and its name plate
      for (const x of [29.35, 34.65]) { B('paint', x, 1.6, 45, 0.2, 3.2, 0.2, TIMBER, 0.03); X('concrete', x, 0.08, 45, 0.45, 0.16, 0.45); }
      B('paint', hx, 3.2, 45, 5.7, 0.2, 0.24, TIMBER, 0.03);
      sign('greenhaven', 'plate', 'Greenhaven · Grow Hall One', hx, 3.95, 44.95, 4.4, 1.1, [0, -1], { wall: true, lamp: false });
      sign('greenhaven', 'banner', GH.signs.slogans[0], 37.2, 1.5, 46.4, 3.2, 0.8, [0, -1], { lamp: false, emblem: false });
      // a paved way (terracotta, the Greenhaven ground) from the east lock to the filters and the tanks
      k.push(49, 0, 56.8, Math.atan2(-(62 - 51.6), 53.4 - 44.6)); X('concrete', 0, 0.035, 0, 13.6, 0.03, 2.0, [TERRA[0] * 0.9, TERRA[1] * 0.9, TERRA[2] * 0.9]); k.pop();
      // the salt trays: brine spread thin, the water gone to vacuum in a breath, the salt left for the filters. One tray raked into rows.
      for (const [i, z] of [62, 70.6].entries()) {
        B('paint', 33, 0.14, z, 12, 0.28, 7, [0.3, 0.34, 0.31], 0.04); X('paint', 33, 0.285, z, 11.4, 0.02, 6.4, [0.2, 0.22, 0.21]);
        if (i === 0) X('paint', 33, 0.31, z, 11.2, 0.03, 6.2, [1.0, 1.0, 0.96]);
        else for (let x = 28.2; x < 38; x += 1.2) B('paint', x, 0.36, z, 0.55, 0.16, 5.8, [1.0, 1.0, 0.96], 0.05);
        pipe('white', [26.6, 0.4, z - 3], [26.6, 0.4, z + 3], 0.06, 6, { col: CREAM }); for (const dz of [-2.4, 0, 2.4]) pipe('white', [26.6, 0.4, z + dz], [27.2, 0.32, z + dz], 0.035, 5, { col: CREAM });
      }
      pipe('white', [26.6, 0.4, 59], [26.6, 0.4, 73.6], 0.06, 6, { col: CREAM });
      k.dome('paint', 40.6, 0, 66.3, 0.9, 10, 4, { thetaMax: HALF_PI, scaleY: 0.6, col: [1.0, 1.0, 0.96] });
      for (const [x, z, r] of [[41.6, 67.6, 0.2], [42.2, 67.3, -0.3], [41.9, 67.5, 0.1]]) { k.push(x, 0, z, r); B('paint', 0, 0.17 + (x === 41.9 ? 0.3 : 0), 0, 0.75, 0.3, 0.45, CREAM, 0.08); k.pop(); }
      // the filter skid: six canisters in a frame, a pump, a lit panel
      {
        const fx = 47.4, fz = 61.6;
        B('steelDark', fx, 0.1, fz, 3.6, 0.2, 1.7, null, 0.03);
        for (let i = 0; i < 6; i++) { const x = fx - 1.25 + (i % 3) * 0.85 - 0.2, z = fz - 0.38 + Math.floor(i / 3) * 0.76; cyl('white', x, 1.05, z, 0.3, 1.7, 10, { col: CREAM }); cyl('paint', x, 1.75, z, 0.31, 0.12, 10, { col: LEAF, open: true }); cyl('steelDark', x, 1.95, z, 0.08, 0.12, 6); }
        for (const z of [fz - 0.38, fz + 0.38]) pipe('white', [fx - 1.5, 2.02, z], [fx + 0.3, 2.02, z], 0.05, 5, { col: CREAM });
        B('paint', fx + 1.2, 0.6, fz, 0.8, 0.8, 1.0, DEEP, 0.05); cyl('steelDark', fx + 1.2, 1.15, fz, 0.22, 0.3, 8);
        B('plasticDark', fx + 1.2, 1.5, fz - 0.56, 0.6, 0.44, 0.08, null, 0.02); X('glowGreen', fx + 1.2, 1.5, fz - 0.605, 0.46, 0.3, 0.01, [0.7, 0.9, 0.7]);
        for (const sx of [-1.7, 1.7]) for (const sz of [-0.75, 0.75]) pipe('steelDark', [fx + sx, 0.2, fz + sz], [fx + sx, 2.3, fz + sz], 0.035, 5);
        for (const sz of [-0.75, 0.75]) pipe('steelDark', [fx - 1.7, 2.3, fz + sz], [fx + 1.7, 2.3, fz + sz], 0.035, 5);
        pipe('white', [fx + 1.6, 0.45, fz + 0.2], [54.6, 0.45, 65.9], 0.09, 6, { col: CREAM });
        lampPost(45.4, 58.2, 4.2, 'glowWhite', PALE, 8);
      }
      // the clean-water tanks: four, each with a sight gauge on the side the pad sees (the lit bar is place(): it follows the timetable)
      B('concrete', 62, 0.1, TANK_Z, 17, 0.2, 4.6, [0.72, 0.72, 0.7], 0.04);
      for (const x of TANKS) {
        cyl('paint', x, 2.6, TANK_Z, 1.5, 4.8, 16, { col: CREAM });
        k.dome('paint', x, 5.0, TANK_Z, 1.5, low ? 10 : 16, low ? 3 : 5, { thetaMax: HALF_PI, scaleY: 0.45, col: CREAM });
        cyl('paint', x, 0.95, TANK_Z, 1.53, 0.34, 16, { col: LEAF, open: true }); cyl('paint', x, 4.7, TANK_Z, 1.53, 0.2, 16, { col: TIMBER, open: true });
        B('steelDark', x, 2.7, TANK_Z - 1.52, 0.3, 3.5, 0.08, null, 0.02);
        for (const y of [1.0, 1.85, 2.7, 3.55, 4.4]) X('white', x + 0.21, y, TANK_Z - 1.53, 0.1, 0.03, 0.03);
        cyl('steelDark', x, 5.75, TANK_Z, 0.1, 0.18, 6); X('glowGreen', x, 5.9, TANK_Z, 0.2, 0.1, 0.2);
        pipe('white', [x, 0.45, TANK_Z + 1.5], [x, 0.45, TANK_Z + 1.9], 0.09, 6, { col: CREAM });
      }
      pipe('white', [54.6, 0.45, TANK_Z + 1.9], [69.6, 0.45, TANK_Z + 1.9], 0.11, 6, { col: CREAM });
      // the line from the Works' own melt tank (outpost.js: the WATER tank's blue stub ends at x 81), with a valve the valve hand reads
      pipe('white', [69.6, 0.45, TANK_Z + 1.9], [80.6, 0.45, 63.2], 0.09, 6, { col: CREAM }); pipe('white', [80.6, 0.45, 63.2], [81, 1.2, 60.6], 0.09, 6, { col: CREAM });
      B('paint', 80.6, 0.75, 63.2, 0.5, 0.6, 0.5, DEEP, 0.04); cyl('paint', 80.6, 1.15, 63.2, 0.26, 0.05, 10, { col: LEAF });
      // the name over the tanks, on a mast between the middle pair
      cyl('steelDark', 62, 3.6, TANK_Z, 0.07, 6.8, 6);
      sign('greenhaven', 'plate', 'Greenhaven Water · washed, tested, shared', 62, 6.9, TANK_Z - 0.1, 4.8, 1.2, [0, -1], { wall: true });
      lampPost(71.3, 60.4, 4.2, 'glowWhite', PALE, 8); for (const x of [58, 66]) pool(x, TANK_Z - 3.2, 4, [0.35, 0.8, 0.45]);
      // the tender's stand: a slab edged in leaf green, four low lamps, a hydrant and its reel
      const S = SPOTS.greenhaven;
      X('concrete', S.x, -0.1, S.z, 15, 0.3, 28, [0.56, 0.56, 0.53]);
      for (const s of [-1, 1]) { X('paint', S.x + s * 7.3, 0.06, S.z, 0.3, 0.02, 28, LEAF); X('paint', S.x, 0.06, S.z + s * 13.85, 14.3, 0.02, 0.3, LEAF); }
      cyl('paint', S.x, 0.055, S.z, 3.2, 0.02, 20, { col: LEAF }); cyl('concrete', S.x, 0.06, S.z, 2.9, 0.02, 20, { col: [0.56, 0.56, 0.53] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = S.x + sx * 8, z = S.z + sz * 14.6; cyl('steelDark', x, 0.3, z, 0.1, 0.6, 6); X('glowGreen', x, 0.66, z, 0.22, 0.12, 0.22); pool(x, z, 3, [0.3, 0.9, 0.45]); }
      pipe('white', [60, 0.45, TANK_Z + 1.9], [60, 0.3, 74], 0.09, 6, { col: CREAM }); pipe('white', [60, 0.3, 74], [58.2, 0.3, 79.4], 0.09, 6, { col: CREAM });
      B('paint', 58.2, 0.55, 79.8, 0.5, 1.1, 0.5, LEAF, 0.05); cyl('rubber', 58.2, 1.35, 79.8, 0.42, 0.3, 12, { axis: 'x' }); cyl('paint', 58.2, 1.35, 79.8, 0.16, 0.36, 8, { axis: 'x', col: DEEP });
      sign('greenhaven', 'plate', 'Tender · mind the hose', 55.6, 2.2, 77.2, 3.2, 0.8, [0, -1]);
      lampPost(56.2, 79.6, 4.2, 'glowWhite', PALE, 8);
    }

    // ======== BETWEEN THEM: the standing board by the pad ==============================================================================
    {
      const { x, z } = BOARD;
      for (const s of [-1, 1]) { B('steelDark', x + s * 1.55, 1.6, z + 0.1, 0.14, 3.2, 0.14, null, 0.03); X('concrete', x + s * 1.55, 0.1, z + 0.1, 0.5, 0.2, 0.5); }
      B('steelDark', x, 2.2, z + 0.06, 3.84, 2.04, 0.1, null, 0.03);
      B('steelDark', x, 3.33, z - 0.12, 3.0, 0.08, 0.36, null, 0.02); X('glowWhite', x, 3.28, z - 0.14, 2.6, 0.04, 0.22);
      pool(x, z - 2.2, 4.5, [0.9, 0.86, 0.72]);
    }

    const kitGroup = k.toGroup(mats, { name: 'activity-kit', cast: !low, receive: true });
    this.root.add(kitGroup);

    // ---- lamplight on the ground: one additive mesh ----
    this.poolMat = new THREE.MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pools.pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(pools.col, 3));
      this.poolMesh = new THREE.Mesh(geo, this.poolMat); this.poolMesh.name = 'activity-lamplight'; this.poolMesh.renderOrder = 3; this.poolMesh.visible = false; this.root.add(this.poolMesh); }

    // ---- the signs: one texture (two columns of four 4:1 plates), one mesh ----
    {
      const W = 1024, H = 512, cw = W / 2, ch = H / 4, c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'), pos = [], uv = [], idx = [];
      signs.forEach((s, i) => {
        const cx = (i % 2) * cw, cy = Math.floor(i / 2) * ch, st = factionStyle(s.side).signs[s.kind] || factionStyle(s.side).signs.plate;
        g.fillStyle = css(st.bg); g.fillRect(cx, cy, cw, ch);
        const pad = s.emblem ? ch * 0.86 : 0;
        drawSign(g, s.side, s.text, cx + 3 + pad, cy + 3, cw - 6 - pad, ch - 6, s.kind);
        if (s.emblem) drawEmblem(g, s.side, cx + ch * 0.46, cy + ch / 2, ch * 0.74, s.kind === 'banner' ? { fg: st.fg, bg: st.bg } : { bg: st.bg });
        const rx = s.face[1], rz = -s.face[0], b = pos.length / 3, u0 = (i % 2) / 2, v1 = 1 - Math.floor(i / 2) / 4;
        for (const [lx, ly] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(s.x + rx * lx * s.w / 2, s.y + ly * s.h / 2, s.z + rz * lx * s.w / 2); uv.push(u0 + (lx > 0 ? 0.5 : 0), v1 - (ly < 0 ? 0.25 : 0)); }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      });
      this.signTex = new THREE.CanvasTexture(c); this.signTex.colorSpace = THREE.SRGBColorSpace; this.signTex.anisotropy = 4;
      this.signMat = new THREE.MeshBasicMaterial({ map: this.signTex, toneMapped: false, fog: false });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      const m = new THREE.Mesh(geo, this.signMat); m.name = 'activity-signs'; this.root.add(m);
    }

    // ---- the ore in the bunker: one heap a bay, each empty, half or full ----
    this.heaps = BAYS.map((z, i) => {
      const hk = new Kit(); hk.defaultTile = 4;
      hk.dome('concrete', 0, 0, 0, 2.75, low ? 10 : 16, low ? 4 : 6, { thetaMax: HALF_PI, scaleY: 0.62, col: ORE });
      hk.dome('concrete', 1.5, 0, 0.9, 1.3, 8, 3, { thetaMax: HALF_PI, scaleY: 0.6, col: [ORE[0] * 0.9, ORE[1] * 0.9, ORE[2] * 0.9] });
      hk.dome('concrete', -0.8, 0, -1.5, 1.1, 8, 3, { thetaMax: HALF_PI, scaleY: 0.55, col: [ORE[0] * 1.08, ORE[1] * 1.05, ORE[2] * 1.02] });
      const g = hk.toGroup(mats, { name: 'activity-ore-' + (i + 1), cast: !low, receive: true }); g.position.set(BAY_X, 0.03, z); g.visible = false; this.root.add(g); return g;
    });

    // ---- the water gauges: four lit bars in one mesh (their tops move when the level does) ----
    {
      const pos = new Float32Array(TANKS.length * 12), idx = [];
      TANKS.forEach((x, i) => { const o = i * 12, z = TANK_Z - 1.59; pos.set([x + 0.09, 1.0, z, x - 0.09, 1.0, z, x - 0.09, 1.0, z, x + 0.09, 1.0, z], o); idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(62, 2.7, TANK_Z - 1.59), 8);
      this.gaugeMat = new THREE.MeshBasicMaterial({ color: GH.lights.signal, toneMapped: false, fog: false });
      this.gauge = new THREE.Mesh(geo, this.gaugeMat); this.gauge.name = 'activity-water-gauges'; this.root.add(this.gauge);
    }

    // ---- the tender's hose: lies coiled on its reel until she is down, then runs to her flank ----
    {
      const S = SPOTS.greenhaven, hk = new Kit();
      hk.pipe('rubber', [58.2, 1.2, 80.1], [58.9, 0.09, 82.4], 0.06, low ? 5 : 7); hk.pipe('rubber', [58.9, 0.09, 82.4], [59.9, 0.09, 85.6], 0.06, low ? 5 : 7); hk.pipe('rubber', [59.9, 0.09, 85.6], [S.x - 3.45, 2.1, 87.4], 0.06, low ? 5 : 7);
      hk.cyl('pipeSteel', S.x - 3.5, 2.1, 87.4, 0.11, 0.24, 8, { axis: 'x' });
      this.hose = hk.toGroup(mats, { name: 'activity-hose' }); this.hose.visible = false; this.root.add(this.hose);
    }

    // ---- the board: a canvas, redrawn only when what it says changes ----
    {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      this.boardCanvas = c; this.boardTex = new THREE.CanvasTexture(c); this.boardTex.colorSpace = THREE.SRGBColorSpace; this.boardTex.anisotropy = 4;
      this.boardMat = new THREE.MeshBasicMaterial({ map: this.boardTex, toneMapped: false, fog: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), this.boardMat); m.name = 'activity-standing-board'; m.position.set(BOARD.x, 2.2, BOARD.z); m.rotation.y = Math.PI; this.root.add(m);
      this.boardDraws = 0;
    }
    this.built = true; this.buildMs.place = performance.now() - t0;
  }

  /** The heaps and the gauges follow the timetable's clock. Meshes are touched only when a level changes. */
  place(now) {
    const ore = oreLevelAt(now, this._skipK.ironclad);
    if (ore !== this.ore) { this.ore = ore; for (let i = 0; i < 3; i++) { const n = Math.max(0, Math.min(2, ore - 2 * i)), g = this.heaps[i]; g.visible = n > 0; if (n === 1) g.scale.set(0.62, 0.55, 0.62); else g.scale.set(1, 1, 1); } }
    const water = waterLevelAt(now, this._skipK.greenhaven);
    if (Math.abs(water - this.water) > 0.004) {
      this.water = water; const a = this.gauge.geometry.attributes.position, p = a.array;
      for (let i = 0; i < TANKS.length; i++) { const y = 1.0 + 3.4 * clamp01(water - 0.05 * ((i * 2) % 3)); p[i * 12 + 7] = y; p[i * 12 + 10] = y; }
      a.needsUpdate = true;
    }
  }

  // ---- the people ----------------------------------------------------------------------------------------------------------
  buildHands() {
    this.handsBuilt = true;
    const lib = this.space.peopleLib, cached = new Set(lib.cachedFiles()), mats = this.mats, low = this.low;
    lib.roster().then((roster) => {
      const poolR = roster.filter((r) => cached.has(r.file)); if (!poolR.length) return;       // only bodies already downloaded: nothing is fetched for these
      const stripe = { ironclad: factionStyle('ironclad').palette.accent, greenhaven: factionStyle('greenhaven').palette.accent };
      let i = 0;
      for (const spec of HANDS) {
        if (spec.full && (low || lib.phone)) continue;
        const model = poolR[(i * 3 + (spec.side === 'ironclad' ? 0 : 1)) % poolR.length], person = lib.spawn(model.id, model.file);
        dressForWorld(person, this.body, { cloth: stripe[spec.side] }, false);
        person.group.visible = false; this.root.add(person.group);
        const h = { spec, person, offset: i * 41, anim: '', pose: {}, cart: null };
        if (spec.cart === 'skip') h.cart = this.buildSkip(mats, low); else if (spec.cart === 'trolley') h.cart = this.buildTrolley(mats, low, spec.push);
        this.hands.push(h); i++;
      }
    }).catch((e) => console.error('Ceres activity people failed', e));
  }
  /** The ore skip: a side-tipping tub on a four-wheel frame, on the yard's rails. */
  buildSkip(mats, low) {
    const root = new THREE.Group(); root.name = 'activity-skip'; root.visible = false; root.position.set(TRACK_X, 0.165, TRACK_A);
    const k = new Kit(); k.tiles = { paint: 8, metal: 1 };
    k.bevelBox('steelDark', 0, 0.32, 0, 0.9, 0.12, 1.9, 0.03); for (const sz of [-0.6, 0.6]) { k.cyl('steelDark', 0, 0.16, sz, 0.035, 0.74, 6, { axis: 'x' }); for (const sx of [-0.3, 0.3]) k.cyl('steel', sx, 0.16, sz, 0.16, 0.07, low ? 8 : 12, { axis: 'x' }); }
    for (const sz of [-0.78, 0.78]) { k.bevelBox('steelDark', 0, 0.75, sz, 0.12, 0.8, 0.1, 0.02); k.bevelBox('hazard', 0, 0.42, sz * 1.24, 0.5, 0.14, 0.08, 0.02); }
    root.add(k.toGroup(mats, { name: 'skip-frame', cast: !low }));
    const tub = new THREE.Group(); tub.position.set(0, 1.05, 0);         // the trunnion line: the tub turns about the rails' own direction
    const tk = new Kit(); tk.tiles = { paint: 8, metal: 1 };
    const col = rgb(factionStyle('ironclad').livery.hull), dk = [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55], y0 = -0.55, y1 = 0.25, zb = 0.7;       // a V tub: narrow floor, flared lip
    for (const s of [-1, 1]) {
      tk._faceQuad('metal', [[s * 0.22, y0, -zb], [s * 0.22, y0, zb], [s * 0.62, y1, zb], [s * 0.62, y1, -zb]], [s, -0.5, 0], col);
      tk._faceQuad('metal', [[s * 0.2, y0 + 0.02, -zb], [s * 0.2, y0 + 0.02, zb], [s * 0.6, y1, zb], [s * 0.6, y1, -zb]], [-s, 0.5, 0], dk);
      tk._faceQuad('metal', [[-0.22, y0, s * zb], [0.22, y0, s * zb], [0.62, y1, s * zb], [-0.62, y1, s * zb]], [0, 0, s], col);
      tk._faceQuad('metal', [[-0.22, y0, s * (zb - 0.02)], [0.22, y0, s * (zb - 0.02)], [0.62, y1, s * (zb - 0.02)], [-0.62, y1, s * (zb - 0.02)]], [0, 0, -s], dk);
      tk.box('hazard', 0, y1, s * (zb + 0.012), 1.24, 0.07, 0.03);
    }
    tk.box('metal', 0, y0, 0, 0.44, 0.03, 1.4, { col: dk });
    tub.add(tk.toGroup(mats, { name: 'skip-tub', cast: !low }));
    const lk = new Kit(); lk.dome('concrete', 0, 1.18 - 1.05, 0, 0.6, 8, 3, { thetaMax: HALF_PI, scaleY: 0.55, col: [0.5, 0.34, 0.26] });
    const load = lk.toGroup(mats, { name: 'skip-load' }); load.scale.set(1, 1, 1.12); tub.add(load);
    root.add(tub); this.root.add(root);
    return { kind: 'skip', root, tub, load };
  }
  /** The filter trolley: a hand cart with a rack of filter cartridges, pushed between the grow hall's lock and the skid. */
  buildTrolley(mats, low, r) {
    const root = new THREE.Group(); root.name = 'activity-filter-trolley'; root.visible = false; root.rotation.y = Math.atan2(r.b[0] - r.a[0], r.b[1] - r.a[1]);
    const GH = factionStyle('greenhaven'), k = new Kit(); k.tiles = { paint: 8, metal: 1 };
    k.bevelBox('paint', 0, 0.42, 0, 0.8, 0.08, 1.3, 0.02, { col: rgb(GH.palette.secondary) });
    for (const sx of [-0.36, 0.36]) for (const sz of [-0.45, 0.45]) k.cyl('rubber', sx, 0.19, sz, 0.19, 0.08, low ? 8 : 12, { axis: 'x' });
    for (let i = 0; i < 6; i++) { const x = -0.2 + (i % 2) * 0.4, z = -0.4 + Math.floor(i / 2) * 0.4; k.cyl('white', x, 0.9, z, 0.15, 0.85, 8, { col: rgb(GH.palette.primary) }); k.cyl('paint', x, 1.28, z, 0.155, 0.08, 8, { col: rgb(GH.palette.accent), open: true }); }
    for (const sx of [-0.38, 0.38]) for (const sz of [-0.62, 0.62]) k.pipe('steelDark', [sx, 0.46, sz], [sx, 1.1, sz], 0.02, 4);
    for (const sz of [-0.62, 0.62]) k.pipe('steelDark', [-0.38, 1.1, sz], [0.38, 1.1, sz], 0.02, 4);
    for (const sx of [-0.38, 0.38]) k.pipe('steelDark', [sx, 1.1, -0.62], [sx, 1.1, 0.62], 0.02, 4);
    root.add(k.toGroup(mats, { name: 'trolley', cast: !low })); this.root.add(root);
    return { kind: 'trolley', root };
  }
  /** `c`: the camera in outpost metres. A hidden hand costs nothing and comes back in the right place (the beats are pure functions of the clock). */
  tickHands(dt, c) {
    const range = this.low ? 95 : 180, now = this.now; this.handsShown = true;
    for (const h of this.hands) {
      const s = h.spec, g = h.person.group, t = now + h.offset, q = s.push ? pushPose(s.push, t, h.pose) : beatPose(s.beat, t, h.pose);
      const near = Math.hypot(c.x - q.x, c.y, c.z - q.z) < range;
      g.visible = near; if (h.cart) h.cart.root.visible = near;
      if (!near) continue;
      g.position.set(q.x, 0.02, q.z);
      let d = q.yaw - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, dt * 5);
      const anim = q.moving ? 'Walk' : 'Idle'; if (anim !== h.anim) { h.anim = anim; h.person.play(anim, 0.3); }
      h.person.update(dt, q.moving ? (s.push ? PUSH_SPEED : WALK_SPEED) : 0);
      const cart = h.cart; if (!cart) continue;
      if (cart.kind === 'skip') {
        cart.root.position.z = q.cz;
        // out to the bunker loaded, tipped west into the bay there, back empty, filled again under the chute
        let tip = 0, load = 0;
        if (q.phase === 0 || q.phase === 5) load = 1; else if (q.phase === 1) { tip = sm(q.ru / 0.3) * (1 - sm((q.ru - 0.72) / 0.28)); load = 1 - sm((q.ru - 0.12) / 0.2); } else if (q.phase === 4) load = sm((q.ru - 0.15) / 0.7);
        cart.tub.rotation.z = tip * 0.8; cart.load.visible = load > 0.02; if (cart.load.visible) cart.load.scale.set(0.5 + 0.5 * load, load, 1.12);
      } else cart.root.position.set(q.cx, 0.02, q.cz);
    }
  }

  // ---- the board ------------------------------------------------------------------------------------------------------------
  /** What the board should say now: the two sides' leaders and stance, the world's balance and home strength. null without a shared world. */
  report() {
    const w = this.sharedWorld(), s = w && w.snapshot, h = s && s.homes && s.homes[this.body.id];
    if (!h || !Number.isFinite(h.balance)) return null;
    const out = { balance: Math.round(h.balance), strength: Math.round(strengthOf(h)), words: describeHome(h), sides: {} };
    try { if (s.roles) for (const l of leadersOf(s.roles, this.body.id)) out.sides[l.faction] = { leader: l.holder.kind === 'human' ? l.holder.name : (l.holder.npc && l.holder.npc.name) || '', stance: Math.round(l.stance * 10) / 10 }; } catch (e) { /* a record this build cannot read: the board still shows the two meters */ }
    return out;
  }
  syncBoard() {
    const r = this.report();
    const key = r ? [r.balance, r.strength, ...SIDES.map((f) => (r.sides[f] ? r.sides[f].leader + '/' + r.sides[f].stance : '-'))].join('|') : 'none';
    if (key === this._boardKey) return;
    this._boardKey = key; this.drawBoard(r); this.boardTex.needsUpdate = true; this.boardDraws++;
  }
  drawBoard(r) {
    const c = this.boardCanvas, g = c.getContext('2d'), W = c.width, H = c.height, IC = factionStyle('ironclad'), GH = factionStyle('greenhaven');
    g.fillStyle = '#14110f'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = '#e9e2d2'; g.font = '700 40px "Arial Narrow", Arial, sans-serif'; g.fillText('OCCATOR WORKS · THE TWO SIDES', W / 2, 38, W - 60);
    const stanceWord = (v) => (v === undefined ? '' : v > 0.15 ? 'leans to work together' : v < -0.15 ? 'leans to go it alone' : 'has not said which way');
    const panel = (st, x, role) => {
      const s = st.signs, pw = W / 2 - 30, ph = 270, y = 70, e = s.emblem, lower = s.upper === false, d = r && r.sides[st.id];
      g.fillStyle = css(e.bg); g.fillRect(x, y, pw, ph);
      g.strokeStyle = css(e.fg); g.lineWidth = 6; g.strokeRect(x + 3, y + 3, pw - 6, ph - 6);
      drawEmblem(g, st.id, x + pw / 2, y + 74, 116);
      g.fillStyle = css(lower ? st.palette.trim : e.fg); g.font = `${s.weight} 60px ${s.fontStack}`; g.fillText(lower ? st.name.toLowerCase() : st.name.toUpperCase(), x + pw / 2, y + 166, pw - 40);
      g.fillStyle = css(lower ? st.palette.dark : st.palette.light); g.font = `600 28px ${s.fontStack}`; g.fillText(role, x + pw / 2, y + 208, pw - 40);
      g.fillText(!r ? 'no report' : d ? `${d.leader ? d.leader + ' ' : ''}${stanceWord(d.stance)}` : 'no word from its leader', x + pw / 2, y + 242, pw - 36);
    };
    panel(IC, 20, 'the pit · the foundry · hulls'); panel(GH, W / 2 + 10, 'water · filters · growing');
    g.fillStyle = '#211c19'; g.fillRect(20, 352, W - 40, 146); g.strokeStyle = '#8c8f93'; g.lineWidth = 3; g.strokeRect(21.5, 353.5, W - 43, 143);
    if (r) {
      g.fillStyle = '#ffd9a0'; g.font = '700 34px "Arial Narrow", Arial, sans-serif'; g.fillText(`BETWEEN THE TWO: ${r.balance} OF 100`, W / 2, 380, W - 70);
      g.fillStyle = '#e9e2d2'; g.font = '600 27px "Arial Narrow", Arial, sans-serif'; g.fillText(r.words.balance, W / 2, 418, W - 70);
      g.fillStyle = '#d7e8c8'; g.font = '600 29px "Arial Narrow", Arial, sans-serif'; g.fillText(`THE HOME: ${r.strength} OF 100 · ${r.words.strength}`, W / 2, 466, W - 70);
    } else {
      g.fillStyle = '#ffd9a0'; g.font = '700 40px "Arial Narrow", Arial, sans-serif'; g.fillText('NO REPORT', W / 2, 398, W - 70);
      g.fillStyle = '#b9b2a4'; g.font = '600 26px "Arial Narrow", Arial, sans-serif'; g.fillText('Neither the union hall nor the domes has posted a standing today.', W / 2, 452, W - 70);
    }
  }

  // ---- for tests and review shots (cosmos.space.worlds.get('ceres').client.activity) ------------------------------------------
  status() {
    const now = this.time(), k = Math.floor(now / SLOT_S), v = this.cur.k === k ? this.cur : visitAt(k, {}), t = now - v.start, ships = [];
    for (const id in this.ships) { const s = this.ships[id]; if (s.k === null) continue; const p = poseAt(v, t, {});
      ships.push({ k: v.k, side: id, type: s.type, registry: s.mark.registry, name: s.mark.name, spot: v.spot.id, phase: PHASES[p.phase], diverted: v.diverted, t: +t.toFixed(2), x: p.x, y: s.root.position.y, z: p.z, alt: p.alt, yaw: p.yaw, pitch: p.pitch, gear: p.gear, ramp: p.ramp, lift: p.lift, main: p.main, hose: !!(s.hose && s.hose.visible) }); }
    return { time: now, active: this.active, built: this.built, phone: this.low, night: this.night, ships, shipsBuilt: Object.keys(this.ships).length, ore: this.ore, water: this.water,
      hands: this.hands.map((h) => ({ id: h.spec.id, side: h.spec.side, x: +h.person.group.position.x.toFixed(2), z: +h.person.group.position.z.toFixed(2), shown: h.person.group.visible, anim: h.anim, phase: h.pose.phase })),
      board: { key: this._boardKey, draws: this.boardDraws || 0 }, buildMs: { ...this.buildMs } };
  }
  /** The next `count` visits (who, when it lands and leaves), from now. */
  timetable(count = 4) {
    const now = this.time(), out = [];
    for (let k = Math.floor(now / SLOT_S); out.length < count; k++) { const v = visitAt(k, {}); if (v.start + v.end < now) continue;
      out.push({ k, side: v.side, type: v.type, inS: Math.round(v.start - now), landsInS: Math.round(v.start + v.t4 - now), liftsInS: Math.round(v.start + v.t5 - now), goneInS: Math.round(v.start + v.end - now) }); }
    return out;
  }
  /** Move the timetable's clock so `side`'s ship is in `phase`, `into` (0..1) of the way through it. */
  jumpTo(side, phase, into) {
    const now = this.time(), v = {}, i = PHASES.indexOf(phase); if (i < 0) throw new Error('phase is one of ' + PHASES.join(', '));
    let k = Math.floor(now / SLOT_S) + 1; if (SIDES[((k % 2) + 2) % 2] !== side) k++;
    visitAt(k, v); const edge = [0, v.t1, v.t2, v.t3, v.t4, v.t5, v.t6, v.t7];
    this.shiftS += v.start + edge[i] + (edge[i + 1] - edge[i]) * (into ?? (phase === 'landed' ? 0.3 : 0.6)) - now;
    return { k, side: v.side, shiftS: this.shiftS };
  }
  shift(seconds) { this.shiftS += seconds; return this.shiftS; }

  dispose() {
    yardHush(this);
    this.root.removeFromParent();
    for (const m of [this.poolMat, this.signMat, this.signTex, this.gaugeMat, this.boardMat, this.boardTex]) if (m) m.dispose();
  }
}
