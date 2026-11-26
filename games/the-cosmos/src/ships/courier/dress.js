// ============================================================================
// ships/courier/dress.js - the Wayfarer's own room dressing (layout.custom.dress; shipInterior.js calls it once per room).
//
// The flight deck's side glass (shipSystem._buildGlass) stops 0.4 m short of the aft wall, and the side walls stop at the sill, so each
// side had a 0.4 x 1.65 m slot straight out of the ship. Here it is wall: the same panelling as the rest of the flight deck, facing in.
// Pure: it only writes into the kit it is handed (no three.js), so def.js (which the server reads too) may import it.
// ============================================================================

export function courierDress(k, layout, r) {
  if (r.kind !== 'bridge') return;
  const y0 = r.y + 1.05, y1 = r.y + r.h, z0 = r.z1 - 0.4, z1 = r.z1, U = 1.35, V = 2.7;
  for (const [x, n] of [[r.x0, 1], [r.x1, -1]]) {
    k._faceQuadUV('wall:bridge', [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], [n, 0, 0],
      [[z0 / U, (y0 - r.y) / V], [z1 / U, (y0 - r.y) / V], [z1 / U, (y1 - r.y) / V], [z0 / U, (y1 - r.y) / V]]);
    k.bevelBox('steelDark', x + n * 0.03, (y0 + y1) / 2, z0 + 0.03, 0.06, y1 - y0, 0.06, 0.012);     // a post where the glass ends
  }
}
