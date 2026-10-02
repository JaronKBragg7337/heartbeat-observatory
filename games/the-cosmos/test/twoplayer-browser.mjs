// Isolated FileAdapter authority: never touches the live MSI/Supabase world.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
let chromium;try{({chromium}=createRequire(import.meta.url)('playwright'));}catch{({chromium}=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||join(homedir(),'.codex/runtime/unfinished-island/node_modules/'))('playwright'));}
const out=fileURLToPath(new URL('../docs/qa/2026-10-02/twoplayer/',import.meta.url));await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'cosmos-twoplayer-')),results={},errors=[],movementOnly=process.env.COSMOS_QA_MOVEMENT_ONLY==='1';let app,browser;
try {
  app=await startServer({adapter:new FileAdapter(join(temp,'world.json')),port:0,tick:false,clientErrorLog:join(temp,'client-errors.log')});
  const origin=app.url.replace('ws:','http:'),url=q=>`${origin}/?dev=1&opening=off&ws=${app.url}&${q}`;
  browser=await chromium.launch({headless:true,...(process.env.COSMOS_CHROME||process.platform==='win32'?{executablePath:process.env.COSMOS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{}),args:['--use-gl=swiftshader','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
  async function make(name,phone=false){const ctx=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1100,height:700},isMobile:phone,hasTouch:phone,userAgent:phone?'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36':undefined});
    await ctx.addInitScript(name=>{localStorage.setItem('cosmos-device-v2',JSON.stringify({key:name.repeat(48).slice(0,48),name}));
      const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);let handler;Object.defineProperty(this,'onmessage',{get:()=>handler,set:v=>handler=v});super.addEventListener('message',e=>{
        const m=JSON.parse(e.data);if(window.qaJitter&&m.type==='state'){const n=window.qaPacket=(window.qaPacket||0)+1;let delay=80+n*37%121;if(n%7===0)delay+=100;setTimeout(()=>handler?.call(this,{data:e.data}),delay);}else handler?.call(this,e);
      });}};
    },name);
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));return {ctx,page};}
  async function ready(p,q='tier=low'){
    await p.goto(url(q));
    if(q.includes('webgl=1'))await p.waitForURL(/tier=safe/,{waitUntil:'commit',timeout:30000});
    for(let attempt=0;attempt<3;attempt++){
      try{
        await p.waitForFunction(()=>window.cosmos?.multiplayer&&cosmos.engine.frameCount>=2,null,{timeout:120000});
        const info=await p.evaluate(()=>{const c=cosmos;c.engine.stop();return {safe:c.engine.safe,failed:c.engine.graphics.failures,problem:document.getElementById('graphics-problem')?.textContent};});
        if(info.failed&&!info.safe){await p.waitForURL(/tier=safe/,{waitUntil:'commit',timeout:30000});continue;}
        console.log('Ready',q,info);return;
      }catch(e){if(!/context was destroyed|navigation|Cannot find context/.test(String(e))||attempt===2)throw e;}
    }
  }

  const A=await make('Alpha'),B=await make('Beta'),a=A.page,b=B.page;await ready(a);await ready(b);
  const aid=await a.evaluate(()=>cosmos.world.playerId),bid=await b.evaluate(()=>cosmos.world.playerId),w=app.world,pa=w.state.players[aid],pb=w.state.players[bid],sid=pb.shipId,sim=w.sims.get(sid);
  const shot=async(p,name)=>{await p.screenshot({path:join(out,name+'.png')});};
  async function sync(){await w.enqueue(()=>w.commit());await b.evaluate(()=>cosmos.world.socket.send(JSON.stringify({type:'checkpoint'})));await a.waitForFunction(r=>cosmos.world.state.revision>=r,w.state.revision);await b.waitForFunction(r=>cosmos.world.state.revision>=r,w.state.revision);}
  async function place(local){pa.aboardShipId=null;pa.pose.aboard=false;pa.pose.seat=null;pa.currentShipId=pa.shipId;pa.pose.worldPos=sim.flight.toWorld(local,{});pa.pose.velocity={x:0,y:0,z:0};pa.pose.yaw=sim.flight.heading;pa.poseAt=Date.now();await sync();
    await a.evaluate(id=>{const c=cosmos,p=c.world.snapshot.players[id];Object.assign(c.walker.worldPos,p.pose.worldPos);Object.assign(c.walker.velocity,p.pose.velocity);c.walker.yaw=p.pose.yaw;c.walker.pitch=0;c.walker.updateFrame();c.freeCam.off();},aid);}
  // Use the actual contact handler, not only the standalone envelope function.
  await place({x:7,y:-2,z:0});const before=await a.evaluate(()=>({...cosmos.walker.worldPos}));await a.evaluate(()=>cosmos.multiplayer.collideShips());const after=await a.evaluate(()=>({...cosmos.walker.worldPos}));assert.ok(Math.hypot(...['x','y','z'].map(k=>after[k]-before[k]))>.05);results.remoteHullCollision=true;console.log("Remote hull collision passed");
  await a.evaluate(()=>{const c=cosmos,s=c.world.snapshot.ships[Object.values(c.world.snapshot.players).find(p=>p.id!==c.world.playerId).shipId];c.freeCam.set(c.port.site.toWorld(s.pad.x+30,9,s.pad.z+35),s.pose.pos);c.step(.016);});await shot(a,'01-other-ship-solid');
  const ramp=sim.def.ramps.cargo,st=sim.ship.state.ramps.cargo,along=ramp.length*Math.cos(st.angle)-.03,tip={x:ramp.hinge.x+ramp.dir.x*along,y:ramp.hinge.y-along*Math.tan(st.angle),z:ramp.hinge.z+ramp.dir.z*along};
  await place(tip);await a.evaluate(()=>cosmos.ship._outsideFrame(1/60,{moveNorth:1}));assert.equal(w.state.players[aid].aboardShipId,null);results.closedBoarding=true;
  assert.ok((await b.evaluate(()=>cosmos.multiplayer.request({type:'boarding-permission',allowed:true}))).ok);
  await place(tip);await a.evaluate(()=>cosmos.ship._outsideFrame(1/60,{moveNorth:1}));await a.waitForFunction(()=>cosmos.ship.aboard&&!cosmos.multiplayer.boardPending,{timeout:15000});assert.equal(w.state.players[aid].aboardShipId,sid);
  const start=await a.evaluate(()=>cosmos.ship.sw.z);await a.evaluate(()=>{const c=cosmos,r=c.engine.renderer,render=r.render;r.render=()=>{};for(let i=0;i<150;i++)c.ship.sw.tick(1/60,{moveZ:1});r.render=render;c.step(0);});const end=await a.evaluate(()=>cosmos.ship.sw.z);assert.ok(end<start-2);results.guestRampAndInterior={start,end};console.log("Guest ramp/interior passed");await shot(a,'02-guest-walking-interior');
  // Small own-body corrections must settle in bounded steps.
  const gentle=await a.evaluate(()=>{const c=cosmos,pos=c.ship.sw,old=pos.x;c.multiplayer.correction={x:.8,y:0,z:0};c.multiplayer.tick(1/60);return Math.abs(pos.x-old);});assert.ok(gentle<=.04+.000001);results.ownCorrectionStep=gentle;
  // Repeated snapshots after a deliberate restore must not consume an old
  // prediction again (the UI parity scenario also teleports for setup).
  results.restoreConsumesAck=await a.evaluate(()=>{const c=cosmos,mp=c.multiplayer,p=c.world.snapshot.players[c.world.playerId],seq=999999,oldSeq=p.poseSeq;
    p.poseSeq=seq;c.world.sentPoses.set(seq,{sw:{x:p.pose.sw.x-20,y:p.pose.sw.y,z:p.pose.sw.z},worldPos:{...p.pose.worldPos}});
    mp.forcePlayer=true;mp.apply({});mp.apply({});const ok=mp.ackSeq===seq&&mp.correction===null;
    c.world.sentPoses.delete(seq);p.poseSeq=oldSeq;mp.ackSeq=oldSeq;return ok;});assert.equal(results.restoreConsumesAck,true);
  // Actual network packets delivered to two Chromium clients through a jittered
  // WebSocket adapter. Compare pixels' world transforms to the delayed truth.
  pa.aboardShipId=null;pa.pose.aboard=false;pa.currentShipId=pa.shipId;pa.pose.worldPos=w.site.toWorld(-24,.02,45);pb.pose.worldPos=w.site.toWorld(-24,.02,42);pb.pose.velocity={x:0,y:0,z:0};await sync();
  const basePlayer={...pb.pose.worldPos},baseShip={...w.state.ships[sid].pose.pos},direction=w.site.right,t0=Date.now();
  await a.evaluate(()=>{window.qaJitter=true;cosmos.multiplayer.motion.samples.clear();cosmos.multiplayer.motion.display.clear();});
  const samples=[];
  for(let i=0;i<45;i++){
    const dt=(Date.now()-t0)/1000;
    for(const k of ['x','y','z']){pb.pose.worldPos[k]=basePlayer[k]+direction[k]*dt*4;pb.pose.velocity[k]=direction[k]*4;sim.flight.pos[k]=baseShip[k]+direction[k]*dt*20;sim.flight.vel[k]=direction[k]*20;}
    await w.enqueue(()=>w.commit());await b.evaluate(()=>cosmos.world.socket.send(JSON.stringify({type:'checkpoint'})));
    for(let j=0;j<3;j++){await a.waitForTimeout(30);samples.push(await a.evaluate(({bid,sid,basePlayer,baseShip,direction,t0})=>{const c=cosmos,mp=c.multiplayer,renderer=c.engine.renderer,render=renderer.render;renderer.render=()=>{};try{c.step(1/30);}finally{renderer.render=render;}const now=performance.now(),time=(now-mp.motion.offset-mp.motion.delay-t0)/1000;
      if(!mp.motion.samples.get('player:'+bid)||time<.6)return null;
      const error=(pos,base,speed)=>Math.hypot(...['x','y','z'].map(k=>pos[k]-base[k]-direction[k]*time*speed));
      const visible=entry=>{entry.object3d.updateWorldMatrix(true,false);const e=entry.object3d.matrixWorld.elements;return {x:e[12]+c.engine.cameraWorldPos.x,y:e[13]+c.engine.cameraWorldPos.y,z:e[14]+c.engine.cameraWorldPos.z};};
      return {player:error(visible(mp.bodies.get(bid).entry),basePlayer,4),ship:error(visible(mp.fleetView.views.get(sid).entry),baseShip,20)};
    },{bid,sid,basePlayer,baseShip,direction,t0}));}
  }
  const valid=samples.filter(Boolean),rms=k=>Math.sqrt(valid.reduce((sum,s)=>sum+s[k]**2,0)/valid.length);results.networkJitter={samples:valid.length,playerRms:rms('player'),shipRms:rms('ship'),playerMax:Math.max(...valid.map(s=>s.player)),shipMax:Math.max(...valid.map(s=>s.ship))};assert.ok(valid.length>50);assert.ok(results.networkJitter.playerRms<.5,JSON.stringify(results.networkJitter));assert.ok(results.networkJitter.shipRms<2.5,JSON.stringify(results.networkJitter));
  await a.evaluate(bid=>{window.qaJitter=false;const c=cosmos;c.step(.016);const p=c.multiplayer.bodies.get(bid).entry.worldPos,site=c.port.site;
    const add=(up,right,back)=>Object.fromEntries(['x','y','z'].map(k=>[k,p[k]+site.up[k]*up+site.right[k]*right+site.back[k]*back]));
    c.freeCam.set(add(3,5,8),add(1,0,0));c.step(.016);},bid);await shot(a,'03-two-client-jitter');
  await A.ctx.close();await B.ctx.close();
  if(!movementOnly){
  // Low-end Android viewport and 4x CPU throttling are emulation, not a Mali GPU.
  const Phone=await make('Phone',true),phone=Phone.page,cdp=await Phone.ctx.newCDPSession(phone);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  results.graphicsMatrix=[];
  results.recoveredFrames=[];
  let phoneId;
  async function recovered(reason) {
    await phone.waitForURL(/tier=safe/,{waitUntil:'commit',timeout:15000});
    await phone.waitForFunction(()=>window.cosmos?.multiplayer&&cosmos.engine.frameCount>=2,null,{timeout:120000});
    const info=await phone.evaluate(()=>{
      const c=cosmos,e=c.engine;e.stop();e.graphics.checked=9;c.step(.016);
      let activeLocalLights=0;
      for(const scene of [e.scene,...e.overlayScenes])scene.traverse(o=>{if((o.isPointLight||o.isSpotLight)&&o.visible)activeLocalLights++;});
      return {safe:e.safe,playerId:c.world.playerId,nonClearFrame:e.graphics.blankCount===0,failures:e.graphics.failures,calls:e.renderer.info.render.calls,activeLocalLights,problem:document.getElementById('graphics-problem')?.textContent||''};
    });
    assert.equal(info.safe,true);assert.equal(info.failures,0,JSON.stringify(info));
    assert.equal(info.nonClearFrame,true,JSON.stringify(info));assert.ok(info.calls>0);
    assert.equal(info.activeLocalLights,0);assert.ok(info.problem.includes(reason),JSON.stringify(info));
    if(phoneId)assert.equal(info.playerId,phoneId);
    results.recoveredFrames.push({reason,...info});
  }
  for(const q of ['tier=low','tier=low&depth=16','tier=low&logdepth=0&env=0&shadows=0&far=2000','tier=low&webgl=1&env=0','tier=safe','tier=low&logdepth=0','tier=low&env=0','tier=low&shadows=0','tier=low&far=2000']){
    await ready(phone,q);phoneId??=await phone.evaluate(()=>cosmos.world.playerId);await phone.evaluate(()=>{for(let i=0;i<3;i++)cosmos.step(.016);});
    const info=await phone.evaluate(()=>{const e=cosmos.engine;e.graphics.checked=9;e.step(.016);return {safe:e.safe,webgl2:e.renderer.capabilities.isWebGL2,logdepth:e.renderer.capabilities.logarithmicDepthBuffer,far:e.camera.far,shadows:e.renderer.shadowMap.enabled,environment:!!cosmos.ship.matsExt.hull?.envMap,problem:document.getElementById('graphics-problem')?.textContent||'',calls:e.renderer.info.render.calls,nonClearFrame:e.graphics.blankCount===0,failures:e.graphics.failures};});results.graphicsMatrix.push({query:q,...info});console.log("Graphics matrix",q,JSON.stringify(info));
    assert.equal(info.failures,0,JSON.stringify(info));assert.equal(info.nonClearFrame,true,JSON.stringify(info));
    const flags=new URLSearchParams(q);
    if(flags.get('logdepth')==='0')assert.equal(info.logdepth,false);
    if(flags.get('env')==='0')assert.equal(info.environment,false);
    if(flags.get('shadows')==='0')assert.equal(info.shadows,false);
    if(flags.get('far')==='2000')assert.equal(info.far,2000);
    await shot(phone,'phone-'+results.graphicsMatrix.length);if(q==='tier=safe'){assert.equal(info.webgl2,false);assert.equal(info.logdepth,false);assert.equal(info.shadows,false);assert.equal(info.far,2000);assert.ok(info.calls>0);}
  }
  // Clear-only framebuffer exercises the real readPixels detector and reload.
  await ready(phone);await phone.evaluate(()=>{const e=cosmos.engine;e.scene.visible=false;for(const s of e.overlayScenes)s.visible=false;e.graphics.checked=0;for(let i=0;i<30;i++)e.step(.016);});await recovered('clear color');await shot(phone,'04-phone-clear-frame-fallback');results.clearFrameFallback=true;
  // Actual lost-context event and shader compile callback, each on fresh pages.
  await ready(phone);await phone.evaluate(()=>cosmos.engine.renderer.getContext().getExtension('WEBGL_lose_context').loseContext());await recovered('context lost');results.contextLossFallback=true;await shot(phone,'05-phone-context-loss-fallback');
  await ready(phone);await phone.evaluate(async()=>{const THREE=await import('/lib/three.module.js'),c=cosmos,scene=new THREE.Scene(),material=new THREE.ShaderMaterial({vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'THIS IS AN INVALID SHADER'}),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);mesh.position.set(0,0,-3).applyQuaternion(c.engine.camera.quaternion);scene.add(mesh);c.engine.renderer.render(scene,c.engine.camera);});await recovered('Shader compile');results.shaderFallback=true;await shot(phone,'06-phone-shader-fallback');
  // Synthetic GL status exercises memory recovery without exhausting the host.
  await ready(phone);await phone.evaluate(()=>{const h=cosmos.engine.graphics,gl=h.gl,original=gl.getError;gl.getError=()=>gl.OUT_OF_MEMORY;try{h.afterFrame();}finally{gl.getError=original;}});await recovered('out of memory');results.syntheticMemoryFallback=true;await shot(phone,'07-phone-synthetic-memory-fallback');
  // A failure in safe mode remains visible; it must never reload in a loop.
  const safeUrl=phone.url();
  await phone.evaluate(()=>{window.qaSafeDocument=true;cosmos.engine.graphics.problem('Synthetic safe-mode failure');});
  await phone.waitForTimeout(1000);
  results.safeFailureDoesNotLoop=await phone.evaluate(()=>window.qaSafeDocument&&cosmos.engine.graphics.failures===1&&document.getElementById('graphics-problem').textContent.includes('safe mode failed'));
  assert.equal(phone.url(),safeUrl);assert.equal(results.safeFailureDoesNotLoop,true);
  const logs=(await readFile(join(temp,'client-errors.log'),'utf8')).trim().split('\n').map(JSON.parse);assert.ok(logs.some(r=>r.reason.includes('clear color')));assert.ok(logs.some(r=>r.reason.includes('context lost')));assert.ok(logs.some(r=>r.reason.includes('Shader compile')));assert.ok(logs.some(r=>r.reason.includes('out of memory')));assert.ok(logs.some(r=>r.tier==='safe'&&r.reason==='Synthetic safe-mode failure'));assert.ok(logs.every(r=>Object.keys(r).sort().join(',')==='at,browser,gpu,reason,tier'));results.diagnostics=logs;
  }
  assert.deepEqual(errors,[]);console.log('Two-player browser checks passed',JSON.stringify(results.networkJitter));
}finally{
  await writeFile(join(out,movementOnly?'movement-results.json':'browser-results.json'),JSON.stringify({results,errors},null,2));await browser?.close();await app?.close();await rm(temp,{recursive:true,force:true});
}
