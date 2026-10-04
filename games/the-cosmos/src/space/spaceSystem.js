// ============================================================================
// spaceSystem.js — space travel as one system: the sky, the moons, frames, the drive, the jobs.
//
// OWNS: which frame is active (Mars, Phobos, Deimos) and the switch between them, the moons' worlds, the destination list and
//       the trip in progress, the sky update, and the small hooks other systems read (see HOOKS below).
// DOES NOT OWN: money (the economy builder's src/economy and src/port: this only calls the hooks), the ship's physics (it
//       asks shipFlight.js for an override), the moons' ground (moonField.js / moonWorld.js).
//
// F2: THE FRAMES MOVE. Mars's body-fixed frame turns once per sol and a moon's frame is that frame translated to the moon's centre and turned
// by its yaw (core/frameMath.js, space/frames.js); every frame's motion is refreshed from the clock at the top of each frame (early()). The
// time a frame is evaluated at is `timeS()`: the ship's own clock while she is in space, the world's (real UTC) otherwise.
// FRAMES. A frame is a translated copy of Mars's body-fixed frame with a moon's centre at its origin. The ship, the player, the
// camera and the drones live in whichever frame is ACTIVE; switching (setFrame) re-expresses their positions and re-points the
// walker, the digger and the ground the ship lands on. It only happens when the ship is hovering or has just stopped, so no
// velocity is ever touched.
//
// HOOKS (for the economy / quest builder to wire; defaults keep a small local ledger so the loop works on its own):
//   space.hooks.award(credits, reason)      -> pay the player.  Called for: raider bounty, survey samples delivered, salvage.
//   space.hooks.addCargo(item, kg, meta)    -> something came aboard (sample canisters, regolith, hydrated clay, salvage).
//   space.hooks.removeCargo(item, kg)       -> something left (delivered).
//   space.hooks.onArrive(destId)            -> a trip ended (event for quests).
//   space.hooks.cargoKg(item)               -> how much of an item the hold has (default: this file's own tally).
// ============================================================================

import * as THREE from 'three';
import { SpaceSky, MARS_RADIUS_M } from './spaceSky.js';
import { SpaceTrip, fmtDuration, MARS_R, estimateCourse } from './spaceTrip.js';
import { OMEGA, worldKin, worldPointFixed, frameAt, carryFlight, framePoint, frameDir, frameVel, sunDirFixed, sunAt, rotY, toInertial, velToInertial, skyShiftFor } from './frames.js';
import { worldTimeS, setSkyShift } from './clock.js';
import { DESTINATIONS, DRIVE, MOONS, STANDOFF_M, BOUNTY_CREDITS, SPAWN, sunDirection, landingOrder, stickWarpCap, stationStandoff } from './spaceSpec.js';
import { worldCentre, worldDef } from '../worlds/registry.js';
import { MoonWorld } from './moonWorld.js';
import { makeMoon } from './moonField.js';
import { surfaceRadiusFast } from '../world/field.js';
import { makeTools } from '../player/digging.js';
import { SpaceJobs } from './jobs.js';
import { SpaceUI } from './spaceUI.js';
import { Transit } from './transit.js';
import { FreeFlight } from './freeflight.js';           // FREEFLIGHT
import { FreeFlightUI, ffHudLines } from './freeflightUI.js';
import { JUMP, systemOfFrame, rootFrameOf, mouthPoint, solMouthDir, isLaneWorld } from './jump.js';       // WORLD2
import { buildLaneGate } from './laneGate.js';
import { LONG, targetAt, realSeconds, longDriveAllowed } from './longRange.js';
import { installHold } from './deepHold.js';       // F3: the long-range drive

const DEG = Math.PI / 180;

