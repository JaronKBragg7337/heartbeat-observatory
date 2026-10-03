import * as THREE from 'three';
import { Kit } from '../ship/shipKit.js';
import { layoutKit } from '../ships/layoutKit.js';
import { Kit3, rng } from './wreckKit.js';
import { buildSkin, buildFrames, buildLining, DAMAGE } from './freighterHull.js';
import { buildInterior, buildWindows } from './freighterInterior.js';

export function passengerCabin(mats,low=false,ext=mats){
  const K=layoutKit({main:0,clear:3,pitch:3,slab:.25});
  K.room('cabin','Passenger cabin','cargo','main',-3,3,-12,14,{h:3});
  K.door('exit','cabin','outside','z',14,0,{kind:'portal',w:2,h:2.7,noZone:true});
  // The collision layout is unchanged: one bench block per seat, so walking never depends on how the wreck looks.
  for(let z=-10;z<12;z+=2.6)for(const s of [-1,1])K.prop('bench','cabin',s*1.75,z,1.2,1,.5);
  const root=new THREE.Group();root.name='opening-cabin';let triangles=0;
  const variant=(pristine)=>{
    DAMAGE.on=!pristine;const ik=new Kit3(low),rnd=rng(pristine?5521:7741);
    ik.tiles={'floor:deck':2,ceil:1.5,metal:1,hull:8};
    const lamps={emerg:new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}),flick:new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false})};
    const inner=buildInterior(ik,low,rnd,pristine);buildLining(ik,low);buildWindows(ik,rnd,pristine);
    const g=ik.toGroup({...mats,...lamps},{name:pristine?'cabin-intact':'cabin-wreck',cast:!low,receive:true});
    triangles+=ik.triangles;let hull=null;
    if(!pristine){const xk=new Kit3(low);xk.tiles={hull:8,metal:1};buildSkin(xk,low,rnd);buildFrames(xk,low,rnd);
      hull=xk.toGroup(ext,{name:'opening-hull',cast:!low,receive:true});g.add(hull);triangles+=xk.triangles;}
    DAMAGE.on=true;root.add(g);return {group:g,lamps,sparks:inner.sparks};
  };
  const intact=variant(true),wreck=variant(false);
  // Before the crash the cabin is whole; after it, it is the wreck. The opening flips them at the impact.
  const fx={intact,wreck,sparks:wreck.sparks,show(stage){intact.group.visible=stage===0;wreck.group.visible=stage>=1;},
    update(t,dt,stage,impact){
      const pre=stage===0&&!impact;
      intact.lamps.emerg.color.setScalar(stage===0&&impact?1:.35);intact.lamps.flick.color.setScalar(1);
      wreck.lamps.emerg.color.setScalar(1);wreck.lamps.flick.color.setScalar(Math.sin(t*37)*Math.sin(t*11.3)>.2?.9:.05);
    }};
  fx.show(1);
  return {root,fx,layout:K.finish({stairs:{},ramps:{},ladders:[],extraZones:[],portals:[],gear:{legs:[]}}),triangles};
}

