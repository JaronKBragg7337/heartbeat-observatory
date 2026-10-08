// ============================================================================
// worlds/earth/layout.js - where everything stands at the SKYWARD LAUNCH COMPLEX, Cape Canaveral. Pure data: no three.js, no DOM. The browser draws from it
// (complex.js), the validator reads it, and the ground's concrete slab (def.js `settlement`) is cut from the same numbers, so what you see on a footprint is
// what you cannot dig through. Outpost-local metres (the Moon's place.js): x EAST, z SOUTH (north is -z), y up, origin at the middle of the landing pad.
// Everything is inside the +-220 m square the field checks for a settlement (moonField.js settlementSolid).
//
// REAL AND NOT. Real: the place (Launch Complex 39's own patch of Merritt Island, on the Atlantic coast of Florida), that a launch complex there is a pad with a
// service tower, a lightning-mast ring, an assembly building a long crawlerway away, a farm of white spheres and tanks beside it, and the sea beyond. Game fiction:
// Skyward, its buildings, the vehicle on the mount ("Skyward Heavy"), every sign. The layout is ours, not NASA's.
// ============================================================================
import { solidIn } from '../moon/place.js';
import { EARTH_CAST } from './cast.js';

/** The four walls of a hall with one doorway on `side` ('n' | 's' | 'e' | 'w'), `c` metres off the middle of that side, `w` wide. Wall thickness 0.5 (the same walls the Moon's halls have). */
export function hallBoxes(id, x0, z0, x1, z1, h, door) {
  const t = 0.5, out = [];
  const seg = (side, a0, a1, fixed0, fixed1) => {
    const put = (p0, p1) => { if (p1 - p0 < 0.05) return; if (side === 'n' || side === 's') out.push({ id: `${id}-${side}`, x0: p0, x1: p1, z0: fixed0, z1: fixed1, h }); else out.push({ id: `${id}-${side}`, x0: fixed0, x1: fixed1, z0: p0, z1: p1, h }); };
    if (door && door.side === side) { const m = (a0 + a1) / 2 + (door.c || 0), dw = door.w || 3.2; put(a0, m - dw / 2); put(m + dw / 2, a1); } else put(a0, a1);
  };
  seg('n', x0, x1, z0, z0 + t); seg('s', x0, x1, z1 - t, z1); seg('w', z0, z1, x0, x0 + t); seg('e', z0, z1, x1 - t, x1);
  return out;
}

const solid = (id, x0, z0, x1, z1, h) => ({ id, x0, z0, x1, z1, h });
const post = (id, x, z, r, h) => solid(id, x - r, z - r, x + r, z + r, h);

export const COMPLEX = {
  name: 'SKYWARD LAUNCH COMPLEX', id: 'earth',
  MAIN_PAD: { x: 0, z: 0, w: 60, d: 60 },
  // Range Control: the long low control building north of the landing pad, ribbon windows, the countdown clock on its face
  OPS: { x0: -52, z0: -112, x1: 34, z1: -72, h: 12, door: { side: 's', c: 0, w: 5, h: 3.4 } },
  // Arrivals and Training Hall (recruits watch launches through its glass)
  TRAINING: { x0: 56, z0: -76, x1: 104, z1: -40, h: 9, door: { side: 'w', c: 0, w: 4.4, h: 3.2 } },
  // the flight-line hangar: low, white, a big sliding door facing the pad
  HANGAR: { x0: -122, z0: 6, x1: -70, z1: 58, h: 15, door: { side: 'e', c: 0, w: 14, h: 9 } },
  // the Vehicle Assembly Hall, 160 m of white wall with one huge stripe: the biggest thing for kilometres
  VAB: { x0: -206, z0: -208, x1: -126, z1: -142, h: 58 },
  // the launch mount: a concrete platform with the flame trench under it, the service tower beside, the vehicle on top
  MOUNT: { cx: 134, cz: -168, w: 46, d: 46, h: 9 },
  TOWER: { cx: 106, cz: -168, w: 11, h: 96 },
  MASTS: [[84, -214], [182, -214], [188, -128]],                                   // lightning masts round the mount
  SPHERES: [[168, -92, 10], [198, -108, 7]],                                       // the cold-fuel spheres
  TANKS: [[188, -52, 4.2, 13], [188, -38, 4.2, 13], [188, -24, 4.2, 13]],         // the kerosene farm
  get BOXES() {
    const O = this.OPS, T = this.TRAINING, H = this.HANGAR, V = this.VAB, M = this.MOUNT, TW = this.TOWER;
    return [
      ...hallBoxes('ops', O.x0, O.z0, O.x1, O.z1, O.h, O.door), ...hallBoxes('training', T.x0, T.z0, T.x1, T.z1, T.h, T.door), ...hallBoxes('hangar', H.x0, H.z0, H.x1, H.z1, H.h, H.door),
      solid('vab', V.x0, V.z0, V.x1, V.z1, V.h),
      solid('mount', M.cx - M.w / 2, M.cz - M.d / 2, M.cx + M.w / 2, M.cz + M.d / 2, M.h),
      post('tower', TW.cx, TW.cz, TW.w / 2, TW.h),
      ...this.MASTS.map(([x, z], i) => post('mast-' + i, x, z, 1.4, 100)),
      ...this.SPHERES.map(([x, z, r], i) => post('sphere-' + i, x, z, r, r * 2)),
      ...this.TANKS.map(([x, z, r, h], i) => post('tank-' + i, x, z, r, h)),
      ...[[-44, 30], [44, 30], [-44, -30], [44, -30]].map(([x, z], i) => post('flood-' + i, x, z, 0.4, 14)),
    ];
  },
};

let _cache = null;
/** The complex, resolved: { name, MAIN_PAD, BOXES, PEOPLE } (two people so far: cast.js). Same shape as the Moon's, so its `solidIn` / `pushOut` work on it. */
export function layoutOf() { return _cache || (_cache = { id: 'earth', name: COMPLEX.name, MAIN_PAD: COMPLEX.MAIN_PAD, BOXES: COMPLEX.BOXES, PEOPLE: EARTH_CAST, raw: COMPLEX }); }
/** Is outpost-local (x, z) on something solid at the complex? (the spoil guard and the concrete slab) */
export const solidAtEarth = (x, z, margin = 0.3) => solidIn(layoutOf(), x, z, margin);
