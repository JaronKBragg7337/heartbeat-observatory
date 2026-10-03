// ============================================================================
// ships/_liner/pax.js - where the passengers sit. Server-safe (no three.js). The opening seats Loft people (or NPC stand-ins) in a transport's
// cabins; this reads the passenger seat banks (props of kind 'paxrow') out of a layout and lists every seat: a ship-local position on the floor
// and the way it faces (yaw 0 = the nose, -Z; 90 = starboard), so the opening never has to know how a ship is furnished.
// ============================================================================

/** Every passenger seat in a layout: { room, x, y, z, yaw, bank, seat }. Rows at rot 0 face the nose. */
export function passengerSeatsOf(layout) {
  const out = [];
  let bank = 0;
  for (const p of layout.props) {
    if (p.kind !== 'paxrow') continue;
    const n = Math.max(1, p.seats || Math.round(p.w / 0.62)), pitch = p.w / n, rot = (p.rot || 0) % 4;
    for (let i = 0; i < n; i++) {
      const lx = -p.w / 2 + pitch * (i + 0.5), lz = -0.04;
      // a rotation of rot quarter-turns about Y (the prop convention: rot 1 turns the front to +X)
      const c = [1, 0, -1, 0][rot], s = [0, 1, 0, -1][rot];
      out.push({ room: p.room, x: +(p.x + lx * c + lz * s).toFixed(3), y: p.y, z: +(p.z - lx * s + lz * c).toFixed(3), yaw: rot * 90, bank, seat: i });
    }
    bank++;
  }
  return out;
}
