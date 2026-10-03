// Architecture and fittings use the same bevels, PBR surfaces and prop kit as
// Meridian. All static details are written into material buckets, never meshes.
import { drawProp, PROPS } from '../ship/shipProps.js';
import { CELLS, plaque, atlasUV, wallDecal, groundDecal } from './portArt.js';
import { TOWER } from './portSpec.js';

const B=(k,m,x,y,z,w,h,d,c=.035)=>k.bevelBox(m,x,y,z,w,h,d,c);
const prop=(k,kind,x,y,z,w,h,d,rot=0)=>drawProp(k,{kind,x,y,z,w,h,d,rot});
function rivets(k,x,y,z,w,h) {
  for(const dx of [-w/2+.08,w/2-.08])for(const dy of [-h/2+.08,h/2-.08])
    k.cyl('steel',x+dx,y+dy,z,.024,.018,6,{axis:'z'});
}
function window(k,x,y,z,w,h,rot=0) {
  k.push(x,y,z,rot);
  B(k,'gunmetal',0,0,0,w+.18,h+.18,.08,.035);
  // Recessed illuminated opaque glazing keeps the phone tier free of glass overdraw.
  k.box('glowCool',0,0,.044,w,h,.012,{col:[.13,.24,.28]});
  for(let dx=-w/2+.55;dx<w/2;dx+=.7)k.box('steelDark',dx,0,.065,.04,h,.04);
  k.box('glowAmber',0,-h/2+.035,.066,w-.1,.025,.012);
  rivets(k,0,0,.07,w+.15,h+.15);k.pop();
}
function lamp(k,x,y,z,w=1.4,ceiling=null) {
  B(k,'steelDark',x,y,z,w+.12,.13,.28,.025);
  k.box('glowWhite',x,y-.074,z,w,.025,.18);
  for(const dx of [-w*.35,w*.35])k.pipe('steel',[x+dx,y+.05,z],[x+dx,ceiling?ceiling(x+dx):y+.32,z],.018,6);
}
function screen(k,cell,x,y,z,w,h,rot=0) {
  k.push(x,y,z,rot);B(k,'gunmetal',0,0,0,w+.14,h+.14,.1,.04);
  plaque(k,cell,0,0,.056,w,h);k.box('glowGreen',w/2-.05,-h/2-.04,.058,.035,.015,.006);k.pop();
}
function stockTag(k,x,y,z,w,h,row) {
  const u=.5, v=1-(1+.1+row*.27)/4, bottom=1-(1+.3+row*.27)/4;
  k.poly('signs',[[x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z]],
    [[u+.009,bottom],[u+.241,bottom],[u+.241,v],[u+.009,v]]);
}
function dustSkirt(k,a) {
  // Banked triangular wind deposits, rather than a brown rectangular plinth.
  for(const s of [-1,1]) {
    k.poly('soot',[[s*a.w/2,0,-a.d/2],[s*(a.w/2-.02),.24,-a.d/2+.4],
      [s*(a.w/2-.02),.3,a.d/2-1],[s*(a.w/2-.65),0,a.d/2-.4]],null,[1.65,1.18,.8]);
  }
}

export function moduleShell(k,a,low,block,hole=null) {
  const h=4.2, depot=a.kind==='depot', hall=a.kind==='hall', rise=depot?1.3:hall?.8:.45;
  B(k,'concrete',0,-.2,0,a.w,.4,a.d,.055);
  k.box('floor',0,.012,0,a.w-.3,.012,a.d-.3);
  // Double-sided volume walls, with an unobstructed doorway and no floor lip.
  B(k,'wall',0,h/2,-a.d/2+.12,a.w,h,.24);
  block(0,-a.d/2+.12,a.w,.24,h);
  for(const s of [-1,1]){
    B(k,'wall',s*(a.w/2-.12),h/2,0,.24,h,a.d);
    block(s*(a.w/2-.12),0,.24,a.d,h);
    const side=(a.w-a.doorW)/2,x=s*(a.doorW/2+side/2);
    B(k,'wall',x,h/2,a.d/2-.12,side,h,.24);block(x,a.d/2-.12,side,.24,h);
  }
  B(k,'wall',0,3.5,a.d/2-.12,a.doorW,1.4,.24);
  // Curved sandwich roof: two skins and solid end caps. `hole` ({x0,x1,z0,z1}) is cut out where a elevator shaft
  // passes up through it.
  const n=low?12:20, profile=[];
  for(let i=0;i<=n;i++){const x=-a.w/2+a.w*i/n;profile.push([x,h+rise*Math.sin(i/n*Math.PI)]);}
  const roofPiece=(x0,y0,x1,y1,z0,z1)=>{
    k._faceQuad('plastic',[[x0,y0,z0],[x1,y1,z0],[x1,y1,z1],[x0,y0,z1]],[0,1,0]);
    k._faceQuad('wall',[[x0,y0-.12,z0],[x1,y1-.12,z0],[x1,y1-.12,z1],[x0,y0-.12,z1]],[0,-1,0]);
  };
  for(let i=0;i<n;i++) {
    const [x0,y0]=profile[i],[x1,y1]=profile[i+1];
    if(!hole||x1<=hole.x0||x0>=hole.x1) roofPiece(x0,y0,x1,y1,-a.d/2,a.d/2);
    else {
      const yAt=x=>y0+(y1-y0)*(x-x0)/(x1-x0);
      if(x0<hole.x0) roofPiece(x0,y0,hole.x0,yAt(hole.x0),-a.d/2,a.d/2);
      const xa=Math.max(x0,hole.x0), xb=Math.min(x1,hole.x1);
      roofPiece(xa,yAt(xa),xb,yAt(xb),-a.d/2,hole.z0);
      roofPiece(xa,yAt(xa),xb,yAt(xb),hole.z1,a.d/2);
      if(x1>hole.x1) roofPiece(hole.x1,yAt(hole.x1),x1,y1,-a.d/2,a.d/2);
    }
    for(const s of [-1,1])k._faceQuad('plastic',[[x0,h,s*a.d/2],[x1,h,s*a.d/2],[x1,y1,s*a.d/2],[x0,y0,s*a.d/2]],[0,0,s]);
  }
  // Pressure hoops follow the shell. They also read as structure inside.
  for(let z=-a.d/2+.25;z<=a.d/2;z+=depot?3:2.3) {
    for(let i=0;i<n;i++){const p=profile[i],q=profile[i+1];
      if(hole&&z>hole.z0-.15&&z<hole.z1+.15&&q[0]>hole.x0&&p[0]<hole.x1)continue;
      k.pipe('steelDark',[p[0],p[1]+.015,z],[q[0],q[1]+.015,z],.065,low?6:8);}
    for(const s of [-1,1]){B(k,'steelDark',s*(a.w/2-.13),2.1,z,.15,4.2,.18);
      B(k,'steel',s*(a.w/2-.25),.4,z,.22,.6,.26);}
  }
  // Prefab seams, impact guards, exterior utility pipes and framed windows.
  for(const s of [-1,1]) {
    k.pipe('pipeBlue',[s*(a.w/2-.36),3.45,-a.d/2+.4],[s*(a.w/2-.36),3.45,a.d/2-.5],.06,8);
    k.pipe('pipeSteel',[s*(a.w/2-.36),3.7,-a.d/2+.4],[s*(a.w/2-.36),3.7,a.d/2-.5],.045,8);
    k.box('red',s*(a.doorW/2+1.1),1.1,a.d/2+.035,1.2,.26,.03);
    window(k,s*(a.w/2-2.2),2.35,a.d/2+.045,depot?2.6:1.5,.85);
    for(let x=a.doorW/2+.5;x<a.w/2-.25;x+=2.2){
      k.box('steelDark',s*x,2.1,a.d/2+.015,.026,3.9,.025);
      rivets(k,s*x,1.1,a.d/2+.04,.32,1.8);
    }
  }
  // Deep airlock frame, gasket, service panel, bumper bollards and lit lintel.
  for(const s of [-1,1]){
    B(k,'steelDark',s*(a.doorW/2+.17),1.5,a.d/2+.15,.3,3,.36,.06);
    k.box('rubber',s*(a.doorW/2+.015),1.4,a.d/2+.2,.045,2.8,.07);
    B(k,'hazard',s*(a.doorW/2+.65),.46,a.d/2+.6,.18,.92,.22);
    k.box('gunmetal',s*(a.doorW/2+.65),.64,a.d/2+.72,.18,.14,.025);
  }
  B(k,'steelDark',0,2.99,a.d/2+.15,a.doorW+.6,.3,.36,.055);
  k.box('glowCyan',0,3.03,a.d/2+.34,a.doorW+.25,.065,.02);
  B(k,'plasticDark',-a.doorW/2-.44,1.48,a.d/2+.37,.26,.46,.1,.025);
  k.box('glowGreen',-a.doorW/2-.44,1.55,a.d/2+.426,.16,.11,.012);
  B(k,'steelDark',0,3.42,a.d/2+.42,a.doorW+1.3,.14,1.16,.045);
  lamp(k,0,3.3,a.d/2+.52,a.doorW*.8);
  plaque(k,depot?CELLS.depot:hall?CELLS.hall:CELLS.tower,0,3.85,a.d/2+.05,Math.min(a.w-1,8),.48);
  dustSkirt(k,a);
  exteriorDressing(k,a,low,block,rise);
  if(depot) {
    // Rooftop environmental plant and solar arrays; all inside the footprint.
    B(k,'plasticDark',-4,6.1,-3,3,1.15,2.5,.16);
    for(const dx of [-1.2,1.2])for(const dz of [-1,1]){
      const x=-4+dx,shell=4.2+rise*Math.sin((x+a.w/2)/a.w*Math.PI);
      k.pipe('steel',[x,shell,-3+dz],[x,5.55,-3+dz],.055,8);
    }
    for(const x of [-4.75,-3.25]){
      k.cyl('steelDark',x,6.71,-3,.58,.12,low?10:16);
      for(let i=0;i<4;i++){k.push(x,6.78,-3,i*Math.PI/4);k.box('steel',0,0,0,.88,.035,.045);k.pop();}
    }
    k.pipe('pipeSteel',[-2.5,6.1,-3],[0,6.1,-3],.23,10);
    k.pipe('pipeSteel',[0,6.1,-3],[0,5.5,-3],.23,10);
    for(const x of [3,7]){B(k,'steelDark',x,5.7,-2,3.5,.12,5,.035);
      for(const dx of [-1.2,1.2])for(const dz of [-1.75,1.75]){
        const shell=4.2+rise*Math.sin((x+dx+a.w/2)/a.w*Math.PI);
        k.pipe('steel',[x+dx,shell,-2+dz],[x+dx,5.64,-2+dz],.035,8);
      }
      const uv=atlasUV(CELLS.solar);
      k.poly('signs',[[x-1.68,5.775,.42],[x+1.68,5.775,.42],[x+1.68,5.775,-4.42],[x-1.68,5.775,-4.42]],uv);}
    k.cyl('steel',-8,6.125,-4,.055,2.55,8);k.box('glowRed',-8,7.4,-4,.1,.08,.1);
    k.pipe('steel',[-8.7,6.8,-4],[-7.3,6.8,-4],.025,6);
  }
}

