// ============================================================================
// items.js — item/resource definition registry. Pure data + lookup.
//
// OWNS: what items exist (id, name, kind, mass, description).
// DOES NOT OWN: who holds them (inventory.js), what ship parts do (shipParts.js
//               — ship PART items reference part definitions by partId).
//
// KINDS: 'resource' (raw material), 'part' (installable ship module — has a
//        partId into shipParts.js PART_TYPES), 'fuel' (converts to ship fuel).
//
// Future agents: add crafting recipes as a new module that reads these ids;
// do not embed recipe logic in this file.
// ============================================================================

export const ITEMS = [
  { id: 'salvage_alloy',  name: 'Salvaged Alloy',    kind: 'resource', mass: 4,  description: 'Structural scrap. Repairs hull and frame modules.' },
  { id: 'ore_regolith',   name: 'Regolith Ore',      kind: 'resource', mass: 6,  description: 'Lunar oxide-rich ore. Future refining input.' },
  { id: 'wiring_loom',    name: 'Wiring Loom',       kind: 'resource', mass: 1,  description: 'Salvaged conductors. Repairs cockpit and power modules.' },
  { id: 'fuel_hydrazine', name: 'Hydrazine Canister', kind: 'fuel',    mass: 8,  fuelUnits: 25, description: 'Ship fuel. Load it into the fuel tank at the ship builder.' },
  { id: 'part_engine',    name: 'Thruster Assembly', kind: 'part', partId: 'engine',  mass: 20, description: 'A complete main thruster module.' },
  { id: 'part_fuel',      name: 'Fuel Tank Module',  kind: 'part', partId: 'fueltank', mass: 15, description: 'An empty tank module.' },
  { id: 'part_power',     name: 'Power Cell',        kind: 'part', partId: 'power',   mass: 10, description: 'Ship power module.' },
  { id: 'part_cargo',     name: 'Cargo Pod',         kind: 'part', partId: 'cargo',   mass: 12, description: 'Adds carrying capacity to the ship.' },
  { id: 'part_hull',      name: 'Hull Plating',      kind: 'part', partId: 'hull',    mass: 14, description: 'Armor plate module.' },
  { id: 'part_gear',      name: 'Landing Gear Strut', kind: 'part', partId: 'gear',   mass: 8,  description: 'Landing gear module.' },
  { id: 'part_cockpit',   name: 'Cockpit Module',    kind: 'part', partId: 'cockpit', mass: 18, description: 'A sealed one-seat cockpit.' },
  { id: 'part_frame',     name: 'Frame Segment',     kind: 'part', partId: 'frame',   mass: 25, description: 'Core structural frame.' },
];

const _byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export function getItem(id) {
  const it = _byId[id];
  if (!it) throw new Error(`Unknown item id: ${id}`);
  return it;
}
