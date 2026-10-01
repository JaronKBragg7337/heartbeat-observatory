// Port finishes share the Meridian's PBR maps. One atlas batches labels,
// displays, opaque wear decals and solar cells; no transparent decal sorting.
import * as THREE from 'three';
import { Layers, mulberry, makeShipMaterials, enableDepthLift } from '../ship/shipTextures.js';
import { DRAW } from '../ship/shipScreens.js';

export const CELLS = {
  port: 0, depot: 1, tower: 2, market: 3, pads: 4, weather: 5,
  stock: 6, service: 7, food: 8, salvage: 9, water: 10, textiles: 11,
  solar: 12, scorch: 13, tyres: 14, oil: 15,
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

export function atlasUV(cell) {
  const x=cell%4, y=Math.floor(cell/4), inset=.003;
  return [[x/4+inset,1-(y+1)/4+inset],[(x+1)/4-inset,1-(y+1)/4+inset],
    [(x+1)/4-inset,1-y/4-inset],[x/4+inset,1-y/4-inset]];
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

function makeAtlas(low) {
  if(typeof document==='undefined')return {texture:null,update:()=>{}};
  const c=document.createElement('canvas'); c.width=low?1024:2048; c.height=low?512:1024;
  const g=c.getContext('2d'), w=c.width/4,h=c.height/4, rnd=mulberry(1311);
  const panel=(i,rows)=>{
    g.save(); g.translate(i%4*w,Math.floor(i/4)*h);
    g.fillStyle='#071c24';g.fillRect(0,0,w,h);
    g.strokeStyle=i>=8?'#e5ac6c':'#67c4cf';g.lineWidth=2;g.strokeRect(3,3,w-6,h-6);
    g.textBaseline='top';g.textAlign='left';
    rows.forEach((s,j)=>{g.font=`${j?500:700} ${h*(j?.105:.145)}px monospace`;
      g.fillStyle=j?'#b6d0cf':i>=8?'#edbc84':'#8fedef';g.fillText(s,9,h*(.13+j*.27),w-18);});
    g.fillStyle='rgba(121,224,234,.045)';for(let y=0;y<h;y+=4)g.fillRect(0,y,w,1);
    g.restore();
  };
  LABELS.forEach((rows,i)=>panel(i,rows));
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
  // An opaque white sample for non-decal dirt/expansion seams in the same
  // material bucket. UV inset on decals keeps this patch outside their crops.
  g.fillStyle='#ffffff';g.fillRect(c.width-2,c.height-2,2,2);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  let lastStatus='';
  return {texture,update(status){
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
    pavement=l.finish(1.4);
  }
  const pavementMaps=pavement?{map:pavement.albedo,normalMap:pavement.normal,roughnessMap:pavement.orm}:{};
  const concrete=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.95,...pavementMaps});
  if(!pavement)concrete.color.setHex(0x77766d);
  const paint=ship.hull.clone();
  const metal=ship.metal.clone(); // Keep the ship's environment without mutating its materials.
  const mats={concrete,paint,metal,glow:ship.glow,wall:ship['wall:cargo'],floor:ship['floor:deck'],fabric:ship.fabric,
    signs:new THREE.MeshBasicMaterial({map:atlas.texture,color:0xffffff,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),
    mark:new THREE.MeshStandardMaterial({color:0xd3ad63,roughness:1,...(pavement?{normalMap:pavement.normal,roughnessMap:pavement.orm}:{}),polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),
    soot:new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,map:atlas.texture,alphaTest:.06,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})};
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