// ===========================================================================================================
// PORT-POLISH (2026-10-03, Fable): the lived-in layer. Everything here is static, merged into the port's buckets, and
// drawn once. Nothing here moves, blocks a doorway or changes where anyone stands. Comedy is allowed (Jaron, 10/3).
// ===========================================================================================================

/** Rust and dust streaks running down a wall from a fitting: a vertical scuff decal, tinted dark, narrow. */
function streak(k,x,y,z,w,h,rot=0,dark=.95) { wallDecal(k,CELLS.scuff,x,y,z,w*.5,h,rot,[dark,dark*.94,dark*.9]); }
/** A triangular dust fan blown against the foot of a wall (lit alpha decal, warm regolith tint). */
function drift(k,x,z,w,h,rot=0) { wallDecal(k,CELLS.drift,x,h/2+.005,z,w,h,rot,[1.25,1.05,.85]); }
function cone(k,x,z) {
  k.cyl('hazard',x,.33,z,.14,.66,low8(k),{r2:.05});
  k.box('white',x,.42,z,.2,.08,.2); k.box('rubber',x,.02,z,.4,.04,.4);
}
const low8=k=>k.low?6:10;
/** Two or three gas bottles chained to a wall bracket. */
function bottles(k,x,z,rot,n=2) {
  k.push(x,0,z,rot);
  for(let i=0;i<n;i++){const bx=(i-(n-1)/2)*.36;
    k.cyl(i%2?'pipeBlue':'steel',bx,.75,0,.15,1.5,low8(k));k.cyl('steelDark',bx,1.56,0,.06,.12,6);k.cyl('gunmetal',bx,.03,0,.17,.06,low8(k));}
  k.box('steelDark',0,1.15,-.17,n*.36+.1,.04,.03);k.pop();
}
/** A hose reel on a wall bracket: drum, coiled hose, a nozzle hanging. */
function hoseReel(k,x,y,z,rot) {
  k.push(x,y,z,rot);
  k.box('steelDark',0,0,-.1,.5,.5,.04);k.cyl('gunmetal',0,0,.1,.3,.22,k.low?8:14,{axis:'z'});
  k.cyl('red',0,0,.1,.26,.18,k.low?8:14,{axis:'z'});k.cyl('steel',0,0,.23,.04,.06,6,{axis:'z'});
  k.pipe('red',[.22,-.1,.2],[.3,-.55,.22],.025,6);k.cyl('copper',.3,-.62,.22,.03,.12,6);k.pop();
}
/** A sealed waste bin: drum body, hinged lid, a label, something leaking out of the bottom seam. */
function bin(k,x,z) {
  k.cyl('plasticDark',x,.45,z,.3,.9,low8(k));k.cyl('steelDark',x,.92,z,.32,.06,low8(k));
  k.box('hazard',x,.6,z+.3,.3,.12,.01);k.cyl('steelDark',x,.3,z,.31,.03,low8(k));
  groundDecal(k,CELLS.oil,x+.25,z+.2,.9,.9,0,.034);
}
/** A park bench of recycled deck plate on two steel frames. */
function bench(k,x,z,rot) {
  k.push(x,0,z,rot);
  for(const s of [-1,1]){B(k,'steelDark',s*.7,.22,0,.06,.44,.42,.012);B(k,'steelDark',s*.7,.6,-.2,.06,.4,.05,.012);}
  B(k,'floor',0,.46,0,1.7,.05,.42,.01);B(k,'floor',0,.78,-.21,1.7,.36,.04,.01);k.pop();
}
/** Boot scraper grating and a mat at a door. */
function doormat(k,x,z,w) {
  k.box('gunmetal',x,.012,z,w,.02,1.1);
  for(let dx=-w/2+.1;dx<w/2;dx+=.12)k.box('steelDark',x+dx,.03,z,.025,.015,1.0);
  groundDecal(k,CELLS.scuff,x,z+1.1,w+.6,1.4,0,.034);groundDecal(k,CELLS.scuff,x+.6,z+2.4,w*.8,1.3,.4,.034);
}
/** A pile of crates, strapped, with a dust-coloured tarp thrown over the top one and a drum beside. */
function crateStack(k,x,z,rot,block,ax,az) {
  k.push(x,0,z,rot);
  prop(k,'crate',0,.025,0,1.3,.9,1.2);prop(k,'crate',-.1,.94,.05,1.1,.7,1.0);
  k._faceQuad('fabricGrey',[[-.75,1.68,-.7],[.65,1.7,-.62],[.7,1.1,.75],[-.8,1.25,.7]],[0,1,0],[.9,.72,.55]);
  k._faceQuad('fabricGrey',[[-.75,1.68,-.7],[-.8,1.25,.7],[-.95,.45,.6],[-.9,.75,-.6]],[-1,0,0],[.9,.72,.55]);
  prop(k,'drum',1.3,.025,.2,.6,.9,.6);k.cyl('rubber',1.2,.12,-.7,.3,.22,low8(k),{axis:'x'});
  k.pop();block(ax,az,2.6,1.6,1.8);
}
/** Spot and area fittings: a wall lamp on a conduit, with the conduit run down to a junction box. */
function wallLamp(k,x,y,z,rot) {
  k.push(x,y,z,rot);
  B(k,'steelDark',0,0,.1,.22,.16,.22,.02);k.box('glowWhite',0,-.07,.12,.18,.02,.16);
  k.pipe('gunmetal',[0,.08,.03],[0,.5,.03],.018,6);k.pipe('gunmetal',[0,-.08,.03],[0,-y+.4,.03],.018,6);
  B(k,'plasticDark',0,-y+.3,.05,.2,.24,.08,.015);k.pop();
}

