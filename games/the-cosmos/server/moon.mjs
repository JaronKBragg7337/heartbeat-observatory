// ============================================================================
// server/moon.mjs - the trade of the Moon's three landings, run by the authority (WD-MOON): lunar ice sold from the ship's hold (at the Fortis ice dock or the hub's
// water office) and supplies bought from and sold to the four vendors. The arithmetic is src/worlds/moon/trade.js (the solo bridge runs the same file); this file only
// checks WHERE you are standing and WHICH ship, then calls it. Prices follow F4's balance for the Moon (the hub is one world with Shackleton and Daedalus: 'moon').
// ============================================================================
import { makeMoon } from '../src/space/moonField.js';
import { frameToOutpost } from '../src/worlds/moon/place.js';
import { castOf } from '../src/worlds/moon/cast.js';
import { ICE_BUYERS, SHOPS, FUND_START, sellIce, sellSupply, buySupply } from '../src/worlds/moon/trade.js';

export const MOON_FRAMES = ['moon', 'moon-shackleton', 'moon-daedalus'];

export function moonTrade(auth, p, ship, sim, a) {
  auth.owner(p, ship);
  if (p.aboardShipId) throw Error('Step off the ship and walk to them first.');
  if (!MOON_FRAMES.includes(p.frameId)) throw Error('That is on the Moon.');
  const w = castOf(p.frameId).find((q) => q.id === a.worker && q.trade);
  if (!w) throw Error('Nobody here buys that.');
  const at = frameToOutpost(makeMoon(p.frameId).padInfo, p.pose.worldPos);
  if (Math.hypot(at.x - w.x, at.z - w.z) > 4) throw Error('Walk over to them first.');
  const market = auth.state.market; market.funds = market.funds || {};
  const key = 'moon:' + w.trade;
  if (market.funds[key] === undefined) market.funds[key] = FUND_START;
  const fund = { get marks() { return market.funds[key]; }, set marks(v) { market.funds[key] = v; } };
  ship.holdLots = ship.holdLots || [];
  if (a.op === 'sell-ice') {
    if (!ICE_BUYERS[w.trade] || ICE_BUYERS[w.trade] !== p.frameId) throw Error('Nobody here buys ice.');
    if (sim.frameId !== p.frameId || !sim.flight.landed) throw Error('Your ship has to be landed here, with the ice in her hold.');
    const sa = frameToOutpost(makeMoon(p.frameId).padInfo, sim.flight.pos);
    if (Math.hypot(sa.x, sa.z) > 900) throw Error('Your ship has to be landed at the settlement (on its pad).');
    const tm = auth.roles.tradeMult(p.id, 'moon', 'sell');
    const r = sellIce(ship, w.trade, a.tonnes, fund, tm.mult, tm.tax);
    auth.roles.addIntake('moon', r.taxed);
    return { ok: true, msg: `${a.tonnes} t weighed. ${r.paid} marks paid.` };
  }
  if (!w.trade.startsWith('shop:')) throw Error('They only deal in ice.');
  const vendor = w.trade.slice(5);
  if (!SHOPS[vendor]) throw Error('That shop is closed.');
  if (a.op === 'sell') { const tm = auth.roles.tradeMult(p.id, 'moon', 'sell'), r = sellSupply(ship, vendor, a.good, a.n, fund, tm.mult, tm.tax); auth.roles.addIntake('moon', r.taxed); return { ok: true, msg: `Sold. ${r.paid} marks paid.` }; }
  if (a.op === 'buy') { const tm = auth.roles.tradeMult(p.id, 'moon', 'buy'), r = buySupply(ship, vendor, a.good, a.n, fund, tm.mult); return { ok: true, msg: `Bought. ${r.cost} marks.` }; }
  throw Error('Unknown trade.');
}
