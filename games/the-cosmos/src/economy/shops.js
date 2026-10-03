// ============================================================================
// economy/shops.js - player shops: the stalls at Marineris Port, what can be sold in one, what is a fair price, and the pure helpers the
// server (server/shops.mjs) and the phone screen (src/economy/shopView.js) share. No three.js, no DOM.
//
// A STALL is a fixed place on the market row. A SHOP is a player's rent on a stall: a name, the sol it is paid up to, listings (good ->
// quantity and price) and, for matter, the real excavated lots that back the listing. Goods and marks move only through the authority,
// which checks position, ownership, stock, price and hold room before it moves anything, and refuses (changing nothing) otherwise.
//
// THE GOODS are four kinds, because the game already keeps four kinds of thing:
//   supply  - counted units in a ship's inventory (water, food, ammunition, parts, oxygen)
//   hold    - kilograms in a ship's hold that are not ground (salvage alloy from the Phobos module)
//   matter  - regolith and clay dug on the moons: whole tonnes that are backed by the exact lots (mass and volume ledger) the digger cut
// A player's own "Phobos core samples" are NOT sold here: they belong to the Survey Office contract and are paid on landing.
// ============================================================================

import { GOODS, SOL_SECONDS } from './catalog.js';

export const MARKET_ROW = { name: 'Marineris market row', x0: -14, dx: 5.6, z: 60 };
/** Six stalls, shoulder to shoulder south of the main pad. Port-local metres (x right, z south), the same frame as the hiring board. */
export const STALLS = Array.from({ length: 6 }, (_, i) => ({
  id: `port-${i + 1}`, number: i + 1, name: `Stall ${i + 1}`, place: MARKET_ROW.name,
  x: MARKET_ROW.x0 + i * MARKET_ROW.dx, z: MARKET_ROW.z,
}));
export const STALL_REACH_M = 6;       // how close you stand to use a stall (to its counter)
export const SHIP_REACH_M = 600;      // a ship must be landed this close to the stalls to be stocked from or unstocked into (the pad grid spreads east of the port)

export const RENT_MARKS = 700;        // per rental block, paid from the flagship account to the port's dealer fund
export const RENT_SOLS = 7;           // one block is seven Mars sols (a little over a week)
export const MAX_AHEAD_SOLS = 28;     // you can pay at most four blocks ahead
export const PRICE_MAX = 100000;
export const NPC_PRICE_TOLERANCE = 1.2; // an NPC buyer pays your listed price when it is within this share of the fair price
export const NPC_EVERY_S = 30;        // while the owner is away a stall sells at most one line of one good this often (world clock)
export const LEDGER_KEEP = 40;

const supply = (id, demand) => ({ id, kind: 'supply', name: GOODS[id].name.split(' · ')[0], unit: GOODS[id].name.split(' · ')[1] || 'each', unitKg: GOODS[id].massKg,
  fair: Math.round((GOODS[id].buy + GOODS[id].sell) / 2), demand });
/** Every good a stall can list. `fair` is whole marks per unit; `demand` is how many units the NPC market takes per sol per stall. */
export const SHOP_GOODS = Object.fromEntries([
  supply('water', 24), supply('food', 16), supply('ammo', 4), supply('parts', 3), supply('oxygen', 8),
  { id: 'salvage-alloy', kind: 'hold', name: 'Salvage alloy', unit: '100 kg', unitKg: 100, fair: 40, demand: 6 },
  { id: 'phobos-regolith', kind: 'matter', name: 'Phobos regolith', unit: 'tonne', unitKg: 1000, fair: 30, demand: 2 },
  { id: 'phobos-hydrated-clay', kind: 'matter', name: 'Phobos hydrated clay', unit: 'tonne', unitKg: 1000, fair: 90, demand: 1 },
  { id: 'deimos-regolith', kind: 'matter', name: 'Deimos regolith', unit: 'tonne', unitKg: 1000, fair: 30, demand: 2 },
  { id: 'ceres-ore', kind: 'matter', name: 'Occator ore', unit: 'tonne', unitKg: 1000, fair: 200, demand: 2 },       // WORLD2
  { id: 'ceres-salt', kind: 'matter', name: 'Occator salt', unit: 'tonne', unitKg: 1000, fair: 70, demand: 2 },
].map((g) => [g.id, g]));
export const goodIds = () => Object.keys(SHOP_GOODS);

