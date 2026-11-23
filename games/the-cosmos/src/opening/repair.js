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
import { labelFor, hintFor } from '../ui/gamepad.js';
import { sfx } from '../ui/sfx.js';

export class RepairChain {
  /** o: { world, walker, portSite, space, engine, shipSystem, vehicles } */
  constructor(o) { Object.assign(this, o); this.hint=new GoalHint(o.engine); }
  tick(dt) {
    const m=this._mine();let goal=null;this._alive();
    if(m&&!this.shipSystem.aboard&&!this.vehicles?.seated()&&(this.walker.grounded||this.walker.altitudeAboveGround()<50)) {
      const world=m.p.home?.world||'mars',parts=missingParts(m.ship);
      if(this.space.frameId===world) {
        if(parts.length){const g=giverFor(world,parts[0]);const target=g.frame==='port'?this.portSite.toWorld(g.at.x,1.5,g.at.z):outpostToFrame(makeMoon(world).padInfo,g.at.x,1.5,g.at.z);
          goal={id:g.id,label:(n=>n[0].toUpperCase()+n.slice(1))(g.who.split(',')[0].replace(/ \(.*\)$/,'')),target,reach:8,after:4,named:true};}
        else if(m.ship.pose?.pos)goal={id:m.ship.id||'lifeboat-pad',label:'Your lifeboat',target:m.ship.pose.pos,reach:FIT_REACH,after:4,named:true};
      }
    }
    if (!goal) goal = this._flightGoal(dt);
    if (!goal) goal = this._crewGoal();
    this.hint.update(dt,goal?{...goal,onPlanet:true}:null);
  }
  /** The moment the first ship comes alive (part 1, 11/19): say so, once, with a sound; it used to pass with no word at all. */
  _alive() {
    const w=this.world,p=w.remote&&w.snapshot?w.snapshot.players[w.playerId]:null,sh=p&&(!p.opening||p.opening.complete)?w.snapshot.ships[p.shipId]:null; if(!sh)return;
    if(this._drained===true&&!sh.drained){ sfx.arrive(); this.space.say?.('Power on. Your lifeboat flies. Walk up the ramp at her back and take the pilot seat.', false); }
    this._drained=!!sh.drained;
  }
  // ---- the first take-off (part 1, 11/19): power on used to be the last word a new pilot got; the card went straight to a job on foot and nobody
  // was ever told how to get in, where the pilot sits or what lifts her. Four plain steps, until one flight has gone up and come back down.
  /** The fitted lifeboat of a pilot who has not flown yet: { p, ship } or null. A hired crew or a bigger ship means this is no beginner. */
  _firstFlight() {
    const w = this.world; if (!w.remote || !w.snapshot) return null;
    const p = w.snapshot.players[w.playerId]; if (!p || (p.opening && !p.opening.complete)) return null;
    const ship = w.snapshot.ships[p.shipId]; if (!ship || ship.drained || ship.type !== 'lifeboat' || (ship.crew || []).length) return null;
    if (this._flown === undefined || this._flownFor !== p.id) { this._flownFor = p.id; try { this._flown = localStorage.getItem('cosmos.firstFlight.' + p.id) === '1'; } catch { this._flown = false; } }
    return this._flown ? null : { p, ship };
  }
  /** Watches the flight itself, and while the pilot is still on the ground outside, points at the foot of the ramp. */
  _flightGoal(dt) {
    const m = this._firstFlight(); if (!m) return null;
    const sh = this.shipSystem, f = sh.flight;
    if (sh.aboard && sh.seat?.id === 'pilot') {
      if (f.airborne && f.agl > 25) this._up = true;
      if (this._up && f.landed) {
        this._up = false; this._flown = true; try { localStorage.setItem('cosmos.firstFlight.' + m.p.id, '1'); } catch {}
        sfx.arrive(); this.space.say?.('Down and safe. That was your first flight: she is yours to fly anywhere now.', false);
      }
    }
    if (sh.aboard || this.vehicles?.seated() || !sh.ready || this.space.frameId !== m.ship.frameId || !f.landed) return null;
    const foot = sh.def?.dock?.rampFoot; if (!foot) return null;
    return { id: 'first-flight-ramp', label: 'Your lifeboat, the rear ramp', target: f.toWorld({ x: foot.x, y: 1.2, z: foot.z }, {}), reach: 3, after: 2, named: true };
  }
  /** The words for the step the new pilot is on. */
  _flightText(aboard) {
    const sh = this.shipSystem, f = sh.flight, seat = sh.seat?.id;
    if (!aboard) return sh.state?.ramps?.cargo?.lowered === false
      ? `Power on. Your lifeboat flies. Step 1 of 4: get in. Her ramp is up: stand behind her and use "Lower ramp", then walk up it.`
      : 'Power on. Your lifeboat flies. Step 1 of 4: get in. Follow the arrow to the ramp at her back and walk up it.';
    if (!seat) return `Step 2 of 4: take the pilot seat. Walk forward through the cabin, through the door marked FLIGHT, to the left seat. ${hintFor({ keys: 'Press E when it says Sit · Pilot.', touch: 'The button says "Sit · Pilot" when you are there.', pad: 'Press X when it says Sit · Pilot.' })}`;
    if (seat !== 'pilot') return labelFor('Step 2 of 4: this is not the pilot seat. Stand (E) and take the left seat at the front.');
    if (f.landed && !this._up) return `Step 3 of 4: take off. ${hintFor({ keys: 'Hold Space', touch: 'Hold LIFT ▲', pad: 'Hold A' })} and she rises (the ramp folds away first). Let go and she hovers by herself.`;
    return `Step 4 of 4: you are flying. ${hintFor({ keys: 'W A S D fly her where you look; Space climbs, C sinks.', touch: 'The left thumb flies her where you look; LIFT climbs, SINK comes down.', pad: 'The left stick flies her where you look; A climbs.' })} When you want the ground back: ${hintFor({ keys: 'press L (LAND)', touch: 'tap LAND', pad: 'tap LAND' })}, hands off, and she lands herself.`;
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
    const world = p.home?.world || 'mars', stand = aboard ? labelFor('Stand up (E), leave by the ramp. ') : '';
    if (ship.drained) {
      const miss = missingParts(ship), at = (g) => g.who.replace(/ \(.*\)$/, '');
      if (miss.length === 2) return { text: `${stand}This lifeboat is yours, but it has no power. Step 1 of 3: buy a ${REPAIR_PARTS[miss[0]].name} (300 marks) from ${at(giverFor(world, miss[0]))}. Follow the arrow, then use the button when you reach them.` };
      if (miss.length === 1) return { text: `${stand}Step 2 of 3: buy the ${REPAIR_PARTS[miss[0]].name} (300 marks) from ${at(giverFor(world, miss[0]))}. Follow the arrow, then use the button when you reach them.` };
      return { text: `${stand}Step 3 of 3: both parts are yours. Follow the arrow back to your lifeboat and use "Fit the power cell and the coupler". Then she flies.` };
    }
    // MISSIONS: a job in hand is the next step; otherwise, on Mars the crew first (the Crew Hall), elsewhere the job a person here is offering
    const mt = this.missions, onJob = mt && mt.active();
    if (onJob) return mt.nextGoal(ship);
    if (this._firstFlight()) return { text: this._flightText(aboard) };
    const paid = mt && mt.afterPay(); if (paid) return paid;       // a freight run was just paid: say so, and point back at the board
    const hereWorld = this.space.frameId;
    if (!(ship.crew || []).length && world === 'mars' && hereWorld === 'mars') return { text: `${p.home?.stay ? 'Your ship is on its pad.' : 'Lifeboat ready.'} Next: hire a crew. Walk to the Crew Hall at Marineris Port (the long building at the north end of the pads, an arrow points the way after a minute). Stand at its door and the six people inside come out to meet you; talk to one and tap Hire.` };
    const offer = mt && mt.nextGoal(ship);
    if (offer) return offer;
    return { text: hereWorld === 'mars'
      ? 'Jobs: the Phobos core samples pay 300 credits each (Course, Jobs), and the watch supervisor in the control tower has "A tonne for the foundation", 400 marks. Hands for hire wait at the Crew Hall.'
      : 'No more jobs here for now. Dig, haul and sell what the ground gives, or fly to another world (Course). The people here will have more when the world changes.' };
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
      if (this._at(g, world)) return { label: `Buy the ${REPAIR_PARTS[part].name} · ${REPAIR_PARTS[part].priceMarks} marks`, run: () => this.world.dispatch({ type: 'lifeboat-part', part }) };
    }
    if (!missing.length && ship.frameId === p.frameId && ship.pose?.pos) {
      const a = this.walker.worldPos, b = ship.pose.pos;
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= FIT_REACH) return { label: 'Fit the power cell and the coupler', run: () => this.world.dispatch({ type: 'lifeboat-fit' }) };
    }
    return null;
  }
}
