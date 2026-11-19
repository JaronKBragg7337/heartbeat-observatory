// Probe: what a phone sees from a Kestrel pose during the flight. node test/_kestrel-view-probe.mjs <outDir> <x> <z> <yaw> [pitch] [world]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
let pw;try{pw=createRequire(import.meta.url)('playwright');}catch{pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright');}
const [out,x,z,yaw,pitch='0',world='ceres']=process.argv.slice(2);await mkdir(out,{recursive:true});
const WEBKIT=process.env.COSMOS_WEBKIT||join(process.env.LOCALAPPDATA||'','ms-playwright','webkit-2336','Playwright.exe');
const IPHONE={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true};
let clock=Date.now();const app=await startServer({adapter:new MemoryAdapter(),port:0,tick:false,now:()=>clock});
const webkit=await pw.webkit.launch({headless:true,executablePath:WEBKIT});
try{
  const page=await(await webkit.newContext(IPHONE)).newPage();page.on('pageerror',e=>console.log('ERR',String(e)));
  const url=app.url.replace('ws:','http:')+'/?ws='+app.url+'&dev=1&tier=low';
  const ready=async()=>{await page.goto(url);await page.waitForFunction(()=>window.cosmos?.opening&&cosmos.engine.frameCount>=2,null,{timeout:150000});await page.evaluate(async()=>{cosmos.engine.stop();if(cosmos.opening.active)await cosmos.opening.ready;cosmos.step(0);});};
  const step=async s=>{for(let left=s;left>1e-7;){const c=Math.min(2,left);left-=c;clock+=c*1000;await page.evaluate(async s=>{const k=cosmos,r=k.engine.renderer,render=r.render;r.render=()=>{};try{for(let t=0;t<s-1e-7;t+=1/30)k.step(Math.min(1/30,s-t));await k.opening.pending;}finally{r.render=render;}k.step(0);},c);}};
  await ready();
  const id=await page.evaluate(()=>{cosmos.engine.stop();const w=cosmos.world,id=w.playerId;w.socket.onclose=null;w.socket.close();return id;});await new Promise(r=>setTimeout(r,400));
  Object.assign(app.world.state.players[id].opening,{stage:2,clock:0,played:true,dest:{world,faction:null,stay:false},driver:world==='ceres'?'ironclad':null,pose:{x:+x,y:0,z:+z,yaw:+yaw,pitch:+pitch}});await app.world.commit();await ready();
  let t=0;for(const at of [6,14,22,30,40,50,57]){await step(at-t);t=at;await page.screenshot({path:join(out,`t${String(at).padStart(2,'0')}.png`)});console.log('shot',at,await page.evaluate(()=>cosmos.opening.kestrel.currentRoom));}
}finally{await webkit.close();await app.close();}
