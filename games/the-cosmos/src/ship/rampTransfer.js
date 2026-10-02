// One geometric contract for both sides of the ship/planet handoff.
import { RAMPS, AVATAR } from './shipSpec.js';
export function rampEntry(key, state, local, motion, ramps = RAMPS) {   // FLEET: `ramps` is the ship definition's
  if(!state.lowered) return null;
  const r=ramps[key], run=r.length*Math.cos(state.angle);
  const along=(local.x-r.hinge.x)*r.dir.x+(local.z-r.hinge.z)*r.dir.z;
  const across=r.dir.z?Math.abs(local.x-r.hinge.x):Math.abs(local.z-r.hinge.z);
  // A trigger must never accept a shoulder outside the walker's supported zone.
  if(across>r.width/2-(AVATAR.radiusM-.03)-.02 || along<0 || along>run+.08) return null;
  const inward=motion.x*r.dir.x+motion.z*r.dir.z;
  if(inward>=-.03) return null; // standing still / walking off cannot board again
  const floor=r.hinge.y-Math.min(along,run)*Math.tan(state.angle);
  if(Math.abs(local.y-floor)>AVATAR.stepM) return null;
  return {x:local.x,y:floor,z:local.z};
}
