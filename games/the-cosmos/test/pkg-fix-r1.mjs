import { allShipDefs } from '../src/ships/registry.js';
import { visualsFor } from '../src/ships/visuals.js';
import { propBoxOf } from '../src/ships/layoutKit.js';
import { overlaps, doorClearSpace } from '../src/ship/clearance.js';
import { buildInterior } from '../src/ship/shipInterior.js';
import { makeShipMaterials, makeSignAtlas } from '../src/ship/shipTextures.js';
import { OpeningModel, freshOpening, openingBody } from '../src/opening/state.js';
import { LocalPatch } from '../src/world/planetMesh.js';
import { ridePose, rideSupportHeight, rideSurfaceHeight } from '../src/opening/rideVehicle.js';
import { hintState } from '../src/ui/goalHint.js';
import { PortSystem } from '../src/port/portSystem.js';
import { BUILDINGS, TOWER, createPortSite } from '../src/port/portSpec.js';
import { Registry } from '../src/core/registry.js';
import { ShipStage } from '../src/opening/stageShip.js';
import { buildLifeboatExterior } from '../src/ships/lifeboat/exterior.js';
import { LAYOUT as SKIFF } from '../src/ships/lifeboat/spec.js';
import { materialAt } from '../src/world/field.js';

export async function run({ check, section, THREE, mars }) {
  section('fix-r1: every door stays clear, destination soil, visible gangway and surface-following ride');
  const mats=makeShipMaterials('low'),defs=allShipDefs();
  const labels=defs.flatMap(s=>s.layout.doors.map(d=>d.sign).filter(Boolean)),signs=makeSignAtlas(labels);
  for(const s of defs) {
    const spaces=s.layout.doors.map(d=>doorClearSpace(d)),bad=[];
    for(const p of s.layout.props)for(const d of spaces)if(overlaps(propBoxOf(p),d))bad.push(p.kind+' in '+p.room+' / '+d.id);
    check(s.type+': every prop box clears every door, including decorative props',bad.length===0,bad.join('; '));
    const interior=buildInterior({...s.layout,custom:visualsFor(s.type).custom},mats,{tier:'low',signs});
    const fittingBad=(interior.fittingBoxes||[]).filter(b=>spaces.some(d=>overlaps(b,d)));
    check(s.type+': rendered pipes, rails, glass and notices clear door approaches',fittingBad.length===0);
    const names=[...new Set(labels)],cells=names.map(l=>JSON.stringify(signs.uvFor(l)));
    check(s.type+': labels have distinct atlas cells',new Set(cells).size===names.length&&s.layout.doors.every(d=>names.includes(d.sign)));
  }
  check('unknown sign fails instead of silently displaying MEDBAY',(()=>{try{signs.uvFor('NONEXISTENT ROOM');return false;}catch{return true;}})());
  check('Hellas Dawn has exactly one MEDBAY label',defs.find(s=>s.type==='transport').layout.doors.filter(d=>d.sign==='MEDBAY').length===1);
  check('a deliberately obstructing decorative prop is detected',overlaps({x0:3.2,x1:3.6,y0:0,y1:3,z0:17,z1:18},doorClearSpace({axis:'x',at:3.4,c:17.7,w:1.4,y:0,h:2.3})));
  // The port atlas paints gradients: a canvas stub whose calls return chainable no-op objects (the shared stub returns undefined).
  const ctx=()=>new Proxy({},{get:(t,k)=>k in t?t[k]:k==='getImageData'||k==='createImageData'?(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray((w||1)*(h||1)*4)}):k==='createRadialGradient'||k==='createLinearGradient'||k==='createPattern'?()=>({addColorStop(){}}):k==='measureText'?()=>({width:0}):()=>{},set:(t,k,v)=>{t[k]=v;return true;}}),prevDoc=globalThis.document;
  globalThis.document={createElement:()=>{const c={width:0,height:0};const g=ctx();c.getContext=()=>g;return c;}};
  const site=createPortSite(mars),engine={scene:new THREE.Scene(),track:x=>x,untrack:()=>{}};
  const port=new PortSystem(engine,new Registry(),site,'low',mats);port.build();
  const spaces=BUILDINGS.filter(a=>a.doorW).map(a=>doorClearSpace({id:a.id,axis:'z',at:a.z+a.d/2,c:a.x,w:a.doorW,y:0,h:2.8}));
  for(const y of [0,TOWER.cab.floorY])spaces.push(doorClearSpace({id:'lift',axis:'z',at:TOWER.z+TOWER.core.z1,c:TOWER.x,w:1.2,y,h:2.3}));
  const A=BUILDINGS.find(a=>a.kind==='arrivals');for(const s of [-1,1])spaces.push(doorClearSpace({id:'arrivals',axis:'x',at:A.x+s*A.w/2,c:A.z+.2,w:3,y:0,h:3}));
  check('every port room: every rendered fitting box clears every entrance and lift door',port.fittingBoxes.length>100&&port.fittingBoxes.every(b=>spaces.every(d=>!overlaps(b,d))));
  const collisionBad=port.boxes.filter(b=>spaces.some(d=>overlaps(b,d)));
  check('port collision boxes do not block doorway clear spaces',collisionBad.length===0,JSON.stringify(collisionBad));
  globalThis.document=prevDoc;
  port.setNight(1);check('night keeps settlement lights at building fronts and paths',port.settlementLights.length===4&&port.settlementLights.every(l=>l.intensity>0));
  const stage=new ShipStage({engine,type:'transport',mats:{int:mats,ext:mats},signs,tier:'low'});
  stage.setRamps(0,1,true);stage.sw.place(14,-.2,26.7,Math.PI/2);
  stage.update(0,new THREE.Vector3(14,1.4,26.7),new THREE.Vector3(1,0,0),{inside:true,first:true});
  check('boarding ramp remains visible while the interior hides the hull',stage.exterior.root.visible&&stage.exterior.ramps.airlock.hinge.visible&&stage.exterior.ramps.airlock.hinge.parent===stage.exterior.root);
  stage.update(0,new THREE.Vector3(25,2,26.7),new THREE.Vector3(-1,0,0),{inside:false,first:true});
  check('from outside: hull hardware and closed cargo hatch are solid and visible',stage.hardware.visible&&stage.cargoClosure.visible&&stage.ramp.cargo===0);
  stage.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(25,2,0),new THREE.Vector3(-1,0,0));
  check('outside hull ray hits the liner flank',ray.intersectObject(stage.hardware,true).length>0);
  for(const world of ['mars','ceres']) {
    const s=freshOpening();s.stage=4;s.dest={world,faction:null};const m=new OpeningModel(s,'fix-r1-'+world),p=m.toWorld(4,.1,20),mat=materialAt(m.body,p.x,p.y,p.z);
    check(world+': first dig material belongs to that world',world==='mars'?mat.name.includes('Martian'):mat.name.includes('Ceres'),mat.name);
    m.release();
  }
  const m=openingBody('ride-check'),patches=[new LocalPatch(m.body,{sizeM:140,res:81,skirtM:6}),new LocalPatch(m.body,{sizeM:10000,res:49,skirtM:15})];
  for(const p of patches)p.rebuild(m.origin.x,m.origin.y,m.origin.z);
  let min=Infinity;
  for(let t=0;t<=65;t+=.05){const p=ridePose(t,m.height),yaw=THREE.MathUtils.lerp(Math.atan2(-90,20),Math.atan2(2593,373),Math.min(t/6,1)),y=rideSupportHeight(m,patches,p.x,p.z,yaw);
    for(const dx of [-1.6,0,1.6])for(const dz of [-2.2,0,2.2])min=Math.min(min,y-rideSurfaceHeight(m,patches,p.x+Math.cos(yaw)*dx+Math.sin(yaw)*dz,p.z-Math.sin(yaw)*dx+Math.cos(yaw)*dz));}
  check('entire rover ride: every wheel footprint stays above the actual rendered surface',min>=.024,`minimum clearance ${min}`);
  let h={},g={id:'arrivals',onPlanet:true,distance:50,target:{},reach:12};h=hintState(h,59,g);check('goal arrow stays hidden during the first 59 seconds',!h.visible);
  h=hintState(h,1,g);check('goal arrow appears at 60 seconds away',h.visible);
  check('goal arrow hides when close, aboard, or when the goal changes',!hintState(h,0,{...g,distance:5}).visible&&!hintState(h,0,{...g,onPlanet:false}).visible&&!hintState(h,0,{...g,id:'kestrel'}).visible);
  { // Skiff flight deck: nothing of the hull may stand between the pilot's aisle and the deck's aft door
    const ext=buildLifeboatExterior(SKIFF,mats,{world:'mars'}),hull=ext.root.getObjectByName('hull');ext.root.updateMatrixWorld(true);
    const door=SKIFF.doors.find(d=>d.id==='d_cockpit'),bad=[];
    for(const x of [-1.2,-.6,0,.6,1.2])for(const y of [1.2,1.8,2.2])for(const dxs of [-.5,0,.5]){
      const from=new THREE.Vector3(x,y,-4.6),to=new THREE.Vector3(door.c+dxs*door.w*.8,Math.min(y,door.h-.1),door.at),dir=to.clone().sub(from);
      const hit=new THREE.Raycaster(from,dir.clone().normalize(),0,dir.length()-.01).intersectObject(hull,false);if(hit.length)bad.push(x+','+y+' hits hull at '+hit[0].distance.toFixed(2));
    }
    check('Skiff flight deck: the hull never covers the aft door from the pilot aisle',bad.length===0,bad.slice(0,3).join('; '));
  }
}
