// Workers use the same cached Loft GLBs and the same Talk UI as the ship crew.
import { dressForWorld } from '../crew/suitPolicy.js';
const MARS_AIR={atmosphere:{surfacePressure:610},surfaceGravity:3.72076};
/** The stripe on each worker's suit: the port's rust, amber for the depot and reception, teal for the traders. */
const SUIT_STRIPE={'depot-clerk':0xe5ac6c,'reception-clerk':0xe5ac6c,'arrival-guide':0x67c4cf};
import { NPC_SPOTS, TOWER_SPOTS } from './portSpec.js';
import { personVisible } from '../crew/personVisibility.js';
import { Person } from '../crew/personRig.js';
import { surfaceRadiusFast } from '../world/field.js';
import { getBody } from '../world/bodies.js';

import { WORKER_LINES } from './workerLines.js';
import { WORKER_CAST, BODY_KIND } from '../voice/cast.js';

export const PORT_WORKERS = [
  ...TOWER_SPOTS.map(s=>({...s,line:WORKER_LINES[s.id]})),
  {...NPC_SPOTS[0],id:'depot-clerk',face:'south',line:WORKER_LINES['depot-clerk']},
  {...NPC_SPOTS[1],id:'arrival-guide',face:'east',line:WORKER_LINES['arrival-guide']},
  {...NPC_SPOTS[3],id:'reception-clerk',face:'south',line:WORKER_LINES['reception-clerk']},
  ...[-70,-62,-54,-46].map((x,i)=>({id:'trader-'+(i+1),name:['Food trader','Salvage trader','Water trader','Field kit trader'][i],
    x,y:0,z:50.25,face:'south',line:WORKER_LINES['trader-'+(i+1)]})),
];

/** VOICES: a worker's body matches their voice (a woman's voice gets a woman's body, an older man's the older man), so the
 *  mouth and the sound agree. Falls back to the old rotation when the wanted kind is not in the cache. */
