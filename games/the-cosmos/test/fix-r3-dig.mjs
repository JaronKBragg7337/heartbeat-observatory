// Fix round 3: the opening Dig tap with a REAL phone tap, from awkward looks (horizon, up, sideways, close, 2.7 m, 3.5 m).
// Usage: node test/fix-r3-dig.mjs <before|after>
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {startServer} from '../server/index.mjs';
import {MemoryAdapter} from '../src/world-state/storage.js';
const pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules')('playwright');
const tag=process.argv[2]||'after';
const exe=process.env.COSMOS_WEBKIT_EXE||join(process.env.LOCALAPPDATA,'ms-playwright','webkit-2336','Playwright.exe');
const out=join('docs','qa','2026-10-04','fix-r3');await mkdir(out,{recursive:true});
let clock=Date.now();
const app=await startServer({adapter:new MemoryAdapter(),port:0,tick:false,now:()=>clock});
const browser=await pw.webkit.launch({headless:true,executablePath:exe});
const ctx=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const url=app.url.replace('ws:','http:')+'/?ws='+app.url+'&dev=1&tier=low';
const results=[];
async function ready(){await page.goto(url);await page.waitForFunction(()=>window.cosmos?.opening&&cosmos.engine.frameCount>=2,null,{timeout:150000});
  await page.evaluate(async()=>{cosmos.engine.stop();if(cosmos.opening.active)await cosmos.opening.ready;cosmos.step(0);});}
async function step(seconds){for(let left=seconds;left>1e-7;){const chunk=Math.min(2,left);left-=chunk;clock+=chunk*1000;
  await page.evaluate(async s=>{const k=cosmos,r=k.engine.renderer,render=r.render;r.render=()=>{};try{for(let t=0;t<s-1e-7;t+=1/30)k.step(Math.min(1/30,s-t));await k.opening.pending;}finally{r.render=render;}k.step(0);},chunk);}}
try{
  await ready();
  const pid=await page.evaluate(()=>{cosmos.engine.stop();const w=cosmos.world,id=w.playerId;w.socket.onclose=null;w.socket.close();return id;});
  await new Promise(r=>setTimeout(r,400));
  const looks=[{n:'horizon',x:4,z:17.8,yaw:0,pitch:0},{n:'sky',x:5.2,z:18.5,yaw:1,pitch:.9},{n:'sideways',x:2.5,z:19.2,yaw:-1.5,pitch:-.2},{n:'back turned',x:4,z:18.4,yaw:3.1,pitch:0},{n:'far down',x:6,z:20,yaw:1.57,pitch:-1.3},{n:'at feet',x:4,z:19.6,yaw:0,pitch:-1.1}];
  for(const L of looks){
    const p=app.world.state.players[pid];Object.assign(p.opening,{stage:4,clock:0,cuts:[],carriedCrate:false,played:true,pose:{x:L.x,y:.03,z:L.z,yaw:L.yaw,pitch:L.pitch}});await app.world.commit();
    await ready();await step(1.2);
    const before=await page.evaluate(()=>({cuts:cosmos.opening.state.cuts.length,label:cosmos.opening.actionLabel,d:Math.hypot(cosmos.opening.model.pose().x-4,cosmos.opening.model.pose().z-20)}));
    const marker=await page.evaluate(()=>cosmos.opening.digMark?.group.visible??'none');
    if(L.n==='at feet'||L.n==='horizon')await page.screenshot({path:join(out,`marker-${L.n.replace(/\W+/g,'-')}-${tag}.png`)});
    let made=[];
    for(let i=0;i<14&&!(await page.evaluate(()=>cosmos.opening.model.exposed()));i++){
      const n0=await page.evaluate(()=>cosmos.opening.state.cuts.length);
      const visible=await page.locator('#opening-action').isVisible();
      if(!visible){made.push('no-button');break;}
      await page.locator('#opening-action').tap();
      await page.evaluate(async()=>{const o=cosmos.opening;for(let i=0;i<200&&(o.actionPending||o.busy);i++)await new Promise(r=>setTimeout(r,10));});
      await step(.3);
      made.push((await page.evaluate(()=>cosmos.opening.state.cuts.length))-n0);
    }
    const cutInfo=await page.evaluate(()=>cosmos.opening.state.cuts.length);
    await page.screenshot({path:join(out,`dig-${L.n.replace(/\W+/g,'-')}-${tag}.png`)});
    results.push({look:L.n,markerVisibleBeforeTap:marker,before,cutsPerTap:made,pass:made.every(m=>m===1)});
  }
}finally{await browser.close();await app.close?.();}
await writeFile(join(out,`dig-${tag}.json`),JSON.stringify({results,errors},null,1));
console.log(JSON.stringify({results,errors},null,1));process.exit(0);
