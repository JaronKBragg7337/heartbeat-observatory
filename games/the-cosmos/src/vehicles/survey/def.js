// Survey rover. One definition, used by the Meridian's hold, the depot, and (later) the opening.
// The opening calls the vehicle API with type 'survey'. It does not import this file's mesh.
//
// Frame: +X right, +Y up, −Z nose. Same as a ship. Yaw 0 faces north; positive yaw turns toward east.
// A berth yaw of π parks the nose toward the Meridian's aft ramp.

export const SURVEY = {
  type: 'survey',
  class: 'Survey rover',
  priceMarks: 2400, // 600 credits. A raider is 2400 credits; a new pilot starts with 2500.
  mass: 940,
  driveN: 3400,
  brakeN: 7000,
  rollN: 450,
  drag: 8,
  maxSpeed: 8,
  reverseSpeed: 5,
  wheelRadius: 0.42,
  wheelbase: 2.9,
  track: 2.1,
  half: { x: 1.15, y: 1.72, z: 2.15 },
  eye: 1.05,
  doorReach: 2.6,
  wheels: [
    { id: 'fl', x: -1.05, z: -1.45 },
    { id: 'fr', x: 1.05, z: -1.45 },
    { id: 'ml', x: -1.05, z: 0 },
    { id: 'mr', x: 1.05, z: 0 },
    { id: 'rl', x: -1.05, z: 1.45 },
    { id: 'rr', x: 1.05, z: 1.45 },
  ],
  seats: [
    { id: 'driver', name: 'Driver', x: -0.42, y: 0.72, z: -0.85 },
    { id: 'right', name: 'Right', x: 0.42, y: 0.72, z: -0.85 },
    { id: 'rear-left', name: 'Rear left', x: -0.42, y: 0.62, z: 0.55 },
    { id: 'rear-right', name: 'Rear right', x: 0.42, y: 0.62, z: 0.55 },
  ],
  doors: [
    { id: 'left', x: -1.35, z: -0.2 },
    { id: 'right', x: 1.35, z: -0.2 },
  ],
  // Meridian cargo bay, centreline, nose toward the ramp (local +Z when yaw is π).
  berth: {
    ships: ['meridian'],
    pose: { x: 0, y: 0, z: 16, yaw: Math.PI, pitch: 0, roll: 0, speed: 0 },
  },
};
