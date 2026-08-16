// ============================================================================
// save.js — legacy V1 local save/cache and migration source.
//
// OWNS: composing/parsing the save payload, versioning, storage I/O.
// DOES NOT OWN: the state itself — every system exposes serialize()/
//               deserialize() and THIS file only composes them. Keep it so:
//               composition remains useful for migration, but authoritative
//               V2 state is not a drop-in PUT of this client-authored payload.
//
// SAVE CONTENT: player state, ship state (modules included), inventory,
// world discovery/flags, faction relationships, mode. Versioned; loaders must
// tolerate missing fields so legacy saves can be migrated deliberately.
//
// Future agents: do not promote this payload to universe truth. V2 services
// own validated state and expose migration/import paths. Bump SAVE_VERSION and
// write explicit migrations when this legacy cache changes.
// ============================================================================

const SAVE_KEY = 'syl_save';
export const SAVE_VERSION = 1;

function keyFor(game) {
  return game?.saveKey || SAVE_KEY;
}

export function buildPayload(game) {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    mode: game.traversal.mode,
    player: game.player.serialize(),
    ship: game.ship.serialize(),
    inventory: game.inventory.serialize(),
    world: game.worldState.serialize(),
    factions: game.factionState.serialize(),
    pickupsCollected: [...game.pickupsCollected],
  };
}

export function applyPayload(game, data) {
  if (!data || typeof data !== 'object') return false;
  // Version migrations go here (none yet — v1).
  game.player.deserialize(data.player);
  game.ship.deserialize(data.ship);
  game.inventory.deserialize(data.inventory);
  game.worldState.deserialize(data.world);
  game.factionState.deserialize(data.factions);
  game.pickupsCollected = new Set(data.pickupsCollected || []);
  game.applyLoadedMode(data.mode || 'ON_FOOT');
  return true;
}

export function save(game) {
  try {
    localStorage.setItem(keyFor(game), JSON.stringify(buildPayload(game)));
    return { ok: true, msg: 'Progress saved.' };
  } catch (e) {
    return { ok: false, msg: `Save failed: ${e.message}` };
  }
}

export function load(game) {
  try {
    const raw = localStorage.getItem(keyFor(game));
    if (!raw) return { ok: false, msg: 'No save found.' };
    const data = JSON.parse(raw);
    if (!applyPayload(game, data)) return { ok: false, msg: 'Save unreadable.' };
    return { ok: true, msg: `Loaded save from ${data.savedAt || 'unknown time'}.` };
  } catch (e) {
    return { ok: false, msg: `Load failed: ${e.message}` };
  }
}

export function hasSave(game = null) { return !!localStorage.getItem(keyFor(game)); }
export function clearSave(game = null) { localStorage.removeItem(keyFor(game)); }
