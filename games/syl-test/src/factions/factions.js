// ============================================================================
// factions.js — faction registry + relationship state.
//
// OWNS: faction definitions (data) and player-vs-faction relationship values.
// DOES NOT OWN: politics simulation, economy, governance (future systems that
//               will PLUG IN here — this file is the system boundary for them).
//
// CANON STATUS (be honest): SpaceYouLand repo canon names ONE faction —
// **Fortis, the Militaristic Empire**, first playable slice: armored,
// practical, militarized, steel + red. The docs say "7 playable factions"
// but do not name the other six (full bible is in Jaron's Google Drive,
// folder "Space-You-Land (2026-2027)", not in the repo).
// The six below marked placeholder:true are INVENTED ARCHETYPES to make the
// system real. Future agents: when Jaron supplies canon names, replace the
// placeholder entries — every reference is by id, so renames are data edits.
//
// FIELDS: id, name, color (identity), archetype, homeBodyId (territory hook),
//         description, placeholder, economyHooks / governanceHooks (reserved
//         objects future economy/governance systems read & extend).
// RELATIONSHIPS: player standing per faction, -100 (hostile) .. +100 (allied).
// ============================================================================

export const FACTIONS = [
  {
    id: 'fortis',
    name: 'Fortis',
    archetype: 'Militaristic Empire',
    color: 0xd32f2f,
    homeBodyId: 'earth',
    description: 'Armored, practical, serious. Holds the northern outpost line on Earth. The player begins inside Fortis territory.',
    placeholder: false,
    economyHooks: { producesItemIds: ['salvage_alloy', 'part_hull'], demandsItemIds: ['fuel_hydrazine'] },
    governanceHooks: { governmentType: 'military-command', canTax: true },
  },
  {
    id: 'meridian',
    name: 'Meridian Combine',
    archetype: 'Industrial Cartel',
    color: 0xffb300,
    homeBodyId: 'moon',
    description: 'PLACEHOLDER. Mining/industry archetype. Planted the first survey beacon on the Moon.',
    placeholder: true,
    economyHooks: { producesItemIds: ['ore_regolith'], demandsItemIds: ['part_engine'] },
    governanceHooks: { governmentType: 'board-charter', canTax: true },
  },
  {
    id: 'freeport',
    name: 'Freeport Syndicate',
    archetype: 'Trader / Smuggler Network',
    color: 0x7cb342,
    homeBodyId: 'rustholm',
    description: 'PLACEHOLDER. Runs fuel and contraband through claimed rocks like Rustholm.',
    placeholder: true,
    economyHooks: { producesItemIds: ['fuel_hydrazine'], demandsItemIds: ['salvage_alloy'] },
    governanceHooks: { governmentType: 'charter-anarchy', canTax: false },
  },
  {
    id: 'halcyon',
    name: 'Halcyon Accord',
    archetype: 'Diplomatic Federation',
    color: 0x42a5f5,
    homeBodyId: null,
    description: 'PLACEHOLDER. Governance/diplomacy archetype. No territory in the foundation build.',
    placeholder: true,
    economyHooks: {}, governanceHooks: { governmentType: 'federation', canTax: true },
  },
  {
    id: 'veil',
    name: 'The Veil',
    archetype: 'Intelligence / Shadow Network',
    color: 0x8e24aa,
    homeBodyId: null,
    description: 'PLACEHOLDER. Espionage archetype. Exists only as a relationship row for now.',
    placeholder: true,
    economyHooks: {}, governanceHooks: { governmentType: 'cell-network', canTax: false },
  },
  {
    id: 'kindred',
    name: 'Kindred of the Long Walk',
    archetype: 'Nomad Flotilla',
    color: 0x26a69a,
    homeBodyId: null,
    description: 'PLACEHOLDER. Nomadic ship-dweller archetype for future walkable-fleet content.',
    placeholder: true,
    economyHooks: {}, governanceHooks: { governmentType: 'council-of-captains', canTax: false },
  },
  {
    id: 'registry',
    name: 'The Registry',
    archetype: 'Builder Guild',
    color: 0x90a4ae,
    homeBodyId: null,
    description: 'PLACEHOLDER. "The world is built, not spawned" — Builder-role guild for the construction economy.',
    placeholder: true,
    economyHooks: { producesItemIds: ['part_frame', 'part_gear'] },
    governanceHooks: { governmentType: 'guild', canTax: false },
  },
];

export class FactionState {
  constructor() {
    this.byId = {};
    for (const f of FACTIONS) this.byId[f.id] = f;
    // Player standing per faction id.
    this.relationships = {};
    for (const f of FACTIONS) this.relationships[f.id] = f.id === 'fortis' ? 25 : 0;
    this.metFactions = new Set(['fortis']);
  }

  standing(id) { return this.relationships[id] ?? 0; }

  adjustStanding(id, delta) {
    if (!(id in this.relationships)) return;
    this.relationships[id] = Math.max(-100, Math.min(100, this.relationships[id] + delta));
  }

  meet(id) {
    if (id && this.byId[id] && !this.metFactions.has(id)) {
      this.metFactions.add(id);
      return this.byId[id];
    }
    return null;
  }

  serialize() {
    return { relationships: { ...this.relationships }, metFactions: [...this.metFactions] };
  }
  deserialize(data) {
    if (!data) return;
    Object.assign(this.relationships, data.relationships || {});
    this.metFactions = new Set(data.metFactions || ['fortis']);
  }
}
