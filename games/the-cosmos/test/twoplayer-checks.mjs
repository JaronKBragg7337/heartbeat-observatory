import assert from 'node:assert/strict';
import { MotionBuffer, reconcile } from '../src/world-state/motionBuffer.js';
import { hullPush, mayBoard } from '../src/ship/hullCollision.js';
import { shipDef } from '../src/ships/registry.js';
import { ShipWalker, shipIndexFor, defaultState } from '../src/ship/shipWalker.js';
import { blankFrame, GraphicsHealth } from '../src/core/graphicsHealth.js';
import { graphicsDiagnostic } from '../server/clientErrors.mjs';
import { CoverGrid } from '../src/world/excavation.js';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Authority } from '../server/authority.mjs';
import { rampEntry } from '../src/ship/rampTransfer.js';
import * as THREE from 'three';
import { safeMaterials } from '../src/core/safeMaterials.js';

// Run the actual renderer/socket checks in their own process. Prior validation
// sections mutate the terrain field; browser QA needs an isolated authority.
export async function runTwoPlayerBrowserChecks({check,section}) {
  section('28. Two Chromium clients and Android graphics recovery');
  const log=new URL('../docs/qa/2026-10-02/twoplayer/browser-run.txt',import.meta.url);
  const resultFile=new URL('../docs/qa/2026-10-02/twoplayer/browser-results.json',import.meta.url);
  let output='';
  const status=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(new URL('./twoplayer-browser.mjs',import.meta.url))],{
      cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,COSMOS_QA_MOVEMENT_ONLY:'0'},stdio:['ignore','pipe','pipe'],windowsHide:true,
    });
    child.stdout.on('data',b=>{output+=b;process.stdout.write(b);});
    child.stderr.on('data',b=>{output+=b;process.stderr.write(b);});
    child.on('error',reject);child.on('close',resolve);
  });
  await writeFile(log,output,'utf8');
  check('two-player browser scenario completes',status===0,`exit ${status}`);
  if(status!==0)return;
  const {results:r,errors}=JSON.parse(await readFile(resultFile,'utf8'));
  check('actual remote hull contact, denied boarding and permitted ramp/cargo walking',r.remoteHullCollision&&r.closedBoarding&&r.guestRampAndInterior.end<r.guestRampAndInterior.start-2);
  check('deliberate body restore consumes the acknowledged pose only once',r.restoreConsumesAck);
  check('visible transforms under 80-200 ms socket jitter stay within measured RMS budgets',r.networkJitter.samples>50&&r.networkJitter.playerRms<.5&&r.networkJitter.shipRms<2.5,JSON.stringify(r.networkJitter));
  check('clear frames, actual context loss and failed shader compile recover into safe mode',r.clearFrameFallback&&r.contextLossFallback&&r.shaderFallback);
  check('synthetic GPU memory status displays the reason and recovers into safe mode',r.syntheticMemoryFallback);
  check('all four recovered phone worlds draw pixels, retain identity and disable local lights',r.recoveredFrames.length===4&&r.recoveredFrames.every(m=>m.safe&&m.nonClearFrame&&m.failures===0&&m.calls>0&&m.activeLocalLights===0&&m.playerId===r.recoveredFrames[0].playerId));
  check('a further failure inside safe mode stays visible without a reload loop',r.safeFailureDoesNotLoop);
  const safe=r.graphicsMatrix.find(m=>m.query==='tier=safe');
  check('phone safe mode renders with WebGL1, no log depth and a 2 km far plane',safe&&!safe.webgl2&&!safe.logdepth&&!safe.shadows&&safe.far===2000&&safe.calls>0&&safe.nonClearFrame&&safe.failures===0);
  check('individual log-depth, environment, shadow and far-plane suspect probes draw real frames',r.graphicsMatrix.length===9&&r.graphicsMatrix.every(m=>m.nonClearFrame&&m.failures===0));
  check('graphics reasons reach the authority and the browser has no page errors',r.diagnostics.length>=3&&errors.length===0);
}
export function jitterMetrics(speed) {
  const buffer=new MotionBuffer(),packets=[];
  for(let t=0;t<6000;t+=100){let arrival=t+80+((t/100*37)%121);if(t%700===0)arrival=Math.ceil(arrival/200)*200;
    packets.push({t,arrival});}
  packets.sort((a,b)=>a.arrival-b.arrival);
  const errors=[],steps=[];let last=null,i=0;
  for(let now=0;now<5900;now+=1000/60){while(packets[i]?.arrival<=now){const p=packets[i++];buffer.push('body',p.t,p.arrival,{pos:{x:p.t/1000*speed,y:0,z:0},vel:{x:speed,y:0,z:0}},'mars');}
    const pose=buffer.render('body',now);if(!pose||now<600)continue;
    const ideal=Math.max(0,now-buffer.offset-buffer.delay)/1000*speed;
    errors.push(Math.abs(pose.pos.x-ideal));if(last!==null)steps.push(Math.abs(pose.pos.x-last));last=pose.pos.x;}
  return {rms:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length),max:Math.max(...errors),maxStep:Math.max(...steps)};
}
export async function runTwoPlayerChecks({check,section}) {
  section('27. Shared hulls, jitter buffer, local reconciliation and graphics health');
  for(const type of ['meridian','raider']){
    const def=shipDef(type),state=defaultState(),P=def.hull.push;
    const loc={x:P.hwAt(0)-.1,y:def.gear.keelY+.1,z:0};
    assert.ok(hullPush(def,state,loc));
    const walker=new ShipWalker(shipIndexFor(def),state),room=def.layout.rooms.find(r=>r.id===def.roles.cargo)||def.layout.rooms[0];
    assert.ok(walker.index.zones.some(z=>z.id===room.id));
    state.ramps.cargo.lowered=true;const gap={x:0,y:def.ramps.cargo.hinge.y,z:Math.min(P.zTail-.1,P.rampGap.z+.3)};
    assert.equal(hullPush(def,state,gap,true),null);assert.ok(hullPush(def,state,gap,false));
    check(`${type}: remote hull blocks a capsule; permission gates its shared ramp/interior geometry`,true);
  }
  assert.equal(mayBoard({owner:'A',crewMayBoard:false},'B'),false);
  assert.equal(mayBoard({npc:{state:'abandoned'}},'B'),true);assert.equal(mayBoard({npc:{state:'patrol'}},'B'),false);
  check('owners, permitted guests, disabled and abandoned ships have explicit boarding rules',true);
  const authority=await new Authority({load:async()=>({record:null,bricks:[]}),save:async()=>{}}).load();
  let guest=await authority.join('qa-guest'.repeat(8),'QA guest'),npc=Object.values(authority.state.ships).find(s=>s.npc&&s.type==='raider');
  let sim=authority.sims.get(npc.id);sim.flight.landed=true;
  const rp=sim.def.ramps.cargo,run=rp.length*Math.cos(sim.ship.state.ramps.cargo.angle)-.03;
  sim.ship.state.ramps.cargo.lowered=true;
  const tip={x:rp.hinge.x+rp.dir.x*run,y:rp.hinge.y-run*Math.tan(sim.ship.state.ramps.cargo.angle),z:rp.hinge.z+rp.dir.z*run};
  const entry=rampEntry('cargo',sim.ship.state.ramps.cargo,tip,{x:-rp.dir.x,z:-rp.dir.z},sim.def.ramps);
  assert.ok(entry);guest.frameId=sim.frameId;guest.pose.worldPos=sim.flight.toWorld(tip,{});
  npc.npc.state='patrol';sim.capture();
  const intent={type:'board',shipId:npc.id,walkPose:{sw:{...entry,yaw:0,pitch:0},yaw:0,pitch:0}};
  assert.equal((await authority.action(guest.id,'qa-hostile-board',intent)).ok,false);
  guest=authority.state.players[guest.id];npc=authority.state.ships[npc.id];sim=authority.sims.get(npc.id);
  for(const state of ['disabled','abandoned']){npc.npc.state=state;guest.aboardShipId=null;guest.pose.aboard=false;guest.pose.worldPos=sim.flight.toWorld(tip,{});
    const receipt=await authority.action(guest.id,'qa-'+state+'-board',intent);assert.equal(receipt.ok,true,receipt.msg);assert.equal(guest.aboardShipId,npc.id);
    const walker=new ShipWalker(shipIndexFor(sim.def),sim.ship.state);walker.place(entry.x,entry.y,entry.z);for(let i=0;i<150;i++)walker.tick(1/60,{moveZ:1});assert.ok(walker.z<entry.z-2);}
  check('authority denies hostile raiders and admits guests onto disabled/abandoned ramps and cargo floors',true);
  for(const [kind,speed,budget] of [['player',4,.15],['ship',50,1.5]]){const m=jitterMetrics(speed);check(`${kind}: 80–200 ms jitter and packet bunching RMS error < ${budget} m`,m.rms<budget,JSON.stringify(m));
    check(`${kind}: packet bunching cannot produce an unbounded visible position step`,m.maxStep<=Math.max(.08,speed/60*1.5)+1e-6,JSON.stringify(m));}
  const turn=new MotionBuffer();turn.push('ship',0,80,{pos:{x:0,y:0,z:0},vel:{x:0,y:0,z:0},quaternion:[0,0,0,1],yaw:Math.PI-.1},'mars');
  turn.push('ship',100,180,{pos:{x:0,y:0,z:0},vel:{x:0,y:0,z:0},quaternion:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2).toArray(),yaw:-Math.PI+.1},'mars');
  const halfway=turn.sample('ship',230),facing=new THREE.Vector3(0,0,1).applyQuaternion(new THREE.Quaternion().fromArray(halfway.quaternion));
  check('ship turns slerp halfway and player yaw crosses the wrap without a full spin',Math.abs(facing.x-Math.SQRT1_2)<1e-6&&Math.abs(halfway.yaw-Math.PI)<1e-6);
  const b=new MotionBuffer();b.push('p',0,80,{pos:{x:0,y:0,z:0},vel:{x:4,y:0,z:0}},'mars');assert.equal(b.sample('p',5000).pos.x,.6);
  b.push('p',100,180,{pos:{x:9,y:0,z:0},vel:{x:0,y:0,z:0}},'phobos');assert.equal(b.sample('p',180).pos.x,9);
  b.push('p',50,300,{pos:{x:0,y:0,z:0},vel:{x:0,y:0,z:0}},'mars');assert.equal(b.sample('p',300).pos.x,9);
  check('prediction freezes after 150 ms; changing frame clears incompatible history',true);
  check('late packets from an earlier frame cannot reset the current motion history',true);
  const pos={x:0,y:0,z:0},delta={x:1,y:0,z:0};reconcile(pos,delta,1/60);assert.ok(pos.x<=.04);for(let i=0;i<300;i++)reconcile(pos,delta,1/60);assert.ok(Math.abs(pos.x-1)<1e-6);
  reconcile(pos,{x:20,y:0,z:0},1/60);assert.ok(pos.x>20);
  check('small own-body errors settle gently; errors beyond 8 m recover immediately',true);
  assert.equal(blankFrame([[255,255,255,255],[254,255,255,255]],[255,255,255]),true);assert.equal(blankFrame([[80,20,5,255]],[255,255,255]),false);
  check('first-frame detector distinguishes clear-only frames from rendered pixels',true);
  const health=Object.create(GraphicsHealth.prototype);Object.assign(health,{checked:0,blankCount:0,engine:{renderer:{info:{render:{calls:1}}}},flush:()=>{},problem:reason=>health.trigger=reason,gl:{isContextLost:()=>false,getError:()=>0,OUT_OF_MEMORY:1285,COLOR_CLEAR_VALUE:3106,getParameter:()=>[1,1,1,1],drawingBufferWidth:100,drawingBufferHeight:100,RGBA:6408,UNSIGNED_BYTE:5121,readPixels:(x,y,w,h,f,t,p)=>p.fill(255)}});
  for(let i=0;i<29;i++)health.afterFrame();assert.equal(health.trigger,undefined);health.afterFrame();assert.ok(health.trigger.includes('clear color'));
  check('three clear-only probes trigger the engine graphics fallback path',true);
  health.trigger=null;health.gl.getError=()=>1285;health.afterFrame();assert.equal(health.trigger,'WebGL out of memory');
  check('a GPU OUT_OF_MEMORY result reaches the visible graphics recovery handler',true);
  const diag=graphicsDiagnostic({reason:'Shader compile\nERROR',gpu:'Mali-G57',browser:'Chrome',tier:'safe',deviceKey:'private',name:'private',url:'private'});
  assert.equal(JSON.stringify(diag).includes('private'),false);assert.equal(diag.reason.includes('\n'),false);
  check('authority graphics log allowlist omits names, identities, URLs and arbitrary fields',true);
  const grid=new CoverGrid({safe:true});grid.rebuild({bx:0,by:0,bz:0},new Map([['one',{bx:0,by:0,bz:0}]]));const x=32,y=32,z=32;
  assert.equal(grid.atlas[(Math.floor(z/8)*64+y)*512+(z%8)*64+x],grid.data[(z*64+y)*64+x]);assert.ok(grid.tex.isDataTexture&&!grid.tex.isData3DTexture);
  check('safe terrain coverage packs the same occupancy into a WebGL1 byte atlas',true);
  const scene=new THREE.Scene(),point=new THREE.PointLight(),spot=new THREE.SpotLight(),sun=new THREE.DirectionalLight();
  sun.castShadow=true;scene.add(point,spot,sun);safeMaterials(scene,new Map());
  check('safe mode disables point/spot lights and shadow casting while retaining the sun',!point.visible&&!spot.visible&&sun.visible&&!sun.castShadow);
}
