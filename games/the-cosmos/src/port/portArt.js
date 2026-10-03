// Port finishes share the Meridian's PBR maps. One atlas batches labels,
// displays, opaque wear decals and solar cells; no transparent decal sorting.
// PORT-POLISH (2026-10-03): the atlas grew from 4x4 to 4x6 cells for the crew hall, its menu and notice boards, the fuel
// farm's warning plates, pad boards, wall graffiti, boot scuffs and dust drifts. Still one texture, still one draw call.
import * as THREE from 'three';
import { Layers, mulberry, makeShipMaterials, enableDepthLift } from '../ship/shipTextures.js';
import { DRAW } from '../ship/shipScreens.js';

export const COLS = 4, ROWS = 6;
export const CELLS = {
  port: 0, depot: 1, tower: 2, market: 3, pads: 4, weather: 5,
  stock: 6, service: 7, food: 8, salvage: 9, water: 10, textiles: 11,
  solar: 12, scorch: 13, tyres: 14, oil: 15,
  hall: 16, menu: 17, notice: 18, warning: 19, graffiti: 20, padboard: 21, scuff: 22, drift: 23,
};
const LABELS = [
  ['MARINERIS PORT', 'MARS / ARRIVALS + FREIGHT', '01 MERIDIAN   02 SHUTTLE   03 COURIER'],
  ['SUPPLY / ARRIVALS', 'DEPOT 110 / LOCAL LOGISTICS', 'RECEIVING  >     MANIFEST  >'],
  ['PORT CONTROL', 'DISPATCH / FLIGHT OPERATIONS', 'LOBBY  >    CAB LIFT  >'],
  ['MARINERIS EXCHANGE', 'INDEPENDENT FRONTIER TRADERS', 'FOOD / REPAIR / WATER / FIELD KIT'],
  ['PAD STATUS', '', ''],
  ['WEATHER / SURFACE OPS', 'CO2 ATMOSPHERE / SUIT REQUIRED', 'DUST + WIND: SENSOR OFFLINE'],
  ['SURVEY KITS / A1', 'DRILL STRING / SPARES B2', 'COOLANT / FILTERS C3'],
  ['REPAIR / BENCH 02', 'MERIDIAN / FIELD SERVICE', ''],
  ['ARES PROVISIONS', 'COFFEE 04 / RATION PACK 12', 'DRIED FRUIT 06 / LOCAL STOCK'],
  ['SECOND ORBIT SALVAGE', 'VALVE 18 / CIRCUIT BOARD 24', 'TESTED PARTS / REPAIR BENCH'],
  ['BLUE WELL COOPERATIVE', 'WATER 02 / FILTER 09', 'SEALED VESSELS / RETURN EMPTIES'],
  ['RIDGELINE OUTFITTERS', 'FIELD ROLL 16 / PATCH KIT 05', 'BOOTS / SUIT LINERS / WEBBING'],
];
const HALL_LABEL = ['CREW HALL', 'CANTINA / HIRING / HOT FOOD', 'OPEN EVERY SOL  -  SUITS OFF INSIDE'];
const PADBOARD_LABEL = ['PAD 01 / MERIDIAN', 'NO STANDING UNDER THE HULL', 'ENGINE WASH 40 M  -  EARS COVERED'];
// The comedy lives on the boards (Jaron, 10/3: give the place humour).
const MENU = [
  ['TODAY', ''], ['Regolith Red', '14'], ['(it is chili. it is always chili)', ''], ['Soup of the sol', '9'],
  ['(whatever thawed first)', ''], ['Coffee, real', 'ask'], ['Coffee, "coffee"', '2'], ['Pad 02 Special', '22'],
  ['(you do not want to know)', ''], ['Water, sealed', '3'], ['', ''], ['NO TABS. NO, NOT EVEN YOU, DEV.', ''],
];
const NOTICES = [
  ['LOST', 'one left boot, size 11.', 'last seen pad 02.', 'reward: a right boot.'],
  ['SUIT CHECK', 'before you go out.', 'yes, you.', '- the tower'],
  ['LIFT', 'inspection due', '3 sols ago.', 'it is fine. probably.'],
  ['SOLS WITHOUT', 'AN INCIDENT', '', '0'],
  ['ROOM TO LET', 'bunk 4, depot loft.', 'snorer. bring plugs.', ''],
  ['HIRING', 'all posts.', 'ask the bar.', 'no tabs.'],
];

