import '../server/runtime.mjs';
import assert from 'node:assert/strict';
import { freshOpening, needsOpening, OpeningModel, STAGE, OPENING_VERSION, LINER_WAKE, KESTREL_BOARD } from '../src/opening/state.js';
import { SEASON, CRASH_CAUSES, seasonNumber, crashCauseFor, currentSeason } from '../src/opening/season.js';
import { START_WORLDS, boardData, validChoice, worldFacts, openStartWorlds } from '../src/opening/worlds.js';
import * as D from '../src/opening/dialogue.js';
import * as S from '../src/opening/script.js';
import { linerPath, kestrelPath, ceresRelative } from '../src/opening/flightPath.js';
import { REPAIR_PARTS, REPAIR_GIVERS, giverFor } from '../src/opening/lifeboat.js';
import { VOICES } from '../src/voice/cast.js';
import { hasFaction } from '../src/factions/registry.js';
import { MemoryAdapter } from '../src/world-state/storage.js';
import { Authority } from '../server/authority.mjs';
import { attachEdits, attachGrades } from '../src/world/field.js';
import { getBody } from '../src/world/bodies.js';
import { createPortSite, PADS, BUILDINGS, APRON, WALKWAY, LINER_SPOT, onApron } from '../src/port/portSpec.js';
import { shipDef } from '../src/ships/registry.js';
import { ShipWalker, shipIndexFor, defaultState } from '../src/ship/shipWalker.js';
import { planPath } from '../src/crew/shipPath.js';
import { frameToOutpost, outpostToFrame } from '../src/worlds/ceres/layout.js';
import { makeMoon } from '../src/space/moonField.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

/** Aim the planet walker of a wreck-site model at (x, z) (local metres) so a dig lands there. */
export function aimOpening(model,x,z,y=.35){
  const w=model.walker,e=w.eyeWorldPos({}),p=model.toWorld(x,y,z),f=w.updateFrame();
  const d={x:p.x-e.x,y:p.y-e.y,z:p.z-e.z},l=Math.hypot(d.x,d.y,d.z);
  const dot=v=>d.x*v.x+d.y*v.y+d.z*v.z;
  w.yaw=Math.atan2(dot(f.east),dot(f.north));w.pitch=Math.asin(dot(f.up)/l);
  return model.pose();
}
/** Dig the crate clear (stage DIG). Returns how many bites it took. */
export function clearOpening(model){
  const s=model.state;s.stage=STAGE.DIG;model.use('wreck');s.pose={x:4,y:.03,z:18.5,yaw:0,pitch:-1};model.place(s.pose);
  let count=0;
  for(let round=0;round<7&&!model.exposed();round++)for(const [x,z] of [[4,20],[4.18,20],[3.82,20],[4,20.18],[4,19.82]]){
    s.pose=aimOpening(model,x,z);const r=model.act({type:'opening-dig'});if(r.ok)count++;
  }
  return count;
}
const pose=(model,p,seconds=1)=>model.act({type:'opening-pose',pose:{yaw:0,pitch:0,y:0,...p},seconds});
const throwsMsg=(fn)=>{try{fn();}catch(e){return e.message;}return null;};