export class SpaceSystem {
  /**
   * @param o { engine, body (Mars), tier, sun, hemi, ship, walker, digger, portSite, setGround(fn), marsGround, followEntries[],
   *            hooks? }
   */
  constructor(o) {
    this.o = o; this.engine = o.engine; this.marsBody = o.body; this.tier = o.tier || 'high';
    this.ship = o.ship; this.walker = o.walker; this.digger = o.digger; this.portSite = o.portSite;
    this.sky = new SpaceSky({ engine: o.engine, sun: o.sun, hemi: o.hemi, oldStars: o.engine.scene.getObjectByName('starfield'), tier: o.tier,
      skyColor: o.body.atmosphere.skyColor, horizonColor: o.body.atmosphere.horizonColor, fogDensity: o.fogDensity });
    this._localSun = new THREE.Vector3();
    this.sunLocal = new THREE.Vector3(0.5, 0.7, 0.5);       // the Sun in the ACTIVE frame's axes (early())
    this.skyMode = o.skyMode || 'live';                      // 'live': the real Sun at the real time; 'fixed': the legacy mid-morning Sun (dev sessions, trailer shots)
    this.timeShift = 0;
    this.worlds = new Map();
    this.trip = null; this.lastTrip = null;
    this.warp = 1;
    this.log = [];
    this._cam = {}; this._tmp = {};

    // what the walker and digger were on Mars: kept so the switch back is exact
    const w = o.walker, d = o.digger;
    this.marsSaved = { groundSampler: w.groundSampler, collisionActive: w.collisionActive, jumpSpeed: w.jumpSpeed,
      body: d.body, edits: d.edits, tools: d.tools, toolIdx: d.toolIdx, canPlaceSpoil: d.canPlaceSpoil };
    this.setGround = o.setGround || (() => {});
    this.marsGround = o.marsGround;
    for (const e of [o.ship && o.ship.entryExt, o.ship && o.ship.entryInt, ...(o.followEntries || [])]) if (e) e.followActive = true;
    if (o.ship && o.ship.droneViews) for (const v of o.ship.droneViews) v.entry.followActive = true;

    // hooks: defaults hold a tiny local ledger so the whole loop works before the economy is wired
    this.ledger = { credits: 0, entries: [], cargo: new Map() };
    this.hooks = Object.assign({
      award: (c, why) => { this.ledger.credits += c; this.ledger.entries.push({ credits: c, why, at: Date.now() }); },
      addCargo: (item, kg, meta) => this.ledger.cargo.set(item, (this.ledger.cargo.get(item) || 0) + kg),
      removeCargo: (item, kg) => { this.ledger.cargo.set(item, Math.max(0, (this.ledger.cargo.get(item) || 0) - kg)); },
      onArrive: () => {},
      cargoKg: (item) => this.ledger.cargo.get(item) || 0,
    }, o.hooks || {});
    this.jobs = new SpaceJobs(this);
    // WORLD2: the lane gate on Mars's side, and the flash that covers the jump
    this.flash = 0; this._sysCfg = null;
    if (typeof document !== 'undefined') {
      this.gate = buildLaneGate({ engine: o.engine, frame: o.engine.rootFrame, point: mouthPoint('mars'), toward: { x: -solMouthDir().x, y: -solMouthDir().y, z: -solMouthDir().z }, low: this.tier === 'low' });
      const fl = document.createElement('div'); fl.id = 'jump-flash';
      fl.style.cssText = 'position:fixed;inset:0;z-index:88;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 50%,#fff 0%,#d8f6ff 35%,#6fc8ff 80%,#1a4a7a 100%);mix-blend-mode:screen';
      document.body.appendChild(fl); this._flashEl = fl;
    }
    // FREEFLIGHT: manual flight anywhere (freeflight.js), and its HUD (freeflightUI.js). Solo runs the physics here; the shared world mirrors the authority's.
    this.ff = new FreeFlight({ flight: o.ship.flight, mars: o.body, frameId: () => this.frameId, worldTime: () => this.worldTime(), setFrame: (id) => this.setFrame(id), say: (m, w) => this.say(m, w), drones: o.ship.drones,
      cancelOrders: () => { if (o.ship.crew && o.ship.crew.cancelOrder) o.ship.crew.cancelOrder(); }, tripActive: () => !!(this.trip && this.trip.active),
      atPad: () => this.frameId === 'mars' && !!this.portSite && Math.hypot(...['x', 'y', 'z'].map((k, i) => o.ship.flight.pos[k] - this.portSite.toWorld(0, 0, 0)[k])) < 60 });
    this.ui = typeof document !== 'undefined' ? new SpaceUI(this) : null;
    this.ffUI = typeof document !== 'undefined' ? new FreeFlightUI(this) : null;     // FREEFLIGHT

    // the moons: Phobos after a moment (it is in the sky from the start); Deimos is built when a course to it is engaged.
    this._built = false;
    if (typeof window !== 'undefined') {
      // worlds that show in the sky from the start (def.showFromStart: Phobos) are built when the browser is idle
      const build = () => { for (const id of Object.keys(MOONS)) if (MOONS[id].showFromStart) { try { this.moonWorld(id).setVisible(true); } catch (e) { console.error(`${id} failed to build`, e); } } };
      // not in the first seconds of play: when the browser is idle (a phone may take half a second over it)
      setTimeout(() => { if (window.requestIdleCallback) window.requestIdleCallback(build, { timeout: 4000 }); else build(); }, 2500);
    }
    if (o.ship) o.ship.space = this;
    if (o.ship && o.ship.drones) o.ship.drones.onDown = (d) => this.onRaiderDown(d);
  }

  // =========================================================================
  // FRAMES
  // =========================================================================
  get frameId() { return this.engine.activeFrame.id; }
  get frame() { return this.engine.activeFrame; }
  get onMoon() { return this.frameId !== 'mars'; }
  get activeMoon() { return this.onMoon ? this.worlds.get(this.frameId) : null; }

  snapshotState() {
    const t=this.trip,j=this.jobs;
    return {ff:this.ff.save(),epochS:this.ship.flight.epochS,deepHold:this.ship.flight.deepHold||null,frameId:this.frameId,ledger:{credits:this.ledger.credits,cargo:[...this.ledger.cargo]},
      jobs:{taken:[...j.taken],hold:structuredClone(j.hold),samplesAboard:j.samplesAboard,salvaged:j.salvaged,beaconHeard:j.beaconHeard,paidTotal:j.paidTotal},
      trip:t?{destId:t.dest.id,dest:{id:t.dest.id,kind:t.dest.kind,name:t.dest.name,moon:t.dest.moon,sys:t.dest.sys},phase:t.phase,t:t.t,warp:t.warp,settleT:t.settleT,cancelled:t.cancelled,progress:{...t.progress},legs:t.legs?structuredClone(t.legs):null,leg:t.leg,spoolT:t.spoolT,cruise:t.cruise?structuredClone(t.cruise):null,
        said:[...t._said],attFrom:t._attFrom?.toArray()||null,transit:t.transit?structuredClone(t.transit):null}:null};
  }
  restoreState(saved) {
    if(!saved)return;
    // Saved coordinates already name their frame; switching must not translate them twice.
    const pos={...this.ship.flight.pos},wp={...this.walker.worldPos};this.setFrame(saved.frameId);
    Object.assign(this.ship.flight.pos,pos);Object.assign(this.walker.worldPos,wp);
    this.ship.flight.refreshOrientation();this.walker.updateFrame();this.ship._syncEntries();
    Object.assign(this.jobs,saved.jobs);this.jobs.taken=new Set(saved.jobs.taken);
    this.ledger.credits=saved.ledger.credits;this.ledger.cargo=new Map(saved.ledger.cargo);
    this.ship.flight.epochS=saved.epochS??null;this.ship.flight.deepHold=saved.deepHold||null;if(this.ship.flight.deepHold&&!saved.trip)installHold(this.ship.flight);          // F3: held out in deep space
    if(saved.ff)this.ff.load(saved.ff);   // FREEFLIGHT
    if(saved.epochS===undefined&&this.ff.active){const p=this.ship.flight.pos,v=this.ship.flight.vel;v.x-=OMEGA*p.z;v.z+=OMEGA*p.x;}     // saved before F2: an inertial velocity; keep the orbit
    if(saved.trip&&saved.trip.transit&&saved.trip.transit.T0===undefined)saved.trip=null;   // a drive course saved before F2 cannot be resumed: the ship is held where she is
    if(saved.trip){const r=saved.trip,dest={...this.resolve(r.destId),...r.dest};if(dest.kind==='hold')dest.goalS=()=>r.transit.finalGoal;if(!dest.kind)return;
      const t=new SpaceTrip(this,dest);Object.assign(t,r);t.dest=dest;t._said=new Set(r.said);t._attFrom=r.attFrom?new THREE.Quaternion().fromArray(r.attFrom):null;
      if(r.transit){t.transit=Object.assign(Object.create(Transit.prototype),r.transit);t.rebindTransit();this.ship.flight.override=dt=>t._drive(dt);}
      if(r.cruise){t.cruise=r.cruise;this.ship.flight.override=dt=>t._cruiseStep(dt);}          // F3
      this.trip=t;
    }
  }