function bodyFor(id,pool,i,used){
  const want=WORKER_CAST[id]?.body,fit=pool.filter(r=>BODY_KIND[r.id]===want);
  if(!want||!fit.length)return pool[i%pool.length];
  const n=used[want]=(used[want]||0)+1;return fit[(n-1)%fit.length];
}
// LIVED-IN (part 2, 11/19): people at work. Every person at the port stood on one spot for ever. These walk a beat between two places of work, stop,
// look about, and walk back: a porter along the market and the arrivals hall, a pad hand round Pad 01, a fuel hand between the farm and Pad 02, a loader
// at cargo staging, a runner between the tower and the crew hall. Decoration only (no talk, nothing the authority knows about); port-local metres.
const WALK_BEATS = [
  { id: 'porter', cloth: 0x67c4cf, pts: [[-98, 46.6], [-76, 46.6], [-46, 46.8]], rest: [9, 14] },
  { id: 'pad-hand', cloth: 0xe5ac6c, pts: [[-20.5, 33.5], [-20.5, -33.5], [20.5, -33.5], [20.5, 33.5], [-20.5, 33.5]], rest: [6, 6] },
  { id: 'fuel-hand', cloth: 0xd8d2c4, pts: [[50, -61.5], [44.5, -50], [44.5, -30]], rest: [12, 8] },
  { id: 'loader', cloth: 0xb5694a, pts: [[40, 60.5], [46, 47.5], [60, 47.5]], rest: [10, 7] },
  { id: 'runner', cloth: 0xb5694a, pts: [[-52, -39], [-40, -51], [-29, -58]], rest: [8, 11] },
];
const WALK_SPEED = 1.25;
/** Where a walker is `t` seconds into its beat: out along the points, a rest, back, a rest. Pure, so a hidden walker costs nothing and comes back in the right place. */
export function beatPose(beat, t, out = {}) {
  const P = beat.pts; let len = beat._len;
  if (len === undefined) { len = 0; beat._seg = []; for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); beat._seg.push(d); len += d; } beat._len = len; }
  const walk = len / WALK_SPEED, cycle = 2 * walk + beat.rest[0] + beat.rest[1]; let u = ((t % cycle) + cycle) % cycle, s, dir = 1; out.moving = true;
  if (u < walk) s = u * WALK_SPEED;
  else if (u < walk + beat.rest[1]) { s = len; out.moving = false; }
  else if (u < 2 * walk + beat.rest[1]) { s = len - (u - walk - beat.rest[1]) * WALK_SPEED; dir = -1; }
  else { s = 0; out.moving = false; dir = -1; }
  let i = 0; while (i < beat._seg.length - 1 && s > beat._seg[i]) { s -= beat._seg[i]; i++; }
  const a = P[i], b = P[i + 1], k = Math.max(0, Math.min(1, s / (beat._seg[i] || 1)));
  out.x = a[0] + (b[0] - a[0]) * k; out.z = a[1] + (b[1] - a[1]) * k; out.yaw = Math.atan2((b[0] - a[0]) * dir, (b[1] - a[1]) * dir);
  return out;
}
export class PortPeople {
  constructor(port,library) { this.port=port;this.library=library;this.members=[]; }
  async build() {
    const roster=await this.library.roster();
    // Crew and player spawn first. Pick only their existing downloads; clone skeletons,
    // share geometry/textures, and do not fetch another roster of bodies for the port.
    const cached=new Set(this.library.cachedFiles());
    const pool=roster.filter(r=>cached.has(r.file));
    if(!pool.length)pool.push({id:'isaiah',fallback:true});
    if(!pool.length)return this;
    const used={};
    for(const [i,s] of PORT_WORKERS.entries()) {
      const model=bodyFor(s.id,pool,i,used),person=model.fallback?new Person(model.id):this.library.spawn(model.id,model.file);
      if(model.fallback){person._attachSafe();person.ready=Promise.resolve(person);}
      const m={...s,status:'worker',def:{title:s.name},personId:model.id,person};
      person.group.position.set(s.x,(s.y||0)+(s.pose==='seated'?.51:.02),s.z);
      person.group.rotation.y={south:0,east:Math.PI/2,north:Math.PI,west:-Math.PI/2}[s.face]||0;
      person.play(s.pose==='seated'?'Sit':'Idle',0);
      // SUITS: Mars's air is 0.6 percent of Earth's. Anyone standing out on the apron is in a suit; the tower crew (up in the cab) are indoors.
      dressForWorld(person,MARS_AIR,{cloth:SUIT_STRIPE[s.id]??0xb5694a},(s.y||0)>2||!!s.indoor);
      this.port.root.add(person.group);this.members.push(m);
    }
    this.walkers=[];this.clock=0;
    for(const [i,beat] of WALK_BEATS.slice(0,this.library.phone?3:WALK_BEATS.length).entries()) {
      const model=pool[(i*2+1)%pool.length];if(model.fallback)break;
      const person=this.library.spawn(model.id,model.file);dressForWorld(person,MARS_AIR,{cloth:beat.cloth},false);
      person.group.visible=false;this.port.root.add(person.group);this.walkers.push({beat,person,offset:i*37,anim:'',pose:{}});
    }
    await Promise.all([...this.members,...this.walkers].map(m=>m.person.ready));
    return this;
  }
  tick(dt,worldPos) {
    const p=this.port.site.toLocal(worldPos),range=this.library.phone?56:120;
    for(const m of this.members) {
      m.person.group.visible=Math.hypot(p.x-m.x,p.y-(m.y||0),p.z-m.z)<range;
      if(m.person.group.visible)m.person.update(dt);
    }
    this.clock+=dt;
    for(const w of this.walkers||[]) {
      const q=beatPose(w.beat,this.clock+w.offset,w.pose),g=w.person.group;
      g.visible=Math.hypot(p.x-q.x,p.y,p.z-q.z)<range;if(!g.visible)continue;
      g.position.set(q.x,this.groundY(q.x,q.z)+.02,q.z);
      if(q.moving){let d=q.yaw-g.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));g.rotation.y+=d*Math.min(1,dt*5);}
      const anim=q.moving?'Walk':'Idle';if(anim!==w.anim){w.anim=anim;w.person.play(anim,.3);}
      w.person.update(dt,q.moving?WALK_SPEED:0);
    }
  }
  /** The real ground under a port-local point (the beats cross open regolith between the pads, which is not level). */
  groundY(x,z) {
    const s=this.port.site,w=s.toWorld(x,0,z,this._gw||(this._gw={})),l=Math.hypot(w.x,w.y,w.z)||1,r=surfaceRadiusFast(this._body||(this._body=getBody(s.bodyId)),w.x/l,w.y/l,w.z/l)/l;
    w.x*=r;w.y*=r;w.z*=r;return s.toLocal(w).y;
  }
  nearest(worldPos) {
    const p=this.port.site.toLocal(worldPos);
    let best=null,dist=3;
    for(const m of this.members) {
      const pos=m.person.group.position,d=Math.hypot(p.x-pos.x,p.y-pos.y,p.z-pos.z);
      if(d<dist&&personVisible(m.person)){best=m;dist=d;}
    }
    return best;
  }
}
