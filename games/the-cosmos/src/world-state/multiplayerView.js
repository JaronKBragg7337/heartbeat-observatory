import { hullPush, mayBoard } from '../ship/hullCollision.js';
import { shipPresence } from './shipPresence.js';
import { guardSheetPress } from '../ui/activation.js';
import { MotionBuffer, reconcile } from './motionBuffer.js';
import * as THREE from 'three';
import { playerPose } from './gameBridge.js';
import { restoreTerrain } from './terrainCodec.js';
import { attachGrades } from '../world/field.js';
import { landingField } from './fleet.js';
import { cartesianToGeodetic, localFrame } from '../world/geodesy.js';
import { SpaceTrip } from '../space/spaceTrip.js';
import { rampEntry } from '../ship/rampTransfer.js';
import { ShipWalker, shipIndexFor } from '../ship/shipWalker.js';
import { ShopView } from '../economy/shopView.js';   // CARGO: the market row and its phone sheet
import { FleetView } from './fleetView.js';      // FLEET: the other ships, the raiders, the shipyard
import { shipDef } from '../ships/registry.js';
import { seatPan } from '../ship/shipSpec.js';   // moons-fix
import { AccountView } from './accountView.js';
const hall={x:-28,z:-68,w:24,d:14,h:5};
function label(text){const c=document.createElement('canvas');c.width=512;c.height=64;const x=c.getContext('2d');
  x.fillStyle='#17120cdd';x.fillRect(0,0,512,64);x.fillStyle='#ffe0ab';x.font='28px sans-serif';x.textAlign='center';x.fillText(text,256,44,500);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:true}));s.scale.set(3.6,.45,1);return s;}
