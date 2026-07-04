// ============================================================================
// shipParts_expanded.js — ADDITIONAL ship module types and slot layouts.
//
// OWNS: new part type definitions (shield, scanner, radiator, reactor, weapon,
//       advanced engine, maneuvering thruster) and extended slot layouts.
// DOES NOT OWN: ship live state, install logic, or UI.
//
// INTEGRATION: Import alongside PART_TYPES in shipParts.js, or merge into it.
//   import { PART_TYPES_EXPANDED } from './shipParts_expanded.js';
//   Object.assign(PART_TYPES, PART_TYPES_EXPANDED);
//
// CANON: These are new modules for the Fortis Gunship pattern and future variants.
// No existing part IDs changed.
// ============================================================================

export const PART_TYPES_EXPANDED = {
  // --- Advanced Power ---
  reactor: {
    id: 'reactor', name: 'Fusion Reactor', mass: 45, required: false, maxHp: 100,
    powerSupply: 18, powerDraw: 1,
    visual: { kind: 'box', size: [1.6, 1.6, 2.4], color: 0x00acc1 }
  },
  // --- Defense ---
  shield: {
    id: 'shield', name: 'Shield Generator', mass: 28, required: false, maxHp: 80,
    shieldCap: 150, shieldRecharge: 8, powerDraw: 4,
    visual: { kind: 'box', size: [1.2, 0.8, 1.6], color: 0x7c4dff }
  },
  // --- Sensors ---
  scanner: {
    id: 'scanner', name: 'Sensor Array', mass: 15, required: false, maxHp: 60,
    scanRange: 5000, powerDraw: 2,
    visual: { kind: 'cyl', size: [0.4, 1.2], color: 0x00e676 }
  },
  // --- Thermal Management ---
  radiator: {
    id: 'radiator', name: 'Heat Radiator', mass: 22, required: false, maxHp: 70,
    heatDissipation: 40,
    visual: { kind: 'box', size: [2.0, 0.15, 1.8], color: 0xb0bec5 }
  },
  // --- Propulsion ---
  adv_engine: {
    id: 'adv_engine', name: 'Advanced Thruster', mass: 55, required: false, maxHp: 110,
    thrust: 8200, powerDraw: 5,
    visual: { kind: 'cyl', size: [0.9, 2.2], color: 0x00838f }
  },
  maneuver: {
    id: 'maneuver', name: 'Maneuvering Thruster', mass: 12, required: false, maxHp: 50,
    torqueBoost: 0.35, powerDraw: 1,
    visual: { kind: 'cyl', size: [0.3, 0.8], color: 0xff6d00 }
  },
  // --- Combat (placeholder) ---
  weapon: {
    id: 'weapon', name: 'Weapon Hardpoint', mass: 30, required: false, maxHp: 90,
    weaponDamage: 45, powerDraw: 3,
    visual: { kind: 'box', size: [1.0, 0.6, 1.4], color: 0xd32f2f }
  },
  // --- Cargo / Utility ---
  cargo_adv: {
    id: 'cargo_adv', name: 'Reinforced Cargo Pod', mass: 35, required: false, maxHp: 100,
    cargoCap: 500, armor: 10,
    visual: { kind: 'box', size: [1.8, 1.4, 2.6], color: 0x455a64 }
  },
  // --- Hull variants ---
  hull_heavy: {
    id: 'hull_heavy', name: 'Heavy Armor Plating', mass: 38, required: false, maxHp: 180,
    armor: 55,
    visual: { kind: 'box', size: [2.6, 0.35, 6.0], color: 0x263238 }
  },
};

// Extended slots for the Fortis Gunship pattern (additional hardpoints).
// These supplement SLOTS in shipParts.js; they use the same slotId schema.
export const SLOTS_EXPANDED = [
  { slotId: 'reactor_bay', accepts: 'reactor', offset: [0, 1.2, -1.8] },
  { slotId: 'shield_nose', accepts: 'shield', offset: [0, 0.5, 3.2] },
  { slotId: 'scanner_top', accepts: 'scanner', offset: [0, 1.6, 0.8] },
  { slotId: 'radiator_port', accepts: 'radiator', offset: [-1.8, 0.9, -0.8] },
  { slotId: 'radiator_starboard', accepts: 'radiator', offset: [1.8, 0.9, -0.8] },
  { slotId: 'engine_adv', accepts: 'adv_engine', offset: [0, 0.5, -4.2], rotate: 'back' },
  { slotId: 'maneuver_fl', accepts: 'maneuver', offset: [-1.4, 0.3, 2.0] },
  { slotId: 'maneuver_fr', accepts: 'maneuver', offset: [1.4, 0.3, 2.0] },
  { slotId: 'maneuver_rl', accepts: 'maneuver', offset: [-1.4, 0.3, -2.4] },
  { slotId: 'maneuver_rr', accepts: 'maneuver', offset: [1.4, 0.3, -2.4] },
  { slotId: 'weapon_wing_l', accepts: 'weapon', offset: [-2.2, 0.4, 0.2] },
  { slotId: 'weapon_wing_r', accepts: 'weapon', offset: [2.2, 0.4, 0.2] },
  { slotId: 'cargo_adv_belly', accepts: 'cargo_adv', offset: [0, -1.4, -0.2] },
  { slotId: 'hull_heavy_top', accepts: 'hull_heavy', offset: [0, 1.7, -0.4] },
  { slotId: 'hull_heavy_bottom', accepts: 'hull_heavy', offset: [0, -1.9, -0.4] },
];
