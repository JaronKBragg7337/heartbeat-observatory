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
export const BUILDINGS = [
  { id: 'COS-MARS-STR-0110', kind: 'depot', name: 'Supply depot', x: -62, z: 18, w: 24, d: 18, h: 7.44, doorW: 3.2 },
  { id: 'COS-MARS-STR-0111', kind: 'market', name: 'Open market', x: -58, z: 53, w: 32, d: 8, h: 3.46 },
  { id: 'COS-MARS-STR-0112', kind: 'tower', name: 'Port control', x: -60, z: -39, w: 12, d: 12, h: 28, doorW: 2.4 },
  { id: 'COS-MARS-PRP-0113', kind: 'fuel', name: 'Fuel farm', x: 57, z: -70, w: 24, d: 12, h: 6 },
  { id: 'COS-MARS-PRP-0114', kind: 'containers', name: 'Cargo staging', x: 51, z: 65, w: 26, d: 6, h: 2.9 },
  { id: 'COS-MARS-STR-0115', kind: 'sign', name: 'Port beacon sign', x: -28, z: 65, w: 16, d: 1, h: 5 },
];
export const NPC_SPOTS = [
  { name: 'Supply clerk', x: -65, z: 15.5 }, { name: 'Arrival guide', x: -12, z: 39 },
  { name: 'Market traders', x: -58, z: 53 }, { name: 'Port dispatcher', x: -60, z: -39 },
];
export const CONCRETE = MATERIALS.concrete;

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
      const e = Math.max(0, Math.abs(x*right.x+y*right.y+z*right.z)-this.halfWidth);
      const n = Math.max(0, Math.abs(x*back.x+y*back.y+z*back.z)-this.halfDepth);
      const t = Math.min(1, Math.hypot(e,n)/this.gradeM);
      return 1 - t*t*t*(t*(t*6-15)+10);
    },
    apply(base, px, py, pz) {
      const w = this.weight(px, py, pz);
      if (!w) return base;
      const plane=(px-center.x)*f.up.x+(py-center.y)*f.up.y+(pz-center.z)*f.up.z;
      return base*(1-w)+plane*w;
    },
    materialAt(px, py, pz) {
      const p=this.toLocal({x:px,y:py,z:pz});
      if (p.y < -0.5 || p.y > 0.05) return null;
      const pad = PADS.some(a => Math.abs(p.x-a.x)<=a.w/2 && Math.abs(p.z-a.z)<=a.d/2);
      const building = BUILDINGS.some(a => Math.abs(p.x-a.x)<=a.w/2 && Math.abs(p.z-a.z)<=a.d/2);
      const taxi=(p.x>=21&&p.x<=39&&Math.abs(p.z)<=55)||
        (p.x>=38&&p.x<=60&&[-28,30].some(z=>Math.abs(p.z-z)<=5));
      return pad || building || taxi ? CONCRETE : null;
    },
  };
  return port;
}
