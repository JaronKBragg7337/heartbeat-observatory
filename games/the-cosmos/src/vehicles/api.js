// ============================================================================
// vehicles/api.js — board, seat, drive, leave. No renderer, no DOM, no field.
//
// OPENING CONTRACT. The opening (src/opening/) calls these four functions and
// nothing else in this folder. The type string is 'survey'. Do not import the
// opening from here; the opening may import this file.
//
//   createVehicle('survey', { id, owner, pose })
//   board(vehicle, actorId, seatId?)  → { ok, seat } or { ok:false, msg }
//   seat(vehicle, actorId, seatId)    → { ok, seat } or { ok:false, msg }
//   leave(vehicle, actorId)           → { ok } or { ok:false, msg }
//   drive(vehicle, { throttle, steer }, dt, env)
//
// env is supplied by the caller (support.js on a planet or a deck):
//   axes(pose) → { up, north, east }   unit vectors, east × north = up on flat ground
//   sample(x, y, z) → { point, normal } | null
//   gravity(point) → m/s² downward
//   edge?(pose) → { tried } | null     past a lowered ramp, the rover has left the deck
//   blocked?(point) → bool
//
// FRAME. Yaw 0 faces north. Positive yaw turns toward east (right).
//   forward = north * cos(yaw) + east * sin(yaw)
//   right   = forward × up
// Check, flat deck: north=(0,0,−1), up=(0,1,0), yaw 0 → forward=(0,0,−1), right=(1,0,0).
// Yaw π → forward=(0,0,+1), which is aft, toward the Meridian's cargo ramp.
// Vehicle local: +X right, +Y up, −Z nose. A local point (lx, ly, lz) is
//   pose + right*lx + up*ly + forward*(−lz).
// ============================================================================

import { vehicleDef } from './registry.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createVehicle(type, opts = {}) {
  const def = vehicleDef(type);
  const pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 0, ...(opts.pose || {}) };
  return {
    id: opts.id,
    type,
    owner: opts.owner ?? null,
    homeShipId: opts.homeShipId ?? null,
    parentShipId: opts.parentShipId ?? null,
    frameId: opts.frameId || 'mars',
    pose,
    passengers: { ...(opts.passengers || {}) },
    wheels: def.wheels.map(() => 0),
    transfer: opts.transfer || 0,
    locked: false,
    berth: null,
    world: opts.world ? { ...opts.world } : null,
  };
}

function seatById(def, id) {
  return def.seats.find((s) => s.id === id) || null;
}

/** Sit down. With no seatId, the driver seat if it is free, otherwise the first free seat. */
export function board(vehicle, actorId, seatId) {
  const def = vehicleDef(vehicle.type);
  if (!actorId) return { ok: false, msg: 'Nobody to sit down.' };
  if (Object.values(vehicle.passengers).includes(actorId)) return { ok: false, msg: 'You are already in this rover.' };
  let seat = seatId ? seatById(def, seatId) : null;
  if (seatId && !seat) return { ok: false, msg: 'That seat is not on this rover.' };
  if (!seat) seat = def.seats.find((s) => !vehicle.passengers[s.id]) || null;
  if (!seat) return { ok: false, msg: 'Every seat is taken.' };
  if (vehicle.passengers[seat.id]) return { ok: false, msg: 'That seat is taken.' };
  vehicle.passengers[seat.id] = actorId;
  return { ok: true, seat: seat.id };
}

/** Move to another seat in the same rover. */
export function seat(vehicle, actorId, seatId) {
  const def = vehicleDef(vehicle.type);
  const next = seatById(def, seatId);
  if (!next) return { ok: false, msg: 'That seat is not on this rover.' };
  const cur = Object.entries(vehicle.passengers).find(([, id]) => id === actorId);
  if (!cur) return { ok: false, msg: 'You are not in this rover.' };
  if (cur[0] === next.id) return { ok: true, seat: next.id };
  if (vehicle.passengers[next.id]) return { ok: false, msg: 'That seat is taken.' };
  delete vehicle.passengers[cur[0]];
  vehicle.passengers[next.id] = actorId;
  return { ok: true, seat: next.id };
}

export function leave(vehicle, actorId) {
  const cur = Object.entries(vehicle.passengers).find(([, id]) => id === actorId);
  if (!cur) return { ok: false, msg: 'You are not in this rover.' };
  delete vehicle.passengers[cur[0]];
  return { ok: true, seat: cur[0] };
}

export function add(a, b, s = 1) {
  return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s };
}
export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
export function norm(a) {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}
export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/** Heading basis. See the file header for the sign check. */
export function basis(yaw, axes) {
  const up = norm(axes.up);
  const north = norm(sub(axes.north, { x: up.x * dot(axes.north, up), y: up.y * dot(axes.north, up), z: up.z * dot(axes.north, up) }));
  // east = north × up. Flat check: north=(0,0,−1), up=(0,1,0) → (1,0,0).
  const east = norm(cross(north, up));
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const forward = norm({
    x: north.x * cy + east.x * sy,
    y: north.y * cy + east.y * sy,
    z: north.z * cy + east.z * sy,
  });
  // right = forward × up. Yaw 0 → (1,0,0).
  const right = norm(cross(forward, up));
  return { up, north, east, forward, right };
}

/** Vehicle-local point in the pose frame. lz is aft (+Z); the nose is −Z. */
export function localToFrame(pose, axes, lx, ly, lz) {
  const b = basis(pose.yaw, axes);
  return add(add(add(pose, b.right, lx), b.up, ly), b.forward, -lz);
}