export function atlasUV(cell) {
  const x=cell%COLS, y=Math.floor(cell/COLS), inset=.003;
  return [[x/COLS+inset,1-(y+1)/ROWS+inset],[(x+1)/COLS-inset,1-(y+1)/ROWS+inset],
    [(x+1)/COLS-inset,1-y/ROWS-inset],[x/COLS+inset,1-y/ROWS-inset]];
}
export function plaque(k,cell,x,y,z,w,h,rot=0) {
  k.push(x,y,z,rot);
  k.poly('signs',[[-w/2,-h/2,0],[w/2,-h/2,0],[w/2,h/2,0],[-w/2,h/2,0]],atlasUV(cell));
  k.pop();
}
export function groundDecal(k,cell,x,z,w,d,rot=0,y=.032) {
  k.push(x,y,z,rot);
  k.poly('soot',[[-w/2,0,d/2],[w/2,0,d/2],[w/2,0,-d/2],[-w/2,0,-d/2]],atlasUV(cell));
  k.pop();
}
/** A lit, alpha-tested decal on a vertical face (graffiti, a scuff up a wall, a dust drift against a kerb). Faces +z before rot. */
export function wallDecal(k,cell,x,y,z,w,h,rot=0,col) {
  k.push(x,y,z,rot);
  k.poly('soot',[[-w/2,-h/2,0],[w/2,-h/2,0],[w/2,h/2,0],[-w/2,h/2,0]],atlasUV(cell),col);
  k.pop();
}

