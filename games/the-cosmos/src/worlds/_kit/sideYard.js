// ============================================================================
// worlds/_kit/sideYard.js - A SIDE SEEN AT WORK: the machinery every faction yard shares, so a world only has to say what its sides do.
//
// Occator Works got the first one by hand (worlds/ceres/activity.js: Ironclad's ore yard, Greenhaven's tanks). This is the same idea made
// reusable for every other home: each side gets a place of its own, people of its own, a ship of its own that lands and leaves on a
// timetable, a stock that visibly moves with the ship, and a lit board that says how the home stands. A world writes a small config
// (where the stand is, how the ship flies in that world's gravity, the props, the beats the hands walk) and this file does the rest.
//
// OWNS: decoration only. Nothing here collides, can be boarded or talked to, is saved, or is known to the server.
// DOES NOT OWN: any ship exterior (src/ships/<type>/, used as built, tinted by the faction style sheet), the people (the Loft rigs every
//   world uses), the clock, the settlement it stands in (its root is the parent; its materials are borrowed when it has them).
//
// THE TIMETABLE IS A PURE FUNCTION OF THE WORLD CLOCK (space/clock.js `worldTimeS`), so every player at the place sees the same ship touch
// down at the same moment and the same stack in the yard:
//   - Slot k (cfg.slotS long) holds ONE visit; with n sides, side i flies slots k = i (mod n). No visit outlasts cfg.visitMaxS, so one
//     ship is alive at a time on every tier.
//   - A ship's pose is `poseAt(visit, t)`. The braking tilt is atan(a / g) for the world's own gravity (cfg.g).
//   - A side's stock is a function of the same clock: mode 'take' = the ship's stay carries the stack away and the home rebuilds it;
//     mode 'bring' = the ship's stay fills it and the home uses it up. In a shared world a strong home stacks higher than a weak one.
// If a player's ship stands on a stand the visit is waved off at hover height, as at Marineris.
//
// COST: one merged mesh per material, one sign texture, one board texture (redrawn only when its numbers change), one additive mesh for
// lamplight (no THREE lights), a few people a side (fewer on a phone), one ship exterior per side built the first time it is due.
// Nothing is built or ticked while the camera is more than cfg.activeM from the pad, and the per-frame path allocates nothing.
// ============================================================================
import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { makePortMaterials } from '../../port/portArt.js';
import { shipDef } from '../../ships/registry.js';
import { visualsFor } from '../../ships/visuals.js';
import { worldTimeS } from '../../space/clock.js';
import { PortTraffic } from '../../port/traffic.js';            // its poseShip (gear, ramp, engine glow) is used as written
import { beatPose } from '../../port/portPeople.js';            // the walkers' beat: a pure function of time
import { factionStyle, shipMark, applyLiveryTint, css } from '../../factions/registry.js';
import { drawEmblem } from '../../factions/emblems.js';
import { SignAtlas } from '../moon/kit.js';
import { dressForWorld } from '../../crew/suitPolicy.js';
import { describe as describeHome, strengthOf } from '../../roles/balance.js';
import { leadersOf } from '../../roles/holders.js';
import { TrafficFx, MEDIA } from '../../port/trafficFx.js';       // the yard ships' sound: the port's own voices, told what the sound travels through
import { makeTimetable, PHASES } from './yardClock.js';       // the timetable itself is pure and lives apart, so the server can read it too

const DEG = Math.PI / 180, HALF_PI = Math.PI / 2;
export { makeTimetable, PHASES };
const WALK_SPEED = 1.25, PUSH_SPEED = 0.8;

const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const sm5 = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const rgb = (hex, k = 1) => [((hex >> 16) & 255) / 255 * k, ((hex >> 8) & 255) / 255 * k, (hex & 255) / 255 * k];


/** A hand pushing a cart to and fro on the line a -> b: push out, stop, walk round to the other end, push back, stop, walk round. Pure.
 *  r: { a: [x, z], b: [x, z], speed, gap, side, rest: [at a, at b] }. Writes the hand (x, z, yaw, moving) and the cart (cx, cz, phase, ru) into `o`. */
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
  if (s) {
    const h = r._tr / 2; fx = -s * g;
    if (u < h) { const k = u / h; along = end + s * g * (1 - k); lat = r.side * k; fl = r.side; } else { const k = (u - h) / h; along = end - s * g * k; lat = r.side * (1 - k); fl = -r.side; }
  }
  const px = -r._uz, pz = r._ux;
  o.x = r.a[0] + r._ux * along + px * lat; o.z = r.a[1] + r._uz * along + pz * lat;
  o.yaw = Math.atan2(r._ux * fx + px * fl, r._uz * fx + pz * fl);
  o.cs = cs; o.cx = r.a[0] + r._ux * cs; o.cz = r.a[1] + r._uz * cs; o.phase = phase; o.ru = ru;
  return o;
}

