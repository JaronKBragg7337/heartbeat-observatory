import * as THREE from 'three';
import { playerPose } from './gameBridge.js';
import { restoreTerrain } from './terrainCodec.js';
import { attachGrades } from '../world/field.js';
import { landingField } from './fleet.js';
import { cartesianToGeodetic, localFrame } from '../world/geodesy.js';
const hall={x:-28,z:-68,w:24,d:14,h:5};
function label(text){const c=document.createElement('canvas');c.width=512;c.height=64;const x=c.getContext('2d');
  x.fillStyle='#17120cdd';x.fillRect(0,0,512,64);x.fillStyle='#ffe0ab';x.font='28px sans-serif';x.textAlign='center';x.fillText(text,256,44,500);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:true}));s.scale.set(3.6,.45,1);return s;}
export class MultiplayerView {
  constructor(world,{engine,ship,walker,edits,digger,site,space,people,bridge,rebuild,port}) {
    Object.assign(this,{world,engine,ship,walker,edits,digger,site,space,people,bridge,rebuild,port});this.bodies=new Map();this.fleet=new Map();this.pads=new Set();this.accum=0;this.forcePlayer=true;
    attachGrades([site,landingField(site,()=>world.snapshot.pads)]);
    ship.remoteAuthority=true;ship.flight.remoteAuthority=true;
    this.installControls();this.buildHall();this.buildPanel();
    world.beforeAction=()=>this.sendPose();world.onReceipt=r=>{ship.note(r.msg,!r.ok);if(!r.ok)this.forcePlayer=true;};
    world.onConnection=()=>this.forcePlayer=true;
    world.listeners.add(m=>this.apply(m));this.apply({state:world.snapshot,bricks:[...world.bricks.values()]});
  }
  activeId(){const p=this.world.snapshot.players[this.world.playerId];return p.aboardShipId||p.currentShipId||p.shipId;}
  sendPose(){const p=this.world.snapshot.players[this.world.playerId];const pose=playerPose(this.walker,this.ship);
    // Seat/boarding transitions require an action; pose packets only describe predicted movement.
    pose.aboard=!!p.aboardShipId;pose.seat=p.pose.seat;
    this.world.sendPose(pose,this.ship.flight.controls);}
  request(a){this.sendPose();return this.world.request(a).then(r=>{this.ship.note(r.msg,!r.ok);this.forcePlayer=true;return r;});}
  installControls(){const ship=this.ship,space=this.space;
    ship.boardAt=()=>{if(!this.boardPending){this.boardPending=true;this.request({type:'board',shipId:this.activeId()}).finally(()=>this.boardPending=false);}};
    ship.disembark=()=>{if(!this.boardPending){this.boardPending=true;this.request({type:'leave'}).finally(()=>this.boardPending=false);}};
    ship.stations.sit=loc=>{const s=ship.stations.seatNear(loc);if(s)this.request({type:'seat',seat:s.id});return null;};
    ship.stations.stand=()=>{this.request({type:'seat',seat:null});return null;};
    ship.takeSeat=id=>{this.request({type:'seat',seat:id});return false;};
    ship.toggleRamp=key=>{this.request({type:'ramp',key});return true;};
    this.port.elevator.tick=()=>0;
    this.port.elevator.request=destination=>{this.request({type:'elevator',destination});return true;};
    ship.stations.power=(key,value)=>{this.request({type:'power',key,value});return true;};
    space.engage=id=>{this.request({type:'engage',destination:id});return {ok:true,msg:'Course requested.'};};
    space.cancel=()=>{this.request({type:'cancel-trip'});return {ok:true,msg:'Cancellation requested.'};};
    space.setWarp=()=>ship.note('Shared trips run on the world clock.');space.tripControls=()=>null;
    space.jobs.takeSample=s=>{this.request({type:'sample',site:s.id});return {ok:true,msg:'Sample requested.'};};
    space.jobs.salvage=()=>{this.request({type:'salvage'});return {ok:true,msg:'Claim requested.'};};
    space.jobs.stow=()=>{this.request({type:'stow'});return {ok:true,msg:'Cargo transfer requested.'};};
    // Only validated job intents can pay. Amounts/cargo supplied by a browser are never accepted.
    space.hooks.award=()=>{};space.hooks.addCargo=()=>{};space.hooks.removeCargo=()=>{};space.hooks.onArrive=()=>{};
    space.hooks.cargoKg=item=>this.world.snapshot.ships[this.activeId()].hold[item]||0;
  }
  apply(m){const snapshot=this.world.snapshot,p=snapshot.players[this.world.playerId],s=snapshot.ships[this.activeId()],f=this.ship.flight;
    const changed=this.lastShipId!==s.id||this.lastFrame!==p.frameId||this.lastAboard!==p.aboardShipId||this.lastSeat!==p.pose.seat;
    if(snapshot.elevator){const loc=this.site.toLocal(this.walker.worldPos),oldY=this.port.elevator.y;
      if(!this.ship.aboard&&this.port.elevator.contains(loc.x+60,loc.z+39)&&Math.abs(loc.y-oldY)<.4)
        for(const k of ['x','y','z'])this.walker.worldPos[k]+=this.site.up[k]*(snapshot.elevator.y-oldY);
      Object.assign(this.port.elevator,snapshot.elevator);this.port.updateElevatorVisuals();}
    if(this.space.frameId!==p.frameId)this.space.setFrame(p.frameId);
    this.lastFrame=p.frameId;this.lastShipId=s.id;this.lastAboard=p.aboardShipId;this.lastSeat=p.pose.seat;
    Object.assign(f.pos,s.pose.pos);Object.assign(f.vel,s.pose.vel);Object.assign(f.power,s.pose.power);
    for(const k of ['heading','pitch','roll','yawRate','hull','shield','gearPos','landed','autoHover','airborne','agl','time','climbCap','thrustDown'])if(s.pose[k]!==undefined)f[k]=s.pose[k];
    f.quaternion.fromArray(s.pose.quaternion);f.refreshOrientation();f.quaternion.fromArray(s.pose.quaternion);
    for(const [key,v] of Object.entries(s.state))if(this.ship.state[key])Object.assign(this.ship.state[key],v);
    for(const [key,r] of Object.entries(s.state.ramps)){const ctl=this.ship.rampCtl[key];Object.assign(ctl,{progress:r.progress||0,target:r.lowered?1:0,angle:r.angle});}
    this.ship.aboard=!!p.aboardShipId;this.ship.stations.seated=p.pose.seat;
    if(changed||this.forcePlayer){Object.assign(this.walker.worldPos,p.pose.worldPos);Object.assign(this.walker.velocity,p.pose.velocity);
      Object.assign(this.walker,{yaw:p.pose.yaw,pitch:p.pose.pitch,grounded:p.pose.grounded});this.walker.updateFrame();
      this.ship.sw.place(p.pose.sw.x,p.pose.sw.y,p.pose.sw.z,p.pose.sw.yaw);this.ship.sw.pitch=p.pose.sw.pitch;Object.assign(this.ship.look,p.pose.look);this.forcePlayer=false;}
    this.ship._syncEntries();this.digger.carried.splice(0,this.digger.carried.length,...structuredClone(p.carried));this.digger.setTool(p.toolIdx);
    const trip=s.trip;this.space.trip=trip?{...trip,dest:trip.dest||this.space.resolve(trip.destId),active:true,setWarp:()=>{}}:null;
    this.space.ledger.credits=s.economy.marks/4;this.space.ledger.cargo=new Map(Object.entries(s.hold));
    this.space.jobs.taken=new Set(s.jobs.taken);this.space.jobs.salvaged=s.jobs.salvaged;this.space.jobs.samplesAboard=s.jobs.samples.length;
    if(s.combat){this.ship.guns.bolts=structuredClone(s.combat.bolts);this.ship.guns.aim=structuredClone(s.combat.aim);
      this.ship.drones.shots=structuredClone(s.combat.enemyShots);this.ship.drones.neutral=s.combat.neutral;
      s.combat.drones.forEach((r,i)=>{const d=this.ship.drones.drones[i];if(d){Object.assign(d.pos,r.pos);Object.assign(d.vel,r.vel);d.state=r.state;d.target.hp=r.target.hp;d.target.inactive=r.target.inactive;}});}
    const ids=new Set((m.bricks||[]).map(b=>b.bodyId));
    for(const id of ids){const store=id==='mars'?this.edits:this.space.moonWorld(id).edits;
      restoreTerrain(store,snapshot.terrain[id],(m.bricks||[]).filter(b=>b.bodyId===id));}
    for(const pad of snapshot.pads)this.addPad(pad);
    this.draw();
  }
  addPad(a){if(this.pads.has(a.id)||a.x===0&&a.z===0)return;this.pads.add(a.id);
    const g=new THREE.Group();g.name='allocated-'+a.id;g.position.set(a.x,0,a.z);
    const slab=new THREE.Mesh(new THREE.BoxGeometry(a.w,.5,a.d),this.ship.matsExt.concrete||new THREE.MeshStandardMaterial({color:0x77736b,roughness:.9}));slab.position.y=-.24;g.add(slab);
    const paint=new THREE.MeshStandardMaterial({color:0xf0bf55,emissive:0x34220a});
    for(const x of [-a.w/2+1,a.w/2-1]){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.18,.03,a.d-2),paint);stripe.position.set(x,.035,0);g.add(stripe);}
    for(const z of [-a.d/2+1,a.d/2-1]){const stripe=new THREE.Mesh(new THREE.BoxGeometry(a.w-2,.03,.18),paint);stripe.position.set(0,.035,z);g.add(stripe);}
    for(const x of [-a.w/2+1,a.w/2-1])for(const z of [-a.d/2+1,a.d/2-1]){const light=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.7,8),new THREE.MeshBasicMaterial({color:0x58dbff}));light.position.set(x,.35,z);g.add(light);}
    const sign=label('PAD '+a.number);sign.position.set(0,1,a.d/2-3);g.add(sign);this.hallRoot.add(g);this.rebuild?.(true);
  }
  buildHall(){const site=this.site,g=this.hallRoot=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color:0xb5a187,roughness:.85});
    const add=(x,y,z,w,h,d)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);};
    add(hall.x,hall.h,hall.z,hall.w+1,.3,hall.d+1);add(hall.x,2.5,hall.z-7,24,5,.3);
    for(const x of [-12,12])add(hall.x+x,2.5,hall.z,.3,5,14);
    for(const x of [-7,7])add(hall.x+x,2.5,hall.z+7,10,5,.3);add(hall.x,4,hall.z+7,4,2,.3);
    const s=label('CREW HALL / CANTINA');s.position.set(hall.x,5.8,hall.z+7.5);g.add(s);
    this.engine.scene.add(g);const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().copy(site.right),new THREE.Vector3().copy(site.up),new THREE.Vector3().copy(site.back)));
    this.engine.track({worldPos:site.center,object3d:g,quaternion:q});
  }
  body(id,personId,name){let v=this.bodies.get(id);if(v)return v;
    const person=this.people.spawn(personId),group=new THREE.Group();group.name='remote-person:'+id;group.add(person.group);
    const tag=label(name);tag.position.y=2.15;group.add(tag);this.engine.scene.add(group);
    const fallback=new THREE.Mesh(new THREE.CapsuleGeometry(.22,1.2,4,8),new THREE.MeshStandardMaterial({color:0xcbbba7}));fallback.position.y=.9;group.add(fallback);person.ready.then(p=>{if(p.loaded)group.remove(fallback);});
    const entry=this.engine.track({worldPos:{x:0,y:0,z:0},object3d:group,quaternion:new THREE.Quaternion()});
    v={person,group,entry,last:null,name};this.bodies.set(id,v);return v;
  }
  updateBodies(dt){const s=this.world.snapshot,current=this.activeId(),seen=new Set();
    for(const p of Object.values(s.players)){if(p.id===this.world.playerId||!p.online)continue;seen.add(p.id);const b=this.body(p.id,p.personId,p.name);
      let pos=p.pose.worldPos,q;
      if(p.aboardShipId){const ship=s.ships[p.aboardShipId],f=ship.pose,offset=new THREE.Vector3().copy(p.pose.sw).applyQuaternion(new THREE.Quaternion().fromArray(f.quaternion));
        pos={x:f.pos.x+offset.x,y:f.pos.y+offset.y,z:f.pos.z+offset.z};q=new THREE.Quaternion().fromArray(f.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI-p.pose.sw.yaw));}
      else{const geo=cartesianToGeodetic(this.walker.body,pos.x,pos.y,pos.z),frame=localFrame(geo.lat,geo.lon),up=new THREE.Vector3().copy(frame.up),
        forward=new THREE.Vector3().copy(frame.north).multiplyScalar(Math.cos(p.pose.yaw)).addScaledVector(new THREE.Vector3().copy(frame.east),Math.sin(p.pose.yaw)),right=new THREE.Vector3().crossVectors(up,forward).normalize();
        q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));}
      this.placeBody(b,pos,q,p.frameId,p.pose.seat?'Sit':p.animation||'Idle',dt);}
    for(const c of Object.values(s.pool)){if(c.retired||c.status==='inside'||c.status==='reserved')continue;seen.add(c.id);const b=this.body(c.id,c.personId,c.name);
      const ship=c.shipId?s.ships[c.shipId]:null,contract=ship?.crew.find(m=>m.id===c.id);
      let pos=this.site.toWorld(c.position.x,0,c.position.z),frame='mars',pose=c.status==='waiting'?'Idle':'Walk',q=new THREE.Quaternion().copy(this.hallRoot.quaternion);
      if(contract?.status==='aboard'||contract?.status==='walking-aboard'){const seat=contract.status==='aboard'?(contract.displaced?contract.standPose:contract.seatPose):contract.localPose;pos=ship.pose.pos;frame=ship.frameId;pose=contract.status==='aboard'?(contract.displaced?'Idle':'Sit'):'Walk';if(seat){const v=new THREE.Vector3().copy(seat).applyQuaternion(new THREE.Quaternion().fromArray(ship.pose.quaternion));pos={x:pos.x+v.x,y:pos.y+v.y,z:pos.z+v.z};}q=new THREE.Quaternion().fromArray(ship.pose.quaternion);}
      else if(contract?.position)pos=this.site.toWorld(contract.position.x,0,contract.position.z);
      this.placeBody(b,pos,q,frame,pose,dt);}
    for(const [id,b] of this.bodies)b.group.visible=seen.has(id)&&b.frameId===this.space.frameId;
    for(const ship of Object.values(s.ships)){if(ship.id===current){const v=this.fleet.get(ship.id);if(v)v.root.visible=false;continue;}
      let v=this.fleet.get(ship.id);if(!v){const root=this.ship.exterior.root.clone(true);root.name='owned-ship:'+ship.id;this.engine.scene.add(root);v={root,entry:this.engine.track({worldPos:{...ship.pose.pos},object3d:root,quaternion:new THREE.Quaternion()})};this.fleet.set(ship.id,v);}
      Object.assign(v.entry.worldPos,ship.pose.pos);v.entry.quaternion.fromArray(ship.pose.quaternion);v.root.visible=ship.frameId===this.space.frameId;
      v.entry.frame=ship.frameId==='mars'?this.engine.rootFrame:this.space.moonWorld(ship.frameId).frame;}
  }
  placeBody(b,pos,q,frame,pose,dt){const speed=b.last?Math.min(4,Math.hypot(pos.x-b.last.x,pos.y-b.last.y,pos.z-b.last.z)/Math.max(.1,dt)):0;
    if(pose==='Idle'&&speed>.3)pose='Walk';b.person.play(pose);b.person.update(dt,speed);Object.assign(b.entry.worldPos,pos);b.entry.quaternion.copy(q);b.last={...pos};b.frameId=frame;
    b.entry.frame=frame==='mars'?this.engine.rootFrame:this.space.moonWorld(frame).frame;
  }
  buildPanel(){this.button=document.createElement('button');this.button.id='multiplayer-button';this.button.textContent='World / crew';
    this.panel=document.createElement('div');this.panel.id='multiplayer-panel';
    const style=document.createElement('style');style.textContent=`#multiplayer-button{position:fixed;left:12px;bottom:120px;z-index:68;min-height:44px;background:#281c12;color:#ffe0b0;border:1px solid #ae8548;border-radius:8px}#multiplayer-panel{position:fixed;left:12px;bottom:170px;z-index:74;padding:14px;background:#18120bf5;color:#ffe0b0;width:min(310px,calc(100vw - 48px));max-height:65vh;overflow:auto;font:12px/1.5 monospace;border:1px solid #ae8548;border-radius:10px}#multiplayer-panel button,#multiplayer-panel input{min-height:44px;margin:3px;color:#ffe0b0;background:#382817;border:1px solid #ae8548;border-radius:6px} @media(max-width:520px){#multiplayer-button{top:auto;bottom:170px}#multiplayer-panel{top:150px;max-height:55vh}}`;
    document.head.append(style);document.body.append(this.button,this.panel);this.panel.hidden=true;this.button.onclick=()=>{this.panel.hidden=!this.panel.hidden;this.draw();};
  }
  draw(){this.button.textContent=this.world.connected?'World / crew':'World disconnected';if(this.panel.hidden||this.panel.contains(document.activeElement)&&document.activeElement.tagName==='INPUT')return;this.panel.replaceChildren();
    const s=this.world.snapshot,p=s.players[this.world.playerId],owned=s.ships[p.shipId];
    const text=t=>{const e=document.createElement('p');e.textContent=t;this.panel.append(e);};
    const btn=(t,a)=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>this.request(a);this.panel.append(b);};
    text(`Shared world · ${Object.values(s.players).filter(p=>p.online).length} here. Your ${owned.type}: pad ${owned.pad.number}.`);
    const name=document.createElement('input');name.value=p.name;name.setAttribute('aria-label','Player name');name.maxLength=32;this.panel.append(name);
    const save=document.createElement('button');save.textContent='Save name';save.onclick=()=>{this.world.identity.name=name.value;localStorage.setItem(this.world.identity.slot||'cosmos-device-v2',JSON.stringify(this.world.identity));this.request({type:'rename',name:name.value});};this.panel.append(save);
    if(!this.world.connected){text('The shared world keeps running while you are away.');const solo=document.createElement('button');solo.textContent='Play my saved solo world';solo.onclick=()=>{const u=new URL(location.href);u.searchParams.set('solo','1');location.href=u.href;};this.panel.append(solo);}
    btn(owned.crewMayBoard?'Close guest boarding':'Allow crew to board',{type:'boarding-permission',allowed:!owned.crewMayBoard});
    if(p.aboardShipId)btn('Leave after landing',{type:'leave'});
    else for(const ship of Object.values(s.ships))if(ship.frameId===p.frameId&&Math.hypot(ship.pose.pos.x-this.walker.worldPos.x,ship.pose.pos.y-this.walker.worldPos.y,ship.pose.pos.z-this.walker.worldPos.z)<65)
      btn(`Board ${s.players[ship.owner].name}'s ship`,{type:'board',shipId:ship.id});
    text('Hiring: walk to the crew hall door, north of the main pad. Candidates come outside when called.');
    for(const c of Object.values(s.pool).filter(c=>!c.shipId&&!c.retired)){text(`${c.name} · ${c.role} · ${Math.round(c.skill*100)}% · ${c.wageCredits} cr/sol`);
      if(c.status==='inside')btn('Meet '+c.name,{type:'meet',id:c.id});else if(c.status==='waiting'){btn('Hire '+c.name,{type:'hire',id:c.id});btn('Decline',{type:'decline',id:c.id});}}
    text('Your crew: '+(owned.crew.map(c=>`${c.name} (${c.status}${c.unpaid?', unpaid':''})`).join(', ')||'none'));
  }
  tick(dt){this.accum+=dt;this.updateBodies(dt);this.button.style.bottom=this.ship.aboard?'190px':'120px';if(this.accum>=.1){this.accum=0;this.sendPose();
    if(this.ship.remoteFireWanted&&['captain','gun_dorsal','gun_ventral'].includes(this.ship.seat?.id)){const direction=new THREE.Vector3(0,0,-1).applyQuaternion(this.engine.camera.quaternion);
      this.world.request({type:'fire-gun',direction:{x:direction.x,y:direction.y,z:direction.z}});}}}
}
