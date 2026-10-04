// A surveyed port in the planet's frame. No rendering dependency.
import { geodeticToCartesian, cartesianToGeodetic, localFrame } from '../world/geodesy.js';
import { surfaceRadiusFast, MATERIALS } from '../world/field.js';
import { findLandingSite } from '../ship/shipSite.js';

export const PORT_ID = 'COS-MARS-STR-0100';
export const PORT_NAME = 'MARINERIS PORT';
export const PADS = [
  { id: 'COS-MARS-STR-0101', name: 'Pad 01 / Meridian', number: '01', x: 0, z: 0, w: 38, d: 64 },
  { id: 'COS-MARS-STR-0102', name: 'Pad 02 / shuttle', number: '02', x: 62, z: -28, w: 30, d: 38 },
  { id: 'COS-MARS-STR-0103', name: 'Pad 03 / courier', number: '03', x: 62, z: 30, w: 26, d: 32 },
];
// OPENING2: the line-transport apron. The 120 m Ares liner fits no pad (the pads are 38 x 64 m), so the port has a big apron west of the
// kerb with a concrete walkway to the arrivals hall; ships of the Mars Line land here. Port-local metres (x right, z back), same plane.
// The ship's origin is at LINER_SPOT (nose to -z): its starboard gangway ends on the walkway, its stern ramp on the apron.
export const APRON = { id: 'COS-MARS-STR-0104', name: 'Apron A / line transports', number: 'A', x: -190, z: 0, w: 50, d: 150, blendM: 60 };
export const WALKWAY = { id: 'COS-MARS-STR-0105', name: 'Arrivals walkway', number: 'W', x0: -166, x1: -102, z0: 27, z1: 53 };
export const LINER_SPOT = { x: -190, z: 5 };
export const BUILDINGS = [
  { id: 'COS-MARS-STR-0110', kind: 'depot', name: 'Supply depot', x: -62, z: 18, w: 24, d: 18, h: 7.44, doorW: 3.2 },
  { id: 'COS-MARS-STR-0111', kind: 'market', name: 'Open market', x: -58, z: 53, w: 32, d: 8, h: 3.46 },
  { id: 'COS-MARS-STR-0112', kind: 'tower', name: 'Port control', x: -60, z: -39, w: 12, d: 12, h: 28, doorW: 2.4 },
  { id: 'COS-MARS-PRP-0113', kind: 'fuel', name: 'Fuel farm', x: 57, z: -70, w: 24, d: 12, h: 6 },
  { id: 'COS-MARS-PRP-0114', kind: 'containers', name: 'Cargo staging', x: 51, z: 65, w: 26, d: 6, h: 2.9 },
  { id: 'COS-MARS-STR-0115', kind: 'sign', name: 'Port beacon sign', x: -28, z: 65, w: 16, d: 1, h: 5 },
  // PORT-POLISH: the crew hall / cantina is a real building now (it was four boxes and a sprite in multiplayerView). Same footprint
  // and door the server uses (server/authority.mjs CREW_HALL: door at z -60, candidates stand along z -68, x -34..-22).
  { id: 'COS-MARS-STR-0116', kind: 'hall', name: 'Crew hall', x: -28, z: -68, w: 24, d: 14, h: 5, doorW: 4 },
  // OPENING2: the arrivals hall, an open concourse under a roof just inside the kerb, with the world board (BIBLE-v3 10.1).
  { id: 'COS-MARS-STR-0117', kind: 'arrivals', name: 'Arrivals hall', x: -88, z: 40, w: 24, d: 10, h: 4.6 },
];
export const NPC_SPOTS = [
  { name: 'Supply clerk', x: -65, z: 16.9 }, { name: 'Arrival guide', x: -12, z: 39 },
  { name: 'Market traders', x: -58, z: 53 }, { name: 'Reception clerk', x: -63.9, z: -42.1 },
];

// Tower dimensions in tower-local metres; the cab furniture and spots stay as built.
export const TOWER = (() => {
  const t = BUILDINGS.find(b => b.kind === 'tower');
  const core = { x0: -1.45, x1: 1.45, z0: -5.2, z1: .5, t: .2 };
  const inner = { x0: -1.25, x1: 1.25, z0: -5, z1: .3 };
  return { id:t.id, x:t.x, z:t.z, core, inner,
    door:{x0:-.6,x1:.6,h:2.3}, car:{x0:-1.1,x1:1.1,z0:-2.3,z1:.3,height:2.6},
    cab:{floorY:22.5,half:6.4,floorHalf:6.3,glassY0:23.4,glassY1:25.7,roofY:26,eave:7.5},
    topY:31 };
})();
export const TOWER_SURFACES = (() => {
  const T=TOWER, h=T.cab.floorHalf, c=T.core, yAt=()=>T.cab.floorY;
  return [
    {x0:-h,x1:c.x0,z0:-h,z1:h,yAt,name:'cab floor W'},
    {x0:c.x1,x1:h,z0:-h,z1:h,yAt,name:'cab floor E'},
    {x0:c.x0,x1:c.x1,z0:c.z1,z1:h,yAt,name:'cab floor S'},
    {x0:c.x0,x1:c.x1,z0:-h,z1:c.z0,yAt,name:'cab floor N'},
    {x0:T.door.x0,x1:T.door.x1,z0:T.inner.z1,z1:c.z1,yAt,name:'cab sill'},
  ];
})();
export function towerFloorAt(lx,lz,feetY,stepM=.35) {
  let best=null;
  for(const s of TOWER_SURFACES) {
    if(lx<s.x0||lx>s.x1||lz<s.z0||lz>s.z1)continue;
    const y=s.yAt(lx,lz);
    if(y<=feetY+stepM&&(best===null||y>best))best=y;
  }
  return best;
}