export async function runOpeningChecks({check,section}){
  section('30. The opening, version 2: the liner, the port, the board, the Kestrel, the wreck');
  attachEdits(null);attachGrades([]);
  // ---- the season --------------------------------------------------------------------------------------------------------
  {
    let never=true;for(let n=1;n<=40;n++)if(crashCauseFor(n)===crashCauseFor(n+1))never=false;
    check('the crash cause rotates through all five causes and is never the same two seasons running',never&&new Set([1,2,3,4,5].map(crashCauseFor)).size===5&&CRASH_CAUSES.length===5);
    const first=currentSeason(Date.UTC(2026,9,3)),later=currentSeason(Date.UTC(2026,9,1)+SEASON.lengthDays*86400000+1);
    check('season one is the first sixty days from 1 October 2026; the next season has the next cause; a review override changes the cause only',
      first.number===1&&first.cause==='storm'&&later.number===2&&later.cause==='meteor'&&currentSeason(Date.UTC(2026,9,3),'pirates').cause==='pirates'&&currentSeason(Date.UTC(2026,9,3),'pirates').number===1&&seasonNumber(Date.UTC(2020,0,1))===1);
  }
  // ---- worlds and the board ---------------------------------------------------------------------------------------------
  {
    const open=openStartWorlds(),b=boardData({players:{ceres:3},online:{ceres:1},factions:{ironclad:2},season:{number:1,cause:'storm'}});
    check('five start worlds: Mars, Ceres, Earth and Callisto open, the Moon shown honestly as coming',START_WORLDS.length===5&&open.join()==='mars,ceres,earth,callisto'&&b.worlds.filter(w=>w.status==='coming').map(w=>w.id).join()==='moon');
    check('Earth is a start at the Skyward Launch Complex with Homeguard and Skyward, in dollars, and says Homeguard has nothing built',(()=>{const e=b.worlds.find(w=>w.id==='earth');return e.status==='open'&&e.factions.map(f=>f.id).join()==='homeguard,skyward'&&e.money==='dollars'&&/Skyward Launch Complex/.test(e.port)&&/nothing built/.test(e.port)&&Math.abs(e.facts.gravity-9.82)<.02&&validChoice('earth','skyward')&&validChoice('earth','homeguard')&&validChoice('earth',null)&&!validChoice('earth','fortis');})());
    check('Callisto is a start at the Valhalla Camp with Mystara and the open seat, in credits, and says the seat is unclaimed',(()=>{const e=b.worlds.find(w=>w.id==='callisto');return e.status==='open'&&e.factions.map(f=>f.id).join()==='mystara,unbound'&&e.money==='credits'&&/Valhalla Camp/.test(e.port)&&/open seat|open to whoever/.test(e.line)&&Math.abs(e.facts.gravity-1.236)<.01&&Math.abs(e.facts.dayH-400.5)<.2&&validChoice('callisto','mystara')&&validChoice('callisto','unbound')&&validChoice('callisto',null)&&!validChoice('callisto','fortis');})());
    check('every faction on the board is a faction of F0\'s style sheet, two on each world but Mars',START_WORLDS.every(w=>w.factions.every(hasFaction))&&START_WORLDS.filter(w=>w.id!=='mars').every(w=>w.factions.length===2)&&START_WORLDS.find(w=>w.id==='mars').factions.length===0);
    const ceres=b.worlds.find(w=>w.id==='ceres'),mars=b.worlds.find(w=>w.id==='mars');
    check('the board\'s numbers are the registries\': Ceres at Dawn\'s gravity and day, Mars at its own, live counts and goods prices',
      Math.abs(ceres.facts.gravity-.284)<.002&&Math.abs(ceres.facts.dayH-9.074)<.01&&Math.abs(mars.facts.gravity-3.72076)<1e-6&&ceres.players===3&&ceres.online===1&&ceres.factions.find(f=>f.id==='ironclad').members===2&&
      ceres.goods.some(g=>/130 marks/.test(g))&&ceres.facts.distanceMkm>100&&mars.facts.distanceMkm===0&&worldFacts('moon').source==='registry'&&worldFacts('earth').source==='registry'&&worldFacts('callisto').source==='registry'&&b.season.cause==='storm'&&b.moons.length===2);
    check('a start can be chosen only on an open world, with one of its two sides or none',validChoice('ceres','ironclad')&&validChoice('ceres',null)&&validChoice('mars',null)&&!validChoice('mars','ironclad')&&!validChoice('moon',null)&&!validChoice('ceres','fortis')&&!validChoice('nowhere',null));
  }
  // ---- the words -------------------------------------------------------------------------------------------------------------
  {
    const worlds=Object.entries(D.WORLD_DIALOGUE),keysOk=worlds.every(([,w])=>D.WORLD_DIALOGUE_KEYS.every(k=>k in w)&&Object.keys(w.locker).sort().join()==='name,note,photo,role');
    const driverKeys=worlds.map(([,w])=>Object.values(w.drivers).map(d=>Object.keys(d).sort().join()).join('|'));
    check('every world\'s dialogue file has the same keys, and every driver the same lines',keysOk&&new Set(driverKeys.map(s=>s.split('|')[0])).size===1&&worlds.every(([id,w])=>w.id===id));
    const lines=D.openingLines(),dashes=lines.filter(l=>/[–—]/.test(l.text));
    check('every spoken line has a known voice and a speaker the opening can place, and none uses a long dash',lines.length>110&&lines.every(l=>VOICES[l.voice]&&D.speakerOf(l.text)&&D.speakerOf(l.text).voice===l.voice||l.voice==='ship'&&D.speakerOf(l.text))&&dashes.length===0,dashes.map(l=>l.text).join(' | '));
    let timing=true;for(const l of D.LINER_SCRIPT)timing&&=l.t0<l.t1&&l.t1<=D.LINER_SECONDS;
    for(let i=1;i<D.LINER_SCRIPT.length;i++)timing&&=D.LINER_SCRIPT[i].t0>=D.LINER_SCRIPT[i-1].t1;
    for(const cause of CRASH_CAUSES)for(const wid of Object.keys(D.WORLD_DIALOGUE)){const sc=D.kestrelScript(cause,wid);
      for(let i=0;i<sc.length;i++){timing&&=sc[i].t0<sc[i].t1&&sc[i].t1<=D.KESTREL_CRASH+1&&!sc[i].text.startsWith('@');if(i)timing&&=sc[i].t0>=sc[i-1].t1-.01;}}
    check('the captain\'s and the pilot\'s lines run in order inside their flights, for every cause on every world (the weather line is the world\'s own)',timing&&D.kestrelScript('weather','ceres').some(l=>/ice fog/.test(l.text))&&D.kestrelScript('weather','mars').some(l=>/dust storm/.test(l.text)));
    check('every driver comes with a counter-recruiter of the other side, and Mars has the neutral port worker',D.driverFor('mars',null).key==='none'&&D.counterFor('mars',null)===null&&['ironclad','greenhaven'].every(f=>D.driverFor('ceres',f).faction===f&&D.counterFor('ceres',f).faction!==f));
    for(const t of D.LINER_TALKERS)timing&&=t.lines.length===2&&!!VOICES[t.voice];
    check('seven talkers aboard the liner, two lines each (humour for the crew and the passengers)',D.LINER_TALKERS.length===7&&timing);
  }
  // ---- the place: the apron, the walkway, the hall, the ships' fit -------------------------------------------------------
  const mars=getBody('mars'),site=createPortSite(mars);attachGrades([site]);
  {
    const L=shipDef('transport'),K=shipDef('descender'),hw=14.2,half=60.4;
    const ares={x0:LINER_SPOT.x-hw,x1:LINER_SPOT.x+hw,z0:LINER_SPOT.z-half,z1:LINER_SPOT.z+half+7.2};
    const inApron=ares.x0>=APRON.x-APRON.w/2&&ares.x1<=APRON.x+APRON.w/2&&ares.z0>=APRON.z-APRON.d/2&&ares.z1<=APRON.z+APRON.d/2;
    check('the 120 m Ares fits Apron A, hull and stern ramp, with the starboard gangway ending on the walkway side',inApron&&L.envelope.depth<=120.5&&S.rampFoot(L,'airlock').x+LINER_SPOT.x>APRON.x+APRON.w/2-8);
    const rects=[...PADS,...BUILDINGS].map(a=>({x0:a.x-a.w/2,x1:a.x+a.w/2,z0:a.z-a.d/2,z1:a.z+a.d/2,id:a.id}));
    const hit=(r)=>rects.filter(b=>r.x0<b.x1&&r.x1>b.x0&&r.z0<b.z1&&r.z1>b.z0).map(b=>b.id);
    const walk={x0:WALKWAY.x0,x1:WALKWAY.x1,z0:WALKWAY.z0,z1:WALKWAY.z1},apron={x0:APRON.x-APRON.w/2,x1:APRON.x+APRON.w/2,z0:APRON.z-APRON.d/2,z1:APRON.z+APRON.d/2};
    check('the apron, the walkway and the arrivals hall overlap no pad or building, and the walkway meets the kerb\'s opening at z 40',hit(apron).length===0&&hit(walk).length===0&&WALKWAY.z0<=36+1&&WALKWAY.z1>=44-1&&Math.abs(S.BOARD_SPOT.z-40)<2);
    const ground=(x,y,z)=>FIELD_surface(mars,x,y,z);let worst=0;
    for(const [x0,x1,z0,z1] of [[apron.x0,apron.x1,apron.z0,apron.z1],[walk.x0,walk.x1,walk.z0,walk.z1]])for(let x=x0;x<=x1;x+=3)for(let z=z0;z<=z1;z+=3){
      const p=site.toWorld(x,0,z),r=Math.hypot(p.x,p.y,p.z),sr=ground(p.x/r,p.y/r,p.z/r),q=site.toLocal({x:p.x*sr/r,y:p.y*sr/r,z:p.z*sr/r});worst=Math.max(worst,Math.abs(q.y));}
    check('the apron and the walkway are flat in the density field to within 2 cm, and they are pavement (not diggable)',worst<.02&&site.materialAt(...Object.values(site.toWorld(APRON.x,-.3,APRON.z))).id==='MAT-PORT-CONCRETE'&&onApron(APRON.x,0)&&onApron(WALKWAY.x0+5,40));
    const gate=S.kestrelGate(K),pad=PADS[0];
    check('the Kestrel (66 m, wings 31 m) sits on Pad 01 and its gangway foot and gate agent stand on the pad\'s taxi side',Math.abs(gate.x-pad.x)<pad.w/2+4&&Math.abs(gate.z)<pad.d/2&&K.envelope.depth<=pad.d+5);
  }
  // ---- the ships, walked -------------------------------------------------------------------------------------------------
  {
    const L=shipDef('transport'),sw=new ShipWalker(shipIndexFor(L),defaultState());
    const ang=S.rampAngle(L,'airlock');Object.assign(sw.state.ramps.airlock,{lowered:true,angle:ang,progress:1});sw.state.airlock.outerOpen=true;sw.state.airlock.innerOpen=true;
    const foot=S.rampFoot(L,'airlock'),footY=L.ramps.airlock.hinge.y-L.ramps.airlock.length*Math.cos(ang)*Math.tan(ang)*0;
    check('the player wakes standing on the lounge floor of the Ares, and the gangway ends at the foot the script says',!!sw.canStand(LINER_WAKE.x,LINER_WAKE.y,LINER_WAKE.z)&&foot.x>13.35&&foot.x<22&&Math.abs(S.restHeight(L)-3.3)<1e-9&&S.gangwayEndX(L)<foot.x);
    const path=planPath(sw,{x:LINER_WAKE.x,y:0,z:LINER_WAKE.z},{x:S.gangwayEndX(L),y:L.ramps.airlock.hinge.y-(S.gangwayEndX(L)-L.ramps.airlock.hinge.x)*Math.tan(ang),z:L.ramps.airlock.hinge.z},{reach:.5});
    check('from the lounge a person can walk the promenade, the boarding hall and the gangway to the port (path planned on the real layout)',!!path&&path.length>5,String(path&&path.length));
    const K=shipDef('descender'),swk=new ShipWalker(shipIndexFor(K),defaultState());
    check('the Kestrel boarding pose is on its cabin floor, by a window',!!swk.canStand(KESTREL_BOARD.x,KESTREL_BOARD.y,KESTREL_BOARD.z)&&K.layout.windows.some(w=>w.room==='cabin_a'));
    // the descent: from high above to rest, soft at the end
    const down=S.linerDown(L),p0=S.linerDescentPose(S.LINER_PHASE.entryEnd,L),p1=S.linerDescentPose(S.LINER_PHASE.touch,L),p2=S.linerDescentPose(S.LINER_PHASE.touch-1,L);
    let mono=true,prev=1e9;for(let t=S.LINER_PHASE.entryEnd;t<=S.LINER_PHASE.touch;t+=1){const q=S.linerDescentPose(t,L);mono&&=q.y<=prev+1e-9;prev=q.y;}
    check('the Ares comes down over the apron from three kilometres and stops softly: monotonic, the last metre per second is slow, it ends at rest on its legs',mono&&p0.y>3000&&Math.abs(p1.y-down.y)<1e-6&&Math.abs(p1.x-down.x)<1e-6&&Math.abs(p1.z-down.z)<1e-6&&(p2.y-p1.y)<1.2);
    // ONE CONTINUOUS FLIGHT (Jaron 10/3 7:34 PM): each ship's path is one smooth curve in the port's frame, sampled at 30 frames a second: no jump, no frame swap
    {
      const steps=(fn,t0,t1)=>{const out=[];let prev=fn(t0);for(let t=t0+1/30;t<=t1+1e-9;t+=1/30){const q=fn(t);out.push(Math.hypot(q.x-prev.x,q.y-prev.y,q.z-prev.z));prev=q;}return out;};
      const smoothSteps=(st)=>{let worst=0;const floor=.03*Math.max(...st);for(let i=1;i<st.length;i++){const a=st[i-1],b=st[i];if(a>floor&&b>floor)worst=Math.max(worst,Math.max(a,b)/Math.min(a,b));}return worst;};
      const KD=shipDef('descender');
      const lp=steps((t)=>linerPath(t,L),0,S.LINER_PHASE.touch),kp=steps((t)=>kestrelPath(t,KD,false),0,S.KESTREL_PHASE.crash),kf=steps((t)=>kestrelPath(t,KD,true),0,47);       // (it then coasts to rest at 48: the cruise ends)
      check('the Ares flies ONE path from orbit to the apron: no frame swap (every 1/30 s step is under 12 km (the time-compressed entry), and the speed changes smoothly)',Math.max(...lp)<12000&&smoothSteps(lp)<1.35,Math.max(...lp)+' '+smoothSteps(lp));
      check('the Kestrel flies ONE path from Pad 01 to the crash on Mars and on another world: no pop (steps under 1 km in the near flight, speed smooth)',Math.max(...kp)<1000&&smoothSteps(kp)<1.35&&smoothSteps(kf)<1.35,Math.max(...kp)+' '+smoothSteps(kp)+' '+smoothSteps(kf));
      let dmax=1;for(let t=24;t<S.KESTREL_PHASE.crash;t+=1/30)dmax=Math.max(dmax,ceresRelative(t,469700,9e4).dist/ceresRelative(t+1/30,469700,9e4).dist);
      check('the far world comes up smoothly (each frame is at most 8 percent nearer) and is close at the crash',dmax<1.08&&ceresRelative(S.KESTREL_PHASE.crash,469700,9e4).dist<7e5,String(dmax));
      const wr=steps((t)=>kestrelPath(t,KD,false),S.KESTREL_PHASE.crash,S.KESTREL_PHASE.crash).length;void wr;
      const end=kestrelPath(S.KESTREL_PHASE.crash,KD,false),site=S.WRECK_ORIGIN_PORT;
      check('on Mars the Kestrel comes down onto the wreck site 2.6 km from the port and the path starts at Pad 01',Math.hypot(end.x-site.x,end.z-350)<5&&end.alt<100&&Math.hypot(kestrelPath(0,KD,false).x,kestrelPath(0,KD,false).z)<1e-6);
    }
    check('the ramps come down after touchdown and the player may leave only then',S.linerRampProgress(S.LINER_PHASE.touch)===0&&S.linerRampProgress(S.LINER_PHASE.rampsDown)===1&&S.LINER_SECONDS>S.LINER_PHASE.rampsDown+5);
  }
  // ---- the rules, headless -------------------------------------------------------------------------------------------------
  {
    check('an opening of version 2 is resumed, a finished one is not, an older unfinished one is restarted, and a returning save is left alone',
      OPENING_VERSION===2&&needsOpening(freshOpening(),{})===true&&needsOpening({...freshOpening(),complete:true},{})===false&&needsOpening({version:1,stage:3,complete:false},null)===true&&needsOpening({version:1,stage:3,complete:false},{schema:1})===false&&needsOpening(null,{schema:1,player:{}})===false&&needsOpening(null,null)===true);
    const m=new OpeningModel(freshOpening({seed:.3,season:{number:1,cause:'storm'}}),'qa-a'),s=m.state,L=shipDef('transport');
    check('a new opening starts aboard the liner in the lounge, at clock zero, with this season\'s cause',s.stage===0&&s.clock===0&&s.pose.x===LINER_WAKE.x&&s.season.cause==='storm'&&s.cuts.length===0&&s.dest===null);
    check('the first scene cannot be skipped or finished or advanced early',throwsMsg(()=>m.act({type:'opening-skip'}))&&throwsMsg(()=>m.act({type:'opening-finish'}))&&/gangway/.test(throwsMsg(()=>m.act({type:'opening-next'}))));
    // the liner clock runs on the server's seconds; the player walks to the gangway
    m.act({type:'opening-pose',pose:{...s.pose},seconds:130});m.act({type:'opening-pose',pose:{...s.pose},seconds:130});
    check('the liner clock is the credited seconds, however far apart the poses are',s.clock===260&&s.elapsed===260);
    check('leaving needs the gangway: far from it is refused, at its end the same call takes the player down onto the port at the foot of the gangway',
      /gangway/.test(throwsMsg(()=>m.act({type:'opening-next'})))&&(()=>{const e=S.gangwayEndX(L);s.pose={x:e+1,y:-3,z:26.7,yaw:1.57,pitch:0};const r=m.act({type:'opening-next'});return r.ok&&s.stage===1&&s.played&&Math.abs(s.pose.x-S.linerExit(L).x)<1e-9;})());
    check('the board is in the port and picks are checked: a coming world, a side that is not there, and a stay on any world but Mars are refused',
      /not built/.test(throwsMsg(()=>m.act({type:'opening-pick',world:'moon',faction:null})))&&/side/.test(throwsMsg(()=>m.act({type:'opening-pick',world:'ceres',faction:'fortis'})))&&/Mars/.test(throwsMsg(()=>m.act({type:'opening-pick',world:'ceres',stay:true})))&&/no such/.test(throwsMsg(()=>m.act({type:'opening-pick',world:'zzz'}))));
    check('boarding needs a pick and the gate: refused with none, refused far from the Kestrel, allowed on Pad 01 once a world is picked',
      /pick a world/i.test(throwsMsg(()=>m.act({type:'opening-board'})))&&m.act({type:'opening-pick',world:'ceres',faction:'greenhaven'}).ok&&/gate/.test(throwsMsg(()=>m.act({type:'opening-board'})))&&(()=>{const g=S.kestrelGate(shipDef('descender'));s.pose={x:g.x-2,y:0,z:g.z,yaw:0,pitch:0};return m.act({type:'opening-board'}).ok&&s.stage===2&&s.pose.x===KESTREL_BOARD.x;})());
    check('the driver is one of the world\'s two sides, recorded at the pick; the pick may be changed before boarding',['ironclad','greenhaven'].includes(s.driver)&&s.dest.world==='ceres'&&s.dest.faction==='greenhaven');
    check('the Kestrel flight runs seventy seconds, then the wreck: the wreck waits for the clock',/not over/.test(throwsMsg(()=>m.act({type:'opening-next'})))&&(()=>{m.act({type:'opening-pose',pose:{...s.pose},seconds:130});const r=m.act({type:'opening-next'});return r.ok&&s.stage===STAGE.WRECK&&s.pose.z===4;})());
    check('the crew locker opens only beside it, and the way out is the stern',/closer/.test(throwsMsg(()=>m.act({type:'opening-locker'})))&&(()=>{s.pose={x:.6,y:.02,z:6.4,yaw:0,pitch:0};m.act({type:'opening-locker'});return s.lockerOpened;})()&&/Continue/.test(throwsMsg(()=>m.act({type:'opening-next'}))));
    s.pose={x:0,y:.02,z:13,yaw:0,pitch:0};const climb=m.act({type:'opening-next'});
    check('climbing out of the wreck puts the player on the surface by the buried crate',climb.ok&&s.stage===STAGE.DIG);
    const bites=clearOpening(m);assert.ok(bites>0);assert.ok(m.exposed());
    const ledger=m.edits.ledger(m.digger.carried);
    check('the dig is the real excavation with the exact matter ledger (a wreck-site body per player: gravity of the chosen world)',ledger.unaccountedKg===0&&ledger.unaccountedM3===0&&Math.abs(m.body.surfaceGravity-.2839)<.005);
    const restored=new OpeningModel(structuredClone(s),'qa-restored');
    check('a refresh in the dig restores the same field and the same carried matter',restored.exposed()&&JSON.stringify(restored.digger.carried)===JSON.stringify(m.digger.carried)&&restored.edits.fieldDeltaM3()===m.edits.fieldDeltaM3());
    m.act({type:'opening-carry'});
    check('carrying the crate starts the driver\'s scene; the ride waits eight seconds and a place beside the rover',s.stage===STAGE.CONTACT&&s.carriedCrate&&/driver/.test(throwsMsg(()=>m.act({type:'opening-ride'}))));
    s.pose={x:-6,y:.02,z:23,yaw:0,pitch:0};for(let i=0;i<5;i++)m.act({type:'opening-pose',pose:{...s.pose},seconds:2});
    m.act({type:'opening-ride'});
    check('the ride is the old script: refused to finish early, credited by the clock, ends at the port with the dest kept',/port/.test(throwsMsg(()=>m.act({type:'opening-finish'})))&&(()=>{for(let i=0;i<35;i++)m.act({type:'opening-pose',pose:{...s.pose},seconds:2});const r=m.act({type:'opening-finish'});return r.ok&&s.complete&&s.stage===STAGE.DONE&&s.dest.world==='ceres';})());
    // determinism and spread of the driver
    const seen=new Set();for(let i=0;i<40;i++){const q=new OpeningModel(freshOpening({seed:i/40}),'qa-d'+i);q.state.stage=1;q.act({type:'opening-pick',world:'ceres',faction:null});seen.add(q.state.driver);
      const q2=new OpeningModel(freshOpening({seed:i/40}),'qa-e'+i);q2.state.stage=1;q2.act({type:'opening-pick',world:'ceres',faction:'ironclad'});assert.equal(q2.state.driver,q.state.driver);}
    check('the driver is random per player (both sides turn up) and always the same for the same player',seen.size===2);
    const mm=new OpeningModel(freshOpening({seed:.9}),'qa-mars');mm.state.stage=1;mm.state.pose=S.linerExit(L);const r1=mm.act({type:'opening-pick',world:'mars',faction:null,stay:true});
    check('staying on Mars is allowed with no side: the opening ends there with no flight and no wreck',r1.ok&&mm.state.complete&&mm.state.dest.world==='mars'&&mm.state.driver===null);
    const walk=new OpeningModel({...freshOpening(),stage:STAGE.CONTACT,played:true,carriedCrate:true,dest:{world:'mars',faction:null,stay:false}},'qa-walk');walk.act({type:'opening-walk'});
    check('walking to the port is still allowed in place of the ride',throwsMsg(()=>walk.act({type:'opening-finish'}))&&(()=>{walk.state.pose={x:-2600,y:0,z:-350,yaw:0,pitch:0};walk.act({type:'opening-finish'});return walk.state.complete;})());
    const sk=new OpeningModel(freshOpening({seed:.2}),'qa-skip');
    check('skip is for those who have played: refused on a first play, allowed after (or with the device\'s own flag), and gives Mars with no side',/first play/.test(throwsMsg(()=>sk.act({type:'opening-skip'})))&&(()=>{sk.act({type:'opening-skip',replay:true});return sk.state.complete&&sk.state.dest.world==='mars'&&sk.state.dest.stay;})());
    // a pose cannot teleport on foot, the port bound holds
    const pm=new OpeningModel({...freshOpening(),stage:1,pose:S.linerExit(L),dest:null},'qa-pose'),far=pm.act({type:'opening-pose',pose:{x:-20,y:0,z:39,yaw:0,pitch:0,},seconds:1});
    check('on foot a far pose is pulled back to the furthest place a person could have walked (never refused), and a pose off the port is invalid',far.ok&&far.corrected&&far.pose.x<S.linerExit(L).x+11.1&&/Invalid/.test(throwsMsg(()=>pm.act({type:'opening-pose',pose:{x:900,y:0,z:0,yaw:0,pitch:0},seconds:1}))));
  }
  // ---- the authority ------------------------------------------------------------------------------------------------------------
  {
    let clock=Date.now();const adapter=new MemoryAdapter(),world=await new Authority(adapter,{now:()=>clock}).load();
    const one=await world.join('opening2-one-'.repeat(4),'QA one','isaiah',1),two=await world.join('opening2-two-'.repeat(4),'QA two','ada',1);
    const old=await world.join('opening2-old-'.repeat(4),'QA returning');
    const sh=world.state.ships[one.shipId];
    check('a new pilot gets the new opening (this season\'s cause), a drained lifeboat on a pad of their own and the 10,000 mark settlement; a returning pilot gets none',
      one.opening.version===2&&one.opening.season.cause==='storm'&&sh.type==='lifeboat'&&sh.drained===true&&sh.repair.need.length===2&&sh.economy.marks===10000&&old.opening===undefined&&world.state.ships[old.shipId].type==='meridian'&&!world.state.ships[old.shipId].drained);
    check('the opening of one pilot is private to them',world.publicState(one.id).players[two.id].opening.cuts===undefined&&world.publicState(one.id).players[one.id].opening.version===2);
    // the whole flow through the authority's own actions
    const act=async(p,id,a,dt=0)=>{clock+=dt*1000;const r=await world.action(p.id,'o2check-'+id,a);q=P();ship=SH();sim=SIM();return r;};
    const P=()=>world.state.players[one.id],SH=()=>world.state.ships[one.shipId],SIM=()=>world.sims.get(one.shipId);
    let q=P(),ship=SH(),sim=SIM();
    let r=await act(q,'o2-pose0',{type:'opening-pose',pose:{...q.opening.pose},seconds:1},130);r=await act(q,'o2-pose0b',{type:'opening-pose',pose:{...q.opening.pose},seconds:1},130);
    check('the liner clock on the server runs on its own wall clock (130 s per pose at most, the first pose one second)',r.ok&&q.opening.clock>=130&&q.opening.clock<=131.5,String(q.opening.clock));
    const L=shipDef('transport');q.opening.clock=205;q.opening.pose={x:S.gangwayEndX(L)+1,y:-3,z:26.7,yaw:1.5,pitch:0};r=await act(q,'o2-next',{type:'opening-next'});
    check('stepping off the gangway puts the pilot on the port, and the same action id answers the same way twice',r.ok&&q.opening.stage===1&&(await act(q,'o2-next',{type:'opening-next'})).replay===true);
    const board=world.boardData();r=await act(q,'o2-pick',{type:'opening-pick',world:'ceres',faction:'ironclad'});
    check('the board\'s live numbers are the authority\'s: the pick is recorded on the opening and not yet on the player',r.ok&&q.opening.dest.world==='ceres'&&q.home===undefined&&board.worlds.find(w=>w.id==='ceres').players===0&&board.season.number===1);
    const g=S.kestrelGate(shipDef('descender'));q.opening.pose={x:g.x-1,y:0,z:g.z,yaw:0,pitch:0};r=await act(q,'o2-board',{type:'opening-board'});
    check('boarding the Kestrel at the gate starts the descent',r.ok&&q.opening.stage===2);
    r=await act(q,'o2-d0',{type:'opening-pose',pose:{...q.opening.pose},seconds:1},120);r=await act(q,'o2-d1',{type:'opening-next'});
    check('the descent ends in the wreck when its clock has run',r.ok&&q.opening.stage===3);
    q.opening.stage=6;q.opening.ride=true;q.opening.rideSeconds=60;q.opening.carriedCrate=true;q.opening.pose={x:-2500,y:0,z:-340,yaw:0,pitch:0};
    r=await act(q,'o2-r0',{type:'opening-pose',pose:{...q.opening.pose},seconds:1},30);
    r=await act(q,'o2-fin',{type:'opening-finish'});const arrival=r.arrivalFrame;
    q=P();ship=SH();sim=SIM();
    check('the opening ends on the chosen world: the pilot stands on Ceres beside the lifeboat, landed on her own pad there, with the home recorded on the player',
      r.ok&&q.opening.complete&&arrival==='ceres'&&q.frameId==='ceres'&&sim.frameId==='ceres'&&sim.flight.landed&&q.home.world==='ceres'&&q.home.faction==='ironclad'&&['ironclad','greenhaven'].includes(q.home.driver)&&q.home.cause==='storm'&&!q.aboardShipId);
    const near=Math.hypot(q.pose.worldPos.x-sim.flight.pos.x,q.pose.worldPos.y-sim.flight.pos.y,q.pose.worldPos.z-sim.flight.pos.z);
    check('the pilot is within a few metres of the boat, the ship is a lifeboat that cannot lift while drained, and the purse is 2,500 credits',near<14&&ship.type==='lifeboat'&&ship.drained&&ship.economy.marks===10000&&(sim.step(1/30),!sim.flight.canLiftOff()),`near ${near}`);
    check('the board now counts them: one player on Ceres, one member of Ironclad',world.boardData().worlds.find(w=>w.id==='ceres').players===1&&world.boardData().worlds.find(w=>w.id==='ceres').factions.find(f=>f.id==='ironclad').members===1);
    // the chain: two parts, one from each giver, then the fit
    const pi=makeMoon('ceres').padInfo,stand=(g)=>{q.pose.worldPos=outpostToFrame(pi,g.at.x,.02,g.at.z);q.frameId='ceres';};
    r=await act(q,'o2-p0',{type:'lifeboat-part',part:'cell'});
    check('a part is not given away from the giver: refused anywhere else',r.ok===false&&/over to them/.test(r.msg));
    stand(giverFor('ceres','cell'));r=await act(q,'o2-p1',{type:'lifeboat-part',part:'cell'});
    check('the power cell is bought from the Ironclad foreman for 300 marks and cannot be bought twice',r.ok&&ship.economy.marks===9700&&ship.repair.have.join()==='cell'&&(await act(q,'o2-p1b',{type:'lifeboat-part',part:'cell'})).ok===false);
    r=await act(q,'o2-fit0',{type:'lifeboat-fit'});
    check('the boat is not fitted with one part',r.ok===false&&ship.drained);
    stand(giverFor('ceres','coupler'));r=await act(q,'o2-p2',{type:'lifeboat-part',part:'coupler'});
    check('the fuel coupler is the Greenhaven side\'s: bought at Doctor Roth\'s spot',r.ok&&ship.economy.marks===9400&&ship.repair.have.length===2);
    q.pose.worldPos=outpostToFrame(pi,200,.02,200);r=await act(q,'o2-fit1',{type:'lifeboat-fit'});
    check('fitting needs the pilot beside the boat',r.ok===false&&ship.drained);
    q.pose.worldPos={...sim.flight.pos};r=await act(q,'o2-fit2',{type:'lifeboat-fit'});
    check('with both parts and the pilot at the boat the lifeboat is fitted: drained no more, her engines have their power back and she can lift',r.ok&&!ship.drained&&ship.repair===null&&(sim.step(1/30),sim.flight.canLiftOff()));
    // Mars and the skip
    const m1=await world.join('opening2-m1-'.repeat(4),'QA m1','isaiah',1),pm=world.state.players[m1.id];pm.opening.stage=1;pm.opening.played=true;pm.opening.pose=S.linerExit(L);
    r=await act(pm,'m1-pick',{type:'opening-pick',world:'mars',faction:null,stay:true});
    const ms=world.state.ships[m1.shipId];
    check('staying on Mars puts the pilot on the Mars pad beside the drained lifeboat',r.ok&&pm.frameId==='mars'&&pm.home.world==='mars'&&pm.home.stay&&ms.drained&&ms.type==='lifeboat'&&Math.hypot(...Object.values(world.site.toLocal(pm.pose.worldPos)).map((v,i)=>i===1?0:v-[ms.pad.x-7,0,ms.pad.z+20][i]))<1);
    const sk=await world.join('opening2-sk-'.repeat(4),'QA skip','zuri',1),ps=world.state.players[sk.id];ps.opening.played=true;
    r=await act(ps,'sk-skip',{type:'opening-skip'});const ss=world.state.ships[sk.shipId];
    check('Skip intro gives the same start as staying on Mars: the same ship, the same purse, the same place',r.ok&&ps.home.world==='mars'&&ss.type===ms.type&&ss.drained===ms.drained&&ss.economy.marks===ms.economy.marks&&JSON.stringify(Object.keys(ps.home).sort())===JSON.stringify(Object.keys(pm.home).sort()));
    // FIX-R4 (26): the parts are for sale exactly where the NEXT line says, on Mars and Ceres, and the whole chain works from the Mars start
    {const G=await import('../src/opening/lifeboat.js'),C=await import('../src/economy/catalog.js');
      const sold=(w,who)=>G.partsSoldBy(who,w,{drained:true,repair:{have:[]}});
      check('FIX-R4: the Salvage trader sells the power cell and the Field kit trader the fuel coupler (Mars); the Ceres givers sell theirs; no one else sells them',
        sold('mars','trader-2').join()==='cell'&&sold('mars','trader-4').join()==='coupler'&&sold('ceres','foreman').join()==='cell'&&sold('ceres','greenhaven-rep').join()==='coupler'&&!sold('mars','trader-1').length&&!G.partsSoldBy('trader-2','mars',{drained:false}).length&&!!C.TRADERS['trader-2']&&!!C.TRADERS['trader-4']);
      const at=(g)=>{pm.frameId='mars';pm.pose.worldPos=world.site.toWorld(g.at.x,.02,g.at.z);};
      at(giverFor('mars','cell'));let rr=await act(pm,'m1-cell',{type:'lifeboat-part',part:'cell'});
      at(giverFor('mars','coupler'));let r2=await act(pm,'m1-coup',{type:'lifeboat-part',part:'coupler'});
      const msim=world.sims.get(ms.id);pm.pose.worldPos={...msim.flight.pos};const r3=await act(pm,'m1-fit',{type:'lifeboat-fit'});
      check('FIX-R4: a Mars arrival with the drained lifeboat buys the cell at the Salvage trader and the coupler at the Field kit trader (300 each), fits both, and can lift',
        rr.ok&&r2.ok&&r3.ok&&ms.economy.marks===9400&&!ms.drained&&(msim.step(1/30),msim.flight.canLiftOff()),JSON.stringify([rr,r2,r3]));}
    // a restart converts an old unfinished opening
    const stale=world.state.players[two.id];stale.opening={version:1,stage:2,elapsed:9,pose:{x:1,y:0,z:1,yaw:0,pitch:0},cuts:[],contact:1,complete:false};await world.commit();
    const restarted=await new Authority(adapter,{now:()=>clock}).load();
    check('a restart keeps finished openings, restarts one of the old shape, and keeps the new one it already had',restarted.state.players[one.id].opening.complete&&restarted.state.players[two.id].opening.version===2&&restarted.state.players[two.id].opening.stage===0&&restarted.state.players[m1.id].opening.complete);
    // the season override is the server's, for review only
    process.env.COSMOS_CRASH_CAUSE='meteor';const rv=await new Authority(new MemoryAdapter(),{now:()=>clock}).load();const p3=await rv.join('opening2-rv-'.repeat(4),'QA rv','isaiah',1);delete process.env.COSMOS_CRASH_CAUSE;
    check('a review run can set the season\'s cause (COSMOS_CRASH_CAUSE) and a normal run cannot be told what it is by a client',p3.opening.season.cause==='meteor'&&world.season().cause==='storm');
  }
  attachEdits(null);attachGrades([]);
}

