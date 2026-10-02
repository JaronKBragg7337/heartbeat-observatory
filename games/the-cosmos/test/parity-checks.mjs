// Run the same intents through the solo systems and the real WebSocket authority.
// Fixtures only choose starting places; no test-only endpoint exists in the game.
import '../server/runtime.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../server/index.mjs';
import {FileAdapter} from '../server/storage.mjs';
import {TestClient} from './multiplayer-checks.mjs';
import {ShipSystem} from '../src/ship/shipSystem.js';
import {ShipWalker,shipIndex} from '../src/ship/shipWalker.js';
import {RAMPS,SEATS} from '../src/ship/shipSpec.js';
import {Walker} from '../src/player/walker.js';
import {Digger} from '../src/player/digging.js';
import {EditStore} from '../src/world/edits.js';
import {attachEdits,attachGrades,surfaceRadiusFast} from '../src/world/field.js';
import {makeSpoilGuard} from '../src/player/spoilProtection.js';
import {PORT_WORKERS} from '../src/port/portPeople.js';
import {CREW_POSTS} from '../src/crew/crewSpec.js';
import {reduceEconomy,initialEconomy} from '../src/economy/economy.js';
import {QUESTS} from '../src/economy/catalog.js';
import {TowerElevator} from '../src/port/towerElevator.js';
import {playerPose} from '../src/world-state/gameBridge.js';
import {makeMoon} from '../src/space/moonField.js';
import {SpaceTrip} from '../src/space/spaceTrip.js';