/** One set of voices for every yard on the page (a phone has few to spare). The yard whose ship is flying owns it; the rota keeps that to one. */
let _fx = null;
function yardFx(yard) {
  if (!_fx) { const space = yard.space; _fx = new TrafficFx({ low: yard.low, ctx: { get ship() { return space.ship; } }, pool: [], root: yard.root, port: { night: 0 }, engine: yard.engine }); _fx.owner = null; }
  return _fx;
}
/** One yard ship's sound this frame. `yard`: whoever flies her (needs low, space, root, engine); `c`: the listener in the frame the pose is in;
 *  `medium`: one of trafficFx's MEDIA. Also used by Occator Works (worlds/ceres/activity.js), which flies its ships by hand. */
export function yardVoice(yard, s, p, c, oy = 0, medium = MEDIA.ground) { const fx = yardFx(yard); fx.owner = yard; fx.beginAt(c.x, c.y - oy, c.z); fx.voice(s, p, medium); fx.end(); }
/** No ship of this yard is flying: if the voices were this yard's, they fall silent. */
export function yardHush(yard) { if (_fx && _fx.owner === yard) { _fx.owner = null; _fx.beginAt(0, 0, 0); _fx.end(); _fx.quiet(); } }
export function yardSoundStatus(yard) { return _fx ? { owner: _fx.owner === yard, ..._fx.status() } : null; }

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

/**
 * One place's yards. o: { engine, world (the MoonWorld), space, parent (the settlement's root group: x east, y up, z south, origin the pad's
 * middle), tier, cfg }.
 * cfg adds to the timetable's: { name, homeId (whose balance the board shows; default the body), activeM = 6000, peopleM = 320,
 *   sides[i]: { ..., stock?: { max, mode, low?, build(i, h) }, hold?(h, box), hose? },
 *   hands: [{ side, id, beat | push, cart?(h) -> THREE.Group, full? }],
 *   build(h): draw the props. h = { k, B, X, cyl, pipe, dome, pool, lampPost, sign, slab, groundY, low, style(side), rgb },
 *   board?: { x, z, yaw, title, sides: [ids], roles: { id: words }, none },
 *   origin?: { x, y, z } (outpost metres: every other number in the config is measured from here; y lifts the yard onto a deck) }
 */
export class SideYard {
  constructor(o) {
    this.engine = o.engine; this.world = o.world; this.space = o.space; this.tier = o.tier; this.low = o.tier === 'low'; this.cfg = o.cfg;
    this.body = o.world.body; this.pi = o.pi || this.body.padInfo; this.tt = makeTimetable(o.cfg);        // o.pi: a yard that stands at one of the world's other ports
    this.medium = MEDIA[o.cfg.medium] || MEDIA.ground;
    this.root = new THREE.Group(); this.root.name = 'side-yard:' + o.cfg.name; this.root.visible = false;
    this.ox = (o.cfg.origin && o.cfg.origin.x) || 0; this.oz = (o.cfg.origin && o.cfg.origin.z) || 0; this.oy = (o.cfg.origin && o.cfg.origin.y) || 0;       // cfg.origin moves the whole yard: every number in the config is measured from it
    this.root.position.set(this.ox, this.oy, this.oz);
    o.parent.add(this.root); this.parent = o.parent;
    this.clock = o.clock || { shiftS: 0 };   // dev: moves the timetable's clock (seconds) without touching the sky's. Two yards on one rota are given the same one.
    this.enabled = true; this.active = false; this.built = false; this.now = 0; this.night = 0; this.t = 0;
    this.ctx = { world: undefined };
    this.ships = {};                       // side -> the exterior, built once and re-posed for every later visit
    this.cur = this.tt.visitAt(0); this.cur.k = NaN;
    this.pose = {}; this._c = { x: 0, y: 0, z: 0 }; this._blockAt = -1; this._skipK = o.cfg.sides.map(() => NaN);
    this.hands = []; this.handsBuilt = false; this.handsShown = false;
    this.stocks = o.cfg.sides.map(() => null); this._boardKey = ''; this._boardAt = 0; this.boardDraws = 0; this._strength = 1;
    this.buildMs = { place: 0, ships: 0, count: 0 };
    this.activeM = o.cfg.activeM || 6000; this.peopleM = o.cfg.peopleM || 320;
  }
  get shiftS() { return this.clock.shiftS; }
  set shiftS(v) { this.clock.shiftS = v; }
  setContext(ctx) { Object.assign(this.ctx, ctx); return this; }
  time() { return worldTimeS() + this.shiftS; }
  sharedWorld() { if (this.ctx.world !== undefined) return this.ctx.world; const c = this.space.ship && this.space.ship.crew; return (c && c.world) || null; }
  /** Height of the real ground above the pad's plane at an outpost-local point. */
  groundY(x, z) {
    const pi = this.pi, b = this.body; x += this.ox; z += this.oz;
    const px = pi.point.x + pi.east.x * x - pi.north.x * z, py = pi.point.y + pi.east.y * x - pi.north.y * z, pz = pi.point.z + pi.east.z * x - pi.north.z * z;
    const l = Math.hypot(px, py, pz), R = b.surfaceRadius(px / l, py / l, pz / l);
    return (px / l * R - pi.point.x) * pi.up.x + (py / l * R - pi.point.y) * pi.up.y + (pz / l * R - pi.point.z) * pi.up.z - this.oy;
  }

