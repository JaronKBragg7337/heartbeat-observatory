// Regressions for deliberate climbing, workers and protected tunnel pours.
// Runs inside validate.mjs; also supports a focused standalone run.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { PortPeople } from '../src/port/portPeople.js';
import { getBody } from '../src/world/bodies.js';
import * as F from '../src/world/field.js';
import { EditStore } from '../src/world/edits.js';
import { Walker } from '../src/player/walker.js';
import { Digger } from '../src/player/digging.js';
import { makeSpoilGuard } from '../src/player/spoilProtection.js';
import { createPortSite, clearSpoilGround, PADS, BUILDINGS } from '../src/port/portSpec.js';
export async function runLeftoversChecks({ check: report, section = () => {} } = {}) {
section('12. Mars leftovers: deliberate climbing, workers and safe spoil');
const body=getBody('mars'),site=createPortSite(body);
F.attachGrades([site]);
const origin={x:-90,z:0};
const pos=(x,y,z)=>site.toWorld(origin.x+x,y,origin.z+z);
let count=0;
function check(name,ok,detail) {
  if (report) report(name, !!ok, detail === undefined ? '' : JSON.stringify(detail));
  else { assert.ok(ok, `${name}: ${JSON.stringify(detail)}`); console.log('PASS', name); }
  count++;
}
function fresh() {const s=new EditStore(body);F.attachEdits(s);return s;}
function cutBox(store,x0,x1,y0,y1,z0,z1) {
  const corners=[];
  for(const x of [x0,x1])for(const y of [y0,y1])for(const z of [z0,z1])corners.push(pos(x,y,z));
  const box={};for(const k of ['x','y','z']){box[k+'0']=Math.min(...corners.map(p=>p[k]))-.1;box[k+'1']=Math.max(...corners.map(p=>p[k]))+.1;}
  const c=pos((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  return store.carve({...c,box,sdf:(x,y,z)=>{const p=site.toLocal({x,y,z}),lx=p.x-origin.x,lz=p.z-origin.z;return Math.min(lx-x0,x1-lx,p.y-y0,y1-p.y,lz-z0,z1-lz);}});
}
function walkerAt(store,x,y,z) {
  const w=new Walker(body);Object.assign(w.worldPos,pos(x,y,z));w.grounded=true;w.updateFrame();
  w.collisionActive=(x,y,z)=>store.affects(x,y,z,2.5);
  const f=w.updateFrame();w.yaw=Math.atan2(site.right.x*f.east.x+site.right.y*f.east.y+site.right.z*f.east.z,site.right.x*f.north.x+site.right.y*f.north.y+site.right.z*f.north.z);
  return w;
}
try {
  {
    // Use a tiny rig adapter here; the browser harness verifies the actual GLBs.
    const spawns = [], library = {
      phone: true,
      roster: async () => [{ id:'cached', file:'cached.glb' }, { id:'new', file:'new.glb' }],
      cachedFiles: () => ['cached.glb'],
      spawn(id, file) {
        spawns.push(file);
        const person = { group:new THREE.Group(), loaded:true, updates:0,
          play(pose) { this.pose=pose; }, update() { this.updates++; } };
        person.ready=Promise.resolve(person); return person;
      },
    };
    const workers = new PortPeople({ site, root:new THREE.Group() }, library);
    await workers.build();
    check('all 15 marked port jobs spawn, including four traders and five seated controllers',
      workers.members.length===15 && workers.members.filter(m=>m.pose==='seated').length===5 &&
      workers.members.filter(m=>m.id.startsWith('trader-')).length===4);
    check('port workers only reuse cached models; no additional GLB is requested',
      spawns.length===15 && spawns.every(file=>file==='cached.glb'));
    const faces={south:[0,1],north:[0,-1],east:[1,0],west:[-1,0]};
    check('workers occupy their marked posts and face their work with Sit or Idle',
      workers.members.every(m=>{
        const p=m.person.group.position, front=new THREE.Vector3(0,0,1).applyQuaternion(m.person.group.quaternion);
        const [x,z]=faces[m.face];
        return p.x===m.x && p.z===m.z && Math.abs(p.y-(m.y||0)-(m.pose==='seated'?.51:.02))<1e-8 &&
          front.x*x+front.z*z>.999 && m.person.pose===(m.pose==='seated'?'Sit':'Idle') && !!m.line;
      }));
    const guide=workers.members.find(m=>m.id==='arrival-guide'),near=site.toWorld(guide.x,.02,guide.z+1);
    check('Talk finds a loaded worker within reach',workers.nearest(near)===guide);
    workers.tick(.1,near);
    check('phone workers beyond 56 m stop drawing and animating',workers.members.every(m=>
      m.person.group.visible ? m.person.updates===1 : m.person.updates===0) &&
      workers.members.some(m=>!m.person.group.visible));
    guide.person.loaded=false;
    check('Talk never offers an unloaded worker',workers.nearest(near)===null);
    const empty=new PortPeople({site,root:new THREE.Group()}, {...library,cachedFiles:()=>[]});
    const before=spawns.length;await empty.build();
    check('missing cached people use visible suits without fallback downloads',empty.members.length===15&&empty.members.every(m=>m.person.loaded&&m.person.safe)&&spawns.length===before);
  }
  {
    let hullX=-90, crew=null;
    const port={site,boxes:[]},portPeople={members:[]},ship={
      flight:{toLocal(p){const q=site.toLocal(p);return {x:q.x-hullX,y:q.y,z:q.z};}},
      guns:{targets:[]},
    };
    const guard=makeSpoilGuard({port,portPeople,ship,getCrew:()=>crew});
    const clear=(x,y,z)=>{const p=site.toWorld(x,y,z);return guard(p.x,p.y,p.z);};
    check('spoil guard protects the ship hull and ramp runout',!clear(-90,0,0)&&!clear(-90,0,35));
    hullX=0;
    check('ship exclusion follows a moved ship and releases its former ground',clear(-90,0,0)&&!clear(0,0,35));
    port.boxes.push({x0:-91,x1:-89,z0:-1,z1:1});
    check('port equipment outside building footprints rejects spoil',!clear(-90,0,0));port.boxes.length=0;
    portPeople.members.push({x:-90,z:0});
    check('worker posts reject spoil',!clear(-90,0,0));portPeople.members.length=0;
    crew={members:new Map([['member',{place:'ground',gpos:site.toWorld(-90,0,0)}]])};
    check('late-built ground crew rejects spoil',!clear(-90,0,0));crew=null;
    ship.guns.targets.push({pos:site.toWorld(-90,0,0),radius:.5,inactive:false});
    check('live practice equipment rejects spoil',!clear(-90,0,0));
    ship.guns.targets[0].inactive=true;
    check('removed targets release otherwise clear ground',clear(-90,0,0));
  }
  for(const height of [.3,.5]) {
    const s=fresh();cutBox(s,-3,0,-height,.4,-2,2);
    const w=walkerAt(s,-.6,-height+.02,0);
    for(let i=0;i<180;i++)w.tick(1/60,{moveNorth:1});
    const p=site.toLocal(w.worldPos);
    check(`${height} m walking step ${height<.35?'passes':'blocks'}`,height<.35?p.y>-.1:p.y<-.35,p);
  }
  {
    const s=fresh();cutBox(s,-3,0,-1.24,.4,-2,2);
    const w=walkerAt(s,-.6,-1.22,0);
    for(let i=0;i<120;i++)w.tick(1/60,{moveNorth:1});
    check('walking stays below a vertical 1.24 m ledge',site.toLocal(w.worldPos).y<-.9,site.toLocal(w.worldPos));
    const target=w.climbTarget();check('facing a reachable ledge offers Climb',target&&target.height<=1.5,target);
    w.yaw+=Math.PI;check('facing away from the ledge refuses Climb',!w.requestClimb().ok);w.yaw-=Math.PI;
    const before={...w.worldPos};check('deliberate action starts a climb',w.requestClimb().ok);
    for(let i=0;i<18;i++)w.tick(1/60,{});
    check('first 0.3 seconds brace without movement',Math.hypot(w.worldPos.x-before.x,w.worldPos.y-before.y,w.worldPos.z-before.z)<.001);
    for(let i=0;i<60;i++)w.tick(1/60,{});
    check('one pull-up ends on the top in 1.2 seconds',site.toLocal(w.worldPos).y>-.1&&!w._climb,site.toLocal(w.worldPos));
    check('normal walking step is 0.35 m',w.stepM===.35);
  }
  {
    const s=fresh();cutBox(s,-3,0,-5,-2.4,-2,2);cutBox(s,0,2,-3.76,-2.4,-2,2);
    const w=walkerAt(s,-.6,-4.98,0);
    check('a reachable ledge under a low roof refuses Climb',!w.requestClimb().ok);
  }
  {
    const s=fresh();cutBox(s,-3,0,-1.85,.4,-2,2);
    const w=walkerAt(s,-.6,-1.83,0);
    for(let i=0;i<90;i++)w.tick(1/60,{moveNorth:1});
    check('a 1.85 m vertical ledge refuses Climb',!w.requestClimb().ok);
    w.grounded=false;check('airborne feet cannot start another pull-up',!w.requestClimb().ok);
  }
  {
    const s=fresh();const construction=[cutBox(s,-5,5,-5,-2,-2,2),cutBox(s,-8,-4.8,-5,.4,-2,2)];
    const w=walkerAt(s,1,-4.98,0),dg=new Digger(body,s,w);
    const p=pos(3,-5.08,0);const lot=s.dig(p.x,p.y,p.z,.17);dg.carried.push(lot);
    dg.canPlaceSpoil=(x,y,z)=>clearSpoilGround(site,x,y,z);
    const plan=dg.dumpPlan(lot);check('tunnel drop plans on its own floor, below the roof',plan?.local&&site.toLocal(plan).y<-4.8,plan);
    const version=s.version,roof=pos(2,-1.98,0),dBefore=F.density(body,roof.x,roof.y,roof.z);
    const r=dg.dump();check('Drop one pours on the tunnel floor in connected air',r.ok,r);
    check('tunnel pour never changes the roof or surface',F.density(body,roof.x,roof.y,roof.z)===dBefore&&s.edits.filter(e=>e.type==='pile').every(e=>site.toLocal(e).y<-4.8));

    check('single tunnel lot is deposited with its exact original mass',s.totalDepositedKg===lot.massKg&&dg.carried.length===0,lot.massKg);
    const balanced=s.ledger(construction);
    check('tunnel lot balances exact kg and m3 ledgers',balanced.unaccountedKg===0&&balanced.unaccountedM3===0,balanced);
    check('tunnel lattice independently matches its volume ledger',Math.abs(s.fieldDeltaM3()-(s.totalDepositedM3-s.totalRemovedM3))<1e-8);
    check('pour changes the lattice',s.version>version);
    const p2=pos(3,-5.18,0),lot2=s.dig(p2.x,p2.y,p2.z,.17);dg.carried.push(lot2);
    dg.canPlaceSpoil=()=>false;
    const v=s.version,m=dg.carriedMass();const refusal=dg.dumpAll();
    check('no clear ground refuses atomically and retains the exact inventory',!refusal.ok&&s.version===v&&dg.carriedMass()===m);
    for(const a of [...PADS,...BUILDINGS]) {
      const p=site.toWorld(a.x,0,a.z);check(a.name+' rejects spoil',!clearSpoilGround(site,p.x,p.y,p.z));
    }
    // Test the write guard independently of planner heuristics.
    dg.canPlaceSpoil=null;const plan2=dg.dumpPlan(lot2),v2=s.version;
    const rejected=s.deposit(lot2,plan2.x,plan2.y,plan2.z,{up:plan2.up,local:true,canPlace:()=>false});
    check('exact pour footprint guard refuses before any lattice write',rejected===null&&s.version===v2);
    let visits=0;const kg=s.totalDepositedKg,volume=s.totalDepositedM3;
    const late=s.deposit(lot2,plan2.x,plan2.y,plan2.z,{up:plan2.up,local:true,canPlace:()=>++visits<12});
    check('a partly clear footprint still refuses the entire pour without changing mass or terrain',
      late===null&&visits===12&&s.version===v2&&s.totalDepositedKg===kg&&s.totalDepositedM3===volume&&dg.carriedMass()===m);
  }
  {
    const s=fresh(),construction=[cutBox(s,-5,5,-5,-2,-2,2),cutBox(s,-8,-4.8,-5,.4,-2,2)];
    const w=walkerAt(s,1,-4.98,0),dg=new Digger(body,s,w);dg.setTool(2);
    for(const y of [-5.3,-6.6,-7.9])for(const x of [-3.2,-1.6,0,1.6,3.2])for(const z of [-.9,.9]) {
      const p=pos(x,y,z),lot=s.carve({...p,r:.7,maxMassKg:48000-dg.carriedMass()});if(lot)dg.carried.push(lot);
    }
    dg.canPlaceSpoil=(x,y,z)=>clearSpoilGround(site,x,y,z);
    for(const y of [-.3,-1.3,-2.3,-3.3,-4.3]) {
      const p=pos(-6.4,y,0),lot=s.dig(p.x,p.y,p.z,1.7);if(lot)construction.push(lot);
    }
    const mass=dg.carriedMass(),plan=dg.dumpPlan(dg.combinedLoad());
    check('nearly full tunnel hopper selects clear ground by an actual mouth',mass>45000&&mass<=48000&&plan?.mouth&&!plan.local,{mass,plan});
    const result=dg.dumpAll();check('whole hopper pour at the mouth succeeds',result.ok,result.msg);
    const led=s.ledger(construction);check('whole hopper mouth pour balances exactly',led.unaccountedKg===0&&led.unaccountedM3===0,led);
    check('whole hopper mouth pour matches the independent lattice',Math.abs(s.fieldDeltaM3()-(s.totalDepositedM3-s.totalRemovedM3))<1e-8);
  }
  if (!report) console.log(`RESULT: ${count} focused checks passed`);
  return count;
} finally {F.attachEdits(null);F.attachGrades([]);}

}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runLeftoversChecks();
}
