// Fixed named review cameras. Physics pauses during a tour; off restores play.
import * as THREE from 'three';
import { PADS, BUILDINGS } from './portSpec.js';
export function makePortTour({engine,walker,ship,port,rebuild}) {
  const views=[];
  const add=(name,eye,target,inside=false)=>views.push({name,eye,target,inside});
  for(const p of PADS) {
    add(`pad-${p.number}-eye`,[p.x-p.w/2-4,1.66,p.z+p.d/2+4],[p.x,1,p.z]);
    add(`pad-${p.number}-above`,[p.x-16,43,p.z+35],[p.x,0,p.z]);
  }
  for(const b of BUILDINGS) {
    if(b.doorW) {
      add(`${b.kind}-door-outside`,[b.x,1.66,b.z+b.d/2+3],[b.x,1.4,b.z]);
      add(`${b.kind}-door-inside`,[b.x,1.66,b.z+b.d/2-3],[b.x,1.4,b.z+b.d/2+8]);
      add(`${b.kind}-interior`,[b.x+2,1.66,b.z+2],[b.x-3,1.3,b.z-3]);
    } else add(`${b.kind}-eye`,[b.x,1.66,b.z+b.d/2+7],[b.x,b.kind==='sign'?4:1.5,b.z]);
  }
  add('ship-ramp-ground',[0,1.66,30],[0,3.6,18]);
  add('port-edge-flat',[103,1.66,45],[116,0,45]);
  add('port-edge-grade',[185,4,45],[103,0,45]);
  add('depot-stock',[-56,1.66,23],[-51.5,1.5,18]);
  add('depot-service',[-62,1.66,23],[-65,1.45,18]);
  add('depot-lift-cart',[-59,1.66,24],[-57,1,21]);
  add('depot-roof',[-81,14,40],[-62,5.5,17]);
  add('tower-reception',[-60,1.66,-35],[-62.5,1.8,-41]);
  add('tower-lift',[-60,1.66,-39],[-56.3,1.6,-41.4]);
  add('tower-cab',[-80,27,-18],[-60,23,-39]);
  for(const [i,x] of [-70,-62,-54,-46].entries())add(`market-trader-${i+1}`,[x,1.66,55.4],[x,1.5,51.4]);
  add('port-from-ship',[0,14,12],[-60,7,8]);
  add('port-one-km',[550,70,840],[-25,11,0]);
  add('pad-02-wear',[51,3,-8],[62,.03,-28]);
  add('earthworks-detail',[100,1.66,50],[103,.3,45]);
  add('ship-ramp-looking-out',[0,1.66,18],[0,-2,35],true);
  let index=-1, saved=null;
  const tour=(which)=>{
    if(which==='list') return views.map(v=>v.name);
    if(which==='off') {
      tour.active=false;
      if(saved) { Object.assign(walker.worldPos,saved.pos); walker.yaw=saved.yaw;walker.pitch=saved.pitch;
        const s=ship(); s.aboard=saved.aboard; if(saved.aboard)s.sw.place(...saved.local); walker.velocity={x:0,y:0,z:0}; rebuild(); }
      saved=null; return 'Port tour off; play restored.';
    }
    if(typeof which==='number') index=((which%views.length)+views.length)%views.length;
    else if(typeof which==='string') { const found=views.findIndex(v=>v.name===which); if(found<0)throw new Error('Unknown port viewpoint: '+which); index=found; }
    else index=(index+1)%views.length;
    const s=ship(),v=views[index];
    if(!saved)saved={pos:{...walker.worldPos},yaw:walker.yaw,pitch:walker.pitch,aboard:s.aboard,local:[s.sw.x,s.sw.y,s.sw.z,s.sw.yaw]};
    if(s.seat)s.stations.stand();
    tour.active=true; tour.current=v;
    const pos=v.inside?s.flight.toWorld({x:v.eye[0],y:v.eye[1]-1.66,z:v.eye[2]}):port.site.toWorld(v.eye[0],v.eye[1]-1.66,v.eye[2]);
    Object.assign(walker.worldPos,pos); s.aboard=v.inside;
    if(v.inside)s.sw.place(v.eye[0],0,v.eye[2],Math.PI);
    // Reveal real sliding doors from both sides, and hold them for the review.
    for(const d of port.doors) { d.progress=1; d.mesh.position.set(d.asset.x+d.asset.doorW+.2,0,d.baseZ); }
    rebuild(); tour.update(); s.late(0); engine.step(0);
    return {index,name:v.name,total:views.length,eye:v.eye,target:v.target};
  };
  tour.active=false; tour.views=views;
  tour.update=()=>{
    const v=tour.current; if(!v)return;
    const s=ship(), convert=(a)=>v.inside?s.flight.toWorld({x:a[0],y:a[1],z:a[2]}):port.site.toWorld(...a);
    const e=convert(v.eye),t=convert(v.target); Object.assign(engine.cameraWorldPos,e);
    engine.camera.position.set(0,0,0); engine.camera.up.set(port.site.up.x,port.site.up.y,port.site.up.z);
    engine.camera.lookAt(new THREE.Vector3(t.x-e.x,t.y-e.y,t.z-e.z));
    s.eyeLocal=s.flight.toLocal(e); s._updateVisuals(0,false);
  };
  return tour;
}