export class MultiplayerView {
  constructor(world,{engine,ship,walker,edits,digger,site,space,people,bridge,rebuild,port}) {
    Object.assign(this,{world,engine,ship,walker,edits,digger,site,space,people,bridge,rebuild,port});this.bodies=new Map();this.fleet=new Map();this.pads=new Set();this.moonPadIds=new Set();this.accum=0;this.forcePlayer=true;this.motion=new MotionBuffer();
    attachGrades([site,landingField(site,()=>world.snapshot.pads)]);
    space.portSite={...site,toWorld:(x,y,z)=>{const pad=world.snapshot.ships[this.activeId()].pad;return site.toWorld(pad.x+x,y,pad.z+z);}};
    ship.remoteAuthority=true;ship.flight.remoteAuthority=true;
    this.installControls();this.buildHall();this.buildPanel();this.fleetView=new FleetView(this);this.shopView=new ShopView(this);
    this.account=new AccountView(this);       // Settings: guest or signed in, sign in/out, start fresh, saved characters
    world.beforeAction=()=>this.sendPose();world.onReceipt=r=>{if(!r.ok)ship.note(r.msg,true);if(this.crew?.onSay)this.crew.onSay('',r.msg==='Saved to the shared world.'?'Done.':r.msg);if(!r.ok)this.reconcilePlayer=true;};
    world.onConnection=()=>this.reconcilePlayer=true;
    world.listeners.add(m=>this.apply(m));this.apply({state:world.snapshot,bricks:[...world.bricks.values()]});
  }
  activeId(){const p=this.world.snapshot.players[this.world.playerId];return p.aboardShipId||p.currentShipId||p.shipId;}
  sendPose(){const p=this.world.snapshot.players[this.world.playerId];const pose=playerPose(this.walker,this.ship);
    // Seat/boarding transitions require an action; pose packets only describe predicted movement.
    pose.aboard=!!p.aboardShipId;pose.seat=p.pose.seat;
    this.world.sendPose(pose,this.ship.flight.controls,this.vehicles?.controlPacket?.()||null,this.space.ff.active?{...this.space.ff.input}:null);}   // FREEFLIGHT: the free-flight stick rides the same lease
  request(a){this.sendPose();return this.world.request(a).then(r=>{if(r.ok&&r.msg&&r.msg!=='Saved to the shared world.')this.ship.note(r.msg);if(!r.ok)this.reconcilePlayer=true;return r;});}
  installControls(){const ship=this.ship,space=this.space;
    const outside=ship._outsideFrame.bind(ship);
    ship._outsideFrame=(dt,inp)=>{outside(dt,inp);if(ship.aboard||this.boardPending)return;this.collideShips();
      for(const s of Object.values(this.world.snapshot.ships))if(s.id!==this.activeId()&&mayBoard(s,this.world.playerId)&&s.frameId===space.frameId&&s.pose.landed&&Math.hypot(s.pose.pos.x-this.walker.worldPos.x,s.pose.pos.y-this.walker.worldPos.y,s.pose.pos.z-this.walker.worldPos.z)<45){
        const f=this.shipPose(s),q=new THREE.Quaternion().fromArray(f.quaternion).invert(),loc=new THREE.Vector3().copy(this.walker.worldPos).sub(new THREE.Vector3().copy(f.pos)).applyQuaternion(q),yaw=this.walker.yaw-s.pose.heading;
        const motion={x:Math.sin(yaw)*(inp.moveNorth||0)+Math.cos(yaw)*(inp.moveEast||0),z:-Math.cos(yaw)*(inp.moveNorth||0)+Math.sin(yaw)*(inp.moveEast||0)};
        const ramps=shipDef(s.type).ramps;
        const entry=Object.keys(ramps).map(k=>rampEntry(k,s.state.ramps[k],loc,motion,ramps)).find(Boolean);
        if(entry&&new ShipWalker(shipIndexFor(shipDef(s.type)),s.state).canStand(entry.x,entry.y,entry.z)){
          this.boardPending=true;this.request({type:'board',shipId:s.id,walkPose:{sw:{...entry,yaw,pitch:this.walker.pitch},yaw:this.walker.yaw,pitch:this.walker.pitch}}).finally(()=>{this.boardPending=false;this.reconcilePlayer=true;this.lastAboard=undefined;this.apply({});});break;
        }
      }
    };
    ship._hullPush=loc=>hullPush(ship.def,ship.state,loc,mayBoard(this.world.snapshot.ships[this.activeId()],this.world.playerId));
    const board=ship.boardAt.bind(ship),leave=ship.disembark.bind(ship);
    ship.boardAt=(x,y,z,yaw)=>{if(this.boardPending||!mayBoard(this.world.snapshot.ships[this.activeId()],this.world.playerId))return;this.boardPending=true;
      const groundPose=playerPose(this.walker,ship);board(x,y,z,yaw);ship.sw.pitch=this.walker.pitch;
      ship.flight.toWorld(ship.sw,this.walker.worldPos);
      this.request({type:'board',shipId:this.activeId(),walkPose:playerPose(this.walker,ship),groundPose})
        .finally(()=>this.boardPending=false);};
    ship.disembark=key=>{if(this.boardPending)return;this.boardPending=true;
      const aboardPose=playerPose(this.walker,ship);leave(key);
      this.request({type:'leave',key,walkPose:playerPose(this.walker,ship),aboardPose}).finally(()=>this.boardPending=false);};
    ship.stations.sit=loc=>{const s=ship.stations.seatNear(loc);if(s)this.request({type:'seat',seat:s.id});return null;};
    ship.stations.stand=()=>{this.request({type:'seat',seat:null});return null;};
    ship.takeSeat=id=>{this.request({type:'seat',seat:id});return false;};
    ship.toggleRamp=key=>{this.request({type:'ramp',key});return true;};
    this.port.elevator.tick=()=>0;
    this.port.elevator.request=destination=>{this.request({type:'elevator',destination});return true;};
    ship.stations.power=(key,value)=>{this.request({type:'power',key,value});return true;};
    space.engage=id=>{this.request({type:'engage',destination:id});return {ok:true,msg:'Course requested.'};};
    space.cancel=()=>{this.request({type:'cancel-trip'});return {ok:true,msg:'Cancellation requested.'};};
    space.setWarp=warp=>{this.request({type:'trip-warp',warp});};space.tripControls=()=>null;
    space.ffCommand=o=>{this.request({type:'ff-set',...o});return {ok:true};};   // FREEFLIGHT: the authority decides
    space.stickWarp=()=>1; // Compression is stepped by the authority, never twice.
    ship.stations.powerSplit=(engines,guns,shields)=>{this.request({type:'power-split',engines,guns,shields});return true;};
    ship.cycleAirlock=()=>{this.request({type:'airlock'});return true;};
    ship._rampFrame=()=>{for(const key of ['cargo','airlock'])ship._applyRampPose(key);};
    ship._airlockStep=()=>{};
    space.jobs.takeSample=s=>{this.request({type:'sample',site:s.id});return {ok:true,msg:'Sample requested.'};};
    space.jobs.salvage=()=>{this.request({type:'salvage'});return {ok:true,msg:'Claim requested.'};};
    space.jobs.stow=()=>{this.request({type:'stow'});return {ok:true,msg:'Cargo transfer requested.'};};
    // Only validated job intents can pay. Amounts/cargo supplied by a browser are never accepted.
    space.hooks.award=()=>{};space.hooks.addCargo=()=>{};space.hooks.removeCargo=()=>{};space.hooks.onArrive=()=>{};
    space.hooks.cargoKg=item=>this.world.snapshot.ships[this.activeId()].hold[item]||0;
  }
  apply(m){const snapshot=this.world.snapshot,p=snapshot.players[this.world.playerId],s=snapshot.ships[this.activeId()],f=this.ship.flight;
    if(this.engine.scene.userData.privateOpening||p.opening&&!p.opening.complete)return;
    // FLEET: the flagship changed to another class (bought, captured, switched): this cockpit is built for the old one, so come back in.
    if(s.type!==this.ship.def.type){this.reloadForShip(s);return;}
    this.recordMotion(m);this.fleetView?.onSnapshot();this.shopView?.refresh();
    const changed=this.lastShipId!==s.id||this.lastFrame!==p.frameId||this.lastAboard!==p.aboardShipId||this.lastSeat!==p.pose.seat;
    if(this.lastShipId!==s.id){this.messageSeq=0;this.eventSeq=s.eventSeq||0;}
    if(snapshot.elevator){const loc=this.site.toLocal(this.walker.worldPos),e=this.port.elevator,oldY=e.y,sv=snapshot.elevator;
      // The authority sends the lift ten times a second; between those the client runs the same lift rules (see tick) so the car and a rider
      // move every frame. A snapshot corrects the prediction: the state words are taken as sent, and the height is eased toward where the
      // server's lift is right now (its height plus the time this packet spent in flight), never snapped by more than a step.
      const flight=Math.min(.3,(this.fleetView?.age?.()??0)),dir=Math.sign((sv.target??sv.y)-sv.y),now=sv.phase==='moving'?sv.y+dir*Math.min(Math.abs((sv.target??sv.y)-sv.y),(sv.speed||0)*flight):sv.y;
      const err=now-oldY,newY=Math.abs(err)>1.2||sv.phase!=='moving'&&Math.abs(err)<.02?now:oldY+err*.5;
      if(!this.ship.aboard&&e.contains(loc.x+60,loc.z+39)&&Math.abs(loc.y-oldY)<.4)
        for(const k of ['x','y','z'])this.walker.worldPos[k]+=this.site.up[k]*(newY-oldY);
      Object.assign(e,sv,{y:newY});this.port.updateElevatorVisuals();}
    if(this.space.frameId!==p.frameId)this.space.setFrame(p.frameId);
    const previousFrame=this.lastFrame;
    this.lastFrame=p.frameId;this.lastShipId=s.id;this.lastAboard=p.aboardShipId;this.lastSeat=p.pose.seat;
    Object.assign(f.pos,this.shipPose(s).pos);Object.assign(f.vel,s.pose.vel);Object.assign(f.power,s.pose.power);
    for(const k of ['heading','pitch','roll','yawRate','hull','shield','shieldMax','gearPos','landed','autoHover','airborne','agl','time','climbCap','thrustDown','thrustUp','thrustFwd'])if(s.pose[k]!==undefined)f[k]=s.pose[k];
    this.space.ff.applyRemote(s.ff);   // FREEFLIGHT: mirror the authority's free-flight state (the physics runs there)
    f.attitude=s.pose.attitude?new THREE.Quaternion().fromArray(s.pose.attitude):null;s.pose.legs?.forEach((leg,i)=>Object.assign(f.legs[i],leg));
    f.quaternion.fromArray(this.shipPose(s).quaternion);f.refreshOrientation();f.quaternion.fromArray(this.shipPose(s).quaternion);
    for(const [key,v] of Object.entries(s.state))if(this.ship.state[key])Object.assign(this.ship.state[key],v);
    for(const [key,r] of Object.entries(s.state.ramps)){const ctl=this.ship.rampCtl[key];Object.assign(ctl,{progress:r.progress??(r.lowered?1:0),target:r.target??(r.lowered?1:0),angle:r.angle});}
    if(s.air)Object.assign(this.ship.air,s.air);
    const predictedTransition=this.ship.aboard===!!p.aboardShipId&&previousFrame===p.frameId&&this.ship.stations.seated===p.pose.seat;
    const previousSeat=this.ship.stations.seated,bodyMismatch=this.ship.aboard!==!!p.aboardShipId;
    if(!this.boardPending)this.ship.aboard=!!p.aboardShipId;
    this.ship.stations.seated=p.pose.seat;
    if(!this.boardPending&&(changed&&!predictedTransition||bodyMismatch||this.forcePlayer)){Object.assign(this.walker.worldPos,p.pose.worldPos);Object.assign(this.walker.velocity,p.pose.velocity);
      Object.assign(this.walker,{yaw:p.pose.yaw,pitch:p.pose.pitch,grounded:p.pose.grounded});this.walker.updateFrame();
      this.ship.sw.place(p.pose.sw.x,p.pose.sw.y,p.pose.sw.z,p.pose.sw.yaw);this.ship.sw.pitch=p.pose.sw.pitch;Object.assign(this.ship.look,p.pose.look);this.forcePlayer=false;this.correction=null;
      // A deliberate restore or frame/seat transfer already consumed this
      // authority pose. Do not reconcile it again against an older prediction.
      this.ackSeq=p.poseSeq;}
    else if(!this.boardPending&&!p.pose.seat)this.reconcileSnapshot(p);
    if(previousSeat!==p.pose.seat){if(p.pose.seat)this.ship._onSit(this.ship.stations.seatDef(p.pose.seat));else if(previousSeat){const seat=this.ship.stations.seatDef(previousSeat),sg=this.ship.interior.seatGroups.get(previousSeat);if(sg)sg.visible=true;this.ship._swivelSeat(seat,seat.yaw*Math.PI/180);this.ship.onStationChange?.(null);}}
    this.ship._syncEntries();this.digger.carried.splice(0,this.digger.carried.length,...structuredClone(p.carried));this.digger.setTool(p.toolIdx);
    const trip=s.trip;
    if(trip){const dest={...this.space.resolve(trip.destId),...trip.dest},t=new SpaceTrip(this.space,dest);
      Object.assign(t,trip);t.dest=dest;this.space.trip=t;this.space.warp=t.warp;}
    else {this.space.trip=null;this.space.warp=s.flightWarp||1;this.space.eff=s.flightEff||1;}
    this.space.ledger.credits=s.economy.marks/4;this.space.ledger.cargo=new Map(Object.entries(s.hold));
    this.space.jobs.taken=new Set(s.jobs.taken);this.space.jobs.salvaged=s.jobs.salvaged;this.space.jobs.samplesAboard=s.jobs.samples.length;
    if(s.combat){this.ship.guns.bolts=structuredClone(s.combat.bolts);this.ship.guns.aim=structuredClone(s.combat.aim);Object.assign(this.ship.guns,{cool:{...s.combat.cool},alt:{...s.combat.alt},shots:{...s.combat.shots}});
      this.ship.drones.shots=structuredClone(s.combat.enemyShots);this.ship.drones.neutral=s.combat.neutral;this.ship.drones.suspended=s.combat.suspended;
      s.combat.drones.forEach((r,i)=>{const d=this.ship.drones.drones[i];if(d){Object.assign(d.pos,r.pos);Object.assign(d.vel,r.vel);d.state=r.state;d.target.hp=r.target.hp;d.target.inactive=r.target.inactive;}});
      s.combat.practice?.forEach((r,i)=>{const t=this.ship.targets[i];if(t){Object.assign(t.t,r);t.mesh.visible=r.hp>0||r.respawn>6.5;}});}
    for(const e of s.events||[])if(e.seq>(this.eventSeq||0)){const event={...e};if(e.id?.includes(':practice-'))event.id=this.ship.targets[Number(e.id.split(':practice-')[1])]?.id||e.id;
      (e.system==='drones'?this.ship.drones:this.ship.guns).events.push(event);this.eventSeq=e.seq;}
    const backlog=!this.messageSeq;if(backlog)this.ship.voiceQuiet=true;   // VOICES: the log you join with is history, not speech
    for(const line of s.messages||[])if(line.seq>(this.messageSeq||0)){this.ship.note(line.msg,line.warn);this.messageSeq=line.seq;}
    this.ship.voiceQuiet=false;
    const ids=new Set((m.bricks||[]).map(b=>b.bodyId));
    for(const id of ids){const store=id==='mars'?this.edits:this.space.moonWorld(id).edits;
      restoreTerrain(store,snapshot.terrain[id],(m.bricks||[]).filter(b=>b.bodyId===id));}
    for(const pad of snapshot.pads)this.addPad(pad);
    this.syncMoonPads();
    this.initialized=true;this.forcePlayer=false;this.reconcilePlayer=false;this.updateBodies(0);this.draw();
  }