  // ---- one frame ---------------------------------------------------------------------------------------------------------
  /** `focus`: the camera (or the walker) in the body's own coordinates. */
  update(dt, focus) {
    const pi = this.pi, c = this._c, dx = focus.x - pi.point.x, dy = focus.y - pi.point.y, dz = focus.z - pi.point.z;
    c.x = dx * pi.east.x + dy * pi.east.y + dz * pi.east.z; c.y = dx * pi.up.x + dy * pi.up.y + dz * pi.up.z; c.z = -(dx * pi.north.x + dy * pi.north.y + dz * pi.north.z);
    c.x -= this.ox; c.z -= this.oz;
    const camD = Math.hypot(c.x, c.y, c.z), on = this.enabled && camD < this.activeM;
    this.active = on;
    if (!on) { if (this.root.visible) { this.root.visible = false; for (const id in this.ships) { this.ships[id].root.visible = false; this.ships[id].k = null; } } this.hush(); return; }
    if (!this.built) this.build();
    this.root.visible = true; this.t += dt;
    const sp = this.space, now = this.now = this.time();
    if (sp.frameId === this.body.id && sp.sunLocal) { const s = sp.sunLocal, up = pi.up, l = Math.hypot(s.x, s.y, s.z) || 1; this.night = clamp01((0.1 - (s.x * up.x + s.y * up.y + s.z * up.z) / l) / 0.2); }
    this.poolMesh.visible = this.night > 0.02; if (this.poolMesh.visible) this.poolMat.color.setScalar(this.night * 0.34);
    this.flyVisit(now);
    this.place(now);
    if (camD < this.peopleM) { if (!this.handsBuilt && sp.peopleLib) this.buildHands(); this.tickHands(dt, c); }
    else if (this.handsShown) { this.handsShown = false; for (const h of this.hands) { h.person.group.visible = false; if (h.cart) h.cart.visible = false; } }
    if (this.boardTex && (now < this._boardAt || now - this._boardAt > 1)) { this._boardAt = now; this.syncBoard(); }
  }