  // =========================================================================
  // TIME
  // =========================================================================
  /** The world's game time, seconds since the epoch: real UTC (clock.js). */
  worldTime() { return worldTimeS(); }
  /** The time the sky and the frames are at for the player's ship: her own clock in space, the world's otherwise. A shared-world client extrapolates the server's. */
  timeS() {
    const e = this.ship.flight.epochS;
    if (e == null) return this.worldTime();
    const a = this.epochAnchor;                                  // set by the shared-world view: the server's value and when it arrived
    return a ? a.epochS + Math.min(2, (performance.now() - a.at) / 1000) * a.eff : e;
  }
  /** Refresh every moon frame's origin, turn and velocity at game time T, and the Sun in the active frame's axes. Called at the top of each frame. */
  updateFrames(T = this.timeS()) {
    const e = this.engine;
    for (const w of this.worlds.values()) e.setFrameState(w.frame, worldKin(w.id, T));
    const sf = this.skyMode === 'fixed' ? sunDirection() : sunDirFixed(T), r = rotY(sf, -e.activeFrame.yaw);
    this.sunLocal.set(r.x, r.y, r.z);
    // each moon's baked shadows follow the Sun in ITS axes (a far world of another system, WORLD2, has its own star: fixed in its own axes, never moved here)
    for (const w of this.worlds.values()) { if (!w.built || w.body.spec.sun) continue; const q = rotY(sf, -w.frame.yaw); w.body.setSun(q.x, q.y, q.z); }
    const af = this.activeMoon; if (af && af.body.spec.sun) this.sunLocal.set(af.body.sunDir.x, af.body.sunDir.y, af.body.sunDir.z);
    this.T = T;
    return T;
  }
  /** First thing in a frame: frames and the Sun are where the clock puts them. */
  early(dt) { this.updateFrames(); }
  /** The local solar time and Sun height at the port (the spawn's coordinates): what the HUD says. */
  portSky() { return sunAt(SPAWN.lat, SPAWN.lon, this.skyMode === 'fixed' ? this.worldTime() : this.worldTime()); }

  moonWorld(id) {
    let w = this.worlds.get(id);
    if (!w) { w = new MoonWorld({ engine: this.engine, id, tier: this.tier, space: this, time: this.timeS() }); this.worlds.set(id, w); w.build(); w.setVisible(true); this._dressWorld(w); if (this.onWorldBuilt) this.onWorldBuilt(id, w); }
    else if (!w.built) w.build();
    return w;
  }
  /** WORLD2: a world reached by a lane has its gate: a ring of beacons over its pad, where the jump coils spool. Built once, with the world. */
  _dressWorld(w) {
    if (!isLaneWorld(w.id) || systemOfFrame(w.id) !== w.id) return;       // WD-MOON: only the region's own world carries its gate
    const up = w.body.padInfo.up;
    w.gate = buildLaneGate({ engine: this.engine, frame: w.frame, point: mouthPoint(w.id, w.body), toward: { x: -up.x, y: -up.y, z: -up.z }, low: this.tier === 'low' });
  }
  /** WORLD2: the nearest person to talk to at the active world's settlement, or null (a world's client.js `dress()` returns `people` with `nearest(worldPos)`). */
  nearestWorker(worldPos) { const w = this.activeMoon; return w && w.client && w.client.people ? w.client.people.nearest(worldPos) : null; }
  /** WORLD2: spaceSky.setSystem's config from a world's def.sky: { star: { color, glow, diskDeg, intensity }, fill: { sky, ground, intensity } }. */
  _skyConfig(body) {
    const k = body.spec.sky, d = body.sunDir;
    return { sunDir: new THREE.Vector3(d.x, d.y, d.z), color: k.star.color, glow: k.star.glow, diskDeg: k.star.diskDeg, sunIntensity: k.star.intensity, fill: k.fill, giant: null };
  }
  /** The ship is about to jump: build the far world now (behind the spool), not at the jump. */
  prepareWorld(frameId) { if (frameId !== 'mars') this.moonWorld(frameId); }
  /** WORLD2: the lane fee, taken as the coils fire. { ok, msg }. Solo takes it from the account; the shared world's authority does it for itself. */
  payLaneFee(credits) {
    if (this.ledger.credits < credits) return { ok: false, msg: `The lane office wants ${credits} credits and the account has ${Math.floor(this.ledger.credits)}. Holding at the lane mouth: earn it, then plot the course again.` };
    const r = this.hooks.charge ? this.hooks.charge(credits, 'Ore Lane fee') : { ok: true };
    if (r && r.ok === false) return { ok: false, msg: r.msg || 'The lane fee was refused.' };
    this.ledger.credits -= credits;
    return { ok: true };
  }
  /** WORLD2: the jump: the frame changes and the ship appears at `arrival` (the other mouth), at rest. Nothing that rides with her is left behind. */
  jumpTo(frameId, arrival) {
    const f = this.ship.flight, w = this.walker;
    this.setFrame(frameId);                                // everything is re-expressed in the new frame ...
    const dx = arrival.x - f.pos.x, dy = arrival.y - f.pos.y, dz = arrival.z - f.pos.z;     // ... and then moved to where the corridor lets out
    for (const p of [f.pos, w.worldPos]) { p.x += dx; p.y += dy; p.z += dz; }
    const e = this.engine.cameraWorldPos; e.x += dx; e.y += dy; e.z += dz;
    f.vel.x = f.vel.y = f.vel.z = 0;
    const dr = this.ship.drones; if (dr) { dr.drones.length = 0; dr.shots.length = 0; }
    this.ship.guns.bolts.length = 0;
    f.refreshOrientation(); w.updateFrame(); this.ship._syncEntries && this.ship._syncEntries();
    this.flash = 1;
  }

