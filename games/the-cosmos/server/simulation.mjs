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

export const flightFields = ['heading','pitch','roll','yawRate','hull','shield','gearPos','landed','autoHover','airborne','agl','time','climbCap','thrustDown'];
export function flightRecord(f) {
  return {pos:{...f.pos},vel:{...f.vel},quaternion:f.quaternion.toArray(),power:{...f.power},attitude:f.attitude?.toArray()||null,
    ...Object.fromEntries(flightFields.map(k=>[k,f[k]]))};
}
export function applyFlight(f,r) {
  Object.assign(f.pos,r.pos);Object.assign(f.vel,r.vel);Object.assign(f.power,r.power);
  for(const k of flightFields)if(r[k]!==undefined)f[k]=r[k];
  f.attitude=r.attitude?new THREE.Quaternion().fromArray(r.attitude):null;f.refreshOrientation();
}
export class ShipSimulation {
  constructor(record,mars,site,onArrive) {
    this.record=record;this.mars=mars;this.site=site;
    this.frameId=record.frameId||'mars';
    this.flight=new ShipBody(this.body(),(x,y,z)=>surfaceRadiusFast(this.body(),x,y,z));
    this.ship={flight:this.flight,state:record.state||defaultState(),aboard:true};
    this.stations=new Stations(this.flight);
    this.guns=new GunSystem(this.flight,this.stations,(x,y,z)=>surfaceRadiusFast(this.body(),x,y,z));
    this.drones=new DroneSystem(this.flight,this.guns,(x,y,z)=>surfaceRadiusFast(this.body(),x,y,z));
    this.drones.onDown=()=>{record.economy.marks+=BOUNTY_CREDITS*4;};
    this.ship.drones=this.drones;
    this.portSite={...site,toWorld:(x,y,z)=>site.toWorld(record.pad.x+x,y,record.pad.z+z)};
    this.onLanded=dest=>onArrive(dest);this.onHeld=dest=>onArrive(dest);this.say=()=>{};
    this.moonWorld=id=>({body:makeMoon(id)});
    this.portHeading=()=>site.heading;
    this.resolve=id=>SpaceSystem.prototype.resolve.call(this,id);
    if(record.pose)applyFlight(this.flight,record.pose);
    else {
      const p=site.toWorld(record.pad.x,2,record.pad.z);this.flight.setDown(p,site.heading);
      for(let i=0;i<540;i++)this.flight.step(1/60);
    }
    if(!record.state){const hinge=this.flight.toWorld({x:0,y:0,z:20.9},{}),r=Math.hypot(hinge.x,hinge.y,hinge.z),ground=surfaceRadiusFast(this.body(),hinge.x/r,hinge.y/r,hinge.z/r);
      Object.assign(this.ship.state.ramps.cargo,{lowered:true,progress:1,angle:Math.asin(Math.max(.05,Math.min(.9,(r-ground)/5)))});}
    this.trip=null;
    for(let i=0;i<3;i++)this.drones.add(record.id+':raider-'+i,this.flight.pos);
    if(record.combat){const c=record.combat;Object.assign(this.guns,{bolts:c.bolts,cool:c.cool,alt:c.alt,shots:c.shots,aim:c.aim});
      Object.assign(this.drones,{t:c.t,shots:c.enemyShots,neutral:c.neutral,suspended:c.suspended});
      c.drones.forEach((r,i)=>{const d=this.drones.drones[i];Object.assign(d,{...r,target:d.target});Object.assign(d.target,r.target,{pos:d.pos});});}
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
  setFrame(id) {
    if(id===this.frameId)return;
    const from=this.frameId==='mars'?{x:0,y:0,z:0}:makeMoon(this.frameId).centre;
    const to=id==='mars'?{x:0,y:0,z:0}:makeMoon(id).centre;
    for(const k of ['x','y','z'])this.flight.pos[k]+=from[k]-to[k];
    for(const d of this.drones.drones)for(const p of [d.pos,d.anchor])for(const k of ['x','y','z'])p[k]+=from[k]-to[k];
    for(const b of [...this.guns.bolts,...this.drones.shots])for(const k of ['x','y','z']){b[k]+=from[k]-to[k];b['p'+k]+=from[k]-to[k];}
    this.frameId=id;this.flight.body=this.body();this.flight.refreshOrientation();
  }
  engage(id) {
    if(this.trip?.active)throw Error('A course is already under way.');
    const dest=this.resolve(id);if(!dest?.goalS)throw Error('Destination is out of range.');
    if(this.flight.engineFactor<.3||this.flight.landed&&!this.flight.canLiftOff())throw Error('Route more power to engines.');
    this.trip=new SpaceTrip(this,dest);const plan=this.trip._plan();if(!plan.ok){this.trip=null;throw Error(plan.msg);}
    for(const r of Object.values(this.ship.state.ramps)){r.lowered=false;r.progress=0;}
  }
  step(dt,controls={}) {
    if(this.flight.hull<=0){this.flight.controls={fwd:0,lift:0,yaw:0};this.flight.power.engines=0;this.flight.autoHover=false;this.trip=null;this.flight.override=null;}
    else this.flight.controls=this.trip?.active?(this.trip.tick(dt)||{fwd:0,lift:0,yaw:0}):controls;
    this.flight.step(dt);if(this.trip&&!this.trip.active){this.trip=null;this.flight.override=null;}
    this.guns.update(dt);this.drones.update(dt);
  }
  capture() {
    const t=this.trip;
    this.record.pose=flightRecord(this.flight);this.record.frameId=this.frameId;
    this.record.trip=t?{destId:t.dest.id,dest:{id:t.dest.id,kind:t.dest.kind,name:t.dest.name,moon:t.dest.moon},phase:t.phase,t:t.t,warp:1,settleT:t.settleT,cancelled:t.cancelled,
      progress:{...t.progress},said:[...t._said],attFrom:t._attFrom?.toArray()||null,transit:t.transit?structuredClone(t.transit):null}:null;
    this.record.state=this.ship.state;
    this.record.combat={bolts:structuredClone(this.guns.bolts),cool:{...this.guns.cool},alt:{...this.guns.alt},shots:{...this.guns.shots},aim:structuredClone(this.guns.aim),
      t:this.drones.t,enemyShots:structuredClone(this.drones.shots),neutral:this.drones.neutral,suspended:this.drones.suspended,drones:this.drones.drones.map(d=>structuredClone(d))};
  }
}
