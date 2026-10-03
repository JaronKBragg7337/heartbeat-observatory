// ============================================================================
// worlds/ceres/trade.js — why a ship goes to Ceres: ore and salt to haul home, and a supply desk that pays twice Mars's price for what a
// frontier foundry runs short of. Pure: no three.js, no DOM. The authority (shared world) and the solo bridge run THIS file, so the same
// sale pays the same in both. Whole marks only (4 marks = 1 credit); nothing is paid that the dealer fund cannot cover.
//
// THE GOODS
//   ORE      "Occator ore" dug on Ceres (the world's `materials.ore`): matter, kept as the exact lots it was dug as. Sold by the tonne from the
//            ship's hold at the Marineris depot (the better price: the port's mills want it) or at the Occator foundry (the nearer one: dig,
//            stow and sell in an hour without leaving Ceres).
//   SALT     "Occator salt", bright sodium carbonate from the faculae and the Compact's pans: matter too, cheaper, the flux every furnace on Mars
//            and in the Belt burns through.
//   SUPPLIES  water, food, oxygen, parts, ammunition: counted units in the ship's supplies. The Occator desk buys them at about twice the Mars
//            shelf price, because the nearest shelf is a jump away. (Mars's traders hold 30 of each, so this is a run, not a mine.)
//
// HONEST SIMPLIFICATIONS: the prices are the game's own numbers (a first balance, meant to be tuned from play); the Compact's "supply
// shock" and strike events the bible describes are not built.
// ============================================================================

import { GOODS } from '../../economy/catalog.js';
import { lotKg, takeMatter } from '../../economy/shops.js';

export const ORE_ITEM = 'ceres-ore';
export const SALT_ITEM = 'ceres-salt';
/** Marks per tonne, by item and by where it is sold: 'marineris' (Mars's depot) or 'works' (Occator Works). */
export const MATTER = {
  [ORE_ITEM]: { name: 'Occator ore', marineris: 200, works: 130 },
  [SALT_ITEM]: { name: 'Occator salt', marineris: 70, works: 45 },
};
/** Back-compat for the ore-only callers: marks per tonne of ore. */
export const ORE_PRICE = { marineris: MATTER[ORE_ITEM].marineris, cutbank: MATTER[ORE_ITEM].works, works: MATTER[ORE_ITEM].works };
/** Marks the Occator supply desk pays for one unit of each supply (the Mars shelf price is `GOODS[id].buy`). */
export const SUPPLY_PAY = { water: 16, food: 22, oxygen: 46, parts: 150, ammo: 76 };
/** How many marks the dealer funds start with (each place keeps its own, in the shared market record). */
export const FUND_START = { works: 60_000 };

export const oreKg = (lots) => lotKg(lots || [], ORE_ITEM);
export const matterKg = (lots, item) => lotKg(lots || [], item);

/**
 * Sell `tonnes` whole tonnes of `item` from a hold. `ship` is the record being changed: { hold, holdLots, economy } (the caller passes a clone and
 * keeps it only if this does not throw). `where` is 'marineris' or 'works'. `fund` is the dealer's marks (an object { marks } this subtracts from).
 * Returns { paid, kg }.
 */
export function sellMatter(ship, item, where, tonnes, fund, mult = 1, tax = 0) {      // F4: `mult` is the world's price factor, `tax` the governor's cut
  const row = MATTER[item], price = row && row[where === 'cutbank' ? 'works' : where];
  if (!price) throw Error('Nobody here buys that.');
  if (!Number.isSafeInteger(tonnes) || tonnes < 1) throw Error('Sell a whole number of tonnes.');
  const kg = tonnes * 1000, have = matterKg(ship.holdLots, item);
  if (have + 1e-6 < kg) throw Error(`Your hold has ${(have / 1000).toFixed(2)} t of ${row.name.toLowerCase()} sealed in lots: not ${tonnes} t.`);
  const gross = Math.round(price * tonnes * mult), taxed = Math.round(gross * tax), pay = gross - taxed;
  if (fund.marks < pay) throw Error('The dealer cannot pay for that much today.');
  const t = takeMatter(ship.holdLots, item, kg, 'sale');
  ship.holdLots = t.remaining;
  const cur = ship.hold[item] || 0;
  if (cur + 1e-5 < kg) throw Error('The hold record and its lots disagree.');
  ship.hold[item] = Math.max(0, cur - kg);
  const e = ship.economy;
  e.depotLots = e.depotLots || [];
  e.depotLots.push(...t.taken);
  e.exportedMassExact = String(BigInt(e.exportedMassExact || '0') + t.massExact);
  e.exportedVolumeExact = String(BigInt(e.exportedVolumeExact || '0') + t.volumeExact);
  e.marks += pay; fund.marks -= pay;
  return { paid: pay, kg, taxed };
}
/** Ore: the original one-item call (`where` 'marineris' | 'cutbank' | 'works'). */
export const sellOre = (ship, where, tonnes, fund) => sellMatter(ship, ORE_ITEM, where, tonnes, fund);

/** Sell `n` units of a supply at the Occator desk. `ship.economy.inventory` is changed. Returns { paid }. */
export function sellSupply(ship, good, n, fund, mult = 1, tax = 0) {
  const pay1 = SUPPLY_PAY[good];
  if (!pay1 || !GOODS[good]) throw Error('The desk does not buy that.');
  if (!Number.isSafeInteger(n) || n < 1) throw Error('Sell a whole number of units.');
  const e = ship.economy;
  if ((e.inventory[good] || 0) < n) throw Error(`You have ${e.inventory[good] || 0} ${GOODS[good].name}.`);
  const gross = Math.round(pay1 * n * mult), taxed = Math.round(gross * tax), pay = gross - taxed;
  if (fund.marks < pay) throw Error('The desk cannot pay for that much today.');
  e.inventory[good] -= n; e.marks += pay; fund.marks -= pay;
  return { paid: pay, taxed };
}