  /** Make `id` ('mars', 'phobos', 'deimos') the active frame: everything that rides with the player is re-expressed. */
  setFrame(id) {
    const e = this.engine;
    const to = id === 'mars' ? e.rootFrame : this.moonWorld(id).frame, from = e.activeFrame;
    if (to === from) return;
    this.updateFrames();                                     // both frames at this instant
    // Everything that rides with the player is carried across with its velocity and its turn: the frames move and turn against each other.
    const ship = this.ship, f = ship.flight, w = this.walker, dg = this.digger;
    carryFlight(f, from, to);
    e.frameVel(from, to, w.worldPos, w.velocity, w.velocity); e.framePoint(from, to, w.worldPos, w.worldPos);
    const pt = (p) => { if (p) e.framePoint(from, to, p, p); };
    if (ship.drones) { for (const dr of ship.drones.drones) { pt(dr.pos); pt(dr.anchor); if (dr.vel) e.frameDir(from, to, dr.vel, dr.vel); } for (const b of ship.drones.shots) { pt(b); const q = e.framePoint(from, to, { x: b.px, y: b.py, z: b.pz }); b.px = q.x; b.py = q.y; b.pz = q.z; } }
    for (const b of ship.guns.bolts) { pt(b); const q = e.framePoint(from, to, { x: b.px, y: b.py, z: b.pz }); b.px = q.x; b.py = q.y; b.pz = q.z; }
    e.setActiveFrame(to);
    if (ship.drones) ship.drones.safeFrame = isLaneWorld(id);       // WORLD2: a far world keeps its own lanes clear of raiders
    if (systemOfFrame(from.id) !== systemOfFrame(to.id)) this.flash = 1;       // WORLD2: crossing the lane
    this.updateFrames();                                     // the Sun in the new frame's axes

    if (id === 'mars') {
      const s = this.marsSaved;
      ship.body = f.body = w.body = this.marsBody;
      this.setGround(null);
      w.groundSampler = s.groundSampler; w.collisionActive = s.collisionActive; w.jumpSpeed = s.jumpSpeed;
      dg.body = s.body; dg.edits = s.edits; dg.tools = s.tools; dg.toolIdx = s.toolIdx; dg.canPlaceSpoil = s.canPlaceSpoil;
    } else {
      const mw = this.moonWorld(id), b = mw.body;
      ship.body = f.body = w.body = b;
      this.setGround(mw.shipGround());
      w.groundSampler = mw.groundSampler(); w.collisionActive = mw.collisionActive();
      // a hop that clears about 1.3 m (Mars's own jump): v = sqrt(2 g 1.3), never under 0.6 m/s. Phobos's gravity is 0.0056 m/s2, a 3 m/s jump is a 15-minute flight
      w.jumpSpeed = Math.min(6, Math.max(0.6, Math.sqrt(2 * b.surfaceGravity * 1.3)));
      dg.body = b; dg.edits = mw.edits;
      if (b.settlementSolid) {                          // WORLD2: no spoil on the buildings, the pad or the people of a settlement
        const base = this.marsSaved.canPlaceSpoil;
        dg.canPlaceSpoil = (x, y, z) => (b.settlementSolid(x, y, z, 0.5) ? false : (base ? base(x, y, z) : true));
      } else dg.canPlaceSpoil = this.marsSaved.canPlaceSpoil;
      const idx = dg.toolIdx;
      dg.tools = makeTools(b).map((t) => ({ ...t, capacityKg: t.machine ? t.capacityKg : Math.min(t.capacityKg, 1054) }));   // a cart is rated by inertia, not weight
      dg.toolIdx = idx;
    }
    f.refreshOrientation();
    w.updateFrame();
    ship.scanner && (ship.scanner.builtAt = null);
    this.say(id === 'mars' ? 'Back in Mars space.' : `${this.worlds.get(id).body.name} frame.`, false);
    return to;
  }

  /** Review / validator helper: set the ship down on a moon's pad (frame switched, settled on the gear), skipping the flight. */
  debugLand(id = 'phobos') {
    const mw = this.moonWorld(id), f = this.ship.flight;
    if (this.trip) { this.trip = null; f.override = null; }
    this.setFrame(id);
    const pi = mw.body.padInfo, up = pi.up, p = pi.point, h = Math.hypot(p.x, p.y, p.z);
    const R = h + 1.2;
    f.setDown({ x: up.x * R, y: up.y * R, z: up.z * R }, this.portHeading());
    f.attitude = null; f.override = null;
    for (let i = 0; i < 60 * 40; i++) f.step(1 / 60);
    f.vel = { x: 0, y: 0, z: 0 };
    f.refreshOrientation();
    this.ship._syncEntries();
    mw.force(f.pos);
    return { landed: f.landed, agl: f.agl };
  }

