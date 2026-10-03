// ============================================================================
// server/shops.mjs - player shops, run by the authority. A shop is a player's rent on a stall at Marineris Port (src/economy/shops.js):
// the owner stocks it from the flagship's hold and supplies, sets prices, and other players (or, while the owner is away, the port's NPC
// buyers at fair prices) buy from it. Money and goods move here and nowhere else.
//
// RULES, all checked before anything changes (the authority rolls the whole action back on a refusal, and a retried action id returns its
// first receipt without moving anything twice):
//   - stalls and ships are checked by position: you stand at the stall; the flagship you stock from is landed at the port
//   - goods are removed from one place and added to another in the same action; matter moves as the exact lots it was dug as
//   - marks are whole numbers, never negative; rent goes to the port's dealer fund; a sale goes buyer -> owner, an NPC sale dealer -> owner
//   - the price the buyer saw must still be the price; the buyer's hold must have room; a lapsed stall sells nothing
// Idle cost: shops are a handful of records; the NPC buyer pass runs every 10 world-seconds and only looks at open shops whose owner is away.
// ============================================================================

import { SOL_SECONDS } from '../src/economy/catalog.js';
import {
  STALLS, STALL_REACH_M, SHIP_REACH_M, RENT_MARKS, RENT_SOLS, MAX_AHEAD_SOLS, PRICE_MAX, NPC_EVERY_S, LEDGER_KEEP,
  SHOP_GOODS, takeMatter, loadKg, onShip, solOf, isLapsed, npcCeiling, cleanShopName,
} from '../src/economy/shops.js';
import { shipDef } from '../src/ships/registry.js';

const posInt = (n, max = 1e6) => Number.isSafeInteger(n) && n >= 1 && n <= max;

export class ShopDirector {
  constructor(auth) { this.auth = auth; this.next = 0; }
  get shops() { return this.auth.state.shops; }
  ensureAll() { this.auth.state.shops = this.auth.state.shops || {}; }

  // ---- lookups and checks ----------------------------------------------------------------------------------------------
  _stall(id) { const s = STALLS.find((q) => q.id === id); if (!s) throw Error('There is no such stall.'); return s; }
  _atStall(p, stall) { this.auth.near(p, { x: stall.x, y: 0, z: stall.z }, STALL_REACH_M); }
  _flag(p) { const f = this.auth.state.ships[p.shipId]; if (!f) throw Error('You have no ship account.'); this.auth.owner(p, f); return f; }
  _landed(flag) {
    const sim = this.auth.sims.get(flag.id);
    if (!sim || !sim.flight.landed || sim.frameId !== 'mars') throw Error('Your flagship has to be landed at the port to move goods in or out.');
    const at = this.auth.site.toLocal(sim.flight.pos), s0 = STALLS[0];
    if (Math.hypot(at.x - s0.x, at.z - s0.z) > SHIP_REACH_M) throw Error('Your flagship has to be landed at the port to move goods in or out.');
  }
  _mine(p, stallId) {
    const shop = this.shops[stallId];
    if (!shop || shop.ownerId !== p.id) throw Error('That is not your stall.');
    return shop;
  }
  _good(id) { const g = SHOP_GOODS[id]; if (!g) throw Error('That cannot be sold in a stall.'); return g; }
  _clock() { return this.auth.state.clock; }
  _market() { return this.auth.state.market; }

