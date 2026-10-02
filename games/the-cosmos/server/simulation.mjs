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
import { BOUNTY_CREDITS } from '../src/space/spaceSpec.js';
import { CrewSystem } from '../src/crew/crewSystem.js';
import { CREW_POSTS } from '../src/crew/crewSpec.js';
import { ShipSystem } from '../src/ship/shipSystem.js';
import { shipDef } from '../src/ships/registry.js';

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
    this.resolve=id=>SpaceSystem.prototype.resolve.call(this,id);
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
  crewOrder(p,a,authority){if(p.aboardShipId!==this.record.id)throw Error('Come aboard first.');
    this.syncCrew();this.ship.aboard=true;
    const result=this.crew.order(a.order,a.args||{});if(!result.ok)throw Error(result.msg);return result;
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
    this.trip=new SpaceTrip(this,dest);const plan=this.trip._plan();if(!plan.ok){this.trip=null;throw Error(plan.msg);}
    this.crew.cancelOrder();
    for(const [key,r] of Object.entries(this.ship.state.ramps)){r.lowered=false;r.target=0;this.ship.rampCtl[key].target=0;}
    return {ok:true,msg:'Course set for '+dest.name+'.'};
  }
  step(dt,controls={}) {
    // FLEET: a raider is flown by the fleet director. One with no hull left still steps, so it hangs where it is instead of falling.
    if(this.record.npc){this.flight.controls=controls;this.flight.step(dt);this.guns.update(dt);this.drones.update(dt);return;}
    if(this.flight.hull<=0){this.flight.controls={fwd:0,lift:0,yaw:0};this.flight.power.engines=0;this.flight.autoHover=false;this.trip=null;this.flight.override=null;}
    else {this.syncCrew();
      const manual=Object.values(controls).some(v=>Math.abs(v)>.05);
      if(manual&&this.crew.hasOrder())this.crew.cancelOrder();
      if(manual&&this.trip?.active&&this.trip.phase!=='transit')this.trip.cancel();
      this.flight.controls=this.trip?.active?(this.trip.tick(dt)||{fwd:0,lift:0,yaw:0}):manual?controls:this.crew.pilotControls(dt)||controls;
    }
    if(this.flight.landed&&this.flight.controls.lift>0&&Object.values(this.ship.rampCtl).some(r=>r.progress>.02)){
      this.flight.controls.lift=0;if(!this.ship._rampOccupied('cargo'))this.ship.rampCtl.cargo.target=0;
      if(this.ship.state.airlock.outerOpen&&this.ship.air.phase==='idle')this.ship.cycleAirlock();
    }
    this.flight.step(Math.max(dt,Math.min(dt*(this.trip?.stickWarp(dt)||1),1)));
    if(this.trip&&!this.trip.active){this.trip=null;this.flight.override=null;this.flight.climbCap=12;this.flight.thrustDown=false;}
    for(const [key,c] of Object.entries(this.ship.rampCtl)){const speed=key==='cargo'?1/6:1/5;
      c.progress+=Math.sign(c.target-c.progress)*Math.min(Math.abs(c.target-c.progress),dt*speed);
      Object.assign(this.ship.state.ramps[key],{...c,lowered:c.progress>=.999&&c.target>=1});}
    this.ship._airlockStep(dt);
    if(this.flight.landed&&this.flight.hull<100&&this.ship.rampCtl.cargo.progress<.02)this.flight.hull=Math.min(100,this.flight.hull+dt*.5);
    this.guns.update(dt);this.drones.update(dt);
  }
  capture() {
    const t=this.trip;
    this.record.pose=flightRecord(this.flight);this.record.frameId=this.frameId;
    this.record.trip=t?{destId:t.dest.id,dest:{id:t.dest.id,kind:t.dest.kind,name:t.dest.name,moon:t.dest.moon},phase:t.phase,t:t.t,warp:t.warp,eff:t.eff,planS:t.planS,settleT:t.settleT,cancelled:t.cancelled,
      progress:{...t.progress},said:[...t._said],attFrom:t._attFrom?.toArray()||null,transit:t.transit?structuredClone(t.transit):null}:null;
    this.record.state=this.ship.state;
    this.record.air={...this.ship.air};this.record.order=this.crew.activeOrder()||this.crew.pending?.o||null;
    const ap=this.crew.ap;this.record.autopilot=ap?structuredClone(Object.fromEntries(['order','steps','step','t','out','_think','_seen','_lastCall'].map(k=>[k,ap[k]]))):null;
    this.record.pendingOrder=this.crew.pending?{o:structuredClone(this.crew.pending.o),t:this.crew.pending.t}:null;
    this.record.combat={bolts:structuredClone(this.guns.bolts),cool:{...this.guns.cool},alt:{...this.guns.alt},shots:{...this.guns.shots},aim:structuredClone(this.guns.aim),
      t:this.drones.t,enemyShots:structuredClone(this.drones.shots),neutral:this.drones.neutral,suspended:this.drones.suspended,drones:this.drones.drones.map(d=>structuredClone(d)),
      practice:this.guns.targets.filter(t=>t.id.includes(':practice-')).map(t=>({hp:t.hp,respawn:t.respawn,inactive:t.inactive}))};
  }
}
