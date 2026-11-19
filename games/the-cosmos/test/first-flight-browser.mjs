// The first take-off as a new player meets it on a phone (part 1, the last stretch): the lifeboat has just come alive on your pad.
// From there with real taps only: find the way in, find the pilot seat, lift off, see the ground fall away, come back down, and be told
// what to do next. Every beat saves a picture and the words on screen and checks what a stranger trips on (first-hour-browser.mjs has
// the same checks for the stretch before this one). iPhone profile (WebKit, 375 px) and an Android profile (Chromium, 360 px, sound).
// Run: node test/first-flight-browser.mjs      (OUT=<folder>; ONLY=iphone|android; WORLD=ceres|mars)
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
import { RIDE_SECONDS } from '../src/opening/state.js';
let pw;try{pw=createRequire(import.meta.url)('playwright');}catch{pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright');}
const out=process.env.OUT||fileURLToPath(new URL('../docs/qa/2026-11-19/first-flight/',import.meta.url));await mkdir(out,{recursive:true});
const WEBKIT=process.env.COSMOS_WEBKIT||join(process.env.LOCALAPPDATA||'','ms-playwright','webkit-2336','Playwright.exe');
const IPHONE={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const CHROME=process.env.COSMOS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const GALAXY={userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const WORLD=process.env.WORLD||'ceres',ONLY=process.env.ONLY||'',SKY=process.env.SKY||'day';
const errors=[],beats=[],checks=[];let app,webkit,chrome,clock=Date.now();
const check=(name,ok,detail='')=>{checks.push({name,ok:!!ok,detail});console.log((ok?'ok   ':'FAIL ')+name+(detail?'  '+detail:''));};
try{
  app=await startServer({adapter:new MemoryAdapter(),port:0,tick:false,now:()=>clock});
  if(process.env.TRACE){const act=app.world.action.bind(app.world);app.world.action=async(id,aid,a)=>{const r=await act(id,aid,a);if(a.type!=='pose')console.log('   >',a.type,JSON.stringify(r).slice(0,160));return r;};}
  if(ONLY!=='android')webkit=await pw.webkit.launch({headless:true,executablePath:WEBKIT});
  if(ONLY!=='iphone')try{chrome=await pw.chromium.launch({headless:true,executablePath:CHROME,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl','--autoplay-policy=no-user-gesture-required']});}catch(e){console.log('no Chromium: the Android pass is skipped ('+String(e.message).slice(0,80)+')');}
  const url=q=>app.url.replace('ws:','http:')+'/?ws='+app.url+'&dev=1&sky=live&tier=low&'+q;
  let ctx,page,tag='';
  const open=async(browser,profile,name)=>{tag=name;ctx=await browser.newContext(profile);page=await ctx.newPage();
    page.on('pageerror',e=>errors.push(name+': '+String(e)+' @ '+String(e.stack||'').split(/\r?\n/).slice(0,2).join(' | ')));
    page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push(name+' console: '+m.text().slice(0,300));});
    page.on('response',r=>{const p=new URL(r.url()).pathname;if(r.status()>=400&&!/^\/(_vercel\/|hb-editor\.js|manifest\.webmanifest)/.test(p))errors.push(name+' HTTP '+r.status()+' '+p);});
    if(process.env.TRACE){page.on('framenavigated',f=>console.log('   NAV',f.url().slice(0,120)));await page.exposeFunction('__why',t=>console.log('   WHY',t));await page.addInitScript(()=>{addEventListener('pagehide',()=>{try{window.__why(document.body.innerText.match(/Graphics problem.{0,200}/)?.[0]||'no graphics line');}catch{}});});page.on('console',m=>{if(m.type()!=='log')console.log('   CON',m.type(),m.text().slice(0,200));});}
    await page.addInitScript(()=>{window.__sounds=0;for(const C of [window.AudioContext,window.webkitAudioContext])if(C){for(const k of ['createOscillator','createBufferSource']){const f=C.prototype[k];C.prototype[k]=function(...a){window.__sounds++;return f.apply(this,a);};}}});};
  const hasAudio=()=>page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext));
  const sounds=()=>page.evaluate(()=>window.__sounds);
  const heard=async(name,run)=>{if(!await hasAudio()){await run();return;}const a=await sounds();await run();const b=await sounds();check(tag+': a sound answers '+name,b>a,`${b-a} started`);};
  const ready=async(q='')=>{await page.goto(url(q));await page.waitForFunction(()=>window.cosmos?.opening&&cosmos.engine.frameCount>=2,null,{timeout:150000});
    await page.evaluate(async()=>{cosmos.engine.stop();if(cosmos.opening.active)await cosmos.opening.ready;cosmos.step(0);});};
  const step=async seconds=>{for(let left=seconds;left>1e-7;){const chunk=Math.min(live?.5:2,left);left-=chunk;clock+=chunk*1000;
    await page.evaluate(async seconds=>{const k=cosmos,r=k.engine.renderer,render=r.render;r.render=()=>{};
      try{for(let t=0;t<seconds-1e-7;t+=1/30)k.step(Math.min(1/30,seconds-t));await k.opening.pending;}finally{r.render=render;}k.step(0);},chunk);
    // the authority runs on the test's clock too: its ships move only when it is advanced, and it sends the new state when asked to save
    if(live){await app.world.enqueue(async()=>{for(let t=0;t<chunk-1e-7;t+=.1)app.world.advance(Math.min(.1,chunk-t));});await page.evaluate(()=>{try{cosmos.world.socket.send(JSON.stringify({type:'checkpoint'}));}catch{}});await page.waitForTimeout(30);}}};let live=false;
  const st=()=>page.evaluate(()=>({stage:cosmos.opening.state.stage,active:cosmos.opening.active}));
  const screen=()=>page.evaluate(()=>{const vis=el=>{if(!el||el.hidden)return false;const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<.05)return false;const r=el.getBoundingClientRect();return r.width>2&&r.height>2&&r.bottom>0&&r.top<innerHeight;};
    const box=el=>{const r=el.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)];};
    const buttons=[...document.querySelectorAll('button,[role=button],a.btn')].filter(el=>{for(let p=el;p;p=p.parentElement)if(!vis(p))return false;return true;}).map(el=>({id:el.id||el.className||'',text:(el.textContent||'').trim().slice(0,60),box:box(el)}));
    const words={};for(const [k,sel] of Object.entries({toast:'#toast,.toast',goal:'.goal-edge-tag',next:'#hud .next-goal',note:'#ship-note,.ship-note',status:'#hud'})){const el=document.querySelector(sel);if(el&&vis(el)&&el.textContent.trim())words[k]={text:el.textContent.trim().replace(/\s+/g,' ').slice(0,k==='status'?500:260),box:box(el)};}
    return {buttons,words,scrollW:document.documentElement.scrollWidth,w:innerWidth,h:innerHeight};});
  const KEY=/\((?:[A-Z]|Space|Shift|Esc|Tab|Enter)\)|\bW ?A ?S ?D\b|\bpress [A-Z]\b|\bmouse\b|\bclick\b|\bkey\b/;
  const beat=async name=>{await page.evaluate(()=>cosmos.step(0));const s=await screen();await page.screenshot({path:join(out,`${tag}-${String(beats.length).padStart(2,'0')}-${name}.png`)});
    const bad=[];for(const b of s.buttons){const [l,t,r,bt]=b.box;if(KEY.test(b.text))bad.push(`key letter on a touch button: "${b.text}"`);
      if(r>s.w+1||l<-1||bt>s.h+1||t<-1)bad.push(`button off screen: "${b.text||b.id}" ${b.box}`);else if(b.text&&(r-l<40||bt-t<40))bad.push(`button too small to tap: "${b.text||b.id}" ${r-l}x${bt-t}`);}
    for(const [k,w] of Object.entries(s.words)){if(KEY.test(w.text))bad.push(`${k} names a key on a phone: "${(w.text.match(new RegExp('.{0,30}(?:'+KEY.source+').{0,20}'))||[''])[0]}"`);if(k!=='status'&&(w.box[2]>s.w+1||w.box[0]<-1))bad.push(`${k} runs off the side`);}
    if(s.scrollW>s.w+1)bad.push('sideways scroll '+s.scrollW);
    beats.push({name:tag+' '+name,words:s.words,buttons:s.buttons,bad});check(tag+': beat '+name,bad.length===0,bad.join(' ; '));
    console.log('     '+Object.entries(s.words).map(([k,w])=>k+': '+w.text).join(' | ')+'\n     ['+s.buttons.map(b=>(b.text||b.id)+'@'+b.box.join(',')).join('; ')+']');return s;};
  const pid=()=>page.evaluate(()=>cosmos.world.playerId);
  const jump=async(patch,q='')=>{const id=await page.evaluate(()=>{cosmos.engine.stop();const w=cosmos.world,id=w.playerId;w.socket.onclose=null;w.socket.close();return id;});
    await new Promise(r=>setTimeout(r,400));const p=app.world.state.players[id];Object.assign(p.opening,typeof patch==='function'?patch(p.opening,p):patch);await app.world.commit();await ready(q);return id;};
  const waitDone=async(max=60)=>{for(let i=0;i<max*2;i++){if(!(await st()).active)return true;await step(.5);}return false;};
  const until=async(fn,n=16)=>{for(let i=0;i<n;i++){if(await fn())return true;await page.waitForTimeout(120);await step(.5);}return false;};
  const tapEl=async sel=>{const box=await page.locator(sel).first().boundingBox();if(!box)throw new Error(sel+' is not on screen');await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await step(.6);};
  const tapText=async re=>{const s=await screen(),b=s.buttons.find(b=>re.test(b.text));if(!b)return false;await page.touchscreen.tap((b.box[0]+b.box[2])/2,(b.box[1]+b.box[3])/2);await step(.6);return true;};
  const hold=async(sel,seconds)=>{const box=await page.locator(sel).first().boundingBox();if(!box)throw new Error(sel+' is not on screen');
    const c=await page.context().newCDPSession?.(page).catch(()=>null);const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.evaluate(({sel,x,y})=>{const el=document.querySelector(sel);el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:77,pointerType:'touch',clientX:x,clientY:y}));},{sel,x,y});
    await step(seconds);
    await page.evaluate(({sel,x,y})=>{const el=document.querySelector(sel);el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:77,pointerType:'touch',clientX:x,clientY:y}));},{sel,x,y});await step(.3);void c;};
  const me=()=>page.evaluate(()=>{const c=cosmos,s=c.ship;return {aboard:!!s.aboard,seat:s.seat?.id||null,airborne:!!s.flight.airborne,alt:s.flight.altitude??s.flight.alt??null,speed:s.flight.speed,frame:c.space.frameId,drained:c.world.snapshot?.ships?.[c.world.snapshot.players[c.world.playerId].shipId]?.drained};});

  const run=async(browser,profile,name)=>{
    await open(browser,profile,name);await ready();const id=await pid();
    // straight to the last seconds of the ride home, then the lifeboat fitted by the authority (first-hour-browser.mjs plays those for real)
    await jump({played:true,dest:{world:WORLD,faction:WORLD==='ceres'?'greenhaven':null,stay:WORLD==='mars'},driver:WORLD==='ceres'?'greenhaven':null});await step(1);
    if(!await tapText(/Skip intro/))throw new Error('no Skip intro button');await tapText(/^(Yes|Skip|OK)/);
    check(name+': the opening ends at home',await waitDone(60));await page.waitForFunction(()=>!document.querySelector('.opening-transition'),null,{timeout:15000}).catch(()=>{});await step(2);
    const P=()=>app.world.state.players[id],ship=()=>app.world.state.ships[P().shipId];
    // the real Sun on the real clock, turned to the hour the run asks for (SKY=day: 35 degrees up; SKY=night: 30 under), so the pictures do not depend on when the test runs
    const sun=()=>page.evaluate(({deg,day})=>{const c=cosmos,el=()=>{const f=c.walker.updateFrame(),s=c.space.sunLocal;return Math.asin(Math.max(-1,Math.min(1,s.x*f.up.x+s.y*f.up.y+s.z*f.up.z)))*180/Math.PI;};
      let best=0,be=1e9;for(let t=0;t<day;t+=day/120){c.setSkyShift(t);c.step(1/30);const d=Math.abs(el()-deg);if(d<be){be=d;best=t;}}c.setSkyShift(best);for(let i=0;i<10;i++)c.step(1/30);return Math.round(el());},{deg:SKY==='night'?-30:35,day:WORLD==='ceres'?32668:88775});
    console.log('Sun at '+await sun()+' degrees ('+SKY+')');
    await app.world.dispatch?.(id,{type:'noop'}).catch?.(()=>{});
    console.log('ship',JSON.stringify({id:P().shipId,type:ship()?.type,drained:ship()?.drained,frame:ship()?.frameId,repair:ship()?.repair,home:P().home}));
    const sim=()=>app.world.sims.get(P().shipId);
    const standAt=async(wp,settle=2.5)=>{P().pose.worldPos=wp;await app.world.commit();await page.evaluate(w=>{Object.assign(cosmos.walker.worldPos,w);cosmos.walker.velocity={x:0,y:0,z:0};cosmos.walker.updateFrame();},wp);await step(settle);};
    const THUMB={id:71,x:80,y:Math.round(profile.viewport.height*.76)};
    const thumb=(type,dy=0,dx=0)=>page.evaluate(({t,type,dy,dx})=>{document.querySelector('canvas').dispatchEvent(new PointerEvent(type,{pointerId:t.id,pointerType:'touch',isPrimary:false,clientX:t.x+dx,clientY:t.y-dy,bubbles:true,cancelable:true}));},{t:THUMB,type,dy,dx});
    // the two parts are in hand (first-hour-browser.mjs buys them for real); the fitting is the real button
    // (as one server action, so a pose in flight cannot roll it back)
    {const w=app.world,rd=w.reduce;w.reduce=function(){w.reduce=rd;ship().repair={need:['cell','coupler'],have:['cell','coupler']};return {ok:true,msg:'test: both parts in hand'};};await w.action(id,'test-grant-parts-'+name,{type:'test-grant'});}
    {const f=sim().flight,h=f.heading||0;void h;}
    await standAt(await page.evaluate(()=>cosmos.ship.flight.toWorld({x:5,y:.3,z:11},{})));
    live=true;
    check(name+': by the boat with both parts the button says Fit',await until(()=>page.evaluate(()=>/^Fit/.test(document.querySelector('#btn-action')?.textContent||'')),40));
    await beat('pad-both-parts-at-the-boat');
    await heard('fitting the parts',async()=>{await tapEl('#btn-action');await step(1.5);});
    check(name+': the lifeboat has power',await until(()=>ship().drained===false));
    await until(()=>page.evaluate(()=>document.body.innerText.includes('Power on')));
    const s0=await beat('pad-she-flies');
    check(name+': told how to get in (the words name the ramp)',/ramp/i.test(s0.words.next?.text||''),(s0.words.next?.text||'').slice(0,160));
    await step(8);const s1=await beat('pad-a-moment-later');
    check(name+': an arrow with a name leads to the ramp',/ramp/i.test(s1.words.goal?.text||''),JSON.stringify(s1.words.goal||{}).slice(0,160));
    check(name+': step 1 of 4 is named',/Step 1 of 4/.test(s1.words.next?.text||''),(s1.words.next?.text||'').slice(0,120));
    // walk in by the thumb: stand 9 m behind the rear ramp, facing the ship, hold the stick forward
    const behind=await page.evaluate(()=>{const f=cosmos.ship.flight,r=cosmos.ship.def.ramps.cargo,z=r.hinge.z+r.length+5;const p=f.toWorld?f.toWorld({x:0,y:.2,z}):null;return {p,heading:f.heading};});
    console.log('behind',JSON.stringify(behind));
    await standAt(behind.p,1);await page.evaluate(h=>{cosmos.walker.yaw=h;cosmos.walker.pitch=0;cosmos.step(0);},behind.heading);await step(.5);await beat('pad-behind-the-ramp');
    // the wrist remote works the ramp from outside on any world (it answered "Walk over to them first" everywhere but Mars)
    const rampDown=()=>page.evaluate(()=>cosmos.ship.state.ramps.cargo.lowered);
    if(/ramp/i.test(await page.evaluate(()=>document.querySelector('#btn-action')?.textContent||''))){
      await tapEl('#btn-action');check(name+': outside, the button raises the ramp',await until(async()=>!(await rampDown())));
      await step(2);const up=await beat('pad-ramp-up');check(name+': with the ramp up, step 1 says to lower it',/Lower ramp/.test(up.words.next?.text||''),(up.words.next?.text||'').slice(0,140));
      await tapEl('#btn-action');check(name+': and lowers it again',await until(async()=>await rampDown()));await step(4);
    }else check(name+': behind the ship the button offers the ramp',false,await page.evaluate(()=>document.querySelector('#btn-action')?.textContent||''));
    await thumb('pointerdown');await thumb('pointermove',60);
    const boarded=await until(async()=>(await me()).aboard,30);await thumb('pointerup');
    check(name+': walking up the ramp with a thumb boards the lifeboat',boarded,JSON.stringify(await me()));
    await step(1);const s2=await beat('aboard-first-look');
    check(name+': aboard, step 2 names the pilot seat and the way to it',/Step 2 of 4.*pilot.*FLIGHT/i.test(s2.words.next?.text||''),(s2.words.next?.text||'').slice(0,200));
    // on through the cabin to the cockpit with the thumb held, steering the view at each turn as a player does (the cabin table stands in the straight line)
    const walkTo=async(x,z,near=.45)=>{for(let i=0;i<40;i++){const d=await page.evaluate(({x,z})=>{const sw=cosmos.ship.sw,dx=x-sw.x,dz=z-sw.z;sw.yaw=Math.atan2(dx,-dz);return Math.hypot(dx,dz);},{x,z});if(d<near)return true;await step(.2);}return false;};
    await thumb('pointerdown');await thumb('pointermove',60);
    let reached=true;for(const [x,z] of [[.55,2.7],[.55,.1],[-.6,-1.7],[-.6,-3.0],[-.9,-3.6]])reached=await walkTo(x,z)&&reached;
    await thumb('pointerup');await page.evaluate(()=>{cosmos.ship.sw.yaw=0;});await step(.6);
    check(name+': the cockpit is reached on foot with the thumb',reached,JSON.stringify(await page.evaluate(()=>({x:+cosmos.ship.sw.x.toFixed(2),z:+cosmos.ship.sw.z.toFixed(2)}))));
    const s3=await beat('cockpit-at-the-seat');
    check(name+': at the seat the one button offers it',/Sit/.test(s3.buttons.map(b=>b.text).join('|')),s3.buttons.map(b=>b.text).join(', ').slice(0,200));
    await heard('sitting down',()=>tapEl('#btn-action'));await step(2);
    check(name+': seated at the pilot station',(await me()).seat==='pilot',JSON.stringify(await me()));
    const s4=await beat('seated-pilot');if(process.env.TRACE)console.log('LAMPS',await page.evaluate(()=>JSON.stringify(cosmos.engine.scene.children.filter(o=>o.isSpotLight||o.isPointLight).map(o=>[o.type,+o.intensity.toFixed(2),o.distance,o.position.toArray().map(v=>+v.toFixed(1)),o.target?o.target.position.toArray().map(v=>+v.toFixed(1)):0]))));
    check(name+': seated, step 3 says what lifts her',/Step 3 of 4.*LIFT/.test(s4.words.next?.text||''),(s4.words.next?.text||'').slice(0,160));
    check(name+': no server talk on screen (seat, boarding)',!/seat request|boarding action/i.test(JSON.stringify(s4.words)+JSON.stringify(s2.words)));
    const fl=()=>page.evaluate(()=>{const f=cosmos.ship.flight;return {landed:!!f.landed,airborne:!!f.airborne,agl:Math.round((f.agl??f.altitudeAGL??f.height??-1)*10)/10,speed:+(f.speed||0).toFixed(1),ramp:cosmos.ship.state.ramps.cargo.lowered,keys:Object.keys(f).filter(k=>/alt|agl|height|land|air/i.test(k)).join(',')};});
    console.log('flight',JSON.stringify(await fl()));
    await heard('the lift',()=>hold('#btn-lift',6));console.log('flight after 6 s of LIFT',JSON.stringify(await fl()));await beat('lift-held-6s');
    await hold('#btn-lift',8);console.log('flight after 14 s',JSON.stringify(await fl()));const s5=await beat('lift-up');
    check(name+': in the air, step 4 says how to fly and how to land',/Step 4 of 4.*LAND/.test(s5.words.next?.text||''),(s5.words.next?.text||'').slice(0,160));
    check(name+': off Mars the airspace line does not say Mars',WORLD==='mars'||!/Mars neutral/.test(s5.words.status?.text||''),(s5.words.status?.text||'').slice(0,200));
    check(name+': holding LIFT takes her off the pad',(await fl()).airborne,JSON.stringify(await fl()));
    await step(6);await beat('hover-let-go');console.log('flight let go 6 s',JSON.stringify(await fl()));
    await tapEl('#fb-land');await step(2);await beat('land-assist-tapped');
    const down=await until(async()=>(await fl()).landed,80);console.log('flight end',JSON.stringify(await fl()));
    check(name+': LAND brings her back down',down);
    await heard('the first landing',()=>step(3));const s6=await beat('landed-again');
    check(name+': the game says the first flight is done',await until(()=>page.evaluate(()=>document.body.innerText.includes('first flight'))));
    check(name+': and the card moves on to work',await until(async()=>!/Step \d of 4/.test(await page.evaluate(()=>document.querySelector('#hud .next-goal')?.textContent||''))),(s6.words.next?.text||'').slice(0,120));
    await page.evaluate(async()=>{await new Promise(r=>setTimeout(r,300));});live=false;await ready();live=true;await step(1);await sun();await step(3);const s7=await beat('after-a-refresh');
    check(name+': after a refresh she is still aboard her own ship, and the flying lesson does not start again',!/Step \d of 4/.test(s7.words.next?.text||'')&&(await me()).aboard,JSON.stringify(await me())+' '+(s7.words.next?.text||'').slice(0,100));

    return id;
  };
  if(webkit)await run(webkit,IPHONE,'iphone');
  if(chrome)await run(chrome,GALAXY,'android');
  check('no errors in the whole run',errors.length===0,errors.slice(0,4).join(' || '));
}catch(e){check('the run finished',false,String(e.stack||e).slice(0,900));process.exitCode=1;}
finally{
  const failed=checks.filter(c=>!c.ok);
  await writeFile(join(out,'first-flight-results.json'),JSON.stringify({passed:failed.length===0,failed:failed.length,checks,beats,errors},null,1));
  console.log(`\nfirst flight: ${checks.length-failed.length}/${checks.length} checks passed`);if(failed.length)process.exitCode=1;
  await webkit?.close();await chrome?.close();await app?.close();
}
