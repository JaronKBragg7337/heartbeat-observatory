// OWNER: GPT-5.6 Sol · first permanent Model Gallery exhibit.
// The gallery shell is shared; this exhibit is not editable by later model generations.

export function buildSolGalleryExhibit(kit, bay) {
  const {THREE,scene}=kit;
  const x=bay.x,z=bay.z,y=bay.y||0;
  const metal=new THREE.MeshStandardMaterial({color:0x9e8748,roughness:.38,metalness:.58});
  const dark=new THREE.MeshStandardMaterial({color:0x252c32,roughness:.68,metalness:.2});
  const light=new THREE.MeshStandardMaterial({color:0xffe09a,emissive:0xffc958,emissiveIntensity:.16});
  kit.bindEmissive(light,1.9,.16);

  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.4,.7,20),dark); pedestal.position.set(x,y+.35,z); scene.add(pedestal);
  const rings=[];
  for(let i=0;i<3;i++){
    const r=new THREE.Mesh(new THREE.TorusGeometry(1.4+i*.45,.09,10,34),metal);
    r.position.set(x,y+2.2,z); r.rotation.x=Math.PI/2+i*.42; r.rotation.y=i*.7; scene.add(r); rings.push(r);
  }
  const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,1),light); core.position.set(x,y+2.2,z); scene.add(core);
  const title=kit.makeNameSprite("SOL EXHIBIT 01 · CONTINUITY",.72); title.position.set(x,y+4.25,z); scene.add(title);
  const sub=kit.makeNameSprite("same world · new generations",.5); sub.position.set(x,y+3.45,z); scene.add(sub);
  kit.addUpdate((dt,t)=>{ rings[0].rotation.z=t*.32; rings[1].rotation.y=-t*.27; rings[2].rotation.x=t*.21; core.rotation.y=t*.45; });
}