export function rescueRover(mats,low=false){
  const k=new Kit(),root=new THREE.Group(),wheels=[];
  k.bevelBox('hull',0,.65,0,2.8,.55,5.6,.13);
  k.bevelBox('hull',0,1.08,-1.3,2.4,.55,2.1,.08);
  k.bevelBox('hull',0,2.33,-1.3,2.5,.14,2.3,.04);
  k.bevelBox('hull',0,1.5,-.18,2.4,.8,.12,.03);
  k.box('glassTint',0,1.8,-2.37,2.2,.95,.035);
  k.bevelBox('plasticDark',0,1.3,-2.1,2.25,.3,.5,.045);
  k.box('glowBlue',-.55,1.47,-2.08,.52,.035,.3);
  k.pipe('metal',[-.55,1.28,-1.95],[-.55,1.5,-1.6],.04,8);
  k.cyl('rubber',-.55,1.5,-1.6,.2,.045,16,{axis:'z'});
  for(const x of [-.55,.55]){
    k.bevelBox('fabricGrey',x,1.14,-1.15,.7,.2,.7,.06);
    k.bevelBox('fabricGrey',x,1.52,-.8,.7,.8,.16,.06);
    k.pipe('metal',[x,.9,-1.15],[x,1.1,-1.15],.07,8);
  }
  for(const s of [-1,1]){k.box('glassTint',s*1.21,1.8,-1.4,.025,.9,1.8);
    k.pipe('metal',[s*1.22,1.25,-2.38],[s*1.22,2.3,-2.38],.045,8);
    k.pipe('metal',[s*1.22,1.25,-.18],[s*1.22,2.3,-.18],.045,8);
    k.bevelBox('hull',s*1.21,1.23,-1.4,.1,.25,1.8,.025);
    k.box('hazard',s*1.27,1.21,-1.4,.015,.09,.6);
    k.box('glowCool',s*.85,1.02,-2.8,.45,.16,.12);
    k.pipe('metal',[s*1.2,.98,.1],[s*1.2,1.8,2.5],.055,8);
    k.bevelBox('fabricGrey',s*.7,1.01,.8,.65,.2,1.2,.06);
    k.bevelBox('fabricGrey',s*.7,1.45,1.36,.65,.8,.16,.06);
    for(const z of [-1.8,0,1.8]){
      k.pipe('metal',[s*.75,.7,z],[s*1.7,.6,z],.07,8);
      const wheel=new THREE.Group(),wk=new Kit();wk.cyl('rubber',0,0,0,.63,.35,low?14:24,{axis:'x'});
      wk.cyl('metal',s*.2,0,0,.32,.07,12,{axis:'x'});
      for(let i=0;i<16;i++){const a=i*Math.PI/8;wk.box('rubber',0,Math.cos(a)*.62,Math.sin(a)*.62,.37,.09,.09);}
      wheel.add(wk.toGroup(mats));wheel.position.set(s*1.6,.63,z);root.add(wheel);wheels.push(wheel);
    }
  }
  k.box('hazard',0,.98,2.8,2.6,.12,.04);
  k.bevelBox('crateA',0,1.2,2.1,1.3,.5,.7,.05);
  k.cyl('metal',1.1,2.8,-.5,.025,1.5,8);
  root.add(k.toGroup(mats,{name:'opening-rover',cast:!low,receive:true}));
  const light=new THREE.SpotLight(0xe2eaff,low?0:45,70,.55,.7,1.5);light.position.set(0,1.3,-2.5);
  light.target.position.set(0,0,-40);root.add(light,light.target);
  return {root,wheels,light,triangles:k.triangles};
}
export function supplyCrate(mats){
  // A hard-shell survivor supply case: ribbed body, rubber corner guards, latches, a stencilled band and a small beacon.
  const k=new Kit3();k.tiles={metal:1};
  k.bevelBox('crateA',0,.25,0,.7,.4,.56,.05,{col:[1,.95,.82]});          // body
  k.bevelBox('crateA',0,.5,0,.72,.1,.58,.04,{col:[1.08,1.02,.9]});       // lid
  k.box('rubber',0,.447,0,.725,.012,.585);                                  // gasket
  for(const sz of [-1,1])for(let i=-3;i<=3;i++){k.bevelBox('steelDark',i*.095,.25,sz*.286,.035,.34,.022,.008);}
  for(const sx of [-1,1]){k.bevelBox('steelDark',sx*.356,.25,0,.022,.3,.4,.01);k.bevelBox('gunmetal',sx*.37,.34,0,.03,.07,.2,.012);k.bevelBox('rubber',sx*.378,.34,0,.012,.045,.17,.005);}
  for(const sx of [-1,1])for(const sz of [-1,1]){k.bevelBox('rubber',sx*.33,.05,sz*.265,.1,.1,.1,.025);k.bevelBox('rubber',sx*.335,.5,sz*.27,.1,.1,.1,.025);}
  for(const sx of [-.2,.2]){k.bevelBox('steel',sx,.43,.292,.08,.08,.03,.01);k.bevelBox('red',sx,.41,.31,.05,.025,.01,.005,{col:[.9,.4,.3]});}
  k.box('hazard',0,.25,.292,.5,.1,.004);                                    // stencilled band
  for(let i=0;i<9;i++)k.box('gunmetal',-.2+i*.05,.25,.295,.02+(i%3)*.008,.06,.003);
  k.bevelBox('white',-.27,.37,.291,.07,.04,.004,.002);k.box('red',.26,.37,.292,.07,.012,.004);
  k.bevelBox('gunmetal',0,.57,0,.22,.035,.12,.012);k.cyl('steel',.2,.575,.18,.012,.03,6);k.pipe('steel',[.2,.575,.18],[.2,.82,.2],.006,5);
  const g=k.toGroup(mats,{name:'opening-carry',cast:true,receive:true});
  const led=new THREE.MeshBasicMaterial({color:0x40ff80,toneMapped:false}),m=new THREE.Mesh(new THREE.BoxGeometry(.045,.025,.045),led);
  m.position.set(.2,.83,.2);g.add(m);g.userData.led=led;return g;}

export function stormSky(low=false){
  // One bounded transparent ribbon mesh. No full-screen postprocessing or per-particle draw calls.
  const positions=[],uv=[],indices=[];
  for(let band=0;band<5;band++)for(let i=0;i<=48;i++){
    const a=(i/48-.5)*Math.PI*1.5,r=5000+band*350;
    for(const edge of [0,1]){positions.push(Math.sin(a)*r,950+band*230+Math.sin(a*5+band)*160+edge*230,Math.cos(a)*r-800);
      uv.push(i/48,edge+band*2);}
    if(i<48){const n=band*98+i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);
  const uniforms={time:{value:0},strength:{value:.2}};
  const mat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 v;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`uniform float time;uniform float strength;varying vec2 v;
      #include <logdepthbuf_pars_fragment>
      void main(){float y=fract(v.y/2.)*2.;float edge=sin(clamp(y,0.,1.)*3.14159);
      float folds=.55+.45*sin(v.x*90.+sin(v.x*23.+time*.08)*4.+time*.17);
      float ray=.78+.22*sin(v.x*70.+sin(v.x*13.+time*.12)*4.);
      vec3 color=mix(vec3(.32,.85,.78),vec3(.62,.24,.62),pow(y,.7));
      gl_FragColor=vec4(color*folds*ray*(1.25-y*.5),edge*edge*strength*.8);
      #include <logdepthbuf_fragment>
      }`});
  const mesh=new THREE.Mesh(g,mat);mesh.frustumCulled=false;
  return {mesh,uniforms,triangles:indices.length/3};
}
export function driftingDust(low=false){
  const n=low?100:320,positions=new Float32Array(n*3);
  for(let i=0;i<n;i++){positions[i*3]=Math.sin(i*23.17)*12;positions[i*3+1]=(i%37)/37*3.3;positions[i*3+2]=(i%71)/71*32-12;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));
  let map;if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=c.height=32;
    const ctx=c.getContext('2d'),gradient=ctx.createRadialGradient(16,16,0,16,16,16);
    gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.3,'#ffffffaa');gradient.addColorStop(1,'#ffffff00');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);map=new THREE.CanvasTexture(c);
  }
  const material=new THREE.PointsMaterial({color:0xb99a80,size:.035,map,transparent:true,opacity:.2,depthWrite:false});
  const dust=new THREE.Points(g,material);dust.userData.seed=positions.slice();return dust;
}
