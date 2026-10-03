// ============================================================================
// server/world2.mjs — the trade of the second world, run by the authority: ore sold from the ship's hold (at the Occator foundry on Ceres or
// the Marineris depot on Mars), and supplies sold to the Occator desk. The arithmetic is src/worlds/ceres/trade.js (the solo bridge runs the same
// file); this file only checks WHERE you are standing and WHICH ship, then calls it.
// ============================================================================

import { makeMoon } from '../src/space/moonField.js';
import { WORKERS, frameToOutpost } from '../src/worlds/ceres/layout.js';
import { sellMatter, sellSupply, FUND_START } from '../src/worlds/ceres/trade.js';
import { PORT_WORKERS } from '../src/port/portPeople.js';

export function worldSale(auth, p, ship, sim, a) {
  auth.owner(p, ship);
  if (p.aboardShipId) throw Error('Step off the ship and walk to them first.');
  const market = auth.state.market;
  market.funds = market.funds || {};
  let fund, where = a.where;
  if (where === 'ceres') {
    const w = WORKERS.find((q) => q.id === a.worker && ((a.kind === 'matter' && q.trade === 'ore') || (a.kind === 'supply' && q.trade === 'supply')));
    if (!w) throw Error('Nobody here buys that.');
    if (p.frameId !== 'ceres') throw Error('That is on Ceres.');
    const at = frameToOutpost(makeMoon('ceres').padInfo, p.pose.worldPos);
    if (Math.hypot(at.x - w.x, at.z - w.z) > 4) throw Error('Walk over to them first.');
    if (a.kind === 'matter') {
      if (sim.frameId !== 'ceres' || !sim.flight.landed) throw Error('Your ship has to be landed on Ceres, near the hopper.');
      const sa = frameToOutpost(makeMoon('ceres').padInfo, sim.flight.pos);
      if (Math.hypot(sa.x, sa.z) > 900) throw Error('Your ship has to be landed at the Works (on its pad).');
    }
    if (market.funds.ceres === undefined) market.funds.ceres = FUND_START.works;
    fund = { get marks() { return market.funds.ceres; }, set marks(v) { market.funds.ceres = v; } };
  } else if (where === 'marineris') {
    if (a.kind !== 'matter') throw Error('The depot buys ore and salt.');
    const worker = PORT_WORKERS.find((q) => q.id === 'depot-clerk');
    auth.near(p, { ...worker, y: worker.y || 0 }, 3);
    if (!sim.flight.landed || sim.frameId !== 'mars') throw Error('Your flagship has to be landed at the port.');
    const at = auth.site.toLocal(sim.flight.pos);
    if (Math.hypot(at.x - worker.x, at.z - worker.z) > 600) throw Error('Your flagship has to be landed at the port.');
    fund = { get marks() { return market.marketMarks; }, set marks(v) { market.marketMarks = v; } };
  } else throw Error('Nobody there buys that.');
  ship.holdLots = ship.holdLots || [];
  // F4: Ceres prices follow the world's balance and home strength (dear for outsiders when it competes, cheap and busy when it cooperates) and the governor's tax.
  const tm = where === 'ceres' ? auth.roles.tradeMult(p.id, 'ceres', 'sell') : { mult: 1, tax: 0 };
  const r = a.kind === 'matter' ? sellMatter(ship, a.item, where === 'ceres' ? 'works' : where, a.tonnes, fund, tm.mult, tm.tax) : sellSupply(ship, a.good, a.n, fund, tm.mult, tm.tax);
  if (where === 'ceres') auth.roles.addIntake('ceres', r.taxed);
  return { ok: true, msg: a.kind === 'matter' ? `${a.tonnes} t weighed. ${r.paid} marks paid.` : `Sold. ${r.paid} marks paid.` };
}
