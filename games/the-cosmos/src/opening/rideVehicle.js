// Opening passenger adapter. A future rover can provide the same root, wheels
// and passengerEye; this module never owns driving, purchase or vehicle saves.
export function openingRideVehicle(vehicle) {
  if(!vehicle?.root||!Array.isArray(vehicle.wheels))throw Error('Invalid opening vehicle');
  return {...vehicle,passengerEye:vehicle.passengerEye||{x:.55,y:1.85,z:-1.15}};
}
export function ridePose(seconds,height) {
  const t=Math.max(0,Math.min(1,seconds/65)),ease=t*t*(3-2*t);
  const x=-7-2593*ease,z=23-373*ease;
  return {x,y:height(x,z),z,yaw:Math.atan2(2593,373)};
}
/** Height of the visible triangle under a point, with the authoritative field as a lower bound. */
export function rideSurfaceHeight(model, patches, x, z) {
  let y = model.height(x,z);
  const p = model.toWorld(x,y,z), l = Math.hypot(p.x,p.y,p.z), d = {x:p.x/l,y:p.y/l,z:p.z/l};
  // The fine patch masks the coarse one within its square.
  for (const patch of patches) {
    const r = patch.surfaceRadiusExact(d.x,d.y,d.z);
    if (r !== null && Number.isFinite(r)) { y=Math.max(y,model.toLocal({x:d.x*r,y:d.y*r,z:d.z*r}).y); break; }
  }
  return y;
}
export function rideSupportHeight(model, patches, x, z, yaw) {
  let y=-Infinity;
  for (const dx of [-1.6,0,1.6]) for (const dz of [-2.2,0,2.2]) {
    y=Math.max(y,rideSurfaceHeight(model,patches,x+Math.cos(yaw)*dx+Math.sin(yaw)*dz,z-Math.sin(yaw)*dx+Math.cos(yaw)*dz));
  }
  return y + .025;
}

// ---------------------------------------------------------------------------
// The shared survey rover (src/vehicles/, built by Grok Build) as the opening's
// ride. The opening touches the vehicle only through createVehicle/board/leave
// (the "opening contract" in vehicles/api.js) and the survey mesh; it owns no
// driving, purchase or ownership. Seats come from the definition, not from here.
// ---------------------------------------------------------------------------
import { createVehicle, board, leave } from '../vehicles/api.js';
import { vehicleDef } from '../vehicles/registry.js';
import { buildSurveyRover } from '../vehicles/survey/mesh.js';

export const OPENING_DRIVER = 'opening-driver', OPENING_PLAYER = 'opening-player';

/** Build the survey rover for the opening: { root, wheels, passengerEye, vehicle, def, driverSeat, seatPlayer(), unseatPlayer() }. */
export function surveyOpeningVehicle(materials, tier) {
  const def = vehicleDef('survey'), built = buildSurveyRover(materials, { tier });
  const vehicle = createVehicle('survey', { id: 'opening-rover' });
  const d = board(vehicle, OPENING_DRIVER, 'driver');
  if (!d.ok) throw Error('Opening driver could not take the wheel: ' + d.msg);
  const seatOf = id => def.seats.find(s => s.id === id);
  const out = {
    root: built.group, wheels: built.wheels, vehicle, def, dispose: built.group.userData.dispose,
    driverSeat: seatOf('driver'), passengerSeat: null, passengerEye: { x: 0.42, y: 1.8, z: -0.85 }, driverHead: 1.76, update: built.update, sync: built.sync,
    seatPlayer() {
      if (Object.values(vehicle.passengers).includes(OPENING_PLAYER)) return true;
      const r = board(vehicle, OPENING_PLAYER, 'right'); if (!r.ok) return false;
      out.passengerSeat = seatOf(r.seat);
      out.passengerEye = { x: out.passengerSeat.x, y: out.passengerSeat.y + def.eye, z: out.passengerSeat.z };
      return true;
    },
    unseatPlayer() { leave(vehicle, OPENING_PLAYER); out.passengerSeat = null; },
  };
  return out;
}
