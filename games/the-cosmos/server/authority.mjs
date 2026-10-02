import { createHash, randomUUID } from 'node:crypto';
import { getBody } from '../src/world/bodies.js';
import { attachGrades, attachEdits } from '../src/world/field.js';
import { createPortSite, TOWER_SPOTS, TOWER, clearSpoilGround } from '../src/port/portSpec.js';
import { PORT_WORKERS } from '../src/port/portPeople.js';
import { rampEntry } from '../src/ship/rampTransfer.js';
import { TowerElevator } from '../src/port/towerElevator.js';
import { allocatedPad, allocatedMoonPad, landingField } from '../src/world-state/fleet.js';
import { initialEconomy, reduceEconomy, sumExact } from '../src/economy/economy.js';
import { WAGES, SOL_SECONDS, QUESTS } from '../src/economy/catalog.js';
import { CREW_POSTS } from '../src/crew/crewSpec.js';           // the Meridian's posts, and the pool of candidates the hall holds
import { EditStore } from '../src/world/edits.js';
import { Walker } from '../src/player/walker.js';
import { Digger } from '../src/player/digging.js';
import { ShipWalker, shipIndexFor } from '../src/ship/shipWalker.js';
// FLEET: a ship is whatever its `type` field says. Seats, ramps, docks, guns and posts come from its definition (src/ships/).
import { shipDef, hasShipType, DEFAULT_SHIP_TYPE } from '../src/ships/registry.js';
import { SHIPYARD, forSale } from '../src/ships/shipyard.js';
import { FleetDirector } from './fleet.mjs';
import { RAIDER_CREW_POSTS } from '../src/ships/raider/crew.js';
import { encodeBrick, terrainMeta, restoreTerrain } from '../src/world-state/terrainCodec.js';
import { makeMoon, attachMoonPads } from '../src/space/moonField.js';
import { GunnerAI } from '../src/crew/gunnerAI.js';
import { routeToSeat, RouteWalker } from '../src/crew/shipPath.js';
import { SAMPLE_PAY_CREDITS, SAMPLE_REACH_M, SALVAGE_CREDITS, SALVAGE_KG, SALVAGE_REACH_M, MAT_ITEM } from '../src/space/jobs.js';
import { ShipSimulation } from './simulation.mjs';

const hash = s=>createHash('sha256').update(s).digest('hex');
const cleanName=s=>String(s||'Visitor').replace(/[<>\x00-\x1f]/g,'').slice(0,32);
const finitePoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const yes=(msg='Saved to the shared world.')=>({ok:true,msg});
// A hired pilot's order is work, even while the ship is still on the ground. Hold is not.
const orderLive=sim=>{const r=sim.record,p=r.pendingOrder?.o,o=r.order,ap=r.autopilot?.order;
  if(p&&p.type&&p.type!=='hold')return true;
  if(o&&o.type&&o.type!=='hold')return true;
  if(ap&&ap.type&&ap.type!=='hold')return true;
  return !!r.orderKey;};
export const CREW_HALL={x:-28,z:-68,w:24,d:14,h:5,door:{x:-28,z:-60}};

