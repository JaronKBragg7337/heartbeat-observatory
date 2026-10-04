// fix-r1: one clear volume for the renderer, placement audit and regression tests.
export function doorClearSpace(d, approach = .55) {
  return { id: d.id, y0: d.y + .08, y1: d.y + d.h,
    ...(d.axis === 'x' ? { x0: d.at - approach, x1: d.at + approach, z0: d.c - d.w / 2, z1: d.c + d.w / 2 }
      : { x0: d.c - d.w / 2, x1: d.c + d.w / 2, z0: d.at - approach, z1: d.at + approach }) };
}
export function overlaps(a, b) {
  return ['x', 'y', 'z'].every(k => a[k + '1'] > b[k + '0'] + .001 && a[k + '0'] < b[k + '1'] - .001);
}
export function boundsOf(points) {
  return Object.fromEntries(['x', 'y', 'z'].flatMap((k, i) => [[k + '0', Math.min(...points.map(p => p[i]))], [k + '1', Math.max(...points.map(p => p[i]))]]));
}
// Decorative fittings are optional; reserve openings before generating them, including non-colliding glass/pipes.
// Audit records describe complete primitives, before they are merged into material buckets.
export function reserveClearance(kit, spaces, records = []) {
  kit.clearanceEnabled = false;
  let nesting = 0;
  const points = (x, y, z, w, h, d) => [-1, 1].flatMap(sx => [-1, 1].flatMap(sy => [-1, 1].map(sz => [x + sx*w/2, y + sy*h/2, z + sz*d/2])));
  const shapes = {
    box: a => points(...a.slice(1, 7)), bevelBox: a => points(...a.slice(1, 7)), pillow: a => points(...a.slice(1, 7)),
    boxMM: a => points((a[1]+a[4])/2,(a[2]+a[5])/2,(a[3]+a[6])/2,a[4]-a[1],a[5]-a[2],a[6]-a[3]),
    pipe: a => { const r=a[3]; return a.slice(1,3).flatMap(p => points(...p,2*r,2*r,2*r)); },
    cyl: a => { const r=Math.max(a[4],a[7]?.r2||0), h=a[5], ax=a[7]?.axis||'y'; return points(a[1],a[2],a[3],ax==='x'?h:2*r,ax==='y'?h:2*r,ax==='z'?h:2*r); },
    poly: a => a[1], _faceQuad: a => a[1], _faceQuadUV: a => a[1],
  };
  for (const [name, shape] of Object.entries(shapes)) {
    const original = kit[name]; if (!original) continue;
    kit[name] = function(...args) {
      if (!this.clearanceEnabled || nesting) return original.apply(this,args);
      const b = boundsOf(shape(args).map(p => this._tp(...p)));
      if (spaces.some(s => overlaps(b,s))) return this;
      records.push({ kind: name, material: args[0], ...b });
      nesting++; try { return original.apply(this,args); } finally { nesting--; }
    };
  }
  return records;
}
