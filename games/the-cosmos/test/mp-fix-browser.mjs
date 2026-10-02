// Browser walk and UI parity. Uses a FileAdapter authority on an isolated loopback
// address, port 8390; it never writes the live Supabase world.
import {createRequire} from 'node:module';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startServer} from '../server/index.mjs';
import {FileAdapter} from '../server/storage.mjs';
import {PORT_WORKERS} from '../src/port/portPeople.js';
import {SEATS,OBSERVATION} from '../src/ship/shipSpec.js';
const require=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||join(homedir(),'.codex/runtime/unfinished-island/node_modules/'));
const {chromium}=require('playwright');
const out=fileURLToPath(new URL('../docs/qa/2026-10-01/mp-fix/',import.meta.url));await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'cosmos-walk-'));let app,browser,clock=Date.now();const results={},errors=[];
try{
 app=await startServer({adapter:new FileAdapter(join(temp,'world.json')),host:'127.0.0.2',port:8390,tick:false,now:()=>clock});
 browser=await chromium.launch({headless:true,executablePath:process.env.COSMOS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets']});
 async function context(phone=false){const ctx=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:720},isMobile:phone,hasTouch:phone});
  await ctx.addInitScript(()=>{const WS=window.WebSocket;window.WebSocket=class extends WS{constructor(url,...rest){super(String(url).replace('localhost:8390','127.0.0.2:8390'),...rest);}};});
  await ctx.route('http://localhost:8390/**',async route=>route.fulfill({response:await route.fetch({url:route.request().url().replace('localhost:8390','127.0.0.2:8390')})}));return ctx;}
 async function ready(ctx,solo=false){const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://localhost:8390/?tier=low&dev=1'+(solo?'&solo=1':''));await page.waitForFunction(()=>window.cosmos?.crewUI,null,{timeout:90000});await page.evaluate(()=>cosmos.engine.stop());assert.equal(await page.evaluate(()=>!!cosmos.multiplayer),!solo);return page;}
 const ctx=await context(),a=await ready(ctx),w=app.world,aid=await a.evaluate(()=>cosmos.world.playerId);
 const player=()=>w.state.players[aid],ship=()=>w.state.ships[player().shipId],sim=()=>w.sims.get(ship().id);
 async function sync(page=a,id=aid,force=true){await w.enqueue(()=>w.commit());await page.evaluate(()=>cosmos.world.socket.send(JSON.stringify({type:'checkpoint'})));await page.waitForFunction(r=>cosmos.world.state.revision>=r,w.state.revision);await page.evaluate(force=>{cosmos.multiplayer.forcePlayer=force;cosmos.multiplayer.apply({bricks:[]});cosmos.freeCam.off();cosmos.step(.21);cosmos.economyUI.draw();},force);}
 function ground(x,y,z,id=aid){const p=w.state.players[id];p.aboardShipId=null;p.pose.aboard=false;p.pose.seat=null;p.pose.worldPos=w.site.toWorld(x,y,z);p.pose.velocity={x:0,y:0,z:0};p.pose.yaw=w.site.heading;p.pose.pitch=0;p.poseAt=clock;p.frameId='mars';}
 function aboard(local,seat=null,id=aid){const p=w.state.players[id],s=w.sims.get(p.shipId);p.aboardShipId=p.shipId;p.currentShipId=p.shipId;p.pose.aboard=true;p.pose.seat=seat;p.pose.sw={...local,yaw:local.yaw||0,pitch:0};p.pose.worldPos=s.flight.toWorld(local,{});p.poseAt=clock;}
 const shot=async(page,name)=>{await page.screenshot({path:join(out,name+'.png')});console.log('Screenshot:',name);};
 const action=async(page,a)=>{const r=await page.evaluate(a=>cosmos.multiplayer.request(a),a);assert.ok(r.ok,r.msg);await page.waitForFunction(()=>cosmos.world.pendingActions.size===0);return r;};
 // Actual W movement across the frame transition, with every outgoing pose accepted.
 const st=sim().ship.state.ramps.cargo,tip={x:0,y:-Math.sin(st.angle)*5,z:20.9+Math.cos(st.angle)*5-.03};
 player().pose.worldPos=sim().flight.toWorld(tip,{});await sync();
 const start=await a.evaluate(()=>({...cosmos.walker.worldPos}));await a.keyboard.down('w');clock+=100;
 await a.evaluate(()=>cosmos.step(1/30));await a.keyboard.up('w');await a.waitForFunction(()=>cosmos.ship.aboard&&!cosmos.multiplayer.boardPending);await sync(a,aid,false);
 const boarded=await a.evaluate(()=>({world:{...cosmos.walker.worldPos},sw:{x:cosmos.ship.sw.x,y:cosmos.ship.sw.y,z:cosmos.ship.sw.z}}));
 assert.ok(Math.hypot(start.x-boarded.world.x,start.y-boarded.world.y,start.z-boarded.world.z)<.3);assert.ok(boarded.sw.z>24);results.boarding=boarded;
 await shot(a,'desktop-01-walk-onto-ramp');
 await a.keyboard.down('w');for(let i=0;i<12;i++){clock+=500;await a.evaluate(()=>{const r=cosmos.engine.renderer,render=r.render;r.render=()=>{};try{for(let j=0;j<15;j++)cosmos.step(1/30);}finally{r.render=render;}cosmos.step(0);});await sync(a,aid,false);}await a.keyboard.up('w');
 assert.ok(await a.evaluate(()=>cosmos.ship.sw.z<21));await shot(a,'desktop-02-walk-through-cargo');
 // Walk back out through the same ramp, facing the bow but walking backward.
 await a.keyboard.down('s');for(let i=0;i<18&&player().aboardShipId;i++){clock+=500;await a.evaluate(()=>{const r=cosmos.engine.renderer,render=r.render;r.render=()=>{};try{for(let j=0;j<15;j++)cosmos.step(1/30);}finally{r.render=render;}cosmos.step(0);});await sync(a,aid,false);}await a.keyboard.up('s');
 assert.equal(player().aboardShipId,null);results.walkedOff=true;await shot(a,'desktop-03-walk-off-ramp');
 ground(-28,.02,-56);await sync();await w.enqueue(()=>w.advance(4));await sync();
 results.hallTrail=Object.values(w.state.pool).map(c=>({name:c.name,status:c.status,position:{...c.position}}));await shot(a,'desktop-04-hall-walk-out');
 await w.enqueue(()=>w.advance(20));await sync();assert.ok(Object.values(w.state.pool).every(c=>c.status==='waiting'));await shot(a,'desktop-05-candidates-visible');
 await a.waitForFunction(()=>[...cosmos.crew.members.values()].every(m=>m.person.loaded));
 async function talk(page,id){await page.evaluate(()=>{cosmos.crewUI.close();cosmos.step(.21);});assert.equal(await page.evaluate(()=>cosmos.crewUI.target?.id),id);await page.locator('#crew-talk').click();assert.equal(await page.evaluate(()=>cosmos.crewUI.open),true);return page.locator('#crew-panel').innerText();}
 results.workers=[];
 for(const worker of PORT_WORKERS){ground(worker.x,(worker.y||0)+.02,worker.z+1);await sync();await talk(a,worker.id);await a.locator('[data-a="worker-question"]').click();
  results.workers.push({id:worker.id,answer:await a.locator('#crew-panel').innerText()});
  if(worker.id==='trader-1')await shot(a,'desktop-06-talk-trader');if(worker.id==='cab-supervisor')await shot(a,'desktop-07-talk-tower');}
 for(const c of Object.values(w.state.pool).filter(c=>!c.shipId)){ground(c.position.x,.02,c.position.z+1);await sync();await talk(a,c.id);
  if(c.role==='pilot')await shot(a,'desktop-08-talk-candidate');await a.locator('[data-a="hire"]').click();await a.waitForFunction(id=>cosmos.world.snapshot.pool[id].shipId,c.id);}
 assert.equal(ship().crew.length,6);await w.enqueue(()=>w.advance(330));await sync();assert.ok(ship().crew.every(c=>c.status==='aboard'));
 results.crew=[];
 for(const c of ship().crew){const seat=c.seatPose;aboard({x:seat.x,y:seat.y,z:seat.z+.8});await sync();await talk(a,c.id);results.crew.push({role:c.role,text:await a.locator('#crew-panel').innerText()});
  if(c.role==='pilot')await shot(a,'desktop-09-talk-own-pilot');if(c.role==='comms')await a.locator('[data-a="comms-report"]').click();if(c.role==='nav')await a.locator('[data-a="report"]').click();}
 const pilot=ship().crew.find(c=>c.role==='pilot');aboard({x:pilot.seatPose.x,y:pilot.seatPose.y,z:pilot.seatPose.z+.8});await sync();await talk(a,pilot.id);
 await a.locator('[data-a="order"][data-o="goto"]').click();await a.locator('[data-a="goto"][data-p="sp:phobos"]').click();await a.waitForFunction(()=>!!cosmos.space.trip);
 await w.enqueue(()=>w.advance(20));await sync();await talk(a,pilot.id);
 for(const warp of [1,5,20,60]){await a.locator('[data-a="warp"][data-w="'+warp+'"]').click();await a.waitForFunction(w=>cosmos.space.trip.warp===w,warp);}
 await shot(a,'desktop-10-pilot-trip-speeds');results.pilotTripSpeeds=true;
 await action(a,{type:'crew-order',order:'hold'});await action(a,{type:'cancel-trip'});await sync();
 // Restore a grounded fixture for desktop / phone station and observation checks.
 const f=sim().flight;f.override=null;f.attitude=null;f.setDown(w.site.toWorld(0,2,0),w.site.heading);for(let i=0;i<540;i++)f.step(1/60);sim().trip=null;
 for(const ctl of Object.values(sim().ship.rampCtl)){ctl.progress=0;ctl.target=0;}
 for(const seat of SEATS){aboard(seat,seat.id);await sync();assert.equal(await a.evaluate(()=>cosmos.ship.seat.id),seat.id);
  if(['captain','gun_dorsal','gun_ventral'].includes(seat.id)){const before={...sim().guns.shots};await a.locator('#btn-fire').dispatchEvent('pointerdown',{pointerId:1});clock+=200;await a.evaluate(()=>cosmos.step(.21));await a.locator('#btn-fire').dispatchEvent('pointerup',{pointerId:1});await sync();assert.ok(Object.values(sim().guns.shots).some((n,i)=>n>Object.values(before)[i]));}
 }
 aboard(OBSERVATION[0]);await sync();await a.evaluate(()=>cosmos.ship.contextAction().run());await a.evaluate(()=>{for(let i=0;i<30;i++)cosmos.step(1/60);});assert.equal(await a.evaluate(()=>cosmos.ship.zoomOn),true);await shot(a,'desktop-11-observation-binoculars');results.observation=true;
 // The same worker questions on an actual solo browser must render the same answers.
 const soloCtx=await context(),solo=await ready(soloCtx,true);results.soloTalkCompared=[];
 for(const row of results.workers){const worker=PORT_WORKERS.find(m=>m.id===row.id);await solo.evaluate(m=>{const c=cosmos;c.ship.aboard=false;Object.assign(c.walker.worldPos,c.port.site.toWorld(m.x,(m.y||0)+.02,m.z+1));c.walker.velocity={x:0,y:0,z:0};c.walker.updateFrame();c.crewUI.close();c.step(.21);},worker);
  await talk(solo,worker.id);await solo.locator('[data-a="worker-question"]').click();assert.equal(await solo.locator('#crew-panel').innerText(),row.answer);results.soloTalkCompared.push(worker.id);}
 await soloCtx.close();
 const phoneCtx=await context(true),phone=await ready(phoneCtx),pid=await phone.evaluate(()=>cosmos.world.playerId);
 ground(-28,.02,-56,pid);await sync(phone,pid);await shot(phone,'phone-01-clear-world');
 await phone.locator('#multiplayer-button').tap();await shot(phone,'phone-02-world-crew');
 async function panelCheck(page,selector,close){const data=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();el.scrollTop=el.scrollHeight;return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:el.clientHeight,content:el.scrollHeight,touch:getComputedStyle(el).touchAction};});
  assert.ok(data.top>=0&&data.bottom<=844&&data.left>=0&&data.right<=390,selector+JSON.stringify(data));assert.equal(data.touch,'pan-y');
  if(close){const rect=await page.locator(close).boundingBox();assert.ok(rect&&rect.y>=data.top&&rect.y+rect.height<=data.bottom,close+' unreachable');}return data;}
 results.phonePanels={world:await panelCheck(phone,'#multiplayer-panel','.world-close')};await shot(phone,'phone-03-world-scrolled');await phone.locator('.world-close').tap();
 await phone.locator('#btn-settings').tap();results.phonePanels.settings=await panelCheck(phone,'#settings-panel','#btn-close-settings');assert.ok(await phone.locator('#save-status').innerText());assert.equal(await phone.locator('#back-link').evaluate(e=>e.closest('#settings-panel')?.id),'settings-panel');await shot(phone,'phone-04-settings');
 await phone.locator('#settings-account').tap();results.phonePanels.account=await panelCheck(phone,'#account-panel','.account-close');await shot(phone,'phone-05-account');await phone.locator('.account-close').tap();
 ground(-70,.02,51.25,pid);await sync(phone,pid);await talk(phone,'trader-1');await phone.locator('[data-a="worker-trade"]').tap();results.phonePanels.talk=await panelCheck(phone,'#crew-panel','#crew-panel .x');await shot(phone,'phone-06-talk-trader');await phone.locator('#crew-panel .x').tap();
 ground(-60,22.52,-35.8,pid);await sync(phone,pid);await talk(phone,'cab-supervisor');await shot(phone,'phone-07-talk-tower');await phone.locator('#crew-panel .x').tap();
 const candidate=Object.values(w.state.pool).find(c=>!c.shipId&&c.role==='pilot');ground(-28,.02,-56,pid);await w.enqueue(()=>w.advance(35));await sync(phone,pid);ground(candidate.position.x,.02,candidate.position.z+1,pid);await sync(phone,pid);await talk(phone,candidate.id);await shot(phone,'phone-08-talk-candidate');await phone.locator('#crew-panel .x').tap();
 // Open every station sheet on the phone and verify its entire content can scroll.
 results.phoneStations=[];
 for(const seat of SEATS){aboard(seat,seat.id,pid);await sync(phone,pid);const display=await phone.locator('#ship-panel').evaluate(e=>getComputedStyle(e).display);
  if(display!=='none')results.phoneStations.push({seat:seat.id,...await panelCheck(phone,'#ship-panel')});
  if(seat.id==='engineer')await shot(phone,'phone-09-engineering');if(seat.id==='nav'){await phone.locator('#chip-course').tap();results.phonePanels.course=await panelCheck(phone,'#space-sheet','#space-sheet .close');await shot(phone,'phone-10-course');await phone.locator('#space-sheet .close').tap();await phone.locator('#chip-jobs').tap();results.phonePanels.jobs=await panelCheck(phone,'#space-sheet','#space-sheet .close');await shot(phone,'phone-11-jobs');await phone.locator('#space-sheet .close').tap();}
 }
 await phone.locator('#btn-key-controls').tap();results.phonePanels.controls=await panelCheck(phone,'#key-pad');await shot(phone,'phone-12-controls');await phone.locator('#touch-key-Escape').tap();assert.equal(await phone.locator('#key-pad').evaluate(e=>getComputedStyle(e).display),'none');
 assert.deepEqual(errors,[]);results.pageErrors=errors;console.log('All browser walk / conversation / phone assertions passed.');
}finally{await writeFile(join(out,'walk-results.json'),JSON.stringify({results,errors},null,2));await browser?.close();await app?.close();await rm(temp,{recursive:true,force:true});}
