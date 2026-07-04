// ============================================================================
// items_expanded.js — ADDITIONAL items/resources/parts for SYL.
//
// OWNS: new item definitions following the exact items.js schema.
// DOES NOT OWN: inventory, ship parts, or crafting logic.
//
// INTEGRATION: Import alongside ITEMS in items.js, or merge:
//   import { ITEMS } from './items.js';
//   import { ITEMS_EXPANDED } from './items_expanded.js';
//   const ALL_ITEMS = [...ITEMS, ...ITEMS_EXPANDED];
//
// New resource tiers:
//   Tier 1: Raw (ore, ice, scrap)
//   Tier 2: Refined (ingots, crystals, processed materials)
//   Tier 3: Manufactured (advanced parts, components)
// ============================================================================

export const ITEMS_EXPANDED = [
  // --- Tier 1: Raw Resources ---
  { id: 'titanium_ore', name: 'Titanium Ore', kind: 'resource', mass: 7, description: 'Dense volcanic ore. Requires refining before use in ship construction.' },
  { id: 'water_ice', name: 'Water Ice', kind: 'resource', mass: 5, description: 'Frozen water from ice moons. Can be cracked into hydrogen for fuel or life support.' },
  { id: 'crystal_matrix', name: 'Crystal Matrix', kind: 'resource', mass: 3, description: 'Unstable crystalline formations. Used in sensor arrays and shield generators.' },
  { id: 'exotic_matter', name: 'Exotic Matter Sample', kind: 'resource', mass: 2, description: 'Volatile anomalous material. Extreme value, extreme danger. Handle carefully.' },
  { id: 'scrap_electronics', name: 'Scrap Electronics', kind: 'resource', mass: 2, description: 'Salvaged circuit boards and processors. Rich in rare elements.' },
  { id: 'nickel_iron', name: 'Nickel-Iron Chunk', kind: 'resource', mass: 8, description: 'Raw asteroid metal. Dense and heavy. Foundation for structural alloys.' },

  // --- Tier 2: Refined Materials ---
  { id: 'titanium_ingot', name: 'Titanium Ingot', kind: 'resource', mass: 5, description: 'Refined titanium. Lightweight, strong. Used in advanced hull and engine parts.' },
  { id: 'hydrogen_cracked', name: 'Cracked Hydrogen', kind: 'fuel', mass: 4, fuelUnits: 40, description: 'High-grade hydrogen fuel from water ice cracking. More efficient than hydrazine.' },
  { id: 'sensor_crystal', name: 'Sensor Crystal', kind: 'resource', mass: 2, description: 'Stabilized crystal matrix. Core component of sensor and scanner modules.' },
  { id: 'alloy_composite', name: 'Composite Alloy', kind: 'resource', mass: 6, description: 'Layered titanium-nickel alloy. Used in heavy armor and reinforced structures.' },
  { id: 'circuit_board', name: 'Circuit Board', kind: 'resource', mass: 1, description: 'Manufactured electronics board. Powers advanced ship systems.' },
  { id: 'reactor_core', name: 'Reactor Core', kind: 'resource', mass: 12, description: 'Contained fusion core. Dangerous but essential for reactor modules.' },

  // --- Tier 3: Manufactured Parts (installable) ---
  { id: 'part_reactor', name: 'Fusion Reactor Module', kind: 'part', partId: 'reactor', mass: 45, description: 'Advanced power generation. Replaces or supplements basic power cells.' },
  { id: 'part_shield', name: 'Shield Generator Module', kind: 'part', partId: 'shield', mass: 28, description: 'Energy shield projector. Absorbs kinetic and energy damage before hull.' },
  { id: 'part_scanner', name: 'Sensor Array Module', kind: 'part', partId: 'scanner', mass: 15, description: 'Long-range detection and scanning. Essential for exploration and trade.' },
  { id: 'part_radiator', name: 'Heat Radiator Module', kind: 'part', partId: 'radiator', mass: 22, description: 'Thermal management system. Critical for operating near stars or in storms.' },
  { id: 'part_adv_engine', name: 'Advanced Thruster Module', kind: 'part', partId: 'adv_engine', mass: 55, description: 'High-efficiency main thruster. Significantly increases thrust-to-weight.' },
  { id: 'part_maneuver', name: 'Maneuvering Thruster Module', kind: 'part', partId: 'maneuver', mass: 12, description: 'Attitude control thrusters. Improves ship rotation and precision landing.' },
  { id: 'part_weapon', name: 'Weapon Hardpoint Module', kind: 'part', partId: 'weapon', mass: 30, description: 'Kinetic weapon mount. Combat-ready but power-hungry.' },
  { id: 'part_cargo_adv', name: 'Reinforced Cargo Pod Module', kind: 'part', partId: 'cargo_adv', mass: 35, description: 'Heavy-duty cargo container with integrated armor plating.' },
  { id: 'part_hull_heavy', name: 'Heavy Armor Plating Module', kind: 'part', partId: 'hull_heavy', mass: 38, description: 'Thick composite armor. Dramatically increases survivability at cost of mass.' },
];