  /** Dev entry (`?dev=1&body=<id>`, solo only): set the ship down on a world's pad and stand the walker ten metres east of it, on the
   *  ground, without any travel. Returns { landed, agl, standing } or throws for an unknown world. */
  debugStand(id) {
    const r = this.debugLand(id), mw = this.moonWorld(id), b = mw.body, pi = b.padInfo, w = this.walker;
    const x = pi.point.x + pi.east.x * 10, y = pi.point.y + pi.east.y * 10, z = pi.point.z + pi.east.z * 10, l = Math.hypot(x, y, z) || 1;
    const R = surfaceRadiusFast(b, x / l, y / l, z / l) + 0.05;
    Object.assign(w.worldPos, { x: x / l * R, y: y / l * R, z: z / l * R }); Object.assign(w.velocity, { x: 0, y: 0, z: 0 });
    w.updateFrame(); mw.force(w.worldPos);
    for (let i = 0; i < 60; i++) w.tick(1 / 60, {});
    return { ...r, standing: !!w.grounded };
  }

  /** In the moon's local metres: where the camera is. */
  _camIn(world, out) { return this.engine.cameraIn(world.frame, out); }

  // =========================================================================
  // DESTINATIONS AND TRIPS
  // =========================================================================
  /**
   * Resolve a destination row into something a trip can fly to. `fixedAt(T)` is the goal in Mars's TURNING axes at game time T (the course chases it
   * as it moves: a moon's standoff point, the gate over a port that turns with Mars); `goalS()` is the same point now.
   */
  resolve(id) {
    const [base, via] = String(id).split('~');             // F3: 'ceres~drive' is the Ceres row flown by the long-range drive instead of the lane
    const row = DESTINATIONS.find((d) => d.id === base); if (!row) return null;
    const r = { ...row, id, ...(via ? { via } : {}) };
    if (row.kind === 'port') { const g = () => this.portSite.toWorld(0, DRIVE.gateAltM, 0); r.fixedAt = g; }        // the gate over the pad: the lift pods bring her down from there
    else if (row.kind === 'orbit') r.fixedAt = () => { if (!r._o) { const p = this._shipS(), l = Math.hypot(p.x, p.y, p.z), R = MARS_R + DRIVE.orbitAltM; r._o = { x: p.x / l * R, y: p.y / l * R, z: p.z / l * R }; } return r._o; };
    else if (row.kind === 'moon') {
      const local = makeMoon(row.moon).standoffPoint(STANDOFF_M); r.localGoal = local;
      r.goalLocal = () => { const s = makeMoon(row.moon).standoffPoint(STANDOFF_M); return { x: s.x, y: s.y, z: s.z }; };         // WORLD2: in the world's own frame (the root of its system)
      r.sys = systemOfFrame(row.moon);
      if (r.sys === 'mars') r.fixedAt = (T) => worldPointFixed(row.moon, local, T);          // a moon of Mars moves: the course chases it. A far world (another system) is flown in its own frame, which does not move for the drive (jump.js)
      else r.goalS = () => { const b = makeMoon(row.moon), c = b.centre, s = b.standoffPoint(STANDOFF_M); return { x: c.x + s.x, y: c.y + s.y, z: c.z + s.z }; };
    }
    else if (row.kind === 'station') r.fixedAt = (T) => {            // a point off the station on the side facing Mars, `standoff` metres from its centre
      const c = worldKin(row.station, T).c, k = stationStandoff(worldDef(row.station)), l = Math.hypot(c.x, c.y, c.z) || 1;
      return { x: c.x - c.x / l * k, y: c.y - c.y / l * k, z: c.z - c.z / l * k };
    };
    if (row.kind === 'deep') r.goalS = () => targetAt(row.deep, this.timeS(), this._shipS());      // F3: a world with no ground yet: the drop-out point on the side facing the ship (Mars's turning axes)
    else if (r.fixedAt) r.goalS = () => r.fixedAt(this.timeS()); else if (!r.goalS) r.goalS = null;
    return r;
  }

