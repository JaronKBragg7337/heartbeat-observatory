// Workers use the same cached Loft GLBs and the same Talk UI as the ship crew.
import { NPC_SPOTS, TOWER_SPOTS } from './portSpec.js';
import { personVisible } from '../crew/personVisibility.js';
import { Person } from '../crew/personRig.js';

const lines = [
  'Pad 01 is assigned to Meridian. Keep the approach clear.',
  'Shuttle and courier traffic use pads 02 and 03.',
  'Stay on the marked foot route across the apron.',
  'Approach desk. Watching for inbound traffic.',
  'Weather sensors are offline. Watch the dust outside.',
  'This watch keeps the apron clear for arrivals.',
  'I carry the shift notes between desks.',
  'Watching the horizon. No traffic to report.',
];
export const PORT_WORKERS = [
  ...TOWER_SPOTS.map((s,i)=>({...s,line:lines[i]})),
  {...NPC_SPOTS[0],id:'depot-clerk',face:'south',line:'Supply desk. Spares and field kits are on the racks.'},
  {...NPC_SPOTS[1],id:'arrival-guide',face:'east',line:'Welcome to Marineris. Depot west, market south, control tower north. Use the lift inside.'},
  {...NPC_SPOTS[3],id:'reception-clerk',face:'south',line:'Control is upstairs. Call the lift straight ahead.'},
  ...[-70,-62,-54,-46].map((x,i)=>({id:'trader-'+(i+1),name:['Food trader','Salvage trader','Water trader','Field kit trader'][i],
    x,y:0,z:50.25,face:'south',line:['Rations and coffee here. Keep your suit sealed outside.',
      'Filters, connectors, salvage. Bring the part you need matched.',
      'Sealed water bottles. Mind the cap in the dust.',
      'Field rolls and repair fabric. Check your suit seams before you leave.'][i]})),
];

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
    for(const [i,s] of PORT_WORKERS.entries()) {
      const model=pool[i%pool.length],person=model.fallback?new Person(model.id):this.library.spawn(model.id,model.file);
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
