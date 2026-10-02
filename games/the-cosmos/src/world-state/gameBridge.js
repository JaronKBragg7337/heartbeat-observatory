import { encodeBrick, terrainMeta } from './terrainCodec.js';
import { reduceEconomy } from '../economy/economy.js';
import { QUESTS } from '../economy/catalog.js';
const poseKey='cosmos-pose-v1';
const fields=['heading','pitch','roll','yawRate','hull','shield','gearPos','landed','autoHover','airborne','agl','time','climbCap','thrustDown'];
export function shipPose(ship) {
  const f=ship.flight;
  return {pos:{...f.pos},vel:{...f.vel},quaternion:f.quaternion.toArray(),attitude:f.attitude?.toArray()||null,power:{...f.power},
    ...Object.fromEntries(fields.map(k=>[k,f[k]])),state:structuredClone(ship.state),rampCtl:structuredClone(ship.rampCtl),air:structuredClone(ship.air)};
}
export function playerPose(w,ship) {
  return {worldPos:{...w.worldPos},velocity:{...w.velocity},yaw:w.yaw,pitch:w.pitch,grounded:w.grounded,
    aboard:ship.aboard,sw:{x:ship.sw.x,y:ship.sw.y,z:ship.sw.z,yaw:ship.sw.yaw,pitch:ship.sw.pitch,velocity:{x:ship.sw.vx||0,y:ship.sw.vy||0,z:ship.sw.vz||0}},
    seat:ship.seat?.id||null,look:{...ship.look}};
}
export class GameBridge {
  constructor(world,{edits,digger,walker,ship,site}) {
    Object.assign(this,{world,edits,digger,walker,ship,site});this.crew=null;this.accum=0;
    this.restore();
    // Observe the existing public event drains; flight and weapons code stays untouched.
    for(const system of [ship.guns,ship.drones].filter(Boolean)) {
      const drain=system.drain.bind(system);
      system.drain=()=>{const events=drain();this.damageEvents(events);return events;};
    }
    world.capture=a=>this.capture(a);
    world.register('dig-edit',()=>digger.dig());
    world.register('spoil-pour',a=>digger.dump(!!a.all));
    world.register('tool-change',a=>{
      if(!Number.isSafeInteger(a.index))return {ok:false,msg:'Invalid tool.'};
      digger.setTool(a.index);return {ok:true,msg:digger.tool.name};
    });
    for(const type of ['purchase','sale','regolith-sale','quest-accept','quest-step'])world.register(type,a=>{
      if(type==='quest-step')a={...a,position:site.toLocal(walker.worldPos)};
      // Location and ownership are authority checks, not just hidden UI buttons.
      if(type==='regolith-sale' && (!this.nearWorker('depot-clerk')||ship.aboard))return {ok:false,msg:'Bring the load to the depot supply desk.'};
      if(type==='purchase'||type==='sale')if(!this.nearWorker(a.trader)||ship.aboard)return {ok:false,msg:'Talk to the trader in person.'};
      if(type==='quest-accept' && !this.nearWorker(QUESTS.find(q=>q.id===a.id)?.giver))return {ok:false,msg:'Talk to the quest giver in person.'};
      if(type==='quest-step' && (ship.aboard||Math.abs(site.toLocal(walker.worldPos).y)>2))return {ok:false,msg:'Stand in the amber weigh bay with the load.'};
      const next=reduceEconomy({...world.state.economy,cargo:structuredClone(digger.carried)},a);
      world.state.economy=next;digger.carried.splice(0,digger.carried.length,...structuredClone(next.cargo));
      return {ok:true,msg:type==='quest-step'?`Delivery accepted. ${QUESTS.find(q=>q.id===a.id).rewardMarks} marks paid.`:type==='regolith-sale'?'One tonne weighed. 12 marks paid.':'Done.'};
    });
    window.addEventListener('pagehide',()=>this.checkpoint());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.checkpoint();});
  }
  nearWorker(id) {
    const m=this.portPeople?.members.find(m=>m.id===id),p=this.site.toLocal(this.walker.worldPos);
    return !!m && Math.hypot(p.x-m.x,p.y-(m.y||0),p.z-m.z)<=3;
  }
  damageEvents(events) {
    for(const e of events) {
      if(e.type==='impact')this.world.dispatch({type:'damage',id:`ground:${[e.x,e.y,e.z].map(v=>Math.round(v*10)).join(',')}`,
        amount:Math.max(0,e.power||1),position:{x:e.x,y:e.y,z:e.z},up:{x:e.ux,y:e.uy,z:e.uz}});
      else if(e.type==='target_hit'||e.type==='ship_hit')this.world.dispatch({type:'damage',id:e.id||'meridian',amount:e.type==='ship_hit'?Math.max(0,e.hull||0):1});
    }
  }
  attachCrew(crew,portPeople) {
    this.crew=crew;this.portPeople=portPeople;crew.world=this.world;
    crew.restore(this.world.state.crew);
    this.world.register('hire',a=>crew.hire(a.id,true));
    this.world.register('fire',a=>crew.dismiss(a.id,true));
  }
  restore() {
    const s=this.world.state;let ship=s.ship,player=s.player;
    try {const p=this.world.remote?null:JSON.parse(localStorage.getItem(poseKey));if(p&&p.revision>=s.revision){ship=p.ship;player=p.player;}}catch{}
    if(ship) {
      const f=this.ship.flight;Object.assign(f.pos,ship.pos);Object.assign(f.vel,ship.vel);
      f.quaternion.fromArray(ship.quaternion);Object.assign(f.power,ship.power);
      f.attitude=ship.attitude?f.quaternion.clone().fromArray(ship.attitude):null;
      for(const k of fields)if(ship[k]!==undefined)f[k]=ship[k];
      // Keep nested references held by the existing ship controls/walkers.
      for(const [k,v] of Object.entries(ship.state||{}))Object.assign(this.ship.state[k],v);
      for(const [k,v] of Object.entries(ship.rampCtl||{}))Object.assign(this.ship.rampCtl[k],v);
      Object.assign(this.ship.air,ship.air);f.controls.fwd=0;f.controls.lift=0;f.controls.yaw=0;
      this.ship._syncEntries();
    }
    if(player) {
      Object.assign(this.walker.worldPos,player.worldPos);Object.assign(this.walker.velocity,player.velocity);
      Object.assign(this.walker,{yaw:player.yaw,pitch:player.pitch,grounded:player.grounded});this.walker.updateFrame();
      this.ship.aboard=player.aboard;
      if(player.aboard){this.ship.sw.place(player.sw.x,player.sw.y,player.sw.z,player.sw.yaw);this.ship.sw.pitch=player.sw.pitch||0;
        if(player.seat)this.ship.stations.sit(this.ship.stations.seatDef(player.seat));Object.assign(this.ship.look,player.look);}
    }
    this.digger.carried.splice(0,this.digger.carried.length,...structuredClone(s.economy.cargo));
    if(s.toolIdx!==undefined)this.digger.setTool(s.toolIdx);
  }
  capture(action) {
    const s=this.world.state;s.ship=shipPose(this.ship);s.player=playerPose(this.walker,this.ship);
    if(this.crew)s.crew=this.crew.snapshot();
    s.economy.cargo=structuredClone(this.digger.carried);s.toolIdx=this.digger.toolIdx;
    if(this.space)s.space=this.space.snapshotState();
    const bricks=[];
    if(action.type==='dig-edit'||action.type==='spoil-pour') {
      const store=this.digger.edits;
      if(store.body.id==='mars')s.terrain=structuredClone(terrainMeta(store));
      else{ s.moonTerrain=s.moonTerrain||{};s.moonTerrain[store.body.id]=structuredClone(terrainMeta(store)); }
      for(const key of store._dirty) {const b=store.bricks.get(key);if(b?.edited){const encoded=encodeBrick(store,b);
        if(store.body.id!=='mars'){encoded.key=store.body.id+':'+encoded.key;encoded.bodyId=store.body.id;}bricks.push(encoded);}}
    }
    return bricks;
  }
  checkpoint() {
    if(this.world.remote||this.world.error)return;
    this.world.dispatch({type:'player-pose',pose:playerPose(this.walker,this.ship)});
    // Synchronous pose breadcrumb for page refresh; cargo/economy/terrain remain in one IDB transaction.
    try {localStorage.setItem(poseKey,JSON.stringify({revision:this.world.state.revision,ship:this.world.state.ship,player:this.world.state.player}));}catch{}
  }
  tick(dt) {
    this.accum+=dt;if(this.accum<2)return;
    const seconds=this.accum;this.accum=0;
    this.world.dispatch({type:'ship-pose',pose:shipPose(this.ship)});
    this.world.dispatch({type:'wages',seconds});this.crew?.leaveIfUnpaid();
  }
  ledger() {
    let lots=this.digger.carried,e=this.world.state.economy;
    if(this.world.remote){const s=this.world.snapshot;
      lots=[...Object.values(s.players).flatMap(p=>p.carried),...Object.values(s.ships).flatMap(sh=>[...(sh.holdLots||[]),...sh.jobs.samples])];
      e={exportedMassExact:String(Object.values(s.ships).reduce((n,sh)=>n+BigInt(sh.economy.exportedMassExact),0n)),
        exportedVolumeExact:String(Object.values(s.ships).reduce((n,sh)=>n+BigInt(sh.economy.exportedVolumeExact),0n))};
      // Every body's material account contributes to the same world ledger.
      const accounts=Object.values(s.terrain);const removedM=accounts.reduce((n,a)=>n+BigInt(a.accounts[1]),0n),depositedM=accounts.reduce((n,a)=>n+BigInt(a.accounts[3]),0n),
        removedV=accounts.reduce((n,a)=>n+BigInt(a.accounts[0]),0n),depositedV=accounts.reduce((n,a)=>n+BigInt(a.accounts[2]),0n),scale=2**96;
      const exact=k=>lots.reduce((n,l)=>n+BigInt(l[k]*scale),0n);
      return {...this.edits.ledger(lots),unaccountedKg:Number(removedM-depositedM-exact('massKg')-BigInt(e.exportedMassExact))/scale,
        unaccountedM3:Number(removedV-depositedV-exact('solidVolumeM3')-BigInt(e.exportedVolumeExact))/scale};
    }
    const l=this.edits.ledger(lots);
    const mass=Number(BigInt(e.exportedMassExact))/(2**96),volume=Number(BigInt(e.exportedVolumeExact))/(2**96);
    // Account exports before converting to double, so cancellation stays exact.
    const scale=2**96,exact=(lots,k)=>lots.reduce((s,l)=>s+BigInt(l[k]*scale),0n);
    return {...l,exportedKg:mass,exportedM3:volume,
      unaccountedKg:Number(this.edits._removedM-this.edits._depositedM-exact(this.digger.carried,'massKg')-BigInt(e.exportedMassExact))/scale,
      unaccountedM3:Number(this.edits._removedV-this.edits._depositedV-exact(this.digger.carried,'solidVolumeM3')-BigInt(e.exportedVolumeExact))/scale};
  }
}
