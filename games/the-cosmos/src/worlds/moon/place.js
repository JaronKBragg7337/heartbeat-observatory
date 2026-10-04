// ============================================================================
// worlds/moon/place.js - the frame the Moon's settlements are drawn and checked in. Pure maths: no three.js, no DOM.
// Outpost-local metres: x EAST, y UP, z SOUTH (north is -z), origin at the middle of the landing's main pad (padInfo.point): the same frame
// Occator Works and Marineris Port use. `pi` is the body's padInfo ({ point, east, up, north }).
// ============================================================================

/** Outpost-local (x east, y up, z south) -> the world's frame coordinates. */
export function outpostToFrame(pi, x, y, z) {
  return { x: pi.point.x + pi.east.x * x + pi.up.x * y - pi.north.x * z, y: pi.point.y + pi.east.y * x + pi.up.y * y - pi.north.y * z, z: pi.point.z + pi.east.z * x + pi.up.z * y - pi.north.z * z };
}
/** And back: a frame point to outpost-local metres. */
export function frameToOutpost(pi, p) {
  const dx = p.x - pi.point.x, dy = p.y - pi.point.y, dz = p.z - pi.point.z;
  return { x: dx * pi.east.x + dy * pi.east.y + dz * pi.east.z, y: dx * pi.up.x + dy * pi.up.y + dz * pi.up.z, z: -(dx * pi.north.x + dy * pi.north.y + dz * pi.north.z) };
}
/** Is outpost-local (x, z) on a solid box or a person? (the spoil guard; `layout` = { BOXES, PEOPLE, MAIN_PAD }) */
export function solidIn(layout, x, z, margin = 0.3) {
  for (const b of layout.BOXES) if (x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin) return true;
  for (const w of layout.PEOPLE) if (!w.far && Math.hypot(x - w.x, z - w.z) < 0.7) return true;
  const P = layout.MAIN_PAD;
  if (Math.abs(x - P.x) < P.w / 2 + 1.5 && Math.abs(z - P.z) < P.d / 2 + 1.5) return true;
  return false;
}
/** Push a point out of the solid boxes (the walker's collision): returns the corrected { x, z } or null when nothing touched it. */
export function pushOut(layout, p, r = 0.38) {
  let pushed = false;
  for (const b of layout.BOXES) {
    if (p.y > 0.4 + b.h || p.y + 1.8 < -0.2) continue;
    if (p.x <= b.x0 - r || p.x >= b.x1 + r || p.z <= b.z0 - r || p.z >= b.z1 + r) continue;
    const ch = [{ dx: b.x0 - r - p.x, dz: 0 }, { dx: b.x1 + r - p.x, dz: 0 }, { dx: 0, dz: b.z0 - r - p.z }, { dx: 0, dz: b.z1 + r - p.z }].sort((a, c) => Math.hypot(a.dx, a.dz) - Math.hypot(c.dx, c.dz))[0];
    p.x += ch.dx; p.z += ch.dz; pushed = true;
  }
  return pushed;
}