function makeAtlas(low) {
  if(typeof document==='undefined')return {texture:null,update:()=>{},width:low?1024:2048,height:low?768:1536};
  const c=document.createElement('canvas'); c.width=low?1024:2048; c.height=c.width*ROWS/COLS/2;
  const g=c.getContext('2d'), w=c.width/COLS,h=c.height/ROWS, rnd=mulberry(1311);
  const at=(i,fn)=>{g.save();g.translate(i%COLS*w,Math.floor(i/COLS)*h);fn();g.restore();};
  const panel=(i,rows,warm=i>=8)=>at(i,()=>{
    g.fillStyle='#071c24';g.fillRect(0,0,w,h);
    g.strokeStyle=warm?'#e5ac6c':'#67c4cf';g.lineWidth=2;g.strokeRect(3,3,w-6,h-6);
    g.textBaseline='top';g.textAlign='left';
    rows.forEach((s,j)=>{g.font=`${j?500:700} ${h*(j?.105:.145)}px monospace`;
      g.fillStyle=j?'#b6d0cf':warm?'#edbc84':'#8fedef';g.fillText(s,9,h*(.13+j*.27),w-18);});
    g.fillStyle='rgba(121,224,234,.045)';for(let y=0;y<h;y+=4)g.fillRect(0,y,w,1);
  });
  LABELS.forEach((rows,i)=>panel(i,rows));
  panel(CELLS.hall,HALL_LABEL,true);
  panel(CELLS.padboard,PADBOARD_LABEL,false);
  // Paint the Meridian's own diagnostic drawing into the repair display.
  g.save();g.translate(3*w,h);DRAW.schematic(g,w,h,{},0);g.restore();
  g.save();g.translate(0,3*h);g.fillStyle='#0b223c';g.fillRect(0,0,w,h);
  g.strokeStyle='#51739a';g.lineWidth=1;
  for(let x=2;x<w;x+=w/12)for(let y=2;y<h;y+=h/5)g.strokeRect(x,y,w/12-3,h/5-3);g.restore();
  for(const i of [13,14,15]) {
    g.save();g.translate(i%4*w,3*h);
    // Alpha-tested edges discard empty texels without transparent blending,
    // sorting, or an opaque rectangular concrete patch around each stain.
    g.clearRect(0,0,w,h);
    if(i===13||i===15){
      g.save();g.translate(w*.5,h*.5);g.scale(1,h/w);
      const gr=g.createRadialGradient(0,0,1,0,0,w*.48);
      gr.addColorStop(0,i===13?'#272b2a':'#323834');gr.addColorStop(.4,'#494b43');gr.addColorStop(1,'rgba(73,75,67,0)');
      g.fillStyle=gr;g.fillRect(-w/2,-w/2,w,w);g.restore();
      for(let n=0;n<130;n++){g.globalAlpha=.1;g.fillStyle='#292c27';g.fillRect(w*(.2+rnd()*.6),h*(.2+rnd()*.6),rnd()*w*.08,2);}
    } else {
      g.strokeStyle='#41463f';g.globalAlpha=.35;g.lineWidth=w*.065;
      for(const x of [.3,.7]) {g.beginPath();g.moveTo(x*w,0);g.bezierCurveTo(x*w+w*.08,h*.4,x*w-w*.08,h*.7,x*w,h);g.stroke();}
      g.globalAlpha=.23;g.lineWidth=2;
      for(let y=0;y<h;y+=6)for(const x of [.3,.7]){g.beginPath();g.moveTo(x*w-w*.025,y);g.lineTo(x*w+w*.025,y+3);g.stroke();}
    }
    g.restore();
  }
  // ---- the cantina's chalkboard menu ------------------------------------------------------------------------
  at(CELLS.menu,()=>{
    g.fillStyle='#1d2420';g.fillRect(0,0,w,h);
    g.strokeStyle='#6b5234';g.lineWidth=w*.02;g.strokeRect(w*.01,h*.02,w*.98,h*.96);
    for(let n=0;n<40;n++){g.globalAlpha=.06;g.fillStyle='#fff';g.fillRect(rnd()*w,rnd()*h,rnd()*w*.2,2);}
    g.globalAlpha=1;g.textBaseline='top';
    MENU.forEach(([a,b],j)=>{const y=h*(.05+j*.077),small=a.startsWith('(');
      g.font=`${j?400:700} ${h*(small?.052:j?.06:.075)}px monospace`;g.fillStyle=j?'#e8e2cf':'#f7d58a';g.textAlign='left';
      if(j===MENU.length-1){g.fillStyle='#ffb29a';g.font=`700 ${h*.055}px monospace`;}
      g.fillText(a,w*.05,y,w*.72);
      if(b){g.textAlign='right';g.fillStyle='#f7d58a';g.fillText(b,w*.95,y);}
    });
  });
  // ---- the notice board: cork, pinned paper, hand lettering ----------------------------------------------------
  at(CELLS.notice,()=>{
    g.fillStyle='#8a6a44';g.fillRect(0,0,w,h);
    for(let n=0;n<900;n++){g.fillStyle=n%2?'rgba(60,40,20,.25)':'rgba(230,200,150,.18)';g.fillRect(rnd()*w,rnd()*h,2,2);}
    g.strokeStyle='#3a2a18';g.lineWidth=w*.015;g.strokeRect(w*.008,h*.012,w*.984,h*.976);
    NOTICES.forEach((lines,j)=>{
      const col=j%3,row=Math.floor(j/3),px=w*(.05+col*.32),py=h*(.08+row*.47),pw=w*.27,ph=h*.38;
      g.save();g.translate(px+pw/2,py+ph/2);g.rotate((rnd()-.5)*.12);
      g.fillStyle=['#efe6d2','#f3f0e4','#e9dcc0','#f4e7a8','#eef0f2','#f7d9c6'][j];g.fillRect(-pw/2,-ph/2,pw,ph);
      g.fillStyle='#b4342c';g.beginPath();g.arc(0,-ph/2+ph*.07,ph*.035,0,7);g.fill();
      g.textAlign='center';g.textBaseline='top';
      lines.forEach((t,i)=>{const big=i===0||(j===3&&i===3);g.font=`${big?700:400} ${ph*(big?(j===3&&i===3?.4:.16):.12)}px ${big?'sans-serif':'monospace'}`;g.fillStyle=big?'#2c2320':'#44403a';
        g.fillText(t,0,-ph/2+ph*(.14+i*.2),pw*.92);});
      g.restore();
    });
  });
  // ---- fuel farm warning plate --------------------------------------------------------------------------------
  at(CELLS.warning,()=>{
    g.fillStyle='#d8d2c4';g.fillRect(0,0,w,h);
    g.fillStyle='#b4302a';for(let x=-h;x<w+h;x+=h*.3){g.beginPath();g.moveTo(x,0);g.lineTo(x+h*.15,0);g.lineTo(x+h*.15-h*.3,h);g.lineTo(x-h*.3,h);g.closePath();g.fill();}
    g.fillStyle='#f1ece0';g.fillRect(w*.08,h*.14,w*.84,h*.72);
    g.strokeStyle='#b4302a';g.lineWidth=w*.012;g.strokeRect(w*.08,h*.14,w*.84,h*.72);
    g.textAlign='center';g.textBaseline='top';g.fillStyle='#b4302a';
    g.font=`900 ${h*.2}px sans-serif`;g.fillText('NO FLAME',w/2,h*.17);
    g.fillStyle='#2a2622';g.font=`700 ${h*.105}px monospace`;g.fillText('FUEL FARM  /  CH4 + LOX',w/2,h*.42);
    g.font=`500 ${h*.085}px monospace`;g.fillText('there is no air out here to burn.',w/2,h*.57);
    g.fillText('it will find some.',w/2,h*.68);
  });
  // ---- graffiti: stencil letters and a chalk arrow, alpha-tested onto a wall --------------------------------------
  at(CELLS.graffiti,()=>{
    g.clearRect(0,0,w,h);g.textAlign='left';g.textBaseline='top';
    g.fillStyle='rgba(236,226,206,.92)';g.font=`900 ${h*.19}px sans-serif`;
    g.fillText('EARTH',w*.06,h*.08);g.fillText('225,000,000 KM',w*.06,h*.3);
    g.strokeStyle='rgba(236,226,206,.9)';g.lineWidth=h*.06;g.lineCap='round';
    g.beginPath();g.moveTo(w*.08,h*.72);g.lineTo(w*.5,h*.72);g.moveTo(w*.42,h*.62);g.lineTo(w*.5,h*.72);g.lineTo(w*.42,h*.82);g.stroke();
    g.fillStyle='rgba(236,226,206,.9)';g.font=`700 ${h*.09}px monospace`;g.fillText('THAT WAY (ISH)',w*.55,h*.68);
    g.fillStyle='rgba(255,170,110,.85)';g.font=`700 ${h*.085}px monospace`;g.fillText('wipe your boots  - mgmt',w*.06,h*.88);
    // stencil bridges: thin cuts through the big letters so they read as sprayed through a template
    g.globalCompositeOperation='destination-out';
    for(let x=w*.1;x<w*.95;x+=w*.09)g.fillRect(x,h*.05,3,h*.45);
  });
  // ---- boot scuffs (a lit alpha decal: dust ground into pavement where people stand and turn) ----------------
  at(CELLS.scuff,()=>{
    g.clearRect(0,0,w,h);
    // alpha-tested, so a texel is either this colour or nothing: rust-dust tones that sit on both pale panels and concrete
    for(let n=0;n<30;n++){g.globalAlpha=.03+rnd()*.07;g.fillStyle=n%3?'#8a6c52':'#a98b6a';
      g.save();g.translate(w*(.15+rnd()*.7),h*(.15+rnd()*.7));g.rotate(rnd()*6.3);g.fillRect(-w*.04,-h*.015,w*(.03+rnd()*.07),h*.025);g.restore();}
    g.globalAlpha=1;
  });
  // ---- dust drift: a soft fan of regolith that fades out, for the foot of walls and kerbs ------------------------
  at(CELLS.drift,()=>{
    g.clearRect(0,0,w,h);
    const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(154,112,78,0)');gr.addColorStop(.55,'rgba(154,112,78,.55)');gr.addColorStop(1,'rgba(142,100,70,.95)');
    g.fillStyle=gr;g.fillRect(w*.01,0,w*.98,h*.99);
    for(let n=0;n<220;n++){g.globalAlpha=.25;g.fillStyle=n%2?'#b58a62':'#6e4e38';g.fillRect(rnd()*w,h*(.35+rnd()*.64),2+rnd()*4,1.5);}
    g.globalAlpha=1;
  });
  // An opaque white sample for non-decal dirt/expansion seams in the same
  // material bucket. UV inset on decals keeps this patch outside their crops.
  g.fillStyle='#ffffff';g.fillRect(c.width-2,c.height-2,2,2);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  let lastStatus='';
  return {texture,width:c.width,height:c.height,update(status){
    const key=status.join('|');if(key===lastStatus)return;lastStatus=key;
    panel(4,['PAD STATUS',...status]);texture.needsUpdate=true;
  }};
}