/** The outside of a pressurised module: the fittings a crew bolts on in the first month and the dirt that follows. */
function exteriorDressing(k,a,low,block,rise) {
  const d2=a.d/2,w2=a.w/2,kind=a.kind;
  // dust blown against every wall foot, and the streaks the roof pipes leave down the sides
  for(const s of [-1,1]){
    for(let z=-d2+2;z<d2-1;z+=3.4)drift(k,s*(w2+.03),z,3.2,.55,s*Math.PI/2);
    for(let z=-d2+1.5;z<d2;z+=4.6)streak(k,s*(w2+.025),2.4,z,.5,2.6,s*Math.PI/2,.72);
  }
  for(let x=-w2+2.5;x<w2-1;x+=4)drift(k,x,-d2-.03,3,.5,Math.PI);
  for(const s of [-1,1]){streak(k,s*(w2-2.2),1.2,d2+.065,1.9,1.1,0,.75);drift(k,s*(w2-3.5),d2+.03,2.6,.4,0);}
  // conduit and lamps either side of the airlock, a junction box, the cable tray round the base
  for(const s of [-1,1])wallLamp(k,s*(a.doorW/2+2.3),3.0,d2+.08,0);
  k.box('gunmetal',0,.11,d2+.42,a.w-1,.1,.12);
  for(const s of [-1,1])k.box('gunmetal',s*(w2-.06),.11,0,.12,.1,a.d-.6);
  doormat(k,0,d2+1.1,a.doorW+.4);
  if(kind==='tower'){
    bench(k,a.doorW/2+2.2,d2+1.3,Math.PI);bottles(k,-w2+1.2,d2+.4,0,2);bin(k,a.doorW/2+4.2,d2+.9);
    hoseReel(k,-a.doorW/2-2.6,1.4,d2+.12,0);
    // the weather officer's wind sensor is "offline": a windsock does the job instead, on a mast by the door
    k.cyl('steel',w2+1.4,2.6,d2-1,.045,5.2,6);k.box('steelDark',w2+1.4,5.25,d2-1,.2,.08,.2);
    k.cyl('steelDark',w2+1.4,5.2,d2-.6,.16,.05,low8(k),{axis:'z'});
    k.lathe('hazard',w2+1.4,5.2,d2-.6,[[.16,0],[.15,.4],[.12,.9],[.09,1.4],[.06,1.9]],low8(k),{axis:'z'});
    for(const y of [.1,.3])k.box('hazard',w2+1.4,y,d2-1,.26,.04,.26);
    block(w2+1.4,d2-1,.3,.3,5.2);
  } else if(kind==='depot'){
    crateStack(k,w2+2.2,-3,.3,block,w2+2.2,-3);bottles(k,-w2-.4,2,Math.PI/2,3);
    hoseReel(k,a.doorW/2+2.9,1.5,d2+.12,0);bin(k,-a.doorW/2-3.2,d2+1);
    // the HVAC pack on the west wall: housing, grille slats, fan ring, two pipes into the wall
    k.push(-w2-.55,0,-4,0);
    B(k,'plasticDark',0,1.2,0,1.0,1.6,1.8,.05);for(let z=-.7;z<.8;z+=.14)k.box('steelDark',-.51,1.2,z,.02,1.3,.05);
    k.cyl('gunmetal',-.52,1.2,0,.5,.06,low?8:16,{axis:'x'});k.cyl('steelDark',-.56,1.2,0,.08,.08,6,{axis:'x'});
    for(const dz of [-.5,.5])k.pipe('pipeSteel',[.3,2.1,dz],[.56,2.1,dz],.05,6);
    B(k,'concrete',0,.08,0,1.2,.16,2,.03);k.pop();block(-w2-.55,-4,1.3,2.1,2.1);
    // stencilled through a cardboard template on the east wall by somebody homesick
    wallDecal(k,CELLS.graffiti,w2+.03,1.5,4.5,4.2,2.1,Math.PI/2,[1,1,1]);
    for(const z of [d2+2.6,d2+3.3])cone(k,-a.doorW/2-1.6,z);
  } else if(kind==='hall'){
    bench(k,-a.doorW/2-2.6,d2+1.0,Math.PI);bench(k,a.doorW/2+2.6,d2+1.0,Math.PI);bin(k,a.doorW/2+4.6,d2+.8);
    bottles(k,-w2+1.5,d2+.4,0,2);hoseReel(k,-a.doorW/2-5,1.4,d2+.12,0);
    // bulbs on a sagging line across the front, a vent stack and a dish on the roof, and the mgmt's reminder by the door
    for(const s of [-1,1])k.cyl('steelDark',s*(w2-.6),3.9+.4,d2+1.9,.03,.8,6);
    for(let i=0;i<=14;i++){const t=i/14,x=-w2+.6+t*(a.w-1.2),y=4.3-Math.sin(t*Math.PI)*.45;
      if(i<14){const t2=(i+1)/14;k.pipe('rubber',[x,y,d2+1.9],[-w2+.6+t2*(a.w-1.2),4.3-Math.sin(t2*Math.PI)*.45,d2+1.9],.012,4);}
      if(i%2)k.box('glowAmber',x,y-.08,d2+1.9,.09,.12,.09);}
    k.cyl('steelDark',-7,4.2+rise*Math.sin(5/24*Math.PI)+.55,-3,.22,1.1,low8(k));k.cyl('gunmetal',-7,4.2+rise*Math.sin(5/24*Math.PI)+1.15,-3,.34,.1,low8(k));
    k.cyl('steel',8,5.6,-4,.05,1.4,6);k.dome('plastic',8,6.35,-4,.65,low?10:14,4,{thetaMin:Math.PI/2,thetaMax:Math.PI,scaleY:.3,inside:true});
    wallDecal(k,CELLS.graffiti,-a.doorW/2-3.2,.62,d2+.062,1.9,.9,0,[1,1,1]);
    for(const z of [d2+2.6,d2+3.3])cone(k,a.doorW/2+1.9,z);
  }
}

// ===========================================================================================================
// THE CREW HALL / CANTINA. Door on +z (local z 7). The server (CREW_HALL in authority.mjs) stands the six candidates
// along local z 0 at x -6..6 (2.4 m apart) and walks them straight out of the door, so the strip x -7.5..7.5 by z -1..1
// and the corridor x -2.4..2.4 from z 0 to the door stay empty. They stand at the bar: the bar is behind them.
// ===========================================================================================================
export function crewHall(k,a,low,block) {
  const ceiling=x=>4.2+.8*Math.sin((x+a.w/2)/a.w*Math.PI)-.08, seg=low?6:12;
  // ---- the bar: counter, foot rail, stools, the back bar with bottles and the pass ------------------------------
  B(k,'counter',0,.55,-2.2,16,1.1,.9,.08);block(0,-2.2,16,.9,1.1);
  B(k,'wood',0,1.13,-2.2,16.2,.07,1.05,.03);
  k.pipe('steel',[-7.8,.22,-1.6],[7.8,.22,-1.6],.03,6);
  for(const x of [-7,-4.5,-2,.5,3,5.5])k.box('glowAmber',x,.95,-1.76,.6,.03,.01);
  for(const x of [-6,-3.6,-1.2,1.2,3.6,6]){
    k.cyl('steelDark',x,.35,-1.25,.035,.7,6);k.cyl('gunmetal',x,.02,-1.25,.2,.04,seg);
    k.pillow('leather',x,.74,-1.25,.4,.09,.4,3,low?6:10);block(x,-1.25,.42,.42,.8);
  }
  B(k,'counter',0,1.4,-5.4,16,2.8,.5,.06);block(0,-5.4,16,.5,2.8);
  for(const y of [1.3,2.05]){k.box('wood',0,y,-5.05,15.6,.05,.3);
    for(let x=-7.3;x<7.5;x+=.46){const t=Math.abs(Math.sin(x*7.1));
      k.cyl(t<.33?'glassTint':t<.66?'copper':'pipeBlue',x,y+.2,-5.05,.06,.34,low?5:8);k.cyl('steelDark',x,y+.4,-5.05,.025,.08,5);}}
  k.box('glowAmber',0,2.5,-5.12,15.4,.02,.02);
  plaque(k,CELLS.menu,-4.2,3.25,-5.12,4.2,1.4);plaque(k,CELLS.menu,4.2,3.25,-5.12,4.2,1.4);
  // coffee urn, hot trays under lamps, a till, a tip jar with one coin in it
  B(k,'steel',-6.2,1.55,-2.4,.55,.85,.5,.06);k.cyl('gunmetal',-6.2,2.0,-2.4,.22,.1,seg);k.pipe('steel',[-6.2,1.5,-2.1],[-6.2,1.3,-1.95],.02,6);
  for(let i=0;i<4;i++){B(k,'steel',-3.2+i*.9,1.24,-2.3,.78,.16,.6,.02);k.box(i%2?'red':'crateB',-3.2+i*.9,1.33,-2.3,.6,.05,.45);}
  k.pipe('steelDark',[-3.6,1.17,-2.7],[-3.6,2.3,-2.7],.025,6);k.pipe('steelDark',[-3.6,2.3,-2.7],[-.3,2.3,-2.7],.025,6);
  for(let i=0;i<3;i++){k.box('steelDark',-3.0+i*1.1,2.2,-2.6,.5,.12,.3);k.box('glowAmber',-3.0+i*1.1,2.13,-2.6,.44,.02,.24);}
  B(k,'plasticDark',3.5,1.33,-2.3,.5,.36,.4,.02);k.box('glowGreen',3.5,1.45,-2.09,.32,.14,.01);
  k.cyl('glassTint',5.2,1.3,-2.1,.1,.26,seg);k.box('glowAmber',5.2,1.2,-2.1,.06,.02,.06);
  // ---- the pendant lamps over the bar and the ceiling lamps over the tables ----------------------------------------
  for(const x of [-5.5,-1.5,2.5,6.5]){k.pipe('rubber',[x,ceiling(x),-2.2],[x,2.75,-2.2],.012,4);
    k.cyl('gunmetal',x,2.62,-2.2,.26,.22,seg,{r2:.1});k.cyl('glowAmber',x,2.49,-2.2,.2,.03,seg);}
  for(const z of [1.5,4.8])for(const x of [-9,9])lamp(k,x,3.7,z,2.2,ceiling);
  lamp(k,0,3.75,4.5,1.6,ceiling);
  // ---- mess tables: two each side, long along z, benches both sides, trays and mugs left out --------------------------
  for(const s of [-1,1])for(const z of [1.6,4.8]){
    const x=s*9.2;k.push(x,0,z,0);drawProp(k,{kind:'table',x:0,y:0,z:0,w:1.0,h:.78,d:2.4,style:'mess'});k.pop();
    block(x,z,1.0,2.4,.8);
    for(const b of [-1,1]){prop(k,'bench',x+b*.78,0,z,.36,.46,2.2);block(x+b*.78,z,.36,2.2,.5);}
  }
  // ---- lockers along the front wall, a notice board, the hiring desk by the door --------------------------------------
  for(const s of [-1,1])for(let i=0;i<4;i++){const x=s*(4.2+i*.72);prop(k,'locker',x,0,6.4,.68,2.0,.5,2);}
  block(-5.3,6.4,3,.5,2.0);block(5.3,6.4,3,.5,2.0);
  B(k,'wood',8.9,2.2,6.74,2.6,1.3,.06,.02);plaque(k,CELLS.notice,8.9,2.2,6.7,2.4,1.2,Math.PI);
  k.push(-5.2,0,4.0,Math.PI/2);drawProp(k,{kind:'desk',x:0,y:0,z:0,w:1.6,h:.76,d:.8});k.pop();block(-5.2,4.0,.8,1.6,.8);
  screen(k,CELLS.hall,-5.2,1.3,4.0,.9,.45,Math.PI/2);k.cyl('steel',-5.2,.9,4.0,.025,.28,6);
  prop(k,'crate',-5.6,.025,2.6,.6,.4,.5);k.box('plastic',-4.9,.78,4.5,.3,.03,.22);
  // ---- the corner nobody cleans: sofa, low table, the jukebox, a dartboard with a wrench in it, THE plant -----------------
  k.push(10.6,0,-3.6,-Math.PI/2);drawProp(k,{kind:'sofa',x:0,y:0,z:0,w:.9,h:.9,d:2.2});k.pop();block(10.6,-3.6,.9,2.2,.9);
  B(k,'counter',9.0,.2,-3.6,.9,.4,.9,.04);B(k,'steel',9.0,.42,-3.6,.95,.03,.95,.01);block(9,-3.6,.9,.9,.45);
  k.cyl('white',9.2,.5,-3.4,.04,.12,6);k.cyl('white',8.8,.5,-3.8,.04,.12,6);
  B(k,'plasticDark',11.3,.9,1.6,.9,1.8,.6,.06);B(k,'gunmetal',11.3,1.5,1.92,.7,.5,.04,.02);k.box('glowCyan',11.3,1.5,1.95,.56,.36,.01);
  for(const y of [.4,.7,1.0])k.box(['glowRed','glowAmber','glowGreen'][Math.round(y*10)%3],11.3,y,1.92,.6,.03,.02);
  block(11.3,1.6,.9,.6,1.8);
  k.cyl('wood',-11.7,1.7,-3,.32,.05,seg,{axis:'x'});k.cyl('red',-11.65,1.7,-3,.26,.02,seg,{axis:'x'});
  k.cyl('white',-11.64,1.7,-3,.16,.015,seg,{axis:'x'});k.cyl('red',-11.63,1.7,-3,.05,.012,seg,{axis:'x'});
  k.push(-11.6,1.78,-2.92,0);k.box('steel',.12,0,0,.24,.025,.02);k.box('steel',.28,0,0,.09,.07,.02);k.pop();
  k.cyl('crateB',-11.0,.2,-5.0,.22,.4,seg,{r2:.17});k.pillow('fabricGrey',-11.0,.7,-5.0,.7,.6,.7,2.2,low?6:10,{col:[.35,.7,.3]});
  k.pipe('gunmetal',[-11.0,ceiling(-11),-5],[-11.0,2.2,-5],.012,4);k.cyl('gunmetal',-11,2.1,-5,.18,.1,seg);k.cyl('glowRed',-11,2.04,-5,.14,.02,seg,{col:[1.1,.35,.9]});
  block(-11,-5,.7,.7,1.0);
  // ---- the floor: the walk-line from the door to the bar, a spill, scuffs where the queue stands ---------------------------
  for(let z=6;z>-1;z-=1.5)k.box('mark',0,.028,z,.08,.005,.65);
  for(const x of [-4.8,0,4.8])groundDecal(k,CELLS.scuff,x,-.2,4.2,1.8,x*.07,.03);groundDecal(k,CELLS.oil,6.8,.6,.9,1.1,.5,.03);
  // ---- extinguisher, first aid, a clock that is wrong (a dial with the hands at a quarter past never) -------------------------
  prop(k,'extinguisher',-11.5,0,5.5,.2,.55,.2,0);prop(k,'firstaid',11.5,1.4,5.6,.3,.3,.12,0);
  k.cyl('white',0,3.3,-5.1,.25,.04,seg,{axis:'z'});k.box('steelDark',0,3.3,-5.075,.04,.3,.01);k.box('steelDark',.1,3.37,-5.075,.2,.03,.01);
}

