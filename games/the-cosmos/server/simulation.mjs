import * as THREE from 'three';
import { ShipBody } from '../src/ship/shipFlight.js';
import { defaultState } from '../src/ship/shipWalker.js';
import { SpaceTrip } from '../src/space/spaceTrip.js';
import { SpaceSystem } from '../src/space/spaceSystem.js';
import { Transit } from '../src/space/transit.js';
import { makeMoon } from '../src/space/moonField.js';
import { surfaceRadiusFast } from '../src/world/field.js';
import { GunSystem, DroneSystem } from '../src/ship/guns.js';
import { Stations } from '../src/ship/shipStations.js';
import { BOUNTY_CREDITS, STANDOFF_M, landingOrder, stickWarpCap } from '../src/space/spaceSpec.js';
import { CrewSystem } from '../src/crew/crewSystem.js';
import { Autopilot } from '../src/crew/autopilot.js';
import { CREW_POSTS } from '../src/crew/crewSpec.js';
import { ShipSystem } from '../src/ship/shipSystem.js';
import { shipDef } from '../src/ships/registry.js';
import { FreeFlight } from '../src/space/freeflight.js';   // FREEFLIGHT
import { FREE } from '../src/space/spaceSpec.js';

export const flightFields = ['heading','pitch','roll','yawRate','hull','shield','shieldMax','gearPos','landed','autoHover','airborne','agl','time','climbCap','thrustDown','thrustUp','thrustFwd'];
export function flightRecord(f) {
  return {pos:{...f.pos},vel:{...f.vel},quaternion:f.quaternion.toArray(),power:{...f.power},attitude:f.attitude?.toArray()||null,legs:structuredClone(f.legs),
    ...Object.fromEntries(flightFields.map(k=>[k,f[k]]))};
}
export function applyFlight(f,r) {
  Object.assign(f.pos,r.pos);Object.assign(f.vel,r.vel);Object.assign(f.power,r.power);
  for(const k of flightFields)if(r[k]!==undefined)f[k]=r[k];
  r.legs?.forEach((leg,i)=>Object.assign(f.legs[i],leg));
  f.attitude=r.attitude?new THREE.Quaternion().fromArray(r.attitude):null;f.refreshOrientation();
}
export class ShipSimulation {
  constructor(record,mars,site,onArrive) {
    this.record=record;this.mars=mars;this.site=site;
    this.warp=record.flightWarp||1;this.eff=1;
    this.frameId=record.frameId||'mars';
    // FLEET: a ship is whatever its `type` says (src/ships/registry.js): its gear, guns, seats and hull numbers come from there.
    this.def=shipDef(record.type);
    this.flight=new ShipBody(this.body(),(x,y,z)=>surfaceRadiusFast(this.body(),x,y,z),this.def);
    this.ship={flight:this.flight,state:record.state||defaultState(),aboard:true,def:this.def};
    this.ship.body=mars;this.ship.ground=(x,y,z)=>surfaceRadiusFast(this.body(),x,y,z);
    this.ship.note=(msg,warn=false)=>{record.messages=record.messages||[];record.messageSeq=(record.messageSeq||0)+1;
      record.messages.push({seq:record.messageSeq,msg,warn});record.messages=record.messages.slice(-20);};
    this.ship.air=record.air||{phase:'idle',t:0};
    this.stations=new Stations(this.flight,{},this.def);
    this.guns=new GunSystem(this.flight,this.stations,(x,y,z)=>surfaceRadiusFast(this.body(),x,y,z),this.def);
    this.drones=new DroneSystem(this.flight,this.guns,(x,y,z)=>surfaceRadiusFast(this.body(),x,y,z));
    this.drones.onDown=()=>{record.economy.marks+=BOUNTY_CREDITS*4;};
    this.ship.drones=this.drones;
    this.portSite={...site,toWorld:(x,y,z)=>site.toWorld(record.pad.x+x,y,record.pad.z+z)};
    this.ship.space=this;
    this.crew=new CrewSystem({ship:this.ship,site,ground:this.ship.ground,onSay:()=>{}});this.crew.account=record.economy;
    const local=this.crew._local.bind(this.crew);this.crew._local=(x,z)=>x===0&&z===0?this.portSite.toWorld(0,0,0):local(x,z);
    this.ship.rampCtl=Object.fromEntries(Object.entries(this.ship.state.ramps).map(([k,r])=>[k,{progress:r.progress??(r.lowered?1:0),target:r.target??(r.lowered?1:0),angle:r.angle}]));
    this.ship._applyRampPose=()=>{};this.ship._rampOccupied=()=>false;
    for(const name of ['_solveRamp','_airlockStep','cycleAirlock'])this.ship[name]=ShipSystem.prototype[name].bind(this.ship);
    this.onLanded=dest=>onArrive(dest);this.onHeld=dest=>onArrive(dest);this.say=(msg,warn)=>this.ship.note(msg,warn);
    this.moonWorld=id=>({body:makeMoon(id)});
    this.portHeading=()=>site.heading;
    this.resolve=id=>{
      const dest=SpaceSystem.prototype.resolve.call(this,id);
      if(!dest||dest.kind!=='moon')return dest;
      const pad=record.moonPads?.[dest.moon];
      if(!pad||!Number.isFinite(pad.east)||!Number.isFinite(pad.north))return dest;
      const moon=dest.moon;
      dest.goalS=()=>{const b=makeMoon(moon),c=b.centre,s=b.playerPad(pad.east,pad.north).standoff(STANDOFF_M);return {x:c.x+s.x,y:c.y+s.y,z:c.z+s.z};};
      dest.name=`${dest.name} (pad ${pad.number})`;
      return dest;
    };
    if(record.pose)applyFlight(this.flight,record.pose);
    else if(record.pad) {
      const p=site.toWorld(record.pad.x,2,record.pad.z);this.flight.setDown(p,site.heading);
      for(let i=0;i<540;i++)this.flight.step(1/60);
    }
    // (a raider that has no pose yet is placed at its station by the fleet director, server/fleet.mjs)
    const ramp=this.def.ramps.cargo;
    if(!record.state&&record.pad){const hinge=this.flight.toWorld(ramp.hinge,{}),r=Math.hypot(hinge.x,hinge.y,hinge.z),ground=surfaceRadiusFast(this.body(),hinge.x/r,hinge.y/r,hinge.z/r);
      Object.assign(this.ship.state.ramps.cargo,{lowered:true,progress:1,angle:Math.asin(Math.max(.05,Math.min(.9,(r-ground)/ramp.length)))});}
    this.trip=null;
    // FREEFLIGHT: manual flight anywhere (src/space/freeflight.js). The authority owns it: inputs are clamped intents, the physics is this file's.
    this.allSims=()=>[];
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
    this.ff=new FreeFlight({flight:this.flight,mars,frameId:()=>this.frameId,setFrame:id=>this.setFrame(id),say:(m,w)=>this.ship.note(m,w),drones:this.drones,
      cancelOrders:()=>this.crew.cancelOrder(),tripActive:()=>!!this.trip?.active,
      atPad:()=>this.frameId==='mars'&&dist(this.flight.pos,this.portSite.toWorld(0,0,0))<60,
      hostileNear:()=>{for(const o of this.allSims())if(o!==this&&o.record.npc&&o.frameId===this.frameId&&o.flight.hull>0&&dist(o.flight.pos,this.flight.pos)<FREE.raiderNearM)return true;return false;},
      shipNear:()=>{for(const o of this.allSims())if(o!==this&&!o.record.npc&&!o.flight.landed&&o.frameId===this.frameId&&dist(o.flight.pos,this.flight.pos)<FREE.shipNearM)return true;return false;}});
    if(record.ff)this.ff.load(record.ff);
    if(!record.state){Object.assign(this.ship.rampCtl.cargo,{progress:1,target:1,angle:this.ship.state.ramps.cargo.angle});}
    // FLEET: the three drones that used to arrive around a ship are a raider's escorts now (src/ships/raider/escorts.js).
    // The authority does not spawn them on a player's ship. Solo still does, from def.features.personalDrones (shipSystem.js).
    // Practice discs stay, at the solo places, so an online Meridian you can shoot at matches a solo one. A raider has none.
    // A save from before the fleet that still lists the old drones is restored only as far as this ship actually has drones.
    if(this.def.features.practiceTargets){
      for(const [i,[d,side]] of [[120,-25],[190,30],[260,-5]].entries()){
        const f=this.flight,b=f.pos,p={x:b.x+f.fwdH.x*d+f.rightH.x*side,y:b.y+f.fwdH.y*d+f.rightH.y*side,z:b.z+f.fwdH.z*d+f.rightH.z*side},r=Math.hypot(p.x,p.y,p.z),R=this.ship.ground(p.x/r,p.y/r,p.z/r)+3.2;
        this.guns.addTarget({id:record.id+':practice-'+i,pos:{x:p.x/r*R,y:p.y/r*R,z:p.z/r*R},radius:1.5});
      }
    }
    if(record.combat){const c=record.combat;Object.assign(this.guns,{bolts:c.bolts,cool:c.cool,alt:c.alt,shots:c.shots,aim:c.aim});
      Object.assign(this.drones,{t:c.t,shots:c.enemyShots,neutral:c.neutral,suspended:c.suspended});
      (c.drones||[]).forEach((r,i)=>{const d=this.drones.drones[i];if(!d)return;Object.assign(d,{...r,target:d.target});Object.assign(d.target,r.target,{pos:d.pos});});}
    record.combat?.practice?.forEach((r,i)=>{const t=this.guns.targets.filter(q=>q.id.includes(':practice-'))[i];if(t)Object.assign(t,r);});
    if(record.autopilot){this.crew._ensureAP();Object.assign(this.crew.ap,structuredClone(record.autopilot));}
    if(record.pendingOrder)this.crew.pending=structuredClone(record.pendingOrder);
    if(record.trip) {
      const r=record.trip, dest={...this.resolve(r.destId),...r.dest};
      if(dest.kind==='hold')dest.goalS=()=>r.transit.finalGoal;
      if(!dest.kind)throw Error('Unknown saved destination.');
      this.trip=new SpaceTrip(this,dest);Object.assign(this.trip,r);this.trip.dest=dest;
      this.trip._said=new Set(r.said);delete this.trip.said;
      this.trip._attFrom=r.attFrom?new THREE.Quaternion().fromArray(r.attFrom):null;
      if(r.transit){this.trip.transit=Object.assign(Object.create(Transit.prototype),r.transit);this.flight.override=dt=>this.trip._drive(dt);}
    }
  }
  body(){return this.frameId==='mars'?this.mars:makeMoon(this.frameId);}
  _shipS(){const c=this.frameId==='mars'?{x:0,y:0,z:0}:makeMoon(this.frameId).centre;return {x:this.flight.pos.x+c.x,y:this.flight.pos.y+c.y,z:this.flight.pos.z+c.z};}
  _gatePoint(p){return SpaceSystem.prototype._gatePoint.call(this,p);}
  destinations(){return [];}
  syncCrew(){this.crew.time=this.record.economy.elapsedSeconds;this.crew.members.clear();
    for(const c of this.record.crew){const post=this.def.crewPosts.find(r=>r.id===c.role)||CREW_POSTS.find(r=>r.id===c.role);if(!post)continue;const def={...post,skill:c.skill};
      this.crew.members.set(c.id,{...c,def,status:'hired',seated:c.status==='aboard'&&!c.displaced,mode:c.status==='aboard'?'sit':c.status==='boarding'?'boarding':c.status.startsWith('leaving')?'leaving':'walk'});}
  }
  orderKey(order,args){if(order==='hold')return null;if(order==='goto')return `goto:${args?.id||''}`;return order;}
  /** The same order, already being flown, is not given again. A second player or a repeated click keeps the one flight. */
  _sameOrder(order,args,key){
    if(!key)return false;
    if(order==='goto'&&String(args.id||'').startsWith('sp:')){
      const id=String(args.id).slice(3);
      if(this.trip?.active&&this.trip.dest?.id===id){this.record.orderKey=key;return true;}
      return false;
    }
    if(this.record.orderKey!==key)return false;
    if(this.crew.pending?.o&&this.crew.pending.o.type!=='hold')return true;
    return this.crew.hasOrder();
  }
  crewOrder(p,a){if(p.aboardShipId!==this.record.id)throw Error('Come aboard first.');
    this.syncCrew();this.ship.aboard=true;
    const args=a.args||{},key=this.orderKey(a.order,args);
    if(a.order!=='hold')this.ff.suspend('The pilot has the ship.');   // FREEFLIGHT
    if(this._sameOrder(a.order,args,key))return {ok:true,same:true,msg:'Already on that order.'};
    const result=this.crew.order(a.order,args);if(!result.ok)throw Error(result.msg);
    this.record.orderKey=key;return result;
  }
  cycleAirlock(){if(!this.ship.cycleAirlock())throw Error('The airlock is busy or cannot open here.');}
  setFrame(id) {
    if(id===this.frameId)return;
    const from=this.frameId==='mars'?{x:0,y:0,z:0}:makeMoon(this.frameId).centre;
    const to=id==='mars'?{x:0,y:0,z:0}:makeMoon(id).centre;
    for(const k of ['x','y','z'])this.flight.pos[k]+=from[k]-to[k];
    for(const d of this.drones.drones)for(const p of [d.pos,d.anchor])for(const k of ['x','y','z'])p[k]+=from[k]-to[k];
    for(const b of [...this.guns.bolts,...this.drones.shots])for(const k of ['x','y','z']){b[k]+=from[k]-to[k];b['p'+k]+=from[k]-to[k];}
    this.frameId=id;this.ship.body=this.flight.body=this.body();this.flight.refreshOrientation();
  }
  engage(id) {
    if(this.trip?.active)throw Error('A course is already under way.');
    const dest=this.resolve(id);if(!dest?.goalS)throw Error('Destination is out of range.');
    if(this.flight.engineFactor<.3||this.flight.landed&&!this.flight.canLiftOff())throw Error('Route more power to engines.');
    this.ff.suspend('The autopilot has the ship.');
    this.trip=new SpaceTrip(this,dest);const plan=this.trip._plan();if(!plan.ok){this.trip=null;throw Error(plan.msg);}
    this.crew.cancelOrder();
    for(const [key,r] of Object.entries(this.ship.state.ramps)){r.lowered=false;r.target=0;this.ship.rampCtl[key].target=0;}
    return {ok:true,msg:'Course set for '+dest.name+'.'};
  }
  step(dt,controls={},ffInput=null,o={}) {
    // FLEET: a raider is flown by the fleet director. One with no hull left still steps, so it hangs where it is instead of falling.
    if(this.record.npc){this.flight.controls=controls;this.flight.step(dt);this.guns.update(dt);this.drones.update(dt);return;}
    if(this.flight.hull<=0){this.ff.suspend('The hull is gone.');this.flight.controls={fwd:0,lift:0,yaw:0};this.flight.power.engines=0;this.flight.autoHover=false;this.trip=null;this.flight.override=null;}
    else {this.syncCrew();
      const ffManual=!!ffInput&&this.ff.active&&Object.entries(ffInput).some(([k,v])=>k==='brake'?!!v:Math.abs(+v)>.05);   // FREEFLIGHT
      const manual=Object.values(controls).some(v=>Math.abs(v)>.05)||ffManual;
      // A hand on the stick ends an escort. The escort is the ship's own autopilot (escortAp), not a crew order:
      // a ship with nobody in the pilot's seat would have pilotControls cancel a crew order on the next tick.
      if(manual&&this.record.escort){this.record.escort=null;this.escortAp=null;}
      if(manual&&this.crew.hasOrder())this.crew.cancelOrder();
      if(manual&&this.trip?.active&&this.trip.phase!=='transit')this.trip.cancel();
      if(!manual)this._escortCatchTrip();
      const escort=!manual&&!this.trip?.active?this.escortStick(dt):null;
      this.flight.controls=this.trip?.active?(this.trip.tick(dt)||{fwd:0,lift:0,yaw:0}):manual?controls:(escort||this.crew.pilotControls(dt)||controls);
    }
    if(this.flight.landed&&this.flight.controls.lift>0&&Object.values(this.ship.rampCtl).some(r=>r.progress>.02)){
      this.flight.controls.lift=0;if(!this.ship._rampOccupied('cargo'))this.ship.rampCtl.cargo.target=0;
      if(this.ship.state.airlock.outerOpen&&this.ship.air.phase==='idle')this.ship.cycleAirlock();
    }
    // FREEFLIGHT: free flight takes the ship above the air, hands her back low and slow; it sets how fast time runs while it has her.
    this.ff.setInput(this.ff.active?ffInput:null);
    const ffEff=this.ff.preStep(dt,{catchUp:!!o.catchUp});
    this.eff=this.trip?.active?this.trip.stickWarp(dt):(this.ff.active||this.ff.enabled)?ffEff:landingOrder(this.crew.activeOrder())?stickWarpCap(this.warp,this.flight.agl,this.flight.verticalSpeed,dt):1;
    if(this.restCoarse){const fdt=Math.min(dt,1/30);this.flight.step(fdt);this.flight.updateShields(dt-fdt);} // a settled hull on its pad: one short physics step is the same answer as sixty, the rest of the time only recharges shields
    else if(this.ff.active)this.flight.step(dt*this.eff);
    else this.flight.step(Math.max(dt,Math.min(dt*this.eff,1)));
    if(this.trip&&!this.trip.active){this.trip=null;this.flight.override=null;this.flight.climbCap=12;this.flight.thrustDown=false;}
    for(const [key,c] of Object.entries(this.ship.rampCtl)){const speed=key==='cargo'?1/6:1/5;
      c.progress+=Math.sign(c.target-c.progress)*Math.min(Math.abs(c.target-c.progress),dt*speed);
      Object.assign(this.ship.state.ramps[key],{...c,lowered:c.progress>=.999&&c.target>=1});}
    this.ship._airlockStep(dt);
    if(this.flight.landed&&this.flight.hull<100&&this.ship.rampCtl.cargo.progress<.02)this.flight.hull=Math.min(100,this.flight.hull+dt*.5);
    this.guns.update(dt);this.drones.update(dt);
  }
  /**
   * Hold or follow another ship (`record.escort = { mode, targetId }`). Hold is a zero stick.
   * Follow flies a slot behind the target. A missing target, or one in another frame, holds.
   * Returns null when this ship has no escort, so the crew pilot can fly instead.
   */
  escortStick(dt) {
    const esc = this.record.escort;
    if (!esc) return null;
    const tgt = this.otherSim?.(esc.targetId);
    if (!tgt || tgt.frameId !== this.frameId || !tgt.flight) return { fwd: 0, lift: 0, yaw: 0 };
    if (esc.mode !== 'follow') return { fwd: 0, lift: 0, yaw: 0 };
    if (!this.escortAp) {
      const flyer = this.crew.flyer();
      this.escortAp = new Autopilot(this.flight, {
        ground: (x, y, z) => this.ship.ground(x, y, z),
        skill: flyer?.def?.skill ?? 0.75,
        home: { x: this.flight.pos.x, y: this.flight.pos.y, z: this.flight.pos.z },
        seed: 7,
      });
      this.escortAp.setOrder({ type: 'follow' });
    }
    this.escortAp._slot = this.escortAp.followSlot(tgt.flight);
    return this.escortAp.update(dt);
  }

