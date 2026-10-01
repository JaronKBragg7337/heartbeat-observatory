// ============================================================================
// shipVisibility.js - which rooms can the camera see? (pure: no three.js)
//
// OWNS: the list of openings between rooms and the walk outward from the
//       camera's room through every open opening that is in view or close by.
// DOES NOT OWN: drawing, doors (it is told whether a door is shut) or the camera.
//
// WHY THIS EXISTS. A phone cannot draw the whole ship, so rooms you cannot see
// are not submitted. The first version drew "the room you are in and its
// neighbours", which is wrong in both directions: from a doorway the room across
// the next open door vanished (you saw raw Mars where a corridor should be), and
// a stair block standing in one room disappeared when the room it was filed under
// was skipped. The rule now is the real one: a room is drawn when there is a chain
// of openings from your room to it, each open (a shut door is a wall) and each in
// front of you (or within a few metres, so that turning round never shows a hole).
// ============================================================================

/** Every opening between two rooms: centre, radius, and the door id that can shut it (or null). */
export function buildPortals(layout, roomIds) {
  const list = [];
  const has = (id) => roomIds.has(id);
  for (const d of layout.doors) {
    if (!has(d.a) || !has(d.b)) continue;
    const cx = d.axis === 'x' ? d.at : d.c, cz = d.axis === 'x' ? d.c : d.at;
    list.push({ id: d.id, a: d.a, b: d.b, x: cx, y: d.y + d.h / 2, z: cz, r: Math.max(d.w, d.h) / 2 + 0.25, door: d.kind === 'open' || d.kind === 'hatch' || d.kind === 'portal' ? null : d.id });
  }
  // openings that are not doors: the bridge stairwell (a stair is a room you climb through) and the turret hatch
  list.push({ id: 'stair_up', a: 'corridor_main', b: 'bridge', x: 0, y: 4.6, z: -11.2, r: 3.0, door: null });
  list.push({ id: 'hatch_dorsal', a: 'niche', b: 'nest', x: -1.8, y: 6.9, z: 2.6, r: 1.4, door: null });
  const of = new Map();
  for (const p of list) for (const id of [p.a, p.b]) { if (!of.has(id)) of.set(id, []); of.get(id).push(p); }
  return { list, of };
}

/** Half the diagonal field of view, radians, from the vertical fov in degrees and the aspect ratio. */
export function halfDiagonal(fovDeg, aspect) {
  const tv = Math.tan(fovDeg * Math.PI / 360), th = tv * (aspect || 1);
  return Math.atan(Math.hypot(tv, th));
}

/** Is this opening in the view, or so close that turning round would put it there? */
export function portalSeen(p, cam, fwd, halfDiag) {
  const dx = p.x - cam.x, dy = p.y - cam.y, dz = p.z - cam.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < p.r + 3.4) return true;
  const cos = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / dist;
  const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
  return ang - Math.asin(Math.min(1, p.r / dist)) < halfDiag + 0.15;
}

/**
 * The rooms you can see from `starts`.
 * @param portals  result of buildPortals
 * @param isOpen   (doorId) => true when that door is anything but shut
 * @param outside  the camera is outside the hull: only expand through the ramp and the lock
 */
export function reachRooms({ portals, isOpen, starts, cam, fwd, fovDeg, aspect, maxRooms = 12, outside = false, expandOutside = OUT_EXPAND }) {
  const halfDiag = halfDiagonal(fovDeg, aspect);
  const set = new Set();
  let frontier = [];
  for (const id of starts) if (!set.has(id)) { set.add(id); frontier.push(id); }
  while (frontier.length && set.size < maxRooms) {
    const next = [];
    for (const id of frontier) {
      if (outside && !expandOutside.has(id)) continue;
      for (const p of portals.of.get(id) || []) {
        const other = p.a === id ? p.b : p.a;
        if (set.has(other)) continue;
        if (p.door && !isOpen(p.door)) continue;                 // shut: the leaf is a wall
        if (!portalSeen(p, cam, fwd, halfDiag)) continue;
        set.add(other); next.push(other);
        if (set.size >= maxRooms) break;
      }
    }
    frontier = next;
  }
  return set;
}

export const OUT_EXPAND = new Set(['cargo', 'engineering', 'airlock', 'corridor_low']);
