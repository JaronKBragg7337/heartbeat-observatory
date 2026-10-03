// ============================================================================
// core/frameMath.js - the arithmetic of frames, as pure functions on plain frame objects. No imports: the engine, the server's ship
// simulation and the validator all use it.
//
// A FRAME is { id, origin: {x,y,z}, yaw, c, s, vel: {x,y,z}, yawRate } in the ROOT frame's axes: its axes are the root's turned about +Y by
// `yaw` (c, s = cos, sin of it) and its origin is where its centre is; `vel` and `yawRate` say how they move. Local -> root:
//   p_root = origin + R(yaw) p,   R(a): x' = x cos a + z sin a, z' = -x sin a + z cos a (+Z -> +X).
// Change a frame only through setFrameState(), so c and s stay in step.
// ============================================================================

export function makeFrame(id) { return { id, origin: { x: 0, y: 0, z: 0 }, yaw: 0, c: 1, s: 0, vel: { x: 0, y: 0, z: 0 }, yawRate: 0 }; }

/** k = { c: centre, v: velocity, yaw, yawRate } (frames.js worldKin). */
export function setFrameState(frame, k) {
  const o = frame.origin; o.x = k.c.x; o.y = k.c.y; o.z = k.c.z;
  frame.yaw = k.yaw; frame.c = Math.cos(k.yaw); frame.s = Math.sin(k.yaw);
  const v = frame.vel || (frame.vel = { x: 0, y: 0, z: 0 }); v.x = k.v.x; v.y = k.v.y; v.z = k.v.z;
  frame.yawRate = k.yawRate;
  return frame;
}

/** A point in frame `from`, expressed in frame `to`. `out` may be `p`. */
export function framePoint(from, to, p, out = {}) {
  const rx = from.origin.x + p.x * from.c + p.z * from.s, ry = from.origin.y + p.y, rz = from.origin.z - p.x * from.s + p.z * from.c;
  const dx = rx - to.origin.x, dy = ry - to.origin.y, dz = rz - to.origin.z;
  out.x = dx * to.c - dz * to.s; out.y = dy; out.z = dx * to.s + dz * to.c;
  return out;
}
/** A direction (or an offset) in `from`'s axes, in `to`'s. `out` may be `v`. */
export function frameDir(from, to, v, out = {}) {
  const rx = v.x * from.c + v.z * from.s, rz = -v.x * from.s + v.z * from.c;
  out.x = rx * to.c - rz * to.s; out.y = v.y; out.z = rx * to.s + rz * to.c;
  return out;
}
/** The velocity, in `to`'s axes, of a point at `p` (frame `from`) moving at `v` (frame `from`): both frames' own motion is included. `out` may be `v`. */
export function frameVel(from, to, p, v, out = {}) {
  const qx = p.x * from.c + p.z * from.s, qz = -p.x * from.s + p.z * from.c;
  const rvx = from.vel.x + (v.x * from.c + v.z * from.s) + from.yawRate * qz, rvy = from.vel.y + v.y, rvz = from.vel.z + (-v.x * from.s + v.z * from.c) - from.yawRate * qx;
  const rx = from.origin.x + qx - to.origin.x, rz = from.origin.z + qz - to.origin.z;
  const wx = rvx - to.vel.x - to.yawRate * rz, wy = rvy - to.vel.y, wz = rvz - to.vel.z + to.yawRate * rx;
  out.x = wx * to.c - wz * to.s; out.y = wy; out.z = wx * to.s + wz * to.c;
  return out;
}
/** The turn (radians about +Y) that carries a direction in `from`'s axes into `to`'s. */
export const frameTurn = (from, to) => from.yaw - to.yaw;