export function depotInterior(k,a,low,block) {
  for(const s of [-1,1]) {
    const x=s*(a.w/2-1.4);
    for(const z of [-5,0,5]) {
      for(const dx of [-.9,.9])for(const dz of [-.9,.9]) {
        k.box('steelDark',x+dx,1.4,z+dz,.085,2.8,.085);
        B(k,'steel',x+dx,.06,z+dz,.2,.1,.2,.018);
      }
      for(const y of [.12,1.02,1.92]){
        k.box('steel',x,y,z,2,.075,2);
        k.pipe('steelDark',[x-.9,y,z-.9],[x+.9,y+.78,z-.9],.025,6);
        if(z===-5&&y===1.92){for(const dx of [-.55,0,.55])prop(k,'drum',x+dx,y+.06,z,.38,.62,.38);}
        else {prop(k,'crate',x-.45,y+.065,z-.45,.78,.56,.7);
          prop(k,'crate',x+.45,y+.065,z+.4,.7,.42+(z===0?.2:0),.72);}
        stockTag(k,x,y+.035,z+1.012,1.6,.13,y<.5?0:y<1.5?1:2);
      }
      block(x,z,2,2,2.8);
    }
  }
  // Customer side faces the door; the clerk's spot remains behind the counter.
  B(k,'counter',-3,.57,0,5,1.14,1.25,.11);block(-3,0,5,1.25,1.14);
  B(k,'steel',-3,1.17,0,5.15,.08,1.4,.04);
  for(const x of [-5,-3,-1]){B(k,'steelDark',x,.54,.64,1.5,.7,.025,.025);
    k.box('glowAmber',x,.95,.663,.65,.024,.01);}
  k.cyl('steel',-2,1.35,-.15,.03,.32,8);screen(k,CELLS.stock,-2,1.7,-.15,1.15,.56);
  B(k,'plasticDark',-2,1.24,.36,.65,.05,.24,.02);
  for(let i=0;i<9;i++)k.box('steel',-2.24+i*.06,1.269,.36,.035,.006,.14);
  prop(k,'crate',-4.8,1.23,0,.5,.3,.4);
  for(let x=-7;x<8;x+=3.5){prop(k,x<0?'crate':'drum',x,.025,-7,1.35,1.1,1.3);block(x,-7,1.45,1.4,1.2);}
  // Manual pallet lift: forks, pump cylinder, handle, rollers and one strapped load.
  k.push(5,0,3,.18);
  for(const s of [-1,1]){B(k,'hazard',s*.4,.17,-.4,.19,.12,1.7,.025);
    k.cyl('rubber',s*.4,.1,-1.05,.1,.16,10,{axis:'x'});}
  B(k,'red',0,.24,.5,.7,.34,.48,.05);k.cyl('steel',0,.5,.5,.09,.35,8);
  k.pipe('gunmetal',[0,.45,.5],[0,1.25,.9],.04,8);
  k.pipe('gunmetal',[-.3,1.25,.9],[.3,1.25,.9],.04,8);
  prop(k,'crate',0,.24,-.4,1.2,.95,1.15);k.pop();block(5,3,1.5,2.5,1.4);
  for(const x of [-3.8,3.8])for(let z=-6;z<8;z+=2)k.box('mark',x,.027,z,.07,.005,1.2);
  const ceiling=x=>4.2+1.3*Math.sin((x+a.w/2)/a.w*Math.PI)-.08;
  for(const z of [-4,3]){lamp(k,0,4.65,z,5,ceiling);lamp(k,-7,4.45,z,2.4,ceiling);lamp(k,7,4.45,z,2.4,ceiling);}
  screen(k,CELLS.service,0,2.3,-a.d/2+.3,3.2,1.45);
}

// ===========================================================================================================
// THE CONTROL TOWER (lobby, elevator shaft and cab). Every measurement is in TOWER (portSpec.js), which is also
// what `towerFloorAt` and the validator read, so what is drawn, what blocks you and where the floor is cannot
// drift apart.
//
//   lobby   reception on the left; the elevator shaft stands at the back with its door straight ahead of the entrance
//   core    2.9 x 5.7 m shaft, a two-stop guided car and no intermediate floors. The roof is cut round it.
//           Its outer mast retains aviation bands and lit windows; rails and markings pass the car as it travels.
//   cab     at 22.5 m, 12.8 m square, glazed all round above a 0.9 m console ledge, an eave over it. Consoles along
//           the glass with real chairs behind them, the core standing in the middle of the room with the elevator door
//           facing the room, and standing room kept clear for the people who work here (TOWER_SPOTS).
// ===========================================================================================================

/** A flat polygon given in any order, wound so that it faces `want` (a vector). */
function facing(k, key, pts, want, uvs) {
  const [a, b, c] = pts;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const ok = nx * want[0] + ny * want[1] + nz * want[2] >= 0;
  k.poly(key, ok ? pts : pts.slice().reverse(), uvs);
}

/** An axis-aligned plank: top/bottom/sides, all six faces. */
const slab = (k, key, x0, y0, z0, x1, y1, z1, o) => k.boxMM(key, x0, y0, z0, x1, y1, z1, o);

