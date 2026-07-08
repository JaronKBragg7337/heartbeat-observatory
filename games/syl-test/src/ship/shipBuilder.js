// ============================================================================
// shipBuilder.js — install / remove / repair / refuel actions on a Ship.
//
// OWNS: the RULES for changing a ship's modules and the costs of doing so.
// DOES NOT OWN: ship state (ship.js), UI rendering (ui.js calls these and
//               displays results), item definitions (items.js).
//
// Every action returns { ok, msg } so the UI can display honest feedback.
// Actions mutate ship + inventory together and always refresh stats/visual.
//
// REPAIR COSTS (simple, real): structural modules want salvage_alloy;
// electronic modules want wiring_loom. One unit repairs 40 hp.
//
// Future agents: the free-form ship designer (drag parts onto attachment
// nodes) should reuse these exact actions — extend, don't fork.
// ============================================================================

import { SLOTS, getPartType, READINESS_RULES } from './shipParts.js';
import { getItem } from '../items/items.js';

const ELECTRONIC = new Set(['cockpit', 'power']);
const REPAIR_PER_UNIT = 40;

function slotById(slotId) {
  const s = SLOTS.find((x) => x.slotId === slotId);
  if (!s) throw new Error(`Unknown slot: ${slotId}`);
  return s;
}

// Install a part item from inventory into a slot.
export function installPart(ship, inventory, slotId, itemId) {
  const slot = slotById(slotId);
  const item = getItem(itemId);
  if (item.kind !== 'part') return { ok: false, msg: `${item.name} is not an installable part.` };
  if (item.partId !== slot.accepts) return { ok: false, msg: `${slot.slotId} accepts ${slot.accepts}, not ${item.partId}.` };
  if (ship.modules[slotId]) return { ok: false, msg: `${slotId} is occupied — remove the module first.` };
  if (!inventory.remove(itemId, 1)) return { ok: false, msg: `No ${item.name} in inventory.` };
  const t = getPartType(item.partId);
  ship.modules[slotId] = { typeId: item.partId, hp: t.maxHp };
  ship.refreshStats();
  ship.rebuildVisual();
  return { ok: true, msg: `Installed ${t.name} in ${slotId}.` };
}

// Remove a module back into inventory (as its part item, if one exists).
export function removePart(ship, inventory, slotId) {
  const mod = ship.modules[slotId];
  if (!mod) return { ok: false, msg: `${slotId} is empty.` };
  if (ship.landed === false) return { ok: false, msg: 'Cannot remove modules in flight.' };
  const itemId = `part_${mod.typeId === 'fueltank' ? 'fuel' : mod.typeId}`;
  try { getItem(itemId); inventory.add(itemId, 1); } catch { /* frame has no item; scrap it */ }
  ship.modules[slotId] = null;
  ship.refreshStats();
  ship.rebuildVisual();
  return { ok: true, msg: `Removed ${mod.typeId} from ${slotId}.` };
}

// Repair a damaged module using resources.
export function repairPart(ship, inventory, slotId) {
  const mod = ship.modules[slotId];
  if (!mod) return { ok: false, msg: `${slotId} is empty.` };
  const t = getPartType(mod.typeId);
  if (mod.hp >= t.maxHp) return { ok: false, msg: `${t.name} is at full integrity.` };
  const resId = ELECTRONIC.has(mod.typeId) ? 'wiring_loom' : 'salvage_alloy';
  if (!inventory.remove(resId, 1)) {
    return { ok: false, msg: `Repair needs 1x ${getItem(resId).name}.` };
  }
  mod.hp = Math.min(t.maxHp, mod.hp + REPAIR_PER_UNIT);
  ship.refreshStats();
  ship.rebuildVisual();
  return { ok: true, msg: `Repaired ${t.name} to ${Math.round((mod.hp / t.maxHp) * 100)}%.` };
}

// Load a fuel item into the ship's tanks.
export function loadFuel(ship, inventory, itemId = 'fuel_hydrazine') {
  const item = getItem(itemId);
  if (item.kind !== 'fuel') return { ok: false, msg: `${item.name} is not fuel.` };
  if (ship.stats.fuelCap <= 0) return { ok: false, msg: 'No working fuel tank installed.' };
  if (ship.fuel >= ship.stats.fuelCap - 0.5) return { ok: false, msg: 'Tanks are full.' };
  if (!inventory.remove(itemId, 1)) return { ok: false, msg: `No ${item.name} in inventory.` };
  ship.fuel = Math.min(ship.stats.fuelCap, ship.fuel + item.fuelUnits);
  return { ok: true, msg: `Loaded ${item.fuelUnits} fuel. Tanks: ${Math.round(ship.fuel)}/${ship.stats.fuelCap}.` };
}

// Human-readable readiness report for the UI.
export function readinessReport(ship) {
  const s = ship.refreshStats();
  const lines = [];
  if (s.ready) lines.push('FLIGHT READY');
  else {
    if (s.missing.length) lines.push(`MISSING: ${s.missing.join(', ')}`);
    if (s.degraded.length) lines.push(`DEGRADED: ${s.degraded.map((d) => `${d.typeId}@${d.slotId}`).join(', ')}`);
  }
  lines.push(`mass ${Math.round(s.mass)}kg · thrust ${s.thrust}N · TWR@earth ${(s.thrust / (s.mass * 9.81)).toFixed(2)}`);
  lines.push(`fuel ${Math.round(ship.fuel)}/${s.fuelCap} · power ${s.powerSupply}/${s.powerDraw} · cargo ${s.cargoCap} · armor ${s.armor}`);
  return { ready: s.ready, lines };
}

// The starting ship: damaged Fortis pattern — flyable ONLY after the player
// repairs the engine, installs the missing power cell + gear, and fuels up.
// This IS the first gameplay loop; do not hand the player a ready ship.
export function applyStarterDamage(ship) {
  const put = (slotId, typeId, hpFrac) => {
    const t = getPartType(typeId);
    ship.modules[slotId] = { typeId, hp: t.maxHp * hpFrac };
  };
  put('frame_core', 'frame', 0.9);
  put('cockpit_fwd', 'cockpit', 0.55);
  put('engine_main', 'engine', 0.2);   // degraded — must repair
  put('tank_left', 'fueltank', 0.75);
  // power_bay EMPTY — must find & install a power cell
  put('hull_top', 'hull', 0.5);
  put('gear_fl', 'gear', 1.0);
  put('gear_fr', 'gear', 0.9);
  put('gear_rl', 'gear', 0.15);        // degraded — repair or replace
  // gear_rr EMPTY — must install a strut (3 healthy gear required)
  ship.fuel = 0;                        // must load fuel
  ship.refreshStats();
  ship.rebuildVisual();
}