import * as FIELDMOD from '../src/world/field.js';
function FIELD_surface(body,x,y,z){return FIELDMOD.surfaceRadiusFast(body,x,y,z);}

export async function runOpeningBrowserChecks({check,section}){
  section('31. The opening: desktop, phone and restoration');let output='';
  const out=new URL('../docs/qa/2026-10-03/opening2/',import.meta.url);await mkdir(out,{recursive:true});
  const status=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[fileURLToPath(new URL('./opening-browser.mjs',import.meta.url))],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});
    child.stdout.on('data',b=>{output+=b;process.stdout.write(b);});child.stderr.on('data',b=>{output+=b;process.stderr.write(b);});child.on('error',reject);child.on('close',resolve);
  });
  await writeFile(new URL('browser-log.txt',out),output);
  check('the opening browser walkthrough completes',status===0,`exit ${status}`);if(status!==0)return;
  const {results:r,errors}=JSON.parse(await readFile(new URL('browser-results.json',out)));
  check('the whole flow runs through normal actions on a desktop browser: the liner and its convoy, the landing, the port and the board, the Kestrel and its crash, the wreck, the dig, the ride, the arrival on the chosen world',r.desktop.complete&&r.desktop.convoy>=5&&r.desktop.talked>=2&&r.desktop.arrivedFrame==='ceres'&&r.desktop.drained);
  check('on an iPhone WebKit profile every step is playable with real taps and a held thumb, and the board fits the screen',r.phone.complete&&r.phone.boardFits&&r.phone.thumbHeld&&r.phone.failures===0);
  check('a refresh resumes each stage where it was (the liner at its clock, the port, the Kestrel, the wreck, the dig)',r.refresh.liner&&r.refresh.port&&r.refresh.descent&&r.refresh.dig);
  check('all five crash causes play on both worlds with no page error',r.causes.every(c=>c.ok)&&r.causes.length===5);
  check('two players in one world: each opening is private, the same season gives the same crash, and Skip intro gives the same start',r.multiplayer.private&&r.multiplayer.sameCause&&r.multiplayer.skipSame);
  check('no page error, no failed request for a game file',errors.length===0,errors.join(' | '));
}
