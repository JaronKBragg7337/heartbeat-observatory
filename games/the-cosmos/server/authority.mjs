import { mayBoard } from '../src/ship/hullCollision.js';
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
import { frameWorldIds } from '../src/worlds/registry.js';
import { GunnerAI } from '../src/crew/gunnerAI.js';
import { routeToSeat, RouteWalker } from '../src/crew/shipPath.js';
import { SAMPLE_PAY_CREDITS, SAMPLE_REACH_M, SALVAGE_CREDITS, SALVAGE_KG, SALVAGE_REACH_M, MAT_ITEM } from '../src/space/jobs.js';
import { ShipSimulation } from './simulation.mjs';
import { VehicleDirector } from './vehicles.mjs';
import { ShopDirector } from './shops.mjs';
import { RoleDirector } from './roles.mjs';      // F5 roles and NPC stand-ins, F4 balance and home strength
import { MissionDirector } from './missions.mjs';      // MISSIONS: jobs, stories and the hiring desks of the worlds that are not Mars
import { worldSale } from './world2.mjs';       // WORLD2
import { tripWarps } from '../src/space/longRange.js';       // F3: the compression ladder depends on the drive that has the ship
import { moonTrade } from './moon.mjs';       // WD-MOON
import { freshOpening, OpeningModel, OPENING_VERSION } from '../src/opening/state.js';
import { currentSeason } from '../src/opening/season.js';       // OPENING2
import { boardData } from '../src/opening/worlds.js';
import { REPAIR_PARTS, giverFor, FIT_REACH, missingParts } from '../src/opening/lifeboat.js';
import { frameToOutpost } from '../src/worlds/ceres/layout.js';
import { makeMoon as makeMoonBody } from '../src/space/moonField.js';
import { detachBodyEdits } from '../src/world/field.js';
import { landingOrder, MOON_IDS } from '../src/space/spaceSpec.js';
import { humanMarkers, DEFAULT_NAME, GUEST_IDLE_MS, EPHEMERAL_IDLE_MS, MAX_SLOTS } from './identity.mjs';

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

