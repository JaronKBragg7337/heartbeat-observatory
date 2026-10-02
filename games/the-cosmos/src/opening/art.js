import * as THREE from 'three';
import { Kit } from '../ship/shipKit.js';
import { layoutKit } from '../ships/layoutKit.js';

export function passengerCabin(mats,low=false){
  const k=new Kit(),K=layoutKit({main:0,clear:3,pitch:3,slab:.25});
  K.room('cabin','Passenger cabin','cargo','main',-3,3,-12,14,{h:3});
  K.door('exit','cabin','outside','z',14,0,{kind:'portal',w:2,h:2.7,noZone:true});
  for(let z=-10;z<12;z+=2.6){
    for(const s of [-1,1]){
      k.bevelBox('fabricBlue',s*1.75,.44,z,1.2,.22,.8,.1);
      k.bevelBox('fabricBlue',s*1.75,.98,z+.38,1.2,1.05,.22,.08);
      for(const dx of [-.5,.5]){k.bevelBox('metal',s*1.75+dx,.5,z,.07,.07,1,.02);k.pipe('metal',[s*1.75+dx,.15,z],[s*1.75+dx,.45,z],.03,8);}
      for(const dx of [-.25,.25])k.box('plasticDark',s*1.75+dx,1.02,z+.235,.065,.9,.03);
      k.box('hazard',s*1.75,.55,z+.1,.32,.06,.04);
      K.prop('bench','cabin',s*1.75,z,1.2,1,.5);
    }
    k.box('metal',0,3.03,z,6.3,.12,.14);
    for(const s of [-1,1]){
      k.bevelBox('paint',s*3.05,.5,z,.15,1,2.6,.03);
      k.bevelBox('paint',s*3.05,2.7,z,.15,.6,2.6,.03);
      for(const dz of [-1.25,1.25])k.bevelBox('metal',s*3.05,1.8,z+dz,.16,1.7,.13,.03);
      // Real window openings, with a fractured end section visible after the transition.
      if(z<7)k.box('glassTint',s*3.08,1.8,z,.015,1.7,2.3);
      for(let dz=-1;dz<1.1;dz+=.4)k.cyl('steel',s*2.95,.8,z+dz,.022,.02,6,{axis:'x'});
      k.pipe('pipeBlue',[s*2.88,2.98,z-1.3],[s*2.88,2.98,z+1.3],.035,8);
    }
    k.box('glowCool',0,2.94,z,1.3,.03,.13);
  }
  k.bevelBox('floor:deck',0,-.13,1,6.2,.26,26,.06);
  k.bevelBox('ceil',0,3.16,-2,6.3,.22,20,.05);
  k.box('paint',0,1.5,-12.1,6.2,3,.18);
  for(const s of [-1,1])k.bevelBox('paint',s*2,1.4,14,2,2.8,.18,.03);
  k.pipe('metal',[-3,3,7],[1.8,2.65,11],.08,10);
  k.pipe('metal',[2.9,2.95,8],[2.6,1.4,13],.065,10);
  for(let i=0;i<8;i++)k.prism('metal',[[2.8,8+i*.7],[3.6+(i%3)*.3,8.1+i*.7],[2.8,8.6+i*.7]],1.05,1.12,.01,.01);
  // Outer pressure skin and scarred structural ribs, with an open torn stern.
  k.bevelBox('hull',0,-.36,0,6.7,.3,25,.08);
  k.bevelBox('hull',0,3.38,-2,6.7,.25,20,.08);
  for(const s of [-1,1]){
    k.bevelBox('hull',s*3.25,.38,-2,.18,1.2,20,.04);
    k.bevelBox('hull',s*3.25,2.85,-2,.18,.5,20,.04);
    for(let z=-11;z<8;z+=2.6)k.bevelBox('metal',s*3.3,1.65,z,.12,2.8,.18,.025);
    k.prism('hull',[[s*3.1,8],[s*4.3,11],[s*3.6,13.4],[s*3,12]],.05,.32,.03,.03);
    for(let i=0;i<4;i++)k.prism('hull',[[s*3.1,8+i*1.2],[s*(3.6+i*.15),8.7+i*1.2],[s*3.1,9.1+i*1.2]],1.2,1.32,.015,.015);
  }
  k.prism('hull',[[-3.3,-12],[3.3,-12],[1.8,-17],[-1.8,-17]],-.36,2.7,.08,.15);
  const root=k.toGroup(mats,{name:'opening-cabin',cast:!low,receive:true});
  return {root,layout:K.finish({stairs:{},ramps:{},ladders:[],extraZones:[],portals:[],gear:{legs:[]}}),triangles:k.triangles};
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
export function supplyCrate(mats){const k=new Kit();k.bevelBox('crateB',0,.24,0,.68,.48,.55,.045);
  for(const x of [-.24,.24])k.box('metal',x,.24,0,.065,.49,.57);
  k.bevelBox('metal',0,.49,0,.22,.045,.12,.015);k.box('hazard',0,.27,.282,.3,.13,.008);
  for(const s of [-1,1]){
    k.bevelBox('gunmetal',s*.34,.25,0,.045,.13,.25,.015);
    k.box('metal',s*.366,.25,0,.012,.05,.16);
    for(const x of [-.24,.24])for(const y of [.07,.41])k.cyl('steel',x,y,s*.294,.018,.012,6,{axis:'z'});
    k.bevelBox('gunmetal',s*.17,.42,-.292,.08,.1,.025,.01);
  }
  for(let i=0;i<12;i++)k.box('gunmetal',-.1+i*.016,.14,.282,.005,.06,.005);
  return k.toGroup(mats,{name:'opening-carry',cast:true,receive:true});}

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
      vec3 color=mix(vec3(.16,.48,.68),vec3(.75,.22,.1),y);
      gl_FragColor=vec4(color*folds,edge*strength*.65);
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
