import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { initialEconomy, reduceEconomy, inventoryMass, takeRegolith, sumExact } from '../src/economy/economy.js';
import { WAGES, SOL_SECONDS, QUESTS, TRADERS, GOODS } from '../src/economy/catalog.js';
import { WorldState } from '../src/world-state/worldState.js';
import { MemoryAdapter } from '../src/world-state/storage.js';
import { encodeBrick, terrainMeta, restoreTerrain } from '../src/world-state/terrainCodec.js';
import { TOUCH_PATHS } from '../src/ui/keyActions.js';
export async function runEconomyChecks({ROOT,check,section,mars,FIELD}) {
  section('13. Money, mass, wages, dialogue and a saved world');
  const funds=e=>e.marks+e.marketMarks+e.payrollMarks+e.questFundMarks;
  const rejects=(e,a)=>{const before=JSON.stringify(e);let threw=false;try{reduceEconomy(e,a);}catch{threw=true;}return threw&&JSON.stringify(e)===before;};
  let e=initialEconomy(),initial=funds(e);
  check('starting purse is 2,500 credits / 10,000 Mars marks',e.marks===10000);
  const rewarded=reduceEconomy(e,{type:'space-award',credits:300});
  const loadedHold=reduceEconomy(rewarded,{type:'space-cargo-add',item:'phobos-core-sample',kg:4.5});
  const deliveredHold=reduceEconomy(loadedHold,{type:'space-cargo-remove',item:'phobos-core-sample',kg:4.5});
  check('space rewards use the real marks purse and cargo transfers use the saved hold',rewarded.marks===11200&&loadedHold.hold['phobos-core-sample']===4.5&&deliveredHold.hold['phobos-core-sample']===0);
  check('invalid space rewards and overselling the hold leave money and cargo untouched',rejects(e,{type:'space-award',credits:NaN})&&rejects(loadedHold,{type:'space-cargo-remove',item:'phobos-core-sample',kg:5}));
  for(const id of Object.keys(WAGES)) {
    const before=e.marks;e=reduceEconomy(e,{type:'hire',id});
    check(`${id}: signing fee equals one sol wage`,before-e.marks===WAGES[id]*4);
  }
  check('all six crew can be hired when the purse covers them',Object.keys(e.crew).length===6);
  check('duplicate hire cannot double-charge',rejects(e,{type:'hire',id:'comms'}));
  check('insufficient funds cannot hire or mutate state',rejects({...initialEconomy(),marks:399},{type:'hire',id:'comms'}));
  const due=e.marks;e=reduceEconomy(e,{type:'wages',seconds:SOL_SECONDS-1});
  check('no wage taken before a full Mars sol',e.marks===due);
  e=reduceEconomy(e,{type:'wages',seconds:1});
  check('all due wages transfer once and exactly',due-e.marks===Object.values(WAGES).reduce((s,w)=>s+w*4,0)&&funds(e)===initial);
  const paid=e.marks;e=reduceEconomy(e,{type:'wages',seconds:0});check('retrying a sol does not charge wages twice',e.marks===paid);
  e=reduceEconomy({...e,marks:0},{type:'wages',seconds:SOL_SECONDS});check('unpaid crew flagged for departure',Object.values(e.crew).every(c=>c.unpaid));
  e=reduceEconomy(e,{type:'fire',id:'comms'});check('unpaid contract can be terminated',!e.crew.comms);
  check('replacement still costs a new signing fee',rejects(e,{type:'hire',id:'comms'}));
  e=initialEconomy();
  for(const [id,t] of Object.entries(TRADERS))for(const good of t.goods) {
    const fundsBefore=funds(e),count=e.inventory[good]+e.traders[id][good],mass=inventoryMass(e.inventory),purse=e.marks;
    e=reduceEconomy(e,{type:'purchase',trader:id,good});
    check(`${id}/${good}: buying moves exact stock, mass and marks`,e.marks===purse-GOODS[good].buy&&inventoryMass(e.inventory)===mass+GOODS[good].massKg&&e.inventory[good]+e.traders[id][good]===count&&funds(e)===fundsBefore);
    e=reduceEconomy(e,{type:'sale',trader:id,good});
    check(`${id}/${good}: selling returns goods and mass; spread stays with dealer`,e.inventory[good]===0&&e.traders[id][good]===count&&inventoryMass(e.inventory)===mass&&funds(e)===fundsBefore);
  }
  for(const a of [{type:'purchase',trader:'trader-1',good:'ammo'}, {type:'sale',trader:'trader-1',good:'food'},
    {type:'purchase',trader:'trader-1',good:'food',quantity:-1},{type:'purchase',trader:'trader-1',good:'food',quantity:.5},
    {type:'purchase',trader:'trader-1',good:'food',quantity:1000}])check('invalid/unowned/out-of-stock trade rejected atomically '+JSON.stringify(a),rejects(e,a));
  check('traders have distinct dialogue trees',new Set(Object.values(TRADERS).map(t=>t.answer)).size===5);
  const lot={lotId:'test-lot',materialId:'MAT-REGOLITH',massKg:2450,solidVolumeM3:1.53125,looseVolumeM3:1.53125,
    parts:[{materialId:'MAT-REGOLITH',massKg:2450,volumeM3:1.53125}]};
  e=initialEconomy();e.cargo=[lot];const allFunds=funds(e),mass=sumExact(e.cargo,'massKg'),vol=sumExact(e.cargo,'solidVolumeM3');
  e=reduceEconomy(e,{type:'regolith-sale',tonnes:1});
  check('depot buys precisely one tonne for 12 marks / 3 credits',e.marks===10012&&e.cargo[0].massKg===1450&&e.depotLots[0].massKg===1000);
  check('sale accounts every binary mass and volume bit including retained load',sumExact(e.cargo,'massKg')+BigInt(e.exportedMassExact)===mass&&sumExact(e.cargo,'solidVolumeM3')+BigInt(e.exportedVolumeExact)===vol&&funds(e)===allFunds);
  check('mixed rock rejected as raw regolith',rejects({...initialEconomy(),cargo:[{...lot,parts:[{materialId:'MAT-BASALT',massKg:2450,volumeM3:1.53125}]}]},{type:'regolith-sale',tonnes:1}));
  const q=QUESTS[0];e=reduceEconomy(e,{type:'quest-accept',id:q.id});
  check('quest acceptance persisted as data',e.quests[q.id].status==='active');
  check('delivery away from marked bay rejected',rejects(e,{type:'quest-step',id:q.id,position:{x:0,z:0}}));
  e=reduceEconomy(e,{type:'quest-step',id:q.id,position:q.target});
  check('delivery completes and transfers 400 marks exactly once',e.quests[q.id].status==='complete'&&e.marks===10412&&e.cargo[0].massKg===450&&funds(e)===allFunds);
  check('completed quest cannot pay twice',rejects(e,{type:'quest-step',id:q.id,position:q.target}));
  check('quest and depot exports close the same exact mass ledger',sumExact(e.cargo,'massKg')+BigInt(e.exportedMassExact)===mass&&sumExact(e.cargo,'solidVolumeM3')+BigInt(e.exportedVolumeExact)===vol);
  const extra={...q,id:'test-second-job',tonnes:2,rewardMarks:333,title:'Second foundation',target:{x:-86,z:20,radius:3}};
  QUESTS.push(extra);
  try {
    let extraState={...initialEconomy(),cargo:[lot]};extraState=reduceEconomy(extraState,{type:'quest-accept',id:extra.id});
    extraState=reduceEconomy(extraState,{type:'quest-step',id:extra.id,position:extra.target});
    const {workerHTML}=await import('../src/economy/dialogue.js');
    const html=workerHTML({id:q.giver,line:'Watch.'},'main',initialEconomy());
    check('adding a quest record reuses acceptance, tonnes, reward and giver dialogue',extraState.marks===10333&&extraState.cargo[0].massKg===450&&html.includes(extra.id)&&html.includes(q.id));
  } finally {QUESTS.pop();}
  // Real lattice roundtrip, including a poured heap and carried matter.
  const {EditStore}=await import('../src/world/edits.js'),s=new EditStore(mars);
  const {geodeticToCartesian}=await import('../src/world/geodesy.js');
  const p=geodeticToCartesian(mars,-14,-59.2,0),len=Math.hypot(p.x,p.y,p.z),u={x:p.x/len,y:p.y/len,z:p.z/len};
  const r=FIELD.surfaceRadiusFast(mars,u.x,u.y,u.z),pt={x:u.x*r,y:u.y*r,z:u.z*r};
  FIELD.attachEdits(s);
  try {
    const l=s.carve({...pt,r:.17});
    const anchor={x:pt.x+2,y:pt.y+2,z:pt.z+2};
    const al=Math.hypot(anchor.x,anchor.y,anchor.z),ar=FIELD.surfaceRadiusFast(mars,anchor.x/al,anchor.y/al,anchor.z/al);
    s.deposit(l,anchor.x/al*ar,anchor.y/al*ar,anchor.z/al*ar);
    const data=[...s.bricks.values()].filter(b=>b.edited).map(b=>encodeBrick(s,b)),meta=structuredClone(terrainMeta(s)),restored=new EditStore(mars);
    restoreTerrain(restored,meta,data);
    const equal=[...s.bricks.values()].every(b=>{const n=restored.brickAt(b.bx,b.by,b.bz);return n&&b.phi.every((v,i)=>Object.is(v,n.phi[i]))&&(!b.rho||b.rho.every((v,i)=>v===n.rho[i]));});
    check('saved dig AND spoil reproduce every lattice sample bit-for-bit',equal);
    const changed=data.find(r=>r.offsets.length>0),cleared={...changed,offsets:new Uint16Array(),phi:new Float32Array(),rho:new Float32Array(),mat:new Uint8Array()};
    const replacement=new EditStore(mars);restoreTerrain(replacement,meta,[changed]);restoreTerrain(replacement,meta,[cleared]);
    const b=replacement.brickAt(changed.bx,changed.by,changed.bz),n=changed.offsets[0];
    check('a replacing sparse terrain patch clears cells that returned to natural ground',b.phi[n]===Math.fround(replacement.baseLattice(b.bx*32+(n&31),b.by*32+((n>>5)&31),b.bz*32+(n>>10))));
    check('saved ledger restores all exact BigInt accounts',restored._removedM===s._removedM&&restored._depositedM===s._depositedM&&restored.ledger().unaccountedKg===0);
    const bytes=data.reduce((n,b)=>n+b.offsets.byteLength+b.phi.byteLength+b.rho.byteLength+b.mat.byteLength,0),raw=s.bricks.size*32768*9;
    check('sparse dig save is smaller than full bricks and has no float JSON',bytes<raw&&data.every(b=>b.phi instanceof Float32Array&&b.offsets instanceof Uint16Array),`${bytes} / ${raw} bytes`);
    const adapter=new MemoryAdapter(),world=new WorldState(adapter);world.state.economy=e;world.state.terrain=meta;world.state.crew=[{id:'comms',place:'ship'}];
    world.state.player={worldPos:{x:1,y:2,z:3},aboard:true,seat:'pilot'};
    world.dispatch({type:'ship-pose',pose:{pos:{x:123,y:456,z:789}}});
    world.dispatch({type:'damage',id:'ground:1',amount:2,position:{x:1,y:2,z:3},up:{x:0,y:1,z:0}});
    await world.persist(data);await world.flush();const fresh=new WorldState(adapter),loaded=await fresh.load();
    check('fresh authority restores one ship, player, hired comms, purse, quest and damage',JSON.stringify(fresh.state)===JSON.stringify(world.state)&&fresh.state.ship.pos.x===123&&fresh.state.economy.quests[q.id].status==='complete'&&loaded.bricks.length===data.length);
    const before=JSON.stringify(fresh.state);const bad=fresh.dispatch({type:'hire',id:'no-role'});
    check('rejected world action does not change revision or saved state',!bad.ok&&JSON.stringify(fresh.state)===before);
    const failing=new WorldState({save:async()=>{throw Error('quota');}});failing.dispatch({type:'player-pose',pose:{worldPos:{x:0,y:0,z:0}}});
    await failing.pending;check('storage failure visible and blocks further mutations',failing.error==='quota'&&!failing.dispatch({type:'hire',id:'comms'}).ok);
  } finally {FIELD.attachEdits(null);}
  // Scan string literals, not comments: explicit prompt tokens must have a touch path.
  const files=[];const walk=d=>{for(const f of readdirSync(d,{withFileTypes:true})){const p=join(d,f.name);if(f.isDirectory())walk(p);else if(/\.(js|html)$/.test(f.name)&&f.name!=='lola-data.js')files.push(p);}};
  walk(join(ROOT,'src'));files.push(join(ROOT,'index.html'));
  const missing=[];
  for(const file of files) {
    const text=readFileSync(file,'utf8'),strings=[];
    if(file.endsWith('.html'))strings.push(text);
    else for(let i=0;i<text.length;i++) {
      if(text.slice(i,i+2)==='//'){i=text.indexOf('\n',i);if(i<0)break;continue;}
      if(text.slice(i,i+2)==='/*'){i=text.indexOf('*/',i+2)+1;continue;}
      if(!['"',"'",'`'].includes(text[i]))continue;
      const quote=text[i],start=i++;
      for(;i<text.length;i++){if(text[i]==='\\'){i++;continue;}if(text[i]===quote)break;}
      strings.push(text.slice(start,i+1));
    }
    for(const literal of strings) {
      const tokens=new Set();
      for(const m of literal.matchAll(/\b(?:press|Press|Keys?|keys?)\s+([A-Z1-3])\b|\(([A-Z1-3])\)|\b([A-Z])\s+(?:stand|fire|up|down|thrust|turn)\b/g))tokens.add(m[1]||m[2]||m[3]);
      if(/W\/S thrust/.test(literal)){tokens.add('W');tokens.add('S');}
      if(/A\/D turn/.test(literal)){tokens.add('A');tokens.add('D');}
      if(/Keys 1 2 3/.test(literal)){tokens.add('1');tokens.add('2');tokens.add('3');}
      if(/Space up/.test(literal))tokens.add('Space');
      for(const k of tokens){const code=k==='Space'?k:/\d/.test(k)?'Digit'+k:'Key'+k;if(!TOUCH_PATHS[code])missing.push(file+': '+k);}
    }
  }
  check('every key prompt in source has a registered touch path',missing.length===0,missing.join(', '));
  const controls=readFileSync(join(ROOT,'src/ui/keyActions.js'),'utf8');
  check('touch key paths create real buttons and dispatch both press and release',controls.includes('b.id=`touch-key-${code}`')&&controls.includes("new KeyboardEvent('keydown'")&&controls.includes("new KeyboardEvent('keyup'"));
}