function drawElevatorCore(k, a, low, block) {
  const T = TOWER, c = T.core;
  const top = T.cab.roofY;                                  // the core runs right up to the cab ceiling
  // ---- walls (they block you as well as being drawn) ---------------------------------------------
  const wall = (x0, x1, z0, z1, y0, y1, key = 'wall') => {
    slab(k, key, x0, y0, z0, x1, y1, z1);
    block((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y1 - y0, y0);
  };
  wall(c.x0, c.x1, c.z0, c.z0 + c.t, 0, top);                         // back
  wall(c.x0, c.x0 + c.t, c.z0, c.z1, 0, top);                         // left
  wall(c.x1 - c.t, c.x1, c.z0, c.z1, 0, top);                         // right
  wall(c.x0, T.door.x0, c.z1 - c.t, c.z1, 0, top);                    // front, either side of the door
  wall(T.door.x1, c.x1, c.z1 - c.t, c.z1, 0, top);
  wall(T.door.x0, T.door.x1, c.z1 - c.t, c.z1, T.door.h, T.cab.floorY);                      // over the lobby door
  wall(T.door.x0, T.door.x1, c.z1 - c.t, c.z1, T.cab.floorY + T.door.h, top);                // over the cab door
  // exterior skin above the lobby roof: white paint, and aviation bands up the mast
  const skin = (x0, x1, z0, z1, y0, y1, m = 'plastic') => slab(k, m, x0, y0, z0, x1, y1, z1, { skip: '-y+y' });
  const yS = 4.6, yE = T.cab.floorY - 0.7;
  skin(c.x0 - 0.04, c.x1 + 0.04, c.z0 - 0.04, c.z0, yS, yE);
  skin(c.x0 - 0.04, c.x0, c.z0, c.z1 + 0.04, yS, yE);
  skin(c.x1, c.x1 + 0.04, c.z0, c.z1 + 0.04, yS, yE);
  skin(c.x0, c.x1, c.z1, c.z1 + 0.04, yS, yE);
  for (const [y0, y1] of [[7.6, 9.6], [13.0, 15.0], [18.4, 20.4]]) {
    skin(c.x0 - 0.07, c.x1 + 0.07, c.z0 - 0.07, c.z0 - 0.04, y0, y1, 'red');
    skin(c.x0 - 0.07, c.x0 - 0.04, c.z0 - 0.04, c.z1 + 0.07, y0, y1, 'red');
    skin(c.x1 + 0.04, c.x1 + 0.07, c.z0 - 0.04, c.z1 + 0.07, y0, y1, 'red');
    skin(c.x0 - 0.04, c.x1 + 0.04, c.z1 + 0.04, c.z1 + 0.07, y0, y1, 'red');
  }
  // lit windows on the outside of the shaft, a few to a side, so the mast has life at dusk
  for (const wy of [5.7, 10.9, 16.1]) for (const s of [-1, 1]) {
    slab(k, 'glowCool', s > 0 ? c.x1 + 0.04 : c.x0 - 0.075, wy, -3.5, s > 0 ? c.x1 + 0.075 : c.x0 - 0.04, wy + 1.0, -2.1, { col: [0.5, 0.78, 0.9] });
  }

  // No stair soffits, flight plates, central spine or stacked landings remain.
  // Guide rails, cable chase and spaced brackets are visible from the moving car.
  for(const x of [-1.17,1.17]) {
    slab(k,'steel',x-.035,0,-1.65,x+.035,T.cab.floorY+2.5,-1.55);
    for(let y=1;y<T.cab.floorY;y+=3) slab(k,'steelDark',x-.06,y,-1.8,x+.06,y+.12,-1.5);
  }
  for(let y=1;y<T.cab.floorY;y+=3) {
    slab(k,'hazard',-.4,y,-4.97,.4,y+.09,-4.95);
    slab(k,'glowWhite',-.25,y+1,-4.96,.25,y+1.06,-4.93);
  }
  for(const base of [0,T.cab.floorY]) {
    B(k,'plasticDark',.89,base+1.1,c.z1+.05,.22,.4,.1);
    k.box('glowCyan',.89,base+1.1,c.z1+.106,.12,.12,.012);
  }
  // the lobby door: a frame, an exit light and a plaque over it, both ends of the climb
  for (const base of [0, T.cab.floorY]) {
    plaque(k, CELLS.tower, 0, base + 2.62, c.z1 + 0.025, 1.7, 0.26);
    for (const s of [-1, 1]) slab(k, 'steelDark', s * (T.door.x1 + 0.12) - 0.06, base, c.z1, s * (T.door.x1 + 0.12) + 0.06, base + T.door.h, c.z1 + 0.1);
    slab(k, 'steelDark', T.door.x0 - 0.06, base + T.door.h, c.z1, T.door.x1 + 0.06, base + T.door.h + 0.1, c.z1 + 0.1);
    slab(k, 'glowGreen', -0.25, base + T.door.h + 0.16, c.z1 + 0.03, 0.25, base + T.door.h + 0.23, c.z1 + 0.05);
  }
}

/** Props placed in the cab, written once so the drawing and the blockers cannot disagree. */
export const CAB_FURNITURE = (() => {
  const items = [];
  for (const x of [-3.3, 0, 3.3]) items.push({ desk: [x, 5.3, 2], chair: [x, 4.3, 0] });          // south glass: operators face the pads
  for (const z of [-2.0, 1.4]) items.push({ desk: [-5.4, z, 1], chair: [-4.45, z, 3] });         // west glass: approach
  for (const z of [-2.0, 1.4]) items.push({ desk: [5.4, z, 3], chair: [4.45, z, 1] });           // east glass: weather and systems
  return items;
})();

function drawCab(k, a, low, block) {
  const T = TOWER, C = T.cab, c = T.core, y = C.floorY, h = C.half, fh = C.floorHalf;
  const slabY0 = y - 0.7;
  // ---- the structure under the floor: a slab with a hole for the core, and struts down to the mast ---------------
  const floorSlab = (x0, x1, z0, z1) => slab(k, 'plastic', x0, slabY0, z0, x1, y, z1, { skip: '+y' });
  floorSlab(-fh - 0.1, c.x0, -fh - 0.1, fh + 0.1);
  floorSlab(c.x1, fh + 0.1, -fh - 0.1, fh + 0.1);
  floorSlab(c.x0, c.x1, c.z1, fh + 0.1);
  floorSlab(c.x0, c.x1, -fh - 0.1, c.z0);
  // the deck finish over it, the landing inside the core and the threshold of the cab door
  const deck = (x0, x1, z0, z1) => facing(k, 'floor', [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, 1, 0]);
  deck(-fh - 0.1, c.x0, -fh - 0.1, fh + 0.1); deck(c.x1, fh + 0.1, -fh - 0.1, fh + 0.1);
  deck(c.x0, c.x1, c.z1, fh + 0.1); deck(c.x0, c.x1, -fh - 0.1, c.z0);
  // The shaft opening contains only the moving car floor.
  slab(k, 'floor', T.door.x0, y - 0.14, T.inner.z1, T.door.x1, y, c.z1);                              // and the sill of the cab door
  for (const s of [-1, 1]) {
    facing(k, 'hazard', [[-fh, y + 0.004, s * (fh - 0.04)], [fh, y + 0.004, s * (fh - 0.04)], [fh, y + 0.004, s * (fh - 0.14)], [-fh, y + 0.004, s * (fh - 0.14)]], [0, 1, 0]);
    facing(k, 'hazard', [[s * (fh - 0.04), y + 0.004, -fh], [s * (fh - 0.04), y + 0.004, fh], [s * (fh - 0.14), y + 0.004, fh], [s * (fh - 0.14), y + 0.004, -fh]], [0, 1, 0]);
  }
  // struts: the cab is a wide hat on a thin mast, and it has to look held up
  for (const sx of [-1, 1]) for (const z of [-3.0, 0.0, 3.4]) {
    k.pipe('steel', [sx * (c.x1 + 0.02), y - 3.4, Math.max(c.z0 + 0.4, Math.min(c.z1 - 0.4, z))], [sx * (fh + 0.08), slabY0 + 0.05, z], 0.1, 8);
  }
  for (const sx of [-0.8, 0.8]) {
    k.pipe('steel', [sx, y - 3.4, c.z1 + 0.05], [sx * 3.6, slabY0 + 0.05, fh + 0.08], 0.1, 8);
    k.pipe('steel', [sx, y - 3.4, c.z0 - 0.05], [sx * 3.6, slabY0 + 0.05, -fh - 0.08], 0.1, 8);
  }
  for(const [x0,x1,z0,z1] of [[-fh-.2,c.x0,-fh-.2,fh+.2],[c.x1,fh+.2,-fh-.2,fh+.2],[c.x0,c.x1,c.z1,fh+.2],[c.x0,c.x1,-fh-.2,c.z0]]) slab(k,'steelDark',x0,slabY0-.12,z0,x1,slabY0,z1);        // underside cladding
  // ---- the glazing: a 0.9 m ledge, six panes a side between mullions, a header beam ----------------------------------
  const g0 = C.glassY0, g1 = C.glassY1;
  for (const side of ['n', 's', 'e', 'w']) {
    const horiz = side === 'n' || side === 's';
    const sign = side === 'n' || side === 'w' ? -1 : 1;
    const along = (t) => (horiz ? [t, sign * h] : [sign * h, t]);       // (x,z) at position t along that face
    if (horiz) { B(k, 'gunmetal', 0, y + 0.45, sign * (h + 0.04), 2 * h + 0.2, 0.9, 0.16, 0.03); slab(k, 'steel', -h, g0, sign * (h - 0.05) - 0.1, h, g0 + 0.03, sign * (h - 0.05) + 0.1); }
    else { B(k, 'gunmetal', sign * (h + 0.04), y + 0.45, 0, 0.16, 0.9, 2 * h + 0.2, 0.03); slab(k, 'steel', sign * (h - 0.05) - 0.1, g0, -h, sign * (h - 0.05) + 0.1, g0 + 0.03, h); }
    const n = 6, w = (2 * h) / n;
    for (let p = 0; p < n; p++) {
      const [ax, az] = along(-h + p * w + 0.05), [bx, bz] = along(-h + (p + 1) * w - 0.05);
      k.poly('glassTint', [[ax, g0 + 0.03, az], [bx, g0 + 0.03, bz], [bx, g1 - 0.03, bz], [ax, g1 - 0.03, az]]);
    }
    for (let p = 0; p <= n; p++) {
      const [mx, mz] = along(-h + p * w);
      if (horiz) slab(k, 'steelDark', mx - 0.045, g0, mz - 0.06, mx + 0.045, g1, mz + 0.06); else slab(k, 'steelDark', mx - 0.06, g0, mz - 0.045, mx + 0.06, g1, mz + 0.045);
    }
    if (horiz) B(k, 'steelDark', 0, g1 + 0.15, sign * (h + 0.02), 2 * h + 0.3, 0.3, 0.2, 0.04);
    else B(k, 'steelDark', sign * (h + 0.02), g1 + 0.15, 0, 0.2, 0.3, 2 * h + 0.3, 0.04);
  }
  // the glass line holds you in: a box on each side, floor to roof
  block(0, -h - 0.06, 2 * h + 0.4, 0.2, C.roofY - y, y); block(0, h + 0.06, 2 * h + 0.4, 0.2, C.roofY - y, y);
  block(-h - 0.06, 0, 0.2, 2 * h + 0.4, C.roofY - y, y); block(h + 0.06, 0, 0.2, 2 * h + 0.4, C.roofY - y, y);
  // ---- the roof: an eave, a ceiling, lamps over the work positions ------------------------------------------------------
  const e = C.eave, ry = C.roofY;
  B(k, 'plastic', 0, ry + 0.25, 0, 2 * e, 0.5, 2 * e, 0.1);
  facing(k, 'plasticDark', [[-h - 0.1, ry - 0.01, -h - 0.1], [h + 0.1, ry - 0.01, -h - 0.1], [h + 0.1, ry - 0.01, h + 0.1], [-h - 0.1, ry - 0.01, h + 0.1]], [0, -1, 0]);
  for (const [lx, lz] of [[-3.3, 4.2], [0, 4.2], [3.3, 4.2], [-4.5, 0.2], [4.5, 0.2], [-4.5, -3.2], [4.5, -3.2], [0, 2.4]]) {
    slab(k, 'plasticDark', lx - 0.6, ry - 0.06, lz - 0.15, lx + 0.6, ry - 0.01, lz + 0.15);
    slab(k, 'glowWhite', lx - 0.5, ry - 0.075, lz - 0.09, lx + 0.5, ry - 0.06, lz + 0.09);
  }
  // the core's own faces in the room: status screens and the fittings a elevator door wants
  screen(k, CELLS.pads, c.x0 - 0.01, y + 1.9, -2.2, 3.0, 1.3, -Math.PI / 2);
  screen(k, CELLS.weather, c.x1 + 0.01, y + 1.9, -2.2, 3.0, 1.3, Math.PI / 2);
  prop(k, 'extinguisher', 1.0, y, 0.63, 0.2, 0.55, 0.2, 0);
  prop(k, 'firstaid', -1.0, y + 1.2, 0.58, 0.3, 0.3, 0.12, 0);
  // ---- roof gear: a radar housing, a lattice mast with a beacon, a dish, a wind mast ---------------------------------------
  const top = ry + 0.5;
  B(k, 'plasticDark', -2.2, top + 0.45, -1.2, 2.0, 0.9, 2.0, 0.12);
  k.cyl('steel', -2.2, top + 1.12, -1.2, 0.5, 0.45, low ? 10 : 16);
  k.cyl('steel', 1.8, top + 2.2, -1.8, 0.055, 4.4, 8);
  for (const yy of [top + 1.6, top + 2.6, top + 3.6]) k.pipe('steel', [0.9, yy, -1.8], [2.7, yy, -1.8], 0.025, 6);
  k.box('glowRed', 1.8, T.topY - 0.02, -1.8, 0.13, 0.04, 0.13);
  k.cyl('steel', -4.4, top + 0.75, 3.0, 0.065, 1.5, 8);
  k.dome('plastic', -4.4, top + 1.55, 3.0, 0.85, low ? 10 : 16, 4, { thetaMin: Math.PI / 2, thetaMax: Math.PI, scaleY: 0.28, inside: true });
  k.pipe('steel', [-4.4, top + 1.55, 3.0], [-4.4, top + 2.1, 3.0], 0.035, 6);
  k.cyl('steelDark', 4.6, top + 1.0, 2.8, 0.04, 2.0, 6);
  // ---- the work: consoles along the glass, a chair behind each. A console's control surface is its +z; an operator
  // faces its -z. Quarter turns: 0 faces south (+z), 1 east, 2 north, 3 west.
  for (const f of CAB_FURNITURE) {
    const [dx, dz, drot] = f.desk, [cx, cz, crot] = f.chair, along = drot % 2 === 0;
    k.push(dx, y, dz, drot * Math.PI / 2); towerDesk(k, 2.4, 0.95, 0.95, low); k.pop();
    block(dx, dz, along ? 2.4 : 0.95, along ? 0.95 : 2.4, 0.95, y);
    k.push(cx, y, cz, crot * Math.PI / 2); towerChair(k, low); k.pop();
    block(cx, cz, 0.5, 0.5, 0.95, y);
  }
}

/** A watch-floor console: plinth, sloped control surface with lit button strips, keyboards, three screens. Front is +z. */
function towerDesk(k, w, d, h, low) {
  k.box('gunmetal', 0, 0.18, 0, w - 0.06, 0.36, d - 0.1);
  k.box('plasticDark', 0, h / 2 + 0.1, -d * 0.08, w, h - 0.28, d * 0.82);
  k.poly('plasticDark', [[-w / 2, h - 0.18, d * 0.12], [w / 2, h - 0.18, d * 0.12], [w / 2, h - 0.05, d * 0.5 - 0.02], [-w / 2, h - 0.05, d * 0.5 - 0.02]].reverse());
  k.poly('gunmetal', [[-w / 2, h - 0.05, d * 0.5 - 0.02], [w / 2, h - 0.05, d * 0.5 - 0.02], [w / 2, h - 0.3, d * 0.5], [-w / 2, h - 0.3, d * 0.5]]);
  const strips = low ? 3 : 6;
  for (let i = 0; i < strips; i++) {
    const key = ['glowCyan', 'glowAmber', 'glowGreen', 'glowBlue', 'glowWhite', 'glowCyan'][i];
    const x0 = -w / 2 + 0.12 + i * ((w - 0.24) / strips);
    k.box(key, x0 + (w - 0.24) / strips / 2, h - 0.1, d * 0.32, (w - 0.24) / strips - 0.1, 0.006, 0.07);
  }
  for (const x of [-w * 0.28, w * 0.28]) k.box('steelDark', x, h - 0.085, d * 0.36 + 0.14, 0.5, 0.02, 0.18);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * (w / 3);
    // low flat panels: a seated operator (eye about 1.2 m) looks over them, out through the glass
    k.box('plasticDark', x, h + 0.15, -d * 0.18, w / 3 - 0.08, 0.32, 0.05);
    k.box(['glowCyan', 'glowGreen', 'glowCool'][i], x, h + 0.15, -d * 0.18 + 0.028, w / 3 - 0.2, 0.24, 0.004);
    k.box('gunmetal', x, h + 0.015, -d * 0.18, 0.1, 0.03, 0.06);
  }
}