/** Where the people who work the tower stand or sit: cab positions in PORT-local metres, with the way they face. */
export const TOWER_SPOTS = [
  { id: 'cab-pad-1', name: 'Pad controller, pad 01', pose: 'seated', x: TOWER.x - 3.3, y: TOWER.cab.floorY, z: TOWER.z + 4.3, face: 'south' },
  { id: 'cab-pad-2', name: 'Pad controller, pads 02 and 03', pose: 'seated', x: TOWER.x, y: TOWER.cab.floorY, z: TOWER.z + 4.3, face: 'south' },
  { id: 'cab-ground', name: 'Ground controller', pose: 'seated', x: TOWER.x + 3.3, y: TOWER.cab.floorY, z: TOWER.z + 4.3, face: 'south' },
  { id: 'cab-approach', name: 'Approach controller', pose: 'seated', x: TOWER.x - 4.45, y: TOWER.cab.floorY, z: TOWER.z + 1.4, face: 'west' },
  { id: 'cab-weather', name: 'Weather officer', pose: 'seated', x: TOWER.x + 4.45, y: TOWER.cab.floorY, z: TOWER.z + 1.4, face: 'east' },
  { id: 'cab-supervisor', name: 'Watch supervisor', pose: 'standing', x: TOWER.x, y: TOWER.cab.floorY, z: TOWER.z + 2.2, face: 'south' },
  { id: 'cab-runner', name: 'Shift runner', pose: 'standing', x: TOWER.x - 4.0, y: TOWER.cab.floorY, z: TOWER.z - 3.8, face: 'east' },
  { id: 'cab-binoculars', name: 'Lookout at the glass', pose: 'standing', x: TOWER.x + 4.2, y: TOWER.cab.floorY, z: TOWER.z - 4.3, face: 'east' },
];
export const CONCRETE = MATERIALS.concrete;
/** OPENING2: is this port-local point on the liner apron or its walkway (concrete, not diggable)? */
export const onApron = (x, z) => (Math.abs(x - APRON.x) <= APRON.w / 2 && Math.abs(z - APRON.z) <= APRON.d / 2) || (x >= WALKWAY.x0 && x <= WALKWAY.x1 && z >= WALKWAY.z0 && z <= WALKWAY.z1);

/** Protected pavement/structure columns, including airlock hoods and pad service rails. */
export function clearSpoilGround(site, x, y, z, margin=.3) {
  const p=site.toLocal({x,y,z});
  if([...PADS,...BUILDINGS].some(a=>Math.abs(p.x-a.x)<=a.w/2+margin+1.5&&Math.abs(p.z-a.z)<=a.d/2+margin+1.5))return false;
  if(p.x>=21-margin&&p.x<=39+margin&&Math.abs(p.z)<=55+margin)return false;
  if(Math.abs(p.x-APRON.x)<=APRON.w/2+margin+2&&Math.abs(p.z-APRON.z)<=APRON.d/2+margin+2)return false;                                   // OPENING2
  if(p.x>=WALKWAY.x0-margin&&p.x<=WALKWAY.x1+margin&&p.z>=WALKWAY.z0-margin&&p.z<=WALKWAY.z1+margin)return false;
  if(p.x>=38-margin&&p.x<=60+margin&&[-28,30].some(v=>Math.abs(p.z-v)<=5+margin))return false;
  if(Math.abs(p.x-86)<1+margin&&p.z>=-70-margin&&p.z<=30+margin)return false;
  if(p.x>=58-margin&&p.x<=86+margin&&Math.abs(p.z+70)<1+margin)return false;
  if(PADS.slice(1).some(a=>p.x>=a.x+a.w/2-margin&&p.x<=86+margin&&Math.abs(p.z-a.z)<1+margin))return false;
  if(Math.abs(p.x+27)<1+margin&&p.z>=-60-margin&&p.z<=65+margin)return false;
  if([[-50,-62],[91,-48],[90,54],[-32,44]].some(([x,z])=>Math.hypot(p.x-x,p.z-z)<1+margin))return false;
  if(Math.abs(p.x)>=102-margin&&Math.abs(p.x)<=104+margin&&Math.abs(p.z)<=88+margin)return false;
  return true;
}

