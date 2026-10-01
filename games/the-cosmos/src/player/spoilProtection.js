import { clearSpoilGround } from '../port/portSpec.js';

/** Shared by the planner and the final atomic lattice-write guard. */
export function makeSpoilGuard({ port, portPeople, ship, getCrew = () => null }) {
  return (x, y, z) => {
    if (!clearSpoilGround(port.site, x, y, z)) return false;
    const p = port.site.toLocal({ x, y, z });
    if (port.boxes.some(b => p.x > b.x0 - .25 && p.x < b.x1 + .25 &&
      p.z > b.z0 - .25 && p.z < b.z1 + .25)) return false;
    if (portPeople.members.some(m => Math.hypot(p.x - m.x, p.z - m.z) < .55)) return false;
    const crew = getCrew();
    if (crew && [...crew.members.values()].some(m => m.place === 'ground' &&
      Math.hypot(x - m.gpos.x, y - m.gpos.y, z - m.gpos.z) < 1)) return false;
    if (ship.guns?.targets.some(t => !t.inactive &&
      Math.hypot(x - t.pos.x, y - t.pos.y, z - t.pos.z) < t.radius + .4)) return false;
    // Follow the ship's current frame, including the ramp runout.
    const q = ship.flight.toLocal({ x, y, z });
    return !(Math.abs(q.x) < 13.5 && q.z > -25 && q.z < 36 && q.y > -5 && q.y < 12);
  };
}
