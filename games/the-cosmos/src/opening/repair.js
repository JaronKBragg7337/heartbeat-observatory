// ============================================================================
// opening/repair.js - the client's side of earning the first ship (lifeboat.js): while the lifeboat is drained, the one action button offers the part
// you are standing next to the giver of, or the fitting when you are by the boat with both parts. Reads the authority's snapshot; asks the authority
// (world.dispatch); it owns no state. A shared world only: a solo world has no drained boat.
// ============================================================================
import { REPAIR_PARTS, missingParts, giverFor, FIT_REACH } from './lifeboat.js';
import { frameToOutpost, outpostToFrame } from '../worlds/ceres/layout.js';
import { makeMoon } from '../space/moonField.js';
// FIX-R4: the Crew Hall door in port-local metres (the same point the authority's CREW_HALL.door uses, server/authority.mjs)
const CREW_HALL_DOOR = { x: -28, z: -60 };
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
    if (!goal) goal = this._crewGoal();
    this.hint.update(dt,goal?{...goal,onPlanet:true}:null);
  }
  /** FIX-R4 (27): the boat is fixed and nobody is hired: point at the Crew Hall door (after the usual minute away from it), on Mars only (the hall is at Marineris Port). */
  _crewGoal() {
    const w = this.world; if (!w.remote || !w.snapshot || this.shipSystem.aboard || this.vehicles?.seated() || this.space.frameId !== 'mars') return null;
    const p = w.snapshot.players[w.playerId]; if (!p || (p.opening && !p.opening.complete)) return null;
    const ship = w.snapshot.ships[p.shipId]; if (!ship || ship.drained || (ship.crew || []).length || !this.walker.grounded) return null;
    return { id: 'crew-hall', label: 'Crew Hall', target: this.portSite.toWorld(CREW_HALL_DOOR.x, 1.5, CREW_HALL_DOOR.z), reach: 12 };
  }
  /** FIX-R3: why the lifeboat will not lift, in words a phone can show ('' when it is not the drained boat's doing). */
  liftBlock() {
    const m = this._mine(); if (!m) return '';
    const miss = missingParts(m.ship).map((x) => REPAIR_PARTS[x].name);
    return miss.length ? `Can't lift: no ${miss.join(' / ')} fitted` : `Can't lift: the parts are bought but not fitted. Stand by the lifeboat and tap Fit`;
  }
  /** FIX-R3: the plain next step for a new pilot, shown in the status card until it is done. { text } or null. */
  nextGoal(aboard) {
    const w = this.world; if (!w.remote || !w.snapshot) return null;
    const p = w.snapshot.players[w.playerId]; if (!p || (p.opening && !p.opening.complete)) return null;
    const ship = w.snapshot.ships[p.shipId]; if (!ship) return null;
    const world = p.home?.world || 'mars', stand = aboard ? 'Stand up (E), leave by the ramp. ' : '';
    if (ship.drained) {
      const miss = missingParts(ship), at = (g) => `${g.who}, ${g.where}`;
      if (miss.length === 2) return { text: `${stand}The lifeboat has no power. Buy a power cell from ${at(giverFor(world, 'cell'))} and a fuel coupler from ${at(giverFor(world, 'coupler'))}: 300 marks each (tap Talk, then the shop). Then fit both at the boat.` };
      if (miss.length === 1) return { text: `${stand}Buy the ${REPAIR_PARTS[miss[0]].name} (300 marks) from ${at(giverFor(world, miss[0]))}. Then fit both at the boat.` };
      return { text: `${stand}Both parts are yours. Walk to the lifeboat and tap "Fit the power cell and the coupler".` };
    }
    if (!(ship.crew || []).length && world !== 'mars') return { text: 'Lifeboat ready. Crew are hired at the Crew Hall at Marineris Port on Mars: fly home (Course), land, and walk to the hall at the north end of the pads. Until then, dig ore or salt and sell it at Occator Works.' };
    if (!(ship.crew || []).length) return { text: `${p.home?.stay ? 'Your ship is on its pad.' : 'Lifeboat ready.'} Next: hire a crew. Walk to the Crew Hall at Marineris Port (the long building at the north end of the pads, an arrow points the way after a minute). Stand at its door and the six people inside come out to meet you; talk to one and tap Hire.` };
    return { text: world === 'mars'
      ? 'First job: ride the lift up the control tower at Marineris Port and talk to the watch supervisor about "A tonne for the foundation", 400 marks. Or fly to Phobos for core samples, 300 credits each (Course, Jobs).'
      : 'Ceres has no job board yet. Dig ore or salt and sell it at Occator Works, or fly home to Marineris Port (Course) where the depot job and the Phobos core samples pay.' };
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