/** Axis-aligned box of the rover in the pose frame, for the ship walker. */
export function footprint(vehicle, axes) {
  const def = vehicleDef(vehicle.type);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const sx of [-def.half.x, def.half.x]) {
    for (const sz of [-def.half.z, def.half.z]) {
      const p = localToFrame(vehicle.pose, axes, sx, 0, sz);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
  }
  return { x0, x1, y0, y1: y1 + def.half.y, z0, z1 };
}

/**
 * One integration step. Mutates vehicle.pose, vehicle.wheels.
 * throttle and steer are −1..1. Positive throttle drives toward the nose.
 * Positive steer increases yaw (turns right).
 */
export function drive(vehicle, input, dt, env) {
  const def = vehicleDef(vehicle.type);
  const pose = vehicle.pose;
  dt = clamp(Number(dt) || 0, 0, 0.1);
  if (dt <= 0) return { ok: true, left: false };
  const throttle = clamp(Number(input?.throttle) || 0, -1, 1);
  const steer = clamp(Number(input?.steer) || 0, -1, 1);
  const axes = env.axes(pose);
  const b = basis(pose.yaw, axes);
  const here = env.sample(pose.x, pose.y, pose.z);
  if (!here) {
    const edge = env.edge?.(pose);
    if (edge) return { ok: true, left: true, tried: edge.tried || { ...pose } };
    pose.speed = 0;
    return { ok: true, left: false, unsupported: true, tried: { ...pose } };
  }
  pose.x = here.point.x; pose.y = here.point.y; pose.z = here.point.z;

  const g = env.gravity(here.point);
  const probe = 0.6;
  const ahead = env.sample(pose.x + b.forward.x * probe, pose.y + b.up.y * probe, pose.z + b.forward.z * probe);
  const back = env.sample(pose.x - b.forward.x * probe, pose.y + b.up.y * probe, pose.z - b.forward.z * probe);
  let sinT = 0;
  if (ahead && back) {
    const dh = dot(sub(ahead.point, back.point), b.up);
    const slope = dh / (probe * 2);
    sinT = slope / Math.hypot(1, slope);
  }
  // Uphill (positive sinT) slows a positive speed.
  const gAlong = -g * sinT;
  const traction = Math.max(def.mass * g * 0.85, def.mass * 0.35);
  let force;
  if (Math.abs(throttle) > 0.04) {
    const opposing = throttle * pose.speed < -0.02;
    const cap = Math.abs(throttle) * (opposing ? def.brakeN : def.driveN);
    force = Math.sign(throttle) * Math.min(cap, traction);
  } else {
    const roll = Math.min(def.rollN, Math.abs(pose.speed) * def.mass / dt);
    force = -Math.sign(pose.speed || 0) * roll;
  }
  const drag = -pose.speed * Math.abs(pose.speed) * def.drag;
  let speed = pose.speed + (force / def.mass + gAlong + drag / def.mass) * dt;
  speed = clamp(speed, -def.reverseSpeed, def.maxSpeed);
  if (Math.abs(throttle) < 0.04 && Math.abs(speed) < 0.08 && Math.abs(gAlong) < 0.15) speed = 0;

  // Positive steer increases yaw. At a stand the nose still crawls so a pad can be lined up.
  const yawRate = steer * (0.45 + Math.abs(speed) / def.wheelbase);
  const newYaw = pose.yaw + yawRate * dt;
  const step = speed * dt;
  const next = {
    x: pose.x + b.forward.x * step,
    y: pose.y + b.forward.y * step,
    z: pose.z + b.forward.z * step,
    yaw: newYaw,
  };
  const ground = Math.abs(step) < 1e-6 ? here : env.sample(next.x, next.y, next.z);
  if (!ground) {
    const edge = env.edge?.(next);
    if (edge) {
      pose.speed = speed;
      pose.yaw = newYaw;
      return { ok: true, left: true, tried: edge.tried || next };
    }
    pose.speed = 0;
    return { ok: true, left: false, unsupported: true, tried: next };
  }
  const rise = dot(sub(ground.point, here.point), b.up);
  const run = Math.max(0.05, Math.abs(step));
  if (rise > 0.2 && rise / run > 0.9) {
    pose.speed = 0;
    return { ok: true, left: false, blocked: true, tried: ground.point };
  }
  if (env.blocked?.(ground.point)) {
    pose.speed = 0;
    return { ok: true, left: false, blocked: true, tried: ground.point };
  }
  pose.x = ground.point.x;
  pose.y = ground.point.y;
  pose.z = ground.point.z;
  pose.speed = speed;
  pose.yaw = newYaw;

  const b2 = basis(pose.yaw, env.axes(pose));
  let yF = 0, nF = 0, yR = 0, nR = 0, yL = 0, nL = 0, yRt = 0, nRt = 0;
  vehicle.wheels = def.wheels.map((w) => {
    const at = localToFrame(pose, env.axes(pose), w.x, 0, w.z);
    const hit = env.sample(at.x, at.y, at.z) || ground;
    const h = dot(sub(hit.point, ground.point), b2.up);
    if (w.z < -0.2) { yF += h; nF++; }
    if (w.z > 0.2) { yR += h; nR++; }
    if (w.x < 0) { yL += h; nL++; }
    if (w.x > 0) { yRt += h; nRt++; }
    return clamp(h, -0.15, 0.28);
  });
  const front = nF ? yF / nF : 0, rear = nR ? yR / nR : 0;
  const left = nL ? yL / nL : 0, rightH = nRt ? yRt / nRt : 0;
  // Positive pitch is nose-down (Three.js rotation.x on a −Z nose). Front higher → nose up → negative.
  pose.pitch = Math.atan2(-(front - rear), def.wheelbase);
  pose.roll = Math.atan2(rightH - left, def.track);
  return { ok: true, left: false, tried: { ...pose } };
}
