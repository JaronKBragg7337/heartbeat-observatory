// ============================================================================
// worlds/callisto/layout.js — where everything at the VALHALLA CAMP stands. Pure data: no three.js, no DOM. The browser draws from it
// (camp.js), the authority checks "are you standing at the desk" and "may spoil be dropped here" against it, and the validator reads it.
// Outpost-local metres: x EAST, z SOUTH (north is -z), y up, origin at the middle of the landing pad (padInfo.point), the same frame
// Occator Works and Marineris Port use. The graded flat ground is 90 m round the origin (blend to 240 m), so the camp stands inside
// 110 m. The far props (the sealed site, the dead relay) and the prospectors' camp (a world port, 1.2 km north) stand on open ground.
// ============================================================================
import { CALISTO_CAST } from './cast.js';

export const OUTPOST_NAME = 'VALHALLA CAMP';

/** The main pad: a slab the Meridian's size, with the camp round it. */
export const MAIN_PAD = { x: 0, z: 0, w: 58, d: 58 };

/** Solid footprints (people and carts do not walk through these; spoil is not poured on them). h is the height of what stands there. */
export const BOXES = [
  // the Archive: Mystara's buried hall (a door on its south face: the south wall is two pieces with an 8 m gap)
  { id: 'archive-n', x0: -24, x1: 8, z0: -104, z1: -103.2, h: 10 },
  { id: 'archive-w', x0: -24, x1: -23.2, z0: -104, z1: -80, h: 10 },
  { id: 'archive-e', x0: 7.2, x1: 8, z0: -104, z1: -80, h: 10 },
  { id: 'archive-sw', x0: -24, x1: -12, z0: -80.8, z1: -80, h: 10 },
  { id: 'archive-se', x0: -4, x1: 8, z0: -80.8, z1: -80, h: 10 },
  { id: 'archive-plinth', x0: -10, x1: -6, z0: -96, z1: -92, h: 2.4 },
  // the quartermaster's shed: open on its west side (toward the pad); back, side walls, and the counter across the front
  { id: 'supply-back', x0: 49.4, x1: 50.2, z0: 46, z1: 66, h: 6 },
  { id: 'supply-n', x0: 26, x1: 50.2, z0: 45.6, z1: 46.4, h: 6 },
  { id: 'supply-s', x0: 26, x1: 50.2, z0: 65.6, z1: 66.4, h: 6 },
  { id: 'supply-counter', x0: 27.4, x1: 28.4, z0: 47, z1: 65, h: 1.1 },
  // the standing array: the central plinth and the nine stones (walk round them, not through them)
  { id: 'array-plinth', x0: -56.6, x1: -51.4, z0: 35.4, z1: 40.6, h: 1.2 },
  ...Array.from({ length: 9 }, (_, i) => { const a = i * (Math.PI * 2 / 9) + 0.35, r = 34, x = -54 + Math.cos(a) * r, z = 38 + Math.sin(a) * r; return { id: 'array-stone-' + i, x0: x - 1.3, x1: x + 1.3, z0: z - 1.3, z1: z + 1.3, h: 7.5 }; }),
  // the two listening dishes and the comm mast
  { id: 'dish-1', x0: -76.4, x1: -67.6, z0: 54.2, z1: 63, h: 8 },
  { id: 'dish-2', x0: -92.4, x1: -85.6, z0: 38.2, z1: 45, h: 6 },
  { id: 'mast-comms', x0: -0.5, x1: 0.5, z0: -120.6, z1: -119.4, h: 26 },
  // the pole of each floodlight mast
  ...[[-38, -30], [40, -34], [44, 40], [-40, 46], [0, -60]].map(([x, z], i) => ({ id: 'mast-' + i, x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5, h: 16 })),
  // far props, on open ground: the dead relay on the Listening Scar's rim (about 780 m east-north-east), Sealed Site Four (about
  // 690 m south-east), and the prospectors' camp (a world port: huts, drill rig, claim board, 1.2 km north)
  { id: 'relay', x0: 606, x1: 614, z0: -484, z1: -476, h: 14 },
  { id: 'seal-door', x0: 326.4, x1: 333.6, z0: 606.4, z1: 613.6, h: 7 },
];

