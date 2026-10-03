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
    // ROUND7: the port is walkable to every pad. Flood the apron on a 1 m grid with a 34 cm body against every solid that reaches above a 35 cm step,
    // from the middle of the port to the foot of each of the first twelve pads (the far ones are at x 150 to 342): all reachable, and no detour of more than 20%.
    {const {allocatedPad}=await import('../src/world-state/fleet.js');
     const X0=-140,Z0=-260,W=560,H=520,rad=.34,blocked=new Uint8Array(W*H);
     for(const b of port.boxes){ if(b.y1<=.35||b.y0>=1.78)continue;
       for(let ix=Math.max(0,Math.floor(b.x0-rad-X0));ix<=Math.min(W-1,Math.ceil(b.x1+rad-X0));ix++)for(let iz=Math.max(0,Math.floor(b.z0-rad-Z0));iz<=Math.min(H-1,Math.ceil(b.z1+rad-Z0));iz++){
         const x=X0+ix+.5,z=Z0+iz+.5; if(x>b.x0-rad&&x<b.x1+rad&&z>b.z0-rad&&z<b.z1+rad)blocked[iz*W+ix]=1; } }
     const dist=new Float64Array(W*H).fill(1e9),heap=[[0,0]],idx=(x,z)=>(Math.floor(z-Z0))*W+Math.floor(x-X0);
     const push=(d,i)=>{heap.push([d,i]);let k=heap.length-1;while(k>0){const q=(k-1)>>1;if(heap[q][0]<=heap[k][0])break;[heap[q],heap[k]]=[heap[k],heap[q]];k=q;}};
     const pop=()=>{const t=heap[0],e=heap.pop();if(heap.length){heap[0]=e;let k=0;for(;;){let l=2*k+1,r=l+1,m=k;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m;}}return t;};
     const start=idx(0,60);dist[start]=0;heap.length=0;push(0,start);
     while(heap.length){const [d,i]=pop();if(d>dist[i])continue;const ix=i%W,iz=(i-ix)/W;
       for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){if(!dx&&!dz)continue;const nx=ix+dx,nz=iz+dz;if(nx<0||nz<0||nx>=W||nz>=H)continue;const j=nz*W+nx;if(blocked[j])continue;
         if(dx&&dz&&(blocked[iz*W+nx]||blocked[nz*W+ix]))continue;const nd=d+(dx&&dz?1.4142:1);if(nd<dist[j]){dist[j]=nd;push(nd,j);}}}
     const bad=[];
     for(let n=0;n<12;n++){const a=allocatedPad(n,null),foot={x:a.x,z:a.z+a.d/2+2},at=dist[idx(foot.x,foot.z)],straight=Math.hypot(foot.x,foot.z-60);
       if(!(at<1e8)||at>straight*1.2+8)bad.push(`pad ${a.number} at ${a.x},${a.z}: ${at<1e8?Math.round(at)+' m walk for '+Math.round(straight)+' m straight':'unreachable'}`);}
     check('every pad (the first twelve) can be walked to from the middle of the port with no detour over 20%: the side kerbs have dropped openings',bad.length===0&&dist[idx(0,60)]===0,bad.join('; '));}
    const drift=port.assets.filter(a=>a.authored&&!registry.dimensionDrift(a.id).withinTolerance);
    check('port assets measure within 5 cm of their authored sizes',drift.length===0,JSON.stringify(drift.map(a=>[a.name,a.authored,a.measured])));
    // 2026-10-01: 19 calls including the moving car and three door leaves; geometry still stays under 40k triangles.
    check('phone port costs at most 19 draw calls, 40k triangles and 4 MB of geometry',port.stats.drawCalls<=19&&port.stats.triangles<40000&&port.stats.geometryBytes<4e6,JSON.stringify(port.stats));
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
      port.assets.find(a=>a.name==='Port control').measured.height>31&&port.assets.find(a=>a.name==='Supply depot').measured.height>7.5);
    const highPort=new PortSystem({scene:new THREE.Scene(),track:()=>{}},new Registry(),site,'high',shared).build();
    check('high tier remains merged within 19 main calls, 65k triangles and 6 MB of geometry',
      highPort.stats.drawCalls<=19&&highPort.stats.triangles<65000&&highPort.stats.geometryBytes<6e6,JSON.stringify(highPort.stats));
    let footings=true;
    for(const a of BUILDINGS) for(const dx of [-a.w/2+.2,a.w/2-.2]) for(const dz of [-a.d/2+.2,a.d/2-.2]) footings&&=Math.abs(dens(a.x+dx,0,a.z+dz))<.01&&dens(a.x+dx,-.15,a.z+dz)<0;
    check('every structure and prop stands on surveyed solid ground, including every foundation corner',footings&&port.boxes.every(b=>b.y0===0||(b.id===BUILDINGS.find(a=>a.kind==='tower').id&&b.y0>=0)));
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
    check('review tour retains original views and covers new interiors, traders, roofs and kilometre silhouette',tour('list').length===45&&['ship-ramp-ground','ship-ramp-looking-out','depot-door-inside','tower-door-outside','port-edge-grade','depot-stock','depot-service','depot-lift-cart','tower-reception','tower-elevator-call','tower-elevator-exit','tower-cab-south','tower-cab','market-trader-4','port-one-km','earthworks-detail'].every(n=>tour('list').includes(n)),tour('list').join());
    // ------------------------------------------------------------------------------------------------------
    section('10b. The control tower: call, board, ride and leave the elevator');
    // ------------------------------------------------------------------------------------------------------
    {
      const {TOWER,TOWER_SPOTS,TOWER_SURFACES,towerFloorAt}=await import('../src/port/portSpec.js');
      const {CAB_FURNITURE}=await import('../src/port/portBuildings.js');
      const e=port.elevator,C=TOWER.car;
      check('both elevator door leaves preserve outward face winding',port.liftDoors.every(d=>{
        const m=new THREE.Matrix4();
        for(let i=0;i<2;i++){d.mesh.getMatrixAt(i,m);if(m.determinant()<=0)return false;}
        return true;
      }));
      check('the 2.2 by 2.6 m car has 2.6 m headroom and a body-wide 1.2 m opening',Math.abs(C.x1-C.x0-2.2)<1e-9&&Math.abs(C.z1-C.z0-2.6)<1e-9&&C.height>=2.5&&TOWER.door.x1-TOWER.door.x0===1.2);
      check('cab remains at 22.5 m; no switchback flights, spine or stacked landing floors remain',TOWER.cab.floorY===22.5&&!TOWER.flight&&TOWER_SURFACES.every(s=>!s.name.includes('flight')&&!s.name.includes('landing')));
      check('an empty shaft is not a floor: no fixed support between lobby and cab',towerFloorAt(0,-1,12)===null&&e.floorAt(0,-1,12)===0);
      e.request(TOWER.cab.floorY);const initial=e.y;e.tick(.2,true);
      check('a body on the sill prevents closing and motion; a request cannot move through open doors',e.open===1&&e.y===initial&&e.phase==='closing');
      const wt=new Walker(mars);
      wt.groundSampler=(dx,dy,dz,r)=>port.towerFloorRadius(dx*r,dy*r,dz*r)??FIELD.surfaceRadiusFast(mars,dx,dy,dz);
      Object.assign(wt.worldPos,site.toWorld(TOWER.x,.02,TOWER.z-1));wt.grounded=true;
      let frames=0,error=0,interlocked=true;
      for(;frames<1800;frames++) {
        wt.tick(1/60,{});port.tick(1/60,wt);
        const p=site.toLocal(wt.worldPos);error=Math.max(error,Math.abs(p.y-e.y-.02));
        if(e.phase==='moving')interlocked&&=e.open===0&&e.landingOpen(0)===0&&e.landingOpen(TOWER.cab.floorY)===0;
        if(e.phase==='open'&&e.y===TOWER.cab.floorY)break;
      }
      check('the real walker rides the moving floor to 22.5 m without teleporting or losing its feet',frames<1800&&error<.03&&interlocked,`${(frames/60).toFixed(2)} s, support error ${error}`);
      const drive=(sign,n)=>{wt.yaw=site.heading;for(let i=0;i<n;i++){wt.tick(1/60,{moveNorth:sign});port.tick(1/60,wt);}};
      drive(-1,130);const inCab=site.toLocal(wt.worldPos);
      check('open landing and car doors let the walker leave into the furnished cab',Math.abs(inCab.y-TOWER.cab.floorY)<.1&&inCab.z-TOWER.z>2.5,JSON.stringify(inCab));
      // Recall an empty car, then ride it back. Checks both stops and both door sets.
      e.request(0);for(let i=0;i<1000;i++)port.tick(1/60,wt);
      const closedTop=e.landingOpen(TOWER.cab.floorY)===0;
      const before={...wt.worldPos};port.elevatorAction(wt);e.request(TOWER.cab.floorY);
      for(let i=0;i<1000;i++)port.tick(1/60,wt);
      const stayed=Math.hypot(wt.worldPos.x-before.x,wt.worldPos.y-before.y,wt.worldPos.z-before.z)<.001;
      Object.assign(wt.worldPos,site.toWorld(TOWER.x,TOWER.cab.floorY+.02,TOWER.z-1));wt.velocity={x:0,y:0,z:0};
      e.request(0);for(let i=0;i<1000;i++){wt.tick(1/60,{});port.tick(1/60,wt);}
      check('empty recall leaves the waiting player at the cab, and a return rider reaches the lobby with doors open',closedTop&&stayed&&e.y===0&&e.open===1&&Math.abs(site.toLocal(wt.worldPos).y-.02)<.03);

      // CAB: who can stand where. Flood fill the cab floor at 10 cm with a 34 cm-radius body against the real boxes.
      const cabBoxes=port.boxes.filter(b=>b.y1>TOWER.cab.floorY+.2&&b.y0<TOWER.cab.floorY+1.7&&b.x1>TOWER.x-8&&b.x0<TOWER.x+8&&b.z1>TOWER.z-8&&b.z0<TOWER.z+8);
      const free=(lx,lz,r=.34)=>{
        if(towerFloorAt(lx,lz,TOWER.cab.floorY)!==TOWER.cab.floorY)return false;
        return !cabBoxes.some(b=>lx>b.x0-TOWER.x-r&&lx<b.x1-TOWER.x+r&&lz>b.z0-TOWER.z-r&&lz<b.z1-TOWER.z+r);
      };
      const key=(i,j)=>i*1000+j,seen=new Set([key(0,28)]),q=[[0,28]];   // the cell just inside the cab door, (0, 2.8)
      while(q.length){const [i,j]=q.pop();for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const a=i+di,b=j+dj;if(seen.has(key(a,b))||Math.abs(a)>64||Math.abs(b)>64)continue;
        if(free(a/10,b/10)){seen.add(key(a,b));q.push([a,b]);}}}
      check('the cab floor is one room: the door cell reaches most of the floor with a body-sized clearance',free(0,2.8)&&seen.size>3000,`${seen.size} reachable cells (${(seen.size/100).toFixed(0)} m2)`);
      const reach=(x,z)=>seen.has(key(Math.round(x*10),Math.round(z*10)));
      const standing=TOWER_SPOTS.filter(s=>s.pose==='standing'),seated=TOWER_SPOTS.filter(s=>s.pose==='seated');
      check('every standing place for a worker is reachable on foot and clear of every solid within 45 cm',
        standing.every(s=>reach(s.x-TOWER.x,s.z-TOWER.z)&&!cabBoxes.some(b=>s.x>b.x0-.45&&s.x<b.x1+.45&&s.z>b.z0-.45&&s.z<b.z1+.45)),
        standing.map(s=>`${s.id}:${reach(s.x-TOWER.x,s.z-TOWER.z)}`).join());
      check('every seat is a real chair with a console in front of it, and the way to its back is open',
        seated.every(s=>{const ch=CAB_FURNITURE.find(f=>Math.abs(f.chair[0]-(s.x-TOWER.x))<.01&&Math.abs(f.chair[1]-(s.z-TOWER.z))<.01);
          if(!ch)return false;const dx=s.x-TOWER.x,dz=s.z-TOWER.z,k=[[0,0],[0,1],[1,0],[0,-1],[-1,0]];
          return ch.desk&&Math.hypot(ch.desk[0]-dx,ch.desk[1]-dz)>.8&&Math.hypot(ch.desk[0]-dx,ch.desk[1]-dz)<1.2&&
            [[.9,0],[-.9,0],[0,.9],[0,-.9]].some(([a,b])=>reach(dx+a,dz+b));}),
        seated.map(s=>s.id).join());
      check('the cab holds at least five seated and two standing workers',seated.length>=5&&standing.length>=2);
      // glass all round, at the height of a standing or a seated eye
      const glassMesh=port.root.children.find(m=>m.name.endsWith(':glassTint'));
      let gx0=1e9,gx1=-1e9,gz0=1e9,gz1=-1e9,gy0=1e9,gy1=-1e9,gt=0;
      if(glassMesh){const pos=glassMesh.geometry.attributes.position;gt=glassMesh.geometry.index.count/3;
        for(let i=0;i<pos.count;i++){gx0=Math.min(gx0,pos.getX(i));gx1=Math.max(gx1,pos.getX(i));gz0=Math.min(gz0,pos.getZ(i));gz1=Math.max(gz1,pos.getZ(i));gy0=Math.min(gy0,pos.getY(i));gy1=Math.max(gy1,pos.getY(i));}}
      check('the cab is glazed on all four sides (24 panes), from the console ledge up, and a seated eye and a standing eye are both behind glass',
        !!glassMesh&&gt>=48&&gx0<TOWER.x-6&&gx1>TOWER.x+6&&gz0<TOWER.z-6&&gz1>TOWER.z+6&&
        gy0-TOWER.cab.floorY<=1&&gy1-TOWER.cab.floorY>=3&&1.2>gy0-TOWER.cab.floorY&&1.66<gy1-TOWER.cab.floorY,
        `${gt} triangles, x ${(gx0-TOWER.x).toFixed(1)}..${(gx1-TOWER.x).toFixed(1)}, z ${(gz0-TOWER.z).toFixed(1)}..${(gz1-TOWER.z).toFixed(1)}`);
      // every seat has a clear line out of the glass: a ray from a seated eye (1.2 m) straight ahead hits no solid before the glass
      const dirs={south:[0,1],north:[0,-1],east:[1,0],west:[-1,0]};
      const sights=seated.every(s=>{const [dx,dz]=dirs[s.face];for(let t=.3;t<5;t+=.05){const x=s.x+dx*t,z=s.z+dz*t,y=TOWER.cab.floorY+1.2;
        if(Math.abs(x-TOWER.x)>6.3||Math.abs(z-TOWER.z)>6.3)break;
        if(cabBoxes.some(b=>x>b.x0&&x<b.x1&&z>b.z0&&z<b.z1&&y>b.y0&&y<b.y1&&!(Math.abs(x-s.x)<.3&&Math.abs(z-s.z)<.3)))return false;}return true;});
      check('from every seat the way out through the glass is open at eye height (consoles stay under a seated eye)',sights);
      // the way in is not blocked: nothing solid stands in front of the elevator door in the lobby
      const front=port.boxes.filter(b=>b.y0<2.2&&b.x1>TOWER.x-.9&&b.x0<TOWER.x+.9&&b.z1>TOWER.z+TOWER.core.z1+.0&&b.z0<TOWER.z+TOWER.core.z1+1.6&&!(b.z0<=TOWER.z+TOWER.core.z1+.001&&b.y1>20));
      check('nothing solid stands in front of the elevator door in the lobby (a metre and a half clear, wall to wall)',front.length===0,front.map(b=>b.id).join());
      // the lobby still works: a person from the entrance reaches the reception clerk's place and the door in the core is straight ahead
      check('the clerk\'s place behind reception is clear and the elevator door is straight ahead of the entrance',
        !port.boxes.some(b=>b.y0<1&&-63.9>b.x0-.4&&-63.9<b.x1+.4&&-42.1>b.z0-.4&&-42.1<b.z1+.4)&&TOWER.door.x0<0&&TOWER.door.x1>0);
    }
    console.log('  PORT BUDGET',JSON.stringify(port.stats));
    console.log('  PORT SITE',JSON.stringify(site.center),'heading',site.heading);
  } finally {FIELD.attachGrades([]);}
}