const restPhase=id=>{let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return (h%500)/1000;};
export class Authority {
  constructor(adapter,{now=Date.now,verify=null}={}) {
    this.adapter=adapter;this.now=now;this.verify=verify;this.mars=getBody('mars');this.site=createPortSite(this.mars);
    this.sessions=new Map();this.inputs=new Map();this.queue=Promise.resolve();this.error='';this.bricks=new Map();
    this.state={schema:2,revision:0,clock:0,savedAt:now(),players:{},ships:{},pads:[],pool:{},poolSeq:0,
      market:initialEconomy(),terrain:{},damage:{},vehicles:{},shops:{},receipts:{},users:{},missions:{}};
    this.fleet=new FleetDirector(this);this.vehicleInputs=new Map();this.vehicles=new VehicleDirector(this);this.shops=new ShopDirector(this);this.roles=new RoleDirector(this);this.missions=new MissionDirector(this);
  }
  async load(){const s=await this.adapter.load();if(s.record){if(s.record.schema!==2)throw Error('Unsupported authority schema.');this.state=s.record;}
    for(const c of Object.values(this.state.pool))if(!c.shipId&&c.status==='inside'&&c.position.x===CREW_HALL.x&&c.position.z===CREW_HALL.z)c.position.x+=(CREW_POSTS.findIndex(r=>r.id===c.role)-2.5)*2.4;
    this.state.users=this.state.users||{};
    for(const p of Object.values(this.state.players)){p.offlineAt=p.offlineAt||this.state.savedAt;p.seenAt=p.seenAt||p.offlineAt;
      // OPENING2: an unfinished opening of the old shape (the freighter crash) is not resumed: the beats changed, so the player starts the new one.
      if(p.opening&&!p.opening.complete&&p.opening.version!==OPENING_VERSION)p.opening=freshOpening({season:this.season(),now:this.now()});}
    this.bricks=new Map(s.bricks.map(b=>[b.key,b]));this.state.vehicles=this.state.vehicles||{};this.rebuild();this.vehicles.ensureAll();this.shops.ensureAll();this.roles.ensureAll();this.missions.ensureAll();this.refill();
    // Restart catch-up uses real elapsed time. It continues trips/wages, never a browser clock.
    const elapsed=Math.min(300,Math.max(0,(this.now()-this.state.savedAt)/1000)); // hotfix 10/2: cap catch-up at 5 min; an active ship at 30 Hz over hours pegged the CPU and the watchdog restart loop made it worse
    if(elapsed){this.advance(elapsed,{catchUp:true});}
    // Test clients (a few minutes after they were last seen) and guests idle a day leave their pads.
    this.lastSweep=this.sweep();
    this.fleet.ensure();await this.commit();return this;
  }
  rebuild(){for(const id of this.openingModels?.keys()||[])this.releaseOpening(id);
    attachGrades([this.site,landingField(this.site,()=>this.state.pads)]);
    // Terrain sampling asks for this list thousands of times a second: rebuild it only when a pad is allocated or at most every 250 ms (pads are append-only).
    this._moonPadList=null;this._moonPadAt=0;
    attachMoonPads(()=>{const t=this.now();if(this._moonPadList&&t-this._moonPadAt<250&&t>=this._moonPadAt)return this._moonPadList;
      const out=[];for(const s of Object.values(this.state.ships)){if(!s.moonPads)continue;
      for(const id of frameWorldIds())if(s.moonPads[id])out.push(s.moonPads[id]);}this._moonPadList=out;this._moonPadAt=t;return out;});
    this.stores=new Map();
    this.elevator=Object.assign(new TowerElevator(),this.state.elevator||{});this.crewRoutes=new Map();
    for(const id of ['mars',...frameWorldIds()]){const e=new EditStore(id==='mars'?this.mars:makeMoon(id));attachEdits(e);
      restoreTerrain(e,this.state.terrain[id],[...this.bricks.values()].filter(b=>b.bodyId===id));this.stores.set(id,e);}
    this.sims=new Map(Object.values(this.state.ships).filter(s=>!s.parked).map(s=>[s.id,this.makeSim(s)]));
  }
  /** One ship's simulation, whatever its type; a raider also gets its brain and its escort wing. */
  makeSim(s){this.ensureMoonPads(s);const sim=new ShipSimulation(s,this.mars,this.site,d=>this.arrive(s,d));sim.nowFn=()=>this.now();sim.otherSim=id=>this.sims.get(id);sim.allSims=()=>this.sims.values();if(s.npc)this.fleet.attach(sim);return sim;}
  /** One Phobos pad and one Deimos pad per owned ship. Append-only: a pad already on the record stays put. */
  ensureMoonPads(ship){this._moonPadList=null;if(ship.npc)return;ship.moonPads=ship.moonPads||{};
    for(const bodyId of frameWorldIds()){const cur=ship.moonPads[bodyId];
      if(cur&&cur.shipId===ship.id&&Number.isFinite(cur.east)&&Number.isFinite(cur.north))continue;
      // The lowest grid slot nobody else holds. (A count would hand a new ship the slot of a pad that is still in use once ships can leave.)
      const used=new Set();for(const other of Object.values(this.state.ships)){if(other===ship||other.npc)continue;
        const q=other.moonPads?.[bodyId];if(q&&Number.isFinite(q.east)){const m=/-(\d+)$/.exec(q.id||'');if(m)used.add(Number(m[1])-1);}}
      let index=0;while(used.has(index))index++;
      ship.moonPads[bodyId]=allocatedMoonPad(bodyId,index,ship.id);}}
  enqueue(fn){const p=this.queue.then(fn);this.queue=p.catch(()=>{});return p;}
  _parkBlockers(){const held=[];for(const sim of this.sims.values()){if(sim?.ship?.state?.blockers){held.push([sim,sim.ship.state.blockers]);delete sim.ship.state.blockers;}}return held;}
  _unpark(held){for(const [sim,b] of held)sim.ship.state.blockers=b;}
  publicState(viewerId){const held=this._parkBlockers();const s=structuredClone(this.state);this._unpark(held);delete s.receipts;delete s.users;
    // MISSIONS: a player is sent only their own jobs (the others' are theirs)
    {const mine=s.missions?.[viewerId];s.missions=mine?{[viewerId]:mine}:{};}
    for(const [id,sh] of Object.entries(s.ships))if(sh.parked)delete s.ships[id];
    // The crew of a parked ship go with it (a browser that is told of a hired person on a ship it was not sent has nothing to place them on).
    for(const [id,c] of Object.entries(s.pool))if(c.shipId&&!s.ships[c.shipId])delete s.pool[id];
    for(const p of Object.values(s.players)){delete p.deviceHash;delete p.userId;delete p.slot;p.online=this.sessions.has(p.id);
      if(p.opening&&p.id!==viewerId)p.opening={complete:p.opening.complete};}
    s.storageError=this.error;
    return s;
  }
  async commit(){for(const sim of this.sims.values()){sim.capture();this.fleet.capture(sim);}const changed=[];
    this.state.elevator=structuredClone(this.elevator);
    for(const [id,e] of this.stores){this.state.terrain[id]=structuredClone(terrainMeta(e));
      for(const key of e._dirty){const b=e.bricks.get(key);if(b?.edited)changed.push({...encodeBrick(e,b),key:id+':'+key,bodyId:id});}}
    this.state.savedAt=this.now();this.state.revision++;
    const held=this._parkBlockers();const snapshot=structuredClone(this.state);this._unpark(held);
    const t0=performance.now();try{await this.adapter.save(snapshot,changed);}finally{const ms=performance.now()-t0,c=this.commitStats||(this.commitStats={n:0,sum:0,maxMs:0,failed:0});c.n++;c.sum+=ms;if(ms>c.maxMs)c.maxMs=ms;c.lastMs=ms;}
    for(const b of changed)this.bricks.set(b.key,b);for(const e of this.stores.values())e._dirty.clear();
    this.error='';return changed;
  }
  /** A new player (and the ship and pad that come with them). A signed-in person's player also carries their account id and slot. */
  createPlayer(deviceHash,name,personId,openingVersion,{userId=null,slot=null,ephemeral=false}={}){
    const id=randomUUID(),shipId=randomUUID(),pad=this.allocPad(shipId);
    const ship={id:shipId,owner:id,type:openingVersion>=1?'lifeboat':DEFAULT_SHIP_TYPE,pad,crewMayBoard:false,crew:[],hold:{},holdLots:[],jobs:{taken:[],samples:[],salvaged:false},economy:initialEconomy(),frameId:'mars',pose:null,trip:null};
    this.state.ships[shipId]=ship;this.sims.set(shipId,this.makeSim(ship));this.vehicles.ensure(ship);
    const p={id,deviceHash,name:cleanName(name),personId:/^[a-z]{2,24}$/.test(personId)?personId:'isaiah',shipId,currentShipId:shipId,aboardShipId:null,vehicleId:null,vehicleSeat:null,frameId:'mars',
      pose:{worldPos:this.site.toWorld(pad.x-10,.02,pad.z+38),velocity:{x:0,y:0,z:0},yaw:this.site.heading,pitch:0,grounded:true,aboard:false,sw:{x:0,y:0,z:12,yaw:0,pitch:0},seat:null,look:{yaw:0,pitch:0}},toolIdx:1,carried:[],createdAt:this.now(),seenAt:this.now()};
    if(userId){p.userId=userId;p.slot=slot||'main';}
    if(ephemeral)p.ephemeral=true;
    // OPENING2: the player's first ship is the drained lifeboat (it flies once two parts are fitted); the opening is the new one, with this season's crash.
    if(openingVersion>=1){p.opening=freshOpening({season:this.season(),now:this.now()});ship.drained=true;ship.repair={need:['cell','coupler'],have:[]};}
    this.state.players[id]=p;return p;
  }
  /**
   * Who is joining. `ident` is what the server verified (never what the browser claimed): { userId, email, admin, slot, test }.
   * A guest is their device key, as before. A signed-in person is their account: the same player, ship, pad, money and pose from any
   * device or a private tab. The first time an account signs in on a device that already has a guest player, that player moves onto the account.
   */
  async join(deviceKey,name,personId='isaiah',openingVersion=0,ident={}) {
    if(typeof deviceKey!=='string'||deviceKey.length<24||deviceKey.length>128)throw Error('Invalid device identity.');
    const key=hash(deviceKey),user=ident.userId?ident:null;let p=null,note=null;
    const before=structuredClone(this.state);
    try{
      this.state.users=this.state.users||{};
      const here=Object.values(this.state.players).find(g=>g.deviceHash===key);
      if(user){
        const acct=this.state.users[user.userId]||={slots:{},createdAt:this.now()};
        acct.email=user.email||acct.email||'';acct.admin=!!user.admin;
        const slot=user.admin&&/^[a-z0-9-]{1,16}$/.test(ident.slot||'')?ident.slot:'main';
        p=this.state.players[acct.slots[slot]?.playerId];
        if(!p){delete acct.slots[slot];
          if(Object.keys(acct.slots).length>=MAX_SLOTS)throw Error('Too many saved characters.');
          if(slot==='main'&&here&&!here.userId&&!here.ephemeral){p=here;note='adopted';}
          else{
            // A guest ship on this device that the account does not take stays a guest ship; it is cleaned up once it has been idle a day.
            note=slot==='main'&&here&&!here.userId?'kept-account':'created';
            p=this.createPlayer(here?hash(deviceKey+':'+user.userId+':'+slot+':'+randomUUID().slice(0,8)):key,!name||DEFAULT_NAME.test(name)?(user.email?.split('@')[0]||name):name,personId,openingVersion);
          }
          p.userId=user.userId;p.slot=slot;
        }
        if(!note&&slot==='main'&&here&&!here.userId&&!here.ephemeral&&here.id!==p.id)note='kept-account';
        acct.slots[slot]={playerId:p.id,name:p.name,at:this.now()};acct.lastSlot=slot;
      }else{
        p=here||this.createPlayer(key,name,personId,openingVersion,{ephemeral:!!ident.test});
      }
      if(p.parked)this.unpark(p);
      p.name=cleanName(name||p.name);
      p.seenAt=this.now();
      this.joinNote=note;
      await this.commit();this.sessions.get(p.id)?.close();return p;
    }catch(e){this.state=before;this.rebuild();throw e;}
  }
  /** What a hello proves: a verified account (never an id the browser typed) and whether the client says it is a test. */
  async identify(m){const ident={test:m.test===true,slot:typeof m.slot==='string'?m.slot.slice(0,16):undefined};
    if(m.token&&this.verify){const u=await this.verify(m.token).catch(()=>null);if(u)Object.assign(ident,u);else ident.tokenRejected=true;}
    return ident;}
  /** What the browser is told about who it is (never another player's account). */
  identityInfo(p,note=null){const acct=p.userId&&this.state.users?.[p.userId];
    return {guest:!p.userId,signedIn:!!p.userId,email:acct?.email||'',admin:!!acct?.admin,slot:p.slot||null,ephemeral:!!p.ephemeral,note,
      slots:acct?Object.entries(acct.slots).map(([id,s])=>({id,name:this.state.players[s.playerId]?.name||s.name,current:s.playerId===p.id})).sort((a,b)=>a.id==='main'?-1:b.id==='main'?1:a.id.localeCompare(b.id)):[]};}
  /** Everything a player owns leaves the world: ships and their crew contracts, rovers, pads (kept free for the next arrival), moon pads. Refused while anyone else is aboard. */
  removePlayer(id){const p=this.state.players[id];if(!p||this.sessions.has(id))return false;
    const owned=Object.values(this.state.ships).filter(s=>s.owner===id&&!s.npc);
    for(const s of owned)if(Object.values(this.state.players).some(q=>q.id!==id&&q.aboardShipId===s.id))return false;
    const before=structuredClone(this.state);
    try{
      for(const s of owned){
        for(const c of s.crew||[]){const pc=this.state.pool[c.id];if(pc&&pc.deskKey){delete this.state.pool[c.id];continue;}if(pc&&pc.shipId===s.id){const slot=Math.max(0,CREW_POSTS.findIndex(r=>r.id===pc.role));
          Object.assign(pc,{shipId:null,status:'inside',position:{x:CREW_HALL.x+(slot-2.5)*2.4,y:0,z:CREW_HALL.z},refillAt:this.state.clock});}}
        for(const a of this.state.pads)if(a.shipId===s.id)a.shipId=null;
        for(const [vid,v] of Object.entries(this.state.vehicles||{}))if(v.owner===id||v.homeShipId===s.id||v.parentShipId===s.id)delete this.state.vehicles[vid];
        this.sims.delete(s.id);delete this.state.ships[s.id];
      }
      for(const [k,r] of Object.entries(this.state.receipts||{}))if(r?.playerId===id)delete this.state.receipts[k];
      for(const q of Object.values(this.state.players))if(q.id!==id&&owned.some(s=>s.id===q.currentShipId))q.currentShipId=q.shipId;
      for(const u of Object.values(this.state.users||{}))for(const [sl,v] of Object.entries(u.slots))if(v.playerId===id)delete u.slots[sl];
      this.shops.removeOwner(id);this.roles.removePlayer(id);this.missions.removePlayer(id);this.releaseOpening(id);this.inputs.delete(id);this.vehicleInputs.delete(id);delete this.state.players[id];
      return true;
    }catch(e){this.state=before;this.rebuild();throw e;}
  }
  /**
   * RESET THE WORLD (admin, while the game is still being built). Every player, player-owned ship, pad, crew contract, account, quest, receipt, damage
   * record, rover and (by default) terrain edit is removed; the market, the clock and the NPC raiders stay. Run through the authority so the world
   * record and the database projections agree: see server/reset-world.mjs (stop the node process, run it, let the watchdog restart the server).
   * Returns a count of what went.
   */
  resetWorld({terrain=true}={}){
    const out={players:Object.keys(this.state.players).length,ships:0,pads:this.state.pads.length,crew:Object.keys(this.state.pool).length,
      receipts:Object.keys(this.state.receipts||{}).length,damage:Object.keys(this.state.damage||{}).length,vehicles:Object.keys(this.state.vehicles||{}).length,
      accounts:Object.keys(this.state.users||{}).length,terrainBricks:this.bricks.size,keptRaiders:0};
    for(const [id,s] of Object.entries(this.state.ships)){if(s.npc){out.keptRaiders++;continue;}this.sims.delete(id);delete this.state.ships[id];out.ships++;}
    for(const id of [...(this.openingModels?.keys()||[])])this.releaseOpening(id);
    Object.assign(this.state,{players:{},pads:[],pool:{},poolSeq:0,damage:{},vehicles:{},receipts:{},users:{}});
    this.sessions.clear();this.inputs.clear();this.vehicleInputs.clear();
    if(terrain){this.state.terrain={};this.bricks=new Map();}
    this.rebuild();this.vehicles.ensureAll();this.refill();
    return out;
  }
  /** A guest's ship that has been idle a day is taken off its pad and kept; it comes back on a pad when they return. */
  park(p){const ship=this.state.ships[p.shipId];if(!ship||ship.parked||ship.npc)return false;
    if(ship.frameId!=='mars'||ship.trip||!this.sims.get(ship.id)?.flight.landed)return false;
    if(Object.values(this.state.players).some(q=>q.id!==p.id&&q.aboardShipId===ship.id))return false;
    for(const a of this.state.pads)if(a.shipId===ship.id)a.shipId=null;
    ship.parked=true;ship.pad=null;this.sims.delete(ship.id);
    p.aboardShipId=null;p.currentShipId=p.shipId;p.pose.aboard=false;p.pose.seat=null;p.vehicleId=null;p.vehicleSeat=null;p.parked=true;return true;}
  unpark(p){const ship=this.state.ships[p.shipId];
    if(ship?.parked){const pad=this.allocPad(ship.id);Object.assign(ship,{parked:false,pad,pose:null,trip:null,frameId:'mars',order:null,orderKey:null,pendingOrder:null,autopilot:null});
      this.sims.set(ship.id,this.makeSim(ship));this.vehicles.ensure(ship);
      for(const c of ship.crew||[])if(!String(c.status).startsWith('leaving')){c.status='aboard';c.groundRoute=[];}
      p.pose.worldPos=this.site.toWorld(pad.x-10,.02,pad.z+38);p.pose.velocity={x:0,y:0,z:0};p.pose.grounded=true;p.frameId='mars';}
    delete p.parked;}
  /** True while a hull is landed, settled and asked for nothing (see advance). */
  resting(sim,control){const r=sim.record,f=sim.flight;
    return !r.npc&&f.landed&&!sim.trip&&!orderLive(sim)&&!f.autoHover&&!control.lift&&!control.fwd&&!control.yaw&&!control.strafe&&!control.land&&!control.boost&&!r.escort&&!r.pendingOrder&&f.hull>=100
      &&!sim.guns.bolts.length&&!sim.drones.shots.length&&sim.ship.air.phase==='idle'
      &&Object.values(sim.ship.rampCtl).every(c=>Math.abs(c.target-c.progress)<1e-4)&&!r.crew.some(c=>c.status==='walking-aboard'||c.status==='boarding'||String(c.status).startsWith('leaving'));}
  allocPad(shipId){const free=this.state.pads.find(a=>!a.shipId);
    if(free){free.shipId=shipId;return {...free};}
    const pad=allocatedPad(this.state.pads.length,shipId);this.state.pads.push(pad);return {...pad};}
  /**
   * Housekeeping, at start and about once a minute. A test client (it flags itself) is removed shortly after it disconnects. A guest player idle
   * a day is deleted if it is plainly throwaway (default name and look, nothing done), parked if all it has is progress, kept when a person
   * made it (a chosen look or typed name) because the sweep cannot be sure whose it is. Signed-in players are never touched. `idleMs` lets a
   * one-off cleanup use a shorter clock. Returns what it did, for the log.
   */
  sweep({idleMs=GUEST_IDLE_MS,dryRun=false}={}){const out={removed:[],parked:[],kept:[]},now=this.now(),tag=p=>({id:p.id.slice(0,8),name:p.name});
    const PROGRESS=['spent or earned marks','hired crew','cargo','jobs','away from Mars'];
    for(const p of Object.values(this.state.players)){
      if(this.sessions.has(p.id))continue;
      const idle=now-(p.seenAt||p.offlineAt||this.state.savedAt),ship=this.state.ships[p.shipId];
      if(p.ephemeral){if(idle>=EPHEMERAL_IDLE_MS){if(dryRun||this.removePlayer(p.id))out.removed.push({...tag(p),why:'test client'});}continue;}
      if(p.userId||idle<idleMs||p.parked)continue;
      const human=humanMarkers(p,ship);
      if(!human.length){if(dryRun||this.removePlayer(p.id))out.removed.push({...tag(p),why:'idle guest, nothing done'});else out.kept.push({...tag(p),why:'someone aboard'});}
      else if(human.every(w=>PROGRESS.includes(w))){if(dryRun||this.park(p))out.parked.push({...tag(p),why:human.join(', ')});else out.kept.push({...tag(p),why:'cannot park: '+human.join(', ')});}
      else out.kept.push({...tag(p),why:human.join(', ')});
    }
    return out;}
  /** ROUND7: one open candidate per post. A dismissed hire walks back to the hall while refill() has already made a replacement, so
   *  two Adas stood on the same spot and the panel named whichever came first. Keep the one furthest along (waiting, meeting, returning,
   *  then the older), retire the rest: they were never hired, so no contract is touched. */
  dedupePool(){const rank={waiting:0,meeting:1,returning:2};
    for(const role of CREW_POSTS){const open=Object.values(this.state.pool).filter(c=>c.role===role.id&&!c.shipId&&!c.retired);
      if(open.length<2)continue;
      open.sort((a,b)=>(rank[a.status]??3)-(rank[b.status]??3)||Number(a.id.replace(/\D/g,''))-Number(b.id.replace(/\D/g,'')));
      for(const c of open.slice(1))c.retired=true;}}
  refill(){this.dedupePool();const available=Object.values(this.state.pool).filter(c=>!c.shipId&&!c.retired);
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
  releaseOpening(id){const model=this.openingModels?.get(id);if(!model)return;
    model.release();this.openingModels.delete(id);}
  /** OPENING2: this season (number and the crash cause its transports share). COSMOS_CRASH_CAUSE overrides the cause for review runs only. */
  season(){return currentSeason(this.now(),process.env.COSMOS_CRASH_CAUSE||null);}
  /** The live counts the arrivals board shows: players and members per start world and side, online now. */
  boardLive(){const players={},online={},factions={};
    for(const p of Object.values(this.state.players)){const h=p.home;if(!h)continue;players[h.world]=(players[h.world]||0)+1;
      if(this.sessions.has(p.id))online[h.world]=(online[h.world]||0)+1;if(h.faction)factions[h.faction]=(factions[h.faction]||0)+1;}
    return {players,online,factions,season:this.season()};}
  boardData(){return boardData(this.boardLive());}
  /**
   * The opening is over: put the player at their world's port with the purse and the drained lifeboat on its pad. Mars is the port itself (the
   * ship is on the player's pad); any other world sets the lifeboat down on the player's own pad there and stands the player beside it.
   */
  /** OPENING2: the drained lifeboat. 'lifeboat-part' buys the part its giver holds (the player must stand at the giver, and pay); 'lifeboat-fit' fits both at the boat. */
  lifeboat(p,a){
    const own=this.state.ships[p.shipId];this.owner(p,own);
    if(!own.drained)throw Error('Your lifeboat is not drained.');
    const world=p.home?.world||'mars';
    if(a.type==='lifeboat-part'){
      const part=String(a.part),info=REPAIR_PARTS[part];if(!info)throw Error('Unknown part.');
      own.repair=own.repair||{need:['cell','coupler'],have:[]};
      if(own.repair.have.includes(part))throw Error('You already have the '+info.name+'.');
      const g=giverFor(world,part);
      if(g.frame==='port')this.near(p,{x:g.at.x,y:0,z:g.at.z},g.reach);
      else{if(p.aboardShipId||p.frameId!==world)throw Error('Walk over to them first.');
        const o=frameToOutpost(makeMoonBody(world).padInfo,p.pose.worldPos);if(Math.hypot(o.x-g.at.x,o.z-g.at.z)>g.reach)throw Error('Walk over to them first.');}
      if(own.economy.marks<info.priceMarks)throw Error(`The ${info.name} is ${info.priceMarks} marks and the purse has ${own.economy.marks}.`);
      own.economy.marks-=info.priceMarks;own.repair.have.push(part);
      return {ok:true,msg:own.repair.have.length>=2?`The ${info.name} is yours. Both parts: fit them at the lifeboat.`:`The ${info.name} is yours. One part to go, from the other side.`};
    }
    if(missingParts(own).length)throw Error('You still need a part from the other side.');
    const sim=this.sims.get(own.id);if(!sim||p.frameId!==sim.frameId)throw Error('Stand beside your lifeboat.');
    const d=distance(p.pose.worldPos,sim.flight.pos);if(d>FIT_REACH)throw Error('Stand beside your lifeboat.');
    own.drained=false;own.repair=null;sim.repairDone();
    return {ok:true,msg:'The parts are fitted. The lifeboat has power. Go and make her earn.'};
  }
  arriveFromOpening(p,ship){
    const o=p.opening,d=o.dest||{world:'mars',faction:null,stay:true};
    p.opening.played=true;
    p.home={world:d.world,faction:d.faction||null,driver:o.driver||null,cause:o.season?.cause||null,season:o.season?.number||null,stay:!!d.stay,at:this.now()};
    const sim=this.sims.get(ship.id);
    if(d.world==='mars'||!sim||!(d.world in (ship.moonPads||{}))){
      p.frameId='mars';p.pose.worldPos=this.site.toWorld(ship.pad.x-7,.02,ship.pad.z+20);
      p.pose.yaw=this.site.heading;
    }else{
      sim.placeOnWorld(d.world);
      const moon=makeMoonBody(d.world),pad=ship.moonPads[d.world],mp=moon.playerPad(pad.east,pad.north);
      const at=(e,n)=>({x:mp.point.x+mp.east.x*e+mp.north.x*n+mp.up.x*.02,y:mp.point.y+mp.east.y*e+mp.north.y*n+mp.up.y*.02,z:mp.point.z+mp.east.z*e+mp.north.z*n+mp.up.z*.02});
      p.frameId=d.world;p.pose.worldPos=at(9,-3);p.pose.yaw=-Math.PI/2;
    }
    p.pose.pitch=0;p.pose.velocity={x:0,y:0,z:0};p.pose.aboard=false;p.poseAt=this.now();
  }
  disconnect(id,peer){if(this.sessions.get(id)!==peer)return;this.sessions.delete(id);this.inputs.delete(id);this.vehicleInputs.delete(id);this.releaseOpening(id);
    this.state.players[id].offlineAt=this.now();this.state.players[id].seenAt=this.now();
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
        let ffIn=null;if(pilot){const lease=this.inputs.get(pilot.id);control=lease.controls;ffIn=lease.ff||null;}   // FREEFLIGHT: the pilot's free-flight stick rides the same one-second lease
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
        if(!(catchUp&&sim.flight.landed&&!sim.trip&&!orderLive(sim)&&!sim.flight.autoHover&&!control.lift&&!control.fwd&&!control.yaw&&!control.strafe&&!control.land))
        {
          // A ship sitting on its pad with nothing asked of it (most of a busy port, most of the day) is stepped twice a second with the
          // time it missed, not thirty times: the physics treats a resting hull the same, and a world of two dozen idle hulls was spending
          // its whole tick on them. Anything that wakes a ship (a stick, an order, a ramp moving, shots in the air, a trip) steps it at full rate again.
          if(!catchUp&&this.resting(sim,control)){
            // Phase each hull differently (a hash of its id) so two dozen resting ships never all step on the same tick: that burst was a 400 ms stall every half second.
            if(!sim.restDt)sim.restDt=restPhase(id);
            sim.restDt+=dt;
            if(sim.restDt>=.5){const d=sim.restDt;sim.restDt=.0001;sim.restCoarse=true;this.fleet.preStep(sim);sim.step(d,control,ffIn);this.fleet.postStep(sim);sim.restCoarse=false;}}
          else{sim.restDt=0;this.fleet.preStep(sim);sim.step(dt,control,ffIn,{catchUp});this.fleet.postStep(sim);}
        }
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
      this.vehicles.step(dt,{catchUp});this.shops.step(dt,{catchUp});this.roles.step(dt,{catchUp});this.missions.step(dt,{catchUp});
    }this.refill();
    this.state.elevator=structuredClone(this.elevator);
    if(this.state.clock>=(this.state.nextRestock||300)){for(const stock of Object.values(this.state.market.traders))for(const k of Object.keys(stock))stock[k]=Math.max(stock[k],30);this.state.nextRestock=this.state.clock+300;}
    for(const sim of this.sims.values()){sim.capture();this.fleet.capture(sim);}
  }
  shipFor(p){return this.state.ships[p.aboardShipId||p.currentShipId||p.shipId];}
  rampOccupied(sim,key){const r=sim.def.ramps[key],run=r.length*Math.cos(sim.ship.rampCtl[key].angle);
    const on=q=>{const along=(q.x-r.hinge.x)*r.dir.x+(q.z-r.hinge.z)*r.dir.z,across=r.dir.z?Math.abs(q.x-r.hinge.x):Math.abs(q.z-r.hinge.z);return along>.2&&along<run+1&&across<r.width/2+.3&&q.y<.6;};
    return Object.values(this.state.players).some(p=>p.aboardShipId===sim.record.id&&on(p.pose.sw))||sim.record.crew.some(c=>['walking-aboard','leaving-aboard'].includes(c.status)&&c.localPose&&on(c.localPose))||this.vehicles.onRamp(sim,key);
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
    if(frame!=='mars'){const sb=makeMoon(frame);if(sb.settlementSolid&&sb.settlementSolid(x,y,z,.5))return false;}       // WORLD2: not on a settlement's buildings, pad or people
    if(frame!=='mars'){
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
    const id=randomUUID(),pad=this.allocPad(id);
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
    const pad=this.allocPad(rec.id);
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
    const pad=this.allocPad(rec.id);
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
    if(this.state.receipts[key])return {...this.state.receipts[key].result,replay:true,
      ...(a?.type?.startsWith('opening-')?{opening:structuredClone(this.state.players[id]?.opening)}:{})};
    const before=structuredClone(this.state);let result;
    try{if(this.error){await this.commit().catch(()=>{});if(this.error)throw Error('The shared world could not save just now. Try again in a moment.');}   // a stale storage fault clears itself the moment a save works, not at the next 2-second tick
      const p=this.state.players[id];if(!p)throw Error('Join first.');result=this.reduce(p,a)||yes();
      if(result.ok===false)throw Error(result.msg);
      const receipt=structuredClone(result);
      // Retain the durable action outcome once; private cut history lives on the player.
      // A retry reads the current opening rather than rewinding to an old pose.
      if(a.type.startsWith('opening-'))delete receipt.opening;
      this.state.receipts[key]={playerId:id,actionId,revision:this.state.revision+1,result:receipt};
      /* a retry only ever needs the recent receipts; every save used to carry and re-insert all of them */const keys=Object.keys(this.state.receipts);if(keys.length>240){keys.sort((x,y)=>this.state.receipts[x].revision-this.state.receipts[y].revision);for(const k of keys.slice(0,keys.length-160))delete this.state.receipts[k];}const bricks=await this.commit();return {...result,bricks};
    }catch(e){this.state=before;this.rebuild();return {ok:false,msg:e.message};}
  }
  updatePose(p,a){const r=a.pose;if(!r||!finitePoint(r.worldPos)||!finitePoint(r.sw)||![r.yaw,r.pitch,r.sw.yaw,r.sw.pitch].every(Number.isFinite))throw Error('Invalid player pose.');
    if(p.opening&&!p.opening.complete)return;
    if(p.vehicleId){const v=a.vehicle;if(p.vehicleSeat==='driver'&&v&&Number.isFinite(+v.throttle)&&Number.isFinite(+v.steer))this.vehicleInputs.set(p.id,{until:this.now()+1000,throttle:Math.max(-1,Math.min(1,+v.throttle)),steer:Math.max(-1,Math.min(1,+v.steer))});p.poseAt=this.now();return;}
    const ship=this.shipFor(p);const aboard=!!p.aboardShipId;
    if(!!r.aboard!==aboard)throw Error('Board or leave through the boarding action.');
    // Client-predicted poses have speed/cabin bounds. Swept player collision is
    // still client-side; station transitions use the shared ShipWalker rules.
    const elapsed=Math.max(.1,Math.min(3,(this.now()-(p.poseAt||this.now()-1000))/1000));
    // ROUND7: a pose further than a person can have walked is pulled back to the furthest reachable point (the client reconciles to it), never refused:
    // a refusal left the server pose behind for good ("Walk to that place." on the phone every few seconds until the page was reloaded).
    const reach=elapsed*12+2;let pose=r;
    if(aboard){const d=distance(r.sw,p.pose.sw);if(d>reach){const k=reach/d,o=p.pose.sw;pose={...r,sw:{...r.sw,x:o.x+(r.sw.x-o.x)*k,y:o.y+(r.sw.y-o.y)*k,z:o.z+(r.sw.z-o.z)*k}};}
      const B=this.sims.get(ship.id).def.dock.bounds;
      if(Math.abs(pose.sw.x)>B.x||Math.abs(pose.sw.z)>B.z||pose.sw.y<B.y0||pose.sw.y>B.y1)throw Error('Outside the cabin.');
      if(pose.seat!==p.pose.seat)throw Error('Use the seat request.');
    }else{const d=distance(r.worldPos,p.pose.worldPos);if(d>reach){const k=reach/d,o=p.pose.worldPos;pose={...r,worldPos:{x:o.x+(r.worldPos.x-o.x)*k,y:o.y+(r.worldPos.y-o.y)*k,z:o.z+(r.worldPos.z-o.z)*k}};}}
    p.pose={...structuredClone(pose),seat:p.pose.seat};p.poseAt=this.now();if(Number.isSafeInteger(a.seq))p.poseSeq=a.seq;
    if(aboard)this.sims.get(ship.id).flight.toWorld(p.pose.sw,p.pose.worldPos);
    if(a.controls&&['pilot','captain'].includes(p.pose.seat)){
      // FREEFLIGHT: a free-flight stick is intent only: finite numbers clamped to -1..1 (thrust 0..1). The physics, the fuel and the pose are the authority's.
      const c1=v=>Math.max(-1,Math.min(1,Number(v)||0)),f=a.ff,ff=f&&typeof f==='object'?{thr:Math.max(0,Math.min(1,Number(f.thr)||0)),brake:!!f.brake,pitch:c1(f.pitch),yaw:c1(f.yaw),roll:c1(f.roll),tx:c1(f.tx),ty:c1(f.ty),tz:c1(f.tz)}:null;
      // FLIGHTFEEL: a hand on the stick: pitch and strafe are -1..1, boost, land and level are 0/1, mode is one of two names. A controls packet with no mode is the old
      // three numbers (an older client, an autopilot's shape) and flies the old way. Nothing here can name a position or a speed: only a lever.
      const hand=a.controls.mode==='assist'||a.controls.mode==='newtonian',b01=v=>v?1:0;
      const controls=Object.fromEntries(['fwd','lift','yaw'].map(k=>[k,c1(a.controls[k])]));
      if(hand)Object.assign(controls,{pitch:c1(a.controls.pitch),strafe:c1(a.controls.strafe),boost:b01(a.controls.boost),land:b01(a.controls.land),level:b01(a.controls.level),mode:a.controls.mode});
      this.inputs.set(p.id,{until:this.now()+1000,controls,ff});}
  }
  reduce(p,a){if(!a||typeof a.type!=='string')throw Error('Invalid action.');const ship=this.shipFor(p),sim=this.sims.get(ship.id);
    if(a.type.startsWith('opening-')){
      if(!p.opening)throw Error('This saved player has already arrived.');
      if(p.opening.complete)return {ok:true,msg:'The opening is complete.',opening:structuredClone(p.opening)};
      this.openingModels ||= new Map();let model=this.openingModels.get(p.id);
      if(!model||model.state!==p.opening){model=new OpeningModel(p.opening,p.id);this.openingModels.set(p.id,model);}
      if(a.type==='opening-pose'||a.type==='opening-finish'){
        // The server's own clock drives the opening: a first pose after a join is credited one second, a pose on foot at most two (the model clamps by stage),
        // and the scripted parts (the liner, the Kestrel, the ride) are credited the full wall time since the last pose (they need no client pose to advance).
        const wall=Math.max(0,(this.now()-(p.openingPoseAt||this.now()-1000))/1000);
        a={...a,seconds:Math.min(130,wall)};p.openingPoseAt=this.now();
      }else if(a.type==='opening-ride'||a.type==='opening-board'||a.type==='opening-next')p.openingPoseAt=this.now();
      const r=model.act(a);if(!r.ok)return r;
      if(p.opening.complete){this.arriveFromOpening(p,ship);this.releaseOpening(p.id);}
      return {...r,opening:structuredClone(p.opening),arrivalPose:p.opening.complete?structuredClone(p.pose):null,arrivalFrame:p.opening.complete?p.frameId:undefined};
    }
    if(p.opening&&!p.opening.complete)throw Error('Continue the opening first.');
    sim.ship._rampOccupied=key=>this.rampOccupied(sim,key);
    switch(a.type){
      case 'player-pose':this.updatePose(p,a);break;
      case 'rename':p.name=cleanName(a.name);break;
      case 'elevator':{const loc=this.site.toLocal(p.pose.worldPos);if(p.aboardShipId||p.frameId!=='mars'||Math.abs(loc.x-TOWER.x)>3||Math.abs(loc.z-TOWER.z)>4)throw Error('Use the tower lift controls in person.');
        if(!this.elevator.request(a.destination))throw Error('The lift is already moving.');break;}
      case 'boarding-permission':{const own=this.state.ships[p.shipId];this.owner(p,own);own.crewMayBoard=!!a.allowed;break;}
      case 'board':{const target=this.state.ships[a.shipId||p.shipId];if(!target)throw Error('Unknown ship.');
        if(!mayBoard(target,p.id))throw Error('The owner has boarding closed.');
        const ts=this.sims.get(target.id),dock=ts.def.dock;
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
      case 'trip-warp':if(!p.aboardShipId||!sim.trip?.active&&!landingOrder(sim.crew.activeOrder()))throw Error('No course in progress.');if(!tripWarps(sim.trip).includes(a.warp))throw Error('Invalid trip speed.');sim.warp=a.warp;if(sim.trip?.active)sim.trip.setWarp(a.warp);break;
      case 'ff-set':{   // FREEFLIGHT: free flight on or off, the assist, the target, the throttle, the time compression. Bridge stations only.
        if(!p.aboardShipId||!['pilot','captain','nav','comms'].includes(p.pose.seat))throw Error('Use a bridge station to set free flight.');
        if(sim.trip?.active&&a.enabled===true)throw Error('A course is under way. Cancel it first.');
        const out=[];
        if(typeof a.enabled==='boolean'){const r=sim.ff.setEnabled(a.enabled);if(!r.ok)throw Error(r.msg);out.push(r.msg);}
        if(a.assist!==undefined){const r=sim.ff.setAssist(a.assist);if(!r.ok)throw Error(r.msg);out.push(r.msg);}
        if(a.target!==undefined){const r=sim.ff.setTarget(a.target);if(!r.ok)throw Error(r.msg);out.push(r.msg);}
        if(a.warp!==undefined){const r=sim.ff.setWarp(Number(a.warp));if(!r.ok)throw Error(r.msg);out.push(r.msg);}
        if(a.throttle!==undefined){const r=sim.ff.setThrottle(Number(a.throttle));if(!r.ok)throw Error(r.msg);out.push(r.msg);}
        return {ok:true,msg:out.join(' ')||'Free flight set.'};}
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
        // MISSIONS: away from Mars a hand simply steps off where the ship stands (the desk's list takes a desk hand back); at the port they walk to the Crew Hall as before
        if(sim.frameId!=='mars'&&sim.flight.landed){delete ship.economy.crew[c.role];ship.crew=ship.crew.filter(m=>m.id!==c.id);const pc=this.state.pool[c.id];if(pc){pc.retired=true;pc.shipId=null;}this.crewRoutes.delete(c.id);break;}
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
      case 'vehicle-board':return this.vehicles.boardPlayer(p,a);
      case 'vehicle-seat':return this.vehicles.seatPlayer(p,a);
      case 'vehicle-leave':return this.vehicles.leavePlayer(p);
      case 'buy-vehicle':return this.vehicles.buy(p);
      case 'shop-rent':return this.shops.rent(p,a);
      case 'shop-renew':return this.shops.renew(p,a);
      case 'shop-rename':return this.shops.rename(p,a);
      case 'shop-stock':return this.shops.stock(p,a);
      case 'shop-price':return this.shops.setPrice(p,a);
      case 'shop-unstock':return this.shops.unstock(p,a);
      case 'shop-close':return this.shops.close(p,a);
      case 'shop-buy':return this.shops.buy(p,a);
      case 'faction-join':case 'faction-leave':case 'role-talk':case 'role-take':case 'role-leave':case 'role-work':case 'role-set':case 'role-stand':case 'role-vote':case 'project-deliver':case 'project-buy-half':case 'peace-step':return this.roles.act(p,a);   // F5/F4
      case 'mission-accept':case 'mission-choose':case 'mission-drop':case 'desk-hire':return this.missions.act(p,a);   // MISSIONS
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
      case 'world2-sale':return worldSale(this,p,ship,sim,a);       // WORLD2
      case 'moon-trade':return moonTrade(this,p,ship,sim,a);       // WD-MOON
      case 'lifeboat-part':case 'lifeboat-fit':return this.lifeboat(p,a);       // OPENING2: earning the first ship
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