  /** Take `n` units of `good` out of a ship (and, for matter, the lots that back them). Returns the lots taken, if any. */
  _takeFromShip(ship, good, n) {
    const g = SHOP_GOODS[good];
    if (onShip(ship, good) < n) throw Error(`Your ship has only ${onShip(ship, good)} ${g.name} (${g.unit}).`);
    if (g.kind === 'supply') { ship.economy.inventory[good] -= n; return []; }
    const kg = n * g.unitKg;
    this.auth.removeCargo(ship, good, kg);
    if (g.kind === 'hold') return [];
    const t = takeMatter(ship.holdLots || [], good, kg, 'shop');
    ship.holdLots = t.remaining;
    return t.taken;
  }
  /** Put `n` units into a ship's hold and supplies, if it has room. */
  _giveToShip(ship, good, n, lots) {
    const g = SHOP_GOODS[good], kg = n * g.unitKg, cap = shipDef(ship.type).stats.cargoKg;
    if (loadKg(ship) + kg > cap + 1e-6) throw Error(`The hold has no room for ${Math.round(kg)} kg more (${Math.round(cap - loadKg(ship))} kg free).`);
    if (g.kind === 'supply') { ship.economy.inventory[good] = (ship.economy.inventory[good] || 0) + n; return; }
    this.auth.addCargo(ship, good, kg);
    if (g.kind === 'matter') { ship.holdLots = ship.holdLots || []; ship.holdLots.push(...lots); }
  }
  _logSale(shop, e) {
    shop.seq = (shop.seq || 0) + 1;
    const row = { n: shop.seq, at: this._clock(), ...e };
    shop.ledger = [...(shop.ledger || []), row].slice(-LEDGER_KEEP);
    shop.earned = (shop.earned || 0) + e.total;
    return row;
  }

