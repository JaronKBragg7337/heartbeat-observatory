// ============================================================================
// hullLoft.js - a hull as a table of cross sections, and the questions that table answers.
//
// OWNS: the octagonal section at any z (cubic Hermite through the stations), is-this-point-inside, the underside the landing
//       constraint feeds on, the half-width the walker's hull push reads. Pure maths: no three.js.
// DOES NOT OWN: the mesh (src/ships/<type>/exterior.js lofts the same table into plates), or any one ship's table.
//
// A station is [z, half-width, keel y, deck y, top chamfer, bottom chamfer]. The Meridian's own loft (src/ship/shipExterior.js)
// uses the same maths; this is the copy a new ship class reads, so a hull is a data table in its own folder.
// ============================================================================

export function makeHull(S) {
  const cols = ['hw', 'yb', 'yt', 'ct', 'cb'];
  function section(z) {
    const out = {};
    if (z <= S[0][0]) { cols.forEach((c, i) => { out[c] = S[0][i + 1]; }); return out; }
    if (z >= S[S.length - 1][0]) { cols.forEach((c, i) => { out[c] = S[S.length - 1][i + 1]; }); return out; }
    let i = 0;
    while (z > S[i + 1][0]) i++;
    const a = S[i], b = S[i + 1];
    const h = b[0] - a[0], t = (z - a[0]) / h;
    const tangent = (k, idx) => {
      const p = S[Math.max(0, idx - 1)], n = S[Math.min(S.length - 1, idx + 1)];
      const dz = n[0] - p[0];
      return dz > 0 ? (n[k] - p[k]) / dz : 0;
    };
    cols.forEach((c, ci) => {
      const k = ci + 1;
      const m0 = tangent(k, i) * h, m1 = tangent(k, i + 1) * h;
      const t2 = t * t, t3 = t2 * t;
      out[c] = (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * m1;
    });
    return out;
  }
  function octagon(z, inset = 0) {
    const s = section(z);
    const hw = s.hw - inset, yb = s.yb + inset, yt = s.yt - inset;
    const ct = Math.max(0.01, s.ct - inset * 0.414), cb = Math.max(0.01, s.cb - inset * 0.414);
    return [
      [hw, yb + cb], [hw, yt - ct], [hw - ct, yt], [-(hw - ct), yt],
      [-hw, yt - ct], [-hw, yb + cb], [-(hw - cb), yb], [hw - cb, yb],
    ];
  }
  function insideHull(x, y, z, margin = 0) {
    const P = octagon(z);
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const l = Math.hypot(ex, ey);
      const d = (-(x - a[0]) * ey + (y - a[1]) * ex) / l;
      if (d < margin) return false;
    }
    return true;
  }
  return {
    stations: S, z0: S[0][0], z1: S[S.length - 1][0],
    section, octagon, insideHull,
    top: (z) => section(z).yt,
    halfWidth: (z) => section(z).hw,
    underside: (z) => section(z),
  };
}