export function makePortMaterials(tier,shared) {
  const low=tier==='low', ship=shared||makeShipMaterials({tier});
  const atlas=makeAtlas(low);
  let pavement=null;
  if(typeof document!=='undefined') {
    const l=new Layers(4,4,low?64:128,741);
    l.rect(0,0,4,4,{c:'#77766d',h:128,r:.94,m:0});
    for(let n=0;n<4500;n++){const x=l.rnd()*4,y=l.rnd()*4;
      l.rect(x,y,.008+l.rnd()*.025,.008,{c:n%2?'#aaa294':'#4f5048',h:119+l.rnd()*18,r:.96,m:0,a:.28});}
    for(const x of [0,2])l.rect(x,0,.015,4,{c:'#383b34',h:95,r:1,m:0});
    l.rect(0,0,4,.018,{c:'#373b33',h:90,r:1,m:0});
    for(let i=0;i<30;i++)l.rect(l.rnd()*4,l.rnd()*4,.1+l.rnd()*.6,.012,{c:'#c2b394',a:.15,h:126,r:1,m:0});
    // PORT-POLISH: a dusting of rust-coloured fines in the seams, so the apron is Mars concrete and not a car park.
    for(let i=0;i<260;i++)l.rect(l.rnd()*4,l.rnd()*4,.02+l.rnd()*.12,.006+l.rnd()*.02,{c:'#9a6a48',a:.22,h:127,r:1,m:0});
    pavement=l.finish(1.4);
  }
  const pavementMaps=pavement?{map:pavement.albedo,normalMap:pavement.normal,roughnessMap:pavement.orm}:{};
  const concrete=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.95,...pavementMaps});
  if(!pavement)concrete.color.setHex(0x77766d);
  const paint=ship.hull.clone();
  const metal=ship.metal.clone(); // Keep the ship's environment without mutating its materials.
  const mats={concrete,paint,metal,glow:ship.glow,wall:ship['wall:cargo'],floor:ship['floor:deck'],fabric:ship.fabric,glassTint:ship.glassTint,
    signs:new THREE.MeshBasicMaterial({map:atlas.texture,color:0xffffff,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),
    mark:new THREE.MeshStandardMaterial({color:0xd3ad63,roughness:1,...(pavement?{normalMap:pavement.normal,roughnessMap:pavement.orm}:{}),polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),
    soot:new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,map:atlas.texture,alphaTest:.06,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
    // PORT-POLISH: light in the dust. Additive, unlit, no depth write: pools under the floodmasts, spill from the lit windows and signs
    // and the glow round a lamp head. One bucket, one draw call, drawn after everything opaque.
    haze:new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,side:THREE.DoubleSide})};
  for(const m of Object.values(mats))enableDepthLift(m);
  const ownedTextures=[atlas.texture,...Object.values(pavement||{})];
  if(!shared)for(const m of Object.values(mats))for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(m[key])ownedTextures.push(m[key]);
  return {mats,atlas,ownedTextures:ownedTextures.filter(Boolean),sharedTextures:!!shared};
}

export function textureBytes(textures) {
  let bytes=0;
  for(const t of new Set(textures))if(t?.image) {
    let w=t.image.width,h=t.image.height;
    if(!w||!h)continue;
    bytes+=w*h*4;
    while(t.generateMipmaps&&(w>1||h>1)){
      w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));bytes+=w*h*4;
    }
  }
  return bytes;
}