  // ---- the owner's actions ---------------------------------------------------------------------------------------------
  rent(p, a) {
    const stall = this._stall(a.stall); this._atStall(p, stall);
    const flag = this._flag(p);
    if (this.shops[stall.id]) throw Error('Someone already rents that stall.');
    if (Object.values(this.shops).some((s) => s.ownerId === p.id)) throw Error('You already run a stall. Close it before renting another.');
    if (flag.economy.marks < RENT_MARKS) throw Error(`A stall costs ${RENT_MARKS} marks for ${RENT_SOLS} sols. Your ship account has ${flag.economy.marks}.`);
    flag.economy.marks -= RENT_MARKS; this._market().marketMarks += RENT_MARKS;
    this.shops[stall.id] = { id: stall.id, ownerId: p.id, ownerName: p.name, name: cleanShopName(a.name, `${p.name}'s stall`.slice(0, 24)),
      rentedAt: this._clock(), paidUntil: this._clock() + RENT_SOLS * SOL_SECONDS, listings: {}, lots: [], ledger: [], seq: 0, earned: 0, npcSol: 0, npcBought: {}, nextNpcAt: 0 };
    return { ok: true, msg: `You rent ${stall.name} for ${RENT_SOLS} sols: ${RENT_MARKS} marks. Stock it from your ship, then set your prices.` };
  }
  renew(p, a) {
    const stall = this._stall(a.stall), shop = this._mine(p, stall.id); this._atStall(p, stall);
    const flag = this._flag(p), now = this._clock();
    if (Math.max(shop.paidUntil, now) + RENT_SOLS * SOL_SECONDS > now + MAX_AHEAD_SOLS * SOL_SECONDS) throw Error(`You can pay at most ${MAX_AHEAD_SOLS} sols ahead.`);
    if (flag.economy.marks < RENT_MARKS) throw Error(`Rent is ${RENT_MARKS} marks for ${RENT_SOLS} sols. Your ship account has ${flag.economy.marks}.`);
    flag.economy.marks -= RENT_MARKS; this._market().marketMarks += RENT_MARKS;
    shop.paidUntil = Math.max(shop.paidUntil, now) + RENT_SOLS * SOL_SECONDS;
    return { ok: true, msg: `Rent paid: ${RENT_MARKS} marks. ${stall.name} is paid for ${Math.ceil((shop.paidUntil - now) / SOL_SECONDS)} more sols.` };
  }
  rename(p, a) {
    const shop = this._mine(p, this._stall(a.stall).id);
    shop.name = cleanShopName(a.name, shop.name); shop.ownerName = p.name;
    return { ok: true, msg: `The sign now says ${shop.name}.` };
  }
  stock(p, a) {
    const stall = this._stall(a.stall), shop = this._mine(p, stall.id); this._atStall(p, stall);
    if (isLapsed(shop, this._clock())) throw Error('Pay the rent before you stock the stall.');
    const g = this._good(a.good), flag = this._flag(p); this._landed(flag);
    if (!posInt(a.qty)) throw Error('Say how many.');
    const had = shop.listings[a.good];
    const price = a.price === undefined || a.price === null ? (had ? had.price : g.fair) : a.price;
    if (!posInt(price, PRICE_MAX)) throw Error(`A price is a whole number of marks, 1 to ${PRICE_MAX}.`);
    const lots = this._takeFromShip(flag, a.good, a.qty);
    shop.lots.push(...lots);
    shop.listings[a.good] = { qty: (had?.qty || 0) + a.qty, price };
    return { ok: true, msg: `Stocked ${a.qty} ${g.name} at ${price} marks each.` };
  }
  setPrice(p, a) {
    const stall = this._stall(a.stall), shop = this._mine(p, stall.id), l = shop.listings[a.good];
    if (!l) throw Error('You have none of that on the stall.');
    if (!posInt(a.price, PRICE_MAX)) throw Error(`A price is a whole number of marks, 1 to ${PRICE_MAX}.`);
    l.price = a.price;
    return { ok: true, msg: `${SHOP_GOODS[a.good].name} is now ${a.price} marks each.` };
  }
  unstock(p, a) {
    const stall = this._stall(a.stall), shop = this._mine(p, stall.id); this._atStall(p, stall);
    const g = this._good(a.good), l = shop.listings[a.good], flag = this._flag(p); this._landed(flag);
    if (!l || !posInt(a.qty) || a.qty > l.qty) throw Error('You do not have that many on the stall.');
    this._backToShip(shop, flag, a.good, a.qty);
    return { ok: true, msg: `Took ${a.qty} ${g.name} back to your ship.` };
  }
  _backToShip(shop, flag, good, n) {
    const g = SHOP_GOODS[good], l = shop.listings[good];
    let lots = [];
    if (g.kind === 'matter') { const t = takeMatter(shop.lots, good, n * g.unitKg, 'back'); shop.lots = t.remaining; lots = t.taken; }
    this._giveToShip(flag, good, n, lots);
    l.qty -= n; if (l.qty <= 0) delete shop.listings[good];
  }
  close(p, a) {
    const stall = this._stall(a.stall), shop = this._mine(p, stall.id); this._atStall(p, stall);
    const flag = this._flag(p);
    if (Object.keys(shop.listings).length) this._landed(flag);
    for (const good of Object.keys(shop.listings)) this._backToShip(shop, flag, good, shop.listings[good].qty);
    delete this.shops[stall.id];
    return { ok: true, msg: `${stall.name} is closed. Whatever was on it is back in your ship.` };
  }

