// The validator checks browser wiring too: pure geometry tests cannot catch a
// missing Talk UI, invisible roster, or a phone panel with no touch scrolling.
import {createRequire} from 'node:module';
import {homedir,tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServer} from '../server/index.mjs';
import {FileAdapter} from '../server/storage.mjs';
import {attachEdits, attachGrades} from '../src/world/field.js';
import {PORT_WORKERS} from '../src/port/portPeople.js';

export async function runParityUIChecks({check,section}){
 section('21. Solo / online browser conversations and phone overlays');
 // Earlier checks leave graded terrain and dug edits on the shared field. A server
 // built on that field would not match the browser's clean port, so Talk distance fails.
 attachEdits(null);attachGrades([]);
 const dir=await mkdtemp(join(tmpdir(),'cosmos-ui-parity-'));let app,browser;
 try{
  let chromium;try{({chromium}=createRequire(import.meta.url)('playwright'));}catch{({chromium}=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||join(homedir(),'.codex/runtime/unfinished-island/node_modules/'))('playwright'));}
  app=await startServer({adapter:new FileAdapter(join(dir,'world.json')),port:0,tick:false});
  const base='http://localhost:'+app.server.address().port,ws=app.url;
  browser=await chromium.launch({headless:true,...(process.env.COSMOS_CHROME||process.platform==='win32'?{executablePath:process.env.COSMOS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await ctx.addInitScript(ws=>{const WS=window.WebSocket;window.WebSocket=class extends WS{constructor(url,...rest){super(String(url).replace('ws://localhost:8390',ws),...rest);}};},ws);
  const online=await ctx.newPage(),solo=await ctx.newPage(),errors=[];for(const p of [online,solo])p.on('pageerror',e=>errors.push(String(e)));
  for(const [p,mode] of [[online,''],[solo,'&solo=1']]){await p.goto(base+'/?dev=1&opening=off&tier=low'+mode);await p.waitForFunction(()=>window.cosmos?.crewUI&&cosmos.portPeople.members.every(m=>m.person.loaded),null,{timeout:90000});await p.evaluate(()=>{cosmos.engine.stop();cosmos.engine.renderer.render=()=>{};});}
  assert.ok(await online.evaluate(()=>cosmos.world.remote));assert.ok(await solo.evaluate(()=>!cosmos.world.remote));
  const id=await online.evaluate(()=>cosmos.world.playerId),w=app.world;
  async function sync(){await w.enqueue(()=>w.commit());await online.evaluate(()=>cosmos.world.socket.send(JSON.stringify({type:'checkpoint'})));await online.waitForFunction(r=>cosmos.world.state.revision>=r,w.state.revision);await online.evaluate(()=>{cosmos.multiplayer.forcePlayer=true;cosmos.multiplayer.apply({bricks:[]});cosmos.walker.velocity={x:0,y:0,z:0};cosmos.crewUI._accum=1;cosmos.step(1/30);});}
  async function standAt(x,y,z){await w.enqueue(()=>{const p=w.state.players[id];p.aboardShipId=null;p.pose.aboard=false;p.pose.seat=null;p.pose.worldPos=w.site.toWorld(x,y,z);p.pose.velocity={x:0,y:0,z:0};p.pose.grounded=false;p.poseAt=Date.now();p.frameId='mars';});}
  for(const worker of PORT_WORKERS){await standAt(worker.x,(worker.y||0)+.02,worker.z+1);await sync();
   await solo.evaluate(m=>{const c=cosmos;c.ship.aboard=false;Object.assign(c.walker.worldPos,c.port.site.toWorld(m.x,(m.y||0)+.02,m.z+1));c.walker.velocity={x:0,y:0,z:0};c.walker.grounded=false;c.walker.updateFrame();c.crewUI._accum=1;c.crewUI.close();c.step(1/30);},worker);
   const texts=[];
   for(const page of [solo,online]){await page.evaluate(()=>{cosmos.walker.velocity={x:0,y:0,z:0};cosmos.crewUI._accum=1;cosmos.crewUI.close();cosmos.step(1/30);});
    const target=await page.evaluate(()=>({id:cosmos.crewUI.target?.id,remote:!!cosmos.world.remote,aboard:cosmos.ship.aboard,position:cosmos.port.site.toLocal(cosmos.walker.worldPos),correction:cosmos.multiplayer?.correction}));
    assert.equal(target.id,worker.id,JSON.stringify(target));await page.locator('#crew-talk').tap();await page.locator('[data-a="worker-question"]').tap();texts.push(await page.locator('#crew-panel').innerText());}
   assert.equal(texts[0],texts[1]);
  }
  check('all 15 workers expose Talk and answer the same question identically solo and online',true);
  await standAt(-28,.02,-56);await w.enqueue(()=>w.advance(25));await sync();
  await online.waitForFunction(()=>[...cosmos.crew.members.values()].every(m=>m.person.loaded));
  const c=Object.values(w.state.pool).find(c=>c.role==='pilot');assert.equal(c.status,'waiting');assert.ok(c.position.z>-60);
  await standAt(c.position.x,.02,c.position.z+1);await sync();await online.evaluate(()=>{cosmos.walker.velocity={x:0,y:0,z:0};cosmos.crewUI._accum=1;cosmos.crewUI.close();cosmos.step(1/30);});assert.equal(await online.evaluate(()=>cosmos.crewUI.target?.def.id),'pilot');
  assert.equal(await online.evaluate(id=>cosmos.multiplayer.bodies.get(id).group.visible,c.id),true);await online.locator('#crew-talk').tap();assert.ok(await online.locator('[data-a="hire"]').isVisible());
  check('online candidates walk through the hall door, remain visible and expose the Hire conversation',true);
  await online.locator('#crew-panel .x').tap();await online.locator('#multiplayer-button').tap();
  const bounds=await online.locator('#multiplayer-panel').evaluate(el=>{el.scrollTop=el.scrollHeight;const r=el.getBoundingClientRect(),b=el.querySelector('.world-close').getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right,closeTop:b.top,closeBottom:b.bottom,scroll:el.scrollTop,touch:getComputedStyle(el).touchAction};});
  assert.ok(bounds.top>=0&&bounds.bottom<=844&&bounds.right<=390&&bounds.scroll>0);assert.ok(bounds.closeTop>=bounds.top&&bounds.closeBottom<=bounds.bottom);assert.equal(bounds.touch,'pan-y');
  await online.locator('.world-close').tap();await online.locator('#btn-settings').tap();
  assert.equal(await online.locator('#back-link').evaluate(e=>e.closest('#settings-panel')?.id),'settings-panel');assert.ok((await online.locator('#save-status').innerText()).includes('shared world'));assert.ok(!(await online.locator('#purse').innerText()).includes('Saved'));
  check('390 px World / crew scrolls, Close stays reachable, and save status / Games live in Settings',true);
  assert.deepEqual(errors,[]);check('solo and online browser parity produces no page errors',true);
 }catch(e){check('browser UI parity scenario completes',false,e.stack);}
 finally{await browser?.close();await app?.close();await rm(dir,{recursive:true,force:true});}
}
