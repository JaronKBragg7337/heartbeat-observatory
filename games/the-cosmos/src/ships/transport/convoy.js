// ============================================================================
// ships/transport/convoy.js - the ships that fly beside the player's transport in the opening (BIBLE-v3 10.1: "huge ships fly beside you,
// close enough to read their names"). Pure data and maths, server-safe: the opening's builder places each entry relative to the player's
// transport and draws it with visualsFor(type).buildExterior, painting the name with visualsFor(type).decalTexture(THREE, def, name, registry).
//
// A pose is in the PLAYER TRANSPORT'S frame (x starboard, y up, -z forward, metres), with a slow sway so the ships never sit like furniture.
// Distances are chosen so a hull name (about 1 m letters on the transport, 0.9 m on the bulker) can be read: the nearest neighbours are 55 to
// 90 m off the flank. Names are the lines' own jokes: a bulker that insists it is not a smuggler, an escort that is very sorry about the paperwork.
// ============================================================================

export const PLAYER_TRANSPORT = { type: 'transport', name: 'Hellas Dawn', registry: 'MR-0412' };

/** The company the player's transport keeps. offset: where it holds station; sway: amplitude (m) and period (s) per axis. */
export const OPENING_CONVOY = [
  { id: 'sister-1', type: 'transport', name: 'Tharsis Promise', registry: 'MR-0377', offset: { x: -104, y: 22, z: -38 }, sway: { x: [1.4, 41], y: [0.9, 29], z: [2.2, 53] }, yawDeg: 0.6 },
  { id: 'sister-2', type: 'transport', name: 'Elysium Overdraft', registry: 'MR-0391', offset: { x: 118, y: -22, z: 60 }, sway: { x: [1.8, 47], y: [1.1, 31], z: [2.6, 59] }, yawDeg: -0.8 },
  { id: 'bulker-1', type: 'bulker', name: 'Not A Smuggler', registry: 'MR-1207', offset: { x: -150, y: -30, z: 110 }, sway: { x: [2.5, 61], y: [1.4, 43], z: [4.0, 71] }, yawDeg: 0.3 },
  { id: 'bulker-2', type: 'bulker', name: 'Regolith Dreams', registry: 'MR-1231', offset: { x: 70, y: 38, z: -140 }, sway: { x: [2.2, 67], y: [1.6, 37], z: [3.6, 73] }, yawDeg: -0.4 },
  { id: 'escort-1', type: 'escort', name: 'Very Sorry About The Paperwork', registry: 'MR-2014', offset: { x: -48, y: 6, z: 20 }, sway: { x: [2.0, 23], y: [1.2, 19], z: [3.0, 31] }, yawDeg: 1.2 },
  { id: 'escort-2', type: 'escort', name: 'Quick Receipt', registry: 'MR-2019', offset: { x: 66, y: -8, z: -24 }, sway: { x: [2.4, 27], y: [1.0, 17], z: [3.4, 37] }, yawDeg: -1.0 },
];

/** Where a convoy entry is at time t (seconds): the offset plus a sum-of-sines sway, with a small bank into the sway. */
export function convoyPose(entry, t) {
  const w = (a) => a[0] * Math.sin((2 * Math.PI * t) / a[1] + entry.offset.x * 0.013);
  const x = entry.offset.x + w(entry.sway.x), y = entry.offset.y + w(entry.sway.y), z = entry.offset.z + w(entry.sway.z);
  return { x, y, z, yawDeg: entry.yawDeg + 0.4 * Math.sin((2 * Math.PI * t) / 83), pitchDeg: 0.3 * Math.sin((2 * Math.PI * t) / 47), rollDeg: 1.2 * Math.sin((2 * Math.PI * t) / entry.sway.x[1] + 1) };
}

/** The distance from the player transport's centre to an entry at time t, metres. */
export function convoyDistance(entry, t = 0) { const p = convoyPose(entry, t); return Math.hypot(p.x, p.y, p.z); }
