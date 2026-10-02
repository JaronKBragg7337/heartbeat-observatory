import { AVATAR } from './shipSpec.js';

// The same hull envelope is used for the active ship and every shared hull.
// A closed boarding permission closes the openings, even if the ramp is down.
export function mayBoard(ship, playerId) {
  return ship.owner === playerId || !!ship.crewMayBoard ||
    ['disabled', 'abandoned'].includes(ship.npc?.state);
}
export function hullPush(def, state, loc, openings = true) {
  const P = def.hull.push, keel = def.gear.keelY;
  if (loc.y > P.topY || loc.y + AVATAR.heightM < keel - .05 || loc.z < P.zNose || loc.z > P.zTail) return null;
  const rc = state.ramps;
  if (openings && rc.cargo.lowered && loc.z > P.rampGap.z && Math.abs(loc.x) < P.rampGap.hw) return null;
  if (openings && rc.airlock.lowered && loc.x < P.hatch.x && Math.abs(loc.z - P.hatch.z) < P.hatch.r) return null;
  const hw = P.hwAt(loc.z) + AVATAR.radiusM;
  if (Math.abs(loc.x) >= hw) return null;
  const x = (hw - Math.abs(loc.x)) * Math.sign(loc.x || 1);
  const z = loc.z < 0 ? P.zNose - loc.z : P.zTail - loc.z;
  return Math.abs(x) < Math.abs(z) ? { x, z: 0, blockedVel: true } : { x: 0, z, blockedVel: true };
}
