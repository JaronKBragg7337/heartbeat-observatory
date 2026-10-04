// Private, resumable opening (version 2: the liner, the port, the board, the Kestrel, the wreck). The same rules run locally and on the authority.
// The beats and timings are in script.js, the words in dialogue.js, the choices in worlds.js, the season's crash cause in season.js.
import { getBody } from '../world/bodies.js';
import { createPortSite } from '../port/portSpec.js';
import { MATERIALS, attachEdits, density, detachBodyEdits } from '../world/field.js';
import { EditStore } from '../world/edits.js';
import { Walker } from '../player/walker.js';
import { Digger } from '../player/digging.js';
import { shipDef } from '../ships/registry.js';
import { STAGE, OPENING_VERSION, RIDE_SECONDS, CONTACT_SECONDS, LINER_SECONDS, KESTREL_SECONDS, LINER_PHASE, LINER, KESTREL,
  linerExit, gangwayEndX, kestrelGate, PORT_BOUNDS, LOCKER, CRATE } from './script.js';
import { startWorld, validChoice, worldFacts } from './worlds.js';
import { currentSeason } from './season.js';

export { STAGE, OPENING_VERSION, RIDE_SECONDS, CONTACT_SECONDS, LINER_SECONDS, KESTREL_SECONDS };
/** Kept for callers that still read it: the liner is the opening's first stage and its length is LINER_SECONDS. */
export const OPENING_SECONDS = LINER_SECONDS;

const LINER_DEF = () => shipDef(LINER.type), KESTREL_DEF = () => shipDef(KESTREL.type);

/** Where the player wakes: in the observation lounge, beside the sofas, facing the panoramic window (Ares ship-local metres, yaw radians). */
export const LINER_WAKE = { x: 4.6, y: 0, z: 4.0, yaw: Math.PI / 2, pitch: 0 };
export const KESTREL_BOARD = { x: 9.0, y: 0, z: 8.4, yaw: -Math.PI / 2, pitch: 0 };

export function freshOpening(o = {}) {
  const seed = typeof o === 'number' ? o : (o.seed ?? Math.random());
  const season = o.season || currentSeason(o.now ?? Date.now());
  return { version: OPENING_VERSION, stage: STAGE.LINER, elapsed: 0, clock: 0, seed, season,
    pose: { ...LINER_WAKE }, cuts: [], dest: null, driver: null, carriedCrate: false, lockerOpened: false,
    ride: false, rideSeconds: 0, contactSeconds: 0, walked: 0, complete: false };
}
/** A saved opening of an older version is not resumed (the beats changed): the player starts the new one. */
export function needsOpening(state, savedRecord) {
  if (state?.version === OPENING_VERSION) return !state.complete;
  return !savedRecord;
}

// ---- the two ground kits: the port (flat, true to the port's frame) and the wreck site (the old private desert) ----------
function frameKit(mars, origin, frame) {
  const toLocal = (p) => { const d = { x: p.x - origin.x, y: p.y - origin.y, z: p.z - origin.z };
    return Object.fromEntries([['x', frame.right], ['y', frame.up], ['z', frame.back]].map(([k, v]) => [k, d.x * v.x + d.y * v.y + d.z * v.z])); };
  const toWorld = (x, y, z) => Object.fromEntries(['x', 'y', 'z'].map((k) => [k, origin[k] + frame.right[k] * x + frame.up[k] * y + frame.back[k] * z]));
  return { toLocal, toWorld };
}
function bodyOver(mars, id, origin, frame, height, gravity) {
  const { toLocal } = frameKit(mars, origin, frame);
  const b = { ...mars, id, baseField: (x, y, z) => { const p = toLocal({ x, y, z }); return p.y - height(p.x, p.z); }, materialField: () => MATERIALS.regolith };
  if (gravity) b.surfaceGravity = gravity;
  b.surfaceRadius = (x, y, z) => { const dot = x * frame.up.x + y * frame.up.y + z * frame.up.z;
    let r = (origin.x * frame.up.x + origin.y * frame.up.y + origin.z * frame.up.z) / dot;
    for (let i = 0; i < 3; i++) { const p = toLocal({ x: x * r, y: y * r, z: z * r }); r += (height(p.x, p.z) - p.y) / dot; }
    return r; };
  return b;
}
/** The wreck site: the old desert 2.6 km from the port, with a gravity of the destination world. */
export function openingBody(id = 'solo', gravity = 0) {
  const mars = getBody('mars'), port = createPortSite(mars), origin = port.toWorld(2600, 0, 350);
  const frame = { right: port.right, up: port.up, back: port.back };
  const { toLocal, toWorld } = frameKit(mars, origin, frame);
  const height = (x, z) => {
    const distance = Math.min(Math.hypot(x, z), Math.hypot(x + 2600, z + 350));
    const t = Math.max(0, Math.min(1, (distance - 80) / 450)), blend = t * t * (3 - 2 * t);
    return .035 * Math.sin(x * .28) * Math.sin(z * .2) + .54 * Math.exp(-((x - 4) ** 2 + (z - 20) ** 2) / 1.3)
      + blend * (9 * Math.sin(x * .0023 + 2) * Math.sin(z * .0042) + 5 * Math.sin(x * .006 + z * .003));
  };
  return { body: bodyOver(mars, 'opening-' + id, origin, frame, height, gravity), origin, frame, toWorld, toLocal, height, port };
}
/**
 * The port stage: the port's own frame (x right, y up, z back, origin the port's centre), flat ground a kilometre round (the port is graded
 * flat), the real Mars gravity. The port art is the port's own, seen at its true place; this body only gives the walker something flat to stand on.
 */
