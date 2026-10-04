// ============================================================================
// worlds/moon/layout.js - where everything stands in the Moon's three settlements. Pure data: no three.js, no DOM. The browser draws from it (hub.js,
// shackleton.js, daedalus.js), the authority checks "are you standing at the desk" and "may spoil be dropped here" against it, and the validator reads it.
// Outpost-local metres (place.js): x EAST, z SOUTH (north is -z), y up, origin at the middle of the main pad (padInfo.point).
// A building named here is drawn and made solid from the SAME numbers (`hall()` makes the four walls round a doorway the walker can go through).
// ============================================================================
import { castOf } from './cast.js';
import { solidIn } from './place.js';

/** The four walls of a hall with one doorway on `side` ('n' | 's' | 'e' | 'w'), `c` metres off the middle of that side, `w` wide. Wall thickness 0.5 (kit.block's). */
export function hallBoxes(id, x0, z0, x1, z1, h, door) {
  const t = 0.5, out = [];
  const seg = (side, a0, a1, fixed0, fixed1) => {                  // a0..a1 along the side, fixed0..fixed1 across it
    const put = (p0, p1) => { if (p1 - p0 < 0.05) return; if (side === 'n' || side === 's') out.push({ id: `${id}-${side}`, x0: p0, x1: p1, z0: fixed0, z1: fixed1, h }); else out.push({ id: `${id}-${side}`, x0: fixed0, x1: fixed1, z0: p0, z1: p1, h }); };
    if (door && door.side === side) { const m = (a0 + a1) / 2 + (door.c || 0), dw = door.w || 3.2; put(a0, m - dw / 2); put(m + dw / 2, a1); } else put(a0, a1);
  };
  seg('n', x0, x1, z0, z0 + t); seg('s', x0, x1, z1 - t, z1); seg('w', z0, z1, x0, x0 + t); seg('e', z0, z1, x1 - t, x1);
  return out;
}
const solid = (id, x0, z0, x1, z1, h) => ({ id, x0, z0, x1, z1, h });
const post = (id, x, z, r, h) => solid(id, x - r, z - r, x + r, z + r, h);

// ============================================================================ TRANQUILITY CIVIL HUB
export const HUB = {
  name: 'TRANQUILITY CIVIL HUB', id: 'moon',
  MAIN_PAD: { x: 0, z: 0, w: 58, d: 58 },
  HALL: { x0: -30, z0: -92, x1: 14, z1: -66, h: 8, door: { side: 's', c: 0, w: 4.4, h: 3.2 } },
  MERC: { x0: -86, z0: -6, x1: -62, z1: 16, h: 5, door: { side: 'e', c: 0, w: 3.2, h: 2.8 } },
  CLINIC: { x0: -84, z0: -52, x1: -62, z1: -30, h: 4.6, door: { side: 'e', c: 0, w: 3.2, h: 2.8 } },
  WATER: { x0: 44, z0: -24, x1: 70, z1: -4, h: 5, door: { side: 'w', c: 0, w: 3.2, h: 2.8 } },
  FORTIS_BOOTH: { x0: 18, z0: -62, x1: 30, z1: -52, h: 3.6 },
  TECHNOS_KIOSK: { x0: -52, z0: -62, x1: -40, z1: -52, h: 3.6 },
  GARAGE: { x0: 44, z0: 40, x1: 76, z1: 60, h: 6 },
  GAS: { x0: 34, z0: 26, x1: 46, z1: 32, h: 3.4 },
  TANKS: [[84, -30, 5, 9], [98, -30, 5, 9], [91, -16, 5, 9]],
  SPHERES: [[86, 12, 6], [102, 12, 6]],
  APOLLO: { x: -819, z: 786 },
  get BOXES() {
    const H = this.HALL, M = this.MERC, C = this.CLINIC, W = this.WATER;
    return [
      ...hallBoxes('hall', H.x0, H.z0, H.x1, H.z1, H.h, H.door), ...hallBoxes('merc', M.x0, M.z0, M.x1, M.z1, M.h, M.door),
      ...hallBoxes('clinic', C.x0, C.z0, C.x1, C.z1, C.h, C.door), ...hallBoxes('water', W.x0, W.z0, W.x1, W.z1, W.h, W.door),
      solid('fortis-booth', ...Object.values(this.FORTIS_BOOTH).slice(0, 4), this.FORTIS_BOOTH.h), solid('technos-kiosk', ...Object.values(this.TECHNOS_KIOSK).slice(0, 4), this.TECHNOS_KIOSK.h),
      solid('garage', ...Object.values(this.GARAGE).slice(0, 4), this.GARAGE.h), solid('gas', ...Object.values(this.GAS).slice(0, 4), this.GAS.h),
      ...this.TANKS.map(([x, z, r, h], i) => post('tank-' + i, x, z, r, h)), ...this.SPHERES.map(([x, z, r], i) => post('sphere-' + i, x, z, r, r * 2)),
      post('mast-comms', -96, -76, 1.6, 40),
      ...[[-42, -34], [42, -34], [46, 20], [-46, 22], [0, 70], [-60, 66]].map(([x, z], i) => post('flood-' + i, x, z, 0.5, 14)),
    ];
  },
};

