import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
import { SpaceTrip } from '../src/space/spaceTrip.js';
import { CREW_POSTS } from '../src/crew/crewSpec.js';
import { freshOpening } from '../src/opening/state.js';
let chromium;try{({chromium}=createRequire(import.meta.url)('playwright'));}catch{({chromium}=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||join(homedir(),'.codex/runtime/unfinished-island/node_modules/'))('playwright'));}
const out=fileURLToPath(new URL('../docs/qa/2026-10-02/opening-bugs/',import.meta.url));await mkdir(out,{recursive:true});
const iphoneUA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const results={errors:[],passed:false,browser:'Chromium with iPhone Safari user agent',viewport:{width:390,height:844}},contexts=[];let app,browser,clock=Date.now();
try{
  app=await startServer({adapter:new MemoryAdapter(),port:0,tick:false,now:()=>clock});
  browser=await chromium.launch({headless:true,executablePath:process.env.COSMOS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,userAgent:iphoneUA});contexts.push(ctx);
  const page=await ctx.newPage();page.on('pageerror',e=>results.errors.push(String(e)));
  const cdp=await ctx.newCDPSession(page);
  const url=app.url.replace('ws:','http:')+'/?dev=1&tier=low&ws='+app.url;
  async function ready(q=''){await page.goto(url+q);await page.waitForFunction(()=>window.cosmos?.opening&&cosmos.engine.frameCount>=2,null,{timeout:120000});
    await page.evaluate(()=>cosmos.engine.stop());
    await page.waitForFunction(()=>cosmos.crewUI&&cosmos.ship.ready,null,{timeout:120000});
    await page.evaluate(async()=>{cosmos.engine.stop();if(cosmos.opening.active)await cosmos.opening.ready;cosmos.step(0);});}
  async function step(seconds){for(let left=seconds;left>1e-7;){const chunk=Math.min(1,left);left-=chunk;clock+=chunk*1000;
    await page.evaluate(async seconds=>{const c=cosmos,r=c.engine.renderer,render=r.render;r.render=()=>{};
      try{for(let t=0;t<seconds-1e-7;t+=1/60)c.step(Math.min(1/60,seconds-t));await c.opening.pending;}finally{r.render=render;}c.step(0);},chunk);}}
  async function shot(name){await page.evaluate(()=>cosmos.step(0));await page.screenshot({path:join(out,name+'.png')});}
  const finger=(id,x,y)=>({id,x,y,radiusX:4,radiusY:4,force:1});let touches=[];
  async function touch(type,points){touches=points;await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});}
  async function stick(down){if(down){await touch('touchStart',[finger(1,80,650)]);await touch('touchMove',[finger(1,80,588)]);}
    else await touch('touchEnd',[]);}
  async function tap(selector,held=false){const box=await page.locator(selector).boundingBox();assert.ok(box,selector);
    const p=finger(2,box.x+box.width/2,box.y+box.height/2),base=held?touches:[];
    await touch('touchStart',[...base,p]);await page.evaluate(()=>cosmos.step(0));await touch('touchEnd',[p]);touches=base;
    await page.evaluate(async()=>{const o=cosmos.opening;while(o.active&&(o.actionPending||o.busy))await new Promise(r=>setTimeout(r,10));cosmos.step(0);});}
  async function aim(x,z,y=.35){await page.evaluate(({x,y,z})=>{const m=cosmos.opening.model,w=m.walker,e=w.eyeWorldPos({}),p=m.toWorld(x,y,z),f=w.updateFrame();
    const d={x:p.x-e.x,y:p.y-e.y,z:p.z-e.z},l=Math.hypot(d.x,d.y,d.z),dot=v=>d.x*v.x+d.y*v.y+d.z*v.z;
    w.yaw=Math.atan2(dot(f.east),dot(f.north));w.pitch=Math.asin(dot(f.up)/l);cosmos.step(0);},{x,y,z});}
  async function walkTo(x,z){await stick(true);try{for(let i=0;i<120;i++){
    const d=await page.evaluate(({x,z})=>{const m=cosmos.opening.model,p=m.pose(),target=m.toWorld(x,0,z),f=m.walker.updateFrame(),w=m.walker;
      const dx=target.x-w.worldPos.x,dy=target.y-w.worldPos.y,dz=target.z-w.worldPos.z;
      w.yaw=Math.atan2(dx*f.east.x+dy*f.east.y+dz*f.east.z,dx*f.north.x+dy*f.north.y+dz*f.north.z);return Math.hypot(p.x-x,p.z-z);},{x,z});
    if(d<.2)return;await step(Math.min(.25,d/2));}throw Error('Touch walk did not reach '+x+','+z);}finally{await stick(false);}}
  await ready();console.log('Phone opening: loaded');await step(10);await shot('01-intro');
  const elapsed=await page.evaluate(async()=>{await cosmos.opening.savePose();return cosmos.opening.state.elapsed;});
  await ready();assert.ok(Math.abs(await page.evaluate(()=>cosmos.opening.elapsed)-elapsed)<1);results.introRefresh=true;
  await step(44);assert.equal(await page.evaluate(()=>cosmos.opening.state.stage),1);
  await page.evaluate(()=>{window.__qaPointers=[];for(const name of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(name,e=>{
    window.__qaPointers.push({type:name,target:e.target.id,id:e.pointerId,x:e.clientX,y:e.clientY,button:e.button});},true);});
  await stick(true);await step(4);await stick(false);assert.ok(await page.evaluate(()=>cosmos.opening.sw.z>12));await shot('02-exit-action');
  // A real second finger taps the action while the movement finger remains held,
  // and while an intentionally delayed background request is still busy.
  async function delaySave(){await page.evaluate(()=>{const w=cosmos.world,request=w.request.bind(w);let once=true;
    w.request=async a=>{if(once&&a.type==='opening-pose'){once=false;await new Promise(r=>setTimeout(r,150));}return request(a);};
    cosmos.opening.savePose(.1);cosmos.step(0);});}
  await delaySave();await stick(true);assert.equal(await page.locator('#opening-action').isDisabled(),false);
  await tap('#opening-action',true);await stick(false);
  results.exitTap=await page.evaluate(()=>({events:__qaPointers,stage:cosmos.opening.state.stage,pose:cosmos.opening.state.pose,sw:cosmos.opening.sw.z,status:cosmos.opening.status}));
  assert.equal(results.exitTap.stage,2,JSON.stringify(results.exitTap));results.exitDuringSave=true;
  await ready();assert.equal(await page.evaluate(()=>cosmos.opening.state.stage),2);results.exitRefresh=true;
  await walkTo(4,18.5);let taps=0;
  for(let i=0;i<35&&!await page.evaluate(()=>cosmos.opening.model.exposed());i++){
    const [x,z]=[[4,20],[4.18,20],[3.82,20],[4,20.18],[4,19.82]][i%5];await aim(x,z);await delaySave();await tap('#opening-action');taps++;}
  assert.ok(await page.evaluate(()=>cosmos.opening.model.exposed()));await shot('03-crate-cleared');
  const cuts=await page.evaluate(()=>cosmos.opening.state.cuts.length);assert.equal(cuts,taps);
  await ready();assert.ok(await page.evaluate(()=>cosmos.opening.model.exposed()));assert.equal(await page.evaluate(()=>cosmos.opening.state.cuts.length),cuts);
  results.dig={taps,cuts,refresh:true};
  // Drop the carry receipt after its durable commit. Refresh must replay the
  // journaled action id and resume at the driver without applying it twice.
  const id=await page.evaluate(()=>cosmos.world.playerId),peer=app.world.sessions.get(id),send=peer.send.bind(peer);
  peer.send=text=>{const m=JSON.parse(text);if(m.type==='receipt'&&m.opening?.stage===3)return;send(text);};
  await page.locator('#opening-action').tap();
  await page.waitForFunction(()=>cosmos.world.state.opening?.stage===3);
  assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem(cosmos.world.journalKey)).actions.length>0));
  await ready();assert.equal(await page.evaluate(()=>cosmos.opening.state.stage),3);
  assert.equal(await page.evaluate(()=>cosmos.world.pendingActions.size),0);results.unacknowledgedCarryRefresh=true;
  await step(10);await walkTo(-3.1,22.16);await aim(-6,22.2,1.9);await shot('04-ride-offer');
  await delaySave();await tap('#opening-action');assert.equal(await page.evaluate(()=>cosmos.opening.state.stage),4);
  await step(22);await shot('05-passenger-ride');
  const ride=await page.evaluate(()=>({seconds:cosmos.opening.rideSeconds,pose:cosmos.opening.pose(),eye:cosmos.opening.rover.passengerEye}));
  await ready();assert.equal(await page.evaluate(()=>cosmos.opening.state.stage),4);
  assert.ok(Math.abs(await page.evaluate(()=>cosmos.opening.rideSeconds)-ride.seconds)<1);
  await step(48);assert.equal(await page.evaluate(()=>cosmos.opening.active),false);await page.waitForFunction(()=>!document.querySelector('.opening-transition'));
  await shot('06-port-arrival');assert.equal(app.world.state.players[id].opening.complete,true);results.ride={...ride,refresh:true,arrived:true};
  await ready();assert.equal(await page.evaluate(()=>cosmos.opening.active),false);results.completeRefresh=true;
  // Port/crew fixtures isolate visibility and tap stability after the story.
  await page.evaluate(()=>{const c=cosmos;c.multiplayer.updateBodies(0);const m=[...c.crew.members.values()].find(m=>m.status==='candidate');
    const w=c.walker;for(const k of ['x','y','z'])w.worldPos[k]=m.gpos[k]+c.port.site.back[k]*2.2;
    const f=w.updateFrame(),eye=w.eyeWorldPos({}),d=Object.fromEntries(['x','y','z'].map(k=>[k,m.gpos[k]+c.port.site.up[k]*1.4-eye[k]])),dot=v=>d.x*v.x+d.y*v.y+d.z*v.z;
    w.yaw=Math.atan2(dot(f.east),dot(f.north));w.pitch=Math.asin(dot(f.up)/Math.hypot(d.x,d.y,d.z));
    c.crewUI._accum=1;c.crewUI.update(0);c.step(0);});
  await shot('07a-visible-candidate');
  const stable=await page.evaluate(()=>{const c=cosmos,b=c.crewUI.btn,child=b.firstChild;c.crewUI._accum=1;c.crewUI.update(0);return child===b.firstChild;});assert.ok(stable);
  await tap('#crew-talk');assert.equal(await page.evaluate(()=>cosmos.crewUI.open),true);await shot('07-visible-hire-candidate');
  await page.evaluate(()=>{const c=cosmos;c.crewUI.close();for(const m of c.crew.members.values())m.person.group.parent.visible=false;
    c.crewUI._accum=1;c.crewUI.update(0);});
  assert.equal(await page.locator('#crew-talk').isVisible(),false);results.hiddenPromptClears=true;
  await page.evaluate(()=>{const c=cosmos;for(const b of c.multiplayer.bodies.values())b.group.visible=true;
    const m=c.portPeople.members[0];m.person.group.visible=true;Object.assign(c.walker.worldPos,c.port.site.toWorld(m.person.group.position.x,m.person.group.position.y,m.person.group.position.z));
    c.crewUI._accum=1;c.crewUI.update(0);});
  await tap('#crew-talk');assert.equal(await page.evaluate(()=>cosmos.crewUI.target.status),'worker');await shot('08-port-worker');
  const movedWorker=await page.evaluate(()=>{const c=cosmos,m=c.crewUI.target;c.crewUI.close();m.person.group.position.x+=20;c.crewUI._accum=1;c.crewUI.update(0);return m.id;});
  assert.notEqual(await page.evaluate(()=>cosmos.crewUI.target?.id),movedWorker);results.movedWorkerClears=true;
  const guest=await app.world.join('qa-offline-'.repeat(4),'Offline QA'),gs=app.world.state.ships[guest.shipId],gSim=app.world.sims.get(gs.id);
  gSim.flight.landed=false;await app.world.commit();await ready();
  assert.equal(await page.evaluate(id=>!!cosmos.multiplayer.fleetView.views.get(id)?.root.visible,gs.id),false);
  gSim.flight.landed=true;await app.world.commit();await ready();
  assert.equal(await page.evaluate(id=>cosmos.multiplayer.fleetView.views.get(id)?.label?.userData.text,gs.id),'Offline QA · PARKED · owner offline');
  guest.opening=freshOpening();await app.world.commit();await ready();
  assert.equal(await page.evaluate(id=>!!cosmos.multiplayer.fleetView.views.get(id)?.root.visible,gs.id),false);results.shipPresence=true;
  // A hired pilot returning from space now starts a port course. Seed an
  // airborne fixture, then use the public pilot order and on-screen ×60 control.
  const p=app.world.state.players[id],s=app.world.state.ships[p.shipId],sim=app.world.sims.get(s.id),role=CREW_POSTS.find(r=>r.seat==='pilot');
  const pilot={id:'qa-pilot',role:role.id,name:'QA Pilot',skill:1,status:'aboard',displaced:false,seatPose:sim.def.seats.find(v=>v.id==='pilot'),personId:'ada'};
  s.crew.push(pilot);p.aboardShipId=s.id;p.currentShipId=s.id;p.pose.aboard=true;p.pose.seat=null;
  sim.ship.aboard=true;sim.syncCrew();sim.flight.pos=sim.portSite.toWorld(0,125000,0);sim.flight.vel={x:0,y:0,z:0};sim.flight.agl=125000;sim.flight.landed=false;sim.flight.refreshOrientation();
  await app.world.commit();await ready();
  const returnReceipt=await page.evaluate(()=>cosmos.world.request({type:'crew-order',order:'return'}));assert.ok(returnReceipt.ok,returnReceipt.msg);
  assert.equal(sim.trip.dest.id,'port');
  // Skip the drive fixture to its real descent law, then verify faster actual flight.
  sim.trip=new SpaceTrip(sim,sim.resolve('port'));sim.trip.phase='descent';sim.trip.setWarp(1);
  sim.flight.pos=sim.portSite.toWorld(0,20000,0);sim.flight.vel={x:0,y:0,z:0};sim.flight.agl=20000;sim.flight.refreshOrientation();
  await app.world.commit();await ready();await page.evaluate(()=>{cosmos.step(.016);cosmos.space.ui.update(.5);});
  assert.equal(await page.locator('#flight-speed').isVisible(),true);
  await tap('#flight-speed button[data-w="60"]');await page.waitForFunction(()=>cosmos.space.trip?.warp===60);
  const before=sim.flight.time;for(let i=0;i<60;i++){clock+=1000/60;app.world.advance(1/60);}await app.world.commit();
  assert.ok(sim.flight.time-before>10);assert.ok(sim.flight.hull>99);await ready();await page.evaluate(()=>cosmos.space.ui.update(.5));
  await shot('09-return-descent-speed');results.returnLanding={requested:sim.trip.warp,effective:sim.trip.eff,flightSecondsInOneSecond:sim.flight.time-before,hull:sim.flight.hull};
  let landingWallSeconds=0;while(!sim.flight.landed&&landingWallSeconds<100){clock+=100;app.world.advance(.1);landingWallSeconds+=.1;}
  assert.ok(sim.flight.landed,'Compressed return must actually land');assert.equal(sim.flight.hull,100);
  const landed=app.world.site.toLocal(sim.flight.pos);assert.ok(Math.hypot(landed.x-s.pad.x,landed.z-s.pad.z)<10);
  await app.world.commit();await ready();await shot('09b-return-landed');results.returnLanding.landed=true;
  results.returnLanding.secondsToLand=landingWallSeconds;results.returnLanding.padDistance=Math.hypot(landed.x-s.pad.x,landed.z-s.pad.z);
  // Fresh build manifest disagreement triggers one reload and retains identity.
  const oldId=await page.evaluate(()=>cosmos.world.playerId);let stale=true;
  await page.route('**/build.json',async route=>{if(stale){stale=false;await route.fulfill({contentType:'application/json',body:JSON.stringify({id:'qa-stale-build'})});}else await route.continue();});
  await page.reload();await page.waitForURL('**build=qa-stale-build**',{timeout:30000});await page.waitForFunction(()=>window.cosmos?.world?.connected,null,{timeout:120000});
  assert.equal(await page.evaluate(()=>cosmos.world.playerId),oldId);results.staleBuildReload=true;
  const health=await (await fetch(app.url.replace('ws:','http:')+'/health')).json();
  assert.equal(health.buildVersion,await page.evaluate(()=>cosmos.buildVersion));results.buildVersion=health.buildVersion;
  assert.equal(await page.evaluate(()=>navigator.serviceWorker?.controller===null),true);
  results.serviceWorker='No controlling service worker in isolated browser';
  const failed=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,userAgent:iphoneUA});contexts.push(failed);
  const fallback=await failed.newPage();fallback.on('pageerror',e=>results.errors.push(String(e)));
  await fallback.route('**/homes/people/*.glb',route=>route.abort('failed'));
  await fallback.goto(url+'&opening=off');await fallback.waitForFunction(()=>cosmos?.crewUI&&cosmos.portPeople.members.length===15,null,{timeout:120000});
  await fallback.evaluate(()=>{const c=cosmos;c.engine.stop();c.multiplayer.updateBodies(0);const m=[...c.crew.members.values()].find(m=>m.status==='candidate');
    const w=c.walker;for(const k of ['x','y','z'])w.worldPos[k]=m.gpos[k]+c.port.site.back[k]*2.2;
    const f=w.updateFrame(),eye=w.eyeWorldPos({}),d=Object.fromEntries(['x','y','z'].map(k=>[k,m.gpos[k]+c.port.site.up[k]*1.4-eye[k]])),dot=v=>d.x*v.x+d.y*v.y+d.z*v.z;
    w.yaw=Math.atan2(dot(f.east),dot(f.north));w.pitch=Math.asin(dot(f.up)/Math.hypot(d.x,d.y,d.z));
    c.crewUI._accum=1;c.crewUI.update(0);c.step(0);});
  assert.ok(await fallback.evaluate(()=>[...cosmos.crew.members.values()].every(m=>m.person.loaded&&m.person.safe)));
  await fallback.screenshot({path:join(out,'10a-failed-glb-person.png')});
  await fallback.locator('#crew-talk').tap();assert.ok(await fallback.locator('[data-a="hire"],[data-a="meet"]').first().isVisible());
  await fallback.screenshot({path:join(out,'10-failed-glb-fallback.png')});results.failedGlbVisible=true;
  assert.equal(results.errors.length,0,results.errors.join('\n'));results.passed=true;
  console.log('Phone opening bugs:',JSON.stringify(results));
}catch(e){results.failure=String(e.stack||e);throw e;}finally{
  await writeFile(join(out,'browser-results.json'),JSON.stringify(results,null,2));
  for(const ctx of contexts)await ctx.close();await browser?.close();await app?.close();
}
