// ============================================================================
// deepHold.js - a ship held out in deep space (F3): the long-range drive's last act.
//
// A ship that has dropped out off a world with no ground yet (Earth, the Moon, Callisto), or that was stopped between the worlds by a cancelled cruise,
// stays where it is IN SPACE. Mars's axes turn (F2: a sol in 24.66 h) and the worlds go round the Sun, so "at rest in Mars's turning frame" a hundred million
// kilometres out would be a ship doing 7,000 km/s round Mars. Instead the hold is a point in INERTIAL axes, fixed relative to the world she came to (it
// moves with it) or, stopped between worlds, fixed in inertial space. Every tick her coordinates (Mars's turning axes) and velocity are written from that
// point at the WORLD's clock (the long drive never runs her own clock ahead: a trip of weeks must end in the same sky the rest of the world is in).
// The state is `flight.deepHold = { sys, target, off }` (plain numbers: saved with the ship); a new course, or anything that takes the ship, clears it.
// ============================================================================
import { toFixed, velToFixed, worldKin } from './frames.js';
import { worldCentreInertial } from '../worlds/registry.js';

/** One tick of the hold: returns true (the override has moved the ship). `timeFn()` is the clock the sky is at (space.timeS). */
export function holdStep(f, dt, timeFn) {
  const h = f.deepHold;
  if (!h) return false;
  const T = timeFn();
  let c = { x: 0, y: 0, z: 0 }, vi = { x: 0, y: 0, z: 0 };
  if (h.target) { c = worldCentreInertial(h.target, T); vi = worldKin(h.target, T).vi; }
  const pI = { x: c.x + h.off.x, y: c.y + h.off.y, z: c.z + h.off.z };
  const p = toFixed(pI, T), v = velToFixed(pI, vi, T);
  f.pos.x = p.x; f.pos.y = p.y; f.pos.z = p.z; f.vel.x = v.x; f.vel.y = v.y; f.vel.z = v.z;
  f.landed = false; f.airborne = true; f.autoHover = false; f.thrustFwd = 0; f.thrustUp = 0;
  f.refreshOrientation();
  return true;
}

/** Take the ship's flight override for the hold (after a trip ends, a save is restored or the hull is handed back). */
export function installHold(f, timeFn) { f.override = (dt) => holdStep(f, dt, timeFn); }