/** Which hold item a material becomes when stowed (the same table as src/space/jobs.js MAT_ITEM; a test keeps them equal). */
export const ITEM_OF_MATERIAL = { 'MAT-PHOBOS-CLAY': 'phobos-hydrated-clay', 'MAT-PHOBOS-REGOLITH': 'phobos-regolith', 'MAT-PHOBOS-RUBBLE': 'phobos-rubble',
  'MAT-DEIMOS-REGOLITH': 'deimos-regolith', 'MAT-DEIMOS-RUBBLE': 'deimos-rubble',
  'MAT-CERES-ORE': 'ceres-ore', 'MAT-CERES-SALT': 'ceres-salt', 'MAT-CERES-REGOLITH': 'ceres-regolith', 'MAT-CERES-RUBBLE': 'ceres-rubble' };       // WORLD2

const SCALE = 2 ** 96;
const big = (v) => BigInt(v * SCALE);
export const sumLots = (lots, key) => lots.reduce((s, l) => s + big(l[key]), 0n);

/** A lot that is one hold item all the way through (a mixed lot is not sold: the buyer would be getting something else). */
export function pureItem(lot) {
  const parts = lot.parts && lot.parts.length ? lot.parts : [{ materialId: lot.materialId }];
  const item = ITEM_OF_MATERIAL[parts[0].materialId];
  return item && parts.every((p) => ITEM_OF_MATERIAL[p.materialId] === item) ? item : null;
}
export const lotKg = (lots, item) => lots.filter((l) => pureItem(l) === item).reduce((s, l) => s + l.massKg, 0);

/**
 * Take exactly `kg` of pure `item` out of `lots`, splitting the last lot. Everything keeps its composition: a part of a split lot has the same
 * mix, scaled. Returns { remaining, taken, massExact, volumeExact } (the exact amounts, in the ledger's scale) and does not touch its input.
 */
export function takeMatter(lots, item, kg, tag = 'shop') {
  if (!(kg > 0) || lotKg(lots, item) + 1e-9 < kg) throw Error(`Not enough ${item} sealed in lots (${Math.floor(lotKg(lots, item))} kg).`);
  const remaining = structuredClone(lots), taken = []; let need = kg, n = 0;
  for (let i = 0; i < remaining.length && need > 1e-9; i++) {
    const l = remaining[i]; if (pureItem(l) !== item) continue;
    if (l.massKg <= need + 1e-9) { need -= l.massKg; taken.push(l); remaining.splice(i--, 1); continue; }
    const mass = need, ratio = mass / l.massKg, part = structuredClone(l);
    part.massKg = mass;
    for (const k of ['solidVolumeM3', 'looseVolumeM3']) if (k in l) { part[k] = l[k] * ratio; l[k] -= part[k]; }
    if (l.parts) { part.parts = l.parts.map((p) => ({ ...p, massKg: p.massKg * ratio, volumeM3: p.volumeM3 * ratio }));
      l.parts = l.parts.map((p, j) => ({ ...p, massKg: p.massKg - part.parts[j].massKg, volumeM3: p.volumeM3 - part.parts[j].volumeM3 })); }
    l.massKg -= mass; part.lotId = `${l.lotId || 'lot'}:${tag}${++n}`; taken.push(part); need = 0;
  }
  return { remaining, taken, massExact: sumLots(lots, 'massKg') - sumLots(remaining, 'massKg'), volumeExact: sumLots(lots, 'solidVolumeM3') - sumLots(remaining, 'solidVolumeM3') };
}

/** Kilograms a ship carries in its hold plus its supplies, against what its definition says it can. */
export function loadKg(ship) {
  const hold = Object.values(ship.hold || {}).reduce((s, v) => s + v, 0);
  const inv = Object.entries(ship.economy?.inventory || {}).reduce((s, [k, n]) => s + (GOODS[k]?.massKg || 0) * n, 0);
  return hold + inv;
}

/** How many units of `good` a ship can hand over to a shop right now (what is in it, in whole units). */
export function onShip(ship, good) {
  const g = SHOP_GOODS[good]; if (!g) return 0;
  if (g.kind === 'supply') return Math.floor(ship.economy?.inventory?.[good] || 0);
  if (g.kind === 'hold') return Math.floor((ship.hold?.[good] || 0) / g.unitKg + 1e-9);
  return Math.floor(Math.min(ship.hold?.[good] || 0, lotKg(ship.holdLots || [], good)) / g.unitKg + 1e-9);
}

export const solOf = (clock) => Math.floor(clock / SOL_SECONDS);
export const solsLeft = (shop, clock) => Math.max(0, (shop.paidUntil - clock) / SOL_SECONDS);
export const isLapsed = (shop, clock) => clock >= shop.paidUntil;
/** What an NPC buyer will pay at most per unit. */
export const npcCeiling = (good) => Math.floor(SHOP_GOODS[good].fair * NPC_PRICE_TOLERANCE);
export const cleanShopName = (s, fallback) => {
  const t = String(s ?? '').replace(/[<>\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return t.length >= 2 ? t : fallback;
};