  recordMotion(m){
    const now=performance.now(),time=m.serverAt??this.world.serverAt??now;
    for(const s of Object.values(this.world.snapshot.ships))this.motion.push('ship:'+s.id,time,now,{...s.pose,warp:s.flightEff||1},s.frameId);
    for(const p of Object.values(this.world.snapshot.players)) {
      const aboard=!!p.aboardShipId;
      const v=aboard?p.pose.sw.velocity:p.pose.velocity,vel=Object.fromEntries(['x','y','z'].map(k=>[k,Math.max(-12,Math.min(12,Number(v?.[k])||0))]));
      this.motion.push('player:'+p.id,time,now,{pos:aboard?p.pose.sw:p.pose.worldPos,vel,yaw:aboard?p.pose.sw.yaw:p.pose.yaw},p.frameId+':'+(p.aboardShipId||'ground'));
    }
  }
  shipPose(s){
    // Rendered once per ship per frame (interpolation state advances on a call, and a dozen systems ask for the same pose every frame).
    const f=this.engine.frameCount,c=this._poseCache||(this._poseCache=new Map()),hit=c.get(s.id);
    if(hit&&hit.f===f&&hit.src===s.pose)return hit.pose;
    const pose=this.motion.render('ship:'+s.id,performance.now())||s.pose;c.set(s.id,{f,pose,src:s.pose});return pose;}
  smoothActiveShip(){const s=this.world.snapshot.ships[this.activeId()],pose=this.shipPose(s),f=this.ship.flight;
    Object.assign(f.pos,pose.pos);f.quaternion.fromArray(pose.quaternion);
  }
  reconcileSnapshot(p){
    const sent=this.world.sentPoses.get(p.poseSeq);
    if(sent&&this.ackSeq!==p.poseSeq){
      this.ackSeq=p.poseSeq;const actual=this.ship.aboard?p.pose.sw:p.pose.worldPos,predicted=this.ship.aboard?sent.sw:sent.worldPos;
      this.correction=Object.fromEntries(['x','y','z'].map(k=>[k,actual[k]-predicted[k]]));
      if(Math.hypot(...Object.values(this.correction))<.08)this.correction=null;
    }else if(this.reconcilePlayer){const actual=this.ship.aboard?p.pose.sw:p.pose.worldPos,pos=this.ship.aboard?this.ship.sw:this.walker.worldPos;
      this.correction=Object.fromEntries(['x','y','z'].map(k=>[k,actual[k]-pos[k]]));}
  }
  collideShips(){
    for(const s of Object.values(this.world.snapshot.ships)){
      if(s.id===this.activeId()||s.frameId!==this.space.frameId||!shipPresence(s,this.world.snapshot))continue;
      const f=this.shipPose(s),w=this.walker;
      if(Math.hypot(f.pos.x-w.worldPos.x,f.pos.y-w.worldPos.y,f.pos.z-w.worldPos.z)>100)continue;
      const q=new THREE.Quaternion().fromArray(f.quaternion),loc=new THREE.Vector3().copy(w.worldPos).sub(new THREE.Vector3().copy(f.pos)).applyQuaternion(q.clone().invert());
      const push=hullPush(shipDef(s.type),s.state,loc,mayBoard(s,this.world.playerId));
      if(push){const d=new THREE.Vector3(push.x,0,push.z).applyQuaternion(q);for(const k of ['x','y','z']){w.worldPos[k]+=d[k];w.velocity[k]*=.2;}}
  }
  }
  reloadForShip(s){if(this._reloading)return;let n=0;try{n=+sessionStorage.getItem('cosmos-ship-reloads')||0;}catch{}
    if(n>=3){this.ship.note('Your ship changed class; reload the page to board it.',true);this._reloading=true;return;}
    this._reloading=true;try{sessionStorage.setItem('cosmos-ship-reloads',String(n+1));setTimeout(()=>sessionStorage.removeItem('cosmos-ship-reloads'),20000);}catch{}
    this.ship.note(`Boarding your ${shipDef(s.type).class}...`);setTimeout(()=>location.reload(),1200);}
  addPad(a){if(this.pads.has(a.id)||a.x===0&&a.z===0)return;this.pads.add(a.id);
    const g=new THREE.Group();g.name='allocated-'+a.id;g.position.set(a.x,0,a.z);
    const slab=new THREE.Mesh(new THREE.BoxGeometry(a.w,.5,a.d),this.ship.matsExt.concrete||new THREE.MeshStandardMaterial({color:0x77736b,roughness:.9}));slab.position.y=-.24;g.add(slab);
    const paint=new THREE.MeshStandardMaterial({color:0xf0bf55,emissive:0x34220a});
    for(const x of [-a.w/2+1,a.w/2-1]){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.18,.03,a.d-2),paint);stripe.position.set(x,.035,0);g.add(stripe);}
    for(const z of [-a.d/2+1,a.d/2-1]){const stripe=new THREE.Mesh(new THREE.BoxGeometry(a.w-2,.03,.18),paint);stripe.position.set(0,.035,z);g.add(stripe);}
    for(const x of [-a.w/2+1,a.w/2-1])for(const z of [-a.d/2+1,a.d/2-1]){const light=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.7,8),new THREE.MeshBasicMaterial({color:0x58dbff}));light.position.set(x,.35,z);g.add(light);}
    const sign=label('PAD '+a.number);sign.position.set(0,1,a.d/2-3);g.add(sign);this.hallRoot.add(g);this.rebuild?.(true);
  }
  /** Markings for a ship's own moon pad. Drawn in that moon's frame, and only once the moon world exists. Regolith stays; this is paint and lights. */
  syncMoonPads(){const space=this.space;if(!space?.worlds)return;
    for(const ship of Object.values(this.world.snapshot.ships||{})){if(!ship.moonPads)continue;
      for(const bodyId of ['phobos','deimos']){const a=ship.moonPads[bodyId];if(!a||this.moonPadIds.has(a.id))continue;
        const w=space.worlds.get(bodyId);if(!w?.frame||!w.body?.playerPad)continue;
        const pp=w.body.playerPad(a.east,a.north);this.moonPadIds.add(a.id);
        const g=new THREE.Group();g.name='moon-pad-'+a.id;
        const paint=new THREE.MeshStandardMaterial({color:0xf0bf55,emissive:0x34220a,roughness:.55,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8});
        for(const x of [-a.w/2+1,a.w/2-1]){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.22,.02,a.d-4),paint);stripe.position.set(x,.04,0);g.add(stripe);}
        for(const z of [-a.d/2+1,a.d/2-1]){const stripe=new THREE.Mesh(new THREE.BoxGeometry(a.w-4,.02,.22),paint);stripe.position.set(0,.04,z);g.add(stripe);}
        const lampMat=new THREE.MeshBasicMaterial({color:0x58dbff});
        for(const x of [-a.w/2+1.4,a.w/2-1.4])for(const z of [-a.d/2+1.4,a.d/2-1.4]){const light=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.7,8),lampMat);light.position.set(x,.4,z);g.add(light);}
        const sign=label('PAD '+a.number);sign.position.set(0,1.6,a.d/2-4);g.add(sign);
        const east=new THREE.Vector3(pp.east.x,pp.east.y,pp.east.z),up=new THREE.Vector3(pp.up.x,pp.up.y,pp.up.z);
        const south=new THREE.Vector3().crossVectors(east,up).normalize();
        const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east,up,south));
        this.engine.scene.add(g);
        this.engine.track({worldPos:{x:pp.point.x,y:pp.point.y,z:pp.point.z},object3d:g,quaternion:q,frame:w.frame});
      }
    }
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
  body(id,personId,name,look){let v=this.bodies.get(id);
    if(v){if(look){v.wantLook=look;v.person.dress(look);}return v;}
    const person=this.people.spawn(personId),group=new THREE.Group();group.name='remote-person:'+id;group.add(person.group);
    const tag=label(name);tag.position.y=2.15;group.add(tag);this.engine.scene.add(group);
    const fallback=new THREE.Mesh(new THREE.CapsuleGeometry(.22,1.2,4,8),new THREE.MeshStandardMaterial({color:0xcbbba7}));fallback.position.y=.9;group.add(fallback);
    if(look)person.dress(look);
    person.ready.then(p=>{if(p.loaded){group.remove(fallback);if(v.wantLook)p.dress(v.wantLook);}});
    const entry=this.engine.track({worldPos:{x:0,y:0,z:0},object3d:group,quaternion:new THREE.Quaternion()});
    v={person,group,entry,last:null,name,tag,wantLook:look||null};this.bodies.set(id,v);return v;
  }
  updateBodies(dt){const s=this.world.snapshot,current=this.activeId(),seen=new Set();
    for(const p of Object.values(s.players)){if(p.id===this.world.playerId||!p.online||p.opening&&!p.opening.complete)continue;seen.add(p.id);const b=this.body(p.id,p.personId,p.name);
      const rendered=this.motion.render('player:'+p.id,performance.now());
      let pos=rendered?.pos||p.pose.worldPos,q;
      if(p.aboardShipId){const ship=s.ships[p.aboardShipId],f=this.shipPose(ship),offset=new THREE.Vector3().copy(rendered?.pos||p.pose.sw).applyQuaternion(new THREE.Quaternion().fromArray(f.quaternion));
        pos={x:f.pos.x+offset.x,y:f.pos.y+offset.y,z:f.pos.z+offset.z};q=new THREE.Quaternion().fromArray(f.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI-(rendered?.yaw??p.pose.sw.yaw)));}
      else{const geo=cartesianToGeodetic(this.walker.body,pos.x,pos.y,pos.z),frame=localFrame(geo.lat,geo.lon),up=new THREE.Vector3().copy(frame.up),
        forward=new THREE.Vector3().copy(frame.north).multiplyScalar(Math.cos(rendered?.yaw??p.pose.yaw)).addScaledVector(new THREE.Vector3().copy(frame.east),Math.sin(rendered?.yaw??p.pose.yaw)),right=new THREE.Vector3().crossVectors(up,forward).normalize();
        q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));}
      this.placeBody(b,pos,q,p.frameId,(p.pose.seat||p.vehicleSeat)?'Sit':p.animation||'Idle',dt);}
    for(const c of Object.values(s.pool)){if(c.retired||c.status==='reserved')continue;seen.add(c.id);const ship0=c.shipId?s.ships[c.shipId]:null,contract0=ship0?.crew.find(m=>m.id===c.id);
      const b=this.body(c.id,c.personId,c.name,c.look||contract0?.look);
      const ship=c.shipId?{...s.ships[c.shipId],pose:this.shipPose(s.ships[c.shipId])}:null,contract=ship?.crew.find(m=>m.id===c.id);
      let pos=this.site.toWorld(c.position.x,c.position.y||0,c.position.z),frame='mars',pose=['waiting','inside'].includes(c.status)?'Idle':'Walk',q=new THREE.Quaternion().copy(this.hallRoot.quaternion);
      if(['aboard','walking-aboard','leaving-aboard'].includes(contract?.status)){const seat=contract.status==='aboard'?(contract.displaced?contract.standPose:contract.seatPose):contract.localPose;pos=ship.pose.pos;frame=ship.frameId;pose=contract.status==='aboard'?(contract.displaced?'Idle':'Sit'):'Walk';if(seat){const v=new THREE.Vector3().copy(seat).applyQuaternion(new THREE.Quaternion().fromArray(ship.pose.quaternion));pos={x:pos.x+v.x,y:pos.y+v.y,z:pos.z+v.z};}q=new THREE.Quaternion().fromArray(ship.pose.quaternion);}
      else if(contract?.position)pos=this.site.toWorld(contract.position.x,0,contract.position.z);
      // People on the ground arrive in ten-per-second steps; a walk (out of the hall, to the ramp) is eased between them so it reads as walking.
      if(frame==='mars'&&!['aboard','walking-aboard','leaving-aboard'].includes(contract?.status))pos=this.easeBody(b,'ground',pos,dt);else b.eased=null;
      this.placeBody(b,pos,q,frame,pose,dt);
      const local=contract&&c.shipId===current&&['aboard','walking-aboard','leaving-aboard'].includes(contract.status);
      if(local){if(!b.local){this.engine.untrack(b.entry);this.ship.interior.root.add(b.group);b.local=true;}
        let seat=contract.displaced?contract.standPose:contract.localPose||contract.seatPose;
        if(seat&&(contract.status==='walking-aboard'||contract.status==='leaving-aboard')){const e=this.easeBody(b,'aboard',{x:seat.x,y:seat.y,z:seat.z},dt);seat={...seat,x:e.x,y:e.y,z:e.z};}else b.easedAboard=null;
        if(seat){b.group.position.set(seat.x,seat.y+(contract.status==='aboard'&&!contract.displaced?(seat.id?seatPan(seat):0):0),seat.z);b.group.rotation.set(0,Math.PI-(Number.isFinite(seat.yaw)?seat.yaw*(seat.id?Math.PI/180:1):0),0);}
      }else if(b.local){b.group.removeFromParent();this.engine.scene.add(b.group);b.entry=this.engine.track(b.entry);b.local=false;}
    }
    this.fleetView.crew(dt,s,seen);          // FLEET: the people at a raider's stations
    for(const [id,b] of this.bodies)if(!b.local||!seen.has(id))b.group.visible=seen.has(id)&&b.frameId===this.space.frameId;
    this.crew?.sync();
    this.fleetView.update(dt,s,current);     // FLEET: every other ship, raiders and escorts, built from its own definition
  }
  /** Ease a body toward its latest known place: frame-rate smooth between 10 Hz snapshots, snapped when it jumps (a teleport, a new place). */
  easeBody(b,kind,target,dt){const key=kind==='ground'?'eased':'easedAboard',cur=b[key];
    if(!cur||Math.hypot(target.x-cur.x,target.y-cur.y,target.z-cur.z)>4){b[key]={x:target.x,y:target.y,z:target.z};return target;}
    const f=1-Math.exp(-Math.min(.1,dt)*14);cur.x+=(target.x-cur.x)*f;cur.y+=(target.y-cur.y)*f;cur.z+=(target.z-cur.z)*f;return cur;}
  placeBody(b,pos,q,frame,pose,dt){const cam=this.engine.cameraWorldPos;
    if(b.tag){const d=Math.hypot(pos.x-cam.x,pos.y-cam.y,pos.z-cam.z);
      // ROUND7: a name tag has one size ON THE SCREEN (about 22 px tall), not 3.6 m across in the world: at 4 m a world-sized tag filled the screen as a dark translucent banner.
      // Hidden over someone you are sitting beside (FLEET) and past 30 m (unreadable).
      b.tag.visible=d>3.5&&d<30;
      if(b.tag.visible){const fov=(this.engine.camera?.fov||60)*Math.PI/180,h=Math.min(.4,22*d*2*Math.tan(fov/2)/Math.max(300,innerHeight));b.tag.scale.set(h*8,h,1);}}
    const speed=b.last?Math.min(4,Math.hypot(pos.x-b.last.x,pos.y-b.last.y,pos.z-b.last.z)/Math.max(.1,dt)):0;
    if(pose==='Idle'&&speed>.3)pose='Walk';b.person.play(pose);b.person.update(dt,speed);Object.assign(b.entry.worldPos,pos);b.entry.quaternion.copy(q);b.last={...pos};b.frameId=frame;
    b.entry.frame=frame==='mars'?this.engine.rootFrame:this.space.moonWorld(frame).frame;
  }
  buildPanel(){this.button=document.createElement('button');this.button.id='multiplayer-button';this.button.textContent='World / crew';
    this.panel=document.createElement('div');this.panel.id='multiplayer-panel';
    guardSheetPress(this.panel);
    const style=document.createElement('style');style.textContent=`#multiplayer-button{position:fixed;left:12px;bottom:120px;z-index:68;min-height:44px;background:#281c12;color:#ffe0b0;border:1px solid #ae8548;border-radius:8px}#multiplayer-panel{position:fixed;left:12px;bottom:170px;z-index:74;padding:14px;background:#18120bf5;color:#ffe0b0;width:min(310px,calc(100vw - 48px));max-height:65vh;overflow:auto;font:12px/1.5 monospace;border:1px solid #ae8548;border-radius:10px}#multiplayer-panel button,#multiplayer-panel input{min-height:44px;margin:3px;color:#ffe0b0;background:#382817;border:1px solid #ae8548;border-radius:6px} @media(max-width:520px){#multiplayer-button{top:auto;bottom:170px}#multiplayer-panel{top:150px;max-height:55vh}}`;
    style.textContent+=`#multiplayer-panel{box-sizing:border-box;touch-action:pan-y;overscroll-behavior:contain}#multiplayer-panel .world-heading{position:sticky;top:-14px;background:#18120b;display:flex;justify-content:space-between;align-items:center;z-index:1}#multiplayer-panel .world-close{min-width:44px} @media(max-width:520px){#multiplayer-panel{top:68px;bottom:auto;left:10px;width:calc(100vw - 20px);max-height:calc(100dvh - 90px)}}`;
    document.head.append(style);document.body.append(this.button,this.panel);this.panel.hidden=true;this.button.onclick=()=>{this.panel.hidden=!this.panel.hidden;this.draw();};
    window.addEventListener('keydown',e=>{if(e.code==='Escape')this.panel.hidden=true;});
  }
  draw(){this.button.textContent=this.world.connected?'World / crew':'World disconnected';if(this.panel.hidden||this.panel.dataset.pressed||this.panel.contains(document.activeElement)&&document.activeElement.tagName==='INPUT')return;const scroll=this.panel.scrollTop;this.panel.replaceChildren();
    const heading=document.createElement('div');heading.className='world-heading';heading.textContent='World / crew';
    const close=document.createElement('button');close.className='world-close';close.textContent='✕';close.setAttribute('aria-label','Close world / crew');close.onclick=()=>this.panel.hidden=true;heading.append(close);this.panel.append(heading);
    const s=this.world.snapshot,p=s.players[this.world.playerId],owned=s.ships[p.shipId];
    const text=t=>{const e=document.createElement('p');e.textContent=t;this.panel.append(e);};
    const btn=(t,a)=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>this.request(a);this.panel.append(b);};
    text(`Shared world · ${Object.values(s.players).filter(p=>p.online).length} here. Your ${owned.type}: pad ${owned.pad.number}.`);
    const name=document.createElement('input');name.value=p.name;name.setAttribute('aria-label','Player name');name.maxLength=32;this.panel.append(name);
    const save=document.createElement('button');save.textContent='Save name';save.onclick=()=>{this.world.identity.name=name.value;localStorage.setItem(this.world.identity.slot||'cosmos-device-v2',JSON.stringify(this.world.identity));this.request({type:'rename',name:name.value});};this.panel.append(save);
    if(!this.world.connected){text('The shared world keeps running while you are away.');const solo=document.createElement('button');solo.textContent='Play my saved solo world';solo.onclick=()=>{const u=new URL(location.href);u.searchParams.set('solo','1');location.href=u.href;};this.panel.append(solo);}
    btn(owned.crewMayBoard?'Close guest boarding':'Allow crew to board',{type:'boarding-permission',allowed:!owned.crewMayBoard});
    text('Walk onto a lowered ramp to board. Walk back down it to leave. Guest ramps work when their owner allows boarding.');
    this.fleetView.panel(s,p,text,btn);
    text('Hiring: walk to the crew hall door, north of the main pad. Candidates come outside when called.');
    for(const c of Object.values(s.pool).filter(c=>!c.shipId&&!c.retired)){text(`${c.name} · ${c.role} · ${Math.round(c.skill*100)}% · ${c.wageCredits} cr/sol`);
      if(c.status==='inside')btn('Meet '+c.name,{type:'meet',id:c.id});else if(c.status==='waiting'){btn('Hire '+c.name,{type:'hire',id:c.id});btn('Decline',{type:'decline',id:c.id});}}
    text('Your crew: '+(owned.crew.map(c=>`${c.name} (${c.status}${c.unpaid?', unpaid':''})`).join(', ')||'none'));
    this.panel.scrollTop=scroll;
  }
  /** Run the lift between snapshots with its own rules (the instance's tick is stubbed so nothing else moves it), carrying a rider by the same step. */
  predictElevator(dt){const e=this.port.elevator;if(!e||e.phase==='open'&&e.open>=1&&e.y===e.target)return;
    const loc=this.site.toLocal(this.walker.worldPos),x=loc.x+60,z=loc.z+39,oldY=e.y;
    const sill=!this.ship.aboard&&Math.abs(x)<.9&&Math.abs(z-.35)<.4&&Math.abs(loc.y-oldY)<.3;
    const rider=!this.ship.aboard&&e.contains(x,z)&&Math.abs(loc.y-oldY)<.4;
    const dy=Object.getPrototypeOf(e).tick.call(e,dt,sill);
    if(dy&&rider)for(const k of ['x','y','z'])this.walker.worldPos[k]+=this.site.up[k]*dy;
    if(dy||e.phase!=='moving')this.port.updateElevatorVisuals();}
  tick(dt){this.shopView?.update(dt);this.smoothActiveShip();if(this.correction&&!this.boardPending&&!this.vehicles?.seated?.()){const pos=this.ship.aboard?this.ship.sw:this.walker.worldPos;const candidate={x:pos.x,y:pos.y,z:pos.z},delta={...this.correction};reconcile(candidate,delta,dt);if(!this.ship.aboard||this.ship.sw.canStand(candidate.x,candidate.y,candidate.z)){Object.assign(pos,candidate);this.correction=delta;}}this.accum+=dt;this.predictElevator(dt);this.updateBodies(dt);this.button.style.bottom=this.ship.aboard?'190px':'120px';if(this.accum>=.1){this.accum=0;this.sendPose();
    if(this.ship.remoteFireWanted&&this.ship.def.seatGun[this.ship.seat?.id]){const direction=new THREE.Vector3(0,0,-1).applyQuaternion(this.engine.camera.quaternion);
      this.world.request({type:'fire-gun',direction:{x:direction.x,y:direction.y,z:direction.z}});}}}
}
