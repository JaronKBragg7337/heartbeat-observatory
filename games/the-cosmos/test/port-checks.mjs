// Integration checks against the port's volume, built geometry and real walkers.
export async function runPortChecks({check,section,THREE,mars,FIELD,Walker,Registry}) {
  const {createPortSite,PADS,BUILDINGS,NPC_SPOTS}=await import('../src/port/portSpec.js');
  const {PortSystem}=await import('../src/port/portSystem.js');
  const {ShipSystem}=await import('../src/ship/shipSystem.js');
  const {GEAR,RAMPS,PANELS,WALL_SCREENS,buildLayout,propBox}=await import('../src/ship/shipSpec.js');
  const {rampEntry}=await import('../src/ship/rampTransfer.js');
  const {makePortTour}=await import('../src/port/portTour.js');
  const {EditStore}=await import('../src/world/edits.js');
  const {buildExterior,applyNeutralPose}=await import('../src/ship/shipExterior.js');
  const {makeShipMaterials}=await import('../src/ship/shipTextures.js');
  const {DroneSystem}=await import('../src/ship/guns.js');
  section('10. Marineris Port: earthworks, landing and continuous ramp handoffs');
  const site=createPortSite(mars);
  const natural=[];
  for(let x=site.halfWidth;x<=site.halfWidth+site.gradeM+4;x+=2) {
    const p=site.toWorld(x,0,15),r=Math.hypot(p.x,p.y,p.z);
    natural.push({x,r:FIELD.surfaceRadiusFast(mars,p.x/r,p.y/r,p.z/r)});
  }
  FIELD.attachGrades([site]);
  const ground=(x,y,z)=>FIELD.surfaceRadiusFast(mars,x,y,z);
  const dens=(x,y,z)=>{const p=site.toWorld(x,y,z);return FIELD.density(mars,p.x,p.y,p.z);};
  try {
    let worst=0,thick=true;
    for(const a of PADS) for(let x=-a.w/2;x<=a.w/2;x+=1) for(let z=-a.d/2;z<=a.d/2;z+=1) {
      const p=site.toWorld(a.x+x,0,a.z+z),r=Math.hypot(p.x,p.y,p.z),sr=ground(p.x/r,p.y/r,p.z/r);
      const q=site.toLocal({x:p.x*sr/r,y:p.y*sr/r,z:p.z*sr/r}); worst=Math.max(worst,Math.abs(q.y));
      if(dens(a.x+x,-10,a.z+z)>=0)thick=false;
    }
    check('all three pads are flat in the density field to within 2 cm',worst<.02,`${worst} m`);
    check('pads are a solid volume with at least 10 m of engineered ground beneath them',thick);
    check('concrete belongs to the field, including its full half-metre thickness',PADS.every(a=>{
      const p=site.toWorld(a.x,-.4,a.z);return FIELD.materialAt(mars,p.x,p.y,p.z).id==='MAT-PORT-CONCRETE';}));
    const store=new EditStore(mars),cut=site.toWorld(0,-.1,0);
    const lot=store.dig(cut.x,cut.y,cut.z,.15);
    check('a scoop shovel cannot cut structural pavement or lose concrete mass',lot===null&&store.edits.length===0&&store.ledger().unaccountedM3===0);
    let slope=0,maxSlope=0,last=null,depthOK=true,outside=0;
    for(const n of natural) {
      const p=site.toWorld(n.x,0,15),r=Math.hypot(p.x,p.y,p.z),sr=ground(p.x/r,p.y/r,p.z/r);
      const q=site.toLocal({x:p.x*sr/r,y:p.y*sr/r,z:p.z*sr/r});
      if(last!=null){slope=(q.y-last)/2;maxSlope=Math.max(maxSlope,Math.abs(slope));} last=q.y;
      const below=site.toWorld(q.x,q.y-2,q.z); if(FIELD.density(mars,below.x,below.y,below.z)>=0)depthOK=false;
      if(n.x>=site.halfWidth+site.gradeM)outside=Math.max(outside,Math.abs(sr-n.r));
    }
    // Natural ridged noise has creases; only the engineered seams must have a
    // matching derivative. Do not mistake a natural ridge for an apron seam.
    let seams=true;
    for(const edge of [site.halfWidth,site.halfWidth+site.gradeM]) {
      const ys=[-.01,0,.01].map(dx=>{const p=site.toWorld(edge+dx,0,15),r=Math.hypot(p.x,p.y,p.z),sr=ground(p.x/r,p.y/r,p.z/r);return site.toLocal({x:p.x*sr/r,y:p.y*sr/r,z:p.z*sr/r}).y;});
      seams&&=Math.abs((ys[2]-ys[1])-(ys[1]-ys[0]))<.0001&&Math.abs(ys[2]-ys[0])<.02;
    }
    check('graded edge meets natural terrain continuously and has solid ground beneath it',seams&&maxSlope<.65&&depthOK&&outside<.005,`max slope ${maxSlope}, outside ${outside}`);
    const engine={scene:new THREE.Scene(),track:()=>{},camera:new THREE.PerspectiveCamera(),cameraWorldPos:{x:0,y:0,z:0}};
    const registry=new Registry(),port=new PortSystem(engine,registry,site,'low').build();
    check('port, every pad and all six structures have stable registered IDs and measured sizes',registry.all().length===10&&registry.all().every(a=>a.measured&&a.id.startsWith('COS-MARS-')));
    const drift=port.assets.filter(a=>a.authored&&!registry.dimensionDrift(a.id).withinTolerance);
    check('port assets measure within 5 cm of their authored sizes',drift.length===0,JSON.stringify(drift.map(a=>[a.name,a.authored,a.measured])));
    check('phone port costs at most 12 draw calls, 35k triangles and 4 MB of geometry',port.stats.drawCalls<=12&&port.stats.triangles<35000&&port.stats.geometryBytes<4e6,JSON.stringify(port.stats));
    // The production path receives the ship's already-uploaded textures. Test
    // identity with a real texture object even in this headless Node build.
    const {makePortMaterials,textureBytes}=await import('../src/port/portArt.js');
    const shared=makeShipMaterials({tier:'low'}),hullMap=new THREE.Texture();
    shared.hull.map=hullMap;
    const finishes=makePortMaterials('low',shared);
    check('port shares Meridian texture objects and room finishes without duplicating the ship maps',
      finishes.sharedTextures&&finishes.mats.paint.map===hullMap&&finishes.mats.wall===shared['wall:cargo']&&finishes.mats.floor===shared['floor:deck']&&finishes.mats.fabric===shared.fabric);
    const atlasProbe=new THREE.Texture({width:1024,height:512});
    check('texture budget includes RGBA mipmaps and counts shared references once',textureBytes([atlasProbe,atlasProbe])===2796204);
    check('port uses a fixed phone light pool and adds no fixture shadow maps',port.lights.length===2&&port.lights.every(l=>!l.castShadow)&&port.stats.sunShadowDrawCalls<=6);
    check('port pavement and hardware stay within four depth-buffer lift layers',port.depthLayers.maxLayer<=4,JSON.stringify(port.depthLayers));
    check('control tower and depot roof equipment have silhouettes above the old bare shells',
      port.assets.find(a=>a.name==='Port control').measured.height>28&&port.assets.find(a=>a.name==='Supply depot').measured.height>7.5);
    const highPort=new PortSystem({scene:new THREE.Scene(),track:()=>{}},new Registry(),site,'high',shared).build();
    check('high tier remains merged within 12 main calls, 60k triangles and 5 MB of geometry',
      highPort.stats.drawCalls<=12&&highPort.stats.triangles<60000&&highPort.stats.geometryBytes<5e6,JSON.stringify(highPort.stats));
    let footings=true;
    for(const a of BUILDINGS) for(const dx of [-a.w/2+.2,a.w/2-.2]) for(const dz of [-a.d/2+.2,a.d/2-.2]) footings&&=Math.abs(dens(a.x+dx,0,a.z+dz))<.01&&dens(a.x+dx,-.15,a.z+dz)<0;
    check('every structure and prop stands on surveyed solid ground, including every foundation corner',footings&&port.boxes.every(b=>b.y0===0));
    check('built geometry bases meet the ground, with only declared foundations below it',port.assets.every(a=>Math.abs(a.grounding.measuredBase+a.grounding.foundationDepth)<.01));
    const w=new Walker(mars);w.groundSampler=ground;
    const sys=new ShipSystem({engine,registry,body:mars,ground,walker:w,landingSite:site});
    sys.flight.setDown(site.toWorld(0,3.8,0),site.heading);
    for(let i=0;i<540;i++)sys.flight.step(1/60);
    const f=sys.flight;
    check('Meridian settles level on pad 01 with four soles on the field',f.landed&&Math.abs(f.pitch)<1e-8&&Math.abs(f.roll)<1e-8&&f.legs.every(l=>Math.abs(FIELD.density(mars,l.world.x,l.world.y,l.world.z))<.025&&l.contact));
    // Fly, bank, descend onto each pad: this catches a landing fix that only works at spawn.
    let landingOK=true,keelOK=true,geometryOK=true,minHull=Infinity;
    const exterior=buildExterior(buildLayout(),makeShipMaterials({tier:'low'}),{tier:'low'});
    applyNeutralPose(exterior);
    for(const pad of PADS) {
      f.setDown(site.toWorld(pad.x,25,pad.z),site.heading); f.landed=false; f.airborne=true; f.autoHover=true;
      f.pitch=.15;f.roll=-.18;f.controls.lift=-1;
      for(let i=0;i<2400;i++)f.step(1/60);
      landingOK&&=f.landed&&f.hull===100&&f.speed<.05&&f.legs.every(l=>l.contact&&Math.abs(FIELD.density(mars,l.world.x,l.world.y,l.world.z))<.025);
      for(const k of GEAR.keel) {const p=f.toWorld({...k,y:GEAR.keelY});keelOK&&=FIELD.density(mars,p.x,p.y,p.z)>.02;}
      for(let i=0;i<f.legs.length;i++) {
        const l=f.legs[i],leg=exterior.legs[i],length=l.ext-l.comp;
        leg.foot.position.y=-length;leg.piston.scale.y=length+.2;leg.piston.position.y=.2;
      }
      exterior.root.updateMatrixWorld(true);
      exterior.root.traverse(mesh=>{
        if(!mesh.isMesh || mesh.material.blending===THREE.AdditiveBlending)return;
        const pos=mesh.geometry.attributes.position,vec=new THREE.Vector3();
        for(let i=0;i<pos.count;i++) {vec.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);const p=f.toWorld(vec);
          const d=FIELD.density(mars,p.x,p.y,p.z);minHull=Math.min(minHull,d);if(d<-.025)geometryOK=false;}
      });
    }
    check('a banked approach lands on every pad with all four feet touching and no damage',landingOK);
    check('every keel support remains in open air after every landing',keelOK);
    check('every built exterior vertex, including rubber soles and ventral guns, clears the field after landing',geometryOK,`lowest clearance ${minHull}`);
    f.setDown(site.toWorld(0,3.8,0),site.heading);f.controls.lift=0;
    for(let i=0;i<540;i++)f.step(1/60);
    sys.state.ramps.cargo.lowered=true;sys.state.ramps.airlock.lowered=true;
    sys._solveRamp('cargo');sys._solveRamp('airlock');
    let rounds=true,maxShift=0,loops=0;
    for(const key of ['cargo','airlock']) for(let repeat=0;repeat<3;repeat++) {
      const r=RAMPS[key],st=sys.state.ramps[key],run=r.length*Math.cos(st.angle);
      const yaw=key==='cargo'?0:Math.PI/2;
      const tip={x:r.hinge.x+r.dir.x*(run+.06),y:r.hinge.y-r.length*Math.sin(st.angle)+.02,z:r.hinge.z+r.dir.z*(run+.06)};
      Object.assign(w.worldPos,f.toWorld(tip));w.yaw=f.heading+yaw;w.pitch=0;w.velocity={x:0,y:0,z:0};w.grounded=true;sys.aboard=false;
      let enter=false;
      for(let i=0;i<60;i++) {
        const before={...w.worldPos};sys._outsideFrame(1/60,{moveNorth:1,moveEast:0});
        if(sys.aboard) { const p=f.toWorld({x:sys.sw.x,y:sys.sw.y,z:sys.sw.z});maxShift=Math.max(maxShift,Math.hypot(p.x-before.x,p.y-before.y,p.z-before.z));enter=true;break; }
        w.tick(1/60,{moveNorth:1});
      }
      rounds&&=enter&&!!sys.sw.canStand(sys.sw.x,sys.sw.y,sys.sw.z);
      for(let i=0;i<220;i++)sys._personFrame(1/60,{moveNorth:1,moveEast:0});
      rounds&&=sys.aboard&&sys.sw.grounded;
      let exit=false;
      for(let i=0;i<450;i++) {sys._personFrame(1/60,{moveNorth:-1,moveEast:0});if(!sys.aboard){exit=true;break;}}
      rounds&&=exit;
      for(let i=0;i<180;i++) {sys._outsideFrame(1/60,{moveNorth:-1,moveEast:0});if(sys.aboard){loops++;break;}w.tick(1/60,{moveNorth:-1});}
      rounds&&=FIELD.density(mars,w.worldPos.x,w.worldPos.y,w.worldPos.z)>=0;
    }
    check('cargo and airlock ramps support three boarding/walking/unboarding round trips each',rounds);
    check('ramp handoffs shift the feet by under 5 cm and never reboard while walking away',maxShift<.05&&loops===0,`shift ${maxShift}, loops ${loops}`);
    // Keep the real frame, flight, ramps, guns and people; omit WebGL visuals.
    sys.ready=true;sys.exterior=exterior;sys._updateVisuals=()=>{};
    sys.drones=new DroneSystem(f,sys.guns,ground);
    for(const key of ['cargo','airlock'])sys.rampCtl[key].progress=sys.rampCtl[key].target=1;
    const r=RAMPS.cargo,st=sys.state.ramps.cargo,run=r.length*Math.cos(st.angle);
    const feetY=r.hinge.y-run*Math.tan(st.angle);
    sys.aboard=false;w.yaw=f.heading;
    Object.assign(w.worldPos,f.toWorld({x:0,y:feetY+.02,z:r.hinge.z+run+.06}));
    const ownedOnEntry=sys.frame(1/60,{moveNorth:1,moveEast:0,look:{dx:0,dy:0},keys:new Set()});
    sys.sw.place(0,feetY,r.hinge.z+run+.099,0);
    const ownedOnExit=sys.frame(1/60,{moveNorth:-1,moveEast:0,look:{dx:0,dy:0},keys:new Set()});
    check('the ship owns the boarding frame and releases the exit frame, so planet physics never runs on aboard feet',ownedOnEntry&&!ownedOnExit&&!sys.aboard,JSON.stringify({ownedOnEntry,ownedOnExit,aboard:sys.aboard,x:sys.sw.x,y:sys.sw.y,z:sys.sw.z,run,events:sys.sw.events}));
    check('a shoulder beyond ramp support cannot enter the boarding trigger',!rampEntry('cargo',st,{x:r.width/2-.1,y:-run*Math.tan(st.angle),z:r.hinge.z+run},{x:0,z:-1}));
    const layout=buildLayout();
    const blockers=[];
    // Walkable service point and sight line for every panel and every wall screen.
    for(const panel of PANELS) {
      for(const p of layout.props.filter(p=>p.blocks&&p.kind!=='console')) { const b=propBox(p);
        if(b.x0<panel.x+1.2&&b.x1>panel.x-.35&&b.z0<panel.z+.7&&b.z1>panel.z-.7&&b.y0<panel.y+1.8)blockers.push(panel.id+'/'+p.kind); }
    }
    for(const s of WALL_SCREENS) for(const p of layout.props.filter(p=>p.blocks)) {
      const b=propBox(p), axis=s.facing[0],dir=s.facing[1]==='+'?1:-1;
      const a0=axis==='x'?b.x0:b.z0,a1=axis==='x'?b.x1:b.z1,c=axis==='x'?s.x:s.z;
      const t0=axis==='x'?b.z0:b.x0,t1=axis==='x'?b.z1:b.x1,t=axis==='x'?s.z:s.x;
      if(a0<Math.max(c,c+dir*1)&&a1>Math.min(c,c+dir*1)&&t0<t+s.w/2&&t1>t-s.w/2&&b.y1>s.y-s.h/2&&b.y0<s.y+s.h/2)blockers.push(s.id+'/'+p.kind);
    }
    check('no prop blocks a control panel service space or wall screen sight line',blockers.length===0,blockers.join());
    let doorPass=true;
    for(const d of port.doors) {
      const a=d.asset; Object.assign(w.worldPos,site.toWorld(a.x,.02,a.z+a.d/2+2));
      w.yaw=site.heading;w.velocity={x:0,y:0,z:0};w.grounded=true;
      for(let i=0;i<240;i++){w.tick(1/60,{moveNorth:1});port.tick(1/60,w);}
      doorPass&&=site.toLocal(w.worldPos).z<a.z+a.d/2-2&&d.progress>.96;
    }
    check('the real planet walker opens and walks through depot and tower doors',doorPass);
    Object.assign(w.worldPos,site.toWorld(30,.02,50));
    for(let i=0;i<120;i++)port.tick(1/60,w,false,true);
    check('tour holds both entrances open even from distant aerial review cameras',port.doors.every(d=>d.progress>.99));
    check('future NPC spaces stay clear of solid props',NPC_SPOTS.every(p=>!port.boxes.some(b=>p.x>b.x0-.4&&p.x<b.x1+.4&&p.z>b.z0-.4&&p.z<b.z1+.4)));
    const tour=makePortTour({engine,walker:w,ship:()=>sys,port,rebuild:()=>{}});
    check('review tour retains original views and covers new interiors, traders, roofs and kilometre silhouette',tour('list').length===35&&['ship-ramp-ground','ship-ramp-looking-out','depot-door-inside','tower-door-outside','port-edge-grade','depot-stock','depot-service','depot-lift-cart','tower-reception','tower-lift','tower-cab','market-trader-4','port-one-km','earthworks-detail'].every(n=>tour('list').includes(n)),tour('list').join());
    console.log('  PORT BUDGET',JSON.stringify(port.stats));
    console.log('  PORT SITE',JSON.stringify(site.center),'heading',site.heading);
  } finally {FIELD.attachGrades([]);}
}
