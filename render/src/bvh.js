// hb-render: BVH builder (binned SAH, 12 bins, leaves of up to 4 triangles).
// Input: flattened triangle arrays from flattenMeshes(). Triangles are reordered in place so the
// GPU needs no index indirection. Output node layout (2 x vec4 per node):
//   [minx, miny, minz, bits(leftChild | firstTri)], [maxx, maxy, maxz, bits(triCount)]
//   triCount == 0 -> inner node, children at leftChild and leftChild+1.

export function buildBVH(flat) {
  const { pos, nrm, uv, triCount } = flat;
  const cent = new Float32Array(triCount * 3);
  const bmin = new Float32Array(triCount * 3), bmax = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    for (let a = 0; a < 3; a++) {
      const v0 = pos[t * 12 + a], v1 = pos[t * 12 + 4 + a], v2 = pos[t * 12 + 8 + a];
      const mn = Math.min(v0, v1, v2), mx = Math.max(v0, v1, v2);
      bmin[t * 3 + a] = mn; bmax[t * 3 + a] = mx; cent[t * 3 + a] = (mn + mx) * 0.5;
    }
  }
  const order = new Uint32Array(triCount);
  for (let i = 0; i < triCount; i++) order[i] = i;

  const nodes = []; // {min:[3], max:[3], left, count, first}
  const MAX_NODES = triCount * 2 + 8;
  const nodeMin = new Float32Array(MAX_NODES * 3), nodeMax = new Float32Array(MAX_NODES * 3);
  const nodeLeft = new Uint32Array(MAX_NODES), nodeCount = new Uint32Array(MAX_NODES), nodeFirst = new Uint32Array(MAX_NODES);
  let nodeN = 0;

  const bounds = (first, count) => {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = first; i < first + count; i++) {
      const t = order[i];
      for (let a = 0; a < 3; a++) { if (bmin[t * 3 + a] < mn[a]) mn[a] = bmin[t * 3 + a]; if (bmax[t * 3 + a] > mx[a]) mx[a] = bmax[t * 3 + a]; }
    }
    return [mn, mx];
  };
  const area = (mn, mx) => { const dx = mx[0] - mn[0], dy = mx[1] - mn[1], dz = mx[2] - mn[2]; return 2 * (dx * dy + dy * dz + dz * dx); };

  const BINS = 12;
  const binMin = new Float32Array(BINS * 3), binMax = new Float32Array(BINS * 3), binCnt = new Int32Array(BINS);
  const stack = [];
  const root = nodeN++;
  stack.push([root, 0, triCount]);
  let maxDepth = 0;
  while (stack.length) {
    const [ni, first, count, depth = 0] = stack.pop();
    if (depth > maxDepth) maxDepth = depth;
    const [mn, mx] = bounds(first, count);
    nodeMin.set(mn, ni * 3); nodeMax.set(mx, ni * 3);
    nodeFirst[ni] = first; nodeCount[ni] = count; nodeLeft[ni] = 0;
    if (count <= 4) continue;
    // centroid bounds
    const cmn = [Infinity, Infinity, Infinity], cmx = [-Infinity, -Infinity, -Infinity];
    for (let i = first; i < first + count; i++) {
      const t = order[i];
      for (let a = 0; a < 3; a++) { const c = cent[t * 3 + a]; if (c < cmn[a]) cmn[a] = c; if (c > cmx[a]) cmx[a] = c; }
    }
    let bestCost = Infinity, bestAxis = -1, bestSplit = -1;
    const parentArea = area(mn, mx);
    for (let axis = 0; axis < 3; axis++) {
      const ext = cmx[axis] - cmn[axis];
      if (ext <= 1e-12) continue;
      binCnt.fill(0); binMin.fill(Infinity); binMax.fill(-Infinity);
      const scale = BINS / ext;
      for (let i = first; i < first + count; i++) {
        const t = order[i];
        let b = Math.floor((cent[t * 3 + axis] - cmn[axis]) * scale); if (b >= BINS) b = BINS - 1; if (b < 0) b = 0;
        binCnt[b]++;
        for (let a = 0; a < 3; a++) { if (bmin[t * 3 + a] < binMin[b * 3 + a]) binMin[b * 3 + a] = bmin[t * 3 + a]; if (bmax[t * 3 + a] > binMax[b * 3 + a]) binMax[b * 3 + a] = bmax[t * 3 + a]; }
      }
      // sweep right to left for suffix areas
      const rArea = new Float64Array(BINS), rCnt = new Int32Array(BINS);
      let smn = [Infinity, Infinity, Infinity], smx = [-Infinity, -Infinity, -Infinity], sc = 0;
      for (let b = BINS - 1; b > 0; b--) {
        if (binCnt[b]) { for (let a = 0; a < 3; a++) { smn[a] = Math.min(smn[a], binMin[b * 3 + a]); smx[a] = Math.max(smx[a], binMax[b * 3 + a]); } sc += binCnt[b]; }
        rArea[b] = sc ? area(smn, smx) : 0; rCnt[b] = sc;
      }
      let lmn = [Infinity, Infinity, Infinity], lmx = [-Infinity, -Infinity, -Infinity], lc = 0;
      for (let b = 0; b < BINS - 1; b++) {
        if (binCnt[b]) { for (let a = 0; a < 3; a++) { lmn[a] = Math.min(lmn[a], binMin[b * 3 + a]); lmx[a] = Math.max(lmx[a], binMax[b * 3 + a]); } lc += binCnt[b]; }
        if (lc === 0 || rCnt[b + 1] === 0) continue;
        const cost = 0.125 + (lc * area(lmn, lmx) + rCnt[b + 1] * rArea[b + 1]) / parentArea;
        if (cost < bestCost) { bestCost = cost; bestAxis = axis; bestSplit = b; }
      }
    }
    if (bestAxis < 0 || bestCost >= count) {
      if (count <= 8) continue; // leaf
      // fall back to median split on the largest centroid axis
      let axis = 0, ext = -1;
      for (let a = 0; a < 3; a++) if (cmx[a] - cmn[a] > ext) { ext = cmx[a] - cmn[a]; axis = a; }
      const sub = Array.from(order.subarray(first, first + count)).sort((p, q) => cent[p * 3 + axis] - cent[q * 3 + axis]);
      order.set(sub, first);
      const mid = first + (count >> 1);
      const l = nodeN++, r = nodeN++;
      nodeLeft[ni] = l; nodeCount[ni] = 0;
      stack.push([l, first, mid - first, depth + 1]); stack.push([r, mid, first + count - mid, depth + 1]);
      continue;
    }
    // partition
    const ext = cmx[bestAxis] - cmn[bestAxis], scale = BINS / ext;
    let i = first, j = first + count - 1;
    while (i <= j) {
      const t = order[i];
      let b = Math.floor((cent[t * 3 + bestAxis] - cmn[bestAxis]) * scale); if (b >= BINS) b = BINS - 1;
      if (b <= bestSplit) i++; else { order[i] = order[j]; order[j] = t; j--; }
    }
    const mid = i;
    if (mid === first || mid === first + count) continue; // degenerate -> leaf
    const l = nodeN++, r = nodeN++;
    nodeLeft[ni] = l; nodeCount[ni] = 0;
    stack.push([l, first, mid - first, depth + 1]); stack.push([r, mid, first + count - mid, depth + 1]);
  }

  // reorder triangle data
  const pos2 = new Float32Array(pos.length), nrm2 = new Float32Array(nrm.length), uv2 = new Float32Array(uv.length);
  for (let i = 0; i < triCount; i++) {
    const t = order[i];
    pos2.set(pos.subarray(t * 12, t * 12 + 12), i * 12);
    nrm2.set(nrm.subarray(t * 12, t * 12 + 12), i * 12);
    uv2.set(uv.subarray(t * 6, t * 6 + 6), i * 6);
  }
  const nodesOut = new Float32Array(nodeN * 8);
  const nodesU = new Uint32Array(nodesOut.buffer);
  for (let n = 0; n < nodeN; n++) {
    nodesOut[n * 8] = nodeMin[n * 3]; nodesOut[n * 8 + 1] = nodeMin[n * 3 + 1]; nodesOut[n * 8 + 2] = nodeMin[n * 3 + 2];
    nodesU[n * 8 + 3] = nodeCount[n] ? nodeFirst[n] : nodeLeft[n];
    nodesOut[n * 8 + 4] = nodeMax[n * 3]; nodesOut[n * 8 + 5] = nodeMax[n * 3 + 1]; nodesOut[n * 8 + 6] = nodeMax[n * 3 + 2];
    nodesU[n * 8 + 7] = nodeCount[n];
  }
  return { pos: pos2, nrm: nrm2, uv: uv2, triCount, nodes: nodesOut, nodeCount: nodeN, maxDepth };
}
