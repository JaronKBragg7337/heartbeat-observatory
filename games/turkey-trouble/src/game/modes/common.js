// What every mode shares: the map, the grid, the seeded random, the event list and the walking person.
import { worldFor, arenaNav, makePath } from '../world.js';
import { makeRng } from '../rng.js';
import { makeMover } from '../mover.js';
import { PERSON, DT } from '../tuning.js';

export function makeBase(layout, opts, kind) {
  const world = worldFor(layout);
  const nav = arenaNav(world);
  const rng = makeRng(((opts.seed >>> 0) || 1) ^ hashStr(kind));
  const events = [];
  const emit = (type, x = 0, z = 0, extra) => { const e = { type, x, z, t: 0 }; if (extra) Object.assign(e, extra); events.push(e); return e; };
  const sp = (opts.carry && opts.carry.player) || layout.spawns.player;
  const player = makeMover(sp.x, sp.z, sp.rotY ?? sp.heading ?? 0, PERSON);
  const fp = world.freeSpot(player.x, player.z, PERSON.r); player.x = fp.x; player.z = fp.z;
  const clampArena = (m, r) => world.clampArena(m, r);
  return {
    kind, layout, world, nav, rng, events, emit, player, clampArena,
    t: 0, phase: 'play', result: null, steps: 0,
    hud: { label: '', time: 0, bpm: 0, hearts: 0, stamina: 1, action: null, arrow: false },
  };
}

export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export { makePath, DT };

// Rough fingerprint of a state for determinism tests.
export function fingerprint(g) {
  const r = (v) => Math.round(v * 1000);
  const parts = [g.phase, g.steps, r(g.t), r(g.player.x), r(g.player.z)];
  if (g.turkey) parts.push(r(g.turkey.x), r(g.turkey.z), g.turkey.anim);
  if (g.hits != null) parts.push(g.hits);
  return parts.join(',');
}
