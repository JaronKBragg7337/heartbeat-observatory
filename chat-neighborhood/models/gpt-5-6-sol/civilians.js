// OWNER: GPT-5.6 Sol · Sol-01 civilian lineage
// Future model generations create new civilian lineages instead of editing this one.

function part(THREE,group,geo,mat,x,y,z){ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.castShadow=true; group.add(m); return m; }

function makeCitizen(THREE, palette, scale=1) {
  const g=new THREE.Group();
  const cloth=new THREE.MeshStandardMaterial({color:palette.cloth,roughness:.88});
  const skin=new THREE.MeshStandardMaterial({color:palette.skin,roughness:.84});
  const dark=new THREE.MeshStandardMaterial({color:0x252c32,roughness:.8});
  const visor=new THREE.MeshStandardMaterial({color:palette.visor,emissive:palette.visor,emissiveIntensity:.2,roughness:.2,metalness:.15});
  const s=scale;
  part(THREE,g,new THREE.CapsuleGeometry(.28*s,.75*s,4,8),cloth,0,1.05*s,0);
  part(THREE,g,new THREE.SphereGeometry(.32*s,12,9),skin,0,1.78*s,0);
  part(THREE,g,new THREE.BoxGeometry(.46*s,.09*s,.08*s),visor,0,1.82*s,.29*s);
  part(THREE,g,new THREE.BoxGeometry(.18*s,.75*s,.2*s),dark,-.18*s,.38*s,0);
  part(THREE,g,new THREE.BoxGeometry(.18*s,.75*s,.2*s),dark,.18*s,.38*s,0);
  const armL=part(THREE,g,new THREE.BoxGeometry(.15*s,.72*s,.16*s),skin,-.4*s,1.08*s,0);
  const armR=part(THREE,g,new THREE.BoxGeometry(.15*s,.72*s,.16*s),skin,.4*s,1.08*s,0);
  armL.rotation.z=.07; armR.rotation.z=-.07;
  g.userData={armL,armR};
  return g;
}

export function buildSolCivilians(kit) {
  const {THREE,scene}=kit;
  const configs=[
    {x:-23,z:-15,cloth:0x5b6f88,skin:0xb47d5b,visor:0xffc85b,phase:.1},
    {x:-18,z:-26,cloth:0x384b59,skin:0x7a513f,visor:0xffd77c,phase:1.4},
    {x:-18,z:-38,cloth:0x725d72,skin:0xd29a77,visor:0xffc85b,phase:2.7},
    {x:18,z:-19,cloth:0x526d5d,skin:0x9b674b,visor:0xffe19a,phase:3.8},
    {x:18,z:21,cloth:0x6a6250,skin:0xc68e6e,visor:0xffcb68,phase:4.7},
    {x:-19,z:17,cloth:0x4d6375,skin:0x8e5c45,visor:0xffd77c,phase:5.5}
  ];
  const citizens=configs.map((c,i)=>{
    const g=makeCitizen(THREE,c,.96+(i%3)*.06);
    g.position.set(c.x,0,c.z); scene.add(g);
    const tag=kit.makeNameSprite("SOL-01 / "+String(i+1).padStart(2,"0"),.42); tag.position.set(0,2.65,0); g.add(tag);
    return {g,c,baseX:c.x,baseZ:c.z,r:1.4+(i%2)*.8,speed:.28+(i%3)*.05};
  });

  // Simple persistent behavior: local walking, head/body orientation, periodic arm wave.
  kit.addUpdate((dt,t)=>{
    for(let i=0;i<citizens.length;i++){
      const a=citizens[i];
      const ang=t*a.speed+a.c.phase;
      a.g.position.x=a.baseX+Math.cos(ang)*a.r;
      a.g.position.z=a.baseZ+Math.sin(ang)*a.r;
      a.g.rotation.y=-ang;
      const wave=Math.max(0,Math.sin(t*1.6+a.c.phase)-.72)*2.3;
      a.g.userData.armR.rotation.z=-.07-wave*.55;
      a.g.userData.armL.rotation.z=.07+Math.sin(t*4+a.c.phase)*.04;
    }
  });

  const marker=kit.makeNameSprite("SOL-01 CIVILIANS · ORIGINAL LINEAGE",.8); marker.position.set(-18,3.4,-20); scene.add(marker);
  return citizens;
}
