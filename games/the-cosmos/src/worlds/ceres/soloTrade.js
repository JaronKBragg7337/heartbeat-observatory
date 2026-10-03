// ============================================================================
// worlds/ceres/soloTrade.js — the same sales the authority runs (server/world2.mjs), for the solo game: ore and supplies, checked by where
// the walker stands, paid by trade.js. In the shared world this is never called (the authority has it).
// ============================================================================

import { sellMatter, sellSupply, FUND_START } from './trade.js';
import { WORKERS } from './layout.js';

export function registerWorld2Trade(world, { space, walker, ship, bridge }) {
  world.register('world2-sale', (a) => {
    const e = world.state.economy;
    try {
      if (ship.aboard) throw Error('Step off the ship and walk to them first.');
      e.hold = e.hold || {};
      let fund;
      if (a.where === 'ceres') {
        const w = WORKERS.find((q) => q.id === a.worker && ((a.kind === 'matter' && q.trade === 'ore') || (a.kind === 'supply' && q.trade === 'supply')));
        const m = space.activeMoon && space.activeMoon.client && space.activeMoon.client.people && space.activeMoon.client.people.members.find((q) => q.id === a.worker);
        if (!w || !m || space.frameId !== 'ceres') throw Error('Nobody here buys that.');
        if (m.worldDist(walker.worldPos) > 4) throw Error('Walk over to them first.');
        if (e.ceresFund === undefined) e.ceresFund = FUND_START.works;
        fund = { get marks() { return e.ceresFund; }, set marks(v) { e.ceresFund = v; } };
      } else if (a.where === 'marineris') {
        if (a.kind !== 'matter') throw Error('The depot buys ore and salt.');
        if (space.frameId !== 'mars' || !bridge.nearWorker('depot-clerk')) throw Error('Bring the load to the depot supply desk.');
        fund = { get marks() { return e.marketMarks; }, set marks(v) { e.marketMarks = v; } };
      } else throw Error('Nobody there buys that.');
      const rec = { hold: e.hold, holdLots: space.jobs.hold, economy: e };
      const r = a.kind === 'matter' ? sellMatter(rec, a.item, a.where === 'ceres' ? 'works' : a.where, a.tonnes, fund) : sellSupply(rec, a.good, a.n, fund);
      space.jobs.hold = rec.holdLots;
      world.persist && world.persist();
      return { ok: true, msg: a.kind === 'matter' ? `${a.tonnes} t weighed. ${r.paid} marks paid.` : `Sold. ${r.paid} marks paid.` };
    } catch (err) { return { ok: false, msg: err.message }; }
  });
}
