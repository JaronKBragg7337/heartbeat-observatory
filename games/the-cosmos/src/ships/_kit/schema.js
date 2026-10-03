// ============================================================================
// ships/_kit/schema.js - what a ship entry must say so a shop can show it, checked in words a builder can act on.
//
// Server-safe (no three.js). The registry throws at load if a def is short, so a ship with no description never reaches the yard.
// What a shipyard card shows: name, class, role, a one-line blurb, a description, a picture, the price, and the stats.
// ============================================================================

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v, min = 1) => typeof v === 'string' && v.trim().length >= min;

export const SHIP_ROLES = ['flagship', 'courier', 'warship', 'hauler', 'miner', 'explorer', 'passenger', 'tender', 'other'];

export function validateShipDef(d) {
  const bad = [];
  const need = (c, m) => { if (!c) bad.push(m); };
  if (!d || typeof d !== 'object') return ['a ship def must be an object'];
  need(isStr(d.type) && /^[a-z][a-z0-9-]*$/.test(d.type), 'type: lower-case letters, digits and dashes; it is the folder name and what a ship record carries');
  need(isStr(d.class), "class: the class name the player sees, e.g. 'Drayman-class hauler'");
  need(isStr(d.name), 'name: the ship\'s own name, e.g. Drayman');
  need(isStr(d.hudName), 'hudName: how the HUD names it');
  need(typeof d.registryId === 'string' && /^COS-MARS-VEH-\d{4}$/.test(d.registryId), 'registryId: COS-MARS-VEH-nnnn, unique');
  need(SHIP_ROLES.includes(d.role), `role: one of ${SHIP_ROLES.join(', ')}`);
  need(isStr(d.blurb, 20) && d.blurb.length <= 140, 'blurb: one line for a shop card, 20 to 140 characters');
  need(isStr(d.description, 80), 'description: what it is and what it is for, at least 80 characters, in plain words (the shop card shows it)');
  need(d.thumbnail === undefined || d.thumbnail === null || (isStr(d.thumbnail) && /^assets\//.test(d.thumbnail)), "thumbnail: optional path under assets/ (e.g. 'assets/ships/<type>.webp'); without one the shipyard draws the ship from its visuals");
  const S = d.stats;
  need(S && isNum(S.crewMax) && isNum(S.cargoKg) && isNum(S.escorts), 'stats: { crewMax, cargoKg, escorts } at least; add priceCredits to put it on the shipyard board');
  if (S && S.priceCredits !== undefined) need(isNum(S.priceCredits) && S.priceCredits > 0, 'stats.priceCredits: a positive number of credits (4 marks each)');
  need(d.envelope && isNum(d.envelope.width) && isNum(d.envelope.height) && isNum(d.envelope.depth), 'envelope: { width, height, depth } in metres, measured against the built geometry');
  need(d.phys && isNum(d.phys.massKg), 'phys.massKg: the hull mass');
  need(d.layout && Array.isArray(d.layout.rooms), 'layout: the built interior (use layoutKit from src/ships/layoutKit.js)');
  return bad;
}

/** One shop card's worth of facts about a ship def: what the yard prints. Stats and specs are read, never typed twice. */
export function catalogRow(d) {
  const guns = Array.isArray(d.guns) ? d.guns.length : Object.keys(d.guns || {}).length;
  return {
    type: d.type, name: d.name, class: d.class, role: d.role, blurb: d.blurb, description: d.description,
    thumbnail: d.thumbnail || null,
    priceCredits: d.stats && Number.isFinite(d.stats.priceCredits) ? d.stats.priceCredits : null,
    forSale: !!(d.stats && Number.isFinite(d.stats.priceCredits)),
    stats: { ...d.stats },
    specs: { lengthM: d.envelope.depth, widthM: d.envelope.width, heightM: d.envelope.height, massKg: d.phys.massKg, gunMounts: guns, seats: (d.seats || []).length, rooms: d.layout.rooms.length },
    registryId: d.registryId,
  };
}