export function openingPortBody(id = 'solo') {
  const mars = getBody('mars'), port = createPortSite(mars), origin = port.center;
  const frame = { right: port.right, up: port.up, back: port.back };
  const { toLocal, toWorld } = frameKit(mars, origin, frame);
  const height = (x, z) => { const r = Math.hypot(x, z), t = Math.max(0, Math.min(1, (r - 900) / 700)); return t * t * (3 - 2 * t) * 12 * Math.sin(x * .004 + 1) * Math.sin(z * .003); };
  return { body: bodyOver(mars, 'openingport-' + id, origin, frame, height, 0), origin, frame, toWorld, toLocal, height, port };
}

export class OpeningModel {
  constructor(state, id = 'solo') {
    this.state = state; this.id = id; this.kits = {}; this.kind = null;
    if (state.stage >= STAGE.WRECK) this.use('wreck');
    else if (state.stage === STAGE.PORT) this.use('port');
    for (const cut of state.cuts || []) this.cut(cut, false);
  }
  /** Build (once) and switch to the ground kit of a stage: 'port' or 'wreck'. */
  use(kind) {
    if (!this.kits[kind]) {
      if (kind === 'port') {
        const k = openingPortBody(this.id);
        k.walker = new Walker(k.body); this.kits.port = k;
      } else {
        const gravity = this.state.dest ? worldFacts(this.state.dest.world).gravity : 0;
        const k = openingBody(this.id, gravity || 0);
        k.edits = new EditStore(k.body); k.walker = new Walker(k.body); k.digger = new Digger(k.body, k.edits, k.walker);
        this.kits.wreck = k;
      }
    }
    this.kind = kind;
    const k = this.kits[kind];
    for (const key of ['body', 'origin', 'frame', 'toWorld', 'toLocal', 'height', 'port', 'walker', 'digger', 'edits']) this[key] = k[key];
    if (kind === 'wreck') attachEdits(k.edits);
    return this;
  }
  /** Let go of the edit stores and anything else a kit holds (the authority calls this when the opening is over). */
  release() { for (const k of Object.values(this.kits)) if (k.edits) detachBodyEdits(k.body.id); }
  place(p) { Object.assign(this.walker.worldPos, this.toWorld(p.x, p.y, p.z)); this.walker.yaw = p.yaw; this.walker.pitch = p.pitch; this.walker.updateFrame(); }
  pose() { return { ...this.toLocal(this.walker.worldPos), yaw: this.walker.yaw, pitch: this.walker.pitch }; }
  exposed() { attachEdits(this.edits); return [[0, 0], [.18, 0], [-.18, 0], [0, .18], [0, -.18]].every(([x, z]) => {
    const p = this.toWorld(CRATE.x + x, .34, CRATE.z + z); return density(this.body, p.x, p.y, p.z) > 0; }); }
  cut(p, record = true) { if (this.kind !== 'wreck') this.use('wreck'); attachEdits(this.edits); this.place(p); const r = this.digger.dig();
    if (r.ok && record) this.state.cuts.push({ ...p }); return r; }

