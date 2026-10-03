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