  /** When the ship we are following starts a drive trip in this frame, set the same course. A refusal stays in formation. */
  _escortCatchTrip() {
    const esc = this.record.escort;
    if (!esc || esc.mode !== 'follow' || this.trip?.active) return;
    const tgt = this.otherSim?.(esc.targetId);
    if (!tgt || tgt.frameId !== this.frameId || !tgt.trip?.active) return;
    const id = tgt.trip.dest?.id;
    if (!id) return;
    if (this.flight.time < (this._escortTryAt || 0)) return;
    this._escortTryAt = this.flight.time + 1;
    try { this.engage(id); }
    catch (e) { if (this._escortTried !== id) { this._escortTried = id; this.ship.note(e.message || 'Could not follow that course.'); } }
  }

  capture() {
    const t=this.trip;
    this.record.pose=flightRecord(this.flight);this.record.frameId=this.frameId;this.record.ff=this.ff.save();
    this.record.flightWarp=this.warp;this.record.flightEff=this.eff;
    this.record.trip=t?{destId:t.dest.id,dest:{id:t.dest.id,kind:t.dest.kind,name:t.dest.name,moon:t.dest.moon},phase:t.phase,t:t.t,warp:t.warp,eff:t.eff,planS:t.planS,settleT:t.settleT,cancelled:t.cancelled,
      progress:{...t.progress},said:[...t._said],attFrom:t._attFrom?.toArray()||null,transit:t.transit?structuredClone(t.transit):null}:null;
    this.record.state=this.ship.state;
    this.record.air={...this.ship.air};this.record.order=this.crew.activeOrder()||this.crew.pending?.o||null;
    const pending=this.crew.pending;
    const spaceLive=!!(t?.active&&this.record.orderKey&&this.record.orderKey===`goto:sp:${t.dest?.id}`);
    if(!spaceLive&&(pending?.o?.type==='hold'||(!this.crew.hasOrder()&&!pending)))this.record.orderKey=null;
    const ap=this.crew.ap;this.record.autopilot=ap?structuredClone(Object.fromEntries(['order','steps','step','t','out','_think','_seen','_lastCall'].map(k=>[k,ap[k]]))):null;
    this.record.pendingOrder=this.crew.pending?{o:structuredClone(this.crew.pending.o),t:this.crew.pending.t}:null;
    this.record.combat={bolts:structuredClone(this.guns.bolts),cool:{...this.guns.cool},alt:{...this.guns.alt},shots:{...this.guns.shots},aim:structuredClone(this.guns.aim),
      t:this.drones.t,enemyShots:structuredClone(this.drones.shots),neutral:this.drones.neutral,suspended:this.drones.suspended,drones:this.drones.drones.map(d=>structuredClone(d)),
      practice:this.guns.targets.filter(t=>t.id.includes(':practice-')).map(t=>({hp:t.hp,respawn:t.respawn,inactive:t.inactive}))};
  }
}