// ============================================================================ SHACKLETON BASE (Fortis)
export const SHACK = {
  name: 'SHACKLETON BASE', id: 'moon-shackleton',
  MAIN_PAD: { x: 0, z: 0, w: 58, d: 58 },
  WALL: { x0: -120, x1: 120, z0: -100, z1: 110, h: 6.5, t: 1.6, gate: { z0: 22, z1: 40 } },
  BARRACKS: [{ id: 'A', x0: -112, z0: -96, x1: -76, z1: -70 }, { id: 'B', x0: -70, z0: -96, x1: -34, z1: -70 }].map((b) => ({ ...b, h: 6.5, door: { side: 's', c: 0, w: 3.4, h: 2.8 } })),
  DRIVER_CONTROL: { x0: -28, z0: -96, x1: 8, z1: -70, h: 8, door: { side: 's', c: 0, w: 3.4, h: 2.8 } },
  ARMOURY: { x0: 34, z0: -96, x1: 76, z1: -66, h: 5.5, door: { side: 's', c: 0, w: 4.4, h: 3.4 } },
  COMMAND: { x0: 48, z0: -60, x1: 100, z1: -28, h: 13, door: { side: 's', c: 0, w: 5, h: 3.6 } },
  QUARTER: { x0: -112, z0: -30, x1: -72, z1: -2, h: 5.5, door: { side: 'e', c: 0, w: 3.4, h: 2.8 } },
  ICE_DOCK: { x0: -112, z0: 56, x1: -80, z1: 84, h: 6, door: { side: 'e', c: 0, w: 3.4, h: 2.8 } },
  ICE_TANKS: [[-100, 98, 6, 9], [-84, 98, 6, 9]],
  GATE_TOWERS: [[120, 14], [120, 48]],
  CORNER_TOWERS: [[-120, -100], [120, -100], [-120, 110], [120, 110]],
  FUEL: [[60, 78, 6, 8], [76, 78, 6, 8]],
  get BOXES() {
    const W = this.WALL, g = W.gate, t = W.t, h = W.h;
    const B = [
      solid('wall-n', W.x0, W.z0 - t / 2, W.x1, W.z0 + t / 2, h), solid('wall-s', W.x0, W.z1 - t / 2, W.x1, W.z1 + t / 2, h),
      solid('wall-w', W.x0 - t / 2, W.z0, W.x0 + t / 2, W.z1, h),
      solid('wall-e1', W.x1 - t / 2, W.z0, W.x1 + t / 2, g.z0, h), solid('wall-e2', W.x1 - t / 2, g.z1, W.x1 + t / 2, W.z1, h),
      ...this.BARRACKS.flatMap((b) => hallBoxes('barracks-' + b.id, b.x0, b.z0, b.x1, b.z1, b.h, b.door)),
    ];
    for (const k of ['DRIVER_CONTROL', 'ARMOURY', 'COMMAND', 'QUARTER', 'ICE_DOCK']) { const q = this[k]; B.push(...hallBoxes(k.toLowerCase(), q.x0, q.z0, q.x1, q.z1, q.h, q.door)); }
    B.push(...this.GATE_TOWERS.map(([x, z], i) => post('gate-tower-' + i, x, z, 3.8, 13)), ...this.CORNER_TOWERS.map(([x, z], i) => post('corner-tower-' + i, x, z, 3.4, 14)));
    B.push(...this.ICE_TANKS.map(([x, z, r, hh], i) => post('ice-tank-' + i, x, z, r, hh)), ...this.FUEL.map(([x, z, r, hh], i) => post('fuel-' + i, x, z, r, hh)));
    for (const [x, z] of [[0, 70], [16, 70], [32, 70]]) B.push(solid('vehicle-' + x, x - 2.4, z - 3.6, x + 2.4, z + 3.6, 3.2));
    return B;
  },
};