/** An office chair on a column and a five-star base. The phone tier gets blocks; the desktop tier the ship's own chair. */
function towerChair(k, low) {
  if (!low) {
    // the ship's own chair, built the same way but with the cushions at eight segments
    k.cyl('steelDark', 0, 0.24, 0, 0.03, 0.4, 8);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      k.pipe('steelDark', [0, 0.05, 0], [Math.cos(a) * 0.24, 0.03, Math.sin(a) * 0.24], 0.012, 6);
      k.cyl('rubber', Math.cos(a) * 0.24, 0.02, Math.sin(a) * 0.24, 0.022, 0.04, 6);
    }
    k.pillow('fabricBlue', 0, 0.51, 0, 0.46, 0.11, 0.46, 3.0, 8);
    k.pillow('fabricBlue', 0, 0.84, -0.2, 0.44, 0.58, 0.1, 3.0, 8);
    for (const s of [-1, 1]) { k.box('steelDark', s * 0.24, 0.66, 0, 0.03, 0.03, 0.34); k.box('steelDark', s * 0.24, 0.58, 0.05, 0.03, 0.14, 0.03); }
    return;
  }
  k.cyl('steelDark', 0, 0.24, 0, 0.03, 0.4, 4);
  k.box('steelDark', 0, 0.035, 0, 0.5, 0.03, 0.06); k.box('steelDark', 0, 0.035, 0, 0.06, 0.03, 0.5);
  k.box('fabricBlue', 0, 0.5, 0, 0.46, 0.1, 0.46);
  k.box('fabricBlue', 0, 0.84, -0.2, 0.44, 0.58, 0.1);
  for (const s of [-1, 1]) k.box('steelDark', s * 0.24, 0.64, 0, 0.03, 0.03, 0.34);
}

export function towerInterior(k, a, low, block) {
  // Reception with a curved nose, separate worktop, displays and task light (moved left to make room for the core).
  B(k, 'counter', -3.9, .52, -1.8, 3.3, 1.04, 1.25, .18); block(-3.9, -1.8, 3.3, 1.25, 1.1);
  B(k, 'steel', -3.9, 1.09, -1.8, 3.45, .1, 1.4, .08);
  k.box('glowCyan', -3.9, .8, -1.158, 2.8, .04, .016);
  screen(k, CELLS.pads, -3.9, 1.5, -2.1, 1.35, .6);
  screen(k, CELLS.pads, -3.7, 2.65, -a.d / 2 + .31, 3.4, 1.45);
  screen(k, CELLS.weather, 3.7, 2.65, -a.d / 2 + .31, 3.4, 1.45);
  for (const z of [1.5, 3]) {
    k.push(-4.7, 0, z, Math.PI / 2);
    k.box('steelDark', 0, .4, 0, .7, .12, .65);
    k.pillow('fabricBlue', 0, .52, 0, .65, .16, .62, 3.2, low ? 6 : 10);
    k.pillow('fabricBlue', 0, .93, -.27, .64, .75, .16, 3.2, low ? 6 : 10);
    for (const s of [-1, 1]) k.box('steel', s * .27, .22, 0, .05, .44, .5); k.pop();
    block(-4.7, z, .85, .8, 1.35);
  }
  // floor line from the entrance to the elevator door, and the lamps over it
  for (let z = 5; z > 1; z -= 1.5) k.box('mark', 0, .028, z, .08, .005, .65);
  const ceiling = x => 4.2 + .45 * Math.sin((x + a.w / 2) / a.w * Math.PI) - .08;
  lamp(k, -3, 3.75, 0, 2.4, ceiling); lamp(k, 3, 3.75, 2, 2.4, ceiling); lamp(k, 0, 3.8, 2.2, 1.6, ceiling);
  drawElevatorCore(k, a, low, block);
  drawCab(k, a, low, block);
}

