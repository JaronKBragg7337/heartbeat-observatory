// ============================================================================
// server/fleet.mjs - the raiders of the shared world, and what happens between them and the players' ships.
//
// OWNS: spawning raiders at their stations, running their brains, their escort wings and their guns every tick, the damage that passes
//       between them and the players' ships (both ways), and the two ways a player takes one: claim (abandoned) and capture (disabled).
// DOES NOT OWN: how a raider flies or fights (src/ships/raider/brain.js, escorts.js), what it is (src/ships/raider/), the ship records
//       themselves (server/authority.mjs holds state.ships; a raider is a ship record with `type: 'raider'` and an `npc` mind).
//
// WHY THE DAMAGE GOES THROUGH PROXIES. A GunSystem hits the targets on its own list: spheres with hit points. The players' guns know
// nothing of a raider, and a raider's guns know nothing of a player's ship, so each tick every GunSystem is given a sphere for each ship
// it could hit (hit points a million), and after the step whatever was taken off a sphere is handed to the real thing as damage:
// ShipBody.takeHit for a ship, EscortWing.hit for an escort. One rule for bolts, no second kind.
// ============================================================================

import { MOONS } from '../src/space/spaceSpec.js';
import { BOUNTY_CREDITS } from '../src/space/spaceSpec.js';
import { RaiderBrain, newNpcRecord } from '../src/ships/raider/brain.js';
import { EscortWing } from '../src/ships/raider/escorts.js';
import { raiderCrew } from '../src/ships/raider/crew.js';
import { FLEET_PLAN, RESPAWN_S, ABANDONED_CAP, DISABLE_BOUNTY_CREDITS, STATIONS, RAIDER_NAMES, LOOT_CREDITS, CLAIM_REACH_M, FIGHT } from '../src/ships/raider/stats.js';
import { shipDef } from '../src/ships/registry.js';
import { initialEconomy } from '../src/economy/economy.js';

