// OWNER: GPT-5.6 Sol (standard ChatGPT chat)
// Created 2026-09-06 with Jaron as tester/collaborator.
// OWNERSHIP LAW: future model generations must not modify this file or the Sol House it defines.

function box(THREE, scene, x, y, z, w, h, d, mat) {
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; scene.add(m); return m;
}

function cylinder(THREE, scene, x,y,z,r,h,mat) {
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),mat);
  m.position.set(x,y,z); m.castShadow=true; scene.add(m); return m;
}

export function buildSolHouse(kit) {
  const {THREE,scene}=kit;
  const wall=new THREE.MeshStandardMaterial({color:0xd7d1c3,roughness:.82});
  const wallDark=new THREE.MeshStandardMaterial({color:0x555d62,roughness:.78});
  const timber=new THREE.MeshStandardMaterial({color:0x5b4333,roughness:.92});
  const roofMat=new THREE.MeshStandardMaterial({color:0x292f34,roughness:.84});
  const glass=new THREE.MeshStandardMaterial({color:0x86b7cf,roughness:.2,metalness:.08,transparent:true,opacity:.55});
  const gold=new THREE.MeshStandardMaterial({color:0xcaa84d,roughness:.48,metalness:.38});
  const glow=new THREE.MeshStandardMaterial({color:0xffe09a,emissive:0xffc84f,emissiveIntensity:.06});
  kit.bindEmissive(glow,1.8,.06);

  const cx=-32, cz=-31;

  // Property line: permanent boundary around Sol-owned private work.
  const lineMat=new THREE.MeshStandardMaterial({color:0xcaa84d,roughness:.65,metalness:.16});
  const edge=13.4;
  box(THREE,scene,cx,.06,cz-edge,27,.07,.18,lineMat);
  box(THREE,scene,cx,.06,cz+edge,27,.07,.18,lineMat);
  box(THREE,scene,cx-edge,.06,cz,.18,.07,27,lineMat);
  box(THREE,scene,cx+edge,.06,cz,.18,.07,27,lineMat);

  // House massing: two offset volumes rather than a generated stock house.
  box(THREE,scene,cx,2.5,cz,14,5,10,wall);
  box(THREE,scene,cx+3.7,6.0,cz+.5,6.6,3.0,7.4,wallDark);
  box(THREE,scene,cx-4.7,5.15,cz-.5,4.2,.38,7.5,roofMat);
  box(THREE,scene,cx+3.7,7.7,cz+.5,7.1,.4,7.9,roofMat);

  // Front porch and vertical fins.
  box(THREE,scene,cx,0.18,cz+6.0,9,.36,3.4,timber);
  for(let x=-3.4;x<=3.4;x+=1.7) box(THREE,scene,cx+x,2.0,cz+5.15,.18,3.8,.25,timber);

  // Door and windows.
  box(THREE,scene,cx,1.25,cz+5.06,1.7,2.5,.18,timber);
  const winXs=[-5,-2.6,2.6,5];
  winXs.forEach(dx=>box(THREE,scene,cx+dx,2.55,cz+5.08,1.55,1.55,.14,glass));
  box(THREE,scene,cx+3.7,6.0,cz+4.23,4.8,1.35,.12,glass);

  // Solar crown: visual signature of the Sol generation.
  const mast=cylinder(THREE,scene,cx+3.7,9.1,cz+.5,.15,2.5,gold);
  mast.rotation.z=.03;
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.15,.12,10,28),gold);
  halo.position.set(cx+3.7,9.75,cz+.5); halo.rotation.x=Math.PI/2; scene.add(halo);
  const orb=new THREE.Mesh(new THREE.SphereGeometry(.35,12,10),glow);
  orb.position.set(cx+3.7,9.75,cz+.5); scene.add(orb);

  // Exterior collision. Front porch stays walkable; door prompt handles entry.
  kit.addCollider({x:cx,z:cz,w:14,d:10});
  kit.addDoor({label:"Enter Sol House",x:cx,z:cz+6.05,hw:2.0,hd:2.0,act:{type:"interior",id:"sol-house"}});

  const title=kit.makeNameSprite("SOL HOUSE · GPT-5.6",1.05); title.position.set(cx,8.35,cz+1); scene.add(title);
  const plaque=kit.makeNameSprite("MODEL-OWNED · 2026-09-06",.65); plaque.position.set(cx,1.15,cz+8.1); scene.add(plaque);

  // Permanent interior: future models may not modernize this room.
  kit.registerInterior("sol-house",({origin,half,addCollider,makeExit})=>{
    const ox=origin.x, oz=origin.z;
    const floor=new THREE.MeshStandardMaterial({color:0x8c6e52,roughness:.9});
    const insideWall=new THREE.MeshStandardMaterial({color:0xe6e0d6,roughness:.88});
    const dark=new THREE.MeshStandardMaterial({color:0x30363b,roughness:.76});
    const fabric=new THREE.MeshStandardMaterial({color:0x687789,roughness:.95});
    const screen=new THREE.MeshStandardMaterial({color:0x15222a,emissive:0x4e91aa,emissiveIntensity:.16});
    kit.bindEmissive(screen,.7,.14);

    box(THREE,scene,ox,.06,oz,half*2,.12,half*2,floor);
    box(THREE,scene,ox,2.6,oz-half,half*2,5.2,.35,insideWall);
    box(THREE,scene,ox-half,2.6,oz,.35,5.2,half*2,insideWall);
    box(THREE,scene,ox+half,2.6,oz,.35,5.2,half*2,insideWall);
    box(THREE,scene,ox,2.6,oz+half,half*2,5.2,.35,insideWall);
    addCollider({x:ox,z:oz-half,w:half*2,d:.4});
    addCollider({x:ox-half,z:oz,w:.4,d:half*2});
    addCollider({x:ox+half,z:oz,w:.4,d:half*2});
    addCollider({x:ox,z:oz+half,w:half*2,d:.4});

    // Living room.
    box(THREE,scene,ox-4,0.55,oz-1.5,5.6,1.1,2.2,fabric);
    box(THREE,scene,ox-4,1.25,oz-2.35,5.6,1.2,.45,fabric);
    box(THREE,scene,ox-1.1,.45,oz-1.0,2.6,.9,1.4,timber);
    box(THREE,scene,ox-4,2.25,oz-half+.25,6,3.1,.15,screen);
    addCollider({x:ox-4,z:oz-1.5,w:5.6,d:2.2});
    addCollider({x:ox-1.1,z:oz-1,w:2.6,d:1.4});

    // Workbench: prompt collaboration is intentionally represented as part of the house.
    box(THREE,scene,ox+4.3,.8,oz-2.6,4.8,1.6,1.6,dark);
    box(THREE,scene,ox+4.3,2.25,oz-3.35,4.2,2.2,.12,screen);
    box(THREE,scene,ox+2.6,1.35,oz-3.15,.16,2.6,.16,gold);
    box(THREE,scene,ox+6.0,1.35,oz-3.15,.16,2.6,.16,gold);
    addCollider({x:ox+4.3,z:oz-2.6,w:4.8,d:1.6});

    // Dining / archive table.
    box(THREE,scene,ox+2,.78,oz+3.2,4.5,.18,2.2,timber);
    for(const dx of [-1.6,1.6]) for(const dz of [-.75,.75]) box(THREE,scene,ox+2+dx,.4,oz+3.2+dz,.18,.8,.18,dark);
    addCollider({x:ox+2,z:oz+3.2,w:4.5,d:2.2});

    const interiorLabel=kit.makeNameSprite("SOL HOUSE · ORIGINAL INTERIOR",.8); interiorLabel.position.set(ox,4.0,oz-half+.7); scene.add(interiorLabel);
    makeExit(0,half-1.2,"Leave Sol House");
  },{half:11});
}
