// ============================================================================
// shipParts.js — MODULAR SHIP PART registry: part types + attachment slots.
//
// OWNS: the definition of every ship module type and the ship's slot layout.
// DOES NOT OWN: a ship's live state (ship.js), install/repair actions
//               (shipBuilder.js), item pickups (items.js references partId).
//
// SYL LAW (from Kurearthis notes + project brief): THE SHIP IS NOT A PREFAB.
// A ship is a FRAME with SLOTS; modules are installed piece by piece, each
// with health, mass, and stat contributions. The player must repair/complete
// the ship before reliable travel — that is the first gameplay loop.
//
// STAT MODEL (deliberately simple, deliberately real):
//   mass       — sums; thrust/mass = acceleration. Heavier ships fly heavier.
//   thrust     — engines only (Newtons, game-scaled).
//   fuelCap    — fuel tanks. Thrusting burns fuel; no fuel = no thrust.
//   powerDraw / powerSupply — cockpit+engines draw, power cells supply;
//                readiness requires supply >= draw.
//   cargoCap   — cargo pods (future trading loop).
//   armor      — hull plates (future combat).
//   Health: each installed module has hp/maxHp. A module below 40% health is
//   DEGRADED (counts as not ready). Repair costs resources (shipBuilder.js).
//
// SLOT LAYOUT: data-driven; offsets are ship-local meters used to build the
// visible ship piece by piece. Future agents: a free-form builder replaces
// SLOTS with a graph of attachment nodes — keep ids stable for saves.
// ============================================================================

import { PART_TYPES_EXPANDED, SLOTS_EXPANDED } from './shipParts_expanded.js';

export const PART_TYPES = {
  frame:    { id: 'frame',    name: 'Frame Core',    mass: 60, required: true,  maxHp: 100,
              visual: { kind: 'box', size: [2.2, 1.4, 6.0], color: 0x546e7a } },
  cockpit:  { id: 'cockpit',  name: 'Cockpit',       mass: 35, required: true,  maxHp: 80, powerDraw: 2,
              visual: { kind: 'box', size: [1.8, 1.2, 1.8], color: 0x90a4ae } },
  engine:   { id: 'engine',   name: 'Main Thruster', mass: 40, required: true,  maxHp: 90, thrust: 5200, powerDraw: 3,
              visual: { kind: 'cyl', size: [0.75, 1.9], color: 0x37474f } },
  fueltank: { id: 'fueltank', name: 'Fuel Tank',     mass: 25, required: true,  maxHp: 70, fuelCap: 100,
              visual: { kind: 'cyl', size: [0.65, 2.2], color: 0x607d8b } },
  power:    { id: 'power',    name: 'Power Cell',    mass: 18, required: true,  maxHp: 60, powerSupply: 6,
              visual: { kind: 'box', size: [0.9, 0.9, 1.4], color: 0xffb300 } },
  cargo:    { id: 'cargo',    name: 'Cargo Pod',     mass: 20, required: false, maxHp: 60, cargoCap: 200,
              visual: { kind: 'box', size: [1.3, 1.1, 2.0], color: 0x455a64 } },
  hull:     { id: 'hull',     name: 'Hull Plating',  mass: 22, required: false, maxHp: 120, armor: 25,
              visual: { kind: 'box', size: [2.4, 0.25, 5.6], color: 0x39464e } },
  gear:     { id: 'gear',     name: 'Landing Gear',  mass: 12, required: true,  maxHp: 50,
              visual: { kind: 'cyl', size: [0.28, 1.5], color: 0x263238 } },
};

// The foundation ship: "Fortis Gunship pattern" slot layout.
// slotId is stable (saves reference it). offset = [x right, y up, z forward].
export const SLOTS = [
  { slotId: 'frame_core',   accepts: 'frame',    offset: [0, 0, 0] },
  { slotId: 'cockpit_fwd',  accepts: 'cockpit',  offset: [0, 0.7, 2.4] },
  { slotId: 'engine_main',  accepts: 'engine',   offset: [0, 0, -3.4], rotate: 'back' },
  { slotId: 'engine_aux',   accepts: 'engine',   offset: [0, 0.9, -3.0], rotate: 'back' },
  { slotId: 'tank_left',    accepts: 'fueltank', offset: [-1.35, 0.2, -1.0] },
  { slotId: 'tank_right',   accepts: 'fueltank', offset: [1.35, 0.2, -1.0] },
  { slotId: 'power_bay',    accepts: 'power',    offset: [0, 0.85, -0.6] },
  { slotId: 'cargo_belly',  accepts: 'cargo',    offset: [0, -0.95, 0.4] },
  { slotId: 'hull_top',     accepts: 'hull',     offset: [0, 1.35, -0.4] },
  { slotId: 'hull_bottom',  accepts: 'hull',     offset: [0, -1.5, -0.4] },
  { slotId: 'gear_fl',      accepts: 'gear',     offset: [-1.1, -1.6, 1.8] },
  { slotId: 'gear_fr',      accepts: 'gear',     offset: [1.1, -1.6, 1.8] },
  { slotId: 'gear_rl',      accepts: 'gear',     offset: [-1.1, -1.6, -2.2] },
  { slotId: 'gear_rr',      accepts: 'gear',     offset: [1.1, -1.6, -2.2] },
];

// Minimum operational set for flight readiness (checked by ship.computeStats):
// frame, cockpit, >=1 engine, >=1 fuel tank, power supply >= draw, >=3 gear.
Object.assign(PART_TYPES, PART_TYPES_EXPANDED);
SLOTS.push(...SLOTS_EXPANDED);

export const READINESS_RULES = {
  requiredTypes: ['frame', 'cockpit', 'engine', 'fueltank', 'power'],
  minGear: 3,
  degradedBelowFrac: 0.4,
};

export function getPartType(id) {
  const p = PART_TYPES[id];
  if (!p) throw new Error(`Unknown part type: ${id}`);
  return p;
}