export function market(k,a,low,block) {
  const colors=['crateB','crateC','pipeBlue','crateA'];
  const cloth=[[1.3,1,.65],[.75,.55,.35],[.38,.67,.84],[.7,.85,.58]];
  for(let i=0;i<4;i++) {
    const x=-12+i*8,cell=CELLS.food+i;
    k.push(x,0,0);
    for(const dx of [-3.6,3.6])for(const z of [-3.8,3.8]){
      k.cyl('steelDark',dx,1.65,z,.065,3.3,8);
      k.box('steel',dx,.1,z,.25,.2,.25);
      block(x+dx,z,.18,.18,3.3);
    }
    // Sloped fabric canopy and scalloped valance, alternating trader colours.
    const mat=colors[i];
    for(const s of [-1,1]) {
      const roof=[[-4,3.46,0],[4,3.46,0],[4,3.05,s*4],[-4,3.05,s*4]];
      k._faceQuad('fabricGrey',roof,[0,1,0],cloth[i]);
      k._faceQuad('fabricGrey',roof.map(([x,y,z])=>[x,y-.012,z]),[0,-1,0],cloth[i]);
      for(let j=0;j<12;j++){
        const dx=-4+j*2/3;
        k._faceQuad(mat,[[dx,3.05,s*4],[dx+2/3,3.05,s*4],[dx+.55,2.87,s*4],[dx+.12,2.87,s*4]],[0,0,s]);
      }
      k.pipe('steelDark',[-3.6,3,s*3.8],[3.6,3,s*3.8],.04,6);
    }
    for(let z=-3.6;z<4;z+=1.2)k.pipe('steelDark',[-3.6,3.07,z],[3.6,3.07,z],.025,6);
    B(k,'counter',0,.55,-1.65,6,1.1,1.15,.08);block(x,-1.65,6,1.15,1.1);
    B(k,'steel',0,1.14,-1.65,6.15,.08,1.3,.035);
    for(const dx of [-2,0,2]){B(k,mat,dx,.53,-1.055,1.82,.83,.035,.025);rivets(k,dx,.53,-1.026,1.8,.8);}
    plaque(k,cell,0,.65,-1.008,3.4,.38);
    screen(k,cell,1.75,1.65,-1.85,1.25,.6);
    k.pipe('steel',[1.75,1.15,-1.85],[1.75,1.4,-1.85],.025,6);
    B(k,'steelDark',0,2.6,3.75,6,.55,.08,.025);
    plaque(k,cell,0,2.6,3.8,5.8,.44);
    lamp(k,-1.6,2.85,.3,1.4,()=>3.42);
    k.pipe('pipeSteel',[-3.5,.1,-3.6],[-3.5,2.9,-3.6],.025,6);
    if(i===0) {
      // Open trays, vacuum ration packs, tins and a coffee dispenser.
      for(let j=0;j<3;j++){
        B(k,'wood',-2+j*.8,1.26,-1.65,.72,.18,.75,.025);
        for(let n=0;n<4;n++)B(k,n%2?'hazard':'crateA',-2.22+j*.8+n*.14,1.41,-1.6,.1,.2,.35,.025);
      }
      B(k,'steel',-.2,1.56,-1.85,.6,.78,.5,.06);
      k.cyl('gunmetal',-.2,2,-1.85,.23,.1,12);
      k.pipe('steel',[-.2,1.57,-1.56],[-.2,1.4,-1.45],.02,6);
      for(const dx of [.35,.65])k.cyl('plastic',dx,1.28,-1.4,.09,.21,10);
    } else if(i===1) {
      for(let j=0;j<4;j++){
        k.cyl('copper',-2.2+j*.7,1.35,-1.6,.18,.25,10);
        k.pipe('steel',[-2.2+j*.7,1.3,-1.6],[-2.2+j*.7,1.68,-1.6],.07,8);
        B(k,'plasticDark',-2.3+j*.65,1.28,-1.15,.38,.08,.26,.02);
        for(let n=0;n<3;n++)k.box('copper',-2.38+j*.65+n*.06,1.33,-1.15,.03,.04,.08);
      }
      plaque(k,CELLS.service,-1.8,1.36,-1.95,1.1,.55);
    } else if(i===2) {
      for(let j=0;j<5;j++){
        k.cyl('pipeBlue',-2.3+j*.55,1.51,-1.65,.17,.65,10);
        k.cyl('steel',-2.3+j*.55,1.85,-1.65,.11,.05,8);
        k.box('white',-2.3+j*.55,1.52,-1.476,.16,.2,.015);
      }
      prop(k,'drum',-2,.025,-3,.75,1.35,.75);prop(k,'drum',-.9,.025,-3,.75,1.35,.75);
      block(x-1.5,-3,2,1,1.4);
    } else {
      for(let j=0;j<4;j++)k.cyl('fabricGrey',-2.3+j*.62,1.4,-1.65,.2,.62,10,{axis:'z',col:[.7+j*.08,.6,.42]});
      k.pipe('steel',[-3,2.5,-3.2],[.8,2.5,-3.2],.035,6);
      for(let j=0;j<4;j++){k.pipe('steel',[-2.6+j*.8,2.5,-3.2],[-2.6+j*.8,2.15,-3.2],.012,6);
        B(k,'fabricBlue',-2.6+j*.8,1.85,-3.2,.5,.7,.12,.08);}
      block(x-1,-3.2,4,.3,2.5);
    }
    prop(k,'crate',2.7,.025,-3,.9,.7,.85);block(x+2.7,-3,1,1,.8);
    prop(k,'crate',-2.8,.025,1.7,.85,.55,.8);block(x-2.8,1.7,1,1,.6);
    // PORT-POLISH: a trader's stool and crate of change behind the counter, a lantern under the canopy, a tarp over the
    // back stock, scuffs where the queue stands, and the string of bulbs that makes the row read as a market at dusk
    k.cyl('steelDark',-2.6,.3,-2.9,.03,.6,6);k.cyl('gunmetal',-2.6,.02,-2.9,.17,.04,low?6:10);k.pillow('leather',-2.6,.64,-2.9,.34,.08,.34,3,low?6:10);
    k.pipe('rubber',[1.6,3.05,2.4],[1.6,2.55,2.4],.01,4);k.cyl('gunmetal',1.6,2.5,2.4,.14,.1,low?6:10,{r2:.06});k.cyl('glowAmber',1.6,2.44,2.4,.11,.02,low?6:10);
    k._faceQuad('fabricGrey',[[-3.4,1.05,-3.9],[-1.2,1.0,-3.95],[-1.1,.55,-2.6],[-3.5,.6,-2.55]],[0,1,0],[.85,.7,.5]);
    groundDecal(k,CELLS.scuff,0,.4,5,1.8,0,.034);
    if(i<3)for(let j=0;j<=10;j++){const t=j/10,bx=3.6+t*(8-7.2),by=3.1-Math.sin(t*Math.PI)*.35;
      if(j<10){const t2=(j+1)/10;k.pipe('rubber',[bx,by,3.8],[3.6+t2*(8-7.2),3.1-Math.sin(t2*Math.PI)*.35,3.8],.01,4);}
      if(j%2)k.box('glowAmber',bx,by-.07,3.8,.08,.1,.08);}
    if(i===1){B(k,'wood',3.3,.9,3.3,.9,1.1,.05,.015);plaque(k,CELLS.notice,3.3,.9,3.33,.82,1.0);block(x+3.3,3.3,.9,.2,1.1);}
    k.pop();
  }
}

export function detailFuel(k,low,block=()=>{}) {
  for(const x of [-8,0,8]) {
    for(const z of [-2.6,2.6])k.pipe('pipeSteel',[x,1,z],[x,5.5,z],.07,8);
    k.pipe('pipeRed',[x,.4,2.8],[x,2,2.8],.09,8);
    k.cyl('hazard',x,1.8,2.91,.24,.04,10,{axis:'z',open:true});
    for(let y=.35;y<5.8;y+=.35)k.pipe('steel',[x-.3,y,2.78],[x+.3,y,2.78],.018,6);
    plaque(k,CELLS.stock,x,3.7,2.72,1,.35);
    // PORT-POLISH: a warning plate on every tank, a hand wheel on the riser, a sight-glass gauge, streaks under the manway
    plaque(k,CELLS.warning,x,2.5,2.74,1.7,.85);
    k.cyl('red',x,1.4,3.05,.2,.04,low?8:14,{axis:'z',open:true});k.cyl('red',x,1.4,3.05,.06,.04,low?6:10,{axis:'z'});
    k.box('red',x,1.4,3.05,.36,.04,.04);k.box('red',x,1.4,3.05,.04,.36,.04);
    k.cyl('white',x+.7,1.6,2.75,.1,.04,low?6:12,{axis:'z'});k.cyl('glowGreen',x+.7,1.6,2.78,.07,.004,low?6:12,{axis:'z'});
    streak(k,x-1.2,3.9,2.74,.6,2.6,0,.72);
  }
  // the bund: a knee-high concrete wall round the farm with a step-through on the apron side, and the kit a fuel crew keeps
  for(const s of [-1,1]){B(k,'concrete',s*12.4,.3,0,.4,.6,13,.04);block(s*12.4,0,.4,13,.6);}
  B(k,'concrete',0,.3,-6.6,25.2,.6,.4,.04);block(0,-6.6,25.2,.4,.6);
  for(const s of [-1,1]){B(k,'concrete',s*7.4,.3,6.6,10.4,.6,.4,.04);block(s*7.4,6.6,10.4,.4,.6);}
  k.push(-10.5,0,5.2,0);
  for(let i=0;i<3;i++){k.cyl('red',(i-1)*.42,.6,0,.16,1.2,low?6:10);k.cyl('steelDark',(i-1)*.42,1.26,0,.05,.1,6);}
  k.box('steelDark',0,.9,-.18,1.4,.05,.03);k.box('steelDark',0,.02,0,1.5,.04,.5);k.pop();block(-10.5,5.2,1.5,.5,1.3);
  prop(k,'pump',9.5,0,5.0,1.2,1,1,2);block(9.5,5.0,1.4,1.2,1.3);
  k.cyl('copper',11.4,.6,-5.6,.04,1.2,6);k.box('hazard',11.4,1.22,-5.6,.3,.08,.3);
  for(let z=-5.6;z<4;z+=1.4)k.box('gunmetal',11.6,.05,z,.2,.08,1.2);
  for(const x of [-6,2])groundDecal(k,CELLS.oil,x+2,-4.5,1.4,1.6,.7,.034);
}

