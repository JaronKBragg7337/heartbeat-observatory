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
  { name: 'Market traders', x: -58, z: 53 }, { name: 'Reception clerk', x: -63.9, z: -42.1 },
];

// ---------------------------------------------------------------------------------------------
// THE CONTROL TOWER. A person can walk up it: from the lobby, through the door in the stair core,
// up five switchback levels (120 risers of 0.1875 m, the same riser as the Meridian's stairs), and
// out into the glass cab at 22.5 m. Everything is in TOWER-LOCAL metres (x right, z toward the lobby
// door, y up from the apron) around the tower's centre; `towerFloorAt` is the one place that says where
// the floor is, and the renderer, the collision and the validator all read it.
// ---------------------------------------------------------------------------------------------
export const TOWER = (() => {
  const t = BUILDINGS.find(b => b.kind === 'tower');
  const risers = 12, rise = 0.1875, tread = 0.27, run = risers * tread;      // one flight: 2.25 m up over 3.24 m
  const levels = 5, pitch = 2 * risers * rise;                                // 4.5 m between landings, two flights
  const core = { x0: -1.45, x1: 1.45, z0: -5.2, z1: 0.5, t: 0.2 };            // the stair core: 2.9 x 5.7 m outside
  const inner = { x0: core.x0 + core.t, x1: core.x1 - core.t, z0: core.z0 + core.t, z1: core.z1 - core.t };
  const zLow = -0.7, zHigh = zLow - run;                                      // foot of each flight, and its head
  const door = { x0: -0.6, x1: 0.6, h: 2.3 };                                 // 1.2 x 2.3 m, front of the core (z = core.z1)
  const cabY = levels * pitch;                                                // 22.5 m: the cab floor
  const cab = { floorY: cabY, half: 6.4, floorHalf: 6.3, glassY0: cabY + 0.9, glassY1: cabY + 3.2, roofY: cabY + 3.5, eave: 7.5 };
  return {
    id: t.id, x: t.x, z: t.z, core, inner, door, cab,
    spine: { x0: -0.15, x1: 0.15, z0: zHigh, z1: zLow },
    flight: { risers, rise, tread, run, zLow, zHigh, a: { x0: -1.25, x1: -0.15 }, b: { x0: 0.15, x1: 1.25 } },
    back: { z0: -5.0, z1: zHigh }, front: { z0: zLow, z1: 0.5 },
    levels, pitch, headroom: 2.2, topY: 31.0,
  };
})();

/** Every floor surface of the tower as {x0,x1,z0,z1, yAt(x,z)}. Built once. */
export const TOWER_SURFACES = (() => {
  const T = TOWER, F = T.flight, out = [];
  for (let n = 0; n < T.levels; n++) {
    const y0 = n * T.pitch, mid = y0 + F.risers * F.rise, top = y0 + T.pitch;
    out.push({ x0: F.a.x0, x1: F.a.x1, z0: F.zHigh, z1: F.zLow, yAt: (x, z) => y0 + (F.zLow - z) / F.run * (mid - y0), name: `flight A ${n}` });
    out.push({ x0: T.inner.x0, x1: T.inner.x1, z0: T.back.z0, z1: T.back.z1, yAt: () => mid, name: `back landing ${n}` });
    out.push({ x0: F.b.x0, x1: F.b.x1, z0: F.zHigh, z1: F.zLow, yAt: (x, z) => mid + (z - F.zHigh) / F.run * (top - mid), name: `flight B ${n}` });
    if (n < T.levels - 1) out.push({ x0: T.inner.x0, x1: T.inner.x1, z0: T.front.z0, z1: T.inner.z1, yAt: () => top, name: `landing ${n + 1}` });
  }
  // the top landing and its threshold into the cab, and the cab floor round the core
  out.push({ x0: T.inner.x0, x1: T.inner.x1, z0: T.front.z0, z1: T.inner.z1, yAt: () => T.cab.floorY, name: 'top landing' });
  out.push({ x0: T.door.x0, x1: T.door.x1, z0: T.inner.z1, z1: T.core.z1, yAt: () => T.cab.floorY, name: 'cab threshold' });
  const h = T.cab.floorHalf, c = T.core;
  out.push({ x0: -h, x1: c.x0, z0: -h, z1: h, yAt: () => T.cab.floorY, name: 'cab floor W' });
  out.push({ x0: c.x1, x1: h, z0: -h, z1: h, yAt: () => T.cab.floorY, name: 'cab floor E' });
  out.push({ x0: c.x0, x1: c.x1, z0: c.z1, z1: h, yAt: () => T.cab.floorY, name: 'cab floor S' });
  out.push({ x0: c.x0, x1: c.x1, z0: -h, z1: c.z0, yAt: () => T.cab.floorY, name: 'cab floor N' });
  return out;
})();

/**
 * The tower's floor under tower-local (lx,lz) for feet at height feetY: the highest surface not more than a
 * step above the feet, or null where the ground itself is the floor (the lobby, outside).
 */
export function towerFloorAt(lx, lz, feetY, stepM = 0.55) {
  let best = null;
  for (const s of TOWER_SURFACES) {
    if (lx < s.x0 || lx > s.x1 || lz < s.z0 || lz > s.z1) continue;
    const y = s.yAt(lx, lz);
    if (y <= feetY + stepM && (best === null || y > best)) best = y;
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
      // The graded apron is engineered fill, not whatever the cut happened to expose: a metre of
      // loose regolith over compacted duricrust, then the natural strata. (Without this, digging
      // beside the pad at spawn was digging basalt, 2900 kg/m3, three bites to a full load.)
      if (p.y <= 0.05 && p.y > -3.2 && this.weight(px, py, pz) === 1) {
        const pad0 = PADS.some(a => Math.abs(p.x-a.x)<=a.w/2 && Math.abs(p.z-a.z)<=a.d/2);
        const bld0 = BUILDINGS.some(a => Math.abs(p.x-a.x)<=a.w/2 && Math.abs(p.z-a.z)<=a.d/2);
        const taxi0=(p.x>=21&&p.x<=39&&Math.abs(p.z)<=55)||
          (p.x>=38&&p.x<=60&&[-28,30].some(z=>Math.abs(p.z-z)<=5));
        if (!(pad0 || bld0 || taxi0) || p.y < -0.5) return p.y > -1.2 ? MATERIALS.regolith : MATERIALS.duricrust;
      }
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
