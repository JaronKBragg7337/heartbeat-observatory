// ============================================================================
// worlds/moon/soloTrade.js - the same trades the authority runs (server/moon.mjs), for the solo game: checked by where the walker stands, paid by trade.js.
// In the shared world this is never called (the authority has it).
// ============================================================================
import { castOf } from './cast.js';
import { ICE_BUYERS, SHOPS, FUND_START, sellIce, sellSupply, buySupply } from './trade.js';

export function registerMoonTrade(world, { space, walker, ship }) {
  world.register('moon-trade', (a) => {
    const e = world.state.economy;
    try {
      if (ship.aboard) throw Error('Step off the ship and walk to them first.');
      const frame = space.frameId, w = castOf(frame).find((q) => q.id === a.worker && q.trade);
      if (!w) throw Error('Nobody here buys that.');
      const m = space.activeMoon && space.activeMoon.client && space.activeMoon.client.people && space.activeMoon.client.people.members.find((q) => q.id === a.worker);
      if (!m) throw Error('Nobody here buys that.');
      if (m.worldDist(walker.worldPos) > 4) throw Error('Walk over to them first.');
      e.hold = e.hold || {}; e.moonFunds = e.moonFunds || {};
      const key = w.trade;
      if (e.moonFunds[key] === undefined) e.moonFunds[key] = FUND_START;
      const fund = { get marks() { return e.moonFunds[key]; }, set marks(v) { e.moonFunds[key] = v; } };
      const rec = { hold: e.hold, holdLots: space.jobs.hold, economy: e };
      let msg;
      if (a.op === 'sell-ice') {
        if (ICE_BUYERS[w.trade] !== frame) throw Error('Nobody here buys ice.');
        const r = sellIce(rec, w.trade, a.tonnes, fund); msg = `${a.tonnes} t weighed. ${r.paid} marks paid.`;
      } else {
        const vendor = w.trade.startsWith('shop:') ? w.trade.slice(5) : null;
        if (!vendor || !SHOPS[vendor]) throw Error('They only deal in ice.');
        if (a.op === 'sell') { const r = sellSupply(rec, vendor, a.good, a.n, fund); msg = `Sold. ${r.paid} marks paid.`; }
        else if (a.op === 'buy') { const r = buySupply(rec, vendor, a.good, a.n, fund); msg = `Bought. ${r.cost} marks.`; }
        else throw Error('Unknown trade.');
      }
      space.jobs.hold = rec.holdLots;
      world.persist && world.persist();
      return { ok: true, msg };
    } catch (err) { return { ok: false, msg: err.message }; }
  });
}