// ============================================================================ DAEDALUS STATION (Technos Prime)
export const DAED = {
  name: 'DAEDALUS STATION', id: 'moon-daedalus',
  MAIN_PAD: { x: 0, z: 0, w: 58, d: 58 },
  DOME: { cx: 10, cz: -110, r: 36, x0: -26, z0: -146, x1: 46, z1: -74, h: 4, gap: { x0: 4, x1: 16 } },       // the Glass Hall: a low ring wall (a gap on its south side) under the dome
  TOWERS: [[-60, -96, 12, 38], [-82, -130, 10, 30], [70, -122, 12, 46], [94, -96, 10, 26]],
  RING: { cx: -110, cz: -30, r: 52, n: 8, w: 12 },
  FAB: { x0: -90, z0: 70, x1: -10, z1: 92, h: 9, door: { side: 'n', c: 0, w: 5, h: 3.6 } },
  SUPPLY: { x0: 40, z0: 30, x1: 70, z1: 52, h: 5, door: { side: 'w', c: 0, w: 3.2, h: 2.8 } },
  SERVERS: { x0: 30, z0: 62, x1: 80, z1: 92, h: 4.2 },
  DISHES: [[126, 10, 9], [150, -30, 11], [178, 12, 9], [152, 52, 12], [192, -52, 10]],
  QUIET_DISH: { x: 160, z: 118, r: 24 },
  PODS: [[70, -58, 3.5], [78, -48, 3.5], [66, -44, 3.5]],
  get RINGS() { const R = this.RING; return Array.from({ length: R.n }, (_, i) => { const a = i * Math.PI * 2 / R.n; return { i, x: R.cx + Math.cos(a) * R.r, z: R.cz + Math.sin(a) * R.r, a }; }); },
  get BOXES() {
    const D = this.DOME, g = D.gap, B = [
      solid('dome-n', D.x0, D.z0, D.x1, D.z0 + 0.8, D.h), solid('dome-w', D.x0, D.z0, D.x0 + 0.8, D.z1, D.h), solid('dome-e', D.x1 - 0.8, D.z0, D.x1, D.z1, D.h),
      solid('dome-s1', D.x0, D.z1 - 0.8, g.x0, D.z1, D.h), solid('dome-s2', g.x1, D.z1 - 0.8, D.x1, D.z1, D.h),
    ];
    B.push(...this.TOWERS.map(([x, z, s, h], i) => post('tower-' + i, x, z, s / 2, h)));
    for (const r of this.RINGS) B.push(post('ring-' + r.i, r.x, r.z, this.RING.w / 2, 5));
    for (const k of ['FAB', 'SUPPLY']) { const q = this[k]; B.push(...hallBoxes(k.toLowerCase(), q.x0, q.z0, q.x1, q.z1, q.h, q.door)); }
    B.push(solid('servers', this.SERVERS.x0, this.SERVERS.z0, this.SERVERS.x1, this.SERVERS.z1, this.SERVERS.h));
    B.push(...this.DISHES.map(([x, z, r], i) => post('dish-' + i, x, z, 2, 6)), post('quiet-dish', this.QUIET_DISH.x, this.QUIET_DISH.z, 4, 14));
    B.push(...this.PODS.map(([x, z, r], i) => post('pod-' + i, x, z, r, r * 2)));
    return B;
  },
};

export const LAYOUTS = { moon: HUB, 'moon-shackleton': SHACK, 'moon-daedalus': DAED };

/** A settlement's whole layout, resolved: { name, MAIN_PAD, BOXES, PEOPLE } (people from cast.js). Cached. */
const _cache = new Map();
export function layoutOf(worldId) {
  let l = _cache.get(worldId);
  if (!l) {
    const L = LAYOUTS[worldId]; if (!L) return null;
    l = { id: worldId, name: L.name, MAIN_PAD: L.MAIN_PAD, BOXES: L.BOXES, PEOPLE: castOf(worldId), raw: L };
    _cache.set(worldId, l);
  }
  return l;
}
/** Is outpost-local (x, z) on something solid or on a person at this landing? (the spoil guard) */
export const solidAtMoon = (worldId, x, z, margin = 0.3) => { const l = layoutOf(worldId); return !!l && solidIn(l, x, z, margin); };
