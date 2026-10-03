// Ground under a rover: a planet density field, or a ship's cargo deck and ramp.
// No renderer. The drive() in api.js calls sample / axes / gravity / edge / blocked.

import { groundBelow, normalAt } from '../world/field.js';
import { cartesianToGeodetic, localFrame } from '../world/geodesy.js';
import { gravityAtRadius } from '../world/bodies.js';
import { DECK_GRAVITY } from '../ship/shipWalker.js';

/** Ship-local flat frame. Yaw 0 faces the bow (−Z). */
export const SHIP_AXES = {
  up: { x: 0, y: 1, z: 0 },
  north: { x: 0, y: 0, z: -1 },
  east: { x: 1, y: 0, z: 0 },
};

function rampHit(x, z, ramp, st) {
  if (!st || (!st.lowered && (st.progress || 0) < 0.98)) return null;
  const along = (x - ramp.hinge.x) * ramp.dir.x + (z - ramp.hinge.z) * ramp.dir.z;
  const across = ramp.dir.z ? (x - ramp.hinge.x) : (z - ramp.hinge.z);
  const run = ramp.length * Math.cos(st.angle);
  if (along < -0.05 || along > run + 0.2 || Math.abs(across) > ramp.width / 2) return null;
  const s = Math.sin(st.angle), c = Math.cos(st.angle);
  // Horizontal distance `along` sits on the panel: y = −tan(angle) * along.
  // Tip check: along = length*cos, y = −length*sin. Matches the crew's tip point.
  const y = ramp.hinge.y - Math.tan(st.angle) * Math.max(0, along);
  // Normal leans downhill. angle 0 → (0,1,0). Gravity along the downhill tangent is +g·sin.
  return {
    along, run, y, lowered: !!st.lowered,
    normal: { x: ramp.dir.x * s, y: c, z: ramp.dir.z * s },
  };
}

/**
 * Deck under a parented rover. `deck` is the cargo floor rect. `landed` is a function.
 * Obstacles are furniture boxes in ship-local metres; the centre may not enter them.
 */
export function makeShipEnv({ ramps, rampState, landed, deck, obstacles = [], gravity = DECK_GRAVITY }) {
  const cargo = ramps.cargo;
  const onDeck = (x, z) => x >= deck.x0 && x <= deck.x1 && z >= deck.z0 && z <= deck.z1 + 0.05;
  return {
    gravity() { return gravity; },
    axes() { return SHIP_AXES; },
    sample(x, y, z) {
      const ramp = rampHit(x, z, cargo, rampState.cargo);
      if (onDeck(x, z) && (!ramp || ramp.along < 0.25)) {
        return { point: { x, y: deck.y, z }, normal: { x: 0, y: 1, z: 0 } };
      }
      if (ramp) return { point: { x, y: ramp.y, z }, normal: ramp.normal };
      return null;
    },
    edge(p) {
      const st = rampState.cargo;
      if (!landed() || !st?.lowered) return null;
      const along = (p.x - cargo.hinge.x) * cargo.dir.x + (p.z - cargo.hinge.z) * cargo.dir.z;
      const across = cargo.dir.z ? (p.x - cargo.hinge.x) : (p.z - cargo.hinge.z);
      const run = cargo.length * Math.cos(st.angle);
      if (along > run - 0.05 && Math.abs(across) < cargo.width / 2) {
        return { tried: { x: p.x, y: p.y, z: p.z, yaw: p.yaw } };
      }
      return null;
    },
    blocked(point) {
      const ramp = rampHit(point.x, point.z, cargo, rampState.cargo);
      const onRamp = ramp && ramp.along > 0.3;
      if (!onRamp) {
        if (point.x < deck.x0 + 1.2 || point.x > deck.x1 - 1.2) return true;
        if (point.z < deck.z0 + 2.1) return true;
      }
      for (const o of obstacles) {
        if (point.x > o.x0 - 0.35 && point.x < o.x1 + 0.35 && point.z > o.z0 - 0.35 && point.z < o.z1 + 0.35 && point.y < (o.y1 ?? 2)) return true;
      }
      return false;
    },
  };
}

/** Density-field support. Points are in the body's frame (Mars-centred, or moon-local). */
export function makePlanetEnv(body) {
  const lift = (x, y, z, h) => {
    const r = Math.hypot(x, y, z) || 1;
    return { x: x + (x / r) * h, y: y + (y / r) * h, z: z + (z / r) * h };
  };
  const drop = (x, y, z) => {
    const up = lift(x, y, z, 2.5);
    let hit = groundBelow(body, up.x, up.y, up.z, 8);
    if (!hit || hit.startedInside) {
      const higher = lift(x, y, z, 14);
      hit = groundBelow(body, higher.x, higher.y, higher.z, 30);
    }
    if (!hit || hit.startedInside) return null;
    // A query parked on the ground is 2.5 m above it. Farther than that is a drop we do not drive off.
    if (hit.distance > 6) return null;
    const n = normalAt(body, hit.point.x, hit.point.y, hit.point.z);
    return { point: hit.point, normal: n };
  };
  return {
    gravity(p) { return gravityAtRadius(body, Math.hypot(p.x, p.y, p.z)); },
    axes(p) {
      const g = cartesianToGeodetic(body, p.x, p.y, p.z);
      const f = localFrame(g.lat, g.lon);
      return { up: f.up, north: f.north, east: f.east };
    },
    sample(x, y, z) { return drop(x, y, z); },
  };
}