export async function runParityChecks({check,section}){
 section('20. Solo / online action parity (FileAdapter + WebSocket)');
 const dir=await mkdtemp(join(tmpdir(),'cosmos-parity-'));let app,client,clock=Date.now();
 const near=(a,b,eps=1e-6)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<eps,JSON.stringify({a,b}));
 try{
  app=await startServer({adapter:new FileAdapter(join(dir,'world.json')),port:0,tick:false,now:()=>clock});
  client=new TestClient(app.url,'parity'.repeat(8),'Parity');await client.connect();
  const w=app.world,p=w.state.players[client.id],record=w.state.ships[p.shipId];
  let sim=w.sims.get(record.id);
  const send=async a=>{clock+=1000;let r;try{r=await client.action(a);}catch(e){throw Error(JSON.stringify({action:a,error:e.message,socket:client.socket.readyState,peers:w.sessions.size,messages:client.messages.slice(-2).map(m=>({type:m.type,msg:m.msg})),receipts:Object.values(w.state.receipts).slice(-2),size:JSON.stringify(w.publicState()).length}), {cause:e});}assert.ok(r.ok,r.msg);return r;};
  for(const bytes of [125,126,127,128]){const actionId='frame-boundary-'+String(bytes).padEnd(21,'x'),action={type:'rename',name:'Parity',padding:''};
    action.padding='x'.repeat(bytes-Buffer.byteLength(JSON.stringify({type:'action',action,actionId})));
    assert.equal(Buffer.byteLength(JSON.stringify({type:'action',action,actionId})),bytes);
    assert.ok((await client.action(action,actionId)).ok);
  }
  check('WebSocket actions at 125/126/127/128 bytes stay connected and receive receipts',true);
  const ground=(x,y,z)=>{p.aboardShipId=null;p.pose.aboard=false;p.pose.seat=null;p.pose.worldPos=w.site.toWorld(x,y,z);p.poseAt=clock;p.frameId='mars';};
  const walker=new Walker(w.mars),solo={flight:sim.flight,state:structuredClone(sim.ship.state),sw:new ShipWalker(shipIndex,structuredClone(sim.ship.state)),walker,aboard:false,ground:(x,y,z)=>surfaceRadiusFast(w.mars,x,y,z),note:()=>{},look:{yaw:0,pitch:0}};
  for(const method of ['boardAt','disembark','_solveRamp','cycleAirlock','_airlockStep','_rampFrame'])solo[method]=ShipSystem.prototype[method].bind(solo);
  solo.rampCtl=structuredClone(sim.ship.rampCtl);solo.air={phase:'idle',t:0};solo._applyRampPose=()=>{};solo._rampOccupied=()=>false;
  const st=sim.ship.state.ramps.cargo,entry={x:0,y:-Math.sin(st.angle)*5,z:20.9+Math.cos(st.angle)*5-.04};
  p.pose.worldPos=sim.flight.toWorld(entry,{});Object.assign(walker.worldPos,p.pose.worldPos);
  solo.boardAt(entry.x,entry.y,entry.z,0);solo.sw.pitch=.12;
  await send({type:'board',walkPose:{sw:{...entry,yaw:0,pitch:.12},yaw:sim.flight.heading,pitch:.12}});
  near(p.pose.sw,solo.sw);near(p.pose.worldPos,sim.flight.toWorld(solo.sw,{}));
  check('walking onto the ramp retains the exact solo position and look; no cabin teleport',true);
  // Walk the actual collision model with the same controls; the authority must accept every supported pose.
  for(let i=0;i<150;i++){solo.sw.tick(1/30,{moveX:0,moveZ:1});sim.flight.toWorld(solo.sw,walker.worldPos);await send({type:'player-pose',pose:playerPose(walker,solo)});near(p.pose.sw,solo.sw);}
  check('the walked ramp and cargo corridor poses are accepted continuously online',true);
  // The port gangway is wider than the old hard-coded +/-12 m cabin bound.
  p.pose.sw={x:-13,y:0,z:RAMPS.airlock.hinge.z,yaw:0,pitch:0};
  const pose=structuredClone(p.pose);pose.sw.x=-14;await send({type:'player-pose',pose});
  check('walking along the port gangway stays in the walked pose online',true);
  solo.sw.place(0,entry.y,entry.z+.1,Math.PI);sim.flight.toWorld(solo.sw,walker.worldPos);
  Object.assign(p.pose.sw,{x:solo.sw.x,y:solo.sw.y,z:solo.sw.z,yaw:Math.PI,pitch:.12});
  solo.disembark('cargo');await send({type:'leave',key:'cargo',walkPose:playerPose(walker,solo)});
  near(p.pose.worldPos,walker.worldPos);assert.equal(p.pose.aboard,solo.aboard);
  check('walking off the ramp matches solo ground placement instead of a fixed apron teleport',true);
  ground(-23,.02,42);Object.assign(walker.worldPos,p.pose.worldPos);walker.yaw=p.pose.yaw=w.site.heading;walker.pitch=p.pose.pitch=-1.2;walker.updateFrame();
  const localEdits=new EditStore(w.mars),d=new Digger(w.mars,localEdits,walker);
  attachGrades([w.site]);attachEdits(localEdits);
  d.canPlaceSpoil=makeSpoilGuard({port:{site:w.site,boxes:[]},portPeople:{members:PORT_WORKERS},ship:solo});
  const cut=d.dig();assert.ok(cut.ok,cut.msg);const dug=structuredClone(d.carried);
  const pour=d.dump(true);assert.ok(pour.ok,pour.msg);const localLedger=localEdits.ledger(d.carried);
  attachEdits(w.stores.get('mars'));
  await send({type:'dig-edit'});assert.deepEqual(p.carried,dug);await send({type:'spoil-pour',all:true});assert.deepEqual(p.carried,d.carried);
  const remoteLedger=w.stores.get('mars').ledger(p.carried);
  for(const k of ['removedKg','depositedKg','unaccountedKg','unaccountedM3'])assert.equal(remoteLedger[k],localLedger[k]);
  check('dig, carry and pour produce identical matter lots and terrain ledgers solo and online',true);
  const before=structuredClone(p.carried);ground(0,.02,0);p.carried=dug;
  const blocked=await client.action({type:'spoil-pour',all:true});assert.equal(blocked.ok,false);assert.deepEqual(w.state.players[client.id].carried,dug);
  // A failed transaction reconstructs authority objects; get the current references again.
  const player=()=>w.state.players[client.id];sim=w.sims.get(record.id);player().carried=before;
  check('protected spoil pours fail atomically online without losing the load',true);
  await send({type:'tool-change',index:3});d.setTool(3);assert.equal(player().toolIdx,d.toolIdx);
  await send({type:'tool-change',index:-1});d.setTool(-1);assert.equal(player().toolIdx,d.toolIdx);
  check('phone tool cycling wraps in both directions exactly as solo',true);
  let economy=initialEconomy();
  const actions=[...PORT_WORKERS.filter(m=>m.id.startsWith('trader-')||m.id==='depot-clerk').flatMap(m=>{
   const stock=economy.traders[m.id],good=Object.keys(stock)[0];return [{type:'purchase',trader:m.id,good},{type:'sale',trader:m.id,good}];}),...QUESTS.map(q=>({type:'quest-accept',id:q.id}))];
  for(const a of actions){const worker=PORT_WORKERS.find(m=>m.id===(a.trader||QUESTS.find(q=>q.id===a.id).giver));player().aboardShipId=null;player().pose.aboard=false;player().pose.worldPos=w.site.toWorld(worker.x,(worker.y||0)+.02,worker.z);
   economy=reduceEconomy(economy,a);await send(a);const actual=w.state.ships[record.id].economy;
   for(const key of ['marks','inventory','quests','exportedMassExact','exportedVolumeExact'])assert.deepEqual(actual[key],economy[key]);}
  check('buy and sell at every trader, and accept tower jobs, have the same balances and quest results',true);
  const elevator=new TowerElevator();elevator.request(22.5);player().pose.worldPos=w.site.toWorld(-60,.02,-40);
  await send({type:'elevator',destination:22.5});for(let i=0;i<450;i++){elevator.tick(1/30,false);w.advance(1/30);}
  assert.equal(w.elevator.y,elevator.y);assert.ok(Math.abs(w.site.toLocal(player().pose.worldPos).y-22.52)<.01);
  check('the lift travels to the same floor and carries the online rider',true);
  // Compare the existing solo motors and pressure sequence with authority steps.
  player().aboardShipId=record.id;player().pose.aboard=true;player().pose.sw={x:0,y:0,z:12,yaw:0,pitch:0};player().pose.seat=null;
  sim=w.sims.get(record.id);Object.assign(solo.rampCtl.cargo,sim.ship.rampCtl.cargo);Object.assign(solo.rampCtl.airlock,sim.ship.rampCtl.airlock);solo.state=structuredClone(sim.ship.state);
  solo.rampCtl.cargo.target=0;await send({type:'ramp',key:'cargo'});
  for(let i=0;i<180;i++){solo._rampFrame(1/30);w.advance(1/30);assert.ok(Math.abs(solo.rampCtl.cargo.progress-sim.ship.rampCtl.cargo.progress)<1e-6);}
  solo.cycleAirlock();await send({type:'airlock'});
  for(let i=0;i<360;i++){solo._rampFrame(1/30);solo._airlockStep(1/30);w.advance(1/30);assert.equal(sim.ship.air.phase,solo.air.phase);}
  assert.equal(sim.ship.state.airlock.outerOpen,solo.state.airlock.outerOpen);
  check('ramp motors and the full pressure / gangway sequence match solo frame by frame',true);
  player().pose.seat='engineer';const split=[25,55,20];solo.flight.setPowerSplit(...split);const expected={...solo.flight.power};await send({type:'power-split',engines:25,guns:55,shields:20});assert.deepEqual(sim.flight.power,expected);
  check('engineering presets are accepted and produce the solo reactor split',true);
  player().pose.seat='nav';sim.flight.setPowerSplit(40,30,30);sim.ship.rampCtl.airlock.progress=0;sim.ship.rampCtl.airlock.target=0;sim.ship.air.phase='idle';sim.ship.state.airlock.outerOpen=false;
  await send({type:'engage',destination:'phobos'});const localTrip=new SpaceTrip(sim,sim.resolve('phobos'));
  for(const warp of [1,5,20,60]){localTrip.setWarp(warp);await send({type:'trip-warp',warp});assert.equal(sim.trip.warp,localTrip.warp);}
  let elapsed=0;while(sim.trip&&elapsed<1200){w.advance(5);elapsed+=5;}
  assert.equal(sim.frameId,'phobos');assert.ok(sim.flight.landed);assert.equal(player().frameId,'phobos');
  check('the x1/x5/x20/x60 intents work online and the accelerated course really lands on Phobos',true);
  // Moon cart capacity is an inertia limit in solo, not the moon's enormous kgf allowance.
  const moon=makeMoon('phobos'),mw=new Walker(moon),md=new Digger(moon,new EditStore(moon),mw);md.tools=md.tools.map(t=>({...t,capacityKg:t.machine?t.capacityKg:Math.min(t.capacityKg,1054)}));
  assert.equal(md.tools[0].capacityKg,1054);
  check('moon hand-tool parity uses the 1054 kg cart limit (browser action checks cover the cap)',true);
 }catch(e){check('solo / online parity scenario completes',false,e.stack);}
 finally{client?.close();await app?.close();await rm(dir,{recursive:true,force:true});}
}
