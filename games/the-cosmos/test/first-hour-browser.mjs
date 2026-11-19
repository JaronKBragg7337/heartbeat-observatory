// The first hour as a new player sees it on a phone (part 1, production pass). An iPhone-profile WebKit page plays the opening from
// first launch to the fitted lifeboat with real taps, and at every beat saves a picture AND the words on screen, then checks the
// things a stranger needs: no key letters on a touch screen, every button big enough to tap and inside the screen, nothing overlapping
// the caption, no sideways scroll, no errors, and a refresh at every stage. A second, shorter pass does the same with a controller.
// Run: node test/first-hour-browser.mjs      (OUT=<folder> to choose where pictures go; default docs/qa/2026-11-19/first-hour/)
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
import * as S from '../src/opening/script.js';
import { shipDef } from '../src/ships/registry.js';
let pw;try{pw=createRequire(import.meta.url)('playwright');}catch{pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright');}
const out=process.env.OUT||fileURLToPath(new URL('../docs/qa/2026-11-19/first-hour/',import.meta.url));await mkdir(out,{recursive:true});
const WEBKIT=process.env.COSMOS_WEBKIT||join(process.env.LOCALAPPDATA||'','ms-playwright','webkit-2336','Playwright.exe');
const IPHONE={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const CHROME=process.env.COSMOS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const GALAXY={userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const errors=[],beats=[],checks=[];let app,webkit,chrome,clock=Date.now();
const L=shipDef('transport'),K=shipDef('descender');
const check=(name,ok,detail='')=>{checks.push({name,ok:!!ok,detail});console.log((ok?'ok   ':'FAIL ')+name+(detail?'  '+detail:''));};
try{
  app=await startServer({adapter:new MemoryAdapter(),port:0,tick:false,now:()=>clock});
  webkit=await pw.webkit.launch({headless:true,executablePath:WEBKIT});
  try{chrome=await pw.chromium.launch({headless:true,executablePath:CHROME,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl','--autoplay-policy=no-user-gesture-required']});}catch(e){console.log('no Chromium: the Android pass is skipped ('+String(e.message).slice(0,80)+')');}
  const url=q=>app.url.replace('ws:','http:')+'/?ws='+app.url+'&dev=1&tier=low&'+q;
  let ctx,page,tag='';
  const open=async(browser,profile,name)=>{tag=name;ctx=await browser.newContext(profile);page=await ctx.newPage();
    page.on('pageerror',e=>errors.push(name+': '+String(e)+' @ '+String(e.stack||'').split(/\r?\n/).slice(0,2).join(' | ')));
    page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push(name+' console: '+m.text().slice(0,300));});
    // the two site-wide scripts the deploy adds (analytics, the Edit button) do not exist on a local server, and the test authority's page server does not hand out the manifest (the site and server.js do: test/shell-browser.mjs checks it)
    page.on('response',r=>{const p=new URL(r.url()).pathname;if(r.status()>=400&&!/^\/(_vercel\/|hb-editor\.js|manifest\.webmanifest)/.test(p))errors.push(name+' HTTP '+r.status()+' '+p);});
    // count the sounds the page starts (every sound in ui/sfx.js begins with an oscillator or a noise source)
    await page.addInitScript(()=>{window.__sounds=0;for(const C of [window.AudioContext,window.webkitAudioContext])if(C){for(const k of ['createOscillator','createBufferSource']){const f=C.prototype[k];C.prototype[k]=function(...a){window.__sounds++;return f.apply(this,a);};}}});};
  await open(webkit,IPHONE,'iphone');
  const hasAudio=()=>page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext));
  const sounds=()=>page.evaluate(()=>window.__sounds);
  // (Playwright's WebKit build on Windows has no Web Audio at all: the sound checks count only where the browser can make sound; the Android pass below can.)
  const heard=async(name,run)=>{if(!await hasAudio()){await run();return;}const a=await sounds();await run();const b=await sounds();check(tag+': a sound answers '+name,b>a,`${b-a} started`);};
  const ready=async(q='')=>{await page.goto(url(q));await page.waitForFunction(()=>window.cosmos?.opening&&cosmos.engine.frameCount>=2,null,{timeout:150000});
    await page.evaluate(async()=>{cosmos.engine.stop();if(cosmos.opening.active)await cosmos.opening.ready;cosmos.step(0);});};
  const step=async seconds=>{for(let left=seconds;left>1e-7;){const chunk=Math.min(2,left);left-=chunk;clock+=chunk*1000;
    await page.evaluate(async seconds=>{const k=cosmos,r=k.engine.renderer,render=r.render;r.render=()=>{};
      try{for(let t=0;t<seconds-1e-7;t+=1/30)k.step(Math.min(1/30,seconds-t));await k.opening.pending;}finally{r.render=render;}k.step(0);},chunk);}};
  const st=()=>page.evaluate(()=>({stage:cosmos.opening.state.stage,active:cosmos.opening.active}));
  /** Everything a player can read or tap right now, with where it sits. */
  const screen=()=>page.evaluate(()=>{const vis=el=>{if(!el||el.hidden)return false;const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<.05)return false;const r=el.getBoundingClientRect();return r.width>2&&r.height>2&&r.bottom>0&&r.top<innerHeight;};
    const box=el=>{const r=el.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)];};
    const buttons=[...document.querySelectorAll('button,[role=button],a.btn')].filter(el=>{for(let p=el;p;p=p.parentElement)if(!vis(p))return false;return true;}).map(el=>({id:el.id||el.className||'',text:(el.textContent||'').trim().slice(0,60),box:box(el)}));
    const words={};for(const [k,sel] of Object.entries({caption:'.opening-caption,#opening-caption',hint:'.opening-hint,#opening-hint',toast:'#toast,.toast',goal:'.goal-edge-tag',next:'#hud .next-goal'})){const el=document.querySelector(sel);if(el&&vis(el)&&el.textContent.trim())words[k]={text:el.textContent.trim().slice(0,220),box:box(el)};}
    return {buttons,words,board:!!document.querySelector('#opening-board'),scrollW:document.documentElement.scrollWidth,w:innerWidth,h:innerHeight};});
  const KEY=/\((?:[A-Z]|Space|Shift|Esc|Tab|Enter)\)|\bW ?A ?S ?D\b|\bpress [A-Z]\b|\bmouse\b|\bclick\b/;
  const beat=async name=>{await page.evaluate(()=>cosmos.step(0));const s=await screen(),stg=await st();await page.screenshot({path:join(out,`${String(beats.length).padStart(2,'0')}-${name}.png`)});
    const bad=[];for(const b of s.buttons){const [l,t,r,bt]=b.box;if(KEY.test(b.text))bad.push(`key letter on a touch button: "${b.text}"`);
      if(r>s.w+1||l<-1||bt>s.h+1||t<-1)bad.push(`button off screen: "${b.text||b.id}" ${b.box}`);else if(b.text&&(r-l<40||bt-t<40))bad.push(`button too small to tap: "${b.text||b.id}" ${r-l}x${bt-t}`);}
    for(const [k,w] of Object.entries(s.words)){if(KEY.test(w.text))bad.push(`${k} names a key on a phone: "${w.text}"`);if(w.box[2]>s.w+1||w.box[0]<-1)bad.push(`${k} runs off the side`);}
    const cap=s.board?null:s.words.caption;if(cap)for(const b of s.buttons){const [l,t,r,bt]=b.box;if(l<cap.box[2]&&r>cap.box[0]&&t<cap.box[3]&&bt>cap.box[1])bad.push(`"${b.text||b.id}" covers the caption`);}
    if(s.scrollW>s.w+1)bad.push('sideways scroll '+s.scrollW);
    beats.push({name,stage:stg.stage,words:s.words,buttons:s.buttons,bad});check('beat '+name,bad.length===0,bad.join(' ; '));
    console.log('     '+Object.entries(s.words).map(([k,w])=>k+': '+w.text).join(' | ')+'  ['+s.buttons.map(b=>b.text||b.id).join(', ')+']');};
  const pid=()=>page.evaluate(()=>cosmos.world.playerId);
  const jump=async(patch,q='')=>{const id=await page.evaluate(()=>{cosmos.engine.stop();const w=cosmos.world,id=w.playerId;w.socket.onclose=null;w.socket.close();return id;});
    await new Promise(r=>setTimeout(r,400));const p=app.world.state.players[id];Object.assign(p.opening,typeof patch==='function'?patch(p.opening,p):patch);await app.world.commit();await ready(q);return id;};
  const waitStage=async(n,max=60)=>{for(let i=0;i<max*2;i++){if((await st()).stage===n)return true;await step(.5);}return false;};
  const waitDone=async(max=60)=>{for(let i=0;i<max*2;i++){if(!(await st()).active)return true;await step(.5);}return false;};
  const tap=async sel=>{const box=await page.locator(sel).boundingBox();if(!box)throw new Error(sel+' is not on screen');await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
    await page.evaluate(async()=>{const o=cosmos.opening;while(o.active&&(o.actionPending||o.busy))await new Promise(r=>setTimeout(r,10));cosmos.step(0);});};
  const tpAboard=async(id,which,x,y,z,yaw=0)=>{app.world.state.players[id].opening.pose={x,y,z,yaw,pitch:0};
    await page.evaluate(({which,x,y,z,yaw})=>{const o=cosmos.opening;(which==='liner'?o.liner.sw:which==='kestrel'?o.kestrel.sw:o.cabinSw).place(x,y,z,yaw);cosmos.step(0);},{which,x,y,z,yaw});};
  const tpPort=async(id,x,z,yaw=0)=>{app.world.state.players[id].opening.pose={x,y:0,z,yaw,pitch:0};await page.evaluate(({x,z,yaw})=>{cosmos.opening.model.place({x,y:0,z,yaw,pitch:0});},{x,z,yaw});};
  const aim=(x,z,y=.35)=>page.evaluate(({x,y,z})=>{const m=cosmos.opening.model,w=m.walker,e=w.eyeWorldPos({}),p=m.toWorld(x,y,z),f=w.updateFrame();
    const dd={x:p.x-e.x,y:p.y-e.y,z:p.z-e.z},l=Math.hypot(dd.x,dd.y,dd.z),dot=v=>dd.x*v.x+dd.y*v.y+dd.z*v.z;w.yaw=Math.atan2(dot(f.east),dot(f.north));w.pitch=Math.asin(dot(f.up)/l);cosmos.step(0);},{x,y,z});
  const refreshHolds=async name=>{const a=await st();await page.evaluate(async()=>{await cosmos.opening.savePose?.();});await ready();const b=await st();check('refresh keeps the place: '+name,b.stage===a.stage&&b.active===a.active,`stage ${a.stage} -> ${b.stage}`);};

  // ---- first launch -----------------------------------------------------------------------------------------------------------
  await ready();const id=await pid();
  await step(3);await beat('liner-first-seconds');
  await step(8);await beat('liner-how-to-move');
  await step(20);await beat('liner-walk-about');await refreshHolds('liner');
  await step(150);await beat('liner-coming-in');
  for(let i=0;i<40&&await page.evaluate(()=>cosmos.opening.liner.ramp.airlock<1);i++)await step(2);
  await beat('liner-landed-doors-open');
  await tpAboard(id,'liner',S.rampFoot(L,'airlock').x-5,-1.5,26.7,Math.PI/2);await step(1);await beat('liner-gangway');
  // ---- the port ---------------------------------------------------------------------------------------------------------------
  await jump({stage:1,pose:S.linerExit(L),played:true,clock:0});await step(2);await beat('port-just-off-the-liner');
  await step(62);await beat('port-after-a-minute-lost');
  await tpPort(id,-98,44,Math.PI/2);await step(1);await tpPort(id,-88,44.5,0);await step(1);await beat('port-at-the-board');await refreshHolds('port');
  await tpPort(id,-88,44.5,0);await step(1);
  await heard('opening the board',()=>tap('#opening-action'));await page.waitForSelector('#opening-board',{timeout:10000});await beat('board-open');
  await page.locator('.ob-tabs button[data-w="ceres"]').tap();await page.locator('.ob-side[data-f="greenhaven"]').tap();await beat('board-ceres-picked');
  await heard('choosing a world',async()=>{await page.locator('[data-act="go"]').tap();await page.waitForFunction(()=>!document.querySelector('#opening-board'),null,{timeout:10000});});await step(1);await beat('port-after-choosing');
  const g=S.kestrelGate(K);await tpPort(id,g.x-2,g.z,0);await step(1.5);await beat('port-kestrel-gate');
  await tap('#opening-action');check('boarding reaches the flight',await waitStage(2));
  // ---- the flight and the crash -----------------------------------------------------------------------------------------------
  await step(8);await beat('kestrel-seated');await step(12);await beat('kestrel-climb');await step(12);await beat('kestrel-space');await refreshHolds('flight');
  await step(18);await beat('kestrel-trouble');await heard('the crash',async()=>{await step(10);});await beat('kestrel-going-down');
  check('the crash reaches the wreck',await waitStage(3,90));await step(1);await beat('wreck-wake');await step(8);await beat('wreck-how-to-move');await refreshHolds('wreck');
  await tpAboard(id,'cabin',1.2,.02,6.8,Math.PI/2);await step(1.5);await beat('wreck-at-locker');
  await tap('#opening-action');await page.waitForSelector('#opening-note',{timeout:8000});await beat('wreck-locker-note');await tap('#opening-note button');
  await tpAboard(id,'cabin',0,.02,13,0);await step(.05);await beat('wreck-hatch');await tap('#opening-action');check('climbing out reaches the dig',await waitStage(4));
  // ---- the dig, the ride ------------------------------------------------------------------------------------------------------
  await step(2);await beat('dig-outside-first-look');
  await page.evaluate(()=>{cosmos.opening.model.place({x:4,y:.03,z:18.5,yaw:0,pitch:-1});});app.world.state.players[id].opening.pose={x:4,y:.03,z:18.5,yaw:0,pitch:-1};await step(.5);await aim(4,20);await beat('dig-at-crate');
  for(let i=0;i<40&&!await page.evaluate(()=>cosmos.opening.model.exposed());i++){const [x,z]=[[4,20],[4.18,20],[3.82,20],[4,20.18],[4,19.82]][i%5];await aim(x,z);if(i===0)await heard('a shovel bite',()=>tap('#opening-action'));else await tap('#opening-action');if(i===2)await beat('dig-halfway');}
  await beat('dig-cleared');await refreshHolds('dig');
  await page.evaluate(()=>{cosmos.opening.model.place({x:4,y:.03,z:18.5,yaw:0,pitch:-1});});app.world.state.players[id].opening.pose={x:4,y:.03,z:18.5,yaw:0,pitch:-1};await step(.5);await aim(4,20);
  await heard('lifting the crate',()=>tap('#opening-action'));check('carrying the crate calls the ride',await waitStage(5));await step(3);await beat('contact-waiting');
  await step(8);await beat('contact-driver-here');
  await page.evaluate(()=>{cosmos.opening.model.place({x:-6,y:.02,z:23,yaw:Math.PI/2,pitch:0});});app.world.state.players[id].opening.pose={x:-6,y:.02,z:23,yaw:1.57,pitch:0};await step(1);await beat('contact-at-the-truck');
  await tap('#opening-action');check('the ride starts',await waitStage(6));await step(20);await beat('ride-talk');await refreshHolds('ride');
  await step(40);await beat('ride-port-in-sight');
  await heard('arriving home',async()=>{check('the opening ends at the home port',await waitDone(90));});await page.waitForFunction(()=>!document.querySelector('.opening-transition'),null,{timeout:15000}).catch(()=>{});
  // ---- your own pad -----------------------------------------------------------------------------------------------------------
  await step(2);await beat('home-arrival');await step(10);await beat('home-what-now');
  await page.evaluate(async()=>{await new Promise(r=>setTimeout(r,300));});await ready();await step(2);await beat('home-after-refresh');
  check('after a refresh the opening does not start again',!(await st()).active);
  await ctx.close();
  // ---- an Android phone (Chromium, touch): the same game, and this browser can make sound, so the key beats are listened for -------------
  if(chrome){
    await open(chrome,GALAXY,'android');await ready();const aid=await pid();
    await step(4);await beat('android-liner');
    await jump({stage:1,pose:S.linerExit(L),played:true,clock:0});await tpPort(aid,-98,44,Math.PI/2);await step(1);await tpPort(aid,-88,44.5,0);await step(1);
    await heard('opening the board',()=>tap('#opening-action'));await page.waitForSelector('#opening-board',{timeout:10000});await beat('android-board');
    await page.locator('.ob-tabs button[data-w="ceres"]').tap();await page.locator('.ob-side[data-f="ironclad"]').tap();
    await heard('choosing a world',async()=>{await page.locator('[data-act="go"]').tap();await page.waitForFunction(()=>!document.querySelector('#opening-board'),null,{timeout:10000});});
    await jump({stage:2,clock:52,dest:{world:'ceres',faction:'ironclad',stay:false},driver:'ironclad',pose:{x:2.65,y:0,z:-13.5,yaw:1.57,pitch:0}});await step(2);await beat('android-kestrel-window');
    await heard('the crash',async()=>{await step(9);});check('android: the crash reaches the wreck',await waitStage(3,90));
    await jump({stage:4,clock:0,pose:{x:4,y:.03,z:18.5,yaw:0,pitch:-1}});await step(1);await aim(4,20);await beat('android-dig');
    await heard('a shovel bite',()=>tap('#opening-action'));
    for(let i=1;i<40&&!await page.evaluate(()=>cosmos.opening.model.exposed());i++){const [x,z]=[[4,20],[4.18,20],[3.82,20],[4,20.18],[4,19.82]][i%5];await aim(x,z);await tap('#opening-action');}
    await aim(4,20);await heard('lifting the crate',()=>tap('#opening-action'));check('android: carrying the crate calls the ride',await waitStage(5));
    await step(9);await page.evaluate(()=>{cosmos.opening.model.place({x:-6,y:.02,z:23,yaw:Math.PI/2,pitch:0});});app.world.state.players[aid].opening.pose={x:-6,y:.02,z:23,yaw:1.57,pitch:0};await step(1);await beat('android-truck');
    await heard('climbing in',()=>tap('#opening-action'));check('android: the ride starts',await waitStage(6));
    await heard('arriving home',async()=>{await step(70);check('android: the opening ends at the home port',await waitDone(90));});
    await page.waitForFunction(()=>!document.querySelector('.opening-transition'),null,{timeout:15000}).catch(()=>{});await step(6);await beat('android-home');
    await ctx.close();
  }
  check('no errors in the whole run',errors.length===0,errors.slice(0,4).join(' || '));
}catch(e){check('the run finished',false,String(e.stack||e).slice(0,600));process.exitCode=1;}
finally{
  const failed=checks.filter(c=>!c.ok);
  await writeFile(join(out,'first-hour-results.json'),JSON.stringify({passed:failed.length===0,failed:failed.length,checks,beats,errors},null,1));
  console.log(`\nfirst hour: ${checks.length-failed.length}/${checks.length} checks passed`);if(failed.length)process.exitCode=1;
  await webkit?.close();await chrome?.close();await app?.close();
}
