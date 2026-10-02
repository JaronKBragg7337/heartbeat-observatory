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
  worldPosOf(m) { return m.gpos; }
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
