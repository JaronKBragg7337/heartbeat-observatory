// Deterministic browser walkthrough using this repo's existing Chromium harness.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const here=fileURLToPath(new URL('.',import.meta.url));
const require=createRequire('file:///C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await ctx.newPage(),errors=[],results={};
page.on('pageerror',e=>errors.push(String(e)));
async function shot(name){await page.evaluate(()=>{cosmos.economyUI.draw();cosmos.crewUI.update(.21);});await page.screenshot({path:here+name+'.png'});console.log('Screenshot:',name);}
async function ready(){await page.waitForFunction(()=>window.cosmos?.crewUI&&cosmos.crew.members.size===6&&[...cosmos.crew.members.values()].every(m=>m.person.loaded)&&cosmos.portPeople.members.every(m=>m.person.loaded),null,{timeout:120000});await page.evaluate(()=>cosmos.engine.stop());}
async function near(id,crew=false){await page.evaluate(({id,crew})=>{
  const c=cosmos;c.freeCam.off();c.portTour('off');c.ship.aboard=false;if(c.ship.seat)c.ship.stations.stand();c.crewUI.close();
  const m=crew?c.crew.members.get(id):c.portPeople.members.find(m=>m.id===id);
  let p=crew?c.port.site.toLocal(m.gpos):m;
  Object.assign(c.walker.worldPos,c.port.site.toWorld(p.x,(p.y||0)+.02,p.z+(id==='cab-supervisor'?.6:1.7)));Object.assign(c.walker.velocity,{x:0,y:0,z:0});
  c.walker.grounded=true;c.walker.yaw=c.port.site.heading;c.walker.pitch=-.05;c.walker.updateFrame();c.rebuildNear(true);
  for(let i=0;i<3;i++)c.step(1/60);c.crewUI.update(.21);c.economyUI.draw();
},{id,crew});}
async function talk(){await page.locator('#crew-talk').dispatchEvent('pointerup');}
function fingerprint(){
  let h=2166136261;const bricks=[...cosmos.edits.bricks.values()].filter(b=>b.edited).sort((a,b)=>a.bx-b.bx||a.by-b.by||a.bz-b.bz);
  for(const b of bricks)for(const v of new Uint32Array(b.phi.buffer))h=Math.imul(h^v,16777619);
  return {hash:h>>>0,bricks:bricks.length,piles:cosmos.edits.piles.length};
}
try {
  await page.goto('http://localhost:8394/?tier=low&depth=16',{waitUntil:'load'});await ready();
  results.boot=await page.evaluate(()=>({purse:cosmos.world.state.economy.marks,crew:cosmos.crew.members.size,depth:cosmos.depthBits,emulated:cosmos.depthEmulated}));
  assert.equal(results.boot.purse,10000);await shot('01-desktop-arrival');console.log('Dev server verified: game, six crew, purse rendered.');
  await near('comms',true);await talk();await shot('02-comms-hire');
  await page.locator('[data-a="hire"]').click();
  results.hire=await page.evaluate(()=>({purse:cosmos.world.state.economy.marks,status:cosmos.crew.members.get('comms').status}));
  assert.equal(results.hire.purse,9600);assert.equal(results.hire.status,'hired');
  results.boarding=await page.evaluate(()=>{
    const c=cosmos;for(let i=0;i<140*30;i++){c.ship.flight.step(1/30);c.crew.update(1/30);}
    const m=c.crew.members.get('comms');c.at('bridge',.5,-15,70,-3,3);
    return {seated:m.seated,place:m.place,seat:m.def.seat,position:{x:m.sw.x,y:m.sw.y,z:m.sw.z},log:c.ship.stations.log.slice(-3)};
  });assert.equal(results.boarding.seated,true);assert.equal(results.boarding.seat,'comms');await shot('03-comms-at-station');
  await near('trader-1');await talk();await page.locator('[data-a="worker-question"]').click();await shot('04-trader-conversation');
  await page.locator('[data-a="worker-reply"]').click();await page.locator('[data-a="purchase"]').click();
  results.buy=await page.evaluate(()=>({purse:cosmos.world.state.economy.marks,food:cosmos.world.state.economy.inventory.food}));
  assert.equal(results.buy.food,1);assert.equal(results.buy.purse,9588);
  await page.locator('[data-a="sale"]').click();await shot('05-trader-buy-sell');
  // Real dig action through the same touch key used by a phone. Keep the load.
  await page.evaluate(()=>{
    const c=cosmos;c.crewUI.close();Object.assign(c.walker.worldPos,c.port.site.toWorld(-92,.02,-14));Object.assign(c.walker.velocity,{x:0,y:0,z:0});
    c.walker.grounded=true;c.walker.yaw=c.port.site.heading;c.walker.pitch=-1.1;c.walker.updateFrame();c.setTool(2);c.rebuildNear(true);c.step(.21);
  });
  await page.locator('#btn-key-controls').click();await page.locator('#touch-key-KeyE').dispatchEvent('pointerdown',{pointerId:1});await page.locator('#touch-key-KeyE').dispatchEvent('pointerup',{pointerId:1});
  await page.locator('#btn-key-controls').click();
  results.dig=await page.evaluate(async()=>{const c=cosmos;await c.world.flush();c.flushTerrain();c.step(0);return {edits:c.edits.edits.length,mass:c.digger.carriedMass(),ledger:c.ledger()};});
  assert.ok(results.dig.mass>1000);assert.equal(results.dig.ledger.unaccountedKg,0);await shot('06-dug-hole');
  results.secondDig=await page.evaluate(async()=>{
    const c=cosmos;Object.assign(c.walker.worldPos,c.port.site.toWorld(-89,.02,-14));Object.assign(c.walker.velocity,{x:0,y:0,z:0});c.walker.updateFrame();
    const r=c.doDig();await c.world.flush();return {ok:r.ok,mass:c.digger.carriedMass()};
  });assert.equal(results.secondDig.ok,true);assert.ok(results.secondDig.mass>2000);
  await near('depot-clerk');await talk();await page.locator('[data-a="worker-trade"]').click();await page.locator('[data-a="regolith-sale"]').click();
  results.regolith=await page.evaluate(()=>({purse:cosmos.world.state.economy.marks,cargo:cosmos.digger.carriedMass(),ledger:cosmos.ledger()}));
  assert.equal(results.regolith.purse,9606);assert.equal(results.regolith.ledger.unaccountedKg,0);await shot('07-depot-weigh-in');
  // Take the moving elevator up, then approach the supervisor.
  results.elevator=await page.evaluate(async()=>{
    const c=cosmos,T=(await import('/src/port/portSpec.js')).TOWER;c.crewUI.close();
    const e=c.port.elevator;Object.assign(e,{y:0,open:1,phase:'open',target:0,speed:0});
    Object.assign(c.walker.worldPos,c.port.site.toWorld(T.x,.02,T.z-1));Object.assign(c.walker.velocity,{x:0,y:0,z:0});c.walker.grounded=true;
    e.request(T.cab.floorY);for(let i=0;i<1200;i++){c.walker.tick(1/60,{});c.port.tick(1/60,c.walker);}
    return {car:e.y,feet:c.port.site.toLocal(c.walker.worldPos).y};
  });assert.ok(results.elevator.car>22&&results.elevator.feet>22);
  await near('cab-supervisor');await talk();await page.locator('[data-a="worker-question"]').click();await page.locator('[data-a="worker-reply"]').click();
  await page.locator('[data-a="quest-accept"]').click();await shot('08-tower-quest-accepted');
  await page.evaluate(()=>{
    const c=cosmos;c.crewUI.close();Object.assign(c.walker.worldPos,c.port.site.toWorld(-83,.02,24));Object.assign(c.walker.velocity,{x:0,y:0,z:0});c.walker.grounded=true;
    c.walker.yaw=c.port.site.heading;c.walker.pitch=-.1;c.step(.3);c.economyUI.draw();
  });await shot('09-marked-delivery-bay');await page.locator('#quest-deliver').click();
  results.quest=await page.evaluate(()=>({quest:cosmos.world.state.economy.quests,purse:cosmos.world.state.economy.marks,ledger:cosmos.ledger()}));
  assert.equal(results.quest.quest['depot-foundation'].status,'complete');assert.equal(results.quest.purse,10006);assert.equal(results.quest.ledger.unaccountedKg,0);
  results.spoil=await page.evaluate(async()=>{
    const c=cosmos;Object.assign(c.walker.worldPos,c.port.site.toWorld(-96,.02,-14));Object.assign(c.walker.velocity,{x:0,y:0,z:0});c.walker.grounded=true;c.walker.yaw=c.port.site.heading;c.walker.pitch=-1.1;c.walker.updateFrame();
    const cut=c.doDig(),pour=c.doDump();await c.world.flush();c.rebuildNear(true);c.step(.21);c.flushTerrain();
    if(pour.ok){const p=c.port.site.toLocal(pour.pile);c.freeCam.set(c.port.site.toWorld(p.x+3,p.y+2.8,p.z+5),c.port.site.toWorld(p.x,p.y+.4,p.z));c.step(0);}
    return {cut:cut.ok,pour:pour.ok,piles:c.edits.piles.length,cargo:c.digger.carriedMass(),ledger:c.ledger()};
  });assert.equal(results.spoil.pour,true);assert.equal(results.spoil.ledger.unaccountedKg,0);await shot('14-spoil-heap');
  results.firing=await page.evaluate(async()=>{
    const c=cosmos;c.freeCam.off();c.ship.teleport('gun_ventral');c.ship.look.pitch=-.8;c.step(.1);
    c.desktop.held.add('KeyF');for(let i=0;i<12;i++)c.step(1/60);c.desktop.held.delete('KeyF');
    for(let i=0;i<60;i++)c.step(1/60);await c.world.flush();
    return {groundScars:Object.keys(c.world.state.damage).filter(k=>k.startsWith('ground:')).length};
  });assert.ok(results.firing.groundScars>0,'Real F-key shots must create saved impact actions');
  // Relocate the single existing ship and put the player in its pilot chair.
  // This deliberately uses the public debug hook, keeping another builder's flight code untouched.
  results.beforeRefresh=await page.evaluate(async()=>{
    const c=cosmos;c.ship.flight.pos.x+=120;c.ship.flight.hull=83;c.ship.flight.landed=false;c.ship.flight.autoHover=true;c.at('bridge',0,-14,0,0,1);
    c.ship.takeSeat('pilot');c.world.dispatch({type:'damage',id:'qa-scar',amount:1,position:c.port.site.toWorld(-90,0,-10),up:c.port.site.up});
    c.worldBridge.checkpoint();await c.world.flush();
    return {ship:{...c.ship.flight.pos},player:{x:c.ship.sw.x,y:c.ship.sw.y,z:c.ship.sw.z},seat:c.ship.seat?.id,hull:c.ship.flight.hull,marks:c.world.state.economy.marks,
      edits:c.edits.edits.length,cargo:c.digger.carriedMass(),crew:c.crew.snapshot(),damage:c.world.state.damage,quest:c.world.state.economy.quests};
  });results.beforeRefresh.terrain=await page.evaluate(fingerprint);await page.reload({waitUntil:'load'});await ready();
  results.afterRefresh=await page.evaluate(()=>{const c=cosmos;return {ship:{...c.ship.flight.pos},seat:c.ship.seat?.id,hull:c.ship.flight.hull,marks:c.world.state.economy.marks,edits:c.edits.edits.length,cargo:c.digger.carriedMass(),comms:c.crew.members.get('comms').status,quest:c.world.state.economy.quests,damage:c.world.state.damage,ledger:c.ledger()};});
  assert.equal(results.afterRefresh.seat,'pilot');assert.equal(results.afterRefresh.comms,'hired');assert.equal(results.afterRefresh.marks,results.beforeRefresh.marks);
  assert.equal(results.afterRefresh.edits,results.beforeRefresh.edits);assert.equal(results.afterRefresh.cargo,results.beforeRefresh.cargo);
  assert.equal(results.afterRefresh.quest['depot-foundation'].status,'complete');assert.ok(results.afterRefresh.damage['qa-scar']);
  assert.equal(results.afterRefresh.ledger.unaccountedKg,0);assert.ok(Math.hypot(...['x','y','z'].map(k=>results.afterRefresh.ship[k]-results.beforeRefresh.ship[k]))<3);
  results.afterRefresh.terrain=await page.evaluate(fingerprint);assert.deepEqual(results.afterRefresh.terrain,results.beforeRefresh.terrain);
  await shot('10-refreshed-aboard');
  // A phone context, with real touch events and a distinct fresh local world.
  const phoneCtx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const phone=await phoneCtx.newPage();phone.on('pageerror',e=>errors.push('phone: '+e));
  await phone.goto('http://localhost:8394/?tier=low&depth=16',{waitUntil:'load'});
  await phone.waitForFunction(()=>window.cosmos?.crewUI&&cosmos.portPeople.members.every(m=>m.person.loaded),null,{timeout:120000});await phone.evaluate(()=>cosmos.engine.stop());
  await phone.screenshot({path:here+'11-phone-arrival.png'});
  await phone.locator('#btn-key-controls').tap();
  const key=phone.locator('#touch-key-KeyG');await key.dispatchEvent('pointerdown',{pointerId:3});await key.dispatchEvent('pointerup',{pointerId:3});
  results.phone=await phone.evaluate(()=>({debug:cosmos.debugLayer.enabled,depth:cosmos.depthEmulated,buttons:[...document.querySelectorAll('#key-pad button')].map(b=>({id:b.id,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.equal(results.phone.debug,true);assert.equal(results.phone.overflow,false);assert.ok(results.phone.buttons.every(b=>b.width>=44&&b.height>=44));
  await phone.screenshot({path:here+'12-phone-controls-debug.png'});
  await phone.locator('#btn-key-controls').tap();await phone.evaluate(()=>cosmos.debugLayer.setEnabled(false));
  await phone.evaluate(()=>{const c=cosmos,m=c.portPeople.members.find(m=>m.id==='trader-3');Object.assign(c.walker.worldPos,c.port.site.toWorld(m.x,.02,m.z+1.7));c.walker.yaw=c.port.site.heading;c.step(.21);c.crewUI.update(.21);});
  await phone.locator('#crew-talk').dispatchEvent('pointerup');await phone.locator('[data-a="worker-trade"]').tap();await phone.locator('[data-a="purchase"]').tap();
  results.phone.water=await phone.evaluate(()=>{cosmos.economyUI.draw();return cosmos.world.state.economy.inventory.water;});assert.equal(results.phone.water,1);
  await phone.screenshot({path:here+'13-phone-trade.png'});
  assert.equal(errors.length,0,errors.join('\n'));results.errors=errors;
  console.log('All browser assertions passed.');
} catch(e) {results.failure=String(e.stack||e);console.error(e);await page.screenshot({path:here+'failure.png'}).catch(()=>{});process.exitCode=1;}
finally {results.errors=errors;await writeFile(here+'browser-results.json',JSON.stringify(results,null,2));await browser.close();}
