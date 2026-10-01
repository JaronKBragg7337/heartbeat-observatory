// Few merged meshes, measured assets, real door openings and ground-level collision.
import * as THREE from 'three';
import { Kit } from '../ship/shipKit.js';
import { PORT_ID, PORT_NAME, PADS, BUILDINGS, NPC_SPOTS } from './portSpec.js';

function paintTexture(low) {
  if (typeof document === 'undefined') return null;
  const c=document.createElement('canvas'); c.width=c.height=low?128:256;
  const g=c.getContext('2d'); g.fillStyle='#ccc8bc'; g.fillRect(0,0,c.width,c.height);
  let seed=814;
  for(let i=0;i<3500;i++) { seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    g.fillStyle=i%3?'#aaa79d':'#ded6c5'; g.globalAlpha=.25;
    g.fillRect(seed%c.width,(seed>>>8)%c.height,1+(seed%3),1); }
  g.globalAlpha=.32; g.strokeStyle='#6c6258'; g.lineWidth=1;
  g.strokeRect(1,1,c.width-2,c.height-2);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace; return t;
}
function signTexture(low) {
  if(typeof document==='undefined') return null;
  const c=document.createElement('canvas'); c.width=low?512:1024; c.height=low?256:512;
  const g=c.getContext('2d'); if(low)g.scale(.5,.5);
  g.fillStyle='#111e26'; g.fillRect(0,0,1024,512);
  g.fillStyle='#acecf4'; g.font='bold 82px sans-serif'; g.textAlign='center';
  g.fillText(PORT_NAME,512,103); g.fillStyle='#e9be73'; g.font='32px sans-serif';
  g.fillText('MARS  /  ARRIVALS · SUPPLY · FLIGHT CONTROL',512,174);
  g.font='22px sans-serif'; g.fillText('01 MERIDIAN     02 SHUTTLES     03 COURIERS',512,225);
  g.font='bold 36px sans-serif'; g.fillStyle='#bce3df';
  ['SUPPLY DEPOT / ARRIVALS','PORT CONTROL','MARINERIS EXCHANGE','FUEL / KEEP CLEAR','CARGO / MANIFEST'].forEach((s,i)=>g.fillText(s,512,293+i*48));
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const segments=['abcdef','bc','abdeg','abcdg'];
function digit(k,n,x,z,s=1) {
  const bars={a:[0,-1,1,.12],b:[.5,-.5,.12,.9],c:[.5,.5,.12,.9],d:[0,1,1,.12],e:[-.5,.5,.12,.9],f:[-.5,-.5,.12,.9],g:[0,0,1,.12]};
  for(const b of segments[+n]) { const [dx,dz,w,d]=bars[b]; k.box('mark',x+dx*s,.025,z+dz*s,w*s,.006,d*s); }
}
function mergeKit(dst,src) {
  for(const [key,b] of src.buckets) {
    const a=dst._bucket(key), offset=a.pos.length/3;
    a.pos.push(...b.pos); a.nrm.push(...b.nrm); a.uv.push(...b.uv); a.col.push(...b.col);
    for(const i of b.idx) a.idx.push(i+offset);
  }
}
export class PortSystem {
  constructor(engine,registry,site,tier='low') {
    this.engine=engine; this.registry=registry; this.site=site; this.tier=tier;
    this.boxes=[]; this.doors=[]; this.assets=[]; this.npcSpots=NPC_SPOTS;
  }
  build() {
    const low=this.tier==='low', texture=paintTexture(low);
    const standard=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,vertexColors:true,roughness:.86,metalness,map:texture});
    this.materials={concrete:standard(0xb2b2a9), metal:standard(0xc4c9cb,.65), paint:standard(0xa7aba3),
      glow:new THREE.MeshBasicMaterial({vertexColors:true}),
      mark:new THREE.MeshStandardMaterial({color:0xe8bd60,roughness:.94,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),
      soot:new THREE.MeshStandardMaterial({color:0x454039,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})};
    this.materials.signs=new THREE.MeshBasicMaterial({map:signTexture(low),color:0xffffff,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
    const master=new Kit(); master.defaultTile=4;
    const label=(x,y,z,w,h,top,bottom)=>master.poly('signs',[[x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z]],[[0,bottom],[1,bottom],[1,top],[0,top]]);
    const add=(a,k,authored)=>{
      const obj=k.toGroup(this.materials), type=a.id.split('-')[2];
      const rec=this.registry.register({id:a.id,bodyId:'mars',type,name:a.name,
        position:this.site.toWorld(a.x||0,0,a.z||0),authored,object3d:obj,
        collision:type==='STR'?'box':'box',materialId:a.number?'MAT-PORT-CONCRETE':'MAT-PORT-ALLOY',
        note:'Procedural; static geometry merged into the port render root. Ground contacts at port y=0.'});
      this.registry.measure(rec.id,THREE); this.assets.push(rec);
      rec.grounding={measuredBase:new THREE.Box3().setFromObject(obj).min.y,
        foundationDepth:a.number?.494:(a.kind==='depot'||a.kind==='tower'?.4:0)};
      mergeKit(master,k); obj.traverse(m=>{if(m.isMesh)m.geometry.dispose();}); rec.object3d=null;
    };
    const box=(a,x,z,w,d,h)=>this.boxes.push({id:a.id,x0:a.x+x-w/2,x1:a.x+x+w/2,z0:a.z+z-d/2,z1:a.z+z+d/2,y0:0,y1:h});
    for(const a of PADS) {
      const k=new Kit(); k.defaultTile=4; k.push(a.x,0,a.z);
      // The concrete is a material volume in the field. Only its finish is drawn here.
      k.box('concrete',0,-.244,0,a.w,.5,a.d);
      for(let x=-a.w/2+6;x<a.w/2;x+=6) k.box('soot',x,.01,0,.035,.005,a.d-.3);
      for(let z=-a.d/2+8;z<a.d/2;z+=8) k.box('soot',0,.011,z,a.w-.3,.005,.035);
      for(const s of [-1,1]) {
        k.box('mark',s*(a.w/2-1),.026,0,.18,.006,a.d-2);
        k.box('mark',0,.026,s*(a.d/2-1),a.w-2,.006,.18);
        // Recessed drainage rails and steel tie-down sockets.
        k.box('gunmetal',s*(a.w/2-.32),.012,0,.12,.02,a.d-1);
        for(let z=-a.d/2+3;z<a.d/2;z+=5) {
          k.box('glowCyan',s*(a.w/2-.75),.025,z,.32,.035,.2);
          k.cyl('gunmetal',s*(a.w/2-2.5),.017,z,.14,.025,8);
        }
      }
      for(let z=-a.d/2+4;z<a.d/2-3;z+=3) k.box('mark',0,.026,z,.12,.006,1.1);
      // Segmented rings read as blast wear without transparent overdraw.
      for(let i=0;i<24;i++) { const t=i*Math.PI/12; k.push(Math.sin(t)*7,0,Math.cos(t)*7,t);
        k.box('soot',0,.018,0,.55,.006,1.55); k.pop(); }
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
      const k=new Kit(); k.defaultTile=3; k.push(a.x,0,a.z);
      const bevel=(mat,x,y,z,w,h,d,c=.055)=>k.bevelBox(mat,x,y,z,w,h,d,c);
      if(a.kind==='depot'||a.kind==='tower') {
        const h=a.kind==='tower'?4.2:a.h;
        // Wall panels, double-sided solids with an actual front opening. No floor lip.
        bevel('concrete',0,-.2,0,a.w,.4,a.d);
        bevel('plastic',0,h/2,-a.d/2+.12,a.w,h,.24);
        for(const s of [-1,1]) { bevel('plastic',s*(a.w/2-.12),h/2,0,.24,h,a.d);
          box(a,s*(a.w/2-.12),0,.24,a.d,h); }
        box(a,0,-a.d/2+.12,a.w,.24,h);
        const side=(a.w-a.doorW)/2;
        for(const s of [-1,1]) { const x=s*(a.doorW/2+side/2); bevel('plastic',x,h/2,a.d/2-.12,side,h,.24); box(a,x,a.d/2-.12,side,.24,h); }
        bevel('steelDark',0,(h+2.8)/2,a.d/2-.12,a.doorW,h-2.8,.24);
        bevel('steelDark',0,h-.12,0,a.w,.24,a.d);
        // A roof overhang, flashings, vertical seams, dust skirt and practical lamps.
        for(let x=-a.w/2+.7;x<a.w/2;x+=2) k.box('steelDark',x,h/2,a.d/2+.003,.028,h-.3,.022);
        for(const s of [-1,1]) { k.box('crateB',s*(a.w/2-.16),.17,0,.05,.3,a.d-.5);
          k.box('glowAmber',s*(a.doorW/2+.4),2.55,a.d/2+.025,.4,.12,.06); }
        k.box('hazard',0,.015,a.d/2-1.2,a.doorW,.016,.15);
        const dk=new Kit(); dk.bevelBox('steelDark',0,1.4,0,a.doorW,2.8,.12,.04);
        dk.box('glowCyan',0,1.8,.065,a.doorW*.6,.08,.012);
        const mesh=dk.toGroup(this.materials,{name:a.name+' sliding door'});
        const baseZ=a.z+a.d/2-.16; mesh.position.set(a.x,0,baseZ);
        this.doors.push({asset:a,mesh,progress:0,baseZ});
        if(a.kind==='depot') {
          // Shelves, bundled supplies and braced counter, leaving a 3 m central aisle.
          for(const s of [-1,1]) {
            const x=s*(a.w/2-1.3);
            for(const z of [-5,0,5]) {
              for(const dx of [-.85,.85]) { k.box('steelDark',x+dx,1.3,z-.9,.08,2.6,.08); k.box('steelDark',x+dx,1.3,z+.9,.08,2.6,.08); }
              for(const y of [.15,1.05,1.95]) { bevel('steel',x,y,z,2,.08,2,.025);
                for(const dz of [-.5,.5]) bevel('crateA',x,y+.31,z+dz,1.5,.55,.75); }
              box(a,x,z,2,2,2.6);
            }
          }
          bevel('counter',-3,.6,-1,5,1.2,1.1); box(a,-3,-1,5,1.1,1.2);
          k.box('glowCyan',-2,1.26,-1,.7,.06,.4);
          for(let x=-7;x<8;x+=3) { bevel('crateB',x,.6,-7,1.5,1.2,1.5); box(a,x,-7,1.5,1.5,1.2); }
          k.box('glowWhite',0,h-.3,0,12,.05,.22);
        } else {
          // Enterable lobby beneath an instrument tower; the upper cab is currently scenery.
          bevel('counter',-2,.55,-2,2,1.1,1.2); box(a,-2,-2,2,1.2,1.1);
          k.box('glowCyan',-2,1.15,-2,1.3,.08,.6);
          bevel('steelDark',0,9,0,6,9.6,6,.15);
          for(let y=5;y<14;y+=2) k.box('steel',0,y,3.04,5.5,.06,.08);
          bevel('plastic',0,14.7,0,10,1.4,10,.16);
          bevel('gunmetal',0,16.2,0,9.7,1.5,9.7,.14);
          for(const s of [-1,1]) { k.box('glowCyan',0,16.2,s*4.86,8,.8,.025); k.box('glowCyan',s*4.86,16.2,0,.025,.8,8); }
          bevel('steel',0,17.2,0,10,.5,10,.15);
          k.cyl('steel',0,17.6,0,.05,.8,8); k.box('glowRed',0,17.98,0,.12,.04,.12);
        }
      } else if(a.kind==='market') {
        for(let i=0;i<4;i++) {
          const x=-12+i*8;
          for(const dx of [-3.5,3.5]) for(const z of [-3.5,3.5]) { k.box('steelDark',x+dx,1.65,z,.1,3.3,.1); box(a,x+dx,z,.1,.1,3.3); }
          bevel('crateB',x,3.4,0,8,.2,8,.075);
          bevel('counter',x,.55,-1.6,6,1.1,1.2); box(a,x,-1.6,6,1.2,1.1);
          k.box('glowAmber',x,3.2,1,3,.07,.09);
          for(const dx of [-2,0,2]) bevel('crateA',x+dx,1.28,-1.6,1.2,.35,.85);
        }
      } else if(a.kind==='fuel') {
        for(const x of [-8,0,8]) {
          bevel('concrete',x,.3,0,6,.6,12,.08);
          k.cyl('steel',x,3.3,0,2.7,5.4,low?12:20);
          for(const y of [1,3.3,5.4]) k.cyl('hazard',x,y,0,2.73,.08,low?12:20);
          k.cyl('steelDark',x,5.86,0,.7,.28,12); k.box('glowAmber',x,4.5,2.75,.3,.3,.08);
          box(a,x,0,6,10,6);
        }
        k.box('pipeRed',0,.22,5.5,24,.2,.2);
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
      // Explicit design envelope, compared to measured geometry in the validator.
      const rec=this.registry.get(a.id);
      rec.authored={width:a.w,height:a.h+(a.kind==='depot'||a.kind==='tower'?.4:0),depth:a.d+(a.kind==='containers'?.08:a.kind==='sign'?.05:a.kind==='depot'||a.kind==='tower'?.08:0)};
      const row={depot:0,tower:1,market:2,fuel:3,containers:4}[a.kind];
      if(a.kind==='depot'||a.kind==='tower'||a.kind==='market'||a.kind==='containers') {
        label(a.x,a.kind==='market'?3.35:a.kind==='containers'?2.25:3.6,a.z+a.d/2+.065,a.kind==='market'?7:Math.min(a.w-1,9),a.kind==='market'?.25:.6,1-(256+row*48)/512,1-(304+row*48)/512);
      }
    }
    label(-28,4,65.511,15.6,1.75,1,.5);
    this.root=master.toGroup(this.materials,{name:PORT_NAME,receive:true});
    for(const door of this.doors) this.root.add(door.mesh);
    // One nearby practical light, with no shadow map or per-fixture draw call.
    this.practical=new THREE.PointLight(0xffd9ac,22,17,2);
    this.practical.name='port practical light pool'; this.root.add(this.practical);
    this.fixtures=[[-62,4.7,18],[-60,3.7,-39],[-58,3.15,53]];
    const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(...Object.values(this.site.right)),new THREE.Vector3(...Object.values(this.site.up)),new THREE.Vector3(...Object.values(this.site.back)));
    this.quaternion=new THREE.Quaternion().setFromRotationMatrix(basis);
    this.engine.scene.add(this.root); this.engine.track({worldPos:this.site.center,quaternion:this.quaternion,object3d:this.root});
    const rec=this.registry.register({id:PORT_ID,bodyId:'mars',type:'STR',name:PORT_NAME,position:this.site.center,object3d:this.root,collision:'field',materialId:'MAT-PORT-CONCRETE',note:'210 x 176 m surveyed apron; 160 m continuous earthwork blend. Includes named pad/building records.'});
    this.registry.measure(rec.id,THREE);
    this.stats={drawCalls:0,triangles:0,geometryBytes:0};
    this.root.traverse(m=>{if(!m.isMesh)return; this.stats.drawCalls++; this.stats.triangles+=m.geometry.index?m.geometry.index.count/3:m.geometry.attributes.position.count/3;
      for(const a of Object.values(m.geometry.attributes))this.stats.geometryBytes+=a.array.byteLength;
      if(m.geometry.index)this.stats.geometryBytes+=m.geometry.index.array.byteLength;});
    return this;
  }
  tick(dt,walker,collide=true) {
    const p=this.site.toLocal(walker.worldPos), r=walker.radiusM;
    const fixture=this.fixtures.reduce((a,b)=>Math.hypot(p.x-a[0],p.z-a[2])<Math.hypot(p.x-b[0],p.z-b[2])?a:b);
    this.practical.position.set(...fixture);
    this.practical.intensity=Math.hypot(p.x-fixture[0],p.z-fixture[2])<22?22:0;
    for(const d of this.doors) {
      const a=d.asset, near=Math.hypot(p.x-a.x,p.z-d.baseZ)<6;
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
