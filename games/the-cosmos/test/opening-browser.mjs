// Isolated Chromium walkthrough. Output and filenames use scene numbers only.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
let chromium;try{({chromium}=createRequire(import.meta.url)('playwright'));}catch{({chromium}=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||join(homedir(),'.codex/runtime/unfinished-island/node_modules/'))('playwright'));}
const out=fileURLToPath(new URL('../docs/qa/2026-10-02/opening/',import.meta.url));await mkdir(out,{recursive:true});
let app,browser,clock=Date.now();const errors=[],results={};
try{
  console.log('Opening QA: starting isolated authority');
  app=await startServer({adapter:new MemoryAdapter(),port:0,tick:false,now:()=>clock});
  browser=await chromium.launch({headless:true,...(process.env.COSMOS_CHROME||process.platform==='win32'?{executablePath:process.env.COSMOS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
  const url=q=>app.url.replace('ws:','http:')+'/?dev=1&ws='+app.url+'&'+q;
  async function make(phone=false){
    const ctx=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:720},isMobile:phone,hasTouch:phone});
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
    page.on('response',r=>{if(r.status()>=400&&/\/(src|lib|assets|homes\/people)\//.test(new URL(r.url()).pathname))errors.push('HTTP '+r.status()+' '+new URL(r.url()).pathname);});
    return {ctx,page};
  }
  async function ready(page,q){await page.goto(url(q));await page.waitForFunction(()=>window.cosmos?.opening&&cosmos.engine.frameCount>=2,null,{timeout:120000});
    await page.evaluate(async()=>{cosmos.engine.stop();if(cosmos.opening.active)await cosmos.opening.ready;cosmos.step(0);});}
  async function step(page,seconds){
    for(let left=seconds;left>1e-7;){const chunk=Math.min(1,left);left-=chunk;clock+=chunk*1000;
      await page.evaluate(async seconds=>{const c=cosmos,r=c.engine.renderer,render=r.render;r.render=()=>{};
        try{for(let t=0;t<seconds-1e-7;t+=1/60)c.step(Math.min(1/60,seconds-t));await c.opening.pending;}finally{r.render=render;}c.step(0);
      },chunk);
    }
  }
  const scene=async(p,prefix,n)=>{await p.evaluate(()=>cosmos.step(0));await p.screenshot({path:join(out,`${prefix}-scene-${n}.png`)});};
  async function thumb(page,down){await page.evaluate(down=>{const c=document.getElementById('game-canvas');
    if(down){c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:91,pointerType:'touch',clientX:80,clientY:650,bubbles:true}));c.dispatchEvent(new PointerEvent('pointermove',{pointerId:91,pointerType:'touch',clientX:80,clientY:600,bubbles:true}));}
    else c.dispatchEvent(new PointerEvent('pointerup',{pointerId:91,pointerType:'touch',clientX:80,clientY:600,bubbles:true}));},down);}
  async function walkTo(page,x,z,touch=false){
    if(touch)await thumb(page,true);else await page.keyboard.down('KeyW');
    try{for(let i=0;i<120;i++){
      const distance=await page.evaluate(({x,z})=>{const m=cosmos.opening.model,p=m.pose(),target=m.toWorld(x,0,z),f=m.walker.updateFrame();
        const dx=target.x-m.walker.worldPos.x,dy=target.y-m.walker.worldPos.y,dz=target.z-m.walker.worldPos.z;
        m.walker.yaw=Math.atan2(dx*f.east.x+dy*f.east.y+dz*f.east.z,dx*f.north.x+dy*f.north.y+dz*f.north.z);return Math.hypot(p.x-x,p.z-z);},{x,z});
      if(distance<.2)break;await step(page,Math.min(.25,distance/2));
    }}finally{if(touch)await thumb(page,false);else await page.keyboard.up('KeyW');}
    return page.evaluate(({x,z})=>{const p=cosmos.opening.model.pose();return Math.hypot(p.x-x,p.z-z);},{x,z});
  }
  async function aim(page,x,z,y=.35){await page.evaluate(({x,y,z})=>{const m=cosmos.opening.model,w=m.walker,e=w.eyeWorldPos({}),p=m.toWorld(x,y,z),f=w.updateFrame();
    const d={x:p.x-e.x,y:p.y-e.y,z:p.z-e.z},l=Math.hypot(d.x,d.y,d.z),dot=v=>d.x*v.x+d.y*v.y+d.z*v.z;
    w.yaw=Math.atan2(dot(f.east),dot(f.north));w.pitch=Math.asin(dot(f.up)/l);cosmos.step(0);},{x,y,z});}
  const A=await make(),B=await make(),a=A.page,b=B.page;
  await ready(a,'tier=high');await ready(b,'tier=low');
  assert.ok(await a.evaluate(()=>cosmos.world.remote&&cosmos.opening.active));
  const aid=await a.evaluate(()=>cosmos.world.playerId),bid=await b.evaluate(()=>cosmos.world.playerId),shipId=app.world.state.players[aid].shipId;
  await b.evaluate(()=>cosmos.world.socket.close());await b.waitForFunction(()=>!cosmos.world.connected);
  results.reconnect=await b.evaluate(()=>{const c=cosmos,t=c.opening.elapsed;for(let i=0;i<30;i++)c.step(1/60);
    return {paused:c.opening.elapsed===t,visible:c.opening.caption.textContent.includes('Reconnecting')};});
  await b.waitForFunction(()=>cosmos.world.connected,null,{timeout:15000});
  results.reconnect.identity=await b.evaluate(id=>cosmos.world.playerId===id,bid);
  assert.ok(results.reconnect.paused&&results.reconnect.visible&&results.reconnect.identity);
  results.seating=await a.evaluate(async()=>{const THREE=await import('/lib/three.module.js'),o=cosmos.opening;
    return [o.driver,...o.passengers].map(p=>{let head;p.group.traverse(n=>{if(n.isBone&&/(^|[:_])head$/i.test(n.name))head=n;});
      p.group.updateWorldMatrix(true,true);return head?p.group.worldToLocal(head.getWorldPosition(new THREE.Vector3())).y+p.group.position.y:null;});
  });
  assert.ok(Math.abs(results.seating[0]-2)<.06&&results.seating.slice(1).every(h=>Math.abs(h-1.22)<.06),JSON.stringify(results.seating));
  await step(a,10);await a.evaluate(()=>cosmos.opening.syncFilm());await scene(a,'desktop',1);
  await a.evaluate(()=>{const o=cosmos.opening;o.sw.yaw=1.2;o.sw.pitch=0;cosmos.step(0);});await scene(a,'desktop','1-angle-2');
  await step(a,22);await scene(a,'desktop','1-angle-3');await step(a,22);
  assert.equal(await a.evaluate(()=>cosmos.opening.state.stage),1);
  await a.evaluate(()=>cosmos.opening.syncFilm(false));await scene(a,'desktop',2);
  await a.evaluate(()=>{cosmos.opening.sw.yaw=0;cosmos.step(0);});await scene(a,'desktop','2-angle-2');
  await a.evaluate(()=>cosmos.opening.sw.yaw=Math.PI);
  await a.keyboard.down('KeyW');await step(a,5);await a.keyboard.up('KeyW');
  assert.ok(await a.evaluate(()=>cosmos.opening.sw.z>12));await a.locator('#opening-action').click();await a.evaluate(()=>cosmos.opening.pending);
  assert.equal(await a.evaluate(()=>cosmos.opening.state.stage),2);
  assert.ok(await walkTo(a,4,18.5)<.3);await aim(a,4,20);await scene(a,'desktop',3);
  let bites=0;
  for(let round=0;round<7&&!await a.evaluate(()=>cosmos.opening.model.exposed());round++)for(const [x,z] of [[4,20],[4.18,20],[3.82,20],[4,20.18],[4,19.82]]){
    if(await a.evaluate(()=>cosmos.opening.model.exposed()))break;
    await aim(a,x,z);await a.locator('#opening-action').click();await a.evaluate(()=>cosmos.opening.pending);bites++;
  }
  assert.ok(await a.evaluate(()=>cosmos.opening.model.exposed()));
  results.scene3={bites,cuts:await a.evaluate(()=>cosmos.opening.state.cuts.length)};await scene(a,'desktop','3-angle-2');
  const pose=await a.evaluate(async()=>{await cosmos.opening.savePose();return cosmos.opening.pose();});
  await ready(a,'tier=high');
  results.refresh=await a.evaluate(p=>({stage:cosmos.opening.state.stage,exposed:cosmos.opening.model.exposed(),distance:Math.hypot(cosmos.opening.pose().x-p.x,cosmos.opening.pose().z-p.z),pitch:cosmos.opening.pose().pitch}),pose);
  assert.ok(results.refresh.exposed&&results.refresh.distance<.01);assert.equal(results.refresh.stage,2);
  await aim(a,-2600,-350,3);await scene(a,'desktop','3-angle-3');await aim(a,4,20);
  await a.locator('#opening-action').click();await a.evaluate(()=>cosmos.opening.pending);assert.equal(await a.evaluate(()=>cosmos.opening.state.stage),3);
  await step(a,10);assert.ok(await walkTo(a,-3.1,22.16)<.3);await aim(a,-6,22.2,1.9);await scene(a,'desktop',4);
  await a.locator('#opening-action').click();await a.evaluate(()=>cosmos.opening.pending);assert.equal(await a.evaluate(()=>cosmos.opening.state.stage),4);
  await step(a,33);await a.evaluate(()=>cosmos.opening.syncFilm());await scene(a,'desktop',5);
  await step(a,36);assert.equal(await a.evaluate(()=>cosmos.opening.active),false);
  await a.waitForFunction(()=>cosmos.world.state.opening.complete);await step(a,1);
  await a.waitForFunction(()=>!document.querySelector('.opening-transition'));
  assert.equal(app.world.state.players[bid].opening.complete,false);assert.equal(app.world.state.players[bid].opening.cuts.length,0);
  results.multiplayer={privateProgress:true,ownShip:app.world.state.players[aid].shipId===shipId,marks:app.world.state.ships[shipId].economy.marks};assert.equal(results.multiplayer.marks,10000);
  assert.equal(await a.evaluate(()=>cosmos.engine.scene.userData.privateOpening),undefined);
  await a.evaluate(()=>{const c=cosmos,p=c.world.snapshot.ships[c.world.snapshot.players[c.world.playerId].shipId].pad;
    c.freeCam.set(c.port.site.toWorld(p.x-19,8,p.z+30),c.ship.flight.pos);c.step(.016);});await scene(a,'desktop',6);
  // Review the actual built interior without changing the server-owned player pose.
  await a.evaluate(()=>{const c=cosmos;c.freeCam.set(c.ship.flight.toWorld({x:0,y:1.66,z:8},{}),c.ship.flight.toWorld({x:0,y:1.66,z:0},{}));c.step(.016);});await scene(a,'desktop','6-angle-2');
  const final=structuredClone(app.world.state.players[aid].pose);await ready(a,'tier=high');
  assert.equal(await a.evaluate(()=>cosmos.opening.active),false);assert.equal(await a.evaluate(()=>cosmos.world.snapshot.players[cosmos.world.playerId].shipId),shipId);
  const restored=app.world.state.players[aid].pose;
  assert.ok(Math.hypot(...['x','y','z'].map(k=>restored.worldPos[k]-final.worldPos[k]))<.01);
  assert.equal(restored.aboard,final.aboard);assert.equal(restored.seat,final.seat);results.returningSave=true;
  const P=await make(true),phone=P.page;await ready(phone,'tier=low&solo=1');
  const cdp=await P.ctx.newCDPSession(phone);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await step(phone,8);await scene(phone,'phone',1);await step(phone,45);
  // Touch movement uses the same canvas pointer handlers as a phone thumb.
  await phone.evaluate(()=>{const c=document.getElementById('game-canvas');c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:91,pointerType:'touch',clientX:80,clientY:650,bubbles:true}));c.dispatchEvent(new PointerEvent('pointermove',{pointerId:91,pointerType:'touch',clientX:80,clientY:588,bubbles:true}));});
  await step(phone,4);await phone.evaluate(()=>document.getElementById('game-canvas').dispatchEvent(new PointerEvent('pointerup',{pointerId:91,pointerType:'touch',clientX:80,clientY:588,bubbles:true})));
  assert.ok(await phone.evaluate(()=>cosmos.opening.sw.z>12));await scene(phone,'phone',2);
  await phone.locator('#opening-action').tap();await phone.evaluate(()=>cosmos.opening.pending);await scene(phone,'phone',3);
  results.phone=await phone.evaluate(()=>({stage:cosmos.opening.state.stage,calls:cosmos.engine.renderer.info.render.calls,triangles:cosmos.engine.renderer.info.render.triangles,failures:cosmos.engine.graphics.failures,actorsLoaded:[cosmos.opening.driver,...cosmos.opening.passengers].every(p=>p.loaded)}));
  assert.equal(results.phone.failures,0);assert.equal(results.phone.actorsLoaded,true);
  await ready(phone,'tier=safe&solo=1');await scene(phone,'phone-safe',3);
  results.safe=await phone.evaluate(()=>({active:cosmos.opening.active,stage:cosmos.opening.state.stage,failures:cosmos.engine.graphics.failures,calls:cosmos.engine.renderer.info.render.calls}));assert.equal(results.safe.stage,2);assert.equal(results.safe.failures,0);
  await ready(phone,'tier=low&solo=1');
  const pitch=await phone.evaluate(()=>cosmos.opening.model.walker.pitch);
  await phone.evaluate(()=>{const c=document.getElementById('game-canvas');for(const [type,y] of [['pointerdown',600],['pointermove',560],['pointerup',560]])c.dispatchEvent(new PointerEvent(type,{pointerId:92,pointerType:'touch',clientX:300,clientY:y,bubbles:true}));cosmos.step(.016);});
  assert.ok(Math.abs(await phone.evaluate(()=>cosmos.opening.model.walker.pitch)-pitch)>.05);results.phone.touchLook=true;
  assert.ok(await walkTo(phone,4,18.5,true)<.3);
  for(let i=0;i<35&&!await phone.evaluate(()=>cosmos.opening.model.exposed());i++){
    const [x,z]=[[4,20],[4.18,20],[3.82,20],[4,20.18],[4,19.82]][i%5];await aim(phone,x,z);await phone.locator('#opening-action').tap();await phone.evaluate(()=>cosmos.opening.pending);
  }
  assert.ok(await phone.evaluate(()=>cosmos.opening.model.exposed()));await phone.locator('#opening-action').tap();await phone.evaluate(()=>cosmos.opening.pending);
  await step(phone,10);assert.ok(await walkTo(phone,-3.1,22.16,true)<.3);await aim(phone,-6,22.2,1.9);await scene(phone,'phone',4);
  await phone.locator('#opening-action').tap();await phone.evaluate(()=>cosmos.opening.pending);await step(phone,33);await scene(phone,'phone',5);await step(phone,36);
  assert.equal(await phone.evaluate(()=>cosmos.opening.active),false);await phone.waitForFunction(()=>!document.querySelector('.opening-transition'));
  results.phone.complete=true;await scene(phone,'phone',6);
  results.rooms=await phone.evaluate(async()=>{
    const c=cosmos,s=c.ship,{planPath,RouteWalker}=await import('/src/crew/shipPath.js'),results=[];
    s.boardAt(0,0,8,0);s.state.airlock.innerOpen=true;s.state.airlock.outerOpen=false;
    const r=c.engine.renderer,render=r.render;r.render=()=>{};
    try{for(const room of s.def.layout.rooms){
      const targets=[];for(let x=room.x0+.45;x<room.x1-.3;x+=.4)for(let z=room.z0+.45;z<room.z1-.3;z+=.4)if(s.sw.canStand(x,room.y,z))targets.push({x,y:room.y,z});
      const cx=(room.x0+room.x1)/2,cz=(room.z0+room.z1)/2;targets.sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz));
      const target=targets[0],path=target&&planPath(s.sw,{x:s.sw.x,y:s.sw.y,z:s.sw.z},target,{reach:.25});
      if(!path){results.push({scene:6,room:results.length+1,walked:false});continue;}
      const walker=new RouteWalker(s.sw,[{type:'walk',pts:path.slice(1)}]);
      for(let i=0;i<6000&&!walker.done;i++){walker.step(1/60);s._doorsFrame(1/60,false);}
      s.sw.yaw=Math.atan2(cx-s.sw.x,-(cz-s.sw.z));
      results.push({scene:6,room:results.length+1,walked:walker.done&&s.sw.x>room.x0&&s.sw.x<room.x1&&s.sw.z>room.z0&&s.sw.z<room.z1,snaps:walker.snaps,
        pose:{x:s.sw.x,y:s.sw.y,z:s.sw.z,yaw:s.sw.yaw}});
    }}finally{r.render=render;}c.step(.016);return results;
  });
  assert.ok(results.rooms.length===7&&results.rooms.every(r=>r.walked&&r.snaps===0),JSON.stringify(results.rooms));await scene(phone,'phone','6-angle-2');
  for(const q of results.rooms){await phone.evaluate(p=>{cosmos.ship.sw.place(p.x,p.y,p.z,p.yaw);cosmos.step(.016);},q.pose);await scene(phone,'phone',`6-room-${q.room}`);}
  assert.equal(errors.length,0,errors.join('\n'));console.log('Opening QA:',JSON.stringify(results));
  await A.ctx.close();await B.ctx.close();await P.ctx.close();
}finally{await writeFile(join(out,'browser-results.json'),JSON.stringify({results,errors},null,2));await browser?.close();await app?.close();}