  /** The nav computer's list, with honest distances and flight times from where the ship is now. */
  destinations() {
    // flying every route to estimate it costs a few milliseconds: keep the answer for a second and a half unless the ship's situation changes
    const f0 = this.ship.flight, key = `${this.frameId}|${Math.round(f0.pos.x / 2000)}|${Math.round(f0.pos.y / 2000)}|${Math.round(f0.pos.z / 2000)}|${f0.power.engines}|${f0.landed}|${Math.round(f0.hull / 10)}`;
    const now = this.engine.timeSec;
    if (this._destCache && this._destCache.key === key && now - this._destCache.at < 1.5) return this._destCache.out;
    const out = this._destinations();
    this._destCache = { key, at: now, out };
    return out;
  }
  _destinations() {
    const f = this.ship.flight, out = [];
    const aMax = DRIVE.thrustN * Math.min(1.8, f.engineFactor) * f.damageFactor / f.massKg;
    const hereSys = systemOfFrame(this.frameId);
    const away = (hereSys === 'mars' ? (() => { const q = this._shipS(); return Math.hypot(q.x, q.y, q.z); })() : Math.hypot(f.pos.x, f.pos.y, f.pos.z)) > LONG.homeM;       // F3: out in deep space
    for (const row of DESTINATIONS) {
      if (row.kind === 'far') { out.push({ id: row.id, name: row.name, blurb: row.blurb, kind: row.kind, ok: false, reason: 'no lane surveyed yet', distM: 0, etaS: 0 }); continue; }
      const destSys = row.kind === 'moon' ? systemOfFrame(row.moon) : 'mars';
      // F3: a world across the lane is offered by the lane (fee, quick) AND by the long-range drive (free, slow on purpose); a world with no lane only by the drive
      const ids = [row.id];
      if (!row.via && destSys !== hereSys) ids.push(row.id + '~drive');
      for (const rid of ids) {
      const r = { id: rid, name: row.name, blurb: row.blurb, kind: row.kind, ok: true, reason: '', distM: 0, etaS: 0 };
      const res = this.resolve(rid);
      if (destSys !== hereSys || row.kind === 'deep' || res.via === 'drive' || away) {
        // WORLD2: across the Ore Lane: climb, drive to the mouth, spool, drive in. F3: or the long-range drive. Each leg is flown to estimate it (SpaceTrip._plan0 does the arithmetic).
        const probe = new SpaceTrip(this, res), pl = probe._plan0(), legs = probe._route(), cr = legs.some((l) => l.cruise), lane = legs.some((l) => l.jump);
        r.etaS = pl.climb + pl.drive + pl.spool + pl.long + pl.drive2 + pl.descent + 40;
        const p = hereSys === 'mars' ? this._shipS() : { x: f.pos.x, y: f.pos.y, z: f.pos.z };
        if (cr) { r.distM = pl.longL; r.route = 'drive'; r.longS = pl.long; r.realTopS = realSeconds(pl.long) + (pl.climb + pl.drive + pl.drive2) / 60 + pl.descent / 8 + 30; r.peakSpeed = pl.longPeak; r.warps = LONG.warps; }      // realTopS: the long drive at the top of its ladder, the main-drive legs at x60, the landing mostly at x1
        else {
          const m2 = mouthPoint(legs[1].sys, legs[1].sys === 'mars' ? null : makeMoon(legs[1].sys));       // WD-MOON: the way home from a far world ends in Mars's region, which has no body record (the list threw from Ceres)
          r.distM = Math.hypot(legs[0].goal.x - p.x, legs[0].goal.y - p.y, legs[0].goal.z - p.z) + Math.hypot(legs[1].goal.x - m2.x, legs[1].goal.y - m2.y, legs[1].goal.z - m2.z);
          r.route = 'lane'; r.crossing = true; r.laneFee = JUMP.feeCredits;
        }
        if (lane && this.ledger.credits < JUMP.feeCredits && !this.o.remoteFee) { r.ok = false; r.reason = `the lane fee is ${JUMP.feeCredits} credits and the account has ${Math.floor(this.ledger.credits)}`; }
        if (cr) { const g = longDriveAllowed(this.ship.def, false); if (!g.ok) { r.ok = false; r.reason = g.msg; } }
        if (!f.canLiftOff() && f.landed) { r.ok = false; r.reason = 'engines too low to lift'; }
        if (r.ok && lane) r.blurb = `${row.blurb} Lane fee ${JUMP.feeCredits} credits.`;
        out.push(r); continue;
      }
      if (hereSys !== 'mars') {       // WD-MOON: a hop inside a lane world's own region (Tranquility to Shackleton): the real trip's own plan, flown in the region's frame
        const probe = new SpaceTrip(this, res), pl = probe._plan0(), legs = probe._route();
        r.etaS = pl.climb + pl.drive + pl.descent + 40;
        r.distM = Math.hypot(legs[0].goal.x - f.pos.x, legs[0].goal.y - f.pos.y, legs[0].goal.z - f.pos.z);
        if (row.kind === 'moon' && this.frameId === row.moon) { r.ok = false; r.reason = 'we are here'; }
        if (!f.canLiftOff() && f.landed) { r.ok = false; r.reason = 'engines too low to lift'; }
        out.push(r); continue;
      }
      // from where? in Mars space or a moon's: take the ship as it is (a ship on the ground starts from the gate, after the climb)
      const p = this._shipS();
      const gate = Math.hypot(p.x, p.y, p.z) - MARS_R < DRIVE.gateAltM && this.frameId === 'mars';
      const start = gate ? this._gatePoint(p) : p;
      const goal = res.goalS({ f: { pos: p } });
      r.distM = Math.hypot(goal.x - start.x, goal.y - start.y, goal.z - start.z);
      const climb = gate ? 240 : (this.onMoon ? 90 : 0), descend = row.kind === 'orbit' || row.kind === 'station' ? 0 : (row.kind === 'port' ? 330 : 70);
      const est = estimateCourse({ dest: res, startFixed: start, T: this.timeS(), nose: { x: f.fwdH.x, y: f.fwdH.y, z: f.fwdH.z }, aMax });
      r.etaS = est.seconds + climb + descend + 40; r.peakSpeed = est.peakSpeed;
      if (row.kind === 'port' && gate && Math.hypot(p.x, p.y, p.z) - MARS_R < 100000) { r.ok = false; r.reason = 'already in Mars airspace'; }
      if (row.kind === 'moon' && this.frameId === row.moon) { r.ok = false; r.reason = 'we are here'; }
      if (!f.canLiftOff() && f.landed) { r.ok = false; r.reason = 'engines too low to lift'; }
      out.push(r);
      }
    }
    return out;
  }

  /** The ship's position in Mars's turning axes (carried out of a moon's frame at this instant). */
  _shipS() { const e = this.engine, f = this.ship.flight; if (e.activeFrame === e.rootFrame) return { x: f.pos.x, y: f.pos.y, z: f.pos.z }; this.updateFrames(); return e.framePoint(e.activeFrame, e.rootFrame, f.pos, {}); }
  _gatePoint(p) { const l = Math.hypot(p.x, p.y, p.z), R = MARS_R + DRIVE.gateAltM; return { x: p.x / l * R, y: p.y / l * R, z: p.z / l * R }; }
  portHeading() { return this.portSite && this.portSite.site ? this.portSite.site.hd * DEG : 0; }

  /** Plot and engage a course. `by` is a crew member's name when the pilot was ordered to. */
  engage(id, o = {}) {
    const ship = this.ship, f = ship.flight;
    if (this.trip && this.trip.active) return { ok: false, msg: 'A course is already under way. Cancel it first.' };
    if (!ship.aboard) return { ok: false, msg: 'Come aboard first: the ship will not lift without you.' };
    const dest = this.resolve(id);
    if (!dest || !dest.goalS) return { ok: false, msg: 'That is out of range: it needs a jump drive the Meridian does not have.' };
    if (f.landed && !f.canLiftOff()) return { ok: false, msg: 'Engine power is too low to lift off. Route more to the engines.' };
    if (f.engineFactor < 0.3) return { ok: false, msg: 'Engine share is too low for the main drive. Route power to the engines (Engineering).' };
    if (this.ship.crew && this.ship.crew.cancelOrder) this.ship.crew.cancelOrder();
    this.ff.suspend('The autopilot has the ship.');          // FREEFLIGHT
    if (dest.kind === 'moon' && systemOfFrame(dest.moon) === systemOfFrame(this.frameId) && dest.via !== 'drive') this.moonWorld(dest.moon);        // build the world now (a moment's hitch at the button, not on arrival); a world across the lane is built behind the jump spool (WORLD2)
    const trip = new SpaceTrip(this, dest, o);
    if (trip._route().some((l) => l.jump) && this.ledger.credits < JUMP.feeCredits) return { ok: false, msg: `The Compact's lane fee is ${JUMP.feeCredits} credits and the account has ${Math.floor(this.ledger.credits)}. Earn it first.` };     // WORLD2: across the lane
    if (trip.usesLong()) { const g = trip._plan(); if (!g.ok) return { ok: false, msg: g.msg }; }          // F3: may this hull use the long-range drive?
    trip.setWarp(1);
    this.trip = trip;
    return { ok: true, msg: `Course set for ${dest.name}.` };
  }

