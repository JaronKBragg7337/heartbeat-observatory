// ============================================================================
// spaceSystem.js — space travel as one system: the sky, the moons, frames, the drive, the jobs.
//
// OWNS: which frame is active (Mars, Phobos, Deimos) and the switch between them, the moons' worlds, the destination list and
//       the trip in progress, the sky update, and the small hooks other systems read (see HOOKS below).
// DOES NOT OWN: money (the economy builder's src/economy and src/port: this only calls the hooks), the ship's physics (it
//       asks shipFlight.js for an override), the moons' ground (moonField.js / moonWorld.js).
//
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
import { SpaceTrip, fmtDuration, MARS_R } from './spaceTrip.js';
import { estimateTrip } from './transit.js';
import { DESTINATIONS, DRIVE, MOONS, STANDOFF_M, BOUNTY_CREDITS, moonCentre } from './spaceSpec.js';
import { MoonWorld } from './moonWorld.js';
import { makeMoon } from './moonField.js';
import { makeTools } from '../player/digging.js';
import { SpaceJobs } from './jobs.js';
import { SpaceUI } from './spaceUI.js';

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
    this.worlds = new Map();
    this.trip = null; this.lastTrip = null;
    this.warp = 1;
    this.log = [];
    this._cam = {}; this._tmp = {};

    // what the walker and digger were on Mars: kept so the switch back is exact
    const w = o.walker, d = o.digger;
    this.marsSaved = { groundSampler: w.groundSampler, collisionActive: w.collisionActive, jumpSpeed: w.jumpSpeed,
      body: d.body, edits: d.edits, tools: d.tools, toolIdx: d.toolIdx };
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
    this.ui = typeof document !== 'undefined' ? new SpaceUI(this) : null;

    // the moons: Phobos after a moment (it is in the sky from the start); Deimos is built when a course to it is engaged.
    this._built = false;
    if (typeof window !== 'undefined') {
      const build = () => { try { this.moonWorld('phobos').setVisible(true); } catch (e) { console.error('Phobos failed to build', e); } };
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

  moonWorld(id) {
    let w = this.worlds.get(id);
    if (!w) { w = new MoonWorld({ engine: this.engine, id, tier: this.tier }); this.worlds.set(id, w); w.build(); w.setVisible(true); }
    else if (!w.built) w.build();
    return w;
  }

  /** Make `id` ('mars', 'phobos', 'deimos') the active frame: everything that rides with the player is re-expressed. */
  setFrame(id) {
    const e = this.engine;
    const to = id === 'mars' ? e.rootFrame : this.moonWorld(id).frame, from = e.activeFrame;
    if (to === from) return;
    const d = e.frameShift(from, to), sh = (p) => { if (p) { p.x += d.x; p.y += d.y; p.z += d.z; } };
    const ship = this.ship, f = ship.flight, w = this.walker, dg = this.digger;
    sh(f.pos); sh(w.worldPos);
    if (ship.drones) { for (const dr of ship.drones.drones) { sh(dr.pos); sh(dr.anchor); } for (const b of ship.drones.shots) { sh(b); b.px += d.x; b.py += d.y; b.pz += d.z; } }
    for (const b of ship.guns.bolts) { b.x += d.x; b.y += d.y; b.z += d.z; b.px += d.x; b.py += d.y; b.pz += d.z; }
    e.setActiveFrame(to);

    if (id === 'mars') {
      const s = this.marsSaved;
      ship.body = f.body = w.body = this.marsBody;
      this.setGround(null);
      w.groundSampler = s.groundSampler; w.collisionActive = s.collisionActive; w.jumpSpeed = s.jumpSpeed;
      dg.body = s.body; dg.edits = s.edits; dg.tools = s.tools; dg.toolIdx = s.toolIdx;
    } else {
      const mw = this.moonWorld(id), b = mw.body;
      ship.body = f.body = w.body = b;
      this.setGround(mw.shipGround());
      w.groundSampler = mw.groundSampler(); w.collisionActive = mw.collisionActive();
      w.jumpSpeed = 0.6;                              // a hop: Phobos's gravity is 0.0056 m/s2, a 3 m/s jump is a 15-minute flight
      dg.body = b; dg.edits = mw.edits;
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

  /** In the moon's local metres: where the camera is. */
  _camIn(world, out) { return this.engine.cameraIn(world.frame, out); }

  // =========================================================================
  // DESTINATIONS AND TRIPS
  // =========================================================================
  /** Resolve a destination row into something a trip can fly to. */
  resolve(id) {
    const row = DESTINATIONS.find((d) => d.id === id); if (!row) return null;
    const sys = this;
    const r = { ...row };
    if (row.kind === 'port') r.goalS = () => this.portSite.toWorld(0, DRIVE.gateAltM, 0);        // the gate over the pad: the lift pods bring her down from there
    else if (row.kind === 'orbit') r.goalS = (trip) => { const p = trip.f.pos, l = Math.hypot(p.x, p.y, p.z); const R = MARS_R + DRIVE.orbitAltM; return { x: p.x / l * R, y: p.y / l * R, z: p.z / l * R }; };
    else if (row.kind === 'moon') r.goalS = () => { const b = makeMoon(row.moon), c = b.centre, s = b.standoffPoint(STANDOFF_M); return { x: c.x + s.x, y: c.y + s.y, z: c.z + s.z }; };
    else r.goalS = null;
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
    for (const row of DESTINATIONS) {
      const r = { id: row.id, name: row.name, blurb: row.blurb, kind: row.kind, ok: true, reason: '', distM: 0, etaS: 0 };
      if (row.kind === 'far') { r.ok = false; r.reason = 'out of range: needs a jump drive'; out.push(r); continue; }
      const res = this.resolve(row.id);
      // from where? in Mars space or a moon's: take the ship as it is (a ship on the ground starts from the gate, after the climb)
      const p = this._shipS();
      const gate = Math.hypot(p.x, p.y, p.z) - MARS_R < DRIVE.gateAltM && this.frameId === 'mars';
      const start = gate ? this._gatePoint(p) : p;
      const goal = res.goalS({ f: { pos: p } });
      r.distM = Math.hypot(goal.x - start.x, goal.y - start.y, goal.z - start.z);
      const climb = gate ? 240 : (this.onMoon ? 90 : 0), descend = row.kind === 'orbit' ? 0 : (row.kind === 'port' ? 330 : 70);
      const est = estimateTrip({ pos: start, vel: { x: 0, y: 0, z: 0 }, nose: { x: f.fwdH.x, y: f.fwdH.y, z: f.fwdH.z }, up: { x: 0, y: 1, z: 0 }, goal, aMax, vMax: DRIVE.vMaxMs, turnRate: DRIVE.turnRate });
      r.etaS = est.seconds + climb + descend + 40; r.peakSpeed = est.peakSpeed;
      if (row.kind === 'port' && gate && Math.hypot(p.x, p.y, p.z) - MARS_R < 100000) { r.ok = false; r.reason = 'already in Mars airspace'; }
      if (row.kind === 'moon' && this.frameId === row.moon) { r.ok = false; r.reason = 'we are here'; }
      if (!f.canLiftOff() && f.landed) { r.ok = false; r.reason = 'engines too low to lift'; }
      out.push(r);
    }
    return out;
  }

  _shipS() { const e = this.engine, f = this.ship.flight; const d = e.frameShift(e.activeFrame, e.rootFrame); return { x: f.pos.x + d.x, y: f.pos.y + d.y, z: f.pos.z + d.z }; }
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
    if (dest.kind === 'moon') this.moonWorld(dest.moon);        // build the world now (a moment's hitch at the button, not on arrival)
    const trip = new SpaceTrip(this, dest, o);
    trip.setWarp(1);
    this.trip = trip;
    return { ok: true, msg: `Course set for ${dest.name}.` };
  }

  cancel(msg) {
    if (!this.trip || !this.trip.active) return { ok: false, msg: 'No course to cancel.' };
    return this.trip.cancel(msg);
  }

  setWarp(w) { this.warp = w; if (this.trip) this.trip.setWarp(w); }

  /** The ship asks, every frame, before it flies: the trip's stick values (or null). */
  tripControls(dt) {
    const t = this.trip;
    if (!t) return null;
    if (!t.active) {
      if (t.failed) { this.say(t.failed, true, t.by); }
      this.lastTrip = t; this.trip = null; this.ship.flight.override = null; this.ship.flight.climbCap = 12; this.ship.flight.thrustDown = false;
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
    const near = this.activeMoon;
    this.sky.update(dt, this._localSun, { marsShine: near ? 1 : 0 });
    if (this.o.ship && this.o.ship.ready) this.sky.scaleEnvironment(this.o.ship.matsExt);
    this.jobs.update(dt);
    if (this.ui) this.ui.update(dt);
  }

  /** What the HUD adds. */
  hudLines() {
    const f = this.ship.flight, t = this.trip, out = [];
    if (this.onMoon) { const m = this.activeMoon; out.push(`<span class="dim">${m.body.name} · gravity ${(m.body.surfaceGravity * 1000).toFixed(2)} mm/s²</span>`); }
    if (t && t.active) {
      const p = t.progress;
      if (t.phase === 'transit') out.push(`<span class="load">DRIVE · ${(p.speed / 1000).toFixed(2)} km/s · ${fmtKmSpace(p.distM)} to go · ${fmtDuration(p.etaS / Math.max(1, t.warp))}${t.warp > 1 ? ` · ×${t.warp}` : ''}</span>`);
      else out.push(`<span class="dim">${t.phase} · ${t.dest.name}</span>`);
    }
    return out.join('<br>');
  }
}

export const fmtKmSpace = (m) => (m >= 1e6 ? `${(m / 1000).toFixed(0)} km` : m >= 1e4 ? `${(m / 1000).toFixed(0)} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
