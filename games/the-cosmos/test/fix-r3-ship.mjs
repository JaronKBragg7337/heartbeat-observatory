// Fix round 3: the drained lifeboat in the pilot seat (iPhone WebKit): HUD message, COURSE tap, guidance. Usage: node test/fix-r3-ship.mjs <before|after>
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {startServer} from '../server/index.mjs';
import {MemoryAdapter} from '../src/world-state/storage.js';
const pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules')('playwright');
const tag=process.argv[2]||'after';
const exe=process.env.COSMOS_WEBKIT_EXE||join(process.env.LOCALAPPDATA,'ms-playwright','webkit-2336','Playwright.exe');
const out=join('docs','qa','2026-10-04','fix-r3');await mkdir(out,{recursive:true});
const W=+process.env.W||390,H=+process.env.H||844;
let clock=Date.now();
const app=await startServer({adapter:new MemoryAdapter(),port:0,tick:false,now:()=>clock});
const browser=await pw.webkit.launch({headless:true,executablePath:exe});
const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const url=app.url.replace('ws:','http:')+'/?ws='+app.url+'&dev=1&tier=low';
const res={};const shot=n=>page.screenshot({path:join(out,`${n}-${tag}.png`)});
async function step(seconds){for(let left=seconds;left>1e-7;){const chunk=Math.min(2,left);left-=chunk;clock+=chunk*1000;
  await page.evaluate(async s=>{const k=cosmos,r=k.engine.renderer,render=r.render;r.render=()=>{};try{for(let t=0;t<s-1e-7;t+=1/30)k.step(Math.min(1/30,s-t));await k.opening?.pending;}finally{r.render=render;}k.step(0);},chunk);}}
try{
  await page.goto(url);await page.waitForFunction(()=>window.cosmos?.opening&&cosmos.engine.frameCount>=2,null,{timeout:150000});
  await page.evaluate(async()=>{cosmos.engine.stop();if(cosmos.opening.active)await cosmos.opening.ready;cosmos.step(0);});
  let PID;const WORLD=process.env.WORLD||'ceres';
  { const pid0=await page.evaluate(()=>cosmos.world.playerId);await page.evaluate(()=>{cosmos.world.socket.onclose=null;cosmos.world.socket.close();});await new Promise(r=>setTimeout(r,400));
    const p=app.world.state.players[pid0],ship=app.world.state.ships[p.shipId];
    Object.assign(p.opening,{complete:true,stage:7,dest:{world:WORLD,faction:null,stay:WORLD==='mars'},played:true});
    app.world.arriveFromOpening(p,ship);await app.world.commit();res.arrived={frame:p.frameId,home:p.home?.world};PID=pid0; }
  if(process.env.SEATED!=='0'){  const pid=PID;
  { const p=app.world.state.players[pid],ship=app.world.state.ships[p.shipId],sim=app.world.sims.get(ship.id),seat=sim.def.seats.find(s=>s.id==='pilot');
    p.aboardShipId=ship.id;p.currentShipId=ship.id;p.pose.aboard=true;p.frameId=sim.frameId;p.pose.seat='pilot';Object.assign(p.pose.sw,{x:seat.x,y:seat.y,z:seat.z,yaw:0});sim.flight.toWorld(p.pose.sw,p.pose.worldPos);
    res.sat={drained:ship.drained,type:sim.def.id};await app.world.commit(); }
}
  // a fresh page load as the lifeboat player (the real game reloads into her cockpit class once the opening is over)
  await page.evaluate(()=>{cosmos.world.socket.onclose=null;cosmos.world.socket.close();});await new Promise(r=>setTimeout(r,400));
  await page.goto(url);await page.waitForFunction(()=>window.cosmos?.ship?.ready&&cosmos.engine.frameCount>=2,null,{timeout:150000});
  res.clientType=await page.evaluate(()=>cosmos.ship.def.type);
  await new Promise(r=>setTimeout(r,2500));await shot('ship-arrival');
  res.hudArrival=await page.evaluate(()=>document.getElementById('hud').innerText);
  await new Promise(r=>setTimeout(r,4000));await page.evaluate(()=>{cosmos.ship.flight.power.engines=0;});await new Promise(r=>setTimeout(r,1500));
  res.snap=await page.evaluate(()=>{const w=cosmos.world,p=w.snapshot.players[w.playerId];return {seat:p.pose?.seat,shipAboard:cosmos.ship.aboard,seated:cosmos.ship.stations.seated,engines:cosmos.ship.flight.power.engines};});
  res.dbg=await page.evaluate(()=>{const w=cosmos.world,p=w.snapshot.players[w.playerId],sh=w.snapshot.ships[p.shipId];return {remote:w.remote,opening:p.opening,home:p.home,drained:sh.drained,crew:sh.crew,frames:cosmos.engine.frameCount,hasNext:!!document.querySelector('.next-goal')};});
  res.hud=await page.evaluate(()=>document.getElementById('hud').innerText);
  res.dom=await page.evaluate(()=>[...document.querySelectorAll('#chip-course,#fl-read,#fl-warn,.fly')].map(e=>e.id+':'+getComputedStyle(e).display));
  res.panel=await page.evaluate(()=>{const r=document.getElementById('fl-read'),w=document.getElementById('fl-warn');return {text:r?.innerText,warn:w?.innerText,warnRect:w&&JSON.stringify(w.getBoundingClientRect()),vw:innerWidth};});
  await shot('ship-pilot-seat');
  // tap COURSE with a real tap; the page must keep answering
  const t0=Date.now();
  await page.locator('#chip-course').tap({timeout:20000}).catch(e=>{res.tapError=String(e).slice(0,120);});
  const alive=await Promise.race([page.evaluate(()=>cosmos.engine.frameCount).then(()=>true),new Promise(r=>setTimeout(()=>r(false),15000))]);
  res.courseTap={alive,ms:Date.now()-t0};
  if(alive){await new Promise(r=>setTimeout(r,1200));res.sheet=await page.evaluate(()=>{const e=document.getElementById('space-sheet');let err=null;try{cosmos.space.ui.draw(true);}catch(x){err=String(x)+' '+String(x.stack).split('\n').slice(0,4).join('|');}return {text:e?.innerText?.slice(0,300),html:e?.innerHTML?.length,display:e&&getComputedStyle(e).display,err,open:cosmos.space.ui.open};});await shot('ship-course-sheet');}
  // the cockpit chairs from the front, the side and behind (standing, not seated); engine stopped and stepped by hand so the headless GPU draws it
  await page.evaluate(()=>{cosmos.engine.stop();const s=cosmos.ship;s.stations.seated=null;s.onStationChange?.();});
  for(const [name,x,z,yaw,pitch] of [['cockpit-from-front',0,-2.9,Math.PI,-.1],['cockpit-from-side',-1.75,-4.0,-Math.PI/2,-.2],['cockpit-from-behind',0,-3.0,0,-.15]]){
    await page.evaluate(([x,z,yaw,pitch])=>{const s=cosmos.ship;s.sw.place(x,0,z,yaw);s.sw.pitch=pitch;},[x,z,yaw,pitch]);await step(.4);await shot(name);}
}catch(e){res.error=String(e).slice(0,300);}
finally{await writeFile(join(out,`ship-${tag}.json`),JSON.stringify({res,errors},null,1));console.log(JSON.stringify({res,errors},null,1));try{await Promise.race([browser.close(),new Promise(r=>setTimeout(r,5000))]);}catch{}process.exit(0);}
