// ============================================================================
// worlds/moon/crash.js - the Moon's crash site, for the new opening (the per-world crash table in the builders' spoiler file; nothing here is shown to a player
// before they have played it). The opening builds its own scene; this file tells it WHERE on the real Moon the transport comes down, what the light does there
// and which way the rover goes. Pure data and small maths (no three.js, no DOM); the opening calls `makeMoon('moon')` (src/space/moonField.js) for the ground.
//
// WHERE: a small crater 4.2 km north of Tranquility Civil Hub (a 1.8 km bowl, 92 m deep, found in the LOLA heights: it is real ground, not a drawn hole). The floor
//   is smooth and the rim is low, so a falling transport lands inside it. The hub is the nearest port (the SPOILER table's "Tranquility Civil Hub").
// THE LIGHT: the terminator. The Sun is a degree and a half over the horizon, so the rim throws its shadow across the floor: half the floor is blazing and half is black,
//   and the hull lies across the line. No dust (the Moon has none to raise), a slow spray of frozen coolant from the broken line, and a suit timer from the moment the
//   hull opens. The ground is the field's own: dig the crate out of the low-g regolith, and the digging teaches the moon hop.
// THE DRIVER: a Fortis trooper in red-trimmed armour in a pressurised rover, or a Technos technician in white in a glass-cabbed one; the other bloc's recruiter waits at the
//   hub (src/worlds/moon/dialogue.js has every line; src/worlds/moon/cast.js has the recruiters' bodies at the hub).
// ============================================================================

/** The crash site and its light. Metres east/north of the hub's main pad centre (the hub's outpost frame: place.js). */
export const CRASH = {
  worldId: 'moon', frame: 'moon', port: 'Tranquility Civil Hub',
  site: { eastM: 600, northM: 4200, craterRadiusM: 900, craterDepthM: 92, name: 'the bowl north of the hub' },
  /** The Sun for the crash scene, in the sky of the hub's frame: low and from the east, so the western half of the floor is in the rim's shadow. */
  light: { sunElevDeg: 1.5, sunAzDeg: 95, terminator: true, shadowSplit: 0.5 },
  suit: { timerS: 1500, note: 'the suit timer starts when the hull opens' },
  fx: { coolantSpray: { rate: 0.4, gravity: 1.62, note: 'frozen coolant drifts and falls slowly; there is no dust and no smoke' }, dust: false },
  /** The rover's way from the crash to the hub: waypoints, east/north metres of the hub pad, in order. About 4.6 km of ground the lunar rover covers in a few minutes. */
  route: [[600, 4200], [520, 3600], [400, 2800], [300, 2000], [180, 1200], [80, 560], [20, 180], [0, 60]],
};

/**
 * A point east/north metres of the hub pad, on the real ground, in the hub frame's coordinates. `body` is makeMoon('moon'). Returns { point, up, heightM }: `up` the
 * local vertical there and `heightM` the height above the pad's tangent plane (what a flat scene's `y` is).
 */
export function crashPoint(body, eastM = CRASH.site.eastM, northM = CRASH.site.northM) {
  const pad = body.padInfo, R = body.radiusMean;
  const dx = pad.up.x + (pad.east.x * eastM + pad.north.x * northM) / R, dy = pad.up.y + (pad.east.y * eastM + pad.north.y * northM) / R, dz = pad.up.z + (pad.east.z * eastM + pad.north.z * northM) / R;
  const l = Math.hypot(dx, dy, dz), dir = { x: dx / l, y: dy / l, z: dz / l }, r = body.surfaceRadius(dir.x, dir.y, dir.z);
  const point = { x: dir.x * r, y: dir.y * r, z: dir.z * r };
  const heightM = (point.x - pad.point.x) * pad.up.x + (point.y - pad.point.y) * pad.up.y + (point.z - pad.point.z) * pad.up.z;
  return { point, up: dir, heightM };
}
/** Height of the real ground, metres above the hub pad's tangent plane, at east/north metres of the pad (a crash scene's own `h(x, z)`, with x = east and z = -north). */
export const crashGroundHeight = (body, eastM, northM) => crashPoint(body, eastM, northM).heightM;
