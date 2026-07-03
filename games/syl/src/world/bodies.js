// ============================================================================
// bodies.js — DATA-DRIVEN celestial body registry. Pure data, no code logic.
//
// OWNS: the definition of every planet/moon/body in the game.
// DOES NOT OWN: meshes (planet.js), gravity math (planet.js), game state
//               (worldState.js), or faction data (factions.js — referenced by id).
//
// SYL CANON (from SpaceYouLand repo): SYL is a REAL SOLAR SYSTEM. There is
// never just "the planet" — every body is data, and the way one body is built
// is the reusable pattern for all of them. ADD A BODY = ADD AN ENTRY HERE.
// Nothing else in the codebase needs to change.
//
// SCALE — REAL vs APPROXIMATED (be honest, it's documented in DECISIONS.md):
//   realRadiusKm / realGravity record the true design-intent values (NASA-ish).
//   radius / surfaceGravity are the PLAYABLE game-unit values (meters, m/s²),
//   scaled down so a browser session crosses planet→planet in minutes.
//   The architecture (floating origin + analytic collision + f64 positions)
//   does NOT depend on this scale: raising radius toward real scale is a data
//   change plus terrain LOD work (see ROADMAP). Do not add flat-world hacks.
//
// FIELDS:
//   id, name          — stable id (save files use it) and display name
//   position          — world-space center [x,y,z] in meters (f64)
//   radius            — base terrain radius in game meters
//   surfaceGravity    — m/s² at the surface (inverse-square falls off above)
//   colors            — { low, mid, high, water? } terrain vertex-color ramp
//   atmosphere        — null, or { color, height (m), density 0..1 }
//   terrain           — { seed, amplitude (m), octaves, freq } for math3d.fbm
//   seaLevel          — null or meters above base radius (renders water shell)
//   ownerFactionId    — faction ownership hook (factions.js)
//   landingZones      — [{ id, name, dir:[x,y,z] (unit-ish, normalized at load),
//                         angularRadius (rad), flatten:true, structures?, factionId?,
//                         discovery? { resourceItemId, note } }]
//   spawn             — optional { zoneId } starting location for the player
//   realRadiusKm, realGravity, lore — design-intent record + flavor
// ============================================================================

export const BODIES = [
  {
    id: 'earth',
    name: 'Earth',
    position: [0, 0, 0],
    radius: 3000,
    surfaceGravity: 9.81,
    realRadiusKm: 6371, realGravity: 9.81,
    colors: { low: 0x2e4a2f, mid: 0x4a5d3a, high: 0x8d8d84, water: 0x1a3a5c },
    atmosphere: { color: 0x6ab7ff, height: 900, density: 1.0 },
    terrain: { seed: 1337, amplitude: 90, octaves: 6, freq: 3.0 },
    seaLevel: -12,
    ownerFactionId: 'fortis',
    landingZones: [
      {
        id: 'fortis_outpost',
        name: 'Fortis Outpost — North Pad',
        dir: [0.05, 1, 0.02],
        angularRadius: 0.045,
        flatten: true,
        factionId: 'fortis',
        structures: 'outpost',
        discovery: null,
      },
      {
        id: 'earth_relay_south',
        name: 'Abandoned Relay Station',
        dir: [0.3, -0.9, 0.4],
        angularRadius: 0.035,
        flatten: true,
        factionId: null,
        structures: 'relay',
        discovery: { resourceItemId: 'salvage_alloy', note: 'Pre-war relay hardware, stripped but salvageable.' },
      },
    ],
    spawn: { zoneId: 'fortis_outpost' },
    lore: 'Home. The Fortis Militaristic Empire holds the northern outpost line.',
  },
  {
    id: 'moon',
    name: 'Moon',
    position: [26000, 6000, -14000],
    radius: 950,
    surfaceGravity: 1.62,
    realRadiusKm: 1737.4, realGravity: 1.62,
    colors: { low: 0x5a5a60, mid: 0x77777d, high: 0x9a9aa0 },
    atmosphere: null,
    terrain: { seed: 4242, amplitude: 55, octaves: 5, freq: 4.0 },
    seaLevel: null,
    ownerFactionId: null, // contested — first faction to build here claims it
    landingZones: [
      {
        id: 'tranquility_pad',
        name: 'Tranquility Landing Field',
        dir: [-0.4, 0.7, 0.59],
        angularRadius: 0.06,
        flatten: true,
        factionId: 'meridian',
        structures: 'beacon',
        discovery: { resourceItemId: 'ore_regolith', note: 'Meridian Combine survey beacon. Regolith rich in oxides.' },
      },
    ],
    spawn: null,
    lore: 'Grey, silent, contested. The Meridian Combine planted the first beacon.',
  },
  {
    id: 'rustholm',
    name: 'Rustholm (Asteroid)',
    position: [-30000, -9000, 26000],
    radius: 320,
    surfaceGravity: 0.45,
    realRadiusKm: 220, realGravity: 0.11,
    colors: { low: 0x5c3a28, mid: 0x7a4a2e, high: 0x93613c },
    atmosphere: null,
    terrain: { seed: 9001, amplitude: 60, octaves: 5, freq: 5.0 },
    seaLevel: null,
    ownerFactionId: 'freeport',
    landingZones: [
      {
        id: 'freeport_claim',
        name: 'Freeport Claim 7',
        dir: [0.8, 0.5, -0.3],
        angularRadius: 0.09,
        flatten: true,
        factionId: 'freeport',
        structures: 'beacon',
        discovery: { resourceItemId: 'fuel_hydrazine', note: 'Syndicate fuel cache. They will remember if you take it.' },
      },
    ],
    spawn: null,
    lore: 'A captured rock the Freeport Syndicate runs fuel through. Third body proving the registry scales.',
  },
];

export function getBody(id) {
  const b = BODIES.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown body id: ${id}`);
  return b;
}
