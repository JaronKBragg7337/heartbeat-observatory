import * as THREE from 'three';
import { CrewSystem } from '../crew/crewSystem.js';
import { CREW_POSTS } from '../crew/crewSpec.js';

// Reuse the solo conversations and reports; movement, hiring and orders remain
// owned by the authority. Members are stable objects so an open Talk panel stays open.
export class RemoteCrew extends CrewSystem {
  constructor(view) {
    super({...view,ground:view.ship.ground});
    this.view=view;this.world=view.world;
    const local=this._local.bind(this);this._local=(x,z)=>{if(x===0&&z===0){const p=view.world.snapshot.ships[view.activeId()].pad;return view.site.toWorld(p.x,0,p.z);}return local(x,z);};
  }
  update() {}
  pilotControls() { return null; }
  onPlayerSit() {}
  onPlayerStand() {}
  onGunEvents() {}
  applyVisibility(rooms,visible) {
    for(const m of this.members.values())if(m.place==='ship'){
      const b=this.view.bodies.get(m.id),seat=this._seat(m);
      b.group.visible=visible&&(!m.seated||rooms.has(seat.room));
    }
  }
  // Someone aboard is where the ship carries them, not where they stood when they signed on (that spot is only a body's last ground position;
  // using it left the 'Talk to' prompt hanging in the hall while the person sat on the bridge).
  worldPosOf(m) {
    if (m.place !== 'ship') return m.gpos;
    const ship = this.world.snapshot.ships[this.view.activeId()], f = ship && this.view.shipPose(ship);
    const loc = m.seated || m.mode === 'sit' ? this._seatPos(m) : { x: m.sw.x, y: m.sw.y, z: m.sw.z };
    if (!f || !Number.isFinite(loc.x)) return m.gpos;
    const v = new THREE.Vector3(loc.x, loc.y, loc.z).applyQuaternion(new THREE.Quaternion().fromArray(f.quaternion));
    return { x: f.pos.x + v.x, y: f.pos.y + v.y, z: f.pos.z + v.z };
  }
  actors() { return this.hiredList().filter(m=>m.place==='ship'&&!m.seated).map(m=>m.sw); }
  activeOrder() { return this.world.snapshot.ships[this.view.activeId()].order||null; }
  hire(id) { return this.view.request({type:'hire',id}); }
  dismiss(id) { return this.view.request({type:'fire',id}); }
  order(type,args={}) { return this.view.request({type:'crew-order',order:type,args}); }
  cancelOrder() { return this.world.dispatch({type:'crew-order',order:'hold'}); }
  sync() {
    const snapshot=this.world.snapshot,active=this.view.activeId(),seen=new Set();
    for(const c of Object.values(snapshot.pool)) {
      if(c.retired||c.shipId&&c.shipId!==active)continue;
      const b=this.view.bodies.get(c.id);if(!b)continue;
      const contract=snapshot.ships[active].crew.find(m=>m.id===c.id);
      const def={...CREW_POSTS.find(p=>p.id===c.role),skill:c.skill};
      let m=this.members.get(c.id);
      if(!m){m={id:c.id,person:b.person,personId:c.personId};this.members.set(c.id,m);}
      Object.assign(m,{def,name:c.name,status:contract?'hired':'candidate',meetingState:c.status,
        place:contract&&['aboard','walking-aboard','leaving-aboard'].includes(contract.status)?'ship':'ground',
        mode:contract?.status.startsWith('leaving')?'leaving':contract?.status==='aboard'?'sit':contract?.status==='walking-aboard'?'walk':contract?'boarding':'idle',
        seated:contract?.status==='aboard'&&!contract.displaced,displaced:!!contract?.displaced,gpos:{...b.entry.worldPos},
        sw:{...(contract?.displaced?contract.standPose:contract?.localPose||contract?.seatPose)||{}},unpaid:contract?.unpaid});
      seen.add(c.id);
    }
    for(const id of this.members.keys())if(!seen.has(id))this.members.delete(id);
  }
}