/** Cargo staging: the three containers get a ladder, a tarp, a lamp, tyres, pallets and the dirt of a working yard. */
export function containerDressing(k,a,low,block) {
  // ladder up the east end of the east container, a floodlamp on a short pole between the first two
  for(const y of [.4,.9,1.4,1.9,2.4])k.box('steelDark',13.05,y,-1.2,.05,.04,.45);
  for(const dz of [-1.4,-1.0])k.box('steelDark',13.05,1.45,dz,.05,2.9,.05);
  k.cyl('steelDark',4.5,2.6,3.9,.05,5.2,6);k.box('steelDark',4.5,5.1,3.9,.3,.2,.3);k.box('glowWhite',4.5,5.0,4.06,.26,.12,.02);
  // a tarp lashed over the middle container's roof, straps to the corner castings
  k._faceQuad('fabricGrey',[[-3.5,2.95,-2.6],[3.8,2.97,-2.8],[3.9,2.93,2.7],[-3.6,2.96,2.5]],[0,1,0],[.62,.5,.4]);
  k._faceQuad('fabricGrey',[[-3.5,2.95,-2.6],[-3.6,2.96,2.5],[-3.9,2.3,2.4],[-3.85,2.4,-2.5]],[-1,0,0],[.62,.5,.4]);
  for(const x of [-3.6,3.8])k.pipe('rubber',[x,2.95,-2.6],[x+(x<0?-.3:.3),.2,-2.9],.012,4);
  // tyres, pallets, chocks, a dropped glove-sized something, dust at the doors
  k.push(-14.5,0,1.5,.4);for(let i=0;i<3;i++)k.cyl('rubber',0,.14+i*.26,0,.5,.26,low?8:14);k.cyl('steelDark',0,.14,0,.3,.28,low?8:14);k.pop();
  block(-14.5,1.5,1.1,1.1,.9);
  for(let i=0;i<5;i++){B(k,'wood',14.8,.07+i*.15,-1.5,1.2,.1,1.0,.01);for(const dx of [-.5,0,.5])k.box('wood',14.8+dx,.07+i*.15,-1.5,.1,.14,1.0);}
  block(14.8,-1.5,1.3,1.1,.8);
  for(const x of [-9,0,9])for(const s of [-1,1]){k.box('hazard',x+s*2.5,.1,3.35,.5,.2,.3);}
  for(let x=-11;x<12;x+=4.3)drift(k,x,3.1,3.4,.45,0);
  groundDecal(k,CELLS.scuff,-2,4.3,6,2,0,.034);groundDecal(k,CELLS.tyres,9,5.5,2,6,.3,.034);
}

/** The apron between the buildings: ground support kit, pad boards, cables, scuffs, cones, and the light pools in the dust. */
export function apronDressing(k,low,block) {
  const seg=low?8:14;
  // pad boards at the foot of each pad: a post, the plate, a lamp over it
  for(const [i,x,z,cell] of [[0,-19+2,34,CELLS.padboard],[1,62-15+2,-28+19+1.5,CELLS.pads],[2,62-13+2,30+16+1.5,CELLS.pads]]) {
    k.cyl('steelDark',x,1.2,z,.05,2.4,6);k.box('gunmetal',x,.08,z,.5,.16,.5);
    B(k,'gunmetal',x,1.95,z,2.1,.9,.08,.03);plaque(k,cell,x,1.95,z+.045,1.95,.78);
    k.box('steelDark',x,2.5,z+.08,2.2,.06,.3);k.box('glowWhite',x,2.46,z+.1,2.0,.02,.2);
    block(x,z,.5,.5,2.5);
  }
  // the apron tug by pad 02: cab, bonnet, wheels, tow bar, beacon; and the mobile stair at pad 03
  k.push(44,0,-40,.35);
  B(k,'hazard',0,.55,0,2.0,.5,3.2,.05);B(k,'plasticDark',0,1.25,-.6,1.7,.9,1.4,.06);k.box('glowCool',0,1.3,-1.31,1.4,.5,.02,{col:[.4,.6,.7]});
  B(k,'steelDark',0,.95,1.0,1.8,.3,1.2,.04);for(let i=0;i<5;i++)k.box('gunmetal',-.7+i*.35,1.12,1.0,.1,.04,1.0);
  for(const sx of [-1,1])for(const sz of [-1,1]){k.cyl('rubber',sx*1.05,.38,sz*1.0,.38,.3,seg,{axis:'x'});k.cyl('steel',sx*1.2,.38,sz*1.0,.2,.02,seg,{axis:'x'});}
  k.pipe('steelDark',[0,.5,1.6],[0,.35,3.0],.04,6);k.cyl('steelDark',0,.3,3.0,.14,.1,seg);
  k.cyl('glowAmber',0,1.78,-.6,.07,.1,6);k.box('steelDark',0,1.72,-.6,.1,.03,.1);k.pop();block(44,-40,3.2,4.6,1.8);
  k.push(44,0,42,-.4);
  for(let i=0;i<8;i++){B(k,'steelDark',0,.2+i*.32,-i*.3,1.2,.06,.32,.01);k.box('hazard',0,.23+i*.32,-i*.3+.14,1.1,.02,.03);}
  for(const s of [-1,1]){k.pipe('steel',[s*.62,.3,.2],[s*.62,2.8,-2.3],.03,6);k.pipe('steel',[s*.62,.9,.2],[s*.62,3.3,-2.3],.03,6);}
  B(k,'steelDark',0,2.65,-2.6,1.4,.08,1.0,.02);for(const sx of [-1,1])for(const sz of [-1,1])k.cyl('rubber',sx*.62,.18,sz>0?.3:-2.4,.18,.14,seg,{axis:'x'});
  k.pop();block(44,42,1.6,3.6,2.9);
  // a bowser on a trailer by the fuel header, hose reeled, drips under the coupling
  k.push(70,0,-58,.1);
  k.cyl('steel',0,1.15,0,.75,3.8,seg,{axis:'z'});for(const z of [-1.2,0,1.2])k.cyl('hazard',0,1.15,z,.77,.08,seg,{axis:'z'});
  B(k,'steelDark',0,.45,0,1.4,.2,3.6,.03);for(const s of [-1,1])k.cyl('rubber',s*.85,.36,.4,.36,.3,seg,{axis:'x'});
  k.pipe('steelDark',[0,.5,1.8],[0,.4,3.0],.04,6);k.cyl('red',-.6,.9,-1.9,.3,.2,seg,{axis:'z'});k.cyl('red',-.6,.9,-1.9,.24,.24,seg,{axis:'z'});
  k.box('glowGreen',.5,1.85,-1.5,.12,.06,.06);k.pop();block(70,-58,1.8,4,2);
  groundDecal(k,CELLS.oil,69.8,-56,1.2,1.2,0,.034);
  // cable trays from the floodmast bases to the buildings, hazard-striped ramps where they cross the foot route
  // segments stop short of the nodes and a junction box sits on each, so no two trays share a face (depth layers stay at four)
  const tray=(x0,z0,x1,z1)=>{const l=Math.hypot(x1-x0,z1-z0)-.5,a=Math.atan2(x1-x0,z1-z0);k.push((x0+x1)/2,0,(z0+z1)/2,a);k.box('gunmetal',0,.05,0,.28,.08,l);k.pop();};
  const node=(x,z)=>{B(k,'steelDark',x,.08,z,.44,.16,.44,.02);k.box('glowGreen',x,.165,z+.1,.05,.01,.05);};
  tray(-32,44,-32,52);tray(-32,52,-42,52);node(-32,52);tray(-49.3,-62,-41,-62);node(-41,-62);tray(-50,-61.3,-50,-46);node(-50,-46);
  tray(-50,-46,-54,-46);
  // cones where a tug would cut the corner, scuffs where people stand and turn
  for(const [x,z] of [[-20.5,33.5],[-20.5,36],[28,-9],[31,-9],[34,-9],[21,56]])cone(k,x,z);
  groundDecal(k,CELLS.scuff,-12,39.5,4,3,.3,.034);groundDecal(k,CELLS.scuff,0,36,5,3.5,0,.034);groundDecal(k,CELLS.scuff,-27,10,2.4,5,0,.034);
  groundDecal(k,CELLS.scuff,-27,-30,2.4,5,0,.034);for(const x of [-70,-62,-54,-46])groundDecal(k,CELLS.scuff,x,57,5,2.6,x*.01,.034);
  // ---- light in the dust (the `haze` bucket). Pools under the floodmasts, the halo at each lamp head, spill from windows,
  // signs and lit lintels. Additive, so it reads at dusk and nearly vanishes under the noon sun.
  for(const [x,z] of [[-50,-62],[91,-48],[90,54],[-32,44]]) {
    k.pool(x,.05,z,12,[.07,.06,.045]);for(const dx of [-1,0,1])k.halo(x+dx,11.45,z+.2,.55,[.4,.35,.26]);
  }
  for(const x of [-70,-62,-54,-46])k.pool(x,.05,53,4.5,[.06,.045,.03]);
  const spillAt=(x,z,w,col)=>k.spill(x,z,w,3.2,col);
  for(const x of [-71.8,-52.2])spillAt(x,27.1,2.6,[.035,.06,.065]);
  for(const x of [-63.8,-56.2])spillAt(x,-32.9,1.5,[.035,.06,.065]);
  for(const x of [-37.8,-18.2])spillAt(x,-60.9,1.5,[.035,.06,.065]);
  for(const [x,z,w] of [[-62,28.3,3.2],[-60,-31.7,2.4],[-28,-59.7,4]])spillAt(x,z,w,[.025,.05,.06]);
  k.spill(-28,66,15,4,[.03,.07,.08]);k.spill(-28,65,15,-4,[.03,.07,.08]);
  for(let x=-39;x<-17;x+=3.4)k.halo(x,4.2,-59.1,.35,[.4,.25,.1]);
}
