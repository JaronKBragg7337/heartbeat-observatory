// ============================================================================
// opening/repair.js - the client's side of earning the first ship (lifeboat.js): while the lifeboat is drained, the one action button offers the part
// you are standing next to the giver of, or the fitting when you are by the boat with both parts. Reads the authority's snapshot; asks the authority
// (world.dispatch); it owns no state. A shared world only: a solo world has no drained boat.
// ============================================================================
import { REPAIR_PARTS, missingParts, giverFor, FIT_REACH } from './lifeboat.js';
import { frameToOutpost, outpostToFrame } from '../worlds/ceres/layout.js';
import { makeMoon } from '../space/moonField.js';
import { GoalHint } from '../ui/goalHint.js';

export class RepairChain {
  /** o: { world, walker, portSite, space, engine, shipSystem, vehicles } */
  constructor(o) { Object.assign(this, o); this.hint=new GoalHint(o.engine); }
  tick(dt) {
    const m=this._mine();let goal=null;
    if(m&&!this.shipSystem.aboard&&!this.vehicles?.seated()&&(this.walker.grounded||this.walker.altitudeAboveGround()<50)) {
      const world=m.p.home?.world||'mars',parts=missingParts(m.ship);
      if(this.space.frameId===world) {
        if(parts.length){const g=giverFor(world,parts[0]);const target=g.frame==='port'?this.portSite.toWorld(g.at.x,1.5,g.at.z):outpostToFrame(makeMoon(world).padInfo,g.at.x,1.5,g.at.z);
          goal={id:g.id,label:g.who,target,reach:8};}
        else if(m.ship.pose?.pos)goal={id:m.ship.id||'lifeboat-pad',label:'Lifeboat pad',target:m.ship.pose.pos,reach:FIT_REACH};
      }
    }
    this.hint.update(dt,goal?{...goal,onPlanet:true}:null);
  }
  _mine() {
    const w = this.world; if (!w.remote || !w.snapshot) return null;
    const p = w.snapshot.players[w.playerId]; if (!p || (p.opening && !p.opening.complete)) return null;
    const ship = w.snapshot.ships[p.shipId]; if (!ship || !ship.drained) return null;
    return { p, ship };
  }
  /** Is the player standing at a giver's spot? */
  _at(g, world) {
    const pos = this.walker.worldPos;
    if (g.frame === 'port') { if (this.space.frameId !== 'mars') return false; const l = this.portSite.toLocal(pos); return Math.hypot(l.x - g.at.x, l.z - g.at.z) <= g.reach; }
    if (this.space.frameId !== world) return false;
    const pi = this._pad || (this._pad = makeMoon(world).padInfo), o = frameToOutpost(pi, pos);
    return Math.hypot(o.x - g.at.x, o.z - g.at.z) <= g.reach;
  }
  /** { label, run } or null: what the action button can do for the lifeboat right now. */
  contextAction() {
    const m = this._mine(); if (!m) return null;
    const { p, ship } = m, world = p.home?.world || 'mars', missing = missingParts(ship);
    for (const part of missing) {
      const g = giverFor(world, part);
      if (this._at(g, world)) return { label: `Ask ${g.who} for the ${REPAIR_PARTS[part].name} (${REPAIR_PARTS[part].priceMarks} marks)`, run: () => this.world.dispatch({ type: 'lifeboat-part', part }) };
    }
    if (!missing.length && ship.frameId === p.frameId && ship.pose?.pos) {
      const a = this.walker.worldPos, b = ship.pose.pos;
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= FIT_REACH) return { label: 'Fit the power cell and the coupler', run: () => this.world.dispatch({ type: 'lifeboat-fit' }) };
    }
    return null;
  }
}