/** The prospectors' camp stands at the world port, 1.2 km north of the pad (def.ports). These boxes are PORT-local
 *  (x east, z south, origin the port's graded centre); solidAt converts them to the pad frame with PORT_CENTRE. */
export const PORT_CENTRE = { x: 0, z: -1200 };
export const PORT_BOXES = [
  { id: 'prosp-hut-1', x0: -22, x1: -6, z0: -9.5, z1: -2.5, h: 4.4 },
  { id: 'prosp-hut-2', x0: -8, x1: 8, z0: -15.5, z1: -8.5, h: 4.4 },
  { id: 'prosp-hut-3', x0: 12, x1: 28, z0: -11.5, z1: -4.5, h: 4.4 },
  { id: 'prosp-rig', x0: -7.5, x1: -0.5, z0: 12.5, z1: 19.5, h: 16 },
];

/** The people of the camp (cast.js): the prospector's x,z are pad-frame; he is drawn at his own camp (site 'port'). */
export const PEOPLE = CALISTO_CAST;

/** Is outpost-local (x, z) on something solid or on a person? (the spoil guard) */
export function solidAt(x, z, margin = 0.3) {
  for (const b of BOXES) if (x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin) return true;
  for (const b of PORT_BOXES) if (x > b.x0 - margin + PORT_CENTRE.x && x < b.x1 + margin + PORT_CENTRE.x && z > b.z0 - margin + PORT_CENTRE.z && z < b.z1 + margin + PORT_CENTRE.z) return true;
  for (const w of PEOPLE) if (Math.hypot(x - w.x, z - w.z) < 0.7) return true;
  if (Math.abs(x - MAIN_PAD.x) < MAIN_PAD.w / 2 + 1.5 && Math.abs(z - MAIN_PAD.z) < MAIN_PAD.d / 2 + 1.5) return true;
  return false;
}

/** Outpost-local (x east, y up, z south) -> the world's frame coordinates, given the body's padInfo ({ point, east, up, north }). */
export function outpostToFrame(pi, x, y, z) {
  return { x: pi.point.x + pi.east.x * x + pi.up.x * y - pi.north.x * z, y: pi.point.y + pi.east.y * x + pi.up.y * y - pi.north.y * z, z: pi.point.z + pi.east.z * x + pi.up.z * y - pi.north.z * z };
}
/** And back: a frame point to outpost-local metres. */
export function frameToOutpost(pi, p) {
  const dx = p.x - pi.point.x, dy = p.y - pi.point.y, dz = p.z - pi.point.z;
  return { x: dx * pi.east.x + dy * pi.east.y + dz * pi.east.z, y: dx * pi.up.x + dy * pi.up.y + dz * pi.up.z, z: -(dx * pi.north.x + dy * pi.north.y + dz * pi.north.z) };
}
/** Push a walker out of a set of solid boxes (BOXES in the pad frame, PORT_BOXES in the port's); returns true when it touched him. */
export function pushOut(p, boxes, r = 0.38) {
  let pushed = false;
  for (const b of boxes) {
    if (p.y > 0.4 + b.h || p.y + 1.8 < -0.2) continue;
    if (p.x <= b.x0 - r || p.x >= b.x1 + r || p.z <= b.z0 - r || p.z >= b.z1 + r) continue;
    const ch = [{ dx: b.x0 - r - p.x, dz: 0 }, { dx: b.x1 + r - p.x, dz: 0 }, { dx: 0, dz: b.z0 - r - p.z }, { dx: 0, dz: b.z1 + r - p.z }].sort((a, c) => Math.hypot(a.dx, a.dz) - Math.hypot(c.dx, c.dz))[0];
    p.x += ch.dx; p.z += ch.dz; pushed = true;
  }
  return pushed;
}
