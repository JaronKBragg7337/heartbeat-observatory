// ============================================================================
// pickups.js — deterministic salvage crate placement.
//
// OWNS: pickup spawn data only. main.js instantiates the meshes and handles
//       gathering; save.js persists collected ids. Crates are one-shot today:
//       proper respawn/resource nodes belong in a future spawner system.
//
// Placement is relative to landing-zone frames: east/north are meters on the
// local tangent plane. Stable ids keep old saves valid.
// ============================================================================

export const PICKUPS = [
  // Around the Fortis outpost pad — more than the minimum repair loop so Jaron
  // can miss a crate and still get airborne for testing.
  { id: 'earth:fortis:0', bodyId: 'earth', zoneId: 'fortis_outpost', east: 26, north: 14, itemId: 'part_power' },
  { id: 'earth:fortis:1', bodyId: 'earth', zoneId: 'fortis_outpost', east: -30, north: 22, itemId: 'part_gear' },
  { id: 'earth:fortis:2', bodyId: 'earth', zoneId: 'fortis_outpost', east: -18, north: -34, itemId: 'fuel_hydrazine' },
  { id: 'earth:fortis:3', bodyId: 'earth', zoneId: 'fortis_outpost', east: 8, north: -42, itemId: 'fuel_hydrazine' },
  { id: 'earth:fortis:4', bodyId: 'earth', zoneId: 'fortis_outpost', east: 44, north: -12, itemId: 'fuel_hydrazine' },
  { id: 'earth:fortis:5', bodyId: 'earth', zoneId: 'fortis_outpost', east: 52, north: 26, itemId: 'fuel_hydrazine' },
  { id: 'earth:fortis:6', bodyId: 'earth', zoneId: 'fortis_outpost', east: -48, north: -8, itemId: 'salvage_alloy' },
  { id: 'earth:fortis:7', bodyId: 'earth', zoneId: 'fortis_outpost', east: -52, north: 30, itemId: 'salvage_alloy' },
  { id: 'earth:fortis:8', bodyId: 'earth', zoneId: 'fortis_outpost', east: 20, north: 48, itemId: 'salvage_alloy' },
  { id: 'earth:fortis:9', bodyId: 'earth', zoneId: 'fortis_outpost', east: 36, north: 40, itemId: 'salvage_alloy' },
  { id: 'earth:fortis:10', bodyId: 'earth', zoneId: 'fortis_outpost', east: -8, north: 52, itemId: 'wiring_loom' },
  { id: 'earth:fortis:11', bodyId: 'earth', zoneId: 'fortis_outpost', east: 58, north: 2, itemId: 'wiring_loom' },
  { id: 'earth:fortis:12', bodyId: 'earth', zoneId: 'fortis_outpost', east: -38, north: -40, itemId: 'wiring_loom' },
  { id: 'earth:fortis:13', bodyId: 'earth', zoneId: 'fortis_outpost', east: 70, north: -30, itemId: 'fuel_hydrazine' },
  { id: 'earth:fortis:14', bodyId: 'earth', zoneId: 'fortis_outpost', east: -72, north: 4, itemId: 'salvage_alloy' },
  { id: 'earth:fortis:15', bodyId: 'earth', zoneId: 'fortis_outpost', east: 12, north: 72, itemId: 'wiring_loom' },

  // Nearby salvage yard — reachable on foot from spawn and gives the base area
  // a second meaningful place with structures and supplies.
  { id: 'earth:yard:0', bodyId: 'earth', zoneId: 'fortis_salvage_yard', east: -26, north: 18, itemId: 'fuel_hydrazine' },
  { id: 'earth:yard:1', bodyId: 'earth', zoneId: 'fortis_salvage_yard', east: -6, north: -24, itemId: 'fuel_hydrazine' },
  { id: 'earth:yard:2', bodyId: 'earth', zoneId: 'fortis_salvage_yard', east: 26, north: -4, itemId: 'salvage_alloy' },
  { id: 'earth:yard:3', bodyId: 'earth', zoneId: 'fortis_salvage_yard', east: 36, north: 20, itemId: 'salvage_alloy' },
  { id: 'earth:yard:4', bodyId: 'earth', zoneId: 'fortis_salvage_yard', east: -34, north: -18, itemId: 'wiring_loom' },
  { id: 'earth:yard:5', bodyId: 'earth', zoneId: 'fortis_salvage_yard', east: 8, north: 34, itemId: 'part_fuel' },
  { id: 'earth:yard:6', bodyId: 'earth', zoneId: 'fortis_salvage_yard', east: 44, north: -22, itemId: 'part_hull' },

  // Relay site — reward for exploring Earth by ship.
  { id: 'earth:relay:0', bodyId: 'earth', zoneId: 'earth_relay_south', east: 10, north: 6, itemId: 'salvage_alloy' },
  { id: 'earth:relay:1', bodyId: 'earth', zoneId: 'earth_relay_south', east: -12, north: 10, itemId: 'part_cargo' },

  // Moon field — fuel for the trip home + spare engine.
  { id: 'moon:tranq:0', bodyId: 'moon', zoneId: 'tranquility_pad', east: 14, north: -10, itemId: 'fuel_hydrazine' },
  { id: 'moon:tranq:1', bodyId: 'moon', zoneId: 'tranquility_pad', east: -16, north: 12, itemId: 'fuel_hydrazine' },
  { id: 'moon:tranq:2', bodyId: 'moon', zoneId: 'tranquility_pad', east: 22, north: 16, itemId: 'part_engine' },

  // Rustholm cache.
  { id: 'rust:claim:0', bodyId: 'rustholm', zoneId: 'freeport_claim', east: 8, north: 8, itemId: 'fuel_hydrazine' },
  { id: 'rust:claim:1', bodyId: 'rustholm', zoneId: 'freeport_claim', east: -10, north: 6, itemId: 'fuel_hydrazine' },
];

