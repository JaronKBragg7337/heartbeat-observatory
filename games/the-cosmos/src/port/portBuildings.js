// Architecture and fittings use the same bevels, PBR surfaces and prop kit as
// Meridian. All static details are written into material buckets, never meshes.
import { drawProp, PROPS } from '../ship/shipProps.js';
import { CELLS, plaque, atlasUV } from './portArt.js';
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
  const h=4.2, depot=a.kind==='depot', rise=depot?1.3:.45;
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
  plaque(k,depot?CELLS.depot:CELLS.tower,0,3.85,a.d/2+.05,Math.min(a.w-1,8),.48);
  dustSkirt(k,a);
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
    k.pop();
  }
}

export function detailFuel(k,low) {
  for(const x of [-8,0,8]) {
    for(const z of [-2.6,2.6])k.pipe('pipeSteel',[x,1,z],[x,5.5,z],.07,8);
    k.pipe('pipeRed',[x,.4,2.8],[x,2,2.8],.09,8);
    k.cyl('hazard',x,1.8,2.91,.24,.04,10,{axis:'z',open:true});
    for(let y=.35;y<5.8;y+=.35)k.pipe('steel',[x-.3,y,2.78],[x+.3,y,2.78],.018,6);
    plaque(k,CELLS.stock,x,3.7,2.72,1,.35);
  }
}
