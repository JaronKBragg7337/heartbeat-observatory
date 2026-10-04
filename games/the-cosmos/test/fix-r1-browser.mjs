// Reproducible EYES captures. Defaults to iPhone WebKit; --chromium explicitly labels fallback evidence.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules')('playwright');
const fallback=process.argv.includes('--chromium'),kind=fallback?'chromium':'webkit';
const exe=fallback?process.env.COSMOS_CHROMIUM_EXE:process.env.COSMOS_WEBKIT_EXE||join(process.env.LOCALAPPDATA,'ms-playwright','webkit-2336','Playwright.exe');
const out=join('docs','qa','2026-10-04','fix-r1');await mkdir(out,{recursive:true});
const browser=await pw[kind].launch({headless:true,...(exe?{executablePath:exe}:{})});
const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,
  userAgent:fallback?undefined:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
let page=await context.newPage();const errors=[],shots=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const shot=async name=>{const file=name+'-'+kind+'.png';await page.screenshot({path:join(out,file)});shots.push(file);};
try {
  await page.goto(process.env.COSMOS_LOCAL_URL||'http://localhost:8391/?dev=1&solo=1&tier=low');
  await page.waitForFunction(()=>window.cosmos?.opening?.actorsReady,{},{timeout:60000});
  await page.evaluate(()=>{cosmos.engine.stop();cosmos.opening.elapsed=20;cosmos.opening.t0=0;cosmos.opening.clock=30;cosmos.step(0);});
  await shot('opening-0-cruise');
  const setup=async(stage,pose,clock=0)=>page.evaluate(({stage,pose,clock})=>{const o=cosmos.opening;o.state.stage=stage;o.state.pose=pose;o.state.clock=clock;o.clock=clock;o.elapsed+=5;o.busy=false;o.lines.until=0;o.enterStage(stage,true);o.fade.style.opacity='0';cosmos.step(0);},{stage,pose,clock});
  await setup(0,{x:12.2,y:0,z:26.7,yaw:Math.PI/2,pitch:-.25},198);await shot('opening-0-gangway-top');
  await page.evaluate(()=>{const o=cosmos.opening;o.liner.sw.place(17,-1.6,26.7,Math.PI/2);o.liner.sw.pitch=-.35;cosmos.step(0);});await shot('opening-0-visible-ramp');
  await setup(1,{x:-167,y:0,z:31.7,yaw:Math.PI/2,pitch:0});await shot('opening-1-ship-to-arrivals');
  await setup(1,{x:-167,y:0,z:31.7,yaw:-Math.PI/2,pitch:0});await shot('opening-1-solid-liner');
  await setup(1,{x:-167,y:0,z:31.7,yaw:Math.PI/2,pitch:0});
  await page.evaluate(()=>{const o=cosmos.opening;o.goalHint.update(59,{id:'arrivals',onPlanet:true,target:{x:-100,y:1.5,z:40.2},eye:{x:-167,y:1.7,z:31.7},reach:14});});
  checks.push({name:'arrow hidden before 60s',pass:await page.locator('.goal-edge-arrow').evaluate(e=>e.hidden)});
  await page.evaluate(()=>{const o=cosmos.opening;o.goalHint.update(1,{id:'arrivals',onPlanet:true,target:{x:-100,y:1.5,z:40.2},eye:{x:-167,y:1.7,z:31.7},reach:14});});await shot('opening-1-delayed-arrow');
  checks.push({name:'arrow visible at 60s',pass:await page.locator('.goal-edge-arrow').evaluate(e=>!e.hidden)});
  await setup(1,{x:-112,y:0,z:40.2,yaw:Math.PI/2,pitch:.04});await shot('opening-1-arrivals-sign');
  await setup(1,{x:-88,y:0,z:44.5,yaw:0,pitch:0});await page.locator('#opening-action').tap();await page.waitForSelector('#opening-board');await shot('opening-1-board');
  await page.locator('[data-act="go"]').tap();await page.waitForFunction(()=>!document.querySelector('#opening-board'));
  await setup(1,{x:-88,y:0,z:44.5,yaw:Math.PI,pitch:0});
  await page.evaluate(()=>{const o=cosmos.opening;o.goalHint.update(60,{id:'kestrel',label:'Pad 01 / Kestrel',onPlanet:true,target:{x:20,y:1.5,z:9.3},eye:{x:-88,y:1.7,z:44.5},reach:8});});await shot('opening-1-delayed-pad-arrow');
  await setup(1,{x:20,y:0,z:9.3,yaw:-Math.PI/2,pitch:.04});await shot('opening-1-pad-01');
  await setup(2,{x:0,y:0,z:0,yaw:Math.PI/2,pitch:0},30);await shot('opening-2-descent');
  await setup(3,{x:0,y:.02,z:4,yaw:Math.PI,pitch:0});await shot('opening-3-wreck');
  await setup(4,{x:4,y:0,z:22,yaw:0,pitch:-.7});await shot('opening-4-dig');
  await setup(5,{x:-3.1,y:0,z:22.16,yaw:-Math.PI/2,pitch:0});await page.evaluate(()=>{const o=cosmos.opening;o.contactSeconds=10;cosmos.step(0);});await shot('opening-5-contact');
  await setup(6,{x:-7,y:0,z:23,yaw:0,pitch:0});await page.evaluate(()=>{cosmos.opening.state.ride=true;cosmos.opening.rover.seatPlayer();});
  for(const t of [0,10,20,30,40,50,60]){await page.evaluate(t=>{const o=cosmos.opening;o.rideSeconds=t;cosmos.step(0);},t);await shot('opening-6-ride-'+t);}
  checks.push({name:'generated step-off MP3 decodes (WebKit build has no WebAudio: size check there)',pass:await page.evaluate(async()=>{const r=await fetch('/assets/voices/0432818af31325.mp3'),buf=await r.arrayBuffer(),AC=window.AudioContext||window.webkitAudioContext;if(!AC)return buf.byteLength>20000;const a=new AC();try{const b=await a.decodeAudioData(buf);return b.duration>2;}finally{await a.close();}})});
  // Shared room renderer: capture every fleet room, since the clearance reservation applies to them all.
  const rooms=await page.evaluate(async()=>{const {allShipDefs}=await import('/src/ships/registry.js');return allShipDefs().flatMap(s=>s.layout.rooms.map(r=>({type:s.type,id:r.id})));});
  await page.evaluate(()=>{cosmos.opening.ui.hidden=true;cosmos.opening.goalHint.el.hidden=true;window.qaLabel=document.createElement('div');qaLabel.style.cssText='position:fixed;top:8px;left:8px;z-index:99;background:#111c;color:#fff;padding:6px;font:12px monospace';document.body.append(qaLabel);});
  for(const r of rooms) {
    await page.evaluate(async({type,id})=>{
      const {ShipStage}=await import('/src/opening/stageShip.js');const THREE=await import('/lib/three.module.js');
      if(window.qaStage?.def.type!==type){window.qaStage?.dispose();window.qaStage=new ShipStage({engine:{track:x=>x,untrack:()=>{}},type,mats:cosmos.opening.mats,signs:cosmos.ship.signs,tier:'low'});}
      const s=qaStage,room=s.layout.roomById.get(id),props=s.layout.props.filter(p=>p.room===id);
      const {propBoxOf}=await import('/src/ships/layoutKit.js');
      let x=(room.x0+room.x1)/2,z=(room.z0+room.z1)/2;
      // Pick a standing point clear of authored furniture, not a chair or reactor centre.
      const candidates=[];for(let px=room.x0+.5;px<room.x1-.4;px+=.6)for(let pz=room.z0+.5;pz<room.z1-.4;pz+=.6){
        if(!props.some(p=>{const b=propBoxOf(p);return px>b.x0-.35&&px<b.x1+.35&&pz>b.z0-.35&&pz<b.z1+.35;}))candidates.push({x:px,z:pz,score:Math.hypot(px-x,pz-z)});}
      candidates.sort((a,b)=>a.score-b.score);if(candidates.length){x=candidates[0].x;z=candidates[0].z;}
      s.sw.place(x,room.y,z,0);s.sw.tick(0,{});s.sw.zoneRoom=id;
      const d=s.layout.doors.find(d=>d.a===id||d.b===id);const target=d?new THREE.Vector3(d.axis==='x'?d.at:d.c,room.y+1.5,d.axis==='x'?d.c:d.at):new THREE.Vector3(x,room.y+1.5,room.z0);
      const eye=new THREE.Vector3(x,room.y+1.65,z),fwd=target.clone().sub(eye).normalize();s.update(0,eye,fwd,{inside:true,walking:true,aspect:393/852,fov:72,first:true});
      const c=cosmos.engine.camera;c.position.copy(eye);c.up.set(0,1,0);c.lookAt(target);c.updateMatrixWorld(true);cosmos.engine.renderer.render(s.interiorScene,c);qaLabel.textContent=type+' / '+room.name+' — '+id;
    },r);await shot('room-'+r.type+'-'+r.id);
  }
  // Real Mars night: the sun is below the horizon; inspect the pad and every port room.
  await page.close();const portContext=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true});page=await portContext.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.COSMOS_LOCAL_URL||'http://localhost:8391/?dev=1&solo=1&tier=low')+'&opening=off&sky=live');
  await page.waitForFunction(()=>window.cosmos?.port?.root&&cosmos.ship?.ready,{},{timeout:60000});
  await page.evaluate(()=>{cosmos.engine.stop();cosmos.setSkyShift(0);const t=cosmos.worldTimeS();cosmos.setSkyShift(cosmos.skyShiftFor('night',-14,-59.2,t));});
  const portViews=[{name:'night-pad',x:18,z:30,tx:-65,tz:22},{name:'night-settlement',x:30,z:38,tx:-65,tz:25},
    {name:'depot',x:-62,z:25,tx:-62,tz:14},{name:'crew-hall',x:-28,z:-62,tx:-28,tz:-70},
    {name:'tower-lobby',x:-60,z:-35,tx:-60,tz:-40},{name:'tower-cab',x:-59,z:-36,y:22.5,tx:-60,tz:-42},
    {name:'arrivals',x:-98,z:40,tx:-88,tz:40},{name:'market',x:-54,z:58,tx:-58,tz:51}];
  for(const v of portViews){await page.evaluate(v=>{const c=cosmos,p=c.port,site=p.site,feet=site.toWorld(v.x,(v.y||0)+.02,v.z),e=site.toWorld(v.x,(v.y||0)+1.7,v.z),t=site.toWorld(v.tx,(v.y||0)+1.5,v.tz);
      c.ship.aboard=false;Object.assign(c.walker.worldPos,feet);c.walker.velocity={x:0,y:0,z:0};
      c.freeCam.set(e,t);c.step(0);p.tick(1,{worldPos:feet,radiusM:.3},false,true);c.step(0);
    },v);await shot('port-'+v.name);}
  checks.push({name:'real Mars night sun below horizon',pass:await page.evaluate(()=>cosmos.space.sky.state.elev<-10),detail:await page.evaluate(()=>cosmos.space.sky.state.elev)});
  // The repair-chain arrow uses the real ship pad in world coordinates, and hides aboard.
  const repair=await page.evaluate(async()=>{const {RepairChain}=await import('/src/opening/repair.js');const c=cosmos,p=c.port.site.toWorld(100,.1,30);
    window.qaRepair=new RepairChain({engine:c.engine,walker:c.walker,portSite:c.port.site,space:c.space,shipSystem:c.ship,vehicles:c.vehicles,
      world:{remote:true,playerId:'qa',snapshot:{players:{qa:{shipId:'qa-boat',home:{world:'mars'},opening:{complete:true}}},ships:{'qa-boat':{id:'qa-boat',drained:true,repair:{have:['cell','coupler']},pose:{pos:p}}}}}});
    c.walker.grounded=true;c.ship.aboard=false;qaRepair.tick(59);const before=qaRepair.hint.el.hidden;qaRepair.tick(1);return{before,after:!qaRepair.hint.el.hidden};});
  checks.push({name:'lifeboat pad arrow waits 60s',pass:repair.before&&repair.after});await shot('port-delayed-lifeboat-arrow');
  checks.push({name:'lifeboat arrow hides aboard',pass:await page.evaluate(()=>{cosmos.ship.aboard=true;qaRepair.tick(0);const hidden=qaRepair.hint.el.hidden;cosmos.ship.aboard=false;qaRepair.hint.dispose();return hidden;})});
  // Ceres settlement, at the real clock's lowest solar elevation over its pad.
  await page.evaluate(()=>{const c=cosmos;c.space.setFrame('ceres');const pi=c.space.activeMoon.body.padInfo;Object.assign(c.ship.flight.pos,pi.point);Object.assign(c.walker.worldPos,pi.point);c.ship.flight.epochS=null;c.ship.flight.landed=true;});
  await page.waitForFunction(()=>cosmos.space.activeMoon?.client?.outpost?.root,null,{timeout:60000});
  const ceresNight=await page.evaluate(()=>{const c=cosmos,s=c.space,pi=s.activeMoon.body.padInfo;let best={offset:0,dot:1};
    for(let off=0;off<33000;off+=1000){c.setSkyShift(off);s.updateFrames();const d=s.sunLocal.x*pi.up.x+s.sunLocal.y*pi.up.y+s.sunLocal.z*pi.up.z;if(d<best.dot)best={offset:off,dot:d};}c.setSkyShift(best.offset);return best;});
  for(const v of [{name:'pad-to-supply',x:0,z:20,tx:-65,tz:18},{name:'pad-to-foundry',x:-20,z:-25,tx:-7,tz:-98},{name:'lit-bunks',x:40,z:-20,tx:64,tz:-54}]){
    await page.evaluate(async v=>{const {outpostToFrame}=await import('/src/worlds/ceres/layout.js');const c=cosmos,pi=c.space.activeMoon.body.padInfo,e=outpostToFrame(pi,v.x,1.7,v.z),t=outpostToFrame(pi,v.tx,1.5,v.tz);
      Object.assign(c.walker.worldPos,outpostToFrame(pi,v.x,.02,v.z));c.freeCam.set(e,t);c.step(0);},v);await shot('ceres-night-'+v.name);}
  checks.push({name:'real Ceres night sun below horizon',pass:ceresNight.dot<-.2,detail:ceresNight});
  // A clean private Ceres opening: inspect the first excavation on grey Ceres soil.
  const ceresContext=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ceresContext.addInitScript(()=>localStorage.setItem('cosmos-opening-solo-v2',JSON.stringify({version:2,stage:4,elapsed:0,clock:0,seed:.1,season:{cause:'failure'},pose:{x:4,y:0,z:22,yaw:0,pitch:-.7},cuts:[],dest:{world:'ceres',faction:'ironclad'},driver:null,carriedCrate:false,lockerOpened:true,ride:false,complete:false})));
  page=await ceresContext.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.COSMOS_LOCAL_URL||'http://localhost:8391/?dev=1&solo=1&tier=low');
  await page.waitForFunction(()=>window.cosmos?.opening?.actorsReady,null,{timeout:60000});await page.evaluate(()=>{cosmos.engine.stop();cosmos.opening.elapsed=20;cosmos.opening.t0=0;cosmos.step(0);});await shot('ceres-opening-first-dig-before');
  await page.locator('#opening-action').tap();await page.evaluate(()=>cosmos.step(0));await shot('ceres-opening-first-dig-after');
  const soil=await page.evaluate(()=>cosmos.opening.model.digger.carried.map(l=>l.materialName));checks.push({name:'first real Ceres dig carries Ceres soil',pass:soil.some(n=>n?.includes('Ceres')),detail:soil});
  checks.push({name:'no page errors',pass:errors.length===0,detail:errors});
} finally {await browser.close();await writeFile(join(out,'captures-'+kind+'.json'),JSON.stringify({engine:kind,viewport:'393x852',shots,checks,errors},null,2));}
console.log(JSON.stringify({engine:kind,captures:shots.length,checks,errors},null,2));
if(errors.length||checks.some(c=>!c.pass))process.exitCode=1;
