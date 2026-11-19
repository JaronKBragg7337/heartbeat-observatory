// A controller plays the opening (part 1): a fake standard gamepad drives the real page from the liner to the ride home, with no key,
// mouse or touch at all. Sticks walk and look, X uses what the one button offers, the D-pad moves a focus ring across the arrivals
// board and A picks. Desktop Chromium (a console or a PC with a pad). first-hour-browser.mjs plays the same beats by touch.
// Run: node test/gamepad-opening-browser.mjs      (OUT=<folder> for pictures; default docs/qa/2026-11-19/gamepad-opening/)
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
import * as S from '../src/opening/script.js';
import { shipDef } from '../src/ships/registry.js';
let pw;try{pw=createRequire(import.meta.url)('playwright');}catch{pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright');}
const out=process.env.OUT||fileURLToPath(new URL('../docs/qa/2026-11-19/gamepad-opening/',import.meta.url));await mkdir(out,{recursive:true});
const CHROME=process.env.COSMOS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FAKE=`(() => { const pad = { id: "Test pad", index: 0, connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad; navigator.getGamepads = () => [pad]; window.padBtn = (i, on) => { pad.buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; }; })()`;
const errors=[],checks=[];let app,chrome,clock=Date.now(),shots=0;
const L=shipDef('transport'),K=shipDef('descender');
const check=(name,ok,detail='')=>{checks.push({name,ok:!!ok,detail});console.log((ok?'ok   ':'FAIL ')+name+(detail?'  '+detail:''));};
try{
  app=await startServer({adapter:new MemoryAdapter(),port:0,tick:false,now:()=>clock});
  chrome=await pw.chromium.launch({headless:true,executablePath:CHROME,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl','--autoplay-policy=no-user-gesture-required']});
  const url=q=>app.url.replace('ws:','http:')+'/?ws='+app.url+'&dev=1&tier=low&'+q;
  const ctx=await chrome.newContext({viewport:{width:1280,height:720}}),page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(String(e)+' @ '+String(e.stack||'').split(/\r?\n/).slice(0,2).join(' | ')));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('console: '+m.text().slice(0,300));});
  await page.addInitScript(FAKE);
  const ready=async(q='')=>{await page.goto(url(q));await page.waitForFunction(()=>window.cosmos?.opening&&cosmos.engine.frameCount>=2,null,{timeout:150000});
    await page.evaluate(async()=>{cosmos.engine.stop();if(cosmos.opening.active)await cosmos.opening.ready;cosmos.step(0);});};
  const step=async seconds=>{for(let left=seconds;left>1e-7;){const chunk=Math.min(2,left);left-=chunk;clock+=chunk*1000;
    await page.evaluate(async seconds=>{const k=cosmos,r=k.engine.renderer,render=r.render;r.render=()=>{};
      try{for(let t=0;t<seconds-1e-7;t+=1/30)k.step(Math.min(1/30,seconds-t));await k.opening.pending;}finally{r.render=render;}k.step(0);},chunk);}};
  const st=()=>page.evaluate(()=>({stage:cosmos.opening.state.stage,active:cosmos.opening.active}));
  const shot=async name=>{await page.evaluate(()=>cosmos.step(0));await page.screenshot({path:join(out,`${String(shots++).padStart(2,'0')}-${name}.png`)});};
  const jump=async(patch,q='')=>{const id=await page.evaluate(()=>{cosmos.engine.stop();const w=cosmos.world,id=w.playerId;w.socket.onclose=null;w.socket.close();return id;});
    await new Promise(r=>setTimeout(r,400));const p=app.world.state.players[id];Object.assign(p.opening,typeof patch==='function'?patch(p.opening,p):patch);await app.world.commit();await ready(q);
    await page.evaluate(()=>{__pad.axes[2]=.5;});await step(.1);await page.evaluate(()=>{__pad.axes[2]=0;});await step(.1);return id;};      // (a new page: the pad is noticed again at its first touch)
  const waitStage=async(n,max=60)=>{for(let i=0;i<max*2;i++){if((await st()).stage===n)return true;await step(.5);}return false;};
  const press=async i=>{await page.evaluate(i=>padBtn(i,true),i);await step(.1);await page.evaluate(i=>padBtn(i,false),i);
    await page.evaluate(async()=>{const o=cosmos.opening;for(let n=0;n<300&&o.active&&(o.actionPending||o.busy);n++)await new Promise(r=>setTimeout(r,10));cosmos.step(0);});await step(.2);};
  const X=2,A=0,B=1;
  const label=()=>page.evaluate(()=>{const el=document.querySelector('#opening-action');return el&&getComputedStyle(el).display!=='none'?el.textContent.trim():'';});
  const words=()=>page.evaluate(()=>[...document.querySelectorAll('.opening-caption,#opening-caption,.opening-hint,#opening-hint,#pad-toast')].map(e=>e.textContent.trim()).join(' | '));
  /** Walk the focus ring to an element with the D-pad alone (the way a player's thumb would), then report whether it got there. */
  const ringTo=async sel=>{for(let i=0;i<40;i++){
      const d=await page.evaluate(sel=>{const t=document.querySelector(sel),f=document.querySelector('.pad-focus');if(!t)return 'gone';if(f===t)return 'there';if(!f)return 'none';
        const a=f.getBoundingClientRect(),b=t.getBoundingClientRect(),dx=(b.left+b.width/2)-(a.left+a.width/2),dy=(b.top+b.height/2)-(a.top+a.height/2);return Math.abs(dx)>Math.abs(dy)?(dx>0?15:14):(dy>0?13:12);},sel);
      if(d==='there')return true;if(d==='gone')return false;await press(d==='none'?13:d);}
    return false;};
  const pid=()=>page.evaluate(()=>cosmos.world.playerId);
  const tpAboard=async(id,which,x,y,z,yaw=0)=>{app.world.state.players[id].opening.pose={x,y,z,yaw,pitch:0};
    await page.evaluate(({which,x,y,z,yaw})=>{const o=cosmos.opening;(which==='liner'?o.liner.sw:which==='kestrel'?o.kestrel.sw:o.cabinSw).place(x,y,z,yaw);cosmos.step(0);},{which,x,y,z,yaw});};
  const tpPort=async(id,x,z,yaw=0)=>{app.world.state.players[id].opening.pose={x,y:0,z,yaw,pitch:0};await page.evaluate(({x,z,yaw})=>{cosmos.opening.model.place({x,y:0,z,yaw,pitch:0});},{x,z,yaw});};
  const aim=(x,z,y=.35)=>page.evaluate(({x,y,z})=>{const m=cosmos.opening.model,w=m.walker,e=w.eyeWorldPos({}),p=m.toWorld(x,y,z),f=w.updateFrame();
    const dd={x:p.x-e.x,y:p.y-e.y,z:p.z-e.z},l=Math.hypot(dd.x,dd.y,dd.z),dot=v=>dd.x*v.x+dd.y*v.y+dd.z*v.z;w.yaw=Math.atan2(dot(f.east),dot(f.north));w.pitch=Math.asin(dot(f.up)/l);cosmos.step(0);},{x,y,z});

  // ---- the liner: the sticks walk and look, and the game notices what is in the player's hands ---------------------------------------
  await ready();const id=await pid();await step(6);
  const sw=()=>page.evaluate(()=>{const s=cosmos.opening.liner.sw;return {x:s.x,z:s.z,yaw:s.yaw};});
  const a=await sw();await page.evaluate(()=>{__pad.axes[1]=-1;});await step(2);await page.evaluate(()=>{__pad.axes[1]=0;});await step(.3);const b=await sw();
  check('liner: the left stick walks',Math.hypot(b.x-a.x,b.z-a.z)>.5,'moved '+Math.hypot(b.x-a.x,b.z-a.z).toFixed(2)+' m');
  await page.evaluate(()=>{__pad.axes[2]=1;});await step(.7);await page.evaluate(()=>{__pad.axes[2]=0;});await step(.2);const c=await sw();
  check('liner: the right stick turns the view',Math.abs(c.yaw-b.yaw)>.3,'yaw '+(c.yaw-b.yaw).toFixed(2));
  check('liner: the pad is noticed',await page.evaluate(()=>document.documentElement.dataset.input==='gamepad'));
  const w0=await words();check('liner: the words on screen speak of the controller, not of keys or thumbs',/stick|controller/i.test(w0)&&!/W ?A ?S ?D|thumb|tap /i.test(w0),w0.slice(0,200));
  await shot('liner');
  // ---- the port: X reads the board, the D-pad and A choose a world and a side ------------------------------------------------------------
  await jump({stage:1,pose:S.linerExit(L),played:true,clock:0});await tpPort(id,-98,44,Math.PI/2);await step(1);await tpPort(id,-88,44.5,0);await step(1);
  const l1=await label();check('port: the button names the pad\'s button',/\(X\)/.test(l1),l1);
  await press(X);const open=await page.waitForSelector('#opening-board',{timeout:10000}).then(()=>true,()=>false);check('port: X opens the arrivals board',open);await shot('board');
  check('board: the D-pad reaches the Ceres tab',await ringTo('.ob-tabs button[data-w="ceres"]'));await press(A);
  check('board: A picks the tab',await page.evaluate(()=>!!document.querySelector('.ob-side[data-f="greenhaven"]')));
  check('board: the D-pad reaches a side',await ringTo('.ob-side[data-f="greenhaven"]'));await press(A);await shot('board-side');
  check('board: the D-pad reaches the Go button',await ringTo('[data-act="go"]'));await press(A);
  check('board: A confirms and the board closes',await page.waitForFunction(()=>!document.querySelector('#opening-board'),null,{timeout:10000}).then(()=>true,()=>false));
  check('board: the choice is saved',app.world.state.players[id].opening.dest?.world==='ceres',JSON.stringify(app.world.state.players[id].opening.dest));
  const g=S.kestrelGate(K);await tpPort(id,g.x-2,g.z,0);await step(1.5);await press(X);check('port: X boards the Kestrel',await waitStage(2));await shot('kestrel');
  // ---- the wreck: X opens the locker, the note closes from the pad, X climbs out ------------------------------------------------------------
  await jump({stage:3,clock:0,pose:{x:1.2,y:.02,z:6.8,yaw:Math.PI/2,pitch:0}});await tpAboard(id,'cabin',1.2,.02,6.8,Math.PI/2);await step(1.5);
  await press(X);const note=await page.waitForSelector('#opening-note',{timeout:8000}).then(()=>true,()=>false);check('wreck: X opens the crew locker',note);await shot('locker-note');
  check('wreck: the D-pad reaches the note\'s button',await ringTo('#opening-note button'));await press(A);
  check('wreck: A closes the note',await page.waitForFunction(()=>!document.querySelector('#opening-note'),null,{timeout:6000}).then(()=>true,()=>false));
  await tpAboard(id,'cabin',0,.02,13,0);await step(.3);await press(X);check('wreck: X climbs out of the hatch',await waitStage(4));
  // ---- the dig, the crate, the ride ---------------------------------------------------------------------------------------------------
  const place=async()=>{await page.evaluate(()=>{cosmos.opening.model.place({x:4,y:.03,z:18.5,yaw:0,pitch:-1});});app.world.state.players[id].opening.pose={x:4,y:.03,z:18.5,yaw:0,pitch:-1};await step(.5);};
  await place();await aim(4,20);const l2=await label();check('dig: the button names the pad\'s button',/\(X\)/.test(l2),l2);
  for(let i=0;i<40&&!await page.evaluate(()=>cosmos.opening.model.exposed());i++){const [x,z]=[[4,20],[4.18,20],[3.82,20],[4,20.18],[4,19.82]][i%5];await aim(x,z);await press(X);}
  check('dig: X digs the crate clear',await page.evaluate(()=>cosmos.opening.model.exposed()));await shot('dig');
  await place();await aim(4,20);await press(X);check('dig: X lifts the crate and the ride is called',await waitStage(5));
  await step(9);await page.evaluate(()=>{cosmos.opening.model.place({x:-6,y:.02,z:23,yaw:Math.PI/2,pitch:0});});app.world.state.players[id].opening.pose={x:-6,y:.02,z:23,yaw:1.57,pitch:0};await step(1);
  await press(X);check('ride: X climbs into the truck',await waitStage(6));await shot('ride');
  const w1=await words();check('ride: nothing on screen names a key or a thumb',!/\((?:E|Q|T|Space|Shift)\)|W ?A ?S ?D|\btap\b|thumb/i.test(w1+' '+await label()),(w1+' '+await label()).slice(0,200));
  check('no errors in the whole run',errors.length===0,errors.slice(0,4).join(' || '));
}catch(e){check('the run finished',false,String(e.stack||e).slice(0,700));process.exitCode=1;}
finally{
  const failed=checks.filter(c=>!c.ok);
  await writeFile(join(out,'gamepad-opening-results.json'),JSON.stringify({passed:failed.length===0,failed:failed.length,checks,errors},null,1));
  console.log(`\ngamepad opening: ${checks.length-failed.length}/${checks.length} checks passed`);if(failed.length)process.exitCode=1;
  await chrome?.close();await app?.close();
}
