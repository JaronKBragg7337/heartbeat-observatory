// Workers use the same cached Loft GLBs and the same Talk UI as the ship crew.
import { NPC_SPOTS, TOWER_SPOTS } from './portSpec.js';
import { personVisible } from '../crew/personVisibility.js';
import { Person } from '../crew/personRig.js';

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
      this.port.root.add(person.group);this.members.push(m);
    }
    await Promise.all(this.members.map(m=>m.person.ready));
    return this;
  }
  tick(dt,worldPos) {
    const p=this.port.site.toLocal(worldPos),range=this.library.phone?56:120;
    for(const m of this.members) {
      m.person.group.visible=Math.hypot(p.x-m.x,p.y-(m.y||0),p.z-m.z)<range;
      if(m.person.group.visible)m.person.update(dt);
    }
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
