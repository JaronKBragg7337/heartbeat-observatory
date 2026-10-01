// Real Chromium clients. Server-only fixture placement is deliberately kept in
// this test process; the website has no teleport or time-advance protocol.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { SEATS } from '../src/ship/shipSpec.js';
import { spawn } from 'node:child_process';
const require=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const {chromium}=require('playwright');
const out=fileURLToPath(new URL('../docs/qa/2026-10-01/multiplayer/',import.meta.url));await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'cosmos-browser-'));let app,browser,staticServer;const errors=[],results={};let clock=Date.now();
try{
  app=await startServer({adapter:new FileAdapter(join(temp,'world.json')),port:8390,tick:false,now:()=>clock});
  browser=await chromium.launch({headless:true,executablePath:process.env.COSMOS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
  const ctxA=await browser.newContext({viewport:{width:1280,height:720}}),ctxB=await browser.newContext({viewport:{width:1280,height:720}});
  for(const [ctx,key,name] of [[ctxA,'A'.repeat(48),'Jaron'],[ctxB,'B'.repeat(48),'Lilith']])await ctx.addInitScript(({key,name})=>{localStorage.setItem('cosmos-device-v2',JSON.stringify({key,name}));localStorage.setItem('hb-look',name==='Jaron'?'isaiah':'ada');},{key,name});
  const a=await ctxA.newPage(),b=await ctxB.newPage();for(const p of [a,b])p.on('pageerror',e=>errors.push(String(e)));
  const ready=async p=>{await p.goto('http://localhost:8390/?tier=low&dev=1');await p.waitForFunction(()=>window.cosmos?.multiplayer,null,{timeout:90000});await p.evaluate(()=>cosmos.engine.stop());};
  await ready(a);await ready(b);const aid=await a.evaluate(()=>cosmos.world.playerId),bid=await b.evaluate(()=>cosmos.world.playerId);
  const w=app.world,pa=w.state.players[aid],pb=w.state.players[bid],sid=pa.shipId,other=pb.shipId;
  const request=(page,action)=>page.evaluate(a=>cosmos.multiplayer.request(a),action);
  async function sync(){await w.enqueue(()=>w.commit());await a.evaluate(()=>cosmos.world.socket.send(JSON.stringify({type:'checkpoint'})));await a.waitForFunction(r=>cosmos.world.state.revision>=r,w.state.revision);await b.waitForFunction(r=>cosmos.world.state.revision>=r,w.state.revision);
    for(const page of [a,b])await page.evaluate(()=>{cosmos.multiplayer.forcePlayer=true;cosmos.multiplayer.apply({bricks:[]});cosmos.rebuildNear(true);for(let i=0;i<3;i++)cosmos.step(1/60);});}
  function fixture(p,x,z){p.pose.worldPos=w.site.toWorld(x,.02,z);p.pose.velocity={x:0,y:0,z:0};p.pose.yaw=w.site.heading;p.pose.pitch=0;p.poseAt=clock;p.aboardShipId=null;p.pose.aboard=false;p.pose.seat=null;p.frameId='mars';}
  fixture(pa,-24,42);fixture(pb,-24,45);await sync();
  await new Promise(r=>setTimeout(r,3500));
  await a.evaluate(()=>{for(let i=0;i<12;i++)cosmos.step(1/30);});await b.evaluate(()=>{for(let i=0;i<12;i++)cosmos.step(1/30);});
  await a.waitForFunction(id=>cosmos.multiplayer.bodies.get(id)?.person.loaded,bid,{timeout:90000});
  assert.ok(await a.evaluate(id=>cosmos.multiplayer.bodies.get(id).group.visible,bid));results.otherBody=true;
  const shot=async(page,name)=>{await page.screenshot({path:join(out,name+'.png')});console.log('Screenshot:',name);};
  await b.evaluate(()=>{const c=cosmos,p=c.walker.worldPos,f=c.walker.updateFrame();c.freeCam.set({x:p.x+f.up.x*2+f.east.x*6,y:p.y+f.up.y*2+f.east.y*6,z:p.z+f.up.z*2+f.east.z*6},c.port.site.toWorld(-24,1,42));c.step(1/60);});
  await shot(b,'01-other-player');
  await a.evaluate(()=>{cosmos.walker.pitch=-1.2;cosmos.multiplayer.sendPose();});clock+=1000;
  const dig=await request(a,{type:'dig-edit'});assert.equal(dig.ok,true,dig.msg);await b.waitForFunction(()=>cosmos.edits.bricks.size>0);results.sharedDig=true;
  await b.evaluate(()=>{cosmos.flushTerrain();cosmos.step(1/60);});await shot(b,'02-shared-hole');
  fixture(w.state.players[aid],-28,-57);fixture(w.state.players[bid],-31,-57);await sync();
  const candidate=Object.values(w.state.pool).find(c=>c.role==='pilot');assert.equal((await request(a,{type:'meet',id:candidate.id})).ok,true);
  await w.enqueue(()=>{w.advance(9);});await sync();
  await a.evaluate(()=>{const c=cosmos,p=c.port.site.toWorld(-28,3,-47),t=c.port.site.toWorld(-28,1.5,-65);c.freeCam.set(p,t);c.multiplayer.panel.hidden=false;c.multiplayer.draw();c.step(1/60);});
  await shot(a,'03-crew-hall-meeting');
  const hired=await request(a,{type:'hire',id:candidate.id});assert.equal(hired.ok,true,hired.msg);const lost=await request(b,{type:'hire',id:candidate.id});assert.equal(lost.ok,false);results.exclusiveHire=true;
  fixture(w.state.players[aid],-60.35,-40);fixture(w.state.players[bid],-59.65,-40);await sync();
  assert.equal((await request(a,{type:'elevator',destination:22.5})).ok,true);await w.enqueue(()=>w.advance(15));await sync();
  assert.equal(await a.evaluate(()=>cosmos.port.elevator.y),22.5);assert.equal(await b.evaluate(()=>cosmos.port.elevator.y),22.5);results.sharedElevator=true;
  await b.evaluate(()=>{cosmos.freeCam.off();cosmos.step(1/60);});await shot(b,'08-shared-elevator');
  fixture(w.state.players[aid],-10,38);fixture(w.state.players[bid],-11,38);await sync();
  await request(a,{type:'boarding-permission',allowed:true});assert.equal((await request(a,{type:'board',shipId:sid})).ok,true);assert.equal((await request(b,{type:'board',shipId:sid})).ok,true);
  await w.enqueue(()=>{Object.assign(w.state.players[aid].pose.sw,SEATS.find(s=>s.id==='pilot'));Object.assign(w.state.players[bid].pose.sw,SEATS.find(s=>s.id==='nav'));});await sync();
  await request(a,{type:'seat',seat:'pilot'});await request(b,{type:'seat',seat:'nav'});assert.equal((await request(a,{type:'engage',destination:'phobos'})).ok,true);
  await w.enqueue(()=>w.advance(310));await sync();
  await a.evaluate(()=>{cosmos.multiplayer.panel.hidden=true;cosmos.freeCam.off();cosmos.step(1/60);});await b.evaluate(()=>{cosmos.freeCam.off();cosmos.step(1/60);});
  await shot(a,'04-flight-together');
  const localBefore=structuredClone(w.state.players[bid].pose.sw);await b.reload();await b.waitForFunction(()=>window.cosmos?.multiplayer,null,{timeout:90000});await b.evaluate(()=>{cosmos.engine.stop();cosmos.step(1/60);});
  assert.equal(await b.evaluate(()=>cosmos.world.playerId),bid);assert.equal(await b.evaluate(()=>cosmos.world.snapshot.players[cosmos.world.playerId].aboardShipId),sid);
  const after=await b.evaluate(()=>cosmos.world.snapshot.players[cosmos.world.playerId].pose.sw);assert.deepEqual(after,localBefore);assert.equal(Object.keys(w.state.ships).length,2);results.refreshMidTrip=true;
  await shot(b,'05-passenger-rejoined');
  let elapsed=0;while(w.state.ships[sid].trip&&elapsed<15000){await w.enqueue(()=>w.advance(30));elapsed+=30;}await sync();
  assert.equal(await b.evaluate(()=>cosmos.space.frameId),'phobos');assert.equal(await b.evaluate(()=>cosmos.ship.flight.landed),true);results.bothLanded=true;
  await b.evaluate(()=>{cosmos.freeCam.off();cosmos.step(1/60);});await shot(b,'06-phobos-rejoined');
  assert.equal((await request(b,{type:'leave'})).ok,true);await sync();assert.equal(await b.evaluate(()=>cosmos.multiplayer.activeId()),sid);assert.equal(await b.evaluate(()=>cosmos.space.frameId),'phobos');results.guestCanLeaveOnMoon=true;
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(String(e)));await ready(phone);await phone.evaluate(()=>{cosmos.multiplayer.panel.hidden=false;cosmos.multiplayer.draw();cosmos.step(1/60);});await shot(phone,'07-mobile');results.phoneLayout=true;
  const normal=await browser.newPage();await normal.goto('http://localhost:8390/?tier=low');await normal.waitForSelector('#multiplayer-button',{timeout:90000});assert.equal(await normal.evaluate(()=>typeof window.cosmos),'undefined');results.normalPlayHasNoDebugHandle=true;
  await ctxA.close();await ctxB.close();await mobile.close();await normal.close();await app.close();app=null;
  // Keep serving the browser while the authority is actually unreachable.
  staticServer=spawn(process.execPath,['server.js'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,PORT:'8383'},stdio:'pipe',windowsHide:true});
  await new Promise((r,j)=>{staticServer.stdout.once('data',r);staticServer.once('error',j);});
  const solo=await browser.newPage();solo.on('pageerror',e=>errors.push(String(e)));await solo.goto('http://localhost:8383/?tier=low&dev=1');await solo.waitForFunction(()=>window.cosmos,null,{timeout:90000});
  assert.equal(await solo.evaluate(()=>cosmos.world.offline),true);assert.ok((await solo.locator('#purse').textContent()).includes('Offline solo'));
  await solo.evaluate(async()=>{cosmos.engine.stop();cosmos.space.hooks.award(300,'QA survey reward');cosmos.space.hooks.addCargo('phobos-core-sample',4.5);await cosmos.world.flush();cosmos.economyUI.draw();});
  assert.equal(await solo.evaluate(()=>cosmos.world.state.economy.marks),11200);assert.equal(await solo.evaluate(()=>cosmos.space.hooks.cargoKg('phobos-core-sample')),4.5);
  await shot(solo,'09-offline-solo');await solo.reload();await solo.waitForFunction(()=>window.cosmos,null,{timeout:90000});
  assert.equal(await solo.evaluate(()=>cosmos.world.state.economy.marks),11200);assert.equal(await solo.evaluate(()=>cosmos.space.hooks.cargoKg('phobos-core-sample')),4.5);results.offlineFallbackAndSpacePurse=true;
  assert.deepEqual(errors,[]);results.pageErrors=errors;results.ownedShips={jaron:sid,lilith:other};console.log('Browser assertions passed.');
}finally{await writeFile(join(out,'browser-results.json'),JSON.stringify({results,errors},null,2));await browser?.close();if(app)await app.close();staticServer?.kill();await rm(temp,{recursive:true,force:true});}
