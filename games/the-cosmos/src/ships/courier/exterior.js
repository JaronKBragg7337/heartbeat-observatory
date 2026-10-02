import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { COURIER } from './def.js';

export function buildCourierExterior(layout,mats,opts={}) {
  const root=new THREE.Group(),k=new Kit();root.name='wayfarer-hull';k.tiles={hull:8,metal:1};
  const ext={root,legs:[],ramps:{},guns:{main:[]},engines:[],liftPods:[],triangles:0,airlockX:3.6};
  // Exterior skins stay outside the collision rooms; the side hatch and stern ramp remain open.
  k.bevelBox('hull',0,-.28,0,7.2,.5,21.6,.15);
  k.bevelBox('hull',0,3.15,0,7.2,.3,9.6,.1);
  k.bevelBox('hull',0,3.35,8.3,7.2,.3,5,.1);
  for(const s of [-1,1]){
    for(let z=-4;z<10.4;z+=1.2){
      if(s===1&&z>-.1&&z<2.9)continue;
      k.bevelBox('hull',s*3.53,1.4,z,.18,2.9,1.1,.04,{col:z%3<1?[.65,.58,.45]:[.8,.76,.66]});
      k.box('metal',s*3.64,1.7,z,.015,.5,.65,{col:[.35,.32,.28]});
      for(const y of [.3,2.7])for(const dz of [-.4,.4])k.cyl('steel',s*3.66,y,z+dz,.025,.02,6,{axis:'x'});
    }
    k.prism('hull',[[s*2.4,-9],[s*3.5,-5.1],[s*4.5,6],[s*3.5,9]],.1,.45,.08,.08);
    for(let z=-8.8;z< -5.2;z+=.85)k.pipe('metal',[s*2.4,1.05,z],[s*2.4,2.7,z+.5],.035,8);
    k.pipe('metal',[s*2.4,2.7,-8.5],[s*2.4,2.7,-5.2],.05,8);
    k.bevelBox('hullDark',s*2.7,1.4,11,1.7,2.8,.3,.1);
    k.cyl('engine',s*2.7,1.4,11.6,.65,1.2,16,{axis:'z'});
    k.lathe('metal',s*2.7,1.4,12.1,[[.5,0],[.65,.4],[.75,.8],[.65,.8],[.45,0]],16,{axis:'z'});
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.55,3,12,1,true),mats.engineGlow.clone());
    flame.rotation.x=-Math.PI/2;flame.position.set(s*2.7,1.4,14);flame.name='exhaust';root.add(flame);
    const core=flame.clone();core.material=mats.nozzleInner.clone();root.add(core);ext.engines.push({outer:flame,core,side:s});
    k.box(s===1?'glowGreen':'glowRed',s*4.5,.5,6,.1,.08,.2);
    const gun=new THREE.Group();gun.position.set(s, .5,-9.5);const gk=new Kit();gk.cyl('gunmetal',0,0,-.5,.08,1,10,{axis:'z'});
    gun.add(gk.toGroup(mats));root.add(gun);ext.guns.main.push({group:gun,muzzle:new THREE.Vector3(0,0,-1)});
  }
  for(let i=0;i<16;i++){
    const x=((i*13)%17-8)*.35,z=-3.8+i*.84;
    k.box('metal',x,3.325,z,.5+(i%3)*.2,.015,.24,{col:i%2?[.23,.2,.17]:[.66,.55,.4]});
  }
  for(const [x,z] of [[-2,-3],[2,-3],[-2,7],[2,7]]){
    k.cyl('engine',x,-.65,z,.5,.3,12);const mesh=new THREE.Mesh(new THREE.ConeGeometry(.35,3,10,1,true),mats.engineGlow.clone());
    mesh.position.set(x,-2.2,z);mesh.name='exhaust';root.add(mesh);const core=mesh.clone();root.add(core);
    ext.liftPods.push({x,y:-.8,z,mesh,core});
  }
  ext.staticGroup=k.toGroup(mats,{name:'courier-plates',cast:true,receive:true});root.add(ext.staticGroup);ext.triangles=k.triangles;
  for(const leg of COURIER.gear.legs){
    const group=new THREE.Group();group.position.set(leg.x,0,leg.z);
    const pk=new Kit();pk.cyl('metal',0,-.5,0,.15,1,12);const piston=new THREE.Group();piston.add(pk.toGroup(mats));group.add(piston);
    const fk=new Kit();fk.bevelBox('gunmetal',0,-.13,0,1.3,.25,1.1,.05);const foot=fk.toGroup(mats,{cast:true});group.add(foot);root.add(group);
    ext.legs.push({...leg,group,piston,foot});
  }
  for(const [key,R] of Object.entries(COURIER.ramps)){
    const hinge=new THREE.Group();hinge.position.set(R.hinge.x,R.hinge.y,R.hinge.z);const rk=new Kit();
    rk.bevelBox('hullDark',0,-.08,R.length/2,R.width,.16,R.length,.04);
    for(let z=.2;z<R.length;z+=.3)rk.box('metal',0,.02,z,R.width-.12,.02,.06);
    for(const s of [-1,1])rk.box('glowAmber',s*(R.width/2-.04),.05,R.length/2,.04,.02,R.length-.2);
    const mesh=rk.toGroup(mats,{cast:true,receive:true});hinge.add(mesh);root.add(hinge);ext.ramps[key]={hinge,mesh,def:R};
  }
  if(opts.remote){const gk=new Kit(),b=layout.roomById.get('bridge');
    gk.poly('glassTint',[[b.x0,1.05,b.z0],[b.x1,1.05,b.z0],[b.x1,2.7,b.z0+.5],[b.x0,2.7,b.z0+.5]]);
    root.add(gk.toGroup(mats));}
  return ext;
}
export function courierNeutral(ext){for(const l of ext.legs){l.foot.position.y=-1.6;l.piston.scale.y=1.8;l.piston.position.y=.2;}
  ext.ramps.cargo.hinge.rotation.x=-Math.PI/2;ext.ramps.airlock.hinge.rotation.set(-Math.PI/2,Math.PI/2,0);}
