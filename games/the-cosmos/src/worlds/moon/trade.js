// ============================================================================
// worlds/moon/trade.js - why a ship goes to the Moon: ICE to dig out of the permanent shadows at the south pole, and four vendors whose prices are the Moon's
// (water, food and oxygen are dear; Fortis makes ammunition and sells it cheap; Technos Prime prints spare parts and sells them cheap, and Fortis pays well
// for them: the run the bible calls cooperation). Pure: no three.js, no DOM. The authority (shared world) and the solo bridge run THIS file, so the same
// sale pays the same in both. Whole marks only (4 marks = 1 credit; the Moon's own money, the lunar, is shown on the panels at 2 marks).
//
// THE GOODS
//   ICE      "Lunar polar ice", dug in the shadows round Shackleton (the world's `materials.ice`): matter, kept as the exact lots it was dug as, sold by the whole
//            tonne from the ship's hold. The Fortis ice dock pays the lower price (it is the producer's own door); the hub's water office pays more, because the
//            hub's people have nobody else to buy from. Carrying it a short hop costs no toll: the three landings are one region.
//   SUPPLIES counted units in the ship's inventory: each vendor has what it sells (the player buys) and what it pays for (the player sells), never the same
//            good, so no vendor can be milked alone. The vendors' own funds bound what they can pay.
// HONEST SIMPLIFICATIONS: the prices are the game's own first balance; shelves never run out (only the vendor's fund and the player's purse bound a trade);
// the buyers do not yet feel the Fortis-Technos balance beyond F4's price factor and the governor's tax.
// ============================================================================
import { GOODS } from '../../economy/catalog.js';
import { lotKg, takeMatter } from '../../economy/shops.js';

export const ICE_ITEM = 'moon-ice';
/** Marks per tonne of ice, by where it is sold. */
export const ICE_PRICE = { 'ice-dock': 250, 'ice-hub': 330 };
/** What each vendor sells (the player buys) and pays for (the player sells), marks per unit. Mars's shelf for reference: water 8, food 12, oxygen 24, parts 80, ammo 40. */
export const SHOPS = {
  'hub-mercantile': { sells: { water: 22, food: 28, oxygen: 46, parts: 120, ammo: 64 }, buys: { water: 11, food: 14, oxygen: 23, parts: 60, ammo: 32 } },
  'fortis-quartermaster': { sells: { ammo: 26, oxygen: 30 }, buys: { water: 34, food: 26, parts: 110 } },
  'technos-fab': { sells: { parts: 56 }, buys: { water: 36, food: 28, oxygen: 36 } },
  'technos-supply': { sells: {}, buys: { water: 38, food: 30, oxygen: 40, ammo: 34 } },
};
export const ICE_BUYERS = { 'ice-dock': 'moon-shackleton', 'ice-hub': 'moon' };      // the world frame each buys in
/** How many marks each vendor's fund starts with (each keeps its own, in the shared market record). */
export const FUND_START = 40_000;

export const iceKg = (lots) => lotKg(lots || [], ICE_ITEM);

/** Sell `tonnes` whole tonnes of ice from a hold. `ship` = { hold, holdLots, economy } (the caller passes a clone and keeps it only if this does not throw). `fund` = { marks }. Returns { paid, kg, taxed }. */
export function sellIce(ship, where, tonnes, fund, mult = 1, tax = 0) {
  const price = ICE_PRICE[where];
  if (!price) throw Error('Nobody here buys ice.');
  if (!Number.isSafeInteger(tonnes) || tonnes < 1) throw Error('Sell a whole number of tonnes.');
  const kg = tonnes * 1000, have = iceKg(ship.holdLots);
  if (have + 1e-6 < kg) throw Error(`Your hold has ${(have / 1000).toFixed(2)} t of lunar ice sealed in lots: not ${tonnes} t.`);
  const gross = Math.round(price * tonnes * mult), taxed = Math.round(gross * tax), pay = gross - taxed;
  if (fund.marks < pay) throw Error('The dealer cannot pay for that much today.');
  const t = takeMatter(ship.holdLots, ICE_ITEM, kg, 'sale');
  ship.holdLots = t.remaining;
  const cur = ship.hold[ICE_ITEM] || 0;
  if (cur + 1e-5 < kg) throw Error('The hold record and its lots disagree.');
  ship.hold[ICE_ITEM] = Math.max(0, cur - kg);
  const e = ship.economy;
  e.depotLots = e.depotLots || [];
  e.depotLots.push(...t.taken);
  e.exportedMassExact = String(BigInt(e.exportedMassExact || '0') + t.massExact);
  e.exportedVolumeExact = String(BigInt(e.exportedVolumeExact || '0') + t.volumeExact);
  e.marks += pay; fund.marks -= pay;
  return { paid: pay, kg, taxed };
}

/** The player sells `n` units of a supply to a vendor. Returns { paid, taxed }. */
export function sellSupply(ship, vendor, good, n, fund, mult = 1, tax = 0) {
  const row = SHOPS[vendor], pay1 = row && row.buys[good];
  if (!pay1 || !GOODS[good]) throw Error('They do not buy that.');
  if (!Number.isSafeInteger(n) || n < 1) throw Error('Sell a whole number of units.');
  const e = ship.economy;
  if ((e.inventory[good] || 0) < n) throw Error(`You have ${e.inventory[good] || 0} ${GOODS[good].name}.`);
  const gross = Math.round(pay1 * n * mult), taxed = Math.round(gross * tax), pay = gross - taxed;
  if (fund.marks < pay) throw Error('They cannot pay for that much today.');
  e.inventory[good] -= n; e.marks += pay; fund.marks -= pay;
  return { paid: pay, taxed };
}
/** The player buys `n` units from a vendor's shelf. Returns { cost }. */
export function buySupply(ship, vendor, good, n, fund, mult = 1) {
  const row = SHOPS[vendor], p1 = row && row.sells[good];
  if (!p1 || !GOODS[good]) throw Error('They do not stock that.');
  if (!Number.isSafeInteger(n) || n < 1) throw Error('Buy a whole number of units.');
  const cost = Math.round(p1 * n * mult), e = ship.economy;
  if (e.marks < cost) throw Error(`That is ${cost} marks and the account has ${e.marks}.`);
  e.marks -= cost; fund.marks += cost; e.inventory[good] = (e.inventory[good] || 0) + n;
  return { cost };
}