  cancel(msg) {
    if (!this.trip || !this.trip.active) return { ok: false, msg: 'No course to cancel.' };
    return this.trip.cancel(msg);
  }

  setWarp(w) { this.warp = w; if (this.trip) this.trip.setWarp(w); }
  /** FREEFLIGHT: one command from the HUD ({ enabled, assist, target, warp, throttle }). Solo applies it here; the shared world sends it to the authority. */
  ffCommand(o) {
    const ff = this.ff, out = [];
    const run = (r) => { if (!r.ok) this.say(r.msg, true); else if (r.msg) out.push(r.msg); };
    if (typeof o.enabled === 'boolean') { if (o.enabled && this.trip && this.trip.active) this.say('A course is under way. Cancel it first.', true); else run(ff.setEnabled(o.enabled)); }
    if (o.assist !== undefined) run(ff.setAssist(o.assist));
    if (o.target !== undefined) run(ff.setTarget(o.target));
    if (o.warp !== undefined) run(ff.setWarp(Number(o.warp)));
    if (o.throttle !== undefined) run(ff.setThrottle(Number(o.throttle)));
    if (out.length) this.say(out.join(' '), false);
    return { ok: true };
  }
  /** Seconds of flight per real second for the climb and the landing this frame (1 unless a course is compressing them). */
  stickWarp(dt) { const t=this.trip;if(t?.active)return t.stickWarp(dt);
    const f=this.ship.flight;this.eff=landingOrder(this.ship.crew?.activeOrder())?stickWarpCap(this.warp,f.agl,f.verticalSpeed,dt):1;
    return this.eff; }

  /** The ship asks, every frame, before it flies: the trip's stick values (or null). */
  tripControls(dt) {
    const t = this.trip;
    if (!t) return null;
    if (!t.active) {
      if (t.failed) { this.say(t.failed, true, t.by); }
      this.lastTrip = t; this.trip = null; this.ship.flight.override = null; this.ship.flight.climbCap = 12; this.ship.flight.thrustDown = false; if (this.ship.flight.deepHold) installHold(this.ship.flight);
      return null;
    }
    return t.tick(dt);
  }
  /** True while the drive is carrying the ship (the stick does nothing). */
  get driving() { return !!(this.trip && this.trip.phase === 'transit'); }

  say(text, warn = false, by = null) {
    this.log.push({ text, by, at: this.engine.timeSec });
    if (this.ship && this.ship.note) this.ship.note(by ? `${by}: ${text}` : text, warn);
  }

  onLanded(dest, trip) { this.hooks.onArrive(dest.id); this.jobs.onLanded(dest, trip); }
  onHeld(dest, trip) { this.hooks.onArrive(dest.id); }
  onRaiderDown(d) {
    this.hooks.award(BOUNTY_CREDITS, `raider bounty (${d.id})`);
    this.say(`Raider down. Bounty ${BOUNTY_CREDITS} credits.`);
  }

  // =========================================================================
  // PER FRAME
  // =========================================================================
  /** Mars's ground meshes are only worth rebuilding when Mars's ground is anywhere near. */
  get marsTerrain() {
    if (this.frameId !== 'mars') return false;
    const c = this.engine.cameraWorldPos;
    return Math.hypot(c.x, c.y, c.z) - MARS_R < 250_000;
  }