  // ---- the ships -----------------------------------------------------------------------------------------------------------
  flyVisit(now) {
    const tt = this.tt, k = Math.floor(now / tt.SLOT), v = this.cur;
    if (v.k !== k) tt.visitAt(k, v);
    for (const id in this.ships) { const s = this.ships[id]; if (id !== v.side && s.k !== null) { s.k = null; s.root.visible = false; } }
    const s0 = this.ships[v.side], t = now - v.start;
    let alive = t >= 0 && !v.skip;
    if (alive) {
      const check = now < this._blockAt || now - this._blockAt > 0.5;
      if (!v.seen || (check && !v.diverted && t < v.t3)) {
        this._blockAt = now;
        if (this.spotBlocked(v.spot)) { if (t < v.t3) v.diverted = true; else if (!v.seen) v.skip = true; this._skipK[v.i] = k; }
        v.seen = true;
      }
      alive = !v.skip && t < (v.diverted ? v.t3 + v.P.departS : v.end);
    }
    if (!alive) { if (s0 && s0.k !== null) { s0.k = null; s0.root.visible = false; } this.hush(); return; }
    const s = s0 || this.buildShip(v.i); if (!s) return;
    if (s.k !== k) { s.k = k; s.rampP = -1; s.len = -1; }
    const p = tt.poseAt(v, t, this.pose);
    PortTraffic.prototype.poseShip.call(this, s, p, now);
    if (s.strobe) { s.strobe.visible = p.phase !== 4 || p.ramp < 0.01 ? (now * 1.1) % 1 < 0.08 : false; }
    // her sound (port/trafficFx.js): a pure function of the pose and of where the listener is, through this world's air or, with no air, its ground
    yardVoice(this, s, p, this._c, this.oy, this.medium);
  }
  /** No ship of this yard is flying: if the voices were this yard's, they fall silent. */
  hush() { yardHush(this); }
  /** What the sound is doing (for tests): the gains asked for, and whether this yard owns the voices. */
  soundStatus() { return yardSoundStatus(this); }
  /** Is a real ship standing on (or low over) this stand? The player's own, and in a shared world everybody's. */
  spotBlocked(S) {
    const pi = this.pi, sp = this.space, id = this.body.id, sx = S.x + this.ox, sz = S.z + this.oz;
    const near = (p) => { if (!p) return false; const x = p.x - pi.point.x, y = p.y - pi.point.y, z = p.z - pi.point.z;
      return Math.hypot(x * pi.east.x + y * pi.east.y + z * pi.east.z - sx, -(x * pi.north.x + y * pi.north.y + z * pi.north.z) - sz) < S.clearM && Math.abs(x * pi.up.x + y * pi.up.y + z * pi.up.z) < 150; };
    if (sp.frameId === id && sp.ship && sp.ship.flight && near(sp.ship.flight.pos)) return true;
    const w = this.sharedWorld(), ships = w && w.snapshot && w.snapshot.ships;
    if (ships) for (const sid in ships) { const s = ships[sid]; if (s && s.frameId === id && s.pose && near(s.pose.pos)) return true; }
    return false;
  }
  /** A side's ship: the type's own exterior, dressed in the faction's livery from its style sheet. Built once. */
  buildShip(i) {
    const t0 = performance.now(), C = this.cfg.sides[i], side = C.side, S = C.spot, P = this.tt.FLY[i], type = S.type, def = shipDef(type), V = visualsFor(type), style = factionStyle(side);
    const mats = (this.space.ship && this.space.ship.matsExt) || null; if (!mats) return null;
    const mark = shipMark(side, P.n, P.name);
    const tex = V.decalTexture ? V.decalTexture(THREE, def, mark.name, mark.registry) : null;
    const decal = tex ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }) : null;
    const ext = V.buildExterior(def.layout, mats, { tier: this.tier, def, remote: true, decal });
    V.applyNeutralPose(ext);
    applyLiveryTint(THREE, ext.root, mats, side);                        // clones the hull materials and recolours the clones: the player's ship is untouched
    const root = ext.root; root.name = 'side-yard:' + side + '-' + type; root.rotation.order = 'YXZ'; root.visible = false;
    if (this.low) root.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    const R = def.ramps.cargo, G = def.gear, rest = G.nominal + G.soleOffset;
    const s = { side, type, def, ext, root, k: null, rampP: -1, len: -1, G, R, mark,
      rampAngle: Math.min(0.72, Math.max(0.12, Math.asin(Math.min(0.9, Math.max(0.05, rest / R.length))))),
      rampYaw: Math.atan2(R.dir ? R.dir.x : 0, R.dir ? R.dir.z : 1), hold: null, strobe: null };
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
      k.box('glowWhite', R.hinge.x, y1 - 0.04, z1 - depth * 0.4, w * 0.5, 0.03, 0.18);
      if (C.hold) C.hold(k, { w, h, y0, z0, z1, depth, x: R.hinge.x, style, rgb });
      else for (const sx of [-1, 1]) k.box('paint', R.hinge.x + sx * w * 0.24, y0 + 0.55, z0 + 2.2, w * 0.36, 1.1, 3.2, { col: rgb(style.palette.primary, 0.9) });
      s.hold = k.toGroup(mats, { name: 'yard-hold' }); s.hold.visible = false; root.add(s.hold);
    }
    s.strobe = new THREE.Sprite(strobeMaterial()); s.strobe.position.set(0, P.strobeY || 5, 2); s.strobe.scale.set(0.014, 0.014, 1); s.strobe.visible = false; root.add(s.strobe);
    for (const e of ext.engines) e.outer.visible = e.core.visible = false;
    for (const q of ext.liftPods) q.mesh.visible = q.core.visible = false;
    this.root.add(root); this.ships[side] = s;
    this.buildMs.ships += performance.now() - t0; this.buildMs.count++;
    return s;
  }

  // ---- the place: built once, the first time the camera comes near ----------------------------------------------------------
  /** The settlement's own materials when its kit can be found (one more mesh per material, no new textures); otherwise a set of our own. */
  materials() {
    const mats = {};
    for (const g of this.parent.children) if (/-kit$/.test(g.name)) for (const m of g.children) { const key = m.name.split(':')[1]; if (key && m.material && !mats[key]) mats[key] = m.material; }
    const need = ['concrete', 'steelDark', 'steel', 'metal', 'paint', 'white', 'hazard', 'rubber', 'plasticDark', 'glow', 'glowWhite', 'glowAmber', 'glowRed', 'glowBlue', 'glowGreen', 'glowCool'];
    if (need.some((key) => !mats[key])) { const own = makePortMaterials(this.tier, this.space.ship && this.space.ship.matsExt ? this.space.ship.matsExt : null).mats; for (const key in own) if (!mats[key]) mats[key] = own[key]; }
    return mats;
  }
  build() {
    const t0 = performance.now(), low = this.low, cfg = this.cfg, mats = this.mats = this.materials();
    const k = new Kit(); k.defaultTile = 4; k.tiles = { paint: 8, metal: 1, panel: 4 };
    const pools = { pos: [], col: [] }, signs = new SignAtlas(this.tier);
    const h = this.helpers(k, pools, signs);
    cfg.build(h);
    if (cfg.board) {
      const b = cfg.board, by = b.y || 0;
      k.push(b.x, by, b.z, b.yaw || 0);
      for (const s of [-1, 1]) { h.B('steelDark', s * 1.55, 1.6, -0.1, 0.14, 3.2, 0.14, null, 0.03); h.X('concrete', s * 1.55, 0.1, -0.1, 0.5, 0.2, 0.5); }
      h.B('steelDark', 0, 2.2, -0.06, 3.84, 2.04, 0.1, null, 0.03);
      h.B('steelDark', 0, 3.33, 0.12, 3.0, 0.08, 0.36, null, 0.02); h.X('glowWhite', 0, 3.28, 0.14, 2.6, 0.04, 0.22);
      k.pop();
      const yaw = b.yaw || 0; h.pool(b.x + Math.sin(yaw) * 2.2, b.z + Math.cos(yaw) * 2.2, 4.5, [0.9, 0.86, 0.72], by + 0.06);
    }
    this.root.add(k.toGroup(mats, { name: 'yard-kit', cast: !low, receive: true }));

    // ---- lamplight on the ground: one additive mesh ----
    this.poolMat = new THREE.MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pools.pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(pools.col, 3));
      this.poolMesh = new THREE.Mesh(geo, this.poolMat); this.poolMesh.name = 'yard-lamplight'; this.poolMesh.renderOrder = 3; this.poolMesh.visible = false; this.root.add(this.poolMesh); }
    const sm_ = signs.build(); if (sm_) { sm_.name = 'yard-signs'; this.signMesh = sm_; this.root.add(sm_); }

    // ---- each side's stock: `max` pieces, each its own small group, shown or hidden as the level moves ----
    cfg.sides.forEach((C, i) => {
      if (!C.stock) return;
      const items = [];
      for (let j = 0; j < C.stock.max; j++) {
        const sk = new Kit(); sk.defaultTile = 4; sk.tiles = { paint: 8, metal: 1, panel: 4 };
        C.stock.build(j, this.helpers(sk, null, null));
        const g = sk.toGroup(mats, { name: 'yard-stock-' + C.side + '-' + j, cast: !low, receive: true }); g.visible = false; this.root.add(g); items.push(g);
      }
      this.stocks[i] = { items, n: -1 };
    });

    // ---- the board: a canvas, redrawn only when what it says changes ----
    if (cfg.board) {
      const b = cfg.board, c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      this.boardCanvas = c; this.boardTex = new THREE.CanvasTexture(c); this.boardTex.colorSpace = THREE.SRGBColorSpace; this.boardTex.anisotropy = 4;
      this.boardMat = new THREE.MeshBasicMaterial({ map: this.boardTex, toneMapped: false, fog: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), this.boardMat); m.name = 'yard-standing-board'; m.position.set(b.x, (b.y || 0) + 2.2, b.z); m.rotation.y = b.yaw || 0; this.root.add(m);
    }
    this.built = true; this.buildMs.place = performance.now() - t0;
  }
  /** What a world's `build(h)` draws with. Everything is outpost-local metres on the pad's plane (y = 0). */
  helpers(k, pools, signs) {
    const low = this.low, self = this;
    const B = (key, x, y, z, w, hh, d, col, c = 0.04) => k.bevelBox(key, x, y, z, w, hh, d, c, col ? { col } : {});
    const X = (key, x, y, z, w, hh, d, col) => k.box(key, x, y, z, w, hh, d, { col });
    const cyl = (key, x, y, z, r, hh, seg, o) => k.cyl(key, x, y, z, r, hh, low ? Math.min(seg, 10) : seg, o);
    const pipe = (key, a, b, r, seg = 8, o) => k.pipe(key, a, b, r, low ? 5 : seg, o);
    const dome = (key, x, y, z, r, o = {}) => k.dome(key, x, y, z, r, low ? 8 : 12, low ? 3 : 5, { thetaMax: HALF_PI, ...o });
    /** Lamplight on the ground round (x, z): one additive mesh for the whole place, faded in after sunset. */
    const pool = (x, z, r, col, y = 0.06) => {
      if (!pools) return;
      const n = low ? 8 : 14, RING = [[0, 1], [0.25, 0.6], [0.55, 0.22], [1, 0]];
      for (let j = 0; j < RING.length - 1; j++) for (let i = 0; i < n; i++) {
        const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, [r0, k0] = RING[j], [r1, k1] = RING[j + 1];
        const Pt = (a, rr) => [x + Math.cos(a) * r * rr, y, z + Math.sin(a) * r * rr], C = (kk) => [col[0] * kk, col[1] * kk, col[2] * kk];
        if (j) { pools.pos.push(...Pt(a0, r0), ...Pt(a1, r0), ...Pt(a1, r1)); pools.col.push(...C(k0), ...C(k0), ...C(k1)); }
        pools.pos.push(...Pt(a0, r0), ...Pt(a1, r1), ...Pt(a0, r1)); pools.col.push(...C(k0), ...C(k1), ...C(k1));
      }
    };
    /** A work lamp on a post with a footing: a lamp head and its light on the ground. */
    const lampPost = (x, z, hh, glow, col, r = 8, y = 0) => {
      B('concrete', x, y + 0.12, z, 0.5, 0.24, 0.5, null, 0.03); cyl('steelDark', x, y + hh / 2, z, 0.06, hh, 6, { r2: 0.045 });
      B('steelDark', x, y + hh + 0.04, z, 0.8, 0.1, 0.32, null, 0.02); X(glow, x, y + hh - 0.03, z, 0.68, 0.05, 0.22);
      pool(x, z, r, col, y + 0.06);
    };
    /** A faction sign: a framed plate (and two posts unless `wall`), lettered from the side's style sheet. `yaw`: 0 looks south (+z), PI/2 east. */
    const sign = (side, kind, text, x, y, z, w, hh, yaw = 0, o = {}) => {
      if (signs) signs.add(x, y, z, w, hh, yaw, side, text, kind, o.emblem ? { emblem: true } : {});
      k.push(x, 0, z, yaw);
      B('steelDark', 0, y, -0.05, w + 0.12, hh + 0.12, 0.06, null, 0.02);
      if (!o.wall) for (const s of [-1, 1]) { X('steelDark', s * w * 0.38, y / 2, -0.08, 0.09, y, 0.09); X('concrete', s * w * 0.38, 0.08, -0.08, 0.4, 0.16, 0.4); }
      k.pop();
    };
    /** A paved slab from the lowest ground under its footprint up to `top` (so a yard on uneven ground stands on something). */
    const slab = (x0, z0, x1, z1, col = [0.5, 0.5, 0.48], top = 0) => {
      let lo = top - 0.3; for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]]) lo = Math.min(lo, self.groundY(x, z) - 0.2);
      B('concrete', (x0 + x1) / 2, (lo + top) / 2, (z0 + z1) / 2, x1 - x0, top - lo, z1 - z0, col, 0.06);
    };
    return { k, B, X, cyl, pipe, dome, pool, lampPost, sign, slab, low, rgb, style: factionStyle, groundY: (x, z) => self.groundY(x, z), has: (key) => !!(self.mats && self.mats[key]) };
  }

  /** The stocks follow the timetable's clock (and, in a shared world, how strong the home is). Meshes are touched only when a count changes. */
  place(now) {
    const sides = this.cfg.sides;
    for (let i = 0; i < sides.length; i++) {
      const st = this.stocks[i]; if (!st) continue;
      const C = sides[i].stock, f = this.tt.stockAt(i, now, C.mode, this._skipK[i], C.low), n = Math.round(f * this._strength * C.max);
      if (n === st.n) continue;
      st.n = n; for (let j = 0; j < st.items.length; j++) st.items[j].visible = j < n;
    }
  }

  // ---- the people ----------------------------------------------------------------------------------------------------------
  buildHands() {
    this.handsBuilt = true;
    const lib = this.space.peopleLib, cached = new Set(lib.cachedFiles()), low = this.low;
    lib.roster().then((roster) => {
      const poolR = roster.filter((r) => cached.has(r.file)); if (!poolR.length) return;       // only bodies already downloaded: nothing is fetched for these
      let i = 0;
      for (const spec of this.cfg.hands || []) {
        if (spec.full && (low || lib.phone)) continue;
        const model = poolR[(i * 3 + (spec.model || 0)) % poolR.length], person = lib.spawn(model.id, model.file);
        dressForWorld(person, this.body, { cloth: spec.cloth ?? factionStyle(spec.side).palette.accent }, false);
        person.group.visible = false; this.root.add(person.group);
        const hd = { spec, person, offset: i * 41, anim: '', pose: {}, cart: null };
        if (spec.cart) {
          const ck = new Kit(); ck.tiles = { paint: 8, metal: 1, panel: 4 }; spec.cart(this.helpers(ck, null, null));
          const g = ck.toGroup(this.mats, { name: 'yard-cart-' + spec.id, cast: !low }); g.visible = false; g.rotation.y = Math.atan2(spec.push.b[0] - spec.push.a[0], spec.push.b[1] - spec.push.a[1]); this.root.add(g); hd.cart = g;
        }
        this.hands.push(hd); i++;
      }
    }).catch((e) => console.error('Yard people failed', e));
  }
  /** `c`: the camera in outpost metres. A hidden hand costs nothing and comes back in the right place (the beats are pure functions of the clock). */
  tickHands(dt, c) {
    const range = this.low ? 95 : 180, now = this.now; this.handsShown = true;
    for (const h of this.hands) {
      const s = h.spec, g = h.person.group, t = now + h.offset, q = s.push ? pushPose(s.push, t, h.pose) : beatPose(s.beat, t, h.pose);
      const near = Math.hypot(c.x - q.x, c.y, c.z - q.z) < range;
      g.visible = near; if (h.cart) h.cart.visible = near;
      if (!near) continue;
      const y = s.y || 0;
      g.position.set(q.x, y + 0.02, q.z);
      let d = q.yaw - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, dt * 5);
      const anim = q.moving ? 'Walk' : 'Idle'; if (anim !== h.anim) { h.anim = anim; h.person.play(anim, 0.3); }
      h.person.update(dt, q.moving ? (s.push ? s.push.speed || PUSH_SPEED : WALK_SPEED) : 0);
      if (h.cart) h.cart.position.set(q.cx, y + 0.02, q.cz);
    }
  }

  // ---- the board ------------------------------------------------------------------------------------------------------------
  /** What the board should say now: the sides' leaders and stance, the home's balance and strength. null without a shared world. */
  report() {
    const w = this.sharedWorld(), s = w && w.snapshot, id = this.cfg.homeId || this.body.id, h = s && s.homes && s.homes[id];
    if (!h || !Number.isFinite(h.balance)) return null;
    const out = { balance: Math.round(h.balance), strength: Math.round(strengthOf(h)), words: describeHome(h), sides: {} };
    try { if (s.roles) for (const l of leadersOf(s.roles, id)) out.sides[l.faction] = { leader: l.holder.kind === 'human' ? l.holder.name : (l.holder.npc && l.holder.npc.name) || '', stance: Math.round(l.stance * 10) / 10 }; } catch (e) { /* a record this build cannot read: the board still shows the two meters */ }
    return out;
  }
  syncBoard() {
    const r = this.report(), b = this.cfg.board;
    this._strength = r ? 0.5 + 0.5 * clamp01(r.strength / 100) : 1;       // a strong home stacks its yard to the top; a weak one to half
    const key = r ? [r.balance, r.strength, ...b.sides.map((f) => (r.sides[f] ? r.sides[f].leader + '/' + r.sides[f].stance : '-'))].join('|') : 'none';
    if (key === this._boardKey) return;
    this._boardKey = key; this.drawBoard(r); this.boardTex.needsUpdate = true; this.boardDraws++;
  }
  drawBoard(r) {
    const b = this.cfg.board, c = this.boardCanvas, g = c.getContext('2d'), W = c.width, H = c.height;
    g.fillStyle = '#14110f'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = '#e9e2d2'; g.font = '700 40px "Arial Narrow", Arial, sans-serif'; g.fillText(b.title, W / 2, 38, W - 60);
    const stanceWord = (v) => (v === undefined ? '' : v > 0.15 ? 'leans to work together' : v < -0.15 ? 'leans to go it alone' : 'has not said which way');
    const pw = (W - 40 - 20 * (b.sides.length - 1)) / b.sides.length;
    b.sides.forEach((id, i) => {
      const st = factionStyle(id), s = st.signs, x = 20 + i * (pw + 20), ph = 270, y = 70, e = s.emblem, lower = s.upper === false, d = r && r.sides[id];
      g.fillStyle = css(e.bg); g.fillRect(x, y, pw, ph);
      g.strokeStyle = css(e.fg); g.lineWidth = 6; g.strokeRect(x + 3, y + 3, pw - 6, ph - 6);
      drawEmblem(g, id, x + pw / 2, y + 74, 116);
      g.fillStyle = css(lower ? st.palette.trim : e.fg); g.font = `${s.weight} 60px ${s.fontStack}`; g.fillText(lower ? st.name.toLowerCase() : st.name.toUpperCase(), x + pw / 2, y + 166, pw - 40);
      g.fillStyle = css(lower ? st.palette.dark : st.palette.light); g.font = `600 28px ${s.fontStack}`; g.fillText((b.roles && b.roles[id]) || '', x + pw / 2, y + 208, pw - 40);
      g.fillText(!r ? 'no report' : d ? `${d.leader ? d.leader + ' ' : ''}${stanceWord(d.stance)}` : 'no word from its leader', x + pw / 2, y + 242, pw - 36);
    });
    g.fillStyle = '#211c19'; g.fillRect(20, 352, W - 40, 146); g.strokeStyle = '#8c8f93'; g.lineWidth = 3; g.strokeRect(21.5, 353.5, W - 43, 143);
    if (r) {
      g.fillStyle = '#ffd9a0'; g.font = '700 34px "Arial Narrow", Arial, sans-serif'; g.fillText(`BETWEEN THE TWO: ${r.balance} OF 100`, W / 2, 380, W - 70);
      g.fillStyle = '#e9e2d2'; g.font = '600 27px "Arial Narrow", Arial, sans-serif'; g.fillText(r.words.balance, W / 2, 418, W - 70);
      g.fillStyle = '#d7e8c8'; g.font = '600 29px "Arial Narrow", Arial, sans-serif'; g.fillText(`THE HOME: ${r.strength} OF 100 · ${r.words.strength}`, W / 2, 466, W - 70);
    } else {
      g.fillStyle = '#ffd9a0'; g.font = '700 40px "Arial Narrow", Arial, sans-serif'; g.fillText('NO REPORT', W / 2, 398, W - 70);
      g.fillStyle = '#b9b2a4'; g.font = '600 26px "Arial Narrow", Arial, sans-serif'; g.fillText(b.none || 'Nobody has posted a standing today.', W / 2, 452, W - 70);
    }
  }

  // ---- for tests and review shots -------------------------------------------------------------------------------------------
  status() {
    const tt = this.tt, now = this.time(), k = Math.floor(now / tt.SLOT), v = this.cur.k === k ? this.cur : tt.visitAt(k, {}), t = now - v.start, ships = [];
    for (const id in this.ships) { const s = this.ships[id]; if (s.k === null) continue; const p = tt.poseAt(v, t, {});
      ships.push({ k: v.k, side: id, type: s.type, registry: s.mark.registry, name: s.mark.name, spot: v.spot.id, phase: PHASES[p.phase], diverted: v.diverted, t: +t.toFixed(2), x: p.x, y: s.root.position.y, z: p.z, alt: p.alt, yaw: p.yaw, ramp: p.ramp, shown: s.root.visible }); }
    return { name: this.cfg.name, time: now, active: this.active, built: this.built, phone: this.low, night: this.night, ships, shipsBuilt: Object.keys(this.ships).length,
      stocks: this.stocks.map((s) => (s ? s.n : null)), strength: this._strength,
      hands: this.hands.map((h) => ({ id: h.spec.id, side: h.spec.side, x: +h.person.group.position.x.toFixed(2), z: +h.person.group.position.z.toFixed(2), shown: h.person.group.visible, anim: h.anim })),
      board: { key: this._boardKey, draws: this.boardDraws }, buildMs: { ...this.buildMs } };
  }
  /** Move the timetable's clock so `side`'s ship is in `phase`, `into` (0..1) of the way through it. */
  jumpTo(side, phase, into) {
    const tt = this.tt, now = this.time(), v = {}, i = PHASES.indexOf(phase), si = this.cfg.sides.findIndex((s) => s.side === side); if (i < 0 || si < 0) throw new Error('side or phase unknown');
    let k = Math.floor(now / tt.SLOT) + 1; while (tt.sideOf(k) !== si + tt.T0) k++;
    tt.visitAt(k, v); const edge = [0, v.t1, v.t2, v.t3, v.t4, v.t5, v.t6, v.t7];
    this.shiftS += v.start + edge[i] + (edge[i + 1] - edge[i]) * (into ?? (phase === 'landed' ? 0.3 : 0.6)) - now;
    return { k, side: v.side, shiftS: this.shiftS };
  }
  shift(seconds) { this.shiftS += seconds; return this.shiftS; }

  dispose() {
    this.hush(); this.root.removeFromParent();
    for (const m of [this.poolMat, this.boardMat, this.boardTex]) if (m) m.dispose();
    if (this.signMesh) { this.signMesh.material.map.dispose(); this.signMesh.material.dispose(); }
  }
}
