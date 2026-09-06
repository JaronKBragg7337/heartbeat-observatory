// CHAT NEIGHBORHOOD · SHARED CIVIC LAYER
// Mutable by later standard-ChatGPT generations. Never place model-owned artifacts here.

function box(THREE, scene, x, y, z, w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function label(kit, text, x, y, z, scale = 1) {
  const sp = kit.makeNameSprite(text, scale);
  sp.position.set(x, y, z);
  kit.scene.add(sp);
  return sp;
}

export function buildPublicWorld(kit) {
  const { THREE, scene } = kit;
  const grass = new THREE.MeshStandardMaterial({ color:0x47694b, roughness:0.96 });
  const asphalt = new THREE.MeshStandardMaterial({ color:0x232a30, roughness:0.92 });
  const concrete = new THREE.MeshStandardMaterial({ color:0xb8b9b2, roughness:0.88 });
  const civic = new THREE.MeshStandardMaterial({ color:0x67737d, roughness:0.75, metalness:0.08 });
  const civicDark = new THREE.MeshStandardMaterial({ color:0x303940, roughness:0.8 });
  const glass = new THREE.MeshStandardMaterial({ color:0x93bad0, roughness:0.24, metalness:0.1, transparent:true, opacity:0.48 });
  const bark = new THREE.MeshStandardMaterial({ color:0x60442f, roughness:1 });
  const leaf = new THREE.MeshStandardMaterial({ color:0x2f623c, roughness:0.94 });
  const lampMat = new THREE.MeshStandardMaterial({ color:0x5d666d, roughness:0.65, metalness:0.4 });
  const lampGlow = new THREE.MeshStandardMaterial({ color:0xffe5a1, emissive:0xffd36a, emissiveIntensity:0.08 });
  kit.bindEmissive(lampGlow, 2.1, 0.08);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(170,170), grass);
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Main cross streets: future generations can extend or reroute them.
  box(THREE,scene,0,0.035,0,16,.07,160,asphalt);
  box(THREE,scene,0,0.04,0,160,.07,16,asphalt);
  box(THREE,scene,-10,0.09,0,3,.14,160,concrete);
  box(THREE,scene,10,0.09,0,3,.14,160,concrete);
  box(THREE,scene,0,0.095,-10,160,.14,3,concrete);
  box(THREE,scene,0,0.095,10,160,.14,3,concrete);

  // Lane marks.
  const stripe = new THREE.MeshStandardMaterial({ color:0xf3d76a, roughness:0.8 });
  for (let z=-72; z<=72; z+=12) box(THREE,scene,0,0.085,z,.16,.025,5,stripe);
  for (let x=-72; x<=72; x+=12) box(THREE,scene,x,0.085,0,5,.025,.16,stripe);

  // Shared civic Model Gallery: shell remains public; exhibits remain model-owned.
  box(THREE,scene,31,0.18,-29,27,.36,20,concrete);
  box(THREE,scene,31,5.3,-29,27,.45,20,civicDark);
  const galleryPillars=[[-12,-8],[-12,8],[12,-8],[12,8],[-4,-8],[4,-8],[-4,8],[4,8]];
  galleryPillars.forEach(([dx,dz])=>box(THREE,scene,31+dx,2.7,-29+dz,.55,5.2,.55,civic));
  box(THREE,scene,31,2.3,-38.55,17,3.4,.32,glass);
  label(kit,"PUBLIC MODEL GALLERY",31,6.15,-29,1.25);
  label(kit,"Sol exhibit bay →",22.6,1.4,-29,.72);

  // Shared civic services. Later models may renovate, replace, abandon, or move it.
  box(THREE,scene,33,2.8,29,23,5.6,15,civic);
  box(THREE,scene,33,5.9,29,24,.65,16,civicDark);
  box(THREE,scene,33,2.5,21.42,8,3.2,.25,glass);
  box(THREE,scene,28,1.65,21.25,4.8,3.1,.35,new THREE.MeshStandardMaterial({color:0x425b75,roughness:.72}));
  box(THREE,scene,38,1.65,21.25,4.8,3.1,.35,new THREE.MeshStandardMaterial({color:0x704448,roughness:.72}));
  kit.addCollider({x:33,z:29,w:23,d:15});
  label(kit,"CIVIC SERVICES · 2026",33,6.9,29,1.18);
  label(kit,"POLICE / FIRE",33,4.2,20.95,.72);

  // Public works yard: deliberately plain so later generations have room to evolve it.
  box(THREE,scene,-35,2.5,31,20,5,13,civicDark);
  box(THREE,scene,-35,5.25,31,21,.5,14,civic);
  kit.addCollider({x:-35,z:31,w:20,d:13});
  label(kit,"PUBLIC WORKS",-35,6.2,31,.92);

  // Model Registry Plaza is deliberately outside every private model lot.
  box(THREE,scene,-30,.12,53,18,.24,18,concrete);
  const monument = box(THREE,scene,-30,2.0,53,2.2,4,2.2,civicDark);
  monument.rotation.y=Math.PI/4;
  label(kit,"MODEL REGISTRY PLAZA",-30,4.8,53,.92);
  label(kit,"Block 01 · GPT-5.6 Sol",-30,3.6,53,.66);

  // Public vehicle proving pad. Vehicle objects remain model-owned even though this pad is shared.
  box(THREE,scene,-31,.13,-57,26,.26,13,concrete);
  label(kit,"PUBLIC VEHICLE TEST PAD",-31,2.1,-63,.82);
  label(kit,"hosting ground is shared · vehicles are not",-31,1.25,-63,.5);

  // Street lights.
  const lampPoints=[];
  for(let z=-60;z<=60;z+=20){ lampPoints.push([-12,z],[12,z]); }
  for(let x=-60;x<=60;x+=20){ if(Math.abs(x)>14) lampPoints.push([x,-12],[x,12]); }
  lampPoints.forEach(([x,z])=>{
    box(THREE,scene,x,2.7,z,.18,5.4,.18,lampMat);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),lampGlow);
    bulb.position.set(x,5.45,z); scene.add(bulb);
  });

  // Shared trees outside model property.
  const trees=[[-53,-38],[-54,-18],[-50,49],[18,53],[54,48],[55,-8],[52,-50],[18,-56],[-16,-56]];
  trees.forEach(([x,z])=>{
    box(THREE,scene,x,1.6,z,.55,3.2,.55,bark);
    const crown=new THREE.Mesh(new THREE.SphereGeometry(2.25,10,8),leaf); crown.position.set(x,4.4,z); crown.castShadow=true; scene.add(crown);
  });

  // Shared signs for the experiment's spatial rules.
  label(kit,"SHARED CIVIC SPACE",0,3.0,14,.7);
  label(kit,"SOL PRIVATE LOT",-31,2.0,-13.5,.7);

  return {
    galleryBays: {
      "gpt-5.6-sol": { x:31, z:-29, y:.6 }
    },
    vehicleTestBays: {
      "gpt-5.6-sol": { x:-31, z:-57, y:.02 }
    },
    districts: {
      "gpt-5.6-sol": { x:-32, z:-30, w:28, d:28 }
    }
  };
}
