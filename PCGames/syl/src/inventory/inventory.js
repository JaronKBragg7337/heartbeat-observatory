// ============================================================================
// inventory.js — player inventory state.
//
// OWNS: what the player is carrying (item id -> count) and stack math.
// DOES NOT OWN: item definitions (items.js), pickup placement in the world
//               (main.js spawns pickups), ship cargo (ship modules track their
//               own capacity; transfer logic lives in shipBuilder actions).
//
// Future agents: mass limits, encumbrance, and ship-cargo transfer UIs extend
// from here; keep counts plain integers for save-format stability.
// ============================================================================

import { getItem } from '../items/items.js';

export class Inventory {
  constructor() {
    this.counts = {}; // itemId -> integer count
  }

  add(itemId, n = 1) {
    getItem(itemId); // validates id
    this.counts[itemId] = (this.counts[itemId] || 0) + n;
  }

  remove(itemId, n = 1) {
    const have = this.counts[itemId] || 0;
    if (have < n) return false;
    this.counts[itemId] = have - n;
    if (this.counts[itemId] === 0) delete this.counts[itemId];
    return true;
  }

  count(itemId) { return this.counts[itemId] || 0; }

  has(itemId, n = 1) { return this.count(itemId) >= n; }

  totalMass() {
    let m = 0;
    for (const [id, n] of Object.entries(this.counts)) m += getItem(id).mass * n;
    return m;
  }

  entries() {
    return Object.entries(this.counts).map(([id, n]) => ({ item: getItem(id), count: n }));
  }

  serialize() { return { counts: { ...this.counts } }; }
  deserialize(data) { if (data && data.counts) this.counts = { ...data.counts }; }
}