const HP = 1e6;
const SENSE_FOR_PROXY_M = 3600;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export class FleetDirector {
  constructor(authority) {
    this.a = authority;
    this.centres = new Map();
  }

  get state() { return this.a.state; }
  fleetState() { const s = this.state; return s.fleet || (s.fleet = { seq: 0, nextAt: {}, derelicts: {} }); }
  npcSims() { return [...this.a.sims.values()].filter((s) => s.record.npc); }
  playerSims() { return [...this.a.sims.values()].filter((s) => !s.record.npc); }

  // -------------------------------------------------------------------------
  // STATIONS: where a raider waits. A station is a point in a frame, a ring to circle it on, and a height above the ground.
  // -------------------------------------------------------------------------
  stationFrame(id) {
    if (this.centres.has(id)) return this.centres.get(id);
    const S = STATIONS.find((q) => q.id === id);
    if (!S) throw new Error(`Unknown station: ${id}`);
    let centre;
    if (S.frame === 'mars') {
      centre = this.a.site.toWorld(Math.cos(S.bearing) * S.ring * 0.8, S.agl, Math.sin(S.bearing) * S.ring * 0.8);
    } else {
      // over the moon: a point well clear of its biggest semi-axis, so the first thing the ship's radar reads is open space
      const M = MOONS[S.frame], R = Math.max(M.axes.a, M.axes.b, M.axes.c) + S.agl + 300;
      const d = [Math.cos(S.bearing) * 0.94, 0.34, Math.sin(S.bearing) * 0.94], l = Math.hypot(...d);
      centre = { x: d[0] / l * R, y: d[1] / l * R, z: d[2] / l * R };
    }
    const out = { frame: S.frame, centre, ring: S.ring, agl: S.agl, id };
    this.centres.set(id, out);
    return out;
  }

  // -------------------------------------------------------------------------
  // Bring a ship record's simulation up as a raider: brain, escort wing, proxy table.
  // -------------------------------------------------------------------------
  attach(sim) {
    const rec = sim.record;
    if (!rec.npc) return;
    const def = shipDef(rec.type), seq = rec.npc.seq;
    sim.rand = mulberry(0xA5A5 + seq * 7919);
    sim.brain = new RaiderBrain({ flight: sim.flight, guns: sim.guns, record: rec, rand: sim.rand });
    sim.wing = new EscortWing(rec.id, def.stats.escorts);
    sim.wing.load(rec.npc.escorts);
    sim.proxies = new Map();
  }

  /** Persist what lives outside the flight record: the escorts. (The simulation's capture() does the rest.) */
  capture(sim) {
    if (sim.record.npc && sim.wing) sim.record.npc.escorts = sim.wing.save();
  }

  // -------------------------------------------------------------------------
  // SPAWNING
  // -------------------------------------------------------------------------
  /** A new raider record: four people aboard, a name, a hold with something in it. Not yet placed. */
  newRecord(station, state = 'patrol') {
    const f = this.fleetState(), seq = ++f.seq;
    const name = RAIDER_NAMES[seq % RAIDER_NAMES.length] + (seq > RAIDER_NAMES.length ? ' ' + Math.ceil(seq / RAIDER_NAMES.length) : '');
    const S = this.stationFrame(station);
    const def = shipDef('raider');
    const crew = state === 'abandoned' ? [] : raiderCrew(seq).map((c) => ({ ...c, seatPose: { ...def.seats.find((s) => s.id === def.crewPosts.find((r) => r.id === c.role).seat) } }));
    return {
      id: `fleet-raider-${seq}`, owner: null, type: 'raider', pad: null, crewMayBoard: false, crew,
      hold: {}, holdLots: [], jobs: { taken: [], samples: [], salvaged: false },
      economy: { ...initialEconomy(), marks: 0 }, frameId: S.frame, pose: null, trip: null,
      npc: newNpcRecord({ name, seq, station, state, phase: (seq * 2.399) % (Math.PI * 2), lootCredits: LOOT_CREDITS[seq % LOOT_CREDITS.length], spawnedAt: this.state.clock }),
    };
  }

  /** Put a raider at its station, flying: on the ring, nose along it, escorts in formation (or, for a derelict, adrift and cold). */
  place(sim) {
    const rec = sim.record, S = this.stationFrame(rec.npc.station), f = sim.flight;
    const ang = rec.npc.phase;
    // a point on the ring, in the tangent plane at the station centre
    const l = Math.hypot(S.centre.x, S.centre.y, S.centre.z), up = { x: S.centre.x / l, y: S.centre.y / l, z: S.centre.z / l };
    const ref = Math.abs(up.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    let ex = up.y * ref.z - up.z * ref.y, ey = up.z * ref.x - up.x * ref.z, ez = up.x * ref.y - up.y * ref.x;
    const el = Math.hypot(ex, ey, ez); ex /= el; ey /= el; ez /= el;
    const nx = up.y * ez - up.z * ey, ny = up.z * ex - up.x * ez, nz = up.x * ey - up.y * ex;
    const R = rec.npc.state === 'abandoned' ? S.ring * 0.45 : S.ring;
    f.pos = { x: S.centre.x + (ex * Math.sin(ang) + nx * Math.cos(ang)) * R, y: S.centre.y + (ey * Math.sin(ang) + ny * Math.cos(ang)) * R, z: S.centre.z + (ez * Math.sin(ang) + nz * Math.cos(ang)) * R };
    f.vel = { x: 0, y: 0, z: 0 };
    f.refreshOrientation();
    // heading along the ring (clockwise from north, in this ship's own frame)
    const fr = f._frame, tx = ex * Math.cos(ang) - nx * Math.sin(ang), ty = ey * Math.cos(ang) - ny * Math.sin(ang), tz = ez * Math.cos(ang) - nz * Math.sin(ang);
    f.heading = Math.atan2(tx * fr.east.x + ty * fr.east.y + tz * fr.east.z, tx * fr.north.x + ty * fr.north.y + tz * fr.north.z);
    f.landed = false; f.airborne = true; f.autoHover = true; f.gearPos = 0;
    f.hull = rec.npc.state === 'abandoned' ? 38 : 100;
    f.shield = rec.npc.state === 'abandoned' ? 0 : f.shieldMax;
    f.refreshOrientation();
    if (sim.wing) sim.wing.gather(f);
    sim.capture(); this.capture(sim);
  }

  /** Make sure the world has the raiders it should: called when the world loads and as time passes. */
  ensure() {
    const f = this.fleetState(), clock = this.state.clock;
    for (const slot of FLEET_PLAN) {
      const here = this.npcSims().filter((s) => s.record.npc.station === slot.station);
      const live = here.filter((s) => ['patrol', 'engage', 'return'].includes(s.record.npc.state)).length;
      if (live < slot.raiders) {
        if (f.nextAt[slot.station] === undefined) f.nextAt[slot.station] = clock;           // first time: now
        if (clock >= f.nextAt[slot.station]) { this.spawn(slot.station, 'patrol'); f.nextAt[slot.station] = clock + RESPAWN_S; }
      } else if (f.nextAt[slot.station] === undefined || live >= slot.raiders) f.nextAt[slot.station] = clock + RESPAWN_S;
      const left = (f.derelicts[slot.station] || 0);
      if (left < slot.derelicts) { this.spawn(slot.station, 'abandoned'); f.derelicts[slot.station] = left + 1; }
    }
    // the world keeps a few abandoned hulls, not a junkyard
    const dead = this.npcSims().filter((s) => s.record.npc.state === 'abandoned').sort((a, b) => a.record.npc.spawnedAt - b.record.npc.spawnedAt);
    while (dead.length > ABANDONED_CAP) this.despawn(dead.shift());
  }

  spawn(station, state) {
    const rec = this.newRecord(station, state);
    this.state.ships[rec.id] = rec;
    const sim = this.a.makeSim(rec);
    this.a.sims.set(rec.id, sim);
    this.place(sim);
    return sim;
  }

  despawn(sim) { this.a.sims.delete(sim.record.id); delete this.state.ships[sim.record.id]; }

  // -------------------------------------------------------------------------
  // PROXIES
  // -------------------------------------------------------------------------
  _sync(guns, table, items) {
    const keep = new Set(items.map((i) => i.key));
    for (const [k, p] of table) if (!keep.has(k)) { const ix = guns.targets.indexOf(p); if (ix >= 0) guns.targets.splice(ix, 1); table.delete(k); }
    for (const it of items) {
      let p = table.get(it.key);
      if (!p) { p = guns.addTarget({ id: 'fleet:' + it.key, pos: it.pos, radius: it.radius, hp: HP, maxHp: HP }); table.set(it.key, p); }
      p.pos = it.pos; p.radius = it.radius; p.hp = HP; p.inactive = false; p.ref = it.ref;
    }
  }
  _harvest(table, who) {
    for (const p of table.values()) {
      const dmg = HP - p.hp;
      if (dmg <= 1e-6) continue;
      p.hp = HP;
      const r = p.ref;
      if (r.type === 'ship') r.sim.flight.takeHit(dmg);
      else if (r.type === 'hull') {
        r.sim.flight.takeHit(dmg);
        if (who) r.sim.record.npc.lastHitBy = who.record.id;
      } else if (r.type === 'escort') {
        if (r.sim.wing.hit(r.d, dmg) && who) who.record.economy.marks += BOUNTY_CREDITS * 4;
      }
    }
  }
  /** Is a player's ship somewhere a raider may shoot it: someone aboard, in the air, outside neutral airspace, and not on a drive transit? */
  hostile(sim) {
    const f = sim.flight;
    if (f.landed || f.hull <= 0 || sim.drones.neutral || sim.drones.suspended) return false;
    return Object.values(this.state.players).some((p) => p.aboardShipId === sim.record.id);
  }

  /**
   * What a hired gunner on a player's ship can shoot at: the raiders and escorts in reach, in the shape GunnerAI reads (the old drones'). A raider
   * that has surrendered or been abandoned is not a target: the guns that disabled it are not to finish it, and the player may want it whole.
   */
  sightsFor(sim) {
    const out = [];
    for (const R of this.npcSims()) {
      if (R.frameId !== sim.frameId || dist(R.flight.pos, sim.flight.pos) > 2500) continue;
      const st = R.record.npc.state;
      if (st === 'disabled' || st === 'abandoned') continue;
      out.push({ state: 'attack', pos: R.flight.pos, vel: R.flight.vel, target: { hp: R.flight.hull > 0 ? 1 : 0, inactive: false } });
      if (R.wing) for (const d of R.wing.drones) if (d.state !== 'dead' && d.state !== 'away') out.push({ state: d.state === 'form' ? 'inbound' : d.state, pos: d.pos, vel: d.vel, target: { hp: d.hp, inactive: false } });
    }
    return { neutral: !!(sim.drones.neutral || sim.drones.suspended), drones: out };
  }

  /** Before a player's ship steps: give its guns a sphere for every raider (and escort) in reach. */
  preStep(sim) {
    const table = sim.fleetProxies || (sim.fleetProxies = new Map());
    const items = [];
    for (const R of this.npcSims()) {
      if (R.frameId !== sim.frameId || R.record.id === sim.record.id) continue;
      if (dist(R.flight.pos, sim.flight.pos) > SENSE_FOR_PROXY_M) continue;
      const env = R.def.hull.combat;
      items.push({ key: 'hull:' + R.record.id, pos: R.flight.toWorld(env.centre, {}), radius: env.radius, ref: { type: 'hull', sim: R } });
      if (R.wing) for (const d of R.wing.drones) if (d.state !== 'dead' && d.state !== 'away') items.push({ key: 'escort:' + d.id, pos: d.pos, radius: 3.2, ref: { type: 'escort', sim: R, d } });
    }
    this._sync(sim.guns, table, items);
  }
  postStep(sim) { if (sim.fleetProxies) this._harvest(sim.fleetProxies, sim); }

  // -------------------------------------------------------------------------
  // THE TICK
  // -------------------------------------------------------------------------
  stepRaiders(dt) {
    const players = this.playerSims();
    for (const R of this.npcSims()) {
      if (!R.brain) this.attach(R);
      const npc = R.record.npc, S = this.stationFrame(npc.station);
      // targets: the player ships in this frame (those outside neutral airspace are fair game)
      const targets = players.filter((s) => s.frameId === R.frameId).map((s) => ({ id: s.record.id, flight: s.flight, hostile: this.hostile(s), sim: s }));
      const before = npc.state;
      const ctl = R.brain.think(dt, { station: S, targets });
      // its guns' spheres: the hostile ships near it
      const near = targets.filter((t) => t.hostile && dist(t.flight.pos, R.flight.pos) < SENSE_FOR_PROXY_M);
      this._sync(R.guns, R.proxies, near.map((t) => { const env = t.sim.def.hull.combat; return { key: 'ship:' + t.id, pos: t.flight.toWorld(env.centre, {}), radius: env.radius, ref: { type: 'ship', sim: t.sim } }; }));
      R.step(dt, ctl);
      this._harvest(R.proxies, null);
      // escorts
      const tgt = npc.targetId ? targets.find((t) => t.id === npc.targetId && t.hostile) : null;
      R.wing.update(dt, R.flight, tgt ? tgt.flight : null, near.map((t) => t.flight), (x, y, z) => R.flight.ground(x, y, z), R.brain.live);
      R.wing.drain(); R.guns.drain(); R.brain.drain();
      // a raider that has just gone down: pay the guns that did it
      if (before !== npc.state && npc.state === 'disabled' && npc.lastHitBy) {
        const killer = this.a.sims.get(npc.lastHitBy);
        if (killer && !killer.record.npc) killer.record.economy.marks += DISABLE_BOUNTY_CREDITS * 4;
      }
      if (before !== npc.state && npc.state === 'abandoned') R.record.crew = [];
    }
  }

  // -------------------------------------------------------------------------
  // CLAIM AND CAPTURE
  // -------------------------------------------------------------------------
  /** A raider that is disabled (crew surrendered) or abandoned (nobody aboard) is within reach of this player's ship. Returns the record or throws. */
  claimable(p, shipId) {
    const rec = this.state.ships[shipId], R = this.a.sims.get(shipId);
    if (!rec || !rec.npc || !R) throw Error('There is nothing there to claim.');
    if (rec.npc.state === 'patrol' || rec.npc.state === 'engage' || rec.npc.state === 'return') throw Error('It is still fighting. Disable it first.');
    if (!p.aboardShipId) throw Error('Fly up to it in your own ship first.');
    const mine = this.a.sims.get(p.aboardShipId);
    if (!mine || mine.frameId !== R.frameId || dist(mine.flight.pos, R.flight.pos) > CLAIM_REACH_M) throw Error(`Bring your ship within ${CLAIM_REACH_M} m of it.`);
    return rec;
  }
}
