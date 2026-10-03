import '../server/runtime.mjs';
import assert from 'node:assert/strict';
import { freshOpening, needsOpening, OpeningModel, OPENING_SECONDS, CONTACTS } from '../src/opening/state.js';
import { MemoryAdapter } from '../src/world-state/storage.js';
import { Authority } from '../server/authority.mjs';
import { attachEdits, attachGrades } from '../src/world/field.js';
import { shipDef } from '../src/ships/registry.js';
import { ShipWalker, shipIndexFor, defaultState } from '../src/ship/shipWalker.js';
import { planPath, routeToSeat } from '../src/crew/shipPath.js';
import { makeShipMaterials } from '../src/ship/shipTextures.js';
import { buildInterior, buildSeats } from '../src/ship/shipInterior.js';
import { passengerCabin, rescueRover, stormSky } from '../src/opening/art.js';
import { visualsFor } from '../src/ships/visuals.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';

export function aimOpening(model,x,z,y=.35){
  const w=model.walker,e=w.eyeWorldPos({}),p=model.toWorld(x,y,z),f=w.updateFrame();
  const d={x:p.x-e.x,y:p.y-e.y,z:p.z-e.z},l=Math.hypot(d.x,d.y,d.z);
  const dot=v=>d.x*v.x+d.y*v.y+d.z*v.z;
  w.yaw=Math.atan2(dot(f.east),dot(f.north));w.pitch=Math.asin(dot(f.up)/l);
  return model.pose();
}
export function clearOpening(model){
  const s=model.state;s.stage=2;s.pose={x:4,y:.03,z:18.5,yaw:0,pitch:-1};model.place(s.pose);
  let count=0;
  for(let round=0;round<7&&!model.exposed();round++)for(const [x,z] of [[4,20],[4.18,20],[3.82,20],[4,20.18],[4,19.82]]){
    s.pose=aimOpening(model,x,z);const r=model.act({type:'opening-dig'});if(r.ok)count++;
  }
  return count;
}
export async function runOpeningChecks({check,section}){
  section('30. The opening, scenes 1–6');
  attachEdits(null);attachGrades([]);
  assert.equal(needsOpening(null,null),true);assert.equal(needsOpening(null,{schema:1,player:{}}),false);
  assert.equal(needsOpening({...freshOpening(),complete:true},{}),false);
  assert.equal(needsOpening(freshOpening(),{}),true);
  check('the opening starts for new saves, resumes unfinished saves, and preserves returning saves',true);
  const a=new OpeningModel(freshOpening(0),'qa-a'),b=new OpeningModel(freshOpening(.99),'qa-b');
  assert.notEqual(a.body.id,b.body.id);assert.notEqual(a.state.contact,b.state.contact);assert.equal(CONTACTS.length,3);
  assert.throws(()=>a.act({type:'opening-skip'}));assert.throws(()=>a.act({type:'opening-finish'}));
  assert.throws(()=>a.act({type:'opening-next'}));
  check('scene 1 enforces first-play eligibility and sequence',true);
  for(let i=0;i<OPENING_SECONDS;i+=2)a.act({type:'opening-pose',pose:a.state.pose,seconds:2});
  a.act({type:'opening-next'});assert.equal(a.state.stage,1);assert.throws(()=>a.act({type:'opening-next'}));
  for(let z=6;z<=14;z+=2)a.act({type:'opening-pose',pose:{...a.state.pose,z},seconds:1});
  a.act({type:'opening-next'});assert.equal(a.state.stage,2);
  assert.throws(()=>a.act({type:'opening-carry'}));
  check('scenes 1–2 require normal progression and a reachable exit',true);
  const bites=clearOpening(a);assert.ok(bites>0);assert.ok(a.exposed());assert.equal(b.edits.isEmpty,true);
  assert.equal(b.state.cuts.length,0);assert.ok(a.digger.carriedMass()>0);
  const ledger=a.edits.ledger(a.digger.carried);assert.equal(ledger.unaccountedKg,0);assert.equal(ledger.unaccountedM3,0);
  check('scene 3 uses the real excavation and exact matter ledger while keeping each opening private',true);
  const restored=new OpeningModel(structuredClone(a.state),'qa-restored');assert.ok(restored.exposed());
  assert.deepEqual(restored.digger.carried,a.digger.carried);assert.equal(restored.edits.fieldDeltaM3(),a.edits.fieldDeltaM3());
  check('scene 3 restores the same material field and retained matter after refresh',true);
  a.act({type:'opening-carry'});assert.equal(a.state.carriedCrate,true);
  for(let x=2;x>=-7;x-=3)a.act({type:'opening-pose',pose:{...a.state.pose,x,z:23},seconds:1});
  assert.throws(()=>a.act({type:'opening-ride'}));
  for(let i=0;i<8;i+=2)a.act({type:'opening-pose',pose:a.state.pose,seconds:2});
  a.act({type:'opening-ride'});assert.throws(()=>a.act({type:'opening-finish'}));
  for(let i=0;i<66;i+=2)a.act({type:'opening-pose',pose:a.state.pose,seconds:2});
  a.act({type:'opening-finish'});assert.equal(a.state.complete,true);
  check('scenes 4–6 retain the carried object, wait for arrival, and finish once',true);
  const walk=new OpeningModel({...freshOpening(),stage:3,carriedCrate:true},'qa-walk');walk.act({type:'opening-walk'});
  assert.throws(()=>walk.act({type:'opening-finish'}));walk.state.pose={x:-2600,y:0,z:-350,yaw:0,pitch:0};
  walk.act({type:'opening-finish'});assert.equal(walk.state.complete,true);
  check('scenes 4–6 also allow walking to the shared port',true);
  const def=shipDef('courier'),sw=new ShipWalker(shipIndexFor(def),defaultState()),miss=[];
  sw.state.airlock.innerOpen=true;
  for(const r of def.layout.rooms){
    const targets=[];for(let x=r.x0+.45;x<r.x1-.3;x+=.4)for(let z=r.z0+.45;z<r.z1-.3;z+=.4)
      if(sw.canStand(x,r.y,z))targets.push({x,y:r.y,z});
    const cx=(r.x0+r.x1)/2,cz=(r.z0+r.z1)/2;targets.sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz));
    const path=targets[0]&&planPath(sw,{x:0,y:0,z:8},targets[0],{reach:.25});if(!path)miss.push(r.id);
  }
  assert.deepEqual(miss,[]);
  for(const seat of def.seats)assert.ok(routeToSeat(sw,{x:0,y:0,z:8},seat),seat.id);
  check('scene 6 has a distinct ship type with connected rooms and reachable working stations',true);
  const mats=makeShipMaterials({tier:'low'}),interior=buildInterior(def.layout,mats,{tier:'low'});buildSeats(def.layout,mats,interior);
  const ext=visualsFor('courier').buildExterior(def.layout,mats,{tier:'low'});visualsFor('courier').applyNeutralPose(ext);
  const cabin=passengerCabin(mats,true),rover=rescueRover(mats,true),sky=stormSky(true);
  assert.equal(ext.legs.length,4);assert.equal(ext.engines.length,2);assert.ok(ext.ramps.cargo&&ext.ramps.airlock);
  assert.equal(rover.wheels.length,6);assert.ok(cabin.triangles<50000&&rover.triangles<15000&&sky.triangles<1000);
  check('the opening uses bounded merged geometry on phone tier',true);
  let clock=Date.now();const adapter=new MemoryAdapter(),world=await new Authority(adapter,{now:()=>clock}).load();
  const one=await world.join('opening-one-'.repeat(4),'QA one','isaiah',1),two=await world.join('opening-two-'.repeat(4),'QA two','ada',1);
  const old=await world.join('opening-old-'.repeat(4),'QA returning');
  assert.equal(world.state.ships[one.shipId].type,'courier');assert.equal(world.state.ships[old.shipId].type,'meridian');
  assert.notEqual(one.shipId,two.shipId);assert.notDeepEqual(world.state.ships[one.shipId].pad,world.state.ships[two.shipId].pad);
  assert.equal(world.publicState(one.id).players[two.id].opening.cuts,undefined);
  assert.equal(world.publicState(one.id).players[one.id].opening.version,1);
  const denied=await world.action(one.id,'opening-early-action',{type:'hire',id:'candidate-1'});assert.equal(denied.ok,false);
  // Reacquire after the deliberate refused action's rollback.
  let p=world.state.players[one.id];p.opening.played=true;
  const money=world.state.ships[p.shipId].economy.marks,shipId=p.shipId;
  const done=await world.action(p.id,'opening-once-action',{type:'opening-skip'});assert.equal(done.ok,true,done.msg);
  const repeat=await world.action(p.id,'opening-once-action',{type:'opening-skip'});assert.equal(repeat.replay,true);
  assert.equal(world.state.receipts[p.id+':opening-once-action'].result.opening,undefined);
  assert.equal(repeat.opening.complete,true);
  assert.equal(world.state.ships[shipId].economy.marks,money);assert.equal(money,10000);
  const position=structuredClone(world.state.players[p.id].pose),rejoin=await world.join('opening-one-'.repeat(4),'QA one','isaiah',1);
  assert.equal(rejoin.shipId,shipId);assert.deepEqual(rejoin.pose,position);assert.ok(rejoin.opening.complete);
  assert.equal(world.state.players[two.id].opening.complete,false);assert.equal(world.state.players[old.id].opening,undefined);
  const existing=await world.join('opening-old-'.repeat(4),'QA returning','isaiah',1);assert.equal(existing.opening,undefined);
  const later=world.site.toWorld(-22,.02,40);world.state.players[p.id].pose.worldPos=later;
  const late=await world.action(p.id,'opening-late-action',{type:'opening-skip'});assert.equal(late.ok,true);
  assert.deepEqual(world.state.players[p.id].pose.worldPos,later);
  assert.equal(world.openingModels.has(p.id),false);
  const privatePose=structuredClone(world.state.players[two.id].pose);
  world.updatePose(world.state.players[two.id],{pose:{...privatePose,worldPos:world.site.toWorld(-20,.02,40)}});
  assert.deepEqual(world.state.players[two.id].pose,privatePose);
  // PLAYFIX: the ride and any refusal recover (10/3: a phone looped "Walk to that place" / "Reach the port first" for five minutes on a black screen).
  {const three=await world.join('opening-three-'.repeat(4),'QA three','zuri',1),q=world.state.players[three.id];q.opening.played=true;q.opening.stage=3;q.opening.contactSeconds=9;q.opening.pose={x:-7,y:.02,z:23,yaw:0,pitch:0};
    clock+=1000;let r=await world.action(q.id,'pf-ride-act',{type:'opening-ride'});assert.equal(r.ok,true,r.msg);
    // a client that stalled 20 s and then reports a pose 2.5 km ahead is not refused and does not wedge the ride
    clock+=20000;r=await world.action(q.id,'pf-pose-far-act',{type:'opening-pose',pose:{x:-2600,y:2,z:-350,yaw:1,pitch:0},seconds:2});assert.equal(r.ok,true,r.msg);
    assert.ok(world.state.players[q.id].opening.rideSeconds>=19,'the ride is credited the server clock');
    // finishing early is refused with a readable reason, and the same call succeeds once the real time has passed (no client pose needed)
    r=await world.action(q.id,'pf-fin-early-act',{type:'opening-finish'});assert.equal(r.ok,false);
    clock+=50000;r=await world.action(q.id,'pf-fin-act',{type:'opening-finish'});assert.equal(r.ok,true,r.msg);assert.ok(r.opening.complete);}
  {const m=new OpeningModel(freshOpening(0),'pf-walk');m.state.stage=2;
    const far=m.act({type:'opening-pose',pose:{x:400,y:.02,z:15,yaw:0,pitch:0},seconds:1});
    assert.equal(far.ok,true);assert.equal(far.corrected,true);assert.ok(far.pose.x<=11.01,'a teleporting pose is pulled back, not refused');
    assert.ok(m.act({type:'opening-pose',pose:{x:far.pose.x+5,y:.02,z:15,yaw:0,pitch:0},seconds:1}).ok);}
  {const w2=await new Authority(new MemoryAdapter(),{now:()=>clock}).load();await w2.join('reset-a-'.repeat(5),'R one','isaiah',1);await w2.join('reset-b-'.repeat(5),'R two','ada',0);
    const raiders=Object.values(w2.state.ships).filter(x=>x.npc).length,r=w2.resetWorld();
    assert.equal(r.players,2);assert.equal(Object.keys(w2.state.players).length,0);assert.equal(Object.values(w2.state.ships).filter(x=>!x.npc).length,0);
    assert.equal(Object.values(w2.state.ships).filter(x=>x.npc).length,raiders);assert.equal(w2.state.pads.length,0);assert.deepEqual(w2.state.receipts,{});
    await w2.commit();const again=await w2.join('reset-a-'.repeat(5),'R one','isaiah',1);assert.equal(again.opening.complete,false);}
  check('reset world removes players, ships, pads, receipts and keeps the raiders; a returning device starts a new opening',true);
  check('the opening ride runs on the server clock; a stalled or teleporting client is pulled back, never refused in a loop; skip ends the same as finishing',true);
  const restarted=await new Authority(adapter,{now:()=>clock}).load();assert.ok(restarted.state.players[p.id].opening.complete);
  assert.equal(restarted.state.players[two.id].opening.complete,false);
  check('the authority isolates new openings, preserves existing identities, and records one settlement through retry and restart',true);
  attachEdits(null);attachGrades([]);
}