export function createPortSite(body, spawn = { lat: -14, lon: -59.2 }) {
  const datum = geodeticToCartesian(body, spawn.lat, spawn.lon, 0);
  const dr = Math.hypot(datum.x, datum.y, datum.z);
  const ground = (x, y, z) => surfaceRadiusFast(body, x, y, z);
  const r = ground(datum.x / dr, datum.y / dr, datum.z / dr);
  const origin = { x: datum.x * r / dr, y: datum.y * r / dr, z: datum.z * r / dr };
  const { site, at } = findLandingSite(body, ground, origin);
  const c = at(site.e, site.n), cr = ground(c.x / c.l, c.y / c.l, c.z / c.l);
  const center = { x: c.x * cr / c.l, y: c.y * cr / c.l, z: c.z * cr / c.l };
  const g = cartesianToGeodetic(body, center.x, center.y, center.z), f = localFrame(g.lat, g.lon);
  const heading = site.hd * Math.PI / 180, ch = Math.cos(heading), sh = Math.sin(heading);
  const right = {}, back = {};
  for (const k of ['x', 'y', 'z']) {
    right[k] = f.east[k] * ch - f.north[k] * sh;
    back[k] = -f.north[k] * ch - f.east[k] * sh;
  }
  const port = { bodyId: body.id, center, right, back, up: f.up, heading, site,
    halfWidth: 105, halfDepth: 88, gradeM: 160,
    toWorld(x, y, z) { return { x: center.x + right.x*x + f.up.x*y + back.x*z,
      y: center.y + right.y*x + f.up.y*y + back.y*z,
      z: center.z + right.z*x + f.up.z*y + back.z*z }; },
    toLocal(p) { const x=p.x-center.x, y=p.y-center.y, z=p.z-center.z;
      return { x:x*right.x+y*right.y+z*right.z, y:x*f.up.x+y*f.up.y+z*f.up.z, z:x*back.x+y*back.y+z*back.z }; },
    weight(px, py, pz) {
      const x=px-center.x, y=py-center.y, z=pz-center.z;
      const lx=x*right.x+y*right.y+z*right.z, lz=x*back.x+y*back.y+z*back.z;
      const e = Math.max(0, Math.abs(lx)-this.halfWidth);
      const n = Math.max(0, Math.abs(lz)-this.halfDepth);
      const t = Math.min(1, Math.hypot(e,n)/this.gradeM);
      const w0 = 1 - t*t*t*(t*(t*6-15)+10);
      if (w0 >= 1 || lx > -100) return w0;
      // OPENING2: the apron and its walkway are flat too (their own, shorter blend), so the liner never lands on a slope.
      const rw = (r, bl) => { const dx=Math.max(0,Math.abs(lx-(r.x0+r.x1)/2)-(r.x1-r.x0)/2), dz=Math.max(0,Math.abs(lz-(r.z0+r.z1)/2)-(r.z1-r.z0)/2);
        const u=Math.min(1,Math.hypot(dx,dz)/bl); return 1-u*u*u*(u*(u*6-15)+10); };
      const A=APRON;
      return Math.max(w0, rw({x0:A.x-A.w/2,x1:A.x+A.w/2,z0:A.z-A.d/2,z1:A.z+A.d/2}, A.blendM), rw(WALKWAY, 30));
    },
    apply(base, px, py, pz) {
      const w = this.weight(px, py, pz);
      if (!w) return base;
      const plane=(px-center.x)*f.up.x+(py-center.y)*f.up.y+(pz-center.z)*f.up.z;
      return base*(1-w)+plane*w;
    },
    materialAt(px, py, pz) {
      const p=this.toLocal({x:px,y:py,z:pz});
      // The graded apron is engineered fill, not whatever the cut happened to expose: a metre of
      // loose regolith over compacted duricrust, then the natural strata. (Without this, digging
      // beside the pad at spawn was digging basalt, 2900 kg/m3, three bites to a full load.)
      if (p.y <= 0.05 && p.y > -3.2 && this.weight(px, py, pz) === 1) {
        const pad0 = PADS.some(a => Math.abs(p.x-a.x)<=a.w/2 && Math.abs(p.z-a.z)<=a.d/2);
        const bld0 = BUILDINGS.some(a => Math.abs(p.x-a.x)<=a.w/2 && Math.abs(p.z-a.z)<=a.d/2);
        const taxi0=(p.x>=21&&p.x<=39&&Math.abs(p.z)<=55)||
          (p.x>=38&&p.x<=60&&[-28,30].some(z=>Math.abs(p.z-z)<=5))||onApron(p.x,p.z);
        if (!(pad0 || bld0 || taxi0) || p.y < -0.5) return p.y > -1.2 ? MATERIALS.regolith : MATERIALS.duricrust;
      }
      if (p.y < -0.5 || p.y > 0.05) return null;
      const pad = PADS.some(a => Math.abs(p.x-a.x)<=a.w/2 && Math.abs(p.z-a.z)<=a.d/2);
      const building = BUILDINGS.some(a => Math.abs(p.x-a.x)<=a.w/2 && Math.abs(p.z-a.z)<=a.d/2);
      const taxi=(p.x>=21&&p.x<=39&&Math.abs(p.z)<=55)||
        (p.x>=38&&p.x<=60&&[-28,30].some(z=>Math.abs(p.z-z)<=5))||onApron(p.x,p.z);
      return pad || building || taxi ? CONCRETE : null;
    },
  };
  return port;
}