  /** Is this pose one the stage allows (finite, inside the stage's own bounds)? */
  poseOk(p, s) {
    if (!p || !['x', 'y', 'z', 'yaw', 'pitch'].every((k) => Number.isFinite(p[k]))) return false;
    switch (s.stage) {
      case STAGE.LINER: case STAGE.DESCENT: return Math.abs(p.x) <= 40 && p.z >= -75 && p.z <= 75 && p.y >= -8 && p.y <= 16;
      case STAGE.PORT: return p.x >= PORT_BOUNDS.x0 && p.x <= PORT_BOUNDS.x1 && p.z >= PORT_BOUNDS.z0 && p.z <= PORT_BOUNDS.z1 && p.y >= -3 && p.y <= 12;
      default: return Math.abs(p.x) <= 5000 && p.z >= -5000 && p.z <= 80 && p.y >= -25 && p.y <= (s.stage === STAGE.TRAVEL ? 25 : 8);
    }
  }

  act(a) {
    const s = this.state;
    if (s.complete) return { ok: true, msg: 'The opening is complete.' };
    switch (a.type) {
      case 'opening-pose': return this._pose(a);
      case 'opening-next': return this._next();
      case 'opening-pick': return this._pick(a);
      case 'opening-board': return this._board();
      case 'opening-locker': {
        if (s.stage !== STAGE.WRECK) throw Error('There is no locker here.');
        if (Math.hypot(s.pose.x - LOCKER.x, s.pose.z - LOCKER.z) > LOCKER.reach + 1.5) throw Error('Move closer to the locker.');
        s.lockerOpened = true; break;
      }
      case 'opening-dig':
        if (s.stage !== STAGE.DIG || s.cuts.length >= 240) throw Error('Cannot dig here.');
        if (Math.hypot(s.pose.x - CRATE.x, s.pose.z - CRATE.z) > 4) throw Error('Move closer.');
        this.use('wreck'); return this.cut(s.pose);
      case 'opening-carry':
        this.use('wreck');
        if (s.stage !== STAGE.DIG || !this.exposed() || Math.hypot(s.pose.x - CRATE.x, s.pose.z - CRATE.z) > 2.8) throw Error('Clear the dust and move closer.');
        s.carriedCrate = true; s.stage = STAGE.CONTACT; s.contactSeconds = 0; break;
      case 'opening-ride':
        if (s.stage !== STAGE.CONTACT || (s.contactSeconds || 0) < CONTACT_SECONDS || Math.hypot(s.pose.x + 7, s.pose.z - 23) > 5) throw Error('Meet the driver first.');
        this.use('wreck');
        s.stage = STAGE.TRAVEL; s.ride = true; s.rideSeconds = 0; s.pose = { x: -7, y: this.height(-7, 23), z: 23, yaw: s.pose.yaw, pitch: 0 }; break;
      case 'opening-walk':
        if (s.stage !== STAGE.CONTACT) throw Error('Continue the opening first.');
        s.stage = STAGE.TRAVEL; s.ride = false; break;
      case 'opening-finish':
        if (s.ride && s.stage === STAGE.TRAVEL) s.rideSeconds += Math.max(0, Math.min(RIDE_SECONDS * 2, a.seconds || 0));
        if (s.stage !== STAGE.TRAVEL || (s.ride ? s.rideSeconds < RIDE_SECONDS : Math.hypot(s.pose.x + 2600, s.pose.z + 350) > 100)) throw Error('Reach the port first.');
        this._done(); break;
      case 'opening-skip':
        if (!s.played && !a.replay) throw Error('Skip intro is available after first play.');
        this._done(); break;
      default: throw Error('Unknown opening action.');
    }
    return { ok: true, msg: 'Saved.' };
  }

  _done() { const s = this.state; if (!s.dest) s.dest = { world: 'mars', faction: null, stay: true }; s.stage = STAGE.DONE; s.complete = true; }