export async function runOpeningBrowserChecks({check,section}){
  section('31. The opening: desktop, phone and restoration');let output='';
  const status=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[fileURLToPath(new URL('./opening-browser.mjs',import.meta.url))],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});
    child.stdout.on('data',b=>{output+=b;process.stdout.write(b);});child.stderr.on('data',b=>{output+=b;process.stderr.write(b);});child.on('error',reject);child.on('close',resolve);
  });
  await writeFile(new URL('../docs/qa/2026-10-02/opening/browser-log.txt',import.meta.url),output);
  check('the opening browser walkthrough completes',status===0,`exit ${status}`);if(status!==0)return;
  const {results:r,errors}=JSON.parse(await readFile(new URL('../docs/qa/2026-10-02/opening/browser-results.json',import.meta.url)));
  check('scenes 1–6 run through normal actions with a private second client',r.multiplayer.privateProgress&&r.multiplayer.ownShip&&r.multiplayer.marks===10000);
  check('the opening pauses visibly on socket loss and reconnects with the same identity',r.reconnect.paused&&r.reconnect.visible&&r.reconnect.identity);
  check('scene 3 restores progress and pose, and completed saves return directly to shared play',r.refresh.stage===2&&r.refresh.exposed&&r.refresh.distance<.01&&r.returningSave);
  check('phone touch movement, look and action controls complete the opening under 4x CPU emulation',r.phone.complete&&r.phone.touchLook&&r.phone.actorsLoaded&&r.phone.failures===0);
  check('phone safe mode resumes the opening and renders a real frame',r.safe.active&&r.safe.stage===2&&r.safe.calls>0&&r.safe.failures===0);
  check('scene 6 rooms are walked with the real collider and no route snaps',r.rooms.length===7&&r.rooms.every(q=>q.walked&&q.snaps===0));
  check('opening browser QA has no page errors or failed game asset requests',errors.length===0);
}