export class Authority {
  constructor(adapter,{now=Date.now}={}) {
    this.adapter=adapter;this.now=now;this.mars=getBody('mars');this.site=createPortSite(this.mars);
    this.sessions=new Map();this.inputs=new Map();this.queue=Promise.resolve();this.error='';this.bricks=new Map();
    this.state={schema:2,revision:0,clock:0,savedAt:now(),players:{},ships:{},pads:[],pool:{},poolSeq:0,
      market:initialEconomy(),terrain:{},damage:{},receipts:{}};
    this.fleet=new FleetDirector(this);
  }
  async load(){const s=await this.adapter.load();if(s.record){if(s.record.schema!==2)throw Error('Unsupported authority schema.');this.state=s.record;}
    for(const c of Object.values(this.state.pool))if(!c.shipId&&c.status==='inside'&&c.position.x===CREW_HALL.x&&c.position.z===CREW_HALL.z)c.position.x+=(CREW_POSTS.findIndex(r=>r.id===c.role)-2.5)*2.4;
    for(const p of Object.values(this.state.players))p.offlineAt=p.offlineAt||this.state.savedAt;
    this.bricks=new Map(s.bricks.map(b=>[b.key,b]));this.rebuild();this.refill();
    // Restart catch-up uses real elapsed time. It continues trips/wages, never a browser clock.
    const elapsed=Math.max(0,(this.now()-this.state.savedAt)/1000);
    if(elapsed){this.advance(elapsed,{catchUp:true});}
    this.fleet.ensure();await this.commit();return this;
  }
  rebuild(){attachGrades([this.site,landingField(this.site,()=>this.state.pads)]);
    attachMoonPads(()=>{const out=[];for(const s of Object.values(this.state.ships)){if(!s.moonPads)continue;
      for(const id of ['phobos','deimos'])if(s.moonPads[id])out.push(s.moonPads[id]);}return out;});
    this.stores=new Map();
    this.elevator=Object.assign(new TowerElevator(),this.state.elevator||{});this.crewRoutes=new Map();
    for(const id of ['mars','phobos','deimos']){const e=new EditStore(id==='mars'?this.mars:makeMoon(id));attachEdits(e);
      restoreTerrain(e,this.state.terrain[id],[...this.bricks.values()].filter(b=>b.bodyId===id));this.stores.set(id,e);}
    this.sims=new Map(Object.values(this.state.ships).map(s=>[s.id,this.makeSim(s)]));
  }
  /** One ship's simulation, whatever its type; a raider also gets its brain and its escort wing. */
  makeSim(s){this.ensureMoonPads(s);const sim=new ShipSimulation(s,this.mars,this.site,d=>this.arrive(s,d));sim.otherSim=id=>this.sims.get(id);if(s.npc)this.fleet.attach(sim);return sim;}
  /** One Phobos pad and one Deimos pad per owned ship. Append-only: a pad already on the record stays put. */
  ensureMoonPads(ship){if(ship.npc)return;ship.moonPads=ship.moonPads||{};
    for(const bodyId of ['phobos','deimos']){const cur=ship.moonPads[bodyId];
      if(cur&&cur.shipId===ship.id&&Number.isFinite(cur.east)&&Number.isFinite(cur.north))continue;
      let index=0;for(const other of Object.values(this.state.ships)){if(other===ship||other.npc)continue;
        const p=other.moonPads?.[bodyId];if(p&&Number.isFinite(p.east))index++;}
      ship.moonPads[bodyId]=allocatedMoonPad(bodyId,index,ship.id);}}
  enqueue(fn){const p=this.queue.then(fn);this.queue=p.catch(()=>{});return p;}
  publicState(){const s=structuredClone(this.state);delete s.receipts;
    for(const p of Object.values(s.players)){delete p.deviceHash;p.online=this.sessions.has(p.id);}
    s.storageError=this.error;
    return s;
  }
  async commit(){for(const sim of this.sims.values()){sim.capture();this.fleet.capture(sim);}const changed=[];
    this.state.elevator=structuredClone(this.elevator);
    for(const [id,e] of this.stores){this.state.terrain[id]=structuredClone(terrainMeta(e));
      for(const key of e._dirty){const b=e.bricks.get(key);if(b?.edited)changed.push({...encodeBrick(e,b),key:id+':'+key,bodyId:id});}}
    this.state.savedAt=this.now();this.state.revision++;
    await this.adapter.save(structuredClone(this.state),changed);
    for(const b of changed)this.bricks.set(b.key,b);for(const e of this.stores.values())e._dirty.clear();
    this.error='';return changed;
  }
  async join(deviceKey,name,personId='isaiah') {
    if(typeof deviceKey!=='string'||deviceKey.length<24||deviceKey.length>128)throw Error('Invalid device identity.');
    const key=hash(deviceKey);let p=Object.values(this.state.players).find(p=>p.deviceHash===key);
    const before=structuredClone(this.state);
    try{
      if(!p){const id=randomUUID(),shipId=randomUUID(),pad=allocatedPad(this.state.pads.length,shipId);this.state.pads.push(pad);
        const ship={id:shipId,owner:id,type:DEFAULT_SHIP_TYPE,pad,crewMayBoard:false,crew:[],hold:{},holdLots:[],jobs:{taken:[],samples:[],salvaged:false},economy:initialEconomy(),frameId:'mars',pose:null,trip:null};
        this.state.ships[shipId]=ship;this.sims.set(shipId,this.makeSim(ship));
        p={id,deviceHash:key,name:cleanName(name),personId:/^[a-z]{2,24}$/.test(personId)?personId:'isaiah',shipId,currentShipId:shipId,aboardShipId:null,frameId:'mars',
          pose:{worldPos:this.site.toWorld(pad.x-10,.02,pad.z+38),velocity:{x:0,y:0,z:0},yaw:this.site.heading,pitch:0,grounded:true,aboard:false,sw:{x:0,y:0,z:12,yaw:0,pitch:0},seat:null,look:{yaw:0,pitch:0}},toolIdx:1,carried:[]};
        this.state.players[id]=p;
      }else p.name=cleanName(name||p.name);
      await this.commit();this.sessions.get(p.id)?.close();return p;
    }catch(e){this.state=before;this.rebuild();throw e;}
  }
  refill(){const available=Object.values(this.state.pool).filter(c=>!c.shipId&&!c.retired);
    for(const role of CREW_POSTS){if(available.some(c=>c.role===role.id)||Object.values(this.state.pool).some(c=>c.role===role.id&&c.shipId&&c.refillAt>this.state.clock))continue;
      const seq=++this.state.poolSeq;const suffix=seq<=6?'':` ${['Rivera','Okafor','Chen','Patel','Diaz','Khan'][seq%6]} ${Math.floor(seq/6)}`;
      const slot=CREW_POSTS.indexOf(role);
      this.state.pool['candidate-'+seq]={id:'candidate-'+seq,role:role.id,name:role.name+suffix,personId:role.personId,skill:role.skill,
        wageCredits:WAGES[role.id],shipId:null,status:'inside',position:{x:CREW_HALL.x+(slot-2.5)*2.4,y:0,z:CREW_HALL.z},refillAt:this.state.clock+30};
    }
  }
  arrive(ship,d){ship.arrival=d.id;
    for(const c of ship.crew.filter(c=>c.unpaid&&d.kind==='port')){ship.crew=ship.crew.filter(m=>m.id!==c.id);delete ship.economy.crew[c.role];this.state.pool[c.id].retired=true;}
    if(d.kind==='port'&&ship.jobs.samples.length){const kg=ship.jobs.samples.reduce((n,s)=>n+s.massKg,0);this.removeCargo(ship,'phobos-core-sample',kg);
      ship.economy.questLots.push(...ship.jobs.samples);
      ship.economy.exportedMassExact=String(BigInt(ship.economy.exportedMassExact)+sumExact(ship.jobs.samples,'massKg'));
      ship.economy.exportedVolumeExact=String(BigInt(ship.economy.exportedVolumeExact)+sumExact(ship.jobs.samples,'solidVolumeM3'));
      this.award(ship,ship.jobs.samples.length*SAMPLE_PAY_CREDITS);ship.jobs.samples=[];ship.jobs.taken=[];}
  }
  award(ship,credits){const marks=credits*4;if(!Number.isSafeInteger(marks)||marks<0)throw Error('Invalid reward.');ship.economy.marks+=marks;}
  addCargo(ship,item,kg){if(!Number.isFinite(kg)||kg<=0)throw Error('Invalid cargo.');ship.hold[item]=(ship.hold[item]||0)+kg;}
  removeCargo(ship,item,kg){if((ship.hold[item]||0)+1e-5<kg)throw Error('Hold has insufficient cargo.');ship.hold[item]=Math.max(0,ship.hold[item]-kg);}
  disconnect(id,peer){if(this.sessions.get(id)!==peer)return;this.sessions.delete(id);this.inputs.delete(id);
    this.state.players[id].offlineAt=this.now();
    // The body remains aboard; the flight assist holds after the control lease ends.
  }
  advance(seconds,{catchUp=false}={}){let left=seconds;
    // A raider is always in the air, so while the world runs it ticks at 30 Hz; while a restart catches up on hours it does not (it simply
    // waits where it was), or loading a long-idle world would simulate a million raider ticks.
    while(left>1e-8){const active=[...this.sims.values()].some(s=>(!catchUp||!s.record.npc)&&(s.trip||!s.flight.landed||orderLive(s)||s.guns.bolts.length||s.drones.shots.length||s.record.crew.some(c=>c.status==='walking-aboard')));
      const dt=Math.min(left,active?1/30:1);left-=dt;this.state.clock+=dt;
      const oldY=this.elevator.y,riders=[];let sill=false;
      for(const p of Object.values(this.state.players))if(!p.aboardShipId&&p.frameId==='mars'){
        const loc=this.site.toLocal(p.pose.worldPos),x=loc.x-TOWER.x,z=loc.z-TOWER.z;
        if(this.elevator.contains(x,z)&&Math.abs(loc.y-oldY)<.3)riders.push(p);
        if(Math.abs(x)<.9&&Math.abs(z-.35)<.4&&Math.abs(loc.y-oldY)<.3)sill=true;
      }
      const dy=this.elevator.tick(dt,sill);for(const p of riders)for(const k of ['x','y','z'])p.pose.worldPos[k]+=this.site.up[k]*dy;
      for(const [id,sim] of this.sims){const ship=this.state.ships[id];let control={fwd:0,lift:0,yaw:0};
        if(ship.npc)continue;                                  // a raider is run by the fleet director, below
        const def=sim.def,posts=def.crewPosts;let sights=null;
        const pilots=Object.values(this.state.players).filter(p=>p.aboardShipId===id&&['pilot','captain'].includes(p.pose.seat)&&this.sessions.has(p.id)&&this.inputs.get(p.id)?.until>this.now());
        const pilot=pilots.find(p=>p.pose.seat==='pilot')||pilots[0];
        if(pilot)control=this.inputs.get(pilot.id).controls;
        sim.ship.aboard=Object.values(this.state.players).some(p=>p.aboardShipId===id);
        sim.ship._rampOccupied=key=>this.rampOccupied(sim,key);
        for(const c of ship.crew)if(c.status==='aboard'&&!c.unpaid){const gid={captain:'main',gunner_dorsal:'dorsal',gunner_ventral:'ventral'}[c.role],seat=posts.find(r=>r.id===c.role)?.seat;
          const mainPilot=c.role==='pilot'&&!ship.crew.some(m=>m.role==='captain'&&m.status==='aboard'&&!m.displaced);
          const gun=gid||(mainPilot?'main':null);
          if(gun&&!Object.values(this.state.players).some(p=>p.aboardShipId===id&&p.pose.seat===seat)){
            sim.crewGunners=sim.crewGunners||new Map();if(!sim.crewGunners.has(c.id))sim.crewGunners.set(c.id,new GunnerAI({guns:sim.guns,flight:sim.flight,gunId:gun,skill:c.skill,rand:Math.random}));
            // FLEET: hired guns shoot raiders and escorts only. A surrendered raider is left out of that list, so the gunner stops.
            if(!sights)sights=this.fleet.sightsFor(sim);
            sim.crewGunners.get(c.id).update(dt,sights);
          }}
        // (catching up on a long absence a ship that is sitting on the ground with nothing asked of it stays where it is: stepping its landing
        //  physics a hundred and twenty times a second for hours is the slowest thing a restart does)
        if(!(catchUp&&sim.flight.landed&&!sim.trip&&!orderLive(sim)&&!sim.flight.autoHover&&!control.lift&&!control.fwd&&!control.yaw))
        {this.fleet.preStep(sim);sim.step(dt,control);this.fleet.postStep(sim);}
        const events=[...sim.guns.drain().map(e=>({...e,system:'guns'})),...sim.drones.drain().map(e=>({...e,system:'drones'}))];
        for(const e of events){ship.eventSeq=(ship.eventSeq||0)+1;ship.events=ship.events||[];ship.events.push({...e,seq:ship.eventSeq});}
        ship.events=(ship.events||[]).slice(-80);
        for(const e of events)if(e.type==='impact'){
          const key=sim.frameId+':ground:'+Math.round(e.x)+','+Math.round(e.y)+','+Math.round(e.z);
          this.state.damage[key]={amount:(this.state.damage[key]?.amount||0)+(e.power||1),position:{x:e.x,y:e.y,z:e.z},up:{x:e.ux,y:e.uy,z:e.uz},frameId:sim.frameId};}
        for(const p of Object.values(this.state.players))if(p.aboardShipId===id){p.frameId=sim.frameId;sim.flight.toWorld(p.pose.sw,p.pose.worldPos);}
        for(const c of ship.crew){const post=posts.find(r=>r.id===c.role),seat=post?def.seats.find(s=>s.id===post.seat):null;
          // A station this hull does not have (a navigator aboard a Shrike) stays standing where they were put.
          if(!seat)c.displaced=true;
          else{c.displaced=Object.values(this.state.players).some(p=>p.aboardShipId===id&&p.pose.seat===seat.id);
            if(c.displaced)c.standPose=this.standNear(sim,seat);}
          if(c.status==='leaving-ground'){
            const target=c.groundRoute[0],d=Math.hypot(target.x-c.position.x,target.z-c.position.z),step=Math.min(d,dt*1.55);
            if(d){c.position.x+=(target.x-c.position.x)/d*step;c.position.z+=(target.z-c.position.z)/d*step;}
            if(d<.03)c.groundRoute.shift();
            if(!c.groundRoute.length){const pool=this.state.pool[c.id];pool.shipId=null;pool.status='returning';pool.position={...c.position};ship.crew=ship.crew.filter(m=>m.id!==c.id);}
            continue;
          }
          if(c.unpaid&&!c.status.startsWith('leaving'))continue;if(!c.status.startsWith('leaving')&&this.state.clock>=c.nextPay){const count=Math.floor((this.state.clock-c.nextPay)/SOL_SECONDS)+1,due=count*c.wageCredits*4;
          if(ship.economy.marks<due)c.unpaid=true;else{ship.economy.marks-=due;ship.economy.payrollMarks+=due;c.nextPay+=count*SOL_SECONDS;}}
          if(c.status==='boarding'&&sim.flight.landed&&sim.frameId==='mars'){
            const target=c.groundRoute?.[0]||{x:ship.pad.x,z:ship.pad.z+def.dock.rampFoot.z-1},pos=c.position,dist=Math.hypot(target.x-pos.x,target.z-pos.z),step=Math.min(dist,dt*1.5);
            if(dist>.15){pos.x+=(target.x-pos.x)/dist*step;pos.z+=(target.z-pos.z)/dist*step;}
            else if(c.groundRoute?.length)c.groundRoute.shift();
            else if(sim.ship.state.ramps.cargo.lowered){const R=def.ramps.cargo,angle=sim.ship.state.ramps.cargo.angle,from={x:R.hinge.x,y:R.hinge.y-Math.sin(angle)*R.length,z:R.hinge.z+Math.cos(angle)*R.length},sw=new ShipWalker(shipIndexFor(def),sim.ship.state);
              sw.place(from.x,from.y,from.z,0);const seat=def.seats.find(s=>s.id===posts.find(r=>r.id===c.role).seat),route=routeToSeat(sw,from,seat);
              if(route){const rw=new RouteWalker(sw,route,1.5);this.crewRoutes.set(c.id,rw);c.status='walking-aboard';c.localPose={...from,yaw:0};c.routeState={route,ri:0,pi:0};}
            }
          }
          if(c.status==='walking-aboard'||c.status==='leaving-aboard'){
            let rw=this.crewRoutes.get(c.id);if(!rw){const sw=new ShipWalker(shipIndexFor(def),sim.ship.state);sw.place(c.localPose.x,c.localPose.y,c.localPose.z,c.localPose.yaw);
              sw.ladder=structuredClone(c.localPose.ladder||null);rw=new RouteWalker(sw,c.routeState.route,1.5);Object.assign(rw,c.routeState);this.crewRoutes.set(c.id,rw);}
            rw.step(dt);c.localPose={x:rw.sw.x,y:rw.sw.y,z:rw.sw.z,yaw:rw.sw.yaw,ladder:structuredClone(rw.sw.ladder)};c.routeState={route:rw.route,ri:rw.ri,pi:rw.pi,stuckT:rw.stuckT,ladderT:rw.ladderT,lastKey:rw.lastKey};
            if(rw.done){if(c.status==='leaving-aboard'){
                c.status='leaving-ground';c.position=this.site.toLocal(sim.flight.toWorld(c.localPose,{}));
                c.groundRoute=[{x:ship.pad.x-28,z:ship.pad.z+32},{x:-28,z:-57},{x:CREW_HALL.door.x,z:CREW_HALL.door.z+1}];
              }else{c.status='aboard';c.seatPose={...def.seats.find(s=>s.id===posts.find(r=>r.id===c.role).seat)};}
              delete c.routeState;this.crewRoutes.delete(c.id);}
          }
          if(!c.status.startsWith('leaving'))ship.economy.crew[c.role]={nextPay:c.nextPay,unpaid:c.unpaid};}
        ship.economy.elapsedSeconds=this.state.clock;
      }
      if(!catchUp){this.fleet.stepRaiders(dt);if(this.state.clock>=(this.fleetCheckAt||0)){this.fleetCheckAt=this.state.clock+5;this.fleet.ensure();}}
      for(const c of Object.values(this.state.pool)){
        if(!c.shipId&&!c.retired&&this.state.clock>=c.refillAt&&c.status==='reserved')c.status='inside';
        const slot=CREW_POSTS.findIndex(r=>r.id===c.role),outside={x:CREW_HALL.x+(slot-2.5)*2.4,z:CREW_HALL.door.z+5};
        if(c.status==='inside'&&Object.values(this.state.players).some(p=>!p.aboardShipId&&p.frameId==='mars'&&distance(this.site.toLocal(p.pose.worldPos),{x:CREW_HALL.door.x,y:0,z:CREW_HALL.door.z})<12))c.status='meeting';
        if(c.status==='meeting'||c.status==='returning'){
          // Walk via the actual central doorway before fanning out to meet the player.
          const meeting=c.status==='meeting',passed=meeting?c.position.z>=CREW_HALL.door.z+1:c.position.z<=CREW_HALL.door.z-1;
          const target=passed?(meeting?outside:{x:outside.x,z:CREW_HALL.z}):{x:CREW_HALL.door.x,z:CREW_HALL.door.z+(meeting?1:-1)};
          const dx=target.x-c.position.x,dz=target.z-c.position.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*1.5);
          if(d){c.position.x+=dx/d*step;c.position.z+=dz/d*step;}
          if(passed&&d<.03)c.status=meeting?'waiting':'inside';}
      }
      for(const p of Object.values(this.state.players))if(p.pose.seat&&!this.sessions.has(p.id)&&p.offlineAt&&this.now()-p.offlineAt>30000)this.releaseSeat(p);
    }this.refill();
    this.state.elevator=structuredClone(this.elevator);
    if(this.state.clock>=(this.state.nextRestock||300)){for(const stock of Object.values(this.state.market.traders))for(const k of Object.keys(stock))stock[k]=Math.max(stock[k],30);this.state.nextRestock=this.state.clock+300;}
    for(const sim of this.sims.values()){sim.capture();this.fleet.capture(sim);}
  }
  shipFor(p){return this.state.ships[p.aboardShipId||p.currentShipId||p.shipId];}
  rampOccupied(sim,key){const r=sim.def.ramps[key],run=r.length*Math.cos(sim.ship.rampCtl[key].angle);
    const on=q=>{const along=(q.x-r.hinge.x)*r.dir.x+(q.z-r.hinge.z)*r.dir.z,across=r.dir.z?Math.abs(q.x-r.hinge.x):Math.abs(q.z-r.hinge.z);return along>.2&&along<run+1&&across<r.width/2+.3&&q.y<.6;};
    return Object.values(this.state.players).some(p=>p.aboardShipId===sim.record.id&&on(p.pose.sw))||sim.record.crew.some(c=>['walking-aboard','leaving-aboard'].includes(c.status)&&c.localPose&&on(c.localPose));
  }
  canPlaceSpoil(frame,x,y,z){
    const point={x,y,z},loc=this.site.toLocal(point);
    if(frame==='mars'){
      if(!clearSpoilGround(this.site,x,y,z))return false;
      if(this.state.pads.some(a=>Math.abs(loc.x-a.x)<a.w/2+1.8&&Math.abs(loc.z-a.z)<a.d/2+1.8))return false;
      if(PORT_WORKERS.some(m=>Math.hypot(loc.x-m.x,loc.z-m.z)<.55))return false;
      if(Math.abs(loc.x-CREW_HALL.x)<CREW_HALL.w/2+.3&&Math.abs(loc.z-CREW_HALL.z)<CREW_HALL.d/2+.3)return false;
      if(Object.values(this.state.pool).some(c=>!c.retired&&!c.shipId&&distance(loc,c.position)<1))return false;
    }
    if(frame==='phobos'||frame==='deimos'){
      const info=makeMoon(frame).padInfo,rel={x:x-info.point.x,y:y-info.point.y,z:z-info.point.z};
      const east=rel.x*info.east.x+rel.y*info.east.y+rel.z*info.east.z,north=rel.x*info.north.x+rel.y*info.north.y+rel.z*info.north.z;
      for(const s of Object.values(this.state.ships)){const a=s.moonPads?.[frame];
        if(a&&Math.abs(east-a.east)<a.w/2+1.8&&Math.abs(north-a.north)<a.d/2+1.8)return false;}
    }
    for(const sim of this.sims.values())if(sim.frameId===frame){const q=sim.flight.toLocal(point,{});
      if(Math.abs(q.x)<13.5&&q.z>-25&&q.z<36&&q.y>-5&&q.y<12)return false;
      if(sim.guns.targets.some(t=>!t.inactive&&distance(point,t.pos)<t.radius+.4))return false;
      if(sim.record.crew.some(c=>c.status==='boarding'&&frame==='mars'&&distance(loc,{...c.position,y:0})<1))return false;
    }
    return true;
  }
  standNear(sim,seat){const sw=new ShipWalker(shipIndexFor(sim.def),sim.ship.state);
    for(const [dx,dz] of [[0,.9],[.9,0],[-.9,0],[0,-.9],[1.2,0]]){const s=sw.canStand(seat.x+dx,seat.y,seat.z+dz);if(s)return {x:seat.x+dx,y:s.floor,z:seat.z+dz,yaw:seat.yaw*Math.PI/180};}
    return {x:seat.x,y:seat.y,z:seat.z+.9,yaw:0};
  }
  releaseSeat(p){const sim=p.aboardShipId&&this.sims.get(p.aboardShipId),seat=sim&&sim.def.seats.find(s=>s.id===p.pose.seat);if(seat)Object.assign(p.pose.sw,this.standNear(sim,seat));p.pose.seat=null;}
  owner(p,ship){if(ship.owner!==p.id)throw Error('Only the ship owner can do that.');}
  near(p,local,r=4){if(p.aboardShipId||p.frameId!=='mars'||distance(this.site.toLocal(p.pose.worldPos),local)>r)throw Error('Walk over to them first.');}
  // -------------------------------------------------------------------------------------------------------------------
  // FLEET: owning more than one hull. A ship is bought, claimed or captured; one of them is the flagship (p.shipId): the one a
  // player walks to, hires for and spends the treasury of. The others stay where they were put, on a pad, owned.
  // -------------------------------------------------------------------------------------------------------------------
  /** A new owned ship on a pad of its own. */
  newOwnedShip(p,type,o={}){
    const id=randomUUID(),pad=allocatedPad(this.state.pads.length,id);this.state.pads.push(pad);
    const rec={id,owner:p.id,type,pad,crewMayBoard:false,crew:[],hold:{},holdLots:[],jobs:{taken:[],samples:[],salvaged:false},
      economy:{...initialEconomy(),marks:o.marks||0},frameId:'mars',pose:null,trip:null,acquired:{how:o.how||'bought',at:this.state.clock}};
    this.state.ships[id]=rec;this.sims.set(id,this.makeSim(rec));return rec;
  }
  /** Buy a ship at the yard: on foot at the kiosk, paid from the flagship's treasury, delivered to a new pad. */
  buyShip(p,a){
    const yard=SHIPYARD,item=forSale().find(q=>q.type===a.shipType);if(!item)throw Error('The yard does not sell that.');
    this.near(p,yard.spot,yard.reach);
    const flag=this.state.ships[p.shipId];this.owner(p,flag);
    const price=item.priceCredits*4;if(flag.economy.marks<price)throw Error(`A ${item.name} costs ${item.priceCredits} credits; your ship's account has ${Math.floor(flag.economy.marks/4)}.`);
    flag.economy.marks-=price;
    const rec=this.newOwnedShip(p,item.type,{how:'bought'});
    return {ok:true,msg:`Bought a ${item.name} for ${item.priceCredits} credits. It is on pad ${rec.pad.number}. Make it your flagship to fly it.`,shipId:rec.id};
  }
  /** Make another ship you own the one you fly: on the ground, away from any ship, in the port's air. The client reloads into it. */
  setFlagship(p,a){
    const t=this.state.ships[a.shipId];if(!t||t.owner!==p.id)throw Error('That is not your ship.');
    if(p.aboardShipId)throw Error('Leave your ship first.');
    const s=this.sims.get(t.id);if(!s.flight.landed||s.frameId!=='mars')throw Error('That ship has to be on the ground at the port.');
    p.shipId=t.id;p.currentShipId=t.id;
    return {ok:true,msg:`${shipDef(t.type).class} is now your flagship. Walk to its ramp (pad ${t.pad.number}).`,shipId:t.id};
  }
  /** Take a disabled raider (its crew surrender and sign on) or an abandoned hull: a prize crew brings it home to a pad of its own. */
  claimShip(p,a){
    const rec=this.fleet.claimable(p,a.shipId),how=rec.npc.state==='disabled'?'captured':'claimed',def=shipDef(rec.type);
    const loot=rec.npc.lootCredits||0,crew=rec.crew.filter(c=>c.status==='surrendered'||c.status==='aboard');
    const pad=allocatedPad(this.state.pads.length,rec.id);this.state.pads.push(pad);
    Object.assign(rec,{owner:p.id,pad,npc:null,crew:[],pose:null,state:null,combat:null,frameId:'mars',trip:null,acquired:{how,at:this.state.clock}});
    rec.economy.marks+=loot*4;
    // the surrendered crew sign on: they are the ship's hired crew from now, on wages, like anyone from the hall
    for(const c of crew){const post=def.crewPosts.find(r=>r.id===c.role),wage=WAGES[c.role]??100;
      const signed={id:c.id,role:c.role,name:c.name,personId:c.personId,skill:c.skill,wageCredits:wage,shipId:rec.id,status:'hired',position:{x:pad.x,y:0,z:pad.z},refillAt:this.state.clock+30};
      if(c.look)signed.look=structuredClone(c.look);
      this.state.pool[c.id]=signed;
      const aboard={id:c.id,role:c.role,name:c.name,personId:c.personId,skill:c.skill,wageCredits:wage,status:'aboard',nextPay:this.state.clock+SOL_SECONDS,unpaid:false,seatPose:{...def.seats.find(s=>s.id===post.seat)},groundRoute:[]};
      if(c.look)aboard.look=structuredClone(c.look);
      rec.crew.push(aboard);
      rec.economy.crew[c.role]={nextPay:this.state.clock+SOL_SECONDS,unpaid:false};}
    this.sims.set(rec.id,this.makeSim(rec));
    return {ok:true,msg:`${how==='captured'?'Captured':'Claimed'} the ${def.class}${crew.length?` with ${crew.length} crew who sign on`:''}. A prize crew brought it to pad ${pad.number}${loot?`; ${loot} credits were in its hold`:''}.`,shipId:rec.id};
  }
  /**
   * Walk aboard a disabled or abandoned raider and fly it from where it is. The hull becomes an owned ship
   * in place (same frame, same flight pose, a home pad allocated but not used yet). The surrendered crew
   * leave. One flyer stays on the player's own ship so it can hold or follow; everyone else comes across.
   * The flagship does not change: that is still set on the ground at the port.
   */
  boardPrize(p,a){
    const mode=a.ownShip;
    if(mode!=='hold'&&mode!=='follow')throw Error('Say whether your own ship holds or follows.');
    const rec=this.fleet.claimable(p,a.shipId);
    if(p.aboardShipId===rec.id)throw Error('You are already aboard it.');
    const mine=this.state.ships[p.aboardShipId],prizeSim=this.sims.get(rec.id);
    prizeSim.capture();
    const pose=structuredClone(rec.pose),frameId=rec.frameId,state=rec.state,name=rec.npc.name,loot=rec.npc.lootCredits||0,def=shipDef(rec.type);
    const pad=allocatedPad(this.state.pads.length,rec.id);this.state.pads.push(pad);
    const hired=(mine.crew||[]).filter(c=>!String(c.status||'').startsWith('leaving'));
    const flyer=hired.find(c=>c.role==='pilot')||hired.find(c=>c.role==='captain')||null;
    const stayers=flyer?[flyer]:[],coming=hired.filter(c=>c!==flyer);
    const mineClass=shipDef(mine.type).class;
    rec.crew=[];
    rec.economy.crew={};
    Object.assign(rec,{owner:p.id,pad,npc:null,pose,state,frameId,trip:null,combat:null,escort:null,acquired:{how:'boarded',at:this.state.clock}});
    rec.economy.marks=(rec.economy.marks||0)+loot*4;
    const sim=this.makeSim(rec);this.sims.set(rec.id,sim);
    const dock=def.dock.boardSw;
    p.pose.sw={x:dock.x,y:dock.y,z:dock.z,yaw:dock.yaw||0,pitch:0};
    p.aboardShipId=rec.id;p.currentShipId=rec.id;p.pose.aboard=true;p.pose.seat=null;p.frameId=sim.frameId;
    sim.flight.toWorld(p.pose.sw,p.pose.worldPos);
    mine.crew=stayers;
    mine.economy.crew=mine.economy.crew||{};
    for(const c of coming)delete mine.economy.crew[c.role];
    const came=[];
    coming.forEach((c,i)=>{
      const member=structuredClone(c);
      delete member.groundRoute;delete member.routeState;delete member.position;
      const post=def.crewPosts.find(r=>r.id===c.role),seat=post&&def.seats.find(s=>s.id===post.seat);
      const pool=this.state.pool[c.id];
      if(pool){pool.shipId=rec.id;pool.status='hired';if(c.look)pool.look=structuredClone(c.look);}
      if(seat){
        const from={x:dock.x+(i-1)*0.55,y:dock.y,z:dock.z,yaw:0};
        let route=null,walker=null;
        try{
          walker=new ShipWalker(shipIndexFor(def),sim.ship.state);
          walker.place(from.x,from.y,from.z,0);
          route=routeToSeat(walker,from,seat);
        }catch{route=null;}
        if(route){
          this.crewRoutes.set(c.id,new RouteWalker(walker,route,1.5));
          Object.assign(member,{status:'walking-aboard',localPose:{...from,yaw:0},routeState:{route,ri:0,pi:0},seatPose:{...seat}});
        }else Object.assign(member,{status:'aboard',seatPose:{...seat},localPose:{x:seat.x,y:seat.y,z:seat.z,yaw:(seat.yaw||0)*Math.PI/180}});
      }else{
        const stand={x:dock.x+((i%3)-1)*1.15,y:dock.y,z:dock.z-0.55*(1+(i%2)),yaw:0};
        Object.assign(member,{status:'aboard',displaced:true,standPose:stand,seatPose:{...stand},localPose:{...stand}});
      }
      rec.crew.push(member);
      rec.economy.crew[c.role]={nextPay:c.nextPay,unpaid:!!c.unpaid};
      came.push(c.name);
    });
    mine.escort={mode,targetId:rec.id};
    const cameMsg=came.length===0?'You came aboard alone.':came.length===1?`${came[0]} came aboard.`:`${came.slice(0,-1).join(', ')} and ${came.at(-1)} came aboard.`;
    const stayMsg=stayers.length?`${stayers.map(c=>c.name).join(' and ')} stayed with ${mineClass}, which will ${mode==='hold'?'hold station':'follow'}.`:`${mineClass} is empty and will ${mode==='hold'?'hold station':'follow'}.`;
    const lootMsg=loot?` ${loot} credits were in its hold.`:'' ;
    return {ok:true,msg:`You boarded ${name}. ${cameMsg} ${stayMsg} Walk forward to the helm. ${mineClass} remains your flagship until you set it at the port.${lootMsg}`,shipId:rec.id};
  }

  async action(id,actionId,a){if(!/^[\w-]{8,100}$/.test(actionId))throw Error('Invalid action ID.');const key=id+':'+actionId;
    if(this.state.receipts[key])return {...this.state.receipts[key].result,replay:true};
    const before=structuredClone(this.state);let result;
    try{if(this.error)throw Error(this.error);const p=this.state.players[id];if(!p)throw Error('Join first.');result=this.reduce(p,a)||yes();
      if(result.ok===false)throw Error(result.msg);
      this.state.receipts[key]={playerId:id,actionId,revision:this.state.revision+1,result:structuredClone(result)};const bricks=await this.commit();return {...result,bricks};
    }catch(e){this.state=before;this.rebuild();return {ok:false,msg:e.message};}
  }
  updatePose(p,a){const r=a.pose;if(!r||!finitePoint(r.worldPos)||!finitePoint(r.sw)||![r.yaw,r.pitch,r.sw.yaw,r.sw.pitch].every(Number.isFinite))throw Error('Invalid player pose.');
    const ship=this.shipFor(p);const aboard=!!p.aboardShipId;
    if(!!r.aboard!==aboard)throw Error('Board or leave through the boarding action.');
    // Client-predicted poses have speed/cabin bounds. Swept player collision is
    // still client-side; station transitions use the shared ShipWalker rules.
    const elapsed=Math.max(.1,Math.min(3,(this.now()-(p.poseAt||this.now()-1000))/1000));
    if(aboard){if(distance(r.sw,p.pose.sw)>elapsed*12+2)throw Error('Walk to that place aboard.');
      const B=this.sims.get(ship.id).def.dock.bounds;
      if(Math.abs(r.sw.x)>B.x||Math.abs(r.sw.z)>B.z||r.sw.y<B.y0||r.sw.y>B.y1)throw Error('Outside the cabin.');
      if(r.seat!==p.pose.seat)throw Error('Use the seat request.');
    }else if(distance(r.worldPos,p.pose.worldPos)>elapsed*12+2)throw Error('Walk to that place.');
    p.pose={...structuredClone(r),seat:p.pose.seat};p.poseAt=this.now();
    if(aboard)this.sims.get(ship.id).flight.toWorld(p.pose.sw,p.pose.worldPos);
    if(a.controls&&['pilot','captain'].includes(p.pose.seat))this.inputs.set(p.id,{until:this.now()+1000,controls:Object.fromEntries(['fwd','lift','yaw'].map(k=>[k,Math.max(-1,Math.min(1,Number(a.controls[k])||0))]))});
  }
  reduce(p,a){if(!a||typeof a.type!=='string')throw Error('Invalid action.');const ship=this.shipFor(p),sim=this.sims.get(ship.id);
    sim.ship._rampOccupied=key=>this.rampOccupied(sim,key);
    switch(a.type){
      case 'player-pose':this.updatePose(p,a);break;
      case 'rename':p.name=cleanName(a.name);break;
      case 'elevator':{const loc=this.site.toLocal(p.pose.worldPos);if(p.aboardShipId||p.frameId!=='mars'||Math.abs(loc.x-TOWER.x)>3||Math.abs(loc.z-TOWER.z)>4)throw Error('Use the tower lift controls in person.');
        if(!this.elevator.request(a.destination))throw Error('The lift is already moving.');break;}
      case 'boarding-permission':{const own=this.state.ships[p.shipId];this.owner(p,own);own.crewMayBoard=!!a.allowed;break;}
      case 'board':{const target=this.state.ships[a.shipId||p.shipId];if(!target)throw Error('Unknown ship.');
        if(target.owner!==p.id&&!target.crewMayBoard)throw Error('The owner has boarding closed.');
        const ts=this.sims.get(target.id),dock=ts.def.dock;if(target.npc)throw Error('That is not your ship to board.');
        if(p.frameId!==ts.frameId||distance(p.pose.worldPos,ts.flight.toWorld(dock.rampFoot,{}))>24)throw Error('Walk to the stern ramp.');
        if(!ts.flight.landed)throw Error('Wait for the ship to land.');
        if(a.walkPose){const r=a.walkPose,loc=ts.flight.toLocal(p.pose.worldPos,{});
          if(!finitePoint(r.sw)||!Number.isFinite(r.sw.yaw)||!Number.isFinite(r.sw.pitch))throw Error('Invalid walked boarding pose.');
          const ramps=ts.def.ramps;
          const entry=Object.keys(ramps).map(k=>rampEntry(k,ts.ship.state.ramps[k],loc,{x:-ramps[k].dir.x,z:-ramps[k].dir.z},ramps)).find(Boolean);
          const sw=new ShipWalker(shipIndexFor(ts.def),ts.ship.state);
          if(!entry||distance(entry,r.sw)>.5||!sw.canStand(r.sw.x,r.sw.y,r.sw.z))throw Error('Walk onto the lowered ramp.');
          p.pose.sw=structuredClone(r.sw);p.pose.pitch=r.pitch;p.pose.yaw=r.yaw;
        }else p.pose.sw={...dock.boardSw,pitch:0};
        p.aboardShipId=target.id;p.currentShipId=target.id;p.pose.aboard=true;p.frameId=ts.frameId;p.pose.seat=null;
        ts.flight.toWorld(p.pose.sw,p.pose.worldPos);break;}
      case 'leave':{if(!p.aboardShipId||!sim.flight.landed)throw Error('Land before leaving.');
        if(a.walkPose){const ramp=sim.def.ramps[a.key],r=sim.ship.state.ramps[a.key],local=p.pose.sw;
          if(!ramp||!r?.lowered||!finitePoint(a.walkPose.worldPos))throw Error('Use a lowered ramp.');
          const along=(local.x-ramp.hinge.x)*ramp.dir.x+(local.z-ramp.hinge.z)*ramp.dir.z;
          if(along<ramp.length*Math.cos(r.angle)-.5||along>ramp.length*Math.cos(r.angle)+1||distance(a.walkPose.worldPos,sim.flight.toWorld(local,{}))>.6)throw Error('Walk off the ramp tip.');
          p.pose={...structuredClone(a.walkPose),seat:null};
        }else p.pose.worldPos=sim.flight.toWorld(sim.def.dock.leaveLocal,{});
        p.pose.aboard=false;p.aboardShipId=null;p.pose.seat=null;break;}
      case 'seat':{if(!p.aboardShipId)throw Error('Come aboard first.');const seat=sim.def.seats.find(s=>s.id===a.seat);
        if(a.seat&&!seat)throw Error('Unknown seat.');if(seat&&distance(p.pose.sw,seat)>3)throw Error('Walk to the station first.');
        if(seat&&Object.values(this.state.players).some(q=>q.id!==p.id&&q.aboardShipId===ship.id&&q.pose.seat===seat.id))throw Error('That seat is occupied.');
        if(!seat)this.releaseSeat(p);else{p.pose.seat=seat.id;Object.assign(p.pose.sw,{x:seat.x,y:seat.y,z:seat.z,yaw:seat.yaw*Math.PI/180});}break;}
      case 'engage':if(!p.aboardShipId||!['pilot','captain','nav','comms'].includes(p.pose.seat))throw Error('Use a bridge station to set a course.');
        if(Object.values(this.state.players).some(q=>q.aboardShipId===ship.id&&q.pose.sw.z>sim.def.dock.clearRampZ)||ship.crew.some(c=>c.status==='walking-aboard'&&c.localPose.z>sim.def.dock.clearRampZ))throw Error('Clear the ramp before departure.');sim.engage(a.destination);break;
      case 'ramp':{if(!['cargo','airlock'].includes(a.key))throw Error('Unknown ramp.');if(!sim.flight.landed)throw Error('Land before opening a ramp.');
        if(!p.aboardShipId)this.near(p,this.site.toLocal(sim.flight.toWorld({...sim.def.dock.rampFoot,y:-1},{})),20);
        if(ship.owner!==p.id&&!p.aboardShipId)throw Error('The owner controls the boarding ramp.');
        const ctl=sim.ship.rampCtl[a.key];if(ctl.target>.5&&sim.ship._rampOccupied(a.key))throw Error('Clear the ramp first.');
        if(ctl.target<.5)sim.ship._solveRamp(a.key);ctl.target=ctl.target>.5?0:1;sim.ship.state.ramps[a.key].target=ctl.target;break;}
      case 'cancel-trip':if(!p.aboardShipId)throw Error('Come aboard first.');return sim.trip?.cancel()||{ok:false,msg:'No course in progress.'};
      case 'trip-warp':if(!p.aboardShipId||!sim.trip?.active)throw Error('No course in progress.');if(![1,5,20,60].includes(a.warp))throw Error('Invalid trip speed.');sim.trip.setWarp(a.warp);break;
      case 'crew-order':return sim.crewOrder(p,a,this);
      case 'airlock':sim.cycleAirlock();break;
      case 'power-split':if(p.pose.seat!=='engineer')throw Error('Use the engineering station.');if(![a.engines,a.guns,a.shields].every(Number.isFinite))throw Error('Invalid power split.');sim.flight.setPowerSplit(a.engines,a.guns,a.shields);break;
      case 'power':if(p.pose.seat!=='engineer')throw Error('Use the engineering station.');if(!['engines','guns','shields'].includes(a.key)||!Number.isFinite(a.value))throw Error('Invalid power request.');sim.flight.routePower(a.key,a.value);break;
      case 'fire-gun':{if(!p.aboardShipId)throw Error('Come aboard.');const gun=sim.def.seatGun[p.pose.seat];
        if(!gun)throw Error('Use a gun station.');if(!finitePoint(a.direction)||distance(a.direction,{x:0,y:0,z:0})<.5||distance(a.direction,{x:0,y:0,z:0})>1.5)throw Error('Invalid aim.');
        const seat=sim.def.seats.find(s=>s.id===p.pose.seat),eye=sim.flight.toWorld({...seat,y:seat.y+1.2},{});sim.stations.seated=p.pose.seat;
        const worldDir=a.direction,local=sim.flight.toLocal({x:sim.flight.pos.x+worldDir.x,y:sim.flight.pos.y+worldDir.y,z:sim.flight.pos.z+worldDir.z},{});
        const aim=sim.guns.point(gun,local);sim.guns.fire(gun,sim.flight.dirToWorld(sim.guns.constructor.dirFor(aim),{}),eye);break;}
      case 'meet':{this.near(p,{x:CREW_HALL.door.x,y:0,z:CREW_HALL.door.z},6);const c=this.state.pool[a.id];if(!c||c.shipId||c.retired)throw Error('Candidate unavailable.');c.status='meeting';break;}
      case 'decline':{const c=this.state.pool[a.id];if(!c||c.shipId)throw Error('Candidate unavailable.');c.status='returning';break;}
      case 'hire':{this.owner(p,this.state.ships[p.shipId]);const s=this.state.ships[p.shipId],c=this.state.pool[a.id],hdef=shipDef(s.type);
        if(!c||c.shipId||c.retired)throw Error('Someone else already hired that person.');this.near(p,c.position,5);
        if(!hdef.seats.some(q=>q.id===hdef.crewPosts.find(r=>r.id===c.role)?.seat))throw Error(`A ${hdef.class} has no station for a ${c.role}.`);
        if(c.status!=='waiting')throw Error('Ask them to meet you at the hall door.');if(s.crew.some(m=>m.role===c.role))throw Error('That post is already filled.');
        const fee=c.wageCredits*4;if(s.economy.marks<fee)throw Error('Insufficient signing fee.');s.economy.marks-=fee;s.economy.payrollMarks+=fee;
        c.shipId=s.id;c.status='hired';c.refillAt=this.state.clock+30;s.crew.push({...c,position:{...c.position},
          groundRoute:[{x:s.pad.x-28,z:CREW_HALL.door.z+3},{x:s.pad.x-28,z:s.pad.z+32},{x:s.pad.x,z:s.pad.z+25}],
          status:'boarding',nextPay:this.state.clock+SOL_SECONDS,unpaid:false});break;}
      case 'fire':{this.owner(p,ship);const c=ship.crew.find(m=>m.id===a.id);if(!c||c.status.startsWith('leaving'))throw Error('Not your crew.');
        if(!sim.flight.landed||sim.frameId!=='mars'||distance(this.site.toLocal(sim.flight.pos),{...ship.pad,y:0})>140)throw Error('They will step off when we are down at the port.');
        delete ship.economy.crew[c.role];sim.crew.cancelOrder();
        if(c.status==='boarding'){c.status='leaving-ground';c.groundRoute=[{x:-28,z:-57},{x:CREW_HALL.door.x,z:CREW_HALL.door.z+1}];}
        else{const post=sim.def.crewPosts.find(r=>r.id===c.role),seat=sim.def.seats.find(s=>s.id===post?.seat),from=c.status==='aboard'?(c.displaced?c.standPose:this.standNear(sim,seat)):c.localPose;
          const spec=sim.def.ramps.cargo,ramp=sim.ship.state.ramps.cargo,run=spec.length*Math.cos(ramp.angle);
          const tip={id:'tip',x:spec.hinge.x+spec.dir.x*(run+.5),y:spec.hinge.y-Math.sin(ramp.angle)*spec.length,z:spec.hinge.z+spec.dir.z*(run+.5),yaw:180,room:sim.def.roles.cargo};
          const sw=new ShipWalker(shipIndexFor(sim.def),sim.ship.state);sw.place(from.x,from.y,from.z,from.yaw||0);
          const route=routeToSeat(sw,from,tip);if(!route)throw Error('Lower the cargo ramp before dismissing crew.');
          c.status='leaving-aboard';c.localPose={...from};c.routeState={route,ri:0,pi:0};this.crewRoutes.delete(c.id);
        }break;}
      case 'buy-ship':return this.buyShip(p,a);
      case 'set-flagship':return this.setFlagship(p,a);
      case 'claim-ship':return this.claimShip(p,a);
      case 'board-prize':return this.boardPrize(p,a);
      case 'tool-change':if(!Number.isSafeInteger(a.index))throw Error('Invalid tool.');p.toolIdx=((a.index%3)+3)%3;break;
      case 'dig-edit':case 'spoil-pour':{if(p.aboardShipId)throw Error('Use ground tools outside.');const body=p.frameId==='mars'?this.mars:makeMoon(p.frameId),w=new Walker(body);
        Object.assign(w.worldPos,p.pose.worldPos);w.yaw=p.pose.yaw;w.pitch=p.pose.pitch;w.updateFrame();const d=new Digger(body,this.stores.get(p.frameId),w);d.toolIdx=p.toolIdx;d.carried=structuredClone(p.carried);
        if(p.frameId!=='mars')d.tools=d.tools.map(t=>({...t,capacityKg:t.machine?t.capacityKg:Math.min(t.capacityKg,1054)}));
        d.canPlaceSpoil=(x,y,z)=>this.canPlaceSpoil(p.frameId,x,y,z);
        const r=a.type==='dig-edit'?d.dig():d.dump(!!a.all);if(!r.ok)return r;p.carried=d.carried;return r;}
      case 'purchase':case 'sale':case 'regolith-sale':case 'quest-accept':case 'quest-step':{
        this.owner(p,this.state.ships[p.shipId]);const s=this.state.ships[p.shipId];
        if(a.type==='quest-step'){const q=QUESTS.find(q=>q.id===a.id);if(!q)throw Error('Unknown job.');this.near(p,{...q.target,y:0},q.target.radius);}
        else {const worker=PORT_WORKERS.find(s=>s.id===(a.type==='quest-accept'?QUESTS.find(q=>q.id===a.id)?.giver:a.type==='regolith-sale'?'depot-clerk':a.trader));
          if(!worker)throw Error('Unknown worker.');this.near(p,{...worker,y:worker.y||0},3);}
        const next=reduceEconomy({...s.economy,cargo:structuredClone(p.carried),traders:this.state.market.traders,marketMarks:this.state.market.marketMarks},
          {...a,position:this.site.toLocal(p.pose.worldPos)});this.state.market.traders=next.traders;this.state.market.marketMarks=next.marketMarks;s.economy=next;p.carried=next.cargo;break;}
      case 'sample':{if(p.frameId!=='phobos'||p.aboardShipId)throw Error('Walk to a Phobos sample marker.');const s=makeMoon('phobos').sampleSites.find(s=>s.id===a.site);if(!s||distance(s.point,p.pose.worldPos)>SAMPLE_REACH_M)throw Error('Walk to the marker.');
        if(ship.jobs.taken.includes(s.id))throw Error('Already sampled.');const r=Math.hypot(s.point.x,s.point.y,s.point.z),e=this.stores.get('phobos');
        const lot=e.carve({x:s.point.x-s.point.x/r*.045,y:s.point.y-s.point.y/r*.045,z:s.point.z-s.point.z/r*.045,r:.09,maxMassKg:50});if(!lot)throw Error('No sample left here.');ship.jobs.taken.push(s.id);ship.jobs.samples.push(lot);this.addCargo(ship,'phobos-core-sample',lot.massKg);break;}
      case 'salvage':{const s=ship,d=makeMoon('phobos').derelict;if(p.frameId!=='phobos'||p.aboardShipId||distance(p.pose.worldPos,d.point)>SALVAGE_REACH_M)throw Error('Walk to the cargo module.');if(s.jobs.salvaged)throw Error('Already claimed.');s.jobs.salvaged=true;this.addCargo(s,'salvage-alloy',SALVAGE_KG);this.award(s,SALVAGE_CREDITS);break;}
      case 'stow':{if(ship.owner!==p.id&&!ship.crewMayBoard)throw Error('The owner has boarding closed.');if(p.frameId!==sim.frameId||distance(p.pose.worldPos,sim.flight.pos)>38)throw Error('Bring the hopper to your ship.');
        ship.holdLots=ship.holdLots||[];for(const l of p.carried){for(const part of l.parts||[{materialId:l.materialId,massKg:l.massKg}])this.addCargo(ship,MAT_ITEM[part.materialId]||'regolith-other',part.massKg);ship.holdLots.push(structuredClone(l));}p.carried=[];break;}
      default:throw Error('Unsupported authority action: '+a.type);
    }return yes();
  }
}
