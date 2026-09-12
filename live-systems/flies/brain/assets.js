import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Metres. Regulation envelope; undercarriage and paddle are illustrative construction.
export const dimensions={length:2.74,width:1.525,height:.76,netHeight:.1525};
export function buildTable(scene){
 const root=new THREE.Group();root.position.y=-2;root.name='TABLE';root.userData.assetId='TABLE';scene.add(root);
 const loader=new THREE.TextureLoader();
 const texture=(name,srgb=false)=>{const t=loader.load(`textures/wood-${name}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1.7,1.9);if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;};
 const wood=new THREE.MeshStandardMaterial({map:texture('color',true),roughnessMap:texture('roughness'),normalMap:texture('normalgl'),normalScale:new THREE.Vector2(.18,.18),roughness:.8});
 const paint=new THREE.MeshStandardMaterial({color:0x154b60,roughnessMap:texture('roughness'),roughness:.85});
 const steel=new THREE.MeshStandardMaterial({color:0x39434b,metalness:.75,roughness:.4}),white=new THREE.MeshStandardMaterial({color:0xe5e7df,roughness:.8}),rubber=new THREE.MeshStandardMaterial({color:0x151819,roughness:.95});
 const assets=[];
 function add(id,geo,mat,pos,parent=root){const o=new THREE.Mesh(geo,mat);o.name=id;o.userData.assetId=id;o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function box(id,size,mat,pos,parent=root){return add(id,new THREE.BoxGeometry(...size),mat,pos,parent);}
 function rod(id,a,b,r,mat,parent=root){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const o=add(id,new THREE.CylinderGeometry(r,r,delta.length(),8),mat,av.add(bv).multiplyScalar(.5).toArray(),parent);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
 for(const sign of [-1,1]){
  const id=sign<0?'TABLE.A':'TABLE.B';const top=box(id,[1.37,.025,1.525],wood,[sign*.685,.7475,0]);assets.push(top);
  box(id+'.paint',[1.37,.0006,1.525],paint,[sign*.685,.7603,0]);
  for(const z of [-.7525,.7525])box(id+'.sideline.'+z,[1.37,.0008,.02],white,[sign*.685,.761,z]);
  box(id+'.endline',[.02,.0008,1.525],white,[sign*1.36,.761,0]);box(id+'.centreline',[1.37,.0008,.003],white,[sign*.685,.761,0]);
  for(const z of [-.69,.69])box(id+'.apron.'+z,[1.32,.065,.025],steel,[sign*.685,.7,z]);
  for(const x of [sign*.35,sign*1.1]){
   box(id+'.crossmember.'+x,[.035,.045,1.36],steel,[x,.7,0]);
   for(const z of [-.58,.58]){
    box(id+'.leg.'+x+'.'+z,[.035,.6,.035],steel,[x,.395,z]);
    rod(id+'.brace.'+x+'.'+z,[x,.25,z],[sign*.7,.68,z],.009,steel);
    const wheel=add(id+'.wheel.'+x+'.'+z,new THREE.CylinderGeometry(.048,.048,.03,20),rubber,[x,.048,z]);wheel.rotation.x=Math.PI/2;
    box(id+'.caster.'+x+'.'+z,[.06,.045,.046],steel,[x,.097,z]);
    rod(id+'.bolt.'+x+'.'+z,[x,.67,z-.022],[x,.67,z+.022],.007,white);
   }
  }
 }
 const net=new THREE.Group();net.name='NET';net.userData.assetId='NET';root.add(net);assets.push(net);
 // 12 mm woven spacing, modelled as shared line geometry; no solid wireframe box.
 const lines=[];for(let z=-.88;z<=.88;z+=.012)lines.push(0,.766,z,0,.9125,z);for(let y=.766;y<=.9125;y+=.012)lines.push(0,y,-.88,0,y,.88);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));const weave=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x293d43,transparent:true,opacity:.8}));weave.name='NET.weave';weave.userData.assetId=weave.name;net.add(weave);
 box('NET.top-tape',[.006,.014,1.78],white,[0,.9055,0],net);
 for(const z of [-.89,.89]){rod('NET.post.'+z,[0,.72,z],[0,.916,z],.009,steel,net);box('NET.clamp.'+z,[.08,.025,.18],steel,[0,.722,z>0?.8:-.8],net);rod('NET.screw.'+z,[0,.695,z],[0,.74,z],.004,white,net);}
 const paddle=new THREE.Group();paddle.name='PADDLE';paddle.userData.assetId='PADDLE';paddle.position.set(.81,.771,.4);paddle.rotation.y=-.4;root.add(paddle);assets.push(paddle);
 const paddleWood=wood.clone();for(const key of ['map','normalMap','roughnessMap']){paddleWood[key]=wood[key].clone();paddleWood[key].repeat.set(.15/.8,.16/.8);}
 const blade=add('PADDLE.blade',new THREE.CylinderGeometry(1,1,.006,48),paddleWood,[0,0,0],paddle);blade.scale.set(.075,1,.08);
 const face=add('PADDLE.red-rubber',new THREE.CylinderGeometry(1,1,.002,48),new THREE.MeshStandardMaterial({color:0x982b31,roughness:.93}),[0,.004,0],paddle);face.scale.set(.074,1,.079);
 const handleWood=wood.clone();for(const key of ['map','normalMap','roughnessMap']){handleWood[key]=wood[key].clone();handleWood[key].repeat.set(.028/.8,.1/.8);}
 box('PADDLE.handle',[.028,.018,.1],handleWood,[0,0,.116],paddle);
 const floor=box('FLOOR',[6,.025,5],new THREE.MeshStandardMaterial({color:0x111a21,roughness:.95}),[0,-.014,0]);assets.push(floor);
 return {root,assets,net};
}

export async function loadMeasuredFly(scene){
 const gltf=await new GLTFLoader().loadAsync('fly.glb'),model=gltf.scene;
 const holder=new THREE.Group();holder.name='FLY';holder.userData.assetId='FLY';holder.scale.setScalar(160);holder.rotation.y=-.35;holder.add(model);scene.add(holder);
 // Source already in metres. Explicit 160Ãƒâ€” display magnification, never normalization.
 const bounds=new THREE.Box3().setFromObject(holder);holder.position.set(-.67,-1.237-bounds.min.y,.28);
 const joints=[],bodies=[];model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.material.side=THREE.DoubleSide;}if(n.userData.jointsJson){const spec=JSON.parse(n.userData.jointsJson);n.userData.rest=n.quaternion.clone();n.userData.joints=spec;bodies.push(n);if(spec.length)joints.push(n);}});
 const rotation=new THREE.Quaternion();
 function update(v,pressAge,t,reduced){
  const approach=typeof v==='number'&&v>20,groom=typeof v==='number'&&v< -15;
  for(const node of joints){node.quaternion.copy(node.userData.rest);for(const joint of node.userData.joints){let angle=0;const name=joint.name;
   if(name.startsWith('wing_roll_'))angle=approach?-.75:0;
   if(/^(coxa|femur|tibia)_T1_/.test(name)){
    if(groom)angle=(name.startsWith('coxa')?.8:name.startsWith('femur')?.6:.8)*(reduced?1:.75+.25*Math.sin(t*.006));
    if(pressAge>=0&&pressAge<700&&name.endsWith('left'))angle+=(name.startsWith('coxa')?.9:name.startsWith('femur')?.45:.3)*Math.sin(pressAge/700*Math.PI);
   }
   angle=THREE.MathUtils.clamp(angle,...joint.range);node.quaternion.multiply(rotation.setFromAxisAngle(new THREE.Vector3(...joint.axis),angle));
  }}
 }
 return {holder,bodies,joints,update};
}

export function debugAssets(scene,camera,viewport,button){
 const overlay=document.createElement('div');overlay.className='asset-debug';overlay.hidden=true;viewport.append(overlay);
 const select=document.createElement('select');select.className='asset-picker';select.setAttribute('aria-label','Inspect asset ID');overlay.append(select);
 let enabled=false,labels=[];const overview=new Set(['TABLE.A','TABLE.B','NET','PADDLE','FLY','BRAIN.atlas']);
 function refresh(){for(const {el} of labels)el.remove();labels=[];select.replaceChildren(new Option('Overview / coordinates in metres',''));
  scene.traverse(o=>{if(!o.userData.assetId)return;const id=o.userData.assetId,el=document.createElement('span');el.className='asset-bubble';overlay.append(el);labels.push({o,el});select.append(new Option(id,id));});}
 button.onclick=()=>{enabled=!enabled;button.setAttribute('aria-pressed',String(enabled));overlay.hidden=!enabled;if(enabled)refresh();};
 function update(){if(!enabled)return;for(const {o,el} of labels){const id=o.userData.assetId;if(select.value?select.value!==id:!overview.has(id)){el.hidden=true;continue;}
  const p=o.getWorldPosition(new THREE.Vector3());if(overview.has(id)&&id!=='BRAIN.atlas')new THREE.Box3().setFromObject(o).getCenter(p);
  const screen=p.clone().project(camera),x=(screen.x*.5+.5)*viewport.clientWidth,y=(-screen.y*.5+.5)*viewport.clientHeight;
  el.hidden=screen.z>1||screen.z< -1;el.style.left=`${Math.max(4,Math.min(x,viewport.clientWidth-180))}px`;el.style.top=`${Math.max(78,Math.min(y,viewport.clientHeight-108))}px`;el.textContent=`${id} (${p.toArray().map(n=>n.toFixed(2)).join(', ')})`;
 }}return {update,refresh};
}
