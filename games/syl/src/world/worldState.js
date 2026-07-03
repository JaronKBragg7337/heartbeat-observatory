// ============================================================================
// worldState.js — the authoritative WORLD DATA layer.
//
// OWNS: which bodies/zones are discovered, current reference body, mission
//       flags, and the clean serialize/deserialize of world progress.
// DOES NOT OWN: rendering (planet.js), physics (player/ship), faction values
//               (factions.js has its own state; save.js composes both).
//
// Future agents: put new world-level progression state HERE (settlement
// growth, orbital stations, AI-Director flags), and extend serialize()/
// deserialize() in matching pairs. Keep it plain-JSON-safe.
// ============================================================================

import { BODIES } from './bodies.js';

export class WorldState {
  constructor() {
    this.discoveredBodies = new Set(['earth']);   // ids
    this.discoveredZones = new Set();              // zone ids
    this.currentBodyId = 'earth';                  // dominant-gravity body id
    this.flags = {
      launchedOnce: false,
      reachedSpace: false,
      landedAway: false,
      tutorialDone: false,
    };
    this.listeners = []; // fn(eventName, payload)
  }

  emit(name, payload) { for (const f of this.listeners) f(name, payload); }
  on(fn) { this.listeners.push(fn); }

  discoverBody(id) {
    if (!this.discoveredBodies.has(id)) {
      this.discoveredBodies.add(id);
      this.emit('bodyDiscovered', id);
    }
  }

  discoverZone(zoneId) {
    if (!this.discoveredZones.has(zoneId)) {
      this.discoveredZones.add(zoneId);
      this.emit('zoneDiscovered', zoneId);
      return true;
    }
    return false;
  }

  setCurrentBody(id) {
    if (this.currentBodyId !== id) {
      this.currentBodyId = id;
      this.discoverBody(id);
      this.emit('bodyChanged', id);
    }
  }

  setFlag(name, v = true) {
    if (this.flags[name] !== v) { this.flags[name] = v; this.emit('flag', { name, v }); }
  }

  serialize() {
    return {
      discoveredBodies: [...this.discoveredBodies],
      discoveredZones: [...this.discoveredZones],
      currentBodyId: this.currentBodyId,
      flags: { ...this.flags },
    };
  }

  deserialize(data) {
    if (!data) return;
    this.discoveredBodies = new Set(data.discoveredBodies || ['earth']);
    this.discoveredZones = new Set(data.discoveredZones || []);
    this.currentBodyId = data.currentBodyId || 'earth';
    Object.assign(this.flags, data.flags || {});
  }

  // Convenience: all body records (the registry is static data).
  get bodies() { return BODIES; }
}
