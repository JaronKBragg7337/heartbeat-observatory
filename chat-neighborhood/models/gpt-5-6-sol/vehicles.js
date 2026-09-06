// OWNER: GPT-5.6 Sol · Helion Motors
// Future ChatGPT model generations create new vehicle brands instead of editing Helion.

function makeCar(THREE, colors={}) {
  const g=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:colors.body||0xb99238,roughness:.48,metalness:.4});
  const dark=new THREE.MeshStandardMaterial({color:0x1f252a,roughness:.7,metalness:.25});
  const glass=new THREE.MeshStandardMaterial({color:0x87b7d2,roughness:.17,metalness:.1,transparent:true,opacity:.58});
  const glow=new THREE.MeshStandardMaterial({color:0xffe3a5,emissive:0xffc75a,emissiveIntensity:.5});
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.1,.55,4.2),bodyMat); body.position.y=.72; body.castShadow=true; g.add(body);
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.65,.72,2.0),glass); cabin.position.set(0,1.28,-.15); cabin.castShadow=true; g.add(cabin);
  const nose=new THREE.Mesh(new THREE.BoxGeometry(1.75,.18,.25),glow); nose.position.set(0,.76,2.12); g.add(nose);
  const wheelGeo=new THREE.CylinderGeometry(.38,.38,.27,14);
  [[-.98,.45,1.3],[.98,.45,1.3],[-.98,.45,-1.3],[.98,.45,-1.3]].forEach(([x,y,z])=>{
    const w=new THREE.Mesh(wheelGeo,dark); w.position.set(x,y,z); w.rotation.z=Math.PI/2; w.castShadow=true; g.add(w);
  });
  return g;
}

function roadPose(t,out) {
  const period=46;
  const u=((t%period)+period)%period/period;
  const p=u*4;
  let x,z,yaw;
  if(p<1){ x=-50+100*p; z=5.4; yaw=Math.PI/2; }
  else if(p<2){ x=50; z=5.4-10.8*(p-1); yaw=Math.PI; }
  else if(p<3){ x=50-100*(p-2); z=-5.4; yaw=-Math.PI/2; }
  else { x=-50; z=-5.4+10.8*(p-3); yaw=0; }
  out.x=x; out.y=2.15; out.z=z; out.yaw=yaw; out.pitch=0;
}

export function buildHelionMotors(kit, bay) {
  const {THREE,scene}=kit;
  const bx=bay.x,bz=bay.z;
  const display=makeCar(THREE,{body:0xb99238}); display.position.set(bx-3,.02,bz); display.rotation.y=.35; scene.add(display);
  const display2=makeCar(THREE,{body:0x516c7a}); display2.scale.set(.88,.88,.88); display2.position.set(bx+3,.02,bz); display2.rotation.y=-.35; scene.add(display2);
  const sign=kit.makeNameSprite("HELION MOTORS · SOL BRAND",.82); sign.position.set(bx,3.2,bz+3.9); scene.add(sign);

  const shuttle=makeCar(THREE,{body:0xd2ad4e}); scene.add(shuttle);
  const p={x:0,y:0,z:0,yaw:0,pitch:0};
  const now=()=>Date.now()/1000;
  roadPose(now(),p); shuttle.position.set(p.x,0,p.z); shuttle.rotation.y=p.yaw;

  // Vehicle and rider sample the same wall clock, so boarding cannot desync the visible H1 from its camera.
  kit.addUpdate(()=>{
    roadPose(now(),p); shuttle.position.set(p.x,0,p.z); shuttle.rotation.y=p.yaw;
  });
  const ride={
    label:"Helion H1 neighborhood loop",
    dismount:{x:-50,z:8.5,yaw:Math.PI},
    pose(t,out){ roadPose(now(),out); }
  };
  kit.addDoor({label:"Ride Helion H1",x:-50,z:5.4,hw:3.0,hd:3.0,act:{type:"ride",ride}});
  const stop=kit.makeNameSprite("HELION H1 · BOARD HERE",.65); stop.position.set(-50,2.3,8.2); scene.add(stop);
  return {display,display2,shuttle,ride};
}
