// Fixed named review cameras. Physics pauses during a tour; off restores play.
import * as THREE from 'three';
import { PADS, BUILDINGS, TOWER } from './portSpec.js';
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
  add('depot-service',[-65,1.66,20.5],[-65,1.4,15.5]);
  add('depot-lift-cart',[-59,1.66,24],[-57,1,21]);
  add('depot-roof',[-81,14,40],[-62,5.5,17]);
  add('tower-reception',[-60,1.66,-35],[-62.5,1.8,-41]);
  // Lift views use the actual moving car; cab views remain at their original spots.
  const tw=(lx,y,lz)=>[TOWER.x+lx,y,TOWER.z+lz], cy=TOWER.cab.floorY;
  add('tower-elevator-call',tw(.5,1.66,2),tw(.3,1.2,.5));
  add('tower-elevator-car',tw(0,1.66,-.7),tw(0,1.3,-2.3));
  add('tower-elevator-shaft',tw(0,12+1.66,-.7),tw(1.17,13,-1.6));
  add('tower-elevator-cab-door',tw(0,cy+1.66,2),tw(0,cy+1.3,.1));
  add('tower-elevator-exit',tw(0,cy+1.66,-.1),tw(0,cy+1.5,1.8));
  add('tower-cab-south',tw(0,cy+1.66,2.4),tw(0,cy+1.5,7));
  add('tower-cab-west',tw(-1.6,cy+1.66,.6),tw(-7,cy+1.5,.6));
  add('tower-cab-east',tw(1.6,cy+1.66,.6),tw(7,cy+1.5,.6));
  add('tower-cab-looking-in',tw(5.5,cy+1.66,5.5),tw(-2,cy+1.0,-1));
  add('tower-cab-north-walk',tw(-5.2,cy+1.66,-5.9),tw(5,cy+1.5,-5.9));
  add('tower-mast-from-the-apron',tw(-18,1.66,18),tw(0,17,-1));
  add('tower-cab',[-84,23,-12],[-60,24,-39]);
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
        Object.assign(port.elevator,saved.lift);port.updateElevatorVisuals();
        const s=ship(); s.aboard=saved.aboard; if(saved.aboard)s.sw.place(...saved.local); walker.velocity={x:0,y:0,z:0}; rebuild(); }
      saved=null; return 'Port tour off; play restored.';
    }
    if(typeof which==='number') index=((which%views.length)+views.length)%views.length;
    else if(typeof which==='string') { const found=views.findIndex(v=>v.name===which); if(found<0)throw new Error('Unknown port viewpoint: '+which); index=found; }
    else index=(index+1)%views.length;
    const s=ship(),v=views[index];
    if(!saved)saved={pos:{...walker.worldPos},yaw:walker.yaw,pitch:walker.pitch,aboard:s.aboard,local:[s.sw.x,s.sw.y,s.sw.z,s.sw.yaw],lift:{...port.elevator}};
    if(s.seat)s.stations.stand();
    tour.active=true; tour.current=v;
    // Review poses only; off restores the lift as well as the player.
    if(v.name.startsWith('tower-elevator-')) {
      const y=v.name==='tower-elevator-shaft'?12:v.name.includes('cab')||v.name.includes('exit')?TOWER.cab.floorY:0;
      Object.assign(port.elevator,{y,target:y,speed:0,phase:'open',open:v.name==='tower-elevator-shaft'?0:1});
      port.updateElevatorVisuals();
    }
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
