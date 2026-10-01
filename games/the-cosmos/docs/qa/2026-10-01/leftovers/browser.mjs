// Reuses the repository's headless Chromium harness; screenshots stay in this review folder.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const here=fileURLToPath(new URL('.',import.meta.url));
const require=createRequire('file:///C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
const ctx=await browser.newContext({viewport:{width:750,height:470},deviceScaleFactor:1});
const page=await ctx.newPage(),errors=[];
const failedResources=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('response',r=>{if(r.status()>=400)failedResources.push({status:r.status(),url:r.url()});});
await page.goto('http://localhost:8392/?tier=low&depth=16',{waitUntil:'load'});
await page.waitForFunction(()=>window.cosmos?.engine,null,{timeout:120000});
try {
  await page.waitForFunction(()=>cosmos.portPeople.members.length===15&&cosmos.portPeople.members.every(m=>m.person.loaded),null,{timeout:120000});
  await page.evaluate(()=>cosmos.engine.stop());
  const evidence=await page.evaluate(()=>({workers:cosmos.portPeople.members.map(m=>({id:m.id,pose:m.person.pose,model:m.personId,position:m.person.group.position.toArray()})),files:cosmos.people.cachedFiles(),port:cosmos.port.stats,depth:cosmos.depthBits}));
  evidence.views=[];
  for(const view of ['tower-elevator-call','tower-elevator-car','tower-elevator-shaft','tower-elevator-cab-door','tower-elevator-exit','tower-cab-looking-in','tower-cab-south','depot-service','market-trader-1','market-trader-4']) {
    await page.evaluate(name=>{cosmos.portTour(name);for(let i=0;i<6;i++)cosmos.step(1/60);},view);
    await page.screenshot({path:here+view+'.jpg',type:'jpeg',quality:86});
    evidence.views.push(await page.evaluate(v=>{
      const info=cosmos.engine.renderer.info;info.autoReset=false;info.reset();cosmos.step(0);
      const result={view:v,workerVisible:cosmos.portPeople.members.filter(m=>m.person.group.visible).length,renderer:{...info.render}};
      info.autoReset=true;return result;
    },view));
  }
  // Run the actual moving-floor simulation, then freeze a camera IN the moving car.
  evidence.ride=await page.evaluate(async()=>{
    cosmos.portTour('off');const c=cosmos,T=(await import('/src/port/portSpec.js')).TOWER;
    c.engine.stop();c.ship.aboard=false;c.view.mode='first';
    const e=c.port.elevator;e.y=0;e.open=1;e.phase='open';e.target=0;e.speed=0;
    Object.assign(c.walker.worldPos,c.port.site.toWorld(T.x,.02,T.z-1));c.walker.velocity={x:0,y:0,z:0};c.walker.grounded=true;
    e.request(T.cab.floorY);
    for(let i=0;i<360;i++){c.walker.tick(1/60,{});c.port.tick(1/60,c.walker);}
    const p=c.port.site.toLocal(c.walker.worldPos),y=e.y;
    c.freeCam.set(c.port.site.toWorld(T.x,y+1.66,T.z-.8),c.port.site.toWorld(T.x+1.1,y+1.3,T.z-1.8));c.step(0);
    return {carY:y,feetY:p.y,doors:e.open,phase:e.phase};
  });
  await page.screenshot({path:here+'elevator-riding.jpg',type:'jpeg',quality:86});
  // Resume at the cab, then use the real Talk button on the supervisor.
  evidence.talk=await page.evaluate(async()=>{
    const c=cosmos,T=(await import('/src/port/portSpec.js')).TOWER;c.freeCam.off();
    c.port.elevator.y=T.cab.floorY;c.port.elevator.open=1;c.port.elevator.phase='open';
    Object.assign(c.walker.worldPos,c.port.site.toWorld(T.x,T.cab.floorY+.02,T.z+2.8));c.walker.velocity={x:0,y:0,z:0};
    c.walker.yaw=c.port.site.heading+Math.PI;c.step(.21);c.crewUI.update(.21);
    return {target:c.crewUI.target?.id,label:document.querySelector('#crew-talk').innerText};
  });
  await page.locator('#crew-talk').dispatchEvent('pointerup');
  evidence.talk.panel=await page.locator('#crew-panel').innerText();
  await page.screenshot({path:here+'cab-talk.jpg',type:'jpeg',quality:86});
  await page.evaluate(()=>{
    const c=cosmos;c.crewUI.close();c.crewUI.btn.style.display='none';
    const eye=c.port.site.toWorld(-9,1.66,41);
    c.portPeople.tick(.1,eye);c.freeCam.set(eye,c.port.site.toWorld(-12,1.4,39));c.step(0);
  });
  await page.screenshot({path:here+'arrival-guide.jpg',type:'jpeg',quality:86});
  evidence.climb=await page.evaluate(async()=>{
    const c=cosmos;c.freeCam.off();c.portTour('off');c.ship.aboard=false;c.view.mode='first';
    window.cutReviewBox=(ox,oz,x0,x1,y0,y1,z0,z1)=>{
      const pts=[];for(const x of [x0,x1])for(const y of [y0,y1])for(const z of [z0,z1])pts.push(c.port.site.toWorld(ox+x,y,oz+z));
      const box={};for(const k of ['x','y','z']){box[k+'0']=Math.min(...pts.map(p=>p[k]))-.1;box[k+'1']=Math.max(...pts.map(p=>p[k]))+.1;}
      const p=c.port.site.toWorld(ox+(x0+x1)/2,(y0+y1)/2,oz+(z0+z1)/2);
      return c.edits.carve({...p,box,sdf:(x,y,z)=>{const q=c.port.site.toLocal({x,y,z});return Math.min(q.x-ox-x0,x1-(q.x-ox),q.y-y0,y1-q.y,q.z-oz-z0,z1-(q.z-oz));}});
    };
    cutReviewBox(-90,-14,-3,0,-1.24,.4,-2,2);
    Object.assign(c.walker.worldPos,c.port.site.toWorld(-90.6,-1.22,-14));c.walker.grounded=true;c.walker.velocity={x:0,y:0,z:0};
    const f=c.walker.updateFrame(),r=c.port.site.right;c.walker.yaw=Math.atan2(r.x*f.east.x+r.y*f.east.y+r.z*f.east.z,r.x*f.north.x+r.y*f.north.y+r.z*f.north.z);c.walker.pitch=-.1;
    for(let i=0;i<120;i++)c.walker.tick(1/60,{moveNorth:1});
    c.rebuildNear(true);c.flushTerrain();c.step(.21);
    return {before:c.port.site.toLocal(c.walker.worldPos),offered:document.querySelector('#btn-climb').style.display};
  });
  await page.screenshot({path:here+'climb-offer.jpg',type:'jpeg',quality:86});
  await page.keyboard.press('KeyC');
  evidence.climb.after=await page.evaluate(()=>{
    const c=cosmos;for(let i=0;i<80;i++){c.engine.timeSec+=1/60;for(const fn of c.engine._updaters)fn(1/60,c.engine.timeSec);}
    c.step(0);return c.port.site.toLocal(c.walker.worldPos);
  });
  await page.screenshot({path:here+'climb-after.jpg',type:'jpeg',quality:86});
  evidence.tunnel=await page.evaluate(()=>{
    const c=cosmos;
    cutReviewBox(-90,9,-5,5,-5,-2,-2,2);cutReviewBox(-90,9,-8,-4.8,-5,.4,-2,2);
    Object.assign(c.walker.worldPos,c.port.site.toWorld(-89,-4.98,9));c.walker.velocity={x:0,y:0,z:0};c.walker.grounded=true;
    c.carried.length=0;c.setTool(2);
    const p=c.port.site.toWorld(-87,-5.35,9),lot=c.edits.dig(p.x,p.y,p.z,.7);c.carried.push(lot);
    const plan=c.digger.dumpPlan(lot),drop=c.doDumpAll();
    c.flushTerrain();c.rebuildNear(true);
    const q=c.port.site.toLocal(plan);
    c.freeCam.set(c.port.site.toWorld(-89,-3.4,10.5),c.port.site.toWorld(q.x,q.y+.35,q.z));c.step(0);
    return {plan:plan&&{local:plan.local,y:c.port.site.toLocal(plan).y},drop:drop.ok,mass:lot.massKg};
  });
  await page.screenshot({path:here+'tunnel-local-pour.jpg',type:'jpeg',quality:86});
  evidence.glbRequests=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.glb')).map(r=>({name:r.name.split('/').pop(),bytes:r.encodedBodySize})));
  evidence.errors=errors;evidence.failedResources=failedResources;
  const phone=await browser.newContext({viewport:{width:375,height:740},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const pp=await phone.newPage();
  pp.on('pageerror',e=>errors.push(String(e)));
  pp.on('response',r=>{if(r.status()>=400)failedResources.push({status:r.status(),url:r.url()});});
  await pp.goto('http://localhost:8392/?tier=low&depth=16');
  await pp.waitForFunction(()=>cosmos?.portPeople.members.length===15&&cosmos.portPeople.members.every(m=>m.person.loaded));
  await pp.evaluate(()=>cosmos.engine.stop());
  for(const [view,file] of [['tower-cab-looking-in','phone-cab'],['market-trader-2','phone-trader']]) {
    await pp.evaluate(v=>{cosmos.portTour(v);for(let i=0;i<6;i++)cosmos.step(1/60);},view);
    await pp.screenshot({path:here+file+'.jpg',type:'jpeg',quality:86});
  }
  await pp.evaluate(()=>{cosmos.portTour('off');cosmos.engine.stop();});
  evidence.phone=await pp.evaluate(()=>({touch:navigator.maxTouchPoints,viewport:innerWidth}));
  await pp.evaluate(async()=>{
    const c=cosmos,T=(await import('/src/port/portSpec.js')).TOWER;c.view.mode='first';c.ship.aboard=false;
    Object.assign(c.walker.worldPos,c.port.site.toWorld(T.x,T.cab.floorY+.02,T.z+2));c.walker.velocity={x:0,y:0,z:0};c.walker.grounded=true;
    c.port.elevator.y=0;c.port.elevator.phase='open';c.port.elevator.open=1;c.port.elevator.target=0;
    c.walker.yaw=c.port.site.heading+.35;c.walker.pitch=0;
    // Aim at the call panel beside the closed landing doors on a narrow phone.
    c.freeCam.off();for(let i=0;i<30;i++)c.step(1/60);
  });
  await pp.screenshot({path:here+'phone-call-lift.jpg',type:'jpeg',quality:86});
  await pp.locator('#btn-action').dispatchEvent('pointerdown');await pp.locator('#btn-action').dispatchEvent('pointerup');
  evidence.phone.call=await pp.evaluate(()=>({target:cosmos.port.elevator.target,phase:cosmos.port.elevator.phase}));
  evidence.peopleBudget=await page.evaluate(()=>{
    const geometry=new Set(),skeletons=new Set();let meshes=0,triangles=0;
    for(const m of cosmos.portPeople.members) m.person.group.traverse(o=>{if(o.isMesh){meshes++;geometry.add(o.geometry);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.skeleton)skeletons.add(o.skeleton);}});
    let geometryBytes=0;for(const g of geometry){for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;geometryBytes+=g.index?.array.byteLength??0;}
    return {meshes,triangles,uniqueGeometry:geometry.size,geometryBytes,skeletons:skeletons.size};
  });
  assert.equal(evidence.workers.length,15);
  assert.equal(evidence.workers.filter(w=>w.pose==='Sit').length,5);
  assert.equal(evidence.glbRequests.length,6,'workers must reuse the player/crew downloads');
  assert.equal(evidence.errors.length,0,'browser JavaScript errors');
  assert.equal(evidence.ride.phase,'moving');assert.equal(evidence.ride.doors,0);
  assert.ok(Math.abs(evidence.ride.feetY-evidence.ride.carY-.02)<.03);
  assert.equal(evidence.talk.target,'cab-supervisor');
  assert.match(evidence.talk.panel,/This watch keeps the apron clear/);
  assert.doesNotMatch(evidence.talk.panel,/Hire|Dismiss|skill|Fly to/);
  assert.equal(evidence.climb.offered,'block');assert.ok(evidence.climb.after.y>-.1);
  assert.ok(evidence.tunnel.drop&&evidence.tunnel.plan.local&&evidence.tunnel.plan.y<-4.8);
  assert.equal(evidence.phone.viewport,375);assert.equal(evidence.phone.call.target,22.5);
  assert.equal(evidence.phone.call.phase,'closing');
  assert.ok(evidence.failedResources.every(r=>r.url.endsWith('/_vercel/insights/script.js')||r.url.endsWith('/hb-editor.js')));
  await writeFile(here+'browser-results.json',JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({ride:evidence.ride,talk:evidence.talk,files:evidence.files,glbRequests:evidence.glbRequests,errors}));
} finally {await browser.close();}
