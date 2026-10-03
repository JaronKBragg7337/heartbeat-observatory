import * as THREE from 'three';
import { OpeningModel, freshOpening, CONTACTS, OPENING_SECONDS } from './state.js';
import { passengerCabin, rescueRover, supplyCrate, stormSky, driftingDust } from './art.js';
import { ShipWalker, shipIndexFor } from '../ship/shipWalker.js';
import { LocalPatch, installTierDiscard } from '../world/planetMesh.js';
import { EditedTerrain, installCoverDiscard } from '../world/excavation.js';
import { Kit } from '../ship/shipKit.js';
import { shipDef } from '../ships/registry.js';
import { visualsFor } from '../ships/visuals.js';
import { detachBodyEdits } from '../world/field.js';
import { OpeningLook } from './look.js';
import { WRECK_Y } from './freighterHull.js';
import { bindActivation } from '../ui/activation.js';
import { surveyOpeningVehicle, ridePose } from './rideVehicle.js';
import { writeOpeningCheckpoint } from './checkpoint.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function seatPerson(person,headHeight){return person.ready.then(p=>{
  if(!p.loaded)return p;if(p.safe){p.group.position.y=headHeight-1.61;return p;}
  let head;p.group.traverse(o=>{if(o.isBone&&/(^|[:_])head$/i.test(o.name))head=o;});
  if(head){p.group.updateWorldMatrix(true,true);const local=p.group.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
    // The exported Sit clip lowers its root; place that pose on the actual cushion.
    p.group.position.y=headHeight-local.y;
  }return p;
});}
export class Opening {
  constructor({engine,world,ship,people,port,tier,onFinish}){
    Object.assign(this,{engine,world,ship,people,port,tier,onFinish});const buildStart=performance.now();
    this.active=!!world.state.opening&&!world.state.opening.complete;
    this.state=structuredClone(world.state.opening||freshOpening());this.accum=0;this.pending=Promise.resolve();this.busy=false;
    this.film=false;this.elapsed=this.state.elapsed;this.rideSeconds=this.state.rideSeconds;
    this.contactSeconds=this.state.contactSeconds||0;
    if(!this.active)return;
    this.model=new OpeningModel(this.state,world.playerId||'local');this.low=tier==='low';
    this.mainScene=engine.scene;this.mainOverlays=engine.overlayScenes;this.beforeTracks=new Set(engine._tracked);
    engine.scene=this.scene=new THREE.Scene();engine.overlayScenes=[];
    this.scene.userData.privateOpening=true;
    this.scene.background=new THREE.Color(0x28272b);this.scene.fog=new THREE.FogExp2(0x594b46,.00013);
    const f=this.model.frame;
    this.q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3().copy(f.right),new THREE.Vector3().copy(f.up),new THREE.Vector3().copy(f.back)));
    this.root=new THREE.Group();this.scene.add(this.root);
    engine.track({worldPos:this.model.origin,object3d:this.root,quaternion:this.q});
    const mats=ship.matsInt;
    this.cabin=passengerCabin(mats,this.low,ship.matsExt);this.root.add(this.cabin.root);
    this.sw=new ShipWalker(shipIndexFor({type:'opening-passenger',layout:this.cabin.layout}));
    this.sw.place(this.state.pose.x,this.state.pose.y,this.state.pose.z,this.state.pose.yaw);this.sw.pitch=this.state.pose.pitch;
    this.dust=driftingDust(this.low);this.cabin.root.add(this.dust);
    this.sky=stormSky(this.low);this.root.add(this.sky.mesh);
    this.rover=surveyOpeningVehicle(mats,this.tier);this.root.add(this.rover.root);
    this.rover.root.position.set(-7,0,23);this.rover.root.rotation.y=Math.PI*.64;
    this.crate=supplyCrate(mats);this.crate.position.set(4,-.09,20);this.root.add(this.crate);
    this.contact=CONTACTS[this.state.contact];this.driver=people.spawn(this.contact.person);
    this.driver.dress({cloth:this.contact.color});this.driver.group.position.set(this.rover.driverSeat.x,this.rover.driverSeat.y-.42,this.rover.driverSeat.z);
    this.driver.group.rotation.y=Math.PI;this.driver.play('Sit');this.rover.root.add(this.driver.group);
    this.passengers=[];
    for(let i=0;i<(this.low?2:4);i++){
      const p=people.spawn(['isaiah','sunita','walter','aoi'][i]);
      p.group.position.set(i%2?-1.75:1.75,0,i===0?3:.4-Math.floor((i-1)/2)*2.6);
      p.group.rotation.y=Math.PI;p.play('Sit');this.cabin.root.add(p.group);this.passengers.push(p);
    }
    // Load every actor before filming; normal play remains interactive while models stream.
    this.ready=Promise.all([seatPerson(this.driver,2),...this.passengers.map(p=>seatPerson(p,1.22))]);
    this.actorsReady=false;this.ready.then(()=>{this.actorsReady=true;});
    this.cabinEmitters=[];this.cabin.root.traverse(o=>{if(o.isMesh&&o.name.endsWith(':glow')){
      o.material=o.material.clone();this.cabinEmitters.push(o.material);
    }});
    this.hemi=new THREE.HemisphereLight(0xb5bacc,0x492e23,.45);this.hemi.position.copy(f.up);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xffcf9a,1.7);this.sun.position.set(-30,45,-80).applyQuaternion(this.q);this.scene.add(this.sun);
    this.sun.castShadow=!this.low&&!engine.safe;
    this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:180});
    this.sun.shadow.bias=-.0001;this.sun.shadow.normalBias=.025;
    this.lamp=new THREE.PointLight(0xff5133,this.low?15:32,22,1.5);this.lamp.position.set(0,2.7,3);this.cabin.root.add(this.lamp);
    this.cabinFill=new THREE.PointLight(0xc9d8ec,this.low?14:30,25,1.5);this.cabinFill.position.set(0,2.5,-5);this.cabin.root.add(this.cabinFill);
    this.terrain=new EditedTerrain(engine,this.model.body,this.model.edits,{rangeM:35,budgetMs:this.low?2:4});
    this.model.walker.collisionActive=(x,y,z)=>this.terrain.touchedAt(x,y,z);
    this.ground=new LocalPatch(this.model.body,{sizeM:140,res:this.low?81:121,skirtM:6});
    this.ground.rebuild(this.model.origin.x,this.model.origin.y,this.model.origin.z);
    this.scene.add(this.ground.mesh);engine.track({worldPos:this.ground.worldPos,object3d:this.ground.mesh});
    this.cover={value:new THREE.Vector3()};installCoverDiscard(this.ground.mesh.material,this.terrain.cover,this.cover,THREE);
    const far=new LocalPatch(this.model.body,{sizeM:10000,res:this.low?49:81,skirtM:15});
    far.rebuild(this.model.origin.x,this.model.origin.y,this.model.origin.z);
    installTierDiscard(far.mesh.material).update(far.worldPos,this.ground);
    this.scene.add(far.mesh);engine.track({worldPos:far.worldPos,object3d:far.mesh});this.far=far;
    // The same port geometry and material maps, visible at its true distance.
    const portClone=port.root.clone(true);this.scene.add(portClone);
    engine.track({worldPos:port.site.center,object3d:portClone,quaternion:port.quaternion});
    this.portClone=portClone;
    this.buildUI();
    this.look=new OpeningLook(this);
    this.keyboard=e=>{if(!this.active)return;if(e.code==='KeyE'&&!e.repeat){e.preventDefault();this.interact();}
      if(e.code==='KeyQ'&&!e.repeat)this.walkInstead();};
    window.addEventListener('keydown',this.keyboard);
    this.audioStart=()=>this.startAudio();window.addEventListener('pointerdown',this.audioStart,{once:true});window.addEventListener('keydown',this.audioStart,{once:true});
    this.hideMainUI=true;document.body.dataset.opening='active';
    this.stage=this.state.stage;this.placeStage();
    this.pageHide=()=>{this.checkpoint(true);this.savePose();};window.addEventListener('pagehide',this.pageHide);
    this.buildMs=Math.round(performance.now()-buildStart);
    this.visibility=()=>{if(document.hidden)this.pageHide();};document.addEventListener('visibilitychange',this.visibility);
  }
  buildUI(){
    this.style=document.createElement('style');this.style.textContent=`
      body[data-opening="active"] > .btn,body[data-opening="active"] #hud,body[data-opening="active"] #settings-panel,
      body[data-opening="active"] #crew-panel,body[data-opening="active"] #space-panel,
      body[data-opening="active"] #economy-purse,body[data-opening="active"] #key-controls{display:none!important}
      body[data-opening="active"] #multiplayer-button,body[data-opening="active"] #multiplayer-panel,
      body[data-opening="active"] #crew-ui{display:none!important}
      #opening-ui{position:fixed;inset:0;pointer-events:none;z-index:100;font:14px/1.6 system-ui,sans-serif;color:#ece4d9}
      #opening-caption{position:absolute;bottom:calc(110px + env(safe-area-inset-bottom));left:12%;right:12%;text-align:center;text-shadow:0 2px 5px #000}
      #opening-hint{position:absolute;top:calc(18px + env(safe-area-inset-top));left:20px;font-size:12px;color:#e5d2bd}
      #opening-action,#opening-walk,#opening-skip{pointer-events:auto;position:absolute;min-height:48px;border:1px solid #c7b29666;border-radius:6px;background:#151313bf;color:#f1e2d0;padding:12px 18px;font:13px system-ui;cursor:pointer}
      #opening-action{bottom:calc(24px + env(safe-area-inset-bottom));right:20px}
      #opening-walk{bottom:calc(24px + env(safe-area-inset-bottom));right:180px}
      #opening-skip{top:16px;right:18px}#opening-fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
      body[data-opening-film="true"] #opening-caption,body[data-opening-film="true"] #opening-hint,
      body[data-opening-film="true"] #opening-ui button{visibility:hidden}
      @media(max-width:600px){#opening-caption{font-size:13px;left:6%;right:6%;bottom:100px}}
    `;document.head.appendChild(this.style);
    this.ui=document.createElement('div');this.ui.id='opening-ui';
    this.ui.innerHTML='<div id="opening-fade"></div><div id="opening-hint"></div><div id="opening-caption" aria-live="polite"></div><button id="opening-action"></button><button id="opening-walk">Walk (Q)</button><button id="opening-skip">Skip intro</button>';
    document.body.appendChild(this.ui);this.caption=this.ui.querySelector('#opening-caption');this.hint=this.ui.querySelector('#opening-hint');
    this.action=this.ui.querySelector('#opening-action');this.walkButton=this.ui.querySelector('#opening-walk');this.fade=this.ui.querySelector('#opening-fade');
    this.skip=this.ui.querySelector('#opening-skip');this.skip.hidden=!this.state.played;
    bindActivation(this.action,()=>this.interact());bindActivation(this.walkButton,()=>this.walkInstead());
    bindActivation(this.skip,()=>this.useAction(()=>this.command({type:'opening-skip'})));
  }
  startAudio(){if(this.audio||!this.active)return;const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    const ctx=new C(),gain=ctx.createGain(),rumble=ctx.createOscillator(),alarm=ctx.createOscillator(),alarmGain=ctx.createGain();
    gain.gain.value=.025;gain.connect(ctx.destination);rumble.type='triangle';rumble.frequency.value=42;rumble.connect(gain);rumble.start();
    alarm.type='sine';alarm.frequency.value=650;alarmGain.gain.value=0;alarm.connect(alarmGain);alarmGain.connect(ctx.destination);alarm.start();
    this.audio={ctx,gain,rumble,alarm,alarmGain};ctx.resume().catch(()=>{});
  }
  syncFilm(hidden=true){this.film=hidden;document.body.dataset.openingFilm=String(hidden);document.body.dataset.cosmosFilm=String(hidden);
    if(!document.getElementById('cosmos-film-style')){const style=document.createElement('style');style.id='cosmos-film-style';
      style.textContent='body[data-cosmos-film="true"] > :not(canvas):not(#opening-ui):not(.opening-transition){visibility:hidden}';document.head.appendChild(style);}
    return this;
  }
  placeStage(){const s=this.state;
    if(s.stage===1){this.sw.place(s.pose.x,s.pose.y,s.pose.z,s.pose.yaw);this.sw.pitch=s.pose.pitch;}
    if(s.stage>=2)this.model.place(s.pose);
    if(s.stage===0){this.sw.yaw=0;this.sw.pitch=0;this.cabin.root.position.set(0,1500,0);}
  }
  pose(){return this.state.stage===1?{x:this.sw.x,y:this.sw.y,z:this.sw.z,yaw:this.sw.yaw,pitch:this.sw.pitch}:this.state.stage===0?this.state.pose:this.model.pose();}
  checkpoint(force=false){if(!this.active||this.world.remote||!force&&performance.now()<(this.nextCheckpoint||0))return;
    this.nextCheckpoint=performance.now()+150;writeOpeningCheckpoint(this.world,{...this.state,pose:this.pose(),
    elapsed:this.elapsed,rideSeconds:this.rideSeconds,contactSeconds:this.contactSeconds});}
  savePose(seconds=this.accum){if(!this.active||this.busy)return this.pending;this.accum=0;
    return this.command({type:'opening-pose',pose:this.pose(),seconds:Math.min(2,seconds)},false);}
  command(a,show=true){
    this.busy=true;
    const task=async()=>{
      let r;
      try{
        if(this.world.remote){r=await this.world.request(a);if(r.opening){
          const count=this.state.cuts.length,pose=this.model.pose();Object.assign(this.state,r.opening);
          for(const cut of this.state.cuts.slice(count))this.model.cut(cut,false);
          this.model.place(pose);
        }}else {r=this.model.act(a);this.world.state.opening=structuredClone(this.state);this.world.state.shipType='courier';
          await this.world.persist();await this.world.flush();}
        if(!r.ok){this.status=r.msg||'Wait for the shared world.';this.statusUntil=this.elapsed+6;return r;}
        if(this.stage!==this.state.stage){this.stage=this.state.stage;this.accum=0;this.placeStage();}
        if(this.state.complete)this.finish(r.arrivalPose);
        return r;
      }catch(e){this.status=e.message;this.statusUntil=this.elapsed+6;return {ok:false,msg:e.message};}
    };
    this.pending=this.pending.then(task).finally(()=>{this.busy=false;this.checkpoint(true);});return this.pending;
  }
  async useAction(run){if(this.actionPending||!this.active)return;this.actionPending=true;
    try{await this.pending;if(!this.active)return;return await run();}finally{this.actionPending=false;}}
  interact(){return this.useAction(()=>this._interact());}
  async _interact(){
    await this.savePose(Math.max(this.accum,.1));const s=this.state;
    if(s.stage===1&&this.sw.z>12)return this.command({type:'opening-next'});
    if(s.stage===2){if(this.model.exposed())return this.command({type:'opening-carry'});return this.command({type:'opening-dig'});}
    if(s.stage===3)return this.command({type:'opening-ride'});
  }
  walkInstead(){return this.useAction(async()=>{if(this.state.stage!==3||this.state.contactSeconds<8)return;
    await this.savePose();return this.command({type:'opening-walk'});});}
  frame(dt,input,look){
    if(!this.active)return false;const s=this.state,m=this.model,e=this.engine;
    const disconnected=this.world.remote&&!this.world.connected;
    if(disconnected){dt=0;input={};}
    if(s.stage===0&&!this.actorsReady)dt=0;
    this.elapsed+=dt;if(s.stage===4&&s.ride)this.rideSeconds+=dt;
    if(s.stage===3)this.contactSeconds+=dt;this.accum+=dt;
    this.skip.hidden=!s.played;this.walkButton.hidden=s.stage!==3||s.contactSeconds<8;
    let actionLabel='';
    this.action.disabled=this.walkButton.disabled=this.skip.disabled=!!this.actionPending||disconnected;
    this.driver.update(dt);for(const p of this.passengers)p.update(dt);
    this.hemi.intensity=s.stage<2?.22:.7;this.sun.intensity=s.stage<2?.08:1.7;
    this.sky.uniforms.time.value=this.elapsed;this.sky.uniforms.strength.value=s.stage===0?clamp((this.elapsed-12)/12,.1,1):.65;
    this.dust.visible=s.stage>=1;this.dust.rotation.y=Math.sin(this.elapsed*.03)*.03;
    this.dust.material.opacity=.15+Math.sin(this.elapsed*.1)*.035;
    const motes=this.dust.geometry.attributes.position,seed=this.dust.userData.seed;
    for(let i=0;i<motes.count;i++)motes.setXYZ(i,seed[i*3]+Math.sin(this.elapsed*.2+i)*.14,
      (seed[i*3+1]+this.elapsed*.04)%3.3,(seed[i*3+2]+12+this.elapsed*.07)%32-12);
    motes.needsUpdate=true;
    this.rover.root.visible=s.stage>=3;
    if(s.stage===3){const t=clamp(this.contactSeconds/8,0,1),ease=1-(1-t)**3;
      this.rover.root.position.set(-7-(1-ease)*90,0,23+(1-ease)*20);
      this.rover.root.rotation.y=Math.atan2(-90,20);
      for(const w of this.rover.wheels)w.rotation.x+=dt*(1-t)*18;
    }
    this.cabin.root.visible=s.stage<4||!s.ride&&Math.hypot(s.pose.x,s.pose.z)<90;
    this.caption.textContent='';this.hint.textContent='';
    let eye,forward,up=new THREE.Vector3(0,1,0),local=true;
    if(s.stage===0){
      const t=this.elapsed,descent=clamp(t/44,0,1);
      this.cabin.root.position.set(0,1500*(1-descent)**2+1, -800*(1-descent));
      this.cabin.root.rotation.set(Math.sin(t*.35)*.01,0,t>23?Math.sin(t*.9)*clamp((t-23)/200,0,.09):.012);
      this.sw.yaw+=look.dx;this.sw.pitch=clamp(this.sw.pitch-look.dy,-.85,.75);
      this.sw.yaw=clamp(this.sw.yaw,-1.2,1.2);
      eye=new THREE.Vector3(-1.75,1.24,3.1);forward=new THREE.Vector3(Math.sin(this.sw.yaw),Math.sin(this.sw.pitch),-Math.cos(this.sw.yaw));
      this.cabin.root.updateMatrix();eye.applyMatrix4(this.cabin.root.matrix);forward.transformDirection(this.cabin.root.matrix);up.transformDirection(this.cabin.root.matrix);
      this.caption.textContent=t<7?'':t<15?'Port control: inbound passenger service, approach approved.':t<23?'Cabin crew: keep your harness fastened.':t<30?'Flight deck: port control, do you read?':t<38?'Flight deck: guidance lost. Brace.':'';
      this.fade.style.opacity=String(t<3?1-t/3:t>43?clamp((t-43)/3,0,1):0);
      if(!this.actorsReady){this.fade.style.opacity='1';this.caption.textContent='Preparing the opening…';}
      this.cabinFill.intensity=t>23?1:(this.low?14:30);
      for(const mat of this.cabinEmitters)mat.color.setScalar(t>23?.08:1);
      this.lamp.intensity=t>24?(Math.sin(t*7)>.2?25:3):0;
      if(this.audio){this.audio.alarmGain.gain.setTargetAtTime(t>25&&t<44?(Math.sin(t*5)>0?.025:.002):0,this.audio.ctx.currentTime,.05);this.audio.rumble.frequency.value=42+descent*26;}
      if(t>=OPENING_SECONDS&&!this.busy){this.savePose().then(()=>this.command({type:'opening-next'}));}
    }else if(s.stage===1){
      this.fade.style.opacity=String(clamp(1-(this.elapsed-OPENING_SECONDS)/3,0,1));
      this.cabin.root.position.set(0,WRECK_Y,0);this.cabin.root.rotation.set(.015,0,.105);
      this.sw.yaw+=look.dx;this.sw.pitch=clamp(this.sw.pitch-look.dy,-1.4,1.3);
      this.sw.tick(dt,{moveX:input.moveEast,moveZ:input.moveNorth,run:input.run,jump:input.jump});
      eye=new THREE.Vector3().copy(this.sw.eyeLocal());forward=new THREE.Vector3(Math.sin(this.sw.yaw)*Math.cos(this.sw.pitch),Math.sin(this.sw.pitch),-Math.cos(this.sw.yaw)*Math.cos(this.sw.pitch));
      this.cabin.root.updateMatrix();eye.applyMatrix4(this.cabin.root.matrix);forward.transformDirection(this.cabin.root.matrix);up.transformDirection(this.cabin.root.matrix);
      this.lamp.intensity=12+Math.sin(this.elapsed*6)*3;this.cabinFill.intensity=4;
      for(const mat of this.cabinEmitters)mat.color.setScalar(.08);
      this.hint.textContent='Move: WASD / left thumb · Look: mouse / right thumb';
      if(this.sw.z>12)actionLabel='Climb out (E)';
    }else{
      this.fade.style.opacity='0';this.cabin.root.position.set(0,WRECK_Y,0);this.cabin.root.rotation.set(.015,0,.105);
      if(s.stage===4&&s.ride){this.rover.seatPlayer();
        this.fade.style.opacity=String(clamp((this.rideSeconds-64)/2,0,1));
        const rp=ridePose(this.rideSeconds,m.height);
        this.rover.root.position.set(rp.x,rp.y+.03*Math.sin(this.elapsed*6),rp.z);
        this.rover.root.rotation.y=THREE.MathUtils.lerp(Math.atan2(-90,20),Math.atan2(2593,373),clamp(this.rideSeconds/6,0,1));
        for(const w of this.rover.wheels)w.rotation.x+=dt*12;
        const p=this.rover.root.position;m.place({...s.pose,x:p.x,y:p.y,z:p.z});
        eye=new THREE.Vector3().copy(this.rover.passengerEye);this.rover.root.updateMatrix();eye.applyMatrix4(this.rover.root.matrix);
        this.rideYaw=(this.rideYaw||0)+look.dx;this.ridePitch=clamp((this.ridePitch||0)-look.dy,-1,1);
        forward=new THREE.Vector3(Math.sin(this.rideYaw)*Math.cos(this.ridePitch),Math.sin(this.ridePitch),-Math.cos(this.rideYaw)*Math.cos(this.ridePitch)).transformDirection(this.rover.root.matrix);
        this.caption.textContent=this.rideSeconds<9?`${this.contact.name}: ${this.contact.faction}. We saw you come down.`:this.rideSeconds<20?'The port is neutral. You can find work there.':this.rideSeconds>52?'The passenger line has a settlement waiting for you.':'';
        if(this.rideSeconds>=66&&!this.busy)this.savePose().then(()=>this.command({type:'opening-finish'}));
      }else{
        m.walker.yaw+=look.dx;m.walker.pitch=clamp(m.walker.pitch-look.dy,-1.4,1.3);m.walker.tick(dt,input);
        const p=m.pose();
        // The exterior pressure hull is solid after leaving its interior walker.
        if(p.y<3.9&&p.z> -17&&p.z<14&&Math.abs(p.x)<3.6){
          const moves=[{x:3.6-p.x,z:0},{x:-3.6-p.x,z:0},{x:0,z:14-p.z},{x:0,z:-17-p.z}];
          moves.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));p.x+=moves[0].x;p.z+=moves[0].z;m.place(p);
        }
        // Solid vehicle footprint; the passenger approaches its boarding side.
        if(s.stage>=3){
          const rv=this.rover.root,dx=p.x-rv.position.x,dz=p.z-rv.position.z,c=Math.cos(rv.rotation.y),v=Math.sin(rv.rotation.y);
          const x=c*dx-v*dz,z=v*dx+c*dz;
          if(Math.abs(x)<1.7&&Math.abs(z)<2.5){
            const moves=[{x:1.7-x,z:0},{x:-1.7-x,z:0},{x:0,z:2.5-z},{x:0,z:-2.5-z}];
            moves.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));const d=moves[0];
            p.x+=c*d.x+v*d.z;p.z+=-v*d.x+c*d.z;m.place(p);
          }
        }
        eye=new THREE.Vector3().copy(m.walker.eyeWorldPos());forward=new THREE.Vector3().copy(m.digger.lookDir());up.copy(m.walker.updateFrame().up);local=false;
        if(s.stage===2){const d=Math.hypot(p.x-4,p.z-20);this.hint.textContent='Walk · Look · Use (E / touch)';
          this.caption.textContent=d>4?'Something lies beneath the collapsed dust.':this.model.exposed()?'Lift the cleared supply crate.':'Aim the shovel at the dust around the crate.';
          if(d<4)actionLabel=this.model.exposed()?'Carry (E)':'Dig (E)';
        }else if(s.stage===3){this.caption.textContent=this.contactSeconds<8?'A vehicle is approaching.':`${this.contact.name}: Need a lift? You can ride with me, or follow the port lights.`;
          if(s.contactSeconds>=8&&Math.hypot(p.x+7,p.z-23)<5)actionLabel='Ride (E)';}
        else if(s.stage===4){this.hint.textContent='Follow the port lights';if(Math.hypot(p.x+2600,p.z+350)<100&&!this.busy)this.savePose().then(()=>this.command({type:'opening-finish'}));}
      }
      if(s.carriedCrate&&s.stage===4&&s.ride){this.crate.position.set(0,1.62,1.15).applyMatrix4(this.rover.root.matrix);this.crate.rotation.y=this.rover.root.rotation.y;}
      else if(s.carriedCrate){this.crate.position.copy(local?eye:this.localPoint(eye));
        const dir=local?forward:forward.clone().applyQuaternion(this.q.clone().invert());this.crate.position.addScaledVector(dir,.72);this.crate.position.y-=.65;
      }
      this.terrain.update(dt,m.walker.worldPos);this.terrain.coverOffsetFor(this.ground.worldPos,this.cover);
    }
    if(local){const wp=m.toWorld(eye.x,eye.y,eye.z);Object.assign(e.cameraWorldPos,wp);forward.applyQuaternion(this.q);up.applyQuaternion(this.q);}
    else Object.assign(e.cameraWorldPos,eye);
    e.camera.up.copy(up);e.camera.lookAt(forward);
    if(s.stage!==0&&this.audio)this.audio.alarmGain.gain.setTargetAtTime(0,this.audio.ctx.currentTime,.2);
    if(disconnected)this.caption.textContent='Shared world disconnected. Reconnecting…';
    else if(this.statusUntil>this.elapsed)this.caption.textContent=this.status;
    this.action.hidden=!actionLabel;if(this.action.textContent!==actionLabel)this.action.textContent=actionLabel;
    this.checkpoint();
    this.look.frame(dt,s,this.elapsed);
    this.checkpoint();
    if(this.accum>=1&&!this.busy)this.savePose();
    return true;
  }
  localPoint(p){return new THREE.Vector3().copy(this.model.toLocal(p));}
  finish(pose){if(!this.active)return;this.active=false;const e=this.engine;
    const transition=document.createElement('div');transition.className='opening-transition';
    transition.style.cssText='position:fixed;inset:0;background:#000;pointer-events:none;z-index:101';document.body.appendChild(transition);
    transition.animate([{opacity:1},{opacity:0}],{duration:1600,easing:'ease-out',fill:'forwards'}).finished.then(()=>transition.remove());
    e.scene=this.mainScene;e.overlayScenes=this.mainOverlays;
    for(const t of [...e._tracked])if(!this.beforeTracks.has(t))e._tracked.delete(t);
    this.look?.dispose();this.look=null;this.ui.remove();this.style.remove();delete document.body.dataset.opening;delete document.body.dataset.openingFilm;
    window.removeEventListener('keydown',this.keyboard);window.removeEventListener('pagehide',this.pageHide);
    document.removeEventListener('visibilitychange',this.visibility);
    window.removeEventListener('pointerdown',this.audioStart);window.removeEventListener('keydown',this.audioStart);
    if(this.audio)this.audio.ctx.close().catch(()=>{});
    // Geometry is ours; material maps and Loft mesh buffers are shared with the main game.
    const borrowed=new Set();for(const p of [...this.passengers,this.driver])p.group.traverse(o=>{if(o.isMesh)borrowed.add(o.geometry);});
    this.portClone.traverse(o=>{if(o.isMesh)borrowed.add(o.geometry);});
    this.scene.traverse(o=>{if(o.isMesh||o.isPoints)if(!borrowed.has(o.geometry))o.geometry.dispose();});
    this.terrain.cover.tex.dispose();this.terrain.material.dispose();this.sky.mesh.material.dispose();this.dust.material.map?.dispose();this.dust.material.dispose();detachBodyEdits(this.model.body.id);
    for(const mat of this.cabinEmitters)mat.dispose();
    this.world.state.opening={...this.state,complete:true,played:true};
    writeOpeningCheckpoint(this.world,this.world.state.opening);
    try{localStorage.setItem('cosmos-opening-played','1');}catch{}
    this.onFinish(pose);
    for(const p of [...this.passengers,this.driver]){p.mixer?.stopAllAction();p.group.traverse(o=>{
      for(const mat of (Array.isArray(o.material)?o.material:[o.material]))if(mat?.userData.lookSrc)mat.dispose();
    });}
    this.scene.clear();this.ready=null;this.passengers=[];
    for(const key of ['root','cabin','sw','driver','rover','crate','model','terrain','ground','far','portClone','portLights','sky','dust'])this[key]=null;
  }
}
