// ============================================================================
// shipSite.js — where the ship sits: the flattest ground within sight.
//
// OWNS: choosing a landing spot and heading near a given point, by sampling the
//       same ground the ship will stand on. Pure functions, no three.js, so the
//       validator can repeat the choice exactly.
// DOES NOT OWN: the ground (it is handed a sampler) or the ship (shipFlight.js).
// ============================================================================

import { cartesianToGeodetic, localFrame } from '../world/geodesy.js';
import { GEAR } from './shipSpec.js';

const DEG = Math.PI / 180;

/**
 * Score every candidate (distance, bearing, heading) by how level the four leg
 * feet, the keel and the foot of the ramp would be, and return the best.
 * @param body    planet record
 * @param ground  (dx,dy,dz) -> surface radius or null
 * @param origin  world position to stay near (the player's spawn)
 */
export function findLandingSite(body, ground, origin) {
  const g0 = cartesianToGeodetic(body, origin.x, origin.y, origin.z);
  const f = localFrame(g0.lat, g0.lon);
  const at = (e, n) => {
    const x = origin.x + f.east.x * e + f.north.x * n, y = origin.y + f.east.y * e + f.north.y * n, z = origin.z + f.east.z * e + f.north.z * n;
    const l = Math.hypot(x, y, z);
    return { x, y, z, l };
  };
  const rad = (e, n) => { const q = at(e, n); return ground(q.x / q.l, q.y / q.l, q.z / q.l); };
  // Can the player at the origin see the ship? Sample the ground along the line of sight
  // to the hull and to the top of the bridge; a hill in between costs points, not the site.
  const r0 = rad(0, 0);
  const blocked = (e, n, targetH) => {
    const eyeH = 1.7;
    for (let i = 1; i < 14; i++) {
      const t = i / 14;
      const gr = rad(e * t, n * t);
      if (gr === null || gr === undefined) continue;
      const rayH = eyeH + (targetH - eyeH) * t;
      if (gr - r0 > rayH) return true;
    }
    return false;
  };
  let best = null;
  for (let dist = 26; dist <= 92; dist += 4) {
    for (let brg = -180; brg < 180; brg += 10) {
      const cN = Math.cos(brg * DEG) * dist, cE = Math.sin(brg * DEG) * dist;
      for (let hd = 0; hd < 360; hd += 15) {
        const ch = Math.cos(hd * DEG), sh = Math.sin(hd * DEG);
        // ship-local (x right, z aft) -> east/north offsets from the origin
        const off = (lx, lz) => [cE + (sh * -lz) + (ch * lx), cN + (ch * -lz) + (-sh * lx)];
        const feet = GEAR.legs.map((l) => { const [e, n] = off(l.x, l.z); return rad(e, n); });
        if (feet.some((v) => v === null || v === undefined)) continue;
        const keel = GEAR.keel.map((k) => { const [e, n] = off(k.x, k.z); return rad(e, n); });
        const [re, rn] = off(0, 26);
        const ramp = rad(re, rn);
        const fMax = Math.max(...feet), fMin = Math.min(...feet);
        const spread = fMax - fMin;
        const keelOver = Math.max(0, Math.max(...keel) - fMax - 0.35);
        const rampDrop = Math.abs(ramp - fMin);
        // the ramp must be walkable: not too steep, not vanishingly short
        const gMid = (fMax + fMin) / 2 - r0;
        const seen = (blocked(cE, cN, gMid + 4) ? 2.6 : 0) + (blocked(cE, cN, gMid + 9) ? 3.2 : 0);
        const score = spread * 3 + keelOver * 6 + Math.max(0, rampDrop - 2.6) * 2 + Math.max(0, 1.6 - rampDrop) * 2 + dist * 0.03 + seen;
        if (!best || score < best.score) best = { score, e: cE, n: cN, hd, spread, keelOver, dist, brg };
      }
    }
  }
  return { site: best, at, frame: f };
}

/** World position of the ship origin for a site, a little above where the legs will settle. */
export function siteOrigin(ground, at, site) {
  const c = at(site.e, site.n);
  const up = { x: c.x / c.l, y: c.y / c.l, z: c.z / c.l };
  const r0 = ground(up.x, up.y, up.z);
  const R = r0 + 2.4 + Math.max(0.8, site.spread) + 0.6;
  return { x: up.x * R, y: up.y * R, z: up.z * R };
}
