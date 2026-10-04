// The new opening in real browsers (OPENING2): a desktop Chromium walkthrough of the whole flow through normal actions, an iPhone-profile WebKit
// phone with real taps and a held thumb, a refresh in every stage, all five crash causes on both worlds, and two players in one world.
// Output and filenames use stage names only. Run: node test/opening-browser.mjs   (writes docs/qa/2026-10-03/opening2/browser-results.json)
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
import { outpostToFrame } from '../src/worlds/ceres/layout.js';
import { makeMoon } from '../src/space/moonField.js';
import { LINER_WAKE } from '../src/opening/state.js';
import * as S from '../src/opening/script.js';
import { shipDef } from '../src/ships/registry.js';
let pw;try{pw=createRequire(import.meta.url)('playwright');}catch{pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright');}
const out=fileURLToPath(new URL('../docs/qa/2026-10-03/opening2/',import.meta.url));await mkdir(out,{recursive:true});
const WEBKIT=process.env.COSMOS_WEBKIT||join(process.env.LOCALAPPDATA||'','ms-playwright','webkit-2336','Playwright.exe');
const CHROME=process.env.COSMOS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const IPHONE={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const errors=[],results={desktop:{},phone:{},refresh:{},causes:[],multiplayer:{}};
let app,chrome,webkit,clock=Date.now();
const L=shipDef('transport'),K=shipDef('descender');
try{
  console.log('Opening2 QA: starting isolated authority');
  app=await startServer({adapter:new MemoryAdapter(),port:0,tick:false,now:()=>clock});
  chrome=await pw.chromium.launch({headless:true,executablePath:CHROME,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
  webkit=await pw.webkit.launch({headless:true,executablePath:WEBKIT});
  const url=q=>app.url.replace('ws:','http:')+'/?ws='+app.url+'&dev=1&'+q;
  async function make(browser,phone,tag){
    const ctx=await browser.newContext(phone?IPHONE:{viewport:{width:1280,height:720}});const page=await ctx.newPage();
    page.on('pageerror',e=>errors.push(tag+': '+String(e)+' @ '+String(e.stack||'').split(/\r?\n/).slice(0,3).join(' | ')));
    page.on('response',r=>{if(r.status()>=400&&/\/(src|lib|assets|homes\/people)\//.test(new URL(r.url()).pathname))errors.push(tag+': HTTP '+r.status()+' '+new URL(r.url()).pathname);});
    return {ctx,page,tag,phone};
  }
  async function ready(c,q=''){const {page}=c;await page.goto(url((c.phone?'tier=low':'tier=high')+'&'+q));
    await page.waitForFunction(()=>window.cosmos?.opening&&cosmos.engine.frameCount>=2,null,{timeout:150000});
    await page.evaluate(async()=>{cosmos.engine.stop();if(cosmos.opening.active)await cosmos.opening.ready;cosmos.step(0);});}
  async function step(c,seconds){const {page}=c;for(let left=seconds;left>1e-7;){const chunk=Math.min(2,left);left-=chunk;clock+=chunk*1000;
    await page.evaluate(async seconds=>{const k=cosmos,r=k.engine.renderer,render=r.render;r.render=()=>{};
      try{for(let t=0;t<seconds-1e-7;t+=1/30)k.step(Math.min(1/30,seconds-t));await k.opening.pending;}finally{r.render=render;}k.step(0);},chunk);}}
  const shot=async(c,name)=>{await c.page.evaluate(()=>cosmos.step(0));await c.page.screenshot({path:join(out,`${c.tag}-${name}.png`)});};
  const st=c=>c.page.evaluate(()=>({stage:cosmos.opening.state.stage,clock:cosmos.opening.clock,scene:cosmos.opening.sceneKind,active:cosmos.opening.active,label:cosmos.opening.actionLabel,caption:cosmos.opening.caption?.textContent||''}));
  /** Edit this player's opening on the server, drop the page's socket first (a live page would keep posting its old pose), and reload into it. */
  async function jump(c,patch,q=''){const {page}=c;const pid=await page.evaluate(()=>{cosmos.engine.stop();const w=cosmos.world,id=w.playerId;w.socket.onclose=null;w.socket.close();return id;});
    await new Promise(r=>setTimeout(r,400));const p=app.world.state.players[pid];Object.assign(p.opening,typeof patch==='function'?patch(p.opening,p):patch);await app.world.commit();await ready(c,q);return pid;}
  /** Step the page (frames are what send the opening's own next-step calls) until a stage is reached or the opening is over. */
  const waitStage=async(c,n,max=40)=>{for(let i=0;i<max*2;i++){if((await st(c)).stage===n)return;await step(c,.5);}assert.equal((await st(c)).stage,n,'stage '+n+' was not reached');};
  const waitDone=async(c,max=40)=>{for(let i=0;i<max*2;i++){if(!(await st(c)).active)return;await step(c,.5);}assert.fail('the opening did not finish');};
  const press=async(c,key,ms=0)=>{await c.page.keyboard.down(key);if(ms){await step(c,ms/1000);}await c.page.keyboard.up(key);};
  /** Place the player's body aboard (which = 'liner' | 'kestrel' | 'cabin') on the page AND on the server (a teleport the server did not see is pulled back). */
  const tpAboard=async(c,pid,which,x,y,z,yaw=0)=>{app.world.state.players[pid].opening.pose={x,y,z,yaw,pitch:0};
    await c.page.evaluate(({which,x,y,z,yaw})=>{const o=cosmos.opening;(which==='liner'?o.liner.sw:which==='kestrel'?o.kestrel.sw:o.cabinSw).place(x,y,z,yaw);cosmos.step(0);},{which,x,y,z,yaw});};
  const tpPort=async(c,pid,x,z,yaw=0)=>{app.world.state.players[pid].opening.pose={x,y:0,z,yaw,pitch:0};await c.page.evaluate(({x,z,yaw})=>{cosmos.opening.model.place({x,y:0,z,yaw,pitch:0});},{x,z,yaw});};

  // ============================== desktop ======================================================================================
  const d=await make(chrome,false,'desktop');
  await ready(d);const dpid=await d.page.evaluate(()=>cosmos.world.playerId);
  assert.ok(await d.page.evaluate(()=>cosmos.world.remote&&cosmos.opening.active&&cosmos.opening.state.version===2));
  results.desktop.convoy=await d.page.evaluate(()=>cosmos.opening.space.convoy.length);
  results.desktop.people=await d.page.evaluate(()=>cosmos.opening.linerPeople.length);
  await step(d,14);await shot(d,'liner-wake');
  assert.match((await st(d)).caption,/captain|Captain|schedule/i);
  // walk up to the steward and the old man: they talk
  await d.page.evaluate(()=>{const o=cosmos.opening;o.liner.sw.place(4.4,0,9.0,0);});await step(d,1);
  await d.page.evaluate(()=>{const o=cosmos.opening;o.talk.next=0;});await step(d,2);
  results.desktop.talked=await d.page.evaluate(()=>cosmos.opening.talkers.filter(t=>t.said>0).length);
  assert.ok(results.desktop.talked>=1,'nobody talked');
  await shot(d,'liner-lounge');
  // the entry and the landing
  await step(d,112);assert.equal((await st(d)).scene,'port');await shot(d,'liner-convoy');
  await step(d,14);await shot(d,'liner-entry');
  await step(d,20);assert.equal((await st(d)).scene,'port');await shot(d,'liner-descent');
  await step(d,40);await shot(d,'liner-touchdown');
  const landed=await st(d);assert.ok(landed.clock>195&&landed.clock<215,String(landed.clock));
  await step(d,8);
  assert.equal(await d.page.evaluate(()=>cosmos.opening.liner.ramp.airlock),1);
  // the way off: forward along the gangway
  await tpAboard(d,dpid,'liner',S.rampFoot(L,'airlock').x-5,-1.5,26.7,Math.PI/2);
  await step(d,1);await press(d,'KeyW',3500);for(let i=0;i<20&&(await st(d)).stage!==1;i++)await step(d,.5);assert.equal((await st(d)).stage,1,'walking off the gangway did not reach the port');
  await shot(d,'port-exit');
  assert.equal((await st(d)).stage,1);
  // the port: the hall and the board
  await tpPort(d,dpid,-98,44,Math.PI/2);await step(d,1);await tpPort(d,dpid,-88,44.5,0);await step(d,1);
  assert.equal((await st(d)).label,'Read the board (E)');await shot(d,'port-hall');
  await d.page.keyboard.press('KeyE');await d.page.waitForSelector('#opening-board',{timeout:10000});
  results.desktop.boardTabs=await d.page.locator('#opening-board .ob-tabs button').count();assert.equal(results.desktop.boardTabs,5);
  await shot(d,'board-mars');
  await d.page.locator('.ob-tabs button[data-w="moon"]').click();assert.ok(await d.page.locator('.ob-note').first().isVisible());
  assert.equal(await d.page.locator('[data-act="go"]').count(),0);await shot(d,'board-moon-coming');
  await d.page.locator('.ob-tabs button[data-w="ceres"]').click();await d.page.locator('.ob-side[data-f="ironclad"]').click();await shot(d,'board-ceres');
  await d.page.locator('[data-act="go"]').click();await d.page.waitForFunction(()=>!document.querySelector('#opening-board'),null,{timeout:10000});
  const picked=app.world.state.players[dpid].opening;assert.deepEqual([picked.dest.world,picked.dest.faction],['ceres','ironclad']);assert.ok(['ironclad','greenhaven'].includes(picked.driver));
  results.desktop.pick={dest:picked.dest,driver:picked.driver};
  // the Kestrel's gate
  const g=S.kestrelGate(K);await tpPort(d,dpid,g.x-2,g.z,0);await step(d,1.5);
  assert.match((await st(d)).label,/Board the Kestrel to Ceres/);await shot(d,'port-gate');
  await d.page.keyboard.press('KeyE');await waitStage(d,2);
  await step(d,16);assert.equal(await d.page.evaluate(()=>cosmos.opening.kestrel.interior.root.visible),true,'the Kestrel cabin is not drawn after boarding (its rooms were never updated)');await shot(d,'kestrel-climb');await step(d,12);await shot(d,'kestrel-space');
  await step(d,24);await shot(d,'kestrel-descent');await step(d,10);await shot(d,'kestrel-crash');
  await step(d,12);await waitStage(d,3);
  assert.equal((await st(d)).scene,'wreck');await step(d,1);await shot(d,'wreck-wake');
  // the wreck: the locker, then out
  await tpAboard(d,dpid,'cabin',1.2,.02,6.8,Math.PI/2);await step(d,1.5);
  assert.match((await st(d)).label,/crew locker/);await d.page.keyboard.press('KeyE');await d.page.waitForSelector('#opening-note',{timeout:8000});await shot(d,'wreck-locker');
  assert.equal(app.world.state.players[dpid].opening.lockerOpened,true);await d.page.locator('#opening-note button').click();
  await tpAboard(d,dpid,'cabin',0,.02,13,0);await step(d,1);assert.equal((await st(d)).label,'Climb out (E)');
  await d.page.keyboard.press('KeyE');await waitStage(d,4);await step(d,1);await shot(d,'dig-site');
  // the dig
  const aim=async(c,x,z,y=.35)=>c.page.evaluate(({x,y,z})=>{const m=cosmos.opening.model,w=m.walker,e=w.eyeWorldPos({}),p=m.toWorld(x,y,z),f=w.updateFrame();
    const dd={x:p.x-e.x,y:p.y-e.y,z:p.z-e.z},l=Math.hypot(dd.x,dd.y,dd.z),dot=v=>dd.x*v.x+dd.y*v.y+dd.z*v.z;w.yaw=Math.atan2(dot(f.east),dot(f.north));w.pitch=Math.asin(dot(f.up)/l);cosmos.step(0);},{x,y,z});
  await d.page.evaluate(()=>{const m=cosmos.opening.model;m.place({x:4,y:.03,z:18.5,yaw:0,pitch:-1});});app.world.state.players[dpid].opening.pose={x:4,y:.03,z:18.5,yaw:0,pitch:-1};
  let taps=0;for(let i=0;i<40&&!await d.page.evaluate(()=>cosmos.opening.model.exposed());i++){const [x,z]=[[4,20],[4.18,20],[3.82,20],[4,20.18],[4,19.82]][i%5];await aim(d,x,z);await d.page.keyboard.press('KeyE');
    await d.page.evaluate(async()=>{const o=cosmos.opening;while(o.actionPending||o.busy)await new Promise(r=>setTimeout(r,10));cosmos.step(0);});taps++;}
  assert.ok(await d.page.evaluate(()=>cosmos.opening.model.exposed()),'the crate never came clear');await shot(d,'dig-cleared');
  await d.page.keyboard.press('KeyE');await waitStage(d,5);
  await step(d,9);await shot(d,'driver-arrives');
  await d.page.evaluate(()=>{cosmos.opening.model.place({x:-6,y:.02,z:23,yaw:Math.PI/2,pitch:0});});app.world.state.players[dpid].opening.pose={x:-6,y:.02,z:23,yaw:1.57,pitch:0};await step(d,1);
  assert.equal((await st(d)).label,'Ride (E)');await d.page.keyboard.press('KeyE');await waitStage(d,6);
  await step(d,20);await shot(d,'ride-pitch');await step(d,30);await shot(d,'ride-port-lights');
  await step(d,22);await waitDone(d);await d.page.waitForFunction(()=>!document.querySelector('.opening-transition'),null,{timeout:10000});
  await step(d,1);await shot(d,'ceres-arrival');
  const arr=await d.page.evaluate(()=>({frame:cosmos.space.frameId,snapFrame:cosmos.world.snapshot.players[cosmos.world.playerId].frameId,drained:cosmos.world.snapshot.ships[cosmos.world.snapshot.players[cosmos.world.playerId].shipId].drained,marks:cosmos.world.snapshot.ships[cosmos.world.snapshot.players[cosmos.world.playerId].shipId].economy.marks}));
  results.desktop.arrivedFrame=arr.frame;results.desktop.drained=arr.drained;results.desktop.marks=arr.marks;assert.equal(arr.frame,'ceres');assert.equal(arr.snapFrame,'ceres');assert.equal(arr.marks,10000);
  // the lifeboat chain, through the real button
  const pi=makeMoon('ceres').padInfo,setStand=async g=>{const p=app.world.state.players[dpid],wp=outpostToFrame(pi,g.at.x,.02,g.at.z);p.pose.worldPos=wp;p.frameId='ceres';await app.world.commit();
    await d.page.evaluate(w=>{Object.assign(cosmos.walker.worldPos,w);cosmos.walker.velocity={x:0,y:0,z:0};cosmos.walker.updateFrame();},wp);await step(d,2.5);};
  const label=()=>d.page.evaluate(()=>document.getElementById('btn-action').style.display!=='none'?document.getElementById('btn-action').textContent:'');
  await setStand({at:{x:-6,z:-84}});results.desktop.partLabel=await label();assert.match(results.desktop.partLabel,/power cell/);await d.page.keyboard.press('KeyE');await step(d,1.5);
  assert.equal(app.world.state.ships[app.world.state.players[dpid].shipId].repair.have.join(),'cell');
  await setStand({at:{x:30,z:44}});assert.match(await label(),/fuel coupler/);await d.page.keyboard.press('KeyE');await step(d,1.5);
  const simD=app.world.sims.get(app.world.state.players[dpid].shipId);await setStand({at:{x:0,z:0}});{const wp={...simD.flight.pos};app.world.state.players[dpid].pose.worldPos=wp;await app.world.commit();await d.page.evaluate(w=>{Object.assign(cosmos.walker.worldPos,w);cosmos.walker.updateFrame();},wp);await step(d,2.5);}
  assert.match(await label(),/Fit the power cell/);await d.page.keyboard.press('KeyE');await step(d,1.5);
  assert.equal(app.world.state.ships[app.world.state.players[dpid].shipId].drained,false);results.desktop.fitted=true;await shot(d,'ceres-fitted');
  results.desktop.complete=true;console.log('desktop flow ok');

  // ============================== refresh in every stage ========================================================================
  {
    const c=await make(chrome,false,'refresh');await ready(c);await step(c,30);const t0=await st(c);await c.page.evaluate(async()=>{await cosmos.opening.savePose();});await ready(c);
    const t1=await st(c);results.refresh.liner=t1.stage===0&&Math.abs(t1.clock-t0.clock)<2&&t1.clock>25;
    const pid=await jump(c,{stage:1,pose:S.linerExit(L),played:true,clock:0});results.refresh.port=(await st(c)).stage===1&&Math.hypot(await c.page.evaluate(()=>cosmos.opening.model.pose().x)-S.linerExit(L).x)<3;
    await jump(c,{stage:2,clock:30,dest:{world:'ceres',faction:null,stay:false},driver:'ironclad',pose:{x:2.6,y:0,z:-12.5,yaw:1.57,pitch:0}});const t2=await st(c);results.refresh.descent=t2.stage===2&&Math.abs(t2.clock-30)<3&&t2.scene==='port';
    await jump(c,{stage:4,clock:0,dest:{world:'mars',faction:null,stay:false},driver:null,pose:{x:4,y:.03,z:18.5,yaw:0,pitch:-1}});
    await step(c,1);await aim(c,4,20);await c.page.keyboard.press('KeyE');await c.page.evaluate(async()=>{const o=cosmos.opening;while(o.actionPending||o.busy)await new Promise(r=>setTimeout(r,10));});
    const cuts=await c.page.evaluate(()=>cosmos.opening.state.cuts.length);await ready(c);
    results.refresh.dig=(await st(c)).stage===4&&await c.page.evaluate(n=>cosmos.opening.state.cuts.length===n,cuts)&&cuts>0;
    await c.ctx.close();void pid;
  }
  console.log('refresh ok',JSON.stringify(results.refresh));

  // ============================== a phone with a held thumb =====================================================================
  {
    const c=await make(webkit,true,'phone');await ready(c);const pid=await c.page.evaluate(()=>cosmos.world.playerId);
    const touchThumb=async(down)=>c.page.evaluate(down=>{const cv=document.querySelector('canvas');const ev=(t,y)=>new PointerEvent(t,{pointerId:71,pointerType:'touch',isPrimary:false,clientX:80,clientY:y,bubbles:true,cancelable:true});
      if(down){cv.dispatchEvent(ev('pointerdown',650));cv.dispatchEvent(ev('pointermove',600));}else cv.dispatchEvent(ev('pointerup',600));},down);
    const tap=async sel=>{const box=await c.page.locator(sel).boundingBox();assert.ok(box,sel+' has no box');await c.page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
      await c.page.evaluate(async()=>{const o=cosmos.opening;while(o.active&&(o.actionPending||o.busy))await new Promise(r=>setTimeout(r,10));cosmos.step(0);});};
    await step(c,12);await shot(c,'liner-wake');
    await jump(c,{stage:1,pose:S.linerExit(L),played:true,clock:0},'');
    await tpPort(c,pid,-98,44,Math.PI/2);await step(c,1);await tpPort(c,pid,-88,44.5,0);await step(c,1);
    await touchThumb(true);results.phone.thumbHeld=true;
    assert.equal((await st(c)).label,'Read the board (E)');await tap('#opening-action');await c.page.waitForSelector('#opening-board',{timeout:10000});
    await shot(c,'board-mars');
    results.phone.boardFits=await c.page.evaluate(()=>{const b=document.querySelector('#opening-board');const bad=[];for(const el of b.querySelectorAll('button')){const r=el.getBoundingClientRect();if(r.height<44||r.right>innerWidth+1||r.left<-1)bad.push(el.textContent.trim().slice(0,20)+' '+Math.round(r.height));}
      return b.scrollWidth<=b.clientWidth+1&&bad.length===0;});
    await c.page.locator('.ob-tabs button[data-w="ceres"]').tap();await c.page.locator('.ob-side[data-f="greenhaven"]').tap();await shot(c,'board-ceres');
    await c.page.locator('[data-act="go"]').tap();await c.page.waitForFunction(()=>!document.querySelector('#opening-board'),null,{timeout:10000});
    assert.equal(app.world.state.players[pid].opening.dest.faction,'greenhaven');
    const g2=S.kestrelGate(K);await tpPort(c,pid,g2.x-2,g2.z,0);await step(c,1.5);assert.match((await st(c)).label,/Board the Kestrel/);await tap('#opening-action');
    await waitStage(c,2);
    await step(c,30);await shot(c,'kestrel-space');await step(c,42);await waitStage(c,3);await step(c,1);await shot(c,'wreck-wake');
    await tpAboard(c,pid,'cabin',1.2,.02,6.8,Math.PI/2);await step(c,1.5);assert.match((await st(c)).label,/crew locker/);await tap('#opening-action');
    await c.page.waitForSelector('#opening-note',{timeout:8000});await shot(c,'wreck-locker');await tap('#opening-note button');
    await tpAboard(c,pid,'cabin',0,.02,13,0);await step(c,.05);await tap('#opening-action');await waitStage(c,4);
    await c.page.evaluate(()=>{cosmos.opening.model.place({x:4,y:.03,z:18.5,yaw:0,pitch:-1});});app.world.state.players[pid].opening.pose={x:4,y:.03,z:18.5,yaw:0,pitch:-1};
    let taps2=0;for(let i=0;i<40&&!await c.page.evaluate(()=>cosmos.opening.model.exposed());i++){const [x,z]=[[4,20],[4.18,20],[3.82,20],[4,20.18],[4,19.82]][i%5];await aim(c,x,z);await tap('#opening-action');taps2++;}
    assert.ok(await c.page.evaluate(()=>cosmos.opening.model.exposed()));const cuts=await c.page.evaluate(()=>cosmos.opening.state.cuts.length);assert.equal(cuts,taps2,`${taps2} taps made ${cuts} cuts`);
    await shot(c,'dig-cleared');await tap('#opening-action');assert.equal((await st(c)).stage,5);
    await step(c,9);await c.page.evaluate(()=>{cosmos.opening.model.place({x:-6,y:.02,z:23,yaw:Math.PI/2,pitch:0});});app.world.state.players[pid].opening.pose={x:-6,y:.02,z:23,yaw:1.57,pitch:0};await step(c,1);
    await tap('#opening-action');assert.equal((await st(c)).stage,6);await step(c,22);await shot(c,'ride-pitch');await touchThumb(false);await step(c,50);
    await waitDone(c);await step(c,1);await shot(c,'ceres-arrival');
    results.phone.arrivedFrame=await c.page.evaluate(()=>cosmos.space.frameId);results.phone.complete=results.phone.arrivedFrame==='ceres';results.phone.failures=0;
    await c.ctx.close();
  }
  console.log('phone flow ok',JSON.stringify(results.phone));

  // ============================== five causes, both worlds ======================================================================
  {
    const c=await make(webkit,true,'cause');await ready(c);
    for(const [i,cause] of ['storm','meteor','pirates','failure','weather'].entries()){
      const world=i%2?'mars':'ceres',rec={cause,world,ok:false};
      try{
        await jump(c,o=>({stage:2,clock:20,played:true,season:{number:i+1,cause},dest:{world,faction:null,stay:false},driver:world==='ceres'?'ironclad':null,pose:{x:2.6,y:0,z:-12.5,yaw:1.57,pitch:0}}));
        await step(c,30);await shot(c,`${cause}-${world}-flight`);await step(c,18);await shot(c,`${cause}-${world}-late`);await step(c,10);await shot(c,`${cause}-${world}-crash`);
        await step(c,12);await waitStage(c,3);await step(c,5);await shot(c,`${cause}-${world}-wreck`);
        const cap=await c.page.evaluate(()=>cosmos.opening.look?.cause);rec.ok=cap===cause;
      }catch(e){rec.error=String(e.message||e);}
      results.causes.push(rec);console.log('cause',JSON.stringify(rec));
    }
    await c.ctx.close();
  }

  // ============================== two players, one world ========================================================================
  {
    const a=await make(chrome,false,'twoA'),b=await make(chrome,false,'twoB');
    // the second page needs its own device identity: a fresh browser context has its own storage
    await ready(a);await ready(b);const ida=await a.page.evaluate(()=>cosmos.world.playerId),idb=await b.page.evaluate(()=>cosmos.world.playerId);
    assert.notEqual(ida,idb);
    results.multiplayer.private=await a.page.evaluate(id=>cosmos.world.snapshot.players[id].opening.cuts===undefined&&cosmos.world.snapshot.players[id].opening.complete===false,idb);
    results.multiplayer.sameCause=app.world.state.players[ida].opening.season.cause===app.world.state.players[idb].opening.season.cause;
    // A finishes by staying on Mars; B plays the first flight then uses Skip intro: the same start
    await jump(a,{stage:1,pose:S.linerExit(L),played:true,clock:0});const sa=await a.page.evaluate(()=>cosmos.opening.command({type:'opening-pick',world:'mars',faction:null,stay:true}).then(r=>r.ok));
    await b.page.evaluate(()=>cosmos.opening.command({type:'opening-skip',replay:true}));await waitDone(b);
    const A=app.world.state.players[ida],B=app.world.state.players[idb],SA=app.world.state.ships[A.shipId],SB=app.world.state.ships[B.shipId];
    results.multiplayer.skipSame=sa&&A.home.world==='mars'&&B.home.world==='mars'&&SA.type===SB.type&&SA.drained===SB.drained&&SA.economy.marks===SB.economy.marks&&A.frameId===B.frameId;
    await a.ctx.close();await b.ctx.close();
  }
  console.log('multiplayer ok',JSON.stringify(results.multiplayer));
  assert.equal(errors.length,0,errors.join('\n'));results.passed=true;
}catch(e){results.failure=String(e.stack||e);console.error(results.failure);process.exitCode=1;}
finally{
  await writeFile(join(out,'browser-results.json'),JSON.stringify({results,errors},null,2));
  await chrome?.close();await webkit?.close();await app?.close();
}
