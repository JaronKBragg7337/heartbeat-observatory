// Few merged meshes, measured assets, real door openings and ground-level collision.
import * as THREE from 'three';
import { Kit, resolveDepthLayers } from '../ship/shipKit.js';
import { makePortMaterials, CELLS, plaque, groundDecal, wallDecal, textureBytes } from './portArt.js';
import { moduleShell, depotInterior, towerInterior, market, detailFuel, crewHall, apronDressing, containerDressing, arrivalsHall } from './portBuildings.js';
import { PORT_ID, PORT_NAME, PADS, BUILDINGS, NPC_SPOTS, TOWER, TOWER_SPOTS, towerFloorAt, APRON, WALKWAY } from './portSpec.js';
import { TowerElevator } from './towerElevator.js';
import { reserveClearance, doorClearSpace } from '../ship/clearance.js';

const segments=['abcdef','bc','abdeg','abcdg'];
// Phone fittings retain bevelled silhouettes; sub-centimetre chamfers on thin
// plates/brackets are supplied by Meridian's normal maps rather than 26 faces.
class PortKit extends Kit {
  constructor(low) {super();this.low=low;}
  poly(key,pts,uvs,col) {
    if(key==='soot'&&!uvs) {
      const t=this.low?1024:2048, h=t*.75;     // PORT-POLISH: the atlas is 4x6 cells now (height = 3/4 width); the white sample stays bottom-right
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
  pillow(key,cx,cy,cz,w,h,d,n=3.2,seg=14,o={}) {
    // Cushions are lathe-smooth by nature; on a phone six segments read as soft and cost a fifth.
    return super.pillow(key,cx,cy,cz,w,h,d,n,this.low?Math.min(seg,6):seg,o);
  }
  cyl(key,x,y,z,r,h,seg=12,o={}) {
    return super.cyl(key,x,y,z,r,h,this.low?Math.min(seg,r<.1?4:r<1?8:seg):seg,o);
  }
  pipe(key,a,b,r,seg=8,o={}) {
    return super.pipe(key,a,b,r,this.low?Math.min(seg,4):seg,{open:true,...o});
  }
  // PORT-POLISH: per-vertex coloured polygons for the additive `haze` bucket (poly() takes one colour per face).
  _grad(key,pts,cols) {
    const b=this._bucket(key),base=b.pos.length/3,P=pts.map(p=>this._tp(p[0],p[1],p[2]));
    for(let i=0;i<P.length;i++){b.pos.push(...P[i]);b.nrm.push(0,1,0);b.uv.push(0,0);b.col.push(...cols[i]);}
    for(let i=1;i<P.length-1;i++)b.idx.push(base,base+i,base+i+1);
    this.triangles+=P.length-2;this.faces.push({b,base,n:P.length,lift:0});
  }
  /** A pool of light on the ground: a fan with a coloured centre fading to nothing at the rim. */
  pool(x,y,z,r,col,n=this.low?10:16) {
    for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2;
      this._grad('haze',[[x,y,z],[x+Math.cos(a0)*r,y,z+Math.sin(a0)*r],[x+Math.cos(a1)*r,y,z+Math.sin(a1)*r]],[col,[0,0,0],[0,0,0]]);}
  }
  /** Light spilling from a lit window or sign onto the ground in front of it: bright at the wall, gone `d` metres out. */
  spill(x,z,w,d,col,rot=0) {
    this.push(x,.04,z,rot);this._grad('haze',[[-w/2,0,0],[w/2,0,0],[w/2*1.5,0,d],[-w/2*1.5,0,d]],[col,col,[0,0,0],[0,0,0]]);this.pop();
  }
  /** The glow round a lamp head in dusty air: two crossed vertical quads, bright at the centre line. */
  halo(x,y,z,r,col) {
    for(const rot of [0,Math.PI/2]){this.push(x,y,z,rot);
      this._grad('haze',[[-r,-r*.6,0],[0,-r*.6,0],[0,r*.6,0],[-r,r*.6,0]],[[0,0,0],col,col,[0,0,0]]);
      this._grad('haze',[[0,-r*.6,0],[r,-r*.6,0],[r,r*.6,0],[0,r*.6,0]],[col,[0,0,0],[0,0,0],col]);this.pop();}
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
/** Segment centres (z) left open in the side kerbs so the apron is walkable to every pad. */
export const KERB_GAPS=[-56,-32,-8,16,40,64];
export class PortSystem {
  constructor(engine,registry,site,tier='low',sharedMaterials=null) {
    this.sharedMaterials=sharedMaterials; this.time=0; this.engine=engine; this.registry=registry; this.site=site; this.tier=tier;
    this.boxes=[]; this.doors=[]; this.assets=[]; this.npcSpots=NPC_SPOTS; this.towerSpots=TOWER_SPOTS;
    this.fittingBoxes=[];
    this.elevator=new TowerElevator();
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
        foundationDepth:a.number?.494:(a.kind==='depot'||a.kind==='tower'||a.kind==='hall'?.4:a.kind==='arrivals'?.494:0)};
      mergeKit(master,k); obj.traverse(m=>{if(m.isMesh)m.geometry.dispose();}); rec.object3d=null;
    };
    const box=(a,x,z,w,d,h,y0=0)=>this.boxes.push({id:a.id,x0:a.x+x-w/2,x1:a.x+x+w/2,z0:a.z+z-d/2,z1:a.z+z+d/2,y0,y1:y0+h});
    for(const a of PADS) {
      const k=new PortKit(low); k.defaultTile=4; k.push(a.x,0,a.z);
      // The concrete is a material volume in the field. Only its finish is drawn here.
      // looks-r1: the night skirt is on the port root (below), not in this asset, so the registered pad stays its authored size.
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
    // OPENING2: apron A (the line transports) and the walkway from it to the arrivals hall: the same engineered plane as the pads.
    {
      const A=APRON,k=new PortKit(low);k.defaultTile=4;k.push(A.x,0,A.z);
      k.box('concrete',0,-.244,0,A.w,.5,A.d);
      for(let x=-A.w/2+12.5;x<A.w/2;x+=12.5) k.box('soot',x,.01,0,.035,.005,A.d-.3);
      for(let z=-A.d/2+15;z<A.d/2;z+=15) k.box('soot',0,.011,z,A.w-.3,.005,.035);
      for(const s of [-1,1]) {
        k.box('mark',s*(A.w/2-1),.026,0,.2,.006,A.d-2);
        k.box('mark',0,.026,s*(A.d/2-1),A.w-2,.006,.2);
        for(let z=-A.d/2+6;z<A.d/2;z+=15){k.box('glowCyan',s*(A.w/2-.8),.025,z,.34,.035,.2);}
      }
      for(let z=-A.d/2+8;z<A.d/2-4;z+=9) k.box('mark',0,.026,z,.16,.006,2.2);              // the centreline the ship comes down on
      for(const z of [-50,-12,34]) k.box('mark',0,.026,z,A.w-6,.006,.14);                  // stop bars
      for(const x of [-9,9])for(const z of [-30,28])groundDecal(k,CELLS.scorch,x,z,7,9,0,.017);
      groundDecal(k,CELLS.oil,-A.w/2+6,A.d/2-14,1.6,2.2,0,.017);
      digit(k,'0',-1.4,A.d/2-9,2.2); digit(k,'1',1.4,A.d/2-9,2.2);
      k.pop();add(A,k,{width:A.w,height:.5385,depth:A.d});
      const W=WALKWAY,wk=new PortKit(low);wk.defaultTile=4;wk.push((W.x0+W.x1)/2,0,(W.z0+W.z1)/2);
      wk.box('concrete',0,-.244,0,W.x1-W.x0,.5,W.z1-W.z0);
      for(const s of [-1,1])wk.box('mark',0,.026,s*((W.z1-W.z0)/2-.7),W.x1-W.x0,.006,.16);
      for(let x=-(W.x1-W.x0)/2+4;x<(W.x1-W.x0)/2-2;x+=8)wk.box('glowAmber',x,.03,0,1.2,.012,.14);
      wk.pop();add(WALKWAY,wk,{width:W.x1-W.x0,height:.5385,depth:W.z1-W.z0});
      // two floodmasts on the apron's east edge (the night pool lights the nearest ones)
      for(const [mx,mz] of [[A.x+A.w/2+3,-45],[A.x+A.w/2+3,45]]){
        master.bevelBox('concrete',mx,.14,mz,1.2,.28,1.2,.06);master.cyl('steelDark',mx,6,mz,.16,12,low?8:12,{r2:.09});
        master.box('steel',mx,11.7,mz,3,.13,.2);
        for(const dx of [-1,0,1]){master.bevelBox('gunmetal',mx+dx,11.55,mz,.65,.35,.4,.055);master.box('glowWhite',mx+dx,11.45,mz+.21,.55,.18,.02);}
        master.box('glowRed',mx,12.02,mz,.12,.04,.12);
        this.boxes.push({id:PORT_ID,x0:mx-.6,x1:mx+.6,z0:mz-.6,z1:mz+.6,y0:0,y1:12});
      }
    }
    // Taxi spine and branches: concrete finishes lie on the same engineered plane.
    // looks-r1: a wider skirt under each pad, the apron and the walkway. Same concrete, bottom above the slab
    // (-0.405 vs -0.494) so it does not become the measured foundation. It is not part of those assets' boxes.
    const skirt=(x,z,w,d,extra)=>master.box('concrete',x,-.21,z,w+extra,.39,d+extra,{col:[.72,.62,.52]});
    for(const a of PADS) skirt(a.x,a.z,a.w,a.d,8);
    skirt(APRON.x,APRON.z,APRON.w,APRON.d,8);
    skirt((WALKWAY.x0+WALKWAY.x1)/2,(WALKWAY.z0+WALKWAY.z1)/2,WALKWAY.x1-WALKWAY.x0,WALKWAY.z1-WALKWAY.z0,4);
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
      const spaces = a.doorW ? [doorClearSpace({id:a.id,axis:'z',at:a.z+a.d/2,c:a.x,w:a.doorW,y:0,h:2.8})] : [];
      if(a.kind==='arrivals') for(const s of [-1,1])spaces.push(doorClearSpace({id:a.id+' entry '+s,axis:'x',at:a.x+s*a.w/2,c:a.z+.2,w:3,y:0,h:3}));
      if(a.kind==='tower')for(const y of [0,TOWER.cab.floorY])spaces.push(doorClearSpace({id:'tower lift '+y,axis:'z',at:a.z+TOWER.core.z1,c:a.x,w:1.2,y,h:2.3}));
      reserveClearance(k,spaces,this.fittingBoxes);
      const bevel=(mat,x,y,z,w,h,d,c=.055)=>k.bevelBox(mat,x,y,z,w,h,d,c);
      if(a.kind==='depot'||a.kind==='tower'||a.kind==='hall') {
        const block=(x,z,w,d,h,y0=0)=>box(a,x,z,w,d,h,y0);
        const c=TOWER.core, hole=a.kind==='tower'?{x0:c.x0-.02,x1:c.x1+.02,z0:c.z0-.02,z1:c.z1+.02}:null;
        moduleShell(k,a,low,block,hole);
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
        k.clearanceEnabled=true;
        if(a.kind==='depot')depotInterior(k,a,low,block);
        else if(a.kind==='hall')crewHall(k,a,low,block);
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
        detailFuel(k,low,(x,z,w,d,h)=>box(a,x,z,w,d,h));
      } else if(a.kind==='containers') {
        for(const x of [-9,0,9]) {
          bevel('crateC',x,1.45,0,8,2.9,6,.06); box(a,x,0,8,6,2.9);
          for(let dx=-3.7;dx<4;dx+=.55) k.box('steelDark',x+dx,1.45,3.01,.045,2.6,.035);
          for(const dx of [-1.7,1.7]) k.box('steel',x+dx,1.4,3.04,.07,2.4,.04);
          k.box('hazard',x,.3,3.03,1.4,.15,.03);
        }
        containerDressing(k,a,low,(x,z,w,d,h)=>box(a,x,z,w,d,h));
      } else if(a.kind==='arrivals') {
        arrivalsHall(k,a,low,(x,z,w,d,h)=>box(a,x,z,w,d,h));
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
        // PORT-POLISH: envelopes include the dressing outside the walls (crates, HVAC pack, cones, benches, the bund, the yard lamp).
        depot:{width:28.95,height:7.84,depth:22.69},
        tower:{width:15.06,height:31.4,depth:18.03},
        market:{width:32,height:3.46,depth:8},
        fuel:{width:25.2,height:6,depth:13.6},
        containers:{width:30.36,height:5.2,depth:11.66},
        sign:{width:16,height:5,depth:1.05},
        hall:{width:24.06,height:6.75,depth:18.81},
        arrivals:{width:33.3,height:5.244,depth:12},
      };
      rec.authored=envelope[a.kind];
      if(a.kind==='containers')label(CELLS.stock,a.x,2.25,a.z+3.065,9,.6);
    }
    label(CELLS.port,-28,4,65.511,15.6,1.75);
    this.buildEarthworks(master,low);
    // PORT-POLISH: ground equipment, pad boards, cable runs, scuffs, cones, and the light in the dust (additive haze bucket).
    apronDressing(master,low,(x,z,w,d,h)=>this.boxes.push({id:PORT_ID,x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:0,y1:h}));
    // fix-r1: make the settlement legible from the pad at night without lifting the ambient sky.
    for(const a of BUILDINGS.filter(a=>['depot','hall','arrivals','tower'].includes(a.kind))) {
      master.spill(a.x,a.z+a.d/2+.1,Math.min(a.w,14),10,[.28,.19,.10]);
      master.pool(a.x,.055,a.z+a.d/2+4,7,[.10,.065,.03],8);
    }
    const route=[[18,38],[-27,38],[-62,38],[-76,40]];
    for(let i=1;i<route.length;i++) {
      const [ax,az]=route[i-1],[bx,bz]=route[i],n=Math.ceil(Math.hypot(bx-ax,bz-az)/7);
      for(let j=0;j<=n;j++) {const x=ax+(bx-ax)*j/n,z=az+(bz-az)*j/n;
        master.poly('glowAmber',[[x-.25,.063,z+2.09],[x+.25,.063,z+2.09],[x+.25,.063,z+1.91],[x-.25,.063,z+1.91]]);
        master.pool(x,.06,z+2,3,[.12,.07,.025],8);}
    }
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
      else if(key==='metal'||key==='haze')f.lift=4;
    }
    this.depthLayers.maxLayer=Math.max(...master.faces.map(f=>f.lift));
    this.depthLayers.lifted=master.faces.filter(f=>f.lift>0).length;
    this.root=master.toGroup(this.materials,{name:PORT_NAME,receive:true,cast:true});
    // Existing sun shadow pass: skip paint marks, screens, fabric, emissives
    // and floor-only geometry. Architecture and steel fittings cast shadows.
    for(const m of this.root.children)m.castShadow=['metal','paint','wall','concrete'].some(key=>m.name.endsWith(':'+key));
    for(const door of this.doors) this.root.add(door.mesh);
    this.buildElevator(low);
    // Fixed-size light pool, sorted by proximity. No per-fixture shadow maps.
    this.fixtures=[[-62,4.35,14],[-62,4.35,21],[-69,4.15,21],[-55,4.15,14],
      [-63,3.6,-39],[-57,3.6,-37],[-60,3.7,-37],...[-70,-62,-54,-46].map(x=>[x,2.75,53]),
      // PORT-POLISH: the cantina's pendants over the bar and the lamps over the tables (port-local)
      ...[-33.5,-29.5,-25.5,-21.5].map(x=>[x,2.6,-70.2,60]),[-37,3.6,-65],[-19,3.6,-65],[-28,3.7,-63.5],[-28,3.2,-58.5],
      // inside the tower: shaft lamps, and six over the cab (port-local x, y, z)
      ...[1,7,13,19,24].map(y=>[TOWER.x,y,TOWER.z-2,12]),
      ...[[-3.3,4.2],[3.3,4.2],[-4.5,0.2],[4.5,0.2],[0,-3],[0,2.4]].map(([x,z])=>[TOWER.x+x,TOWER.cab.roofY-.4,TOWER.z+z,30])];
    this.lights=Array.from({length:low?2:3},()=>{
      const l=new THREE.PointLight(0xffd9ac,75,13,2);l.name='port practical light pool';this.root.add(l);return l;
    });
    this.practical=this.lights[0];
    // F2 NIGHT: the Sun goes down at the port now. The four apron masts (buildEarthworks) light the apron: a fixed small pool of real lights, moved to the
    // masts nearest the player (never a different NUMBER of lights: that would recompile every shader), off by day, up as the Sun sets.
    this.masts=[[-32,-64],[91,-48],[90,54],[-32,44],[APRON.x+APRON.w/2+3,-45],[APRON.x+APRON.w/2+3,45]];
    this.flood=Array.from({length:low?2:3},()=>{const l=new THREE.PointLight(0xfff0d8,0,95,1.5);l.name='port apron flood';this.root.add(l);return l;});
    this.night=0;
    this.settlementLights=[[-62,3.4,31],[-88,3.8,40],[-28,3.4,-58],[10,3,38]].map(([x,y,z])=>{
      const l=new THREE.PointLight(0xffd4a0,0,65,1.5);l.position.set(x,y,z);l.name='settlement front light';this.root.add(l);return l;
    });
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
  /**
   * The tower's floor under a world position, as the radius of that floor from the planet's centre, or null
   * when the ground is the floor (everywhere but the car and the cab). The walker's ground sampler asks this
   * first, so the moving car and fixed cab use the same contact rules as the hillside.
   */
  towerFloorRadius(wx,wy,wz) {
    const p=this.site.toLocal({x:wx,y:wy,z:wz});
    const lx=p.x-TOWER.x, lz=p.z-TOWER.z;
    if(Math.abs(lx)>7||Math.abs(lz)>7||p.y<-.3||p.y>TOWER.cab.roofY)return null;
    const fixed=towerFloorAt(lx,lz,p.y), car=this.elevator.floorAt(lx,lz,p.y);
    const y=car===null?fixed:fixed===null?car:Math.max(car,fixed);
    if(y===null)return null;
    const q=this.site.toWorld(p.x,y,p.z);
    return Math.hypot(q.x,q.y,q.z);
  }
  buildElevator(low) {
    const T=TOWER,C=T.car,k=new PortKit(low);
    k.box('floor',0,-.07,-1,2.2,.14,2.6);
    k.box('steelDark',0,C.height,-1,2.2,.08,2.6);
    for(const x of [-1.06,1.06]) {
      k.box('steelDark',x,.48,-1,.08,.96,2.6);
      for(let z=-2.2;z<.3;z+=.25) k.box('steel',x,1.74,z,.035,1.5,.035);
      k.box('steel',x,1,-1,.075,.065,2.6);
    }
    k.box('steelDark',0,.48,-2.26,2.2,.96,.08);
    for(let x=-1;x<=1;x+=.25)k.box('steel',x,1.74,-2.26,.035,1.5,.035);
    k.box('steel',0,1,-2.26,2.2,.065,.075);
    for(const x of [-.86,.86])k.box('steelDark',x,1.15,.26,.48,2.3,.08);
    k.box('glowWhite',0,2.54,-1,.8,.02,.2);
    k.box('glowCyan',.8,1.1,.315,.12,.12,.02);
    this.carRoot=k.toGroup(this.materials,{name:'tower elevator car',cast:!low,receive:true});
    this.root.add(this.carRoot);
    this.liftDoors=[];
    for(const y of [0,T.cab.floorY,null]) {
      const dk=new PortKit(low);
      dk.box('steel',0,1.15,0,.6,2.3,.08);
      // Brushed plate ribs give the door a clear, solid surface without coplanar skins.
      dk.box('steel',.22,1.1,.052,.035,.25,.025);
      const leaf=dk.toGroup(this.materials).children[0];
      const mesh=new THREE.InstancedMesh(leaf.geometry,leaf.material,2);
      mesh.name=y===null?'car pocket doors':'landing pocket doors '+y;
      mesh.frustumCulled=false;
      (y===null?this.carRoot:this.root).add(mesh);
      this.liftDoors.push({y,mesh});
    }
    this.updateElevatorVisuals();
  }
  updateElevatorVisuals() {
    const T=TOWER,e=this.elevator;
    this.carRoot.position.set(T.x,e.y,T.z);
    for(const d of this.liftDoors) {
      const open=d.y===null?e.open:e.landingOpen(d.y);
      d.mesh.position.set(d.y===null?0:T.x,d.y??0,(d.y===null?0:T.z)+(d.y===null?.22:.45));
      for(let i=0;i<2;i++) {
        // Instances keep a right-handed basis so both leaves retain outward faces.
        const sign=i?1:-1,m=new THREE.Matrix4();
        m.setPosition(sign*(.3+open*.62),0,0);d.mesh.setMatrixAt(i,m);
      }
      d.mesh.instanceMatrix.needsUpdate=true;
    }
  }
  elevatorAction(walker) {
    const p=this.site.toLocal(walker.worldPos),T=TOWER,e=this.elevator;
    const x=p.x-T.x,z=p.z-T.z;
    if(e.contains(x,z,.05)&&Math.abs(p.y-e.y)<.25) {
      if(e.phase==='moving'||e.phase==='closing') return {label:'Lift in motion',run:()=>{}};
      const destination=e.y<1?T.cab.floorY:0;
      return {label:destination?'Lift to control cab (E)':'Lift to lobby (E)',run:()=>e.request(destination)};
    }
    for(const y of [0,T.cab.floorY]) if(Math.abs(p.y-y)<.4&&Math.abs(x)<1.5&&z>.4&&z<2.1) {
      return {label:e.landingOpen(y)>.95?'Lift open · step inside':'Call lift (E)',run:()=>e.request(y)};
    }
    return null;
  }
  tickElevator(dt,walker,collide) {
    const T=TOWER,e=this.elevator,p=this.site.toLocal(walker.worldPos),oldY=e.y;
    const x=p.x-T.x,z=p.z-T.z;
    if(collide&&e.contains(x,z)&&p.y>=oldY&&p.y+walker.heightM>oldY+T.car.height-.04) {
      p.y=oldY+T.car.height-walker.heightM-.04;
      Object.assign(walker.worldPos,this.site.toWorld(p.x,p.y,p.z));
      const up=this.site.up,v=walker.velocity,d=v.x*up.x+v.y*up.y+v.z*up.z;
      if(d>0){v.x-=up.x*d;v.y-=up.y*d;v.z-=up.z*d;}
    }
    const rider=collide&&e.contains(x,z)&&Math.abs(p.y-oldY)<.3;
    const sill=collide&&Math.abs(x)<.6+walker.radiusM&&Math.abs(z-.35)<walker.radiusM+.1&&Math.abs(p.y-oldY)<.3;
    const dy=e.tick(dt,sill);
    if(rider&&dy) {
      Object.assign(walker.worldPos,this.site.toWorld(p.x,p.y+dy,p.z));
      walker.velocity={x:0,y:0,z:0};walker.grounded=true;
    }
    this.updateElevatorVisuals();
  }
  elevatorBoxes() {
    const T=TOWER,e=this.elevator,C=T.car;
    const b=(x0,x1,z0,z1,y0,y1)=>({x0:T.x+x0,x1:T.x+x1,z0:T.z+z0,z1:T.z+z1,y0,y1});
    const boxes=[b(C.x0,C.x0+.08,C.z0,C.z1,e.y,e.y+C.height),b(C.x1-.08,C.x1,C.z0,C.z1,e.y,e.y+C.height),
      b(C.x0,C.x1,C.z0,C.z0+.08,e.y,e.y+C.height),
      b(C.x0,-.6,.22,.38,e.y,e.y+2.3),b(.6,C.x1,.22,.38,e.y,e.y+2.3)];
    const leaves=(open,y,z0,z1)=> {
      if(open>=.96)return;
      for(const sign of [-1,1]) {
        const centre=sign*(.3+open*.62);boxes.push(b(centre-.3,centre+.3,z0,z1,y,y+2.3));
      }
    };
    for(const y of [0,T.cab.floorY])leaves(e.landingOpen(y),y,.41,.49);
    leaves(e.open,e.y,.18,.26);
    return boxes;
  }
  updateDisplays() {
    const occupied=this.padOccupancy?.()||[];
    this.art.atlas.update(['01 '+(occupied.includes('01')?'MERIDIAN / OCCUPIED':'CLEAR'),
      '02 '+(occupied.includes('02')?'OCCUPIED':'CLEAR')+'   03 '+(occupied.includes('03')?'OCCUPIED':'CLEAR')]);
  }
  buildEarthworks(k,low) {
    // Segmental retaining kerbs and wind berms sit INSIDE the flat footprint.
    // The 160 m graded density blend outside it remains untouched.
    // ROUND7: a kerb 0.62 m high cannot be stepped over (a walker steps 0.35 m), so a player walking to the far pads (x 150 and out) met a wall
    // 164 m long. One segment in three is now left out: an 8 m dropped-kerb opening every 24 m (centres -56, -32, -8, 16, 40, 64).
    for(const s of [-1,1])for(let z=-80;z<84;z+=8) {
      if(KERB_GAPS.includes(z))continue;
      k.bevelBox('concrete',s*103,.28,z,1.1,.56,7.85,.06);
      k.box('steelDark',s*103,.59,z,1.16,.06,7.85);
      for(const dz of [-2.5,2.5])k.cyl('gunmetal',s*102.43,.28,z+dz,.055,.035,6,{axis:'x'});
      const x=s*104;
      k._faceQuad('soot',[[x-.48*s,0,z-3.9],[x,.52,z-3.9],[x,.52,z+3.9],[x-.48*s,0,z+3.9]],[0,1,0],[1.7,1.17,.8]);
      k.box('glowAmber',s*102.38,.52,z,.08,.055,.23);
      this.boxes.push({id:PORT_ID,x0:s*103-.56,x1:s*103+.56,z0:z-3.925,z1:z+3.925,y0:0,y1:.62});
    }
    // Tall apron floodlight masts create a recognisable distant silhouette.
    // PORT-POLISH: the north-west mast moved from (-32,-64) to (-50,-62): it stood inside the crew hall's footprint (the hall was a sprite then).
    for(const [x,z] of [[-50,-62],[91,-48],[90,54],[-32,44]]) {
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
  /** Night, 0 (day) to 1 (dark): the masts' floodlights follow it. Set by main from the sky each frame. */
  setNight(k){this.night=k;for(const l of this.settlementLights||[])l.intensity=110*k;if(!this.flood)return;for(const l of this.flood)l.visible=k>0.01;}
  tick(dt,walker,collide=true,holdDoors=false) {
    if(this.flood&&this.night>0.01){
      const q=this.site.toLocal(walker.worldPos),near=this.masts.map(m=>({m,d:Math.hypot(q.x-m[0],q.z-m[1])})).sort((a,b)=>a.d-b.d);
      this.flood.forEach((l,i)=>{const m=near[i].m;l.position.set(m[0],10.2,m[1]);l.intensity=160*this.night;});
    }
    if(holdDoors)this.updateElevatorVisuals();else this.tickElevator(dt,walker,collide);
    const p=this.site.toLocal(walker.worldPos), r=walker.radiusM;
    this.time+=dt;
    // PORT-POLISH: the light pools and halos (additive haze) belong to dusk and night. Fade them with the Sun's elevation, read from the
    // scene's own sun light (render space is the world translated to the eye, so its direction dotted with local up is sin(elevation)).
    if(this.materials.haze){const sun=this.sun??(this.sun=this.engine.scene?.children?.find(o=>o.isDirectionalLight)||null);
      if(sun){const s=sun.position,l=Math.hypot(s.x,s.y,s.z)||1,up=this.site.up,e=(s.x*up.x+s.y*up.y+s.z*up.z)/l;
        this.materials.haze.opacity=Math.max(.06,Math.min(1,(.3-e)/.3));}}
    const nearby=this.fixtures.map(f=>({f,d:Math.hypot(p.x-f[0],p.y+1.2-f[1],p.z-f[2])})).sort((a,b)=>a.d-b.d);
    this.lights.forEach((l,i)=>{const {f,d}=nearby[i];l.position.set(...f);l.intensity=d<19?(f[3]??75):0;});
    if(this.time>1){this.updateDisplays();this.time=0;}
    for(const d of this.doors) {
      const a=d.asset, near=holdDoors||Math.hypot(p.x-a.x,p.z-d.baseZ)<6;
      d.progress+=Math.max(-dt*1.6,Math.min(dt*1.6,(near?1:0)-d.progress));
      d.mesh.position.set(a.x+d.progress*(a.doorW+.2),0,d.baseZ);
    }
    if(!collide)return;
    const boxes=this.boxes.concat(this.elevatorBoxes(),this.doors.filter(d=>d.progress<.96).map(d=>({x0:d.asset.x-d.asset.doorW/2+d.progress*(d.asset.doorW+.2),x1:d.asset.x+d.asset.doorW/2+d.progress*(d.asset.doorW+.2),z0:d.baseZ-.06,z1:d.baseZ+.06,y0:0,y1:2.8})));
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