  /** Last thing in the frame: lights and camera are final. */
  late(dt) {
    this._localSun.copy(this.o.sun.position).normalize();
    // the moons: keep their tiers under the camera when it is close
    for (const w of this.worlds.values()) {
      if (!w.built) continue;
      const cam = this._camIn(w, this._cam), r = Math.hypot(cam.x, cam.y, cam.z);
      w._lod(r);
      if (r < w.body.radiusMean * 4) w.update(dt, cam);
      else if (w.active) w.setTiersVisible(false);
    }
    // WORLD2: a far world's own star (def.sky), the lane gates' charge, the flash
    const far = isLaneWorld(this.frameId) && this.worlds.get(this.frameId) && this.worlds.get(this.frameId).body.spec.sky ? this.worlds.get(this.frameId) : null;
    if (far) { if (this._sysCfg !== far) { this.sky.setSystem(this._skyConfig(far.body)); this._sysCfg = far; } }
    else if (this._sysCfg) { this.sky.setSystem(null); this._sysCfg = null; }
    this._laneFx(dt);
    const near = this.activeMoon;
    let up = null;
    if (near) { const cm = this._camIn(near, this._cam), l = Math.hypot(cm.x, cm.y, cm.z) || 1; up = this._moonUp || (this._moonUp = { x: 0, y: 1, z: 0 }); up.x = cm.x / l; up.y = cm.y / l; up.z = cm.z / l; }
    // over a world with its own atmosphere: that sky, not Mars's, fades with height (the camera's height above its mean radius)
    let air = null;
    if (near && near.body.atmosphere) {
      const A = near.body.atmosphere, cm = this._camIn(near, this._cam);
      air = this._air || (this._air = {});
      air.h = Math.hypot(cm.x, cm.y, cm.z) - near.body.radiusMean; air.scaleHeightM = A.scaleHeightM; air.skyColor = A.skyColor; air.horizonColor = A.horizonColor; air.fogDensity = A.fogDensity;
    }
    // the Sun's fill on the moons seen from afar: on when the key light is down at the camera, off in Mars's own shadow and on a moon's own ground
    if (this.skyMode !== 'fixed') {
      const st = this.sky.state, sr = this.engine.frameDir(this.engine.activeFrame, this.engine.rootFrame, this.sunLocal, this._sr || (this._sr = {}));
      for (const w of this.worlds.values()) {
        if (!w.built || !w.sunFill) continue;
        const k = w.frame.origin, along = k.x * sr.x + k.y * sr.y + k.z * sr.z;
        let lit = 1; if (along < 0) { const mx = k.x - along * sr.x, my = k.y - along * sr.y, mz = k.z - along * sr.z, d = Math.hypot(mx, my, mz) / MARS_R; lit = Math.min(1, Math.max(0, (d - 0.985) / 0.03)); }
        w.sunFill.dir.value.copy(this.sunLocal); w.sunFill.k.value = w === near ? 0 : 2.4 * (1 - st.vis) * lit;
      }
    }
    this.sky.update(dt, this._localSun, { marsShine: near && near.body.worldKind === 'moon' ? 1 : 0, up, air, sun: this.sunLocal, T: this.T ?? this.timeS(), live: this.skyMode !== 'fixed', frame: this.engine.activeFrame, body: near ? near.body : null });
    if (this.o.ship && this.o.ship.ready) this.sky.scaleEnvironment(this.o.ship.matsExt);
    this.jobs.update(dt);
    if (this.ui) this.ui.update(dt);
    if (this.ffUI) this.ffUI.update(dt);          // FREEFLIGHT
  }

  /** WORLD2: the gate rings charge while the coils spool; the screen goes white at the jump and clears after. */
  _laneFx(dt) {
    const t = this.trip, spooling = !!(t && t.active && t.phase === 'spool');
    const charge = spooling ? Math.min(1, t.spoolT / JUMP.spoolS) : 0;
    if (spooling && !this._prep && t.legs && t.legs[1]) { this._prep = true; try { this.prepareWorld(rootFrameOf(t.legs[1].sys)); } catch (e) { console.error('prepare world', e); } }   // (the shared world's mirrored trip builds the far world here too)
    if (!spooling) this._prep = false;
    const gates = [this.gate, ...[...this.worlds.values()].map((w) => w.gate)].filter(Boolean);
    for (const g of gates) g.update(dt, charge, this.engine.timeSec);
    this.flash = Math.max(0, this.flash - dt / 1.6);
    const ramp = spooling ? Math.max(0, (t.spoolT - (JUMP.spoolS - 2.2)) / 2.2) : 0;
    if (this._flashEl) { const v = Math.max(this.flash, ramp * ramp); if (v !== this._flashV) { this._flashV = v; this._flashEl.style.opacity = String(Math.min(1, v)); } }
  }

  /** What the HUD adds. */
  hudLines() {
    const f = this.ship.flight, t = this.trip, out = [];
    const ffl = ffHudLines(this.ff); if (ffl) out.push(ffl);        // FREEFLIGHT
    if (this.skyMode !== 'fixed' && !this.onMoon) {                  // Mars time where the ship is, and the Sun's height: the sol is real (24 h 39.6 min)
      const c = this.engine.cameraWorldPos, r = Math.hypot(c.x, c.y, c.z) || 1;
      if (r - MARS_R < 150_000) { const q = sunAt(Math.asin(c.y / r) * 180 / Math.PI, Math.atan2(-c.z, c.x) * 180 / Math.PI, this.timeS()), hh = Math.floor(q.hours), mm = Math.floor((q.hours - hh) * 60); out.push(`<span class="dim">Local time ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · Sun ${q.elevDeg >= 0 ? q.elevDeg.toFixed(0) + '° up' : 'down'}</span>`); }
    }
    if (this.onMoon) { const m = this.activeMoon, g = m.body.surfaceGravity; out.push(`<span class="dim">${m.body.name} · gravity ${g >= 0.5 ? g.toFixed(2) + ' m/s²' : (g * 1000).toFixed(2) + ' mm/s²'}</span>`); }
    if (t && t.active) {
      const p = t.progress, ph = t.phases(), now = ph.find((q) => q.state === 'now');
      if (t.phase === 'transit') out.push(`<span class="load">DRIVE · ${(p.speed / 1000).toFixed(2)} km/s · ${fmtKmSpace(p.distM)} to go${t.warp > 1 ? ` · ×${t.warp}` : ''}</span>`);
      else if (t.phase === 'longdrive' && p.long) out.push(`<span class="load">LONG DRIVE · ${(p.speed / 1000).toFixed(0)} km/s · ${fmtAU(p.distM)} to go · day ${(p.long.tau / 86400).toFixed(1)} of ${(p.long.T / 86400).toFixed(1)}${t.eff > 1 ? ` · ×${t.eff}` : ''}</span>`);
      else if (t.phase === 'spool') out.push(`<span class="load">JUMP COILS · ${Math.max(0, JUMP.spoolS - t.spoolT).toFixed(0)} s</span>`);
      else out.push(`<span class="dim">${t.phase} · ${t.dest.name}${t.eff > 1 ? ` · ×${t.eff}` : ''}</span>`);
      out.push(`<span class="dim">${now ? `${now.name}: ${fmtDuration(t.wallS(now))} left` : ''} · whole trip ${fmtDuration(ph.reduce((a, q) => a + t.wallS(q), 0))}</span>`);
    }
    return out.join('<br>');
  }
}

import { fmtAU } from './longRange.js';
export const fmtKmSpace = (m) => (m >= 1e6 ? `${(m / 1000).toFixed(0)} km` : m >= 1e4 ? `${(m / 1000).toFixed(0)} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