  // ---- a customer ------------------------------------------------------------------------------------------------------
  buy(p, a) {
    const stall = this._stall(a.stall); this._atStall(p, stall);
    const shop = this.shops[stall.id]; if (!shop) throw Error('That stall is empty. Nobody rents it.');
    if (shop.ownerId === p.id) throw Error('You cannot buy from your own stall.');
    if (isLapsed(shop, this._clock())) throw Error('This stall is closed until its rent is paid.');
    const g = this._good(a.good), l = shop.listings[a.good];
    if (!l || l.qty < 1) throw Error('That is sold out.');
    if (!posInt(a.qty)) throw Error('Say how many.');
    if (a.qty > l.qty) throw Error(`Only ${l.qty} left.`);
    if (a.price !== l.price) throw Error(`The price changed: it is ${l.price} marks each now. Look again.`);
    const buyer = this._flag(p); this._landed(buyer);
    const owner = this.auth.state.players[shop.ownerId], oShip = owner && this.auth.state.ships[owner.shipId];
    if (!oShip) throw Error('The stall owner cannot take payment right now.');
    const total = a.qty * l.price;
    if (!Number.isSafeInteger(total) || buyer.economy.marks < total) throw Error(`That is ${total} marks. Your ship account has ${buyer.economy.marks}.`);
    let lots = [];
    if (g.kind === 'matter') { const t = takeMatter(shop.lots, a.good, a.qty * g.unitKg, 'sold'); shop.lots = t.remaining; lots = t.taken; }
    this._giveToShip(buyer, a.good, a.qty, lots);       // refuses (and the authority rolls back) if the hold is full
    const unit = l.price;
    l.qty -= a.qty; if (l.qty <= 0) delete shop.listings[a.good];
    buyer.economy.marks -= total; oShip.economy.marks += total;
    const row = this._logSale(shop, { kind: 'player', buyer: p.name, good: a.good, qty: a.qty, unit, total });
    return { ok: true, msg: `Bought ${a.qty} ${g.name} for ${total} marks. It is in your ship.`,
      receipt: { kind: 'shop-buy', n: row.n, stall: stall.id, shop: shop.name, good: a.good, qty: a.qty, unitPrice: unit, total, at: row.at } };
  }

  // ---- the NPC market, when the owner is away --------------------------------------------------------------------------
  step(dt, { catchUp = false } = {}) {
    const clock = this._clock();
    if (catchUp || clock < this.next) return;
    this.next = clock + 10;
    const shops = this.shops; let any = false;
    for (const k in shops) { any = true; break; }
    if (!any) return;
    const sol = solOf(clock);
    for (const shop of Object.values(shops)) {
      if (isLapsed(shop, clock) || clock < (shop.nextNpcAt || 0) || this.auth.sessions.has(shop.ownerId)) continue;
      if (shop.npcSol !== sol) { shop.npcSol = sol; shop.npcBought = {}; }
      const owner = this.auth.state.players[shop.ownerId], oShip = owner && this.auth.state.ships[owner.shipId];
      if (!oShip) continue;
      const lines = Object.entries(shop.listings), start = (shop.npcCursor || 0) % Math.max(1, lines.length);
      for (let step = 0; step < lines.length; step++) {
        const [good, l] = lines[(start + step) % lines.length], g = SHOP_GOODS[good];
        if (!g || l.qty < 1 || l.price > npcCeiling(good) || (shop.npcBought[good] || 0) >= g.demand) continue;
        const market = this._market();
        if (market.marketMarks < l.price) continue;
        let mass = 0n, vol = 0n;
        if (g.kind === 'matter') {
          const t = takeMatter(shop.lots, good, g.unitKg, 'npc'); shop.lots = t.remaining; mass = t.massExact; vol = t.volumeExact;
        }
        const unit = l.price;
        l.qty -= 1; if (l.qty <= 0) delete shop.listings[good];
        market.marketMarks -= unit; oShip.economy.marks += unit;
        if (mass) {
          oShip.economy.exportedMassExact = String(BigInt(oShip.economy.exportedMassExact || '0') + mass);
          oShip.economy.exportedVolumeExact = String(BigInt(oShip.economy.exportedVolumeExact || '0') + vol);
        }
        shop.npcBought[good] = (shop.npcBought[good] || 0) + 1;
        this._logSale(shop, { kind: 'npc', buyer: 'Port buyer', good, qty: 1, unit, total: unit });
        shop.nextNpcAt = clock + NPC_EVERY_S; shop.npcCursor = (start + step + 1) % Math.max(1, lines.length);
        break;
      }
    }
  }

  /** Everything a player's shop holds leaves the world with them (the same as their ship). */
  removeOwner(id) { for (const [k, s] of Object.entries(this.shops)) if (s.ownerId === id) delete this.shops[k]; }
}