  _pose(a) {
    const s = this.state, p = a.pose;
    if (!this.poseOk(p, s)) throw Error('Invalid opening position.');
    // The ride and the two flights are scripts: the authority advances them by its own clock and the client's pose does not matter. A pose never refuses and never loops.
    const scripted = s.stage === STAGE.LINER || s.stage === STAGE.DESCENT || (s.ride && s.stage === STAGE.TRAVEL);
    const seconds = Math.max(0, Math.min(scripted ? 130 : 2, a.seconds || 0));
    if (s.stage === STAGE.TRAVEL && s.ride) {
      s.elapsed += seconds; s.rideSeconds += seconds;
      const t = Math.max(0, Math.min(1, s.rideSeconds / RIDE_SECONDS)), e = t * t * (3 - 2 * t), x = -7 - 2593 * e, z = 23 - 373 * e;
      s.pose = { x, y: this.height(x, z), z, yaw: Math.atan2(2593, 373), pitch: 0 };
      return { ok: true, ride: true };
    }
    // On foot (or on a ship's deck), a pose further than a person can have walked is pulled back to the furthest reachable point and the caller is told where
    // it is (it used to be refused outright, and a client that kept sending a far-ahead pose was refused forever).
    const aboard = s.stage === STAGE.LINER || s.stage === STAGE.DESCENT, reach = seconds * (aboard ? 6 : 9) + 2;
    const d = Math.hypot(p.x - s.pose.x, p.y - s.pose.y, p.z - s.pose.z), k = d > reach ? reach / d : 1;
    const q = { x: s.pose.x + (p.x - s.pose.x) * k, y: s.pose.y + (p.y - s.pose.y) * k, z: s.pose.z + (p.z - s.pose.z) * k, yaw: p.yaw, pitch: p.pitch };
    s.pose = q; s.walked += d * k; s.elapsed += seconds;
    if (aboard) s.clock = (s.clock || 0) + seconds;
    if (s.stage === STAGE.CONTACT) s.contactSeconds = (s.contactSeconds || 0) + seconds;
    return k < 1 ? { ok: true, corrected: true, pose: { ...q } } : { ok: true };
  }

  _next() {
    const s = this.state;
    if (s.stage === STAGE.LINER) {
      const def = LINER_DEF();
      if ((s.clock || 0) < LINER_PHASE.touch + 1 || s.pose.x < gangwayEndX(def) - 1.5) throw Error('Walk off the ship by the starboard gangway once it is down.');
      s.stage = STAGE.PORT; s.clock = 0; s.played = true; s.pose = linerExit(def);
    } else if (s.stage === STAGE.DESCENT) {
      if ((s.clock || 0) < KESTREL_SECONDS - 3) throw Error('The flight is not over.');       // (a few seconds of slack: the client's clock and the credited one differ by about a second)
      s.stage = STAGE.WRECK; s.clock = 0; this.use('wreck'); s.pose = { x: 0, y: .02, z: 4, yaw: Math.PI, pitch: 0 };
    } else if (s.stage === STAGE.WRECK && s.pose.z > 12) {
      s.stage = STAGE.DIG; this.use('wreck'); s.pose = { x: 0, y: .02, z: 15, yaw: Math.PI, pitch: -.2 };
    } else throw Error('Continue the opening first.');
    return { ok: true, msg: 'Saved.' };
  }

  _pick(a) {
    const s = this.state;
    if (s.stage !== STAGE.PORT) throw Error('The board is in the port.');
    const world = String(a.world || ''), faction = a.faction ? String(a.faction) : null, w = startWorld(world);
    if (!w) throw Error('There is no such world.');
    if (w.status !== 'open') throw Error(`${world[0].toUpperCase() + world.slice(1)} is not built yet. The Kestrel does not fly there.`);
    if (!validChoice(world, faction)) throw Error('That side does not live on that world.');
    if (a.stay) {
      if (world !== 'mars') throw Error('Only Mars can be left on foot.');
      s.dest = { world, faction: null, stay: true }; s.driver = null; this._done(); return { ok: true, dest: s.dest };
    }
    s.dest = { world, faction, stay: false };
    // The driver who finds you is one of the world's two sides, picked at random once per player and kept on the record: a nudge, never a lock.
    s.driver = w.factions.length ? w.factions[Math.floor((s.seed || 0) * 997) % w.factions.length] : null;
    return { ok: true, dest: s.dest };
  }

  _board() {
    const s = this.state;
    if (s.stage !== STAGE.PORT) throw Error('Board from the port.');
    if (!s.dest || s.dest.stay) throw Error('Pick a world on the board first.');
    const g = kestrelGate(KESTREL_DEF());
    if (Math.hypot(s.pose.x - g.x, s.pose.z - g.z) > g.reach + 3) throw Error('Walk to the Kestrel gate on Pad 01.');
    s.stage = STAGE.DESCENT; s.clock = 0; s.pose = { ...KESTREL_BOARD };
    return { ok: true, msg: 'Boarded.' };
  }
}
