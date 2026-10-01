// Few merged meshes, measured assets, real door openings and ground-level collision.
import * as THREE from 'three';
import { Kit, resolveDepthLayers } from '../ship/shipKit.js';
import { makePortMaterials, CELLS, plaque, groundDecal, textureBytes } from './portArt.js';
import { moduleShell, depotInterior, towerInterior, market, detailFuel } from './portBuildings.js';
import { PORT_ID, PORT_NAME, PADS, BUILDINGS, NPC_SPOTS } from './portSpec.js';

const segments=['abcdef','bc','abdeg','abcdg'];
// Phone fittings retain bevelled silhouettes; sub-centimetre chamfers on thin
// plates/brackets are supplied by Meridian's normal maps rather than 26 faces.
class PortKit extends Kit {
  constructor(low) {super();this.low=low;}
  poly(key,pts,uvs,col) {
    if(key==='soot'&&!uvs) {
      const t=this.low?1024:2048, h=t/2;
      const tint=[.285,.282,.239];
      return super.poly(key,pts,pts.map(()=>[1-1/t,1/h]),tint.map((v,i)=>v*(col?.[i]??1)));
    }
    return super.poly(key,pts,uvs,col);
  }
  box(key,x,y,z,w,h,d,o={}) {
    if((key==='mark'||key==='soot')&&h<.04) {
      const top=y+h/2;
      return this.poly(key,[[x-w/2,top,z+d/2],[x+w/2,top,z+d/2],[x+w/2,top,z-d/2],[x-w/2,top,z-d/2]],null,o.col);
    }
    // Only omit buried/ground-facing undersides; racks and practical lights
    // keep their lower faces when the player looks up from the aisle.
    return super.box(key,x,y,z,w,h,d,this.low&&y-h/2<.15&&!key.startsWith('glow')?{...o,skip:(o.skip||'')+'-y'}:o);
  }
  bevelBox(key,x,y,z,w,h,d,c=.03,o={}) {
    if(this.low && Math.min(w,h,d)<.105)return this.box(key,x,y,z,w,h,d,o);
    if(this.low && Math.max(w,h,d)<1.6) {
      const bevel=Math.min(c,w*.2,h*.2,d*.2);
      return super.prism(key,[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]],y-h/2,y+h/2,bevel,bevel,o.col);
    }
    return super.bevelBox(key,x,y,z,w,h,d,c,o);
  }
  cyl(key,x,y,z,r,h,seg=12,o={}) {
    return super.cyl(key,x,y,z,r,h,this.low?Math.min(seg,r<.1?4:r<1?8:seg):seg,o);
  }
  pipe(key,a,b,r,seg=8,o={}) {
    return super.pipe(key,a,b,r,this.low?Math.min(seg,4):seg,{open:true,...o});
  }
}
function digit(k,n,x,z,s=1) {
  const bars={a:[0,-1,1,.12],b:[.5,-.5,.12,.9],c:[.5,.5,.12,.9],d:[0,1,1,.12],e:[-.5,.5,.12,.9],f:[-.5,-.5,.12,.9],g:[0,0,1,.12]};
  for(const b of segments[+n]) { const [dx,dz,w,d]=bars[b]; k.box('mark',x+dx*s,.025,z+dz*s,w*s,.006,d*s);
    // Missing flakes expose the concrete rather than changing the whole number's colour.
    for(let i=0;i<3;i++)chip(k,x+dx*s+(w>d?(i-1)*.22*s:0),z+dz*s+(d>w?(i-1)*.22*s:0),.04*s,.025*s,.029);
  }
}
function chip(k,x,z,w,d,y=.032) {
  k.poly('concrete',[[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y,z-d/2],[x-w/2,y,z-d/2]]);
}
function mergeKit(dst,src) {
  for(const [key,b] of src.buckets) {
    const a=dst._bucket(key), offset=a.pos.length/3;
    for(const key of ['pos','nrm','uv','col'])for(const v of b[key])a[key].push(v);
    for(const i of b.idx) a.idx.push(i+offset);
    for(const f of src.faces)if(f.b===b)dst.faces.push({...f,b:a,base:f.base+offset});
  }
}
export class PortSystem {
  constructor(engine,registry,site,tier='low',sharedMaterials=null) {
    this.sharedMaterials=sharedMaterials; this.time=0; this.engine=engine; this.registry=registry; this.site=site; this.tier=tier;
    this.boxes=[]; this.doors=[]; this.assets=[]; this.npcSpots=NPC_SPOTS;
  }
  build() {
    const low=this.tier==='low', art=makePortMaterials(this.tier,this.sharedMaterials);
    this.art=art;this.materials=art.mats;
    const master=new PortKit(low); master.defaultTile=4;
    master.tiles={paint:8,metal:1,wall:2.7,floor:2,fabric:1};
    const label=(...args)=>plaque(master,...args);
    const add=(a,k,authored)=>{
      const obj=k.toGroup(this.materials), type=a.id.split('-')[2];
      const rec=this.registry.register({id:a.id,bodyId:'mars',type,name:a.name,
        position:this.site.toWorld(a.x||0,0,a.z||0),authored,object3d:obj,
        collision:type==='STR'?'box':'box',materialId:a.number?'MAT-PORT-CONCRETE':'MAT-PORT-ALLOY',
        note:'Procedural; static geometry merged into the port render root. Ground contacts at port y=0.'});
      this.registry.measure(rec.id,THREE); this.assets.push(rec);
      rec.renderTriangles=[...k.buckets.values()].reduce((n,b)=>n+b.idx.length/3,0);
      rec.grounding={measuredBase:new THREE.Box3().setFromObject(obj).min.y,
        foundationDepth:a.number?.494:(a.kind==='depot'||a.kind==='tower'?.4:0)};
      mergeKit(master,k); obj.traverse(m=>{if(m.isMesh)m.geometry.dispose();}); rec.object3d=null;
    };
    const box=(a,x,z,w,d,h)=>this.boxes.push({id:a.id,x0:a.x+x-w/2,x1:a.x+x+w/2,z0:a.z+z-d/2,z1:a.z+z+d/2,y0:0,y1:h});
    for(const a of PADS) {
      const k=new PortKit(low); k.defaultTile=4; k.push(a.x,0,a.z);
      // The concrete is a material volume in the field. Only its finish is drawn here.
      k.box('concrete',0,-.244,0,a.w,.5,a.d);
      for(let x=-a.w/2+6;x<a.w/2;x+=6) k.box('soot',x,.01,0,.035,.005,a.d-.3);
      for(let z=-a.d/2+8;z<a.d/2;z+=8) k.box('soot',0,.011,z,a.w-.3,.005,.035);
      for(const s of [-1,1]) {
        k.box('mark',s*(a.w/2-1),.026,0,.18,.006,a.d-2);
        k.box('mark',0,.026,s*(a.d/2-1),a.w-2,.006,.18);
        for(let z=-a.d/2+3;z<a.d/2;z+=2.9)chip(k,s*(a.w/2-1),z,.1,.06);
        // Recessed drainage rails and steel tie-down sockets.
        k.box('gunmetal',s*(a.w/2-.32),.012,0,.12,.02,a.d-1);
        for(let z=-a.d/2+3;z<a.d/2;z+=5) {
          k.box('glowCyan',s*(a.w/2-.75),.025,z,.32,.035,.2);
          k.cyl('gunmetal',s*(a.w/2-2.5),.017,z,.14,.025,8);
        }
      }
      for(let z=-a.d/2+4;z<a.d/2-3;z+=3) k.box('mark',0,.026,z,.12,.006,1.1);
      // Four feathered engine footprints, tyre tracks and service-fluid stains.
      for(const x of [-5.3,5.3])for(const z of [-8,8])groundDecal(k,CELLS.scorch,x,z,5.5,7,0,.017);
      groundDecal(k,CELLS.tyres,a.w/2-5,4,3,18,0,.017);
      groundDecal(k,CELLS.oil,-a.w/2+5,-a.d/2+7,1.5,2,0,.017);
      digit(k,a.number[0],-1.4,a.d/2-5,1.7); digit(k,a.number[1],1.4,a.d/2-5,1.7);
      k.pop(); add(a,k,{width:a.w,height:.5385,depth:a.d});
    }
    // Taxi spine and branches: concrete finishes lie on the same engineered plane.
    master.box('concrete',30,-.244,0,18,.5,110);
    for(const z of [-28,30]) {
      master.box('concrete',49,-.244,z,22,.5,10);
      for(let x=21;x<62;x+=3) master.box('mark',x,.026,z,1.4,.006,.14);
    }
    for(let z=-53;z<54;z+=3) master.box('mark',30,.026,z,.14,.006,1.4);
    // Fuel header follows the apron perimeter, clear of taxi and foot routes.
    master.box('gunmetal',86,.014,-20,.7,.025,100);
    master.box('pipeRed',86,.09,-20,.14,.14,100);
    master.box('pipeRed',72,.09,-70,28,.14,.14);
    for(const a of PADS.slice(1)) {
      const x=a.x+a.w/2+1;
      master.box('pipeRed',(86+x)/2,.09,a.z,86-x,.14,.14);
      master.bevelBox('steelDark',x,.5,a.z,.6,1,.6,.05);
      master.box('glowAmber',x,.7,a.z+.31,.18,.12,.015);
    }
    // Pedestrian route clear of pads and the entire aft ramp.
    for(let z=-60;z<65;z+=4) master.box('mark',-27,.026,z,.9,.006,1.4);

    for(const a of BUILDINGS) {
      const k=new PortKit(low); k.defaultTile=3; k.tiles={...master.tiles};k.push(a.x,0,a.z);
      const bevel=(mat,x,y,z,w,h,d,c=.055)=>k.bevelBox(mat,x,y,z,w,h,d,c);
      if(a.kind==='depot'||a.kind==='tower') {
        const block=(x,z,w,d,h)=>box(a,x,z,w,d,h);
        moduleShell(k,a,low,block);
        const dk=new PortKit(low);dk.tiles={paint:8,metal:1};
        // Door hardware stays in one moving bucket; lamps are on the static frame.
        dk.bevelBox('plastic',0,1.4,0,a.doorW,2.8,.12,.045);
        for(const x of [-a.doorW*.34,a.doorW*.34]) {
          dk.box('rubber',x,1.4,.071,.04,2.5,.015);
          dk.bevelBox('counter',x,1.4,.09,.08,.4,.06,.015);
        }
        const mesh=dk.toGroup(this.materials,{name:a.name+' sliding door',cast:true,receive:true});
        const baseZ=a.z+a.d/2-.16;mesh.position.set(a.x,0,baseZ);
        this.doors.push({asset:a,mesh,progress:0,baseZ});
        if(a.kind==='depot')depotInterior(k,a,low,block);
        else towerInterior(k,a,low,block);
      } else if(a.kind==='market') {
        market(k,a,low,(x,z,w,d,h)=>box(a,x,z,w,d,h));
      } else if(a.kind==='fuel') {
        for(const x of [-8,0,8]) {
          bevel('concrete',x,.3,0,6,.6,12,.08);
          k.cyl('steel',x,3.3,0,2.7,5.4,low?12:20);
          for(const y of [1,3.3,5.4]) k.cyl('hazard',x,y,0,2.73,.08,low?12:20);
          k.cyl('steelDark',x,5.86,0,.7,.28,12); k.box('glowAmber',x,4.5,2.75,.3,.3,.08);
          box(a,x,0,6,10,6);
        }
        k.box('pipeRed',0,.22,5.5,24,.2,.2);
        detailFuel(k,low);
      } else if(a.kind==='containers') {
        for(const x of [-9,0,9]) {
          bevel('crateC',x,1.45,0,8,2.9,6,.06); box(a,x,0,8,6,2.9);
          for(let dx=-3.7;dx<4;dx+=.55) k.box('steelDark',x+dx,1.45,3.01,.045,2.6,.035);
          for(const dx of [-1.7,1.7]) k.box('steel',x+dx,1.4,3.04,.07,2.4,.04);
          k.box('hazard',x,.3,3.03,1.4,.15,.03);
        }
      } else if(a.kind==='sign') {
        for(const x of [-7,7]) { bevel('steelDark',x,2,0,.3,4,.6); box(a,x,0,.3,.6,4); }
        bevel('steelDark',0,4,0,16,2,1);
        k.box('glowCyan',0,4.95,.51,15,.05,.025);
      }
      k.pop(); add(a,k,null);
      // Authoring envelopes include airlock hoods and roof plant, rather than
      // silently declaring the original bare wall dimensions.
      const rec=this.registry.get(a.id);
      const envelope={
        depot:{width:24,height:7.84,depth:19},
        tower:{width:12,height:28.4,depth:13},
        market:{width:32,height:3.46,depth:8},
        fuel:{width:24,height:6,depth:12},
        containers:{width:26,height:2.9,depth:6.08},
        sign:{width:16,height:5,depth:1.05},
      };
      rec.authored=envelope[a.kind];
      if(a.kind==='containers')label(CELLS.stock,a.x,2.25,a.z+3.065,9,.6);
    }
    label(CELLS.port,-28,4,65.511,15.6,1.75);
    this.buildEarthworks(master,low);
    this.depthLayers=resolveDepthLayers([master],{eps:.035});
    // Whole-apron stripes intersect at identical yellow corners. A generic
    // overlap graph otherwise lifts each long strip again and again. Assign
    // their known pavement stack explicitly so 16-bit depth never needs seven
    // layers (which could pull a distant stripe in front of ship hardware).
    const keys=new Map([...master.buckets].map(([key,b])=>[b,key]));
    for(const f of master.faces) {
      const key=keys.get(f.b), off=f.base*3;
      if(f.b.nrm[off+1]<.999)continue;
      const ys=Array.from({length:f.n},(_,i)=>f.b.pos[(f.base+i)*3+1]);
      if(Math.min(...ys)<0||Math.max(...ys)>.07)continue;
      if(key==='concrete')f.lift=Math.max(...ys)>.02?4:0;
      else if(key==='soot')f.lift=1;
      else if(key==='mark'||key==='glow')f.lift=3;
      else if(key==='metal')f.lift=4;
    }
    this.depthLayers.maxLayer=Math.max(...master.faces.map(f=>f.lift));
    this.depthLayers.lifted=master.faces.filter(f=>f.lift>0).length;
    this.root=master.toGroup(this.materials,{name:PORT_NAME,receive:true,cast:true});
    // Existing sun shadow pass: skip paint marks, screens, fabric, emissives
    // and floor-only geometry. Architecture and steel fittings cast shadows.
    for(const m of this.root.children)m.castShadow=['metal','paint','wall','concrete'].some(key=>m.name.endsWith(':'+key));
    for(const door of this.doors) this.root.add(door.mesh);
    // Fixed-size light pool, sorted by proximity. No per-fixture shadow maps.
    this.fixtures=[[-62,4.35,14],[-62,4.35,21],[-69,4.15,21],[-55,4.15,14],
      [-62,3.5,-39],[-57.5,3.5,-37],...[-70,-62,-54,-46].map(x=>[x,2.75,53])];
    this.lights=Array.from({length:low?2:3},()=>{
      const l=new THREE.PointLight(0xffd9ac,75,13,2);l.name='port practical light pool';this.root.add(l);return l;
    });
    this.practical=this.lights[0];
    this.updateDisplays();
    const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(...Object.values(this.site.right)),new THREE.Vector3(...Object.values(this.site.up)),new THREE.Vector3(...Object.values(this.site.back)));
    this.quaternion=new THREE.Quaternion().setFromRotationMatrix(basis);
    this.engine.scene.add(this.root); this.engine.track({worldPos:this.site.center,quaternion:this.quaternion,object3d:this.root});
    const rec=this.registry.register({id:PORT_ID,bodyId:'mars',type:'STR',name:PORT_NAME,position:this.site.center,object3d:this.root,collision:'field',materialId:'MAT-PORT-CONCRETE',note:'210 x 176 m surveyed apron; 160 m continuous earthwork blend. Includes named pad/building records.'});
    this.registry.measure(rec.id,THREE);
    this.stats={drawCalls:0,triangles:0,geometryBytes:0,sunShadowDrawCalls:0,sunShadowTriangles:0};
    this.root.traverse(m=>{if(!m.isMesh)return; this.stats.drawCalls++; this.stats.triangles+=m.geometry.index?m.geometry.index.count/3:m.geometry.attributes.position.count/3;
      if(m.castShadow){this.stats.sunShadowDrawCalls++;this.stats.sunShadowTriangles+=m.geometry.index.count/3;}
      for(const a of Object.values(m.geometry.attributes))this.stats.geometryBytes+=a.array.byteLength;
      if(m.geometry.index)this.stats.geometryBytes+=m.geometry.index.array.byteLength;});
    this.stats.textureBytes=textureBytes(art.ownedTextures);
    this.stats.sharedShipTextures=art.sharedTextures;
    this.stats.pointLights=this.lights.length;
    this.stats.shadowLights=0;
    return this;
  }
  updateDisplays() {
    const occupied=this.padOccupancy?.()||[];
    this.art.atlas.update(['01 '+(occupied.includes('01')?'MERIDIAN / OCCUPIED':'CLEAR'),
      '02 '+(occupied.includes('02')?'OCCUPIED':'CLEAR')+'   03 '+(occupied.includes('03')?'OCCUPIED':'CLEAR')]);
  }
  buildEarthworks(k,low) {
    // Segmental retaining kerbs and wind berms sit INSIDE the flat footprint.
    // The 160 m graded density blend outside it remains untouched.
    for(const s of [-1,1])for(let z=-80;z<84;z+=8) {
      k.bevelBox('concrete',s*103,.28,z,1.1,.56,7.85,.06);
      k.box('steelDark',s*103,.59,z,1.16,.06,7.85);
      for(const dz of [-2.5,2.5])k.cyl('gunmetal',s*102.43,.28,z+dz,.055,.035,6,{axis:'x'});
      const x=s*104;
      k._faceQuad('soot',[[x-.48*s,0,z-3.9],[x,.52,z-3.9],[x,.52,z+3.9],[x-.48*s,0,z+3.9]],[0,1,0],[1.7,1.17,.8]);
      k.box('glowAmber',s*102.38,.52,z,.08,.055,.23);
      this.boxes.push({id:PORT_ID,x0:s*103-.56,x1:s*103+.56,z0:z-3.925,z1:z+3.925,y0:0,y1:.62});
    }
    // Tall apron floodlight masts create a recognisable distant silhouette.
    for(const [x,z] of [[-32,-64],[91,-48],[90,54],[-32,44]]) {
      k.bevelBox('concrete',x,.14,z,1.2,.28,1.2,.06);
      k.cyl('steelDark',x,6,z,.16,12,low?8:12,{r2:.09});
      k.box('steel',x,11.7,z,3,.13,.2);
      for(const dx of [-1,0,1]){
        k.bevelBox('gunmetal',x+dx,11.55,z,.65,.35,.4,.055);
        k.box('glowWhite',x+dx,11.45,z+.21,.55,.18,.02);
      }
      for(let y=.4;y<9;y+=.5)k.box('steel',x,y,z+.18,.32,.035,.05);
      k.box('glowRed',x,12.02,z,.12,.04,.12);
      this.boxes.push({id:PORT_ID,x0:x-.6,x1:x+.6,z0:z-.6,z1:z+.6,y0:0,y1:12});
    }
  }
  tick(dt,walker,collide=true,holdDoors=false) {
    const p=this.site.toLocal(walker.worldPos), r=walker.radiusM;
    this.time+=dt;
    const nearby=this.fixtures.map(f=>({f,d:Math.hypot(p.x-f[0],p.z-f[2])})).sort((a,b)=>a.d-b.d);
    this.lights.forEach((l,i)=>{const {f,d}=nearby[i];l.position.set(...f);l.intensity=d<19?75:0;});
    if(this.time>1){this.updateDisplays();this.time=0;}
    for(const d of this.doors) {
      const a=d.asset, near=holdDoors||Math.hypot(p.x-a.x,p.z-d.baseZ)<6;
      d.progress+=Math.max(-dt*1.6,Math.min(dt*1.6,(near?1:0)-d.progress));
      d.mesh.position.set(a.x+d.progress*(a.doorW+.2),0,d.baseZ);
    }
    if(!collide)return;
    const boxes=this.boxes.concat(this.doors.filter(d=>d.progress<.96).map(d=>({x0:d.asset.x-d.asset.doorW/2+d.progress*(d.asset.doorW+.2),x1:d.asset.x+d.asset.doorW/2+d.progress*(d.asset.doorW+.2),z0:d.baseZ-.06,z1:d.baseZ+.06,y0:0,y1:2.8})));
    let pushed=false;
    for(const b of boxes) {
      if(p.y>=b.y1 || p.y+walker.heightM<=b.y0)continue;
      if(p.x<=b.x0-r||p.x>=b.x1+r||p.z<=b.z0-r||p.z>=b.z1+r)continue;
      const choices=[{dx:b.x0-r-p.x,dz:0},{dx:b.x1+r-p.x,dz:0},{dx:0,dz:b.z0-r-p.z},{dx:0,dz:b.z1+r-p.z}];
      choices.sort((a,b)=>Math.hypot(a.dx,a.dz)-Math.hypot(b.dx,b.dz));
      p.x+=choices[0].dx; p.z+=choices[0].dz; pushed=true;
    }
    if(pushed) { Object.assign(walker.worldPos,this.site.toWorld(p.x,p.y,p.z)); walker.velocity.x*=.2; walker.velocity.y*=.2; walker.velocity.z*=.2; }
  }
}
