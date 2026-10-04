import '../server/runtime.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Opening } from '../src/opening/opening.js';
import { freshOpening } from '../src/opening/state.js';
import { readOpeningCheckpoint,writeOpeningCheckpoint } from '../src/opening/checkpoint.js';
import { openingRideVehicle,ridePose } from '../src/opening/rideVehicle.js';
import { PeopleLibrary } from '../src/crew/personRig.js';
import { CrewSystem } from '../src/crew/crewSystem.js';
import { shipPresence } from '../src/world-state/shipPresence.js';
import { SpaceTrip } from '../src/space/spaceTrip.js';
import { Authority } from '../server/authority.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir,writeFile,readFile } from 'node:fs/promises';

export async function runOpeningBugChecks({check,section}) {
  section('32. Opening bug regressions');
  let release,count=0;
  const opening=Object.assign(Object.create(Opening.prototype),{active:true,pending:new Promise(r=>release=r),
    _interact:async()=>{count++;}});
  const tap=opening.interact();opening.interact();assert.equal(count,0);release();await tap;assert.equal(count,1);
  check('an opening tap waits for a background save and runs once',true);
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  for(const stage of [0,1,2,3,4,5,6,7]){const s={...freshOpening(),stage,elapsed:21,rideSeconds:13,complete:stage===7};
    writeOpeningCheckpoint({},s,storage);assert.deepEqual(readOpeningCheckpoint(storage),s);}
  const before=readOpeningCheckpoint(storage);writeOpeningCheckpoint({remote:true},freshOpening(),storage);
  assert.deepEqual(readOpeningCheckpoint(storage),before);
  check('solo checkpoints retain every opening step and never replace shared saves',true);
  const library=new PeopleLibrary();library.glb=()=>Promise.reject(Error('injected missing GLB'));
  const person=library.spawn('ada');await person.ready;assert.ok(person.loaded&&person.safe&&person.group.children.length);
  person.play('Walk');person.update(.2,1);person.dress({cloth:0xabcdef});
  const root=new THREE.Group();root.add(person.group);let position={x:0,y:0,z:0};
  const member={person},crew={members:new Map([['ada',member]]),worldPosOf:()=>position};
  assert.equal(CrewSystem.prototype.nearest.call(crew,position),member);root.visible=false;
  assert.equal(CrewSystem.prototype.nearest.call(crew,position),null);root.visible=true;position={x:20,y:0,z:0};
  assert.equal(CrewSystem.prototype.nearest.call(crew,{x:0,y:0,z:0}),null);
  check('failed GLBs retain a visible animated person; hidden or departed people cannot leave a Talk prompt',true);
  const snapshot={players:{one:{online:false},two:{online:true,aboardShipId:'ship'}}},ship={id:'ship',owner:'one',pose:{landed:false}};
  assert.equal(shipPresence(ship,snapshot),'connected');snapshot.players.two.online=false;
  assert.equal(shipPresence(ship,snapshot),null);ship.pose.landed=true;assert.equal(shipPresence(ship,snapshot),'parked');
  snapshot.players.one.opening={complete:false};assert.equal(shipPresence(ship,snapshot),null);
  assert.equal(shipPresence({...ship,npc:{}},snapshot),'npc');
  check('ship presence hides disconnected flying hulls and unfinished opening ships, and identifies parked owned hulls',true);
  const vehicle=openingRideVehicle({root:new THREE.Group(),wheels:[]});assert.equal(vehicle.passengerEye.y,1.85);
  assert.deepEqual(ridePose(65,()=>0),{x:-2600,y:0,z:-350,yaw:Math.atan2(2593,373)});
  let max=0;for(let t=0;t<65;t++){const a=ridePose(t,()=>0),b=ridePose(t+1,()=>0);max=Math.max(max,Math.hypot(a.x-b.x,a.z-b.z));}
  assert.ok(max<75);check('the passenger adapter supplies a seat and a continuous route to the port within the authority speed limit',true);
  let course;
  const mock={flyer:()=>({name:'Pilot',def:{skill:1}}),_ensureAP(){this.ap={};},ship:{aboard:true,flight:{pos:{x:0,y:0,z:0}},
    space:{frameId:'phobos',engage:(id,o)=>{course={id,o};return {ok:true};}}}};
  assert.ok(CrewSystem.prototype.order.call(mock,'return').ok);assert.equal(course.id,'port');assert.equal(course.o.by,'Pilot');
  check('Return home from a moon uses the normal port course with landing compression',true);
  const world=await new Authority(new MemoryAdapter()).load(),p=await world.join('bug-landing-'.repeat(4),'QA');
  const sim=world.sims.get(p.shipId),f=sim.flight,trip=new SpaceTrip(sim,sim.resolve('port'));
  trip.phase='descent';trip.setWarp(60);f.agl=20000;assert.ok(trip.stickWarp(1/60)>1);
  f.agl=200;assert.equal(trip.stickWarp(1/60),1);
  sim.crew._ensureAP();sim.crew.ap.setOrder({type:'return'});p.aboardShipId=p.shipId;
  const speed=await world.action(p.id,'qa-return-speed',{type:'trip-warp',warp:60});assert.ok(speed.ok,speed.msg);assert.equal(sim.warp,60);
  const health=await readFile(new URL('../build.json',import.meta.url),'utf8');assert.ok(JSON.parse(health).id);
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const imports=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  assert.ok(Object.entries(imports).every(([,v])=>v.includes('?v='+JSON.parse(health).id)));
  check('space and local pilot returns accept compression, preserve the touchdown cap, and every module uses one build version',true);
}
export async function runOpeningBugsBrowserChecks({check,section}) {
  section('33. Opening bug touch walkthrough at 390 × 844');
  const out=new URL('../docs/qa/2026-10-02/opening-bugs/',import.meta.url);await mkdir(out,{recursive:true});let log='';
  const status=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[fileURLToPath(new URL('./opening-bugs-browser.mjs',import.meta.url))],
    {env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{log+=b;process.stdout.write(b);});child.on('error',reject);child.on('close',resolve);});
  await writeFile(new URL('browser-log.txt',out),log);check('touch opening regressions and screenshots complete',status===0,'exit '+status);
  if(status===0){const r=JSON.parse(await readFile(new URL('browser-results.json',out)));
    check('refreshes, multi-touch taps, passenger ride, NPC prompts, stale-build reload and compressed return pass',r.passed&&r.errors.length===0);}
}
