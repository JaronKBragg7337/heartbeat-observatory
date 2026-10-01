// ============================================================================
// dig-checks.mjs — digging, dumping and the ground that results, measured against the field.
//
// Everything here asks the FIELD (or the stored lattice, which is the field) a question and
// compares it with what the player is shown or can do. Nothing is judged from a screenshot.
// Section numbers 7b-7f of the validator.
// ============================================================================

export async function runDigChecks({ ROOT, check, section, THREE, mars, FIELD, GEO, Walker }) {
  const url = (p) => `file://${ROOT}/${p}`;
  const { EditStore, CELL_M, BRICK_N, BRICK_M, SLOPE_MAX_DEG, REPOSE_DEG } = await import(url('src/world/edits.js'));
  const { meshBrick, CoverGrid, COVER_SHRINK_M } = await import(url('src/world/excavation.js'));
  const { LocalPatch, DISTANT_TIERS, TERRAIN_FOG_DENSITY } = await import(url('src/world/planetMesh.js'));
  const { Digger, makeTools } = await import(url('src/player/digging.js'));

  // ---- the place: natural ground at the spawn coordinate, no earthworks ------------------
  const LAT = -14.0, LON = -59.2;
  const P0 = GEO.geodeticToCartesian(mars, LAT, LON, 0);
  const frame0 = GEO.localFrame(LAT, LON);
  const unit = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const len = (a) => Math.hypot(a.x, a.y, a.z);
  const up0 = unit(P0);
  const surfacePoint = (e, n) => {
    const q = add(add(P0, frame0.east, e), frame0.north, n);
    const l = len(q), u = { x: q.x / l, y: q.y / l, z: q.z / l };
    const R = FIELD.surfaceRadiusAlong(mars, u.x, u.y, u.z, { minStep: 0.05, startRadius: l + 3, range: 20 });
    return { x: u.x * R, y: u.y * R, z: u.z * R };
  };
  const fieldSurfaceHeight = (p, from = 3, range = 14) => {          // radius of the first solid below p+up*from
    const l = len(p), u = { x: p.x / l, y: p.y / l, z: p.z / l };
    return FIELD.surfaceRadiusAlong(mars, u.x, u.y, u.z, { minStep: 0.05, startRadius: l + from, range });
  };
  const fresh = () => { const s = new EditStore(mars); FIELD.attachEdits(s); return s; };
  const colourOf = (wx, wy, wz, nx, ny, nz, o) => { const m = FIELD.materialAt(mars, wx, wy, wz); o.r = (m.color >> 16 & 255) / 255; o.g = (m.color >> 8 & 255) / 255; o.b = (m.color & 255) / 255; };
  const tools = makeTools(mars);

  section('7a. Assisted carry and one-pour emptying');
  check('Mars hauling cart carries at least a tonne; bucket hopper at least 48 tonnes',
    tools[0].capacityKg >= 1000 && tools[1].capacityKg >= 1000 && tools[2].capacityKg >= 48000);
  {
    const store = fresh(), w = new Walker(mars);
    const S = surfacePoint(0, 0), u = unit(S);
    Object.assign(w.worldPos, add(add(S, frame0.north, -4), u, 1));
    const dg = new Digger(mars, store, w); dg.setTool(2);
    const hits = [];
    for (let n = 0; n < 3; n++) for (let e = -2; e <= 2; e++) hits.push(surfacePoint(e, n));
    for (const p of hits) {
      dg.digTarget = () => ({ point: p, dir: { x: -u.x, y: -u.y, z: -u.z }, normal: u });
      dg.dig();
    }
    const M = dg.carriedMass(), V = dg.carriedVolume();
    check('bucket can make fifteen connected bites and a real hole before emptying', dg.carried.length === 15 && M > 12000 && V > 8,
      `${dg.carried.length} bites, ${M.toFixed(0)} kg, ${V.toFixed(2)} m3`);
    const before = store.fieldDeltaM3(), version = store.version;
    const p = surfacePoint(5, 0);
    const blocked = store.carve({ x: p.x, y: p.y, z: p.z, r: 0.7, maxMassKg: 1 });
    check('over-capacity bite refuses before changing the lattice or inventory', !blocked && store.version === version && store.fieldDeltaM3() === before && dg.carriedMass() === M);
    const deposit = store.deposit.bind(store);
    store.deposit = () => null;
    const refused = dg.dumpAll();
    check('failed Drop all retains every carried lot and its exact mass', !refused.ok && dg.carried.length === 15 && dg.carriedMass() === M);
    let pours = 0;
    store.deposit = (...args) => { pours++; return deposit(...args); };
    const t = performance.now(), out = dg.dumpAll();
    const books = store.ledger(dg.carried);
    console.log(`  Drop all: ${M.toFixed(0)} kg, ${V.toFixed(3)} m3, ${(performance.now() - t).toFixed(1)} ms, heap r=${out.pile?.radiusM.toFixed(2)} m`);
    check('Drop all performs one cone pour, makes one heap and empties all fifteen lots', out.ok && pours === 1 && store.piles.length === 1 && dg.carried.length === 0);
    check('Drop all conserves kilograms and cubic metres exactly: ledger = 0', books.unaccountedKg === 0 && books.unaccountedM3 === 0,
      JSON.stringify(books));
    check('Drop all adds the actual carried volume to the lattice, with no fake accounting', Math.abs(store.fieldDeltaM3()) < 1e-8,
      `${store.fieldDeltaM3()} m3`);
    check('the entire heap is beside the hole, and still a low cone', out.ok && out.pile.apexM - out.pile.centreGroundM < out.pile.radiusM * 0.8 &&
      (() => { const site = store.siteNear(w.worldPos.x, w.worldPos.y, w.worldPos.z, 9), d = sub(out.pile, site), along = dot(d, u);
        return Math.sqrt(dot(d, d) - along * along) - out.pile.radiusM > site.radiusM; })());
    // The original single-load command must still empty only the newest lot.
    const p2 = surfacePoint(-5, 0), p3 = surfacePoint(-5, 1);
    for (const p of [p2, p3]) { const l = store.dig(p.x - u.x * 0.2, p.y - u.y * 0.2, p.z - u.z * 0.2, 0.17); dg.carried.push(l); }
    const first = dg.carried[0], one = dg.dump();
    check('single drop still removes exactly one load', one.ok && dg.carried.length === 1 && dg.carried[0] === first);
    const empty = dg.dumpAll();
    check('single drop then Drop all leaves both ledgers exactly zero', empty.ok && store.ledger(dg.carried).unaccountedKg === 0 && store.ledger(dg.carried).unaccountedM3 === 0 && Math.abs(store.fieldDeltaM3()) < 1e-8);
    FIELD.attachEdits(null);
  }

  section('7a2. Distant Mars: sampled relief, curvature and a phone triangle budget');
  {
    const S = surfacePoint(0, 0), f = frame0, l = len(S);
    const low = DISTANT_TIERS.low.map(o => { const p = new LocalPatch(mars, o); p.rebuild(S.x, S.y, S.z); return p; });
    for (let i = low.length - 2; i >= 0; i--) low[i].blendEdgeTo(low[i + 1]);
    let seamError = 0;
    for (let i = 0; i < low.length - 1; i++) {
      const p = low[i], pos = p.geo.attributes.position.array;
      for (const v of p._edge) {
        const k = v * 3, q = { x: pos[k] + p.worldPos.x, y: pos[k + 1] + p.worldPos.y, z: pos[k + 2] + p.worldPos.z }, u = unit(q);
        seamError = Math.max(seamError, Math.abs(len(q) - low[i + 1].surfaceRadiusExact(u.x, u.y, u.z)));
      }
    }
    check('far tier edges meet the actual coarser triangles within 2 cm (no sky seams or cliff skirts)', seamError < 0.02, `${seamError} m`);
    for (const [i, radius] of [2000, 20000, 100000].entries()) {
      const p = low[i], heights = [];
      let missing = 0;
      for (let k = 0; k < 96; k++) {
        const a = k / 96 * Math.PI * 2, q = add(add(S, f.east, Math.cos(a) * radius), f.north, Math.sin(a) * radius), d = unit(q);
        const r = p.surfaceRadiusAt(d.x, d.y, d.z);
        if (r === null) { missing++; continue; }
        heights.push(GEO.cartesianToGeodetic(mars, d.x * r, d.y * r, d.z * r).alt);
      }
      const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
      const sd = Math.sqrt(heights.reduce((s, h) => s + (h - mean) ** 2, 0) / heights.length);
      console.log(`  far ring ${radius} m: height SD ${sd.toFixed(1)} m; build ${p.lastBuildMs.toFixed(1)} ms`);
      check(`drawn far ring at ${radius / 1000} km carries relief (height SD > 25 m), with no missing samples`, missing === 0 && sd > 25);
      const pos = p.geo.attributes.position, normals = p.geo.attributes.normal;
      let bad = 0;
      for (let v = 0; v < p.res * p.res; v++) {
        const x = pos.getX(v) + p.worldPos.x, y = pos.getY(v) + p.worldPos.y, z = pos.getZ(v) + p.worldPos.z;
        if (x * normals.getX(v) + y * normals.getY(v) + z * normals.getZ(v) <= 0) bad++;
      }
      check(`far tier ${i} normals light the outward surface, with continuous edge skirts`, bad === 0 && p._edge.length === 4 * (p.res - 1));
    }
    const tris = low.reduce((s, p) => s + p.geo.index.count / 3, 0);
    const above = add(S, unit(S), 10000);
    check('climbing 10 km above the same ground does not trigger distant terrain rebuilds',
      low.every(p => !p.needsRebuild(above.x, above.y, above.z)));
    check('three phone far tiers add fewer than 25000 triangles', tris < 25000, `${tris} triangles`);
    check('fog preserves over 90% of contrast at 20 km and over 35% at the 1000 m horizon (~82 km)',
      Math.exp(-((20000 * TERRAIN_FOG_DENSITY) ** 2)) > 0.9 && Math.exp(-((82000 * TERRAIN_FOG_DENSITY) ** 2)) > 0.35);
    for (const p of low) { p.geo.dispose(); p.mesh.material.dispose(); }
  }

  // =========================================================================================
  section('7b. Digging: the ground is a solid object and matter is conserved');
  // =========================================================================================
  {
    const store = fresh();
    const S = surfacePoint(0, 0);
    const R = len(S);
    const centre = { x: S.x - up0.x * 0.1, y: S.y - up0.y * 0.1, z: S.z - up0.z * 0.1 };

    check('the ground is solid just under the surface before digging', FIELD.isSolid(mars, centre.x, centre.y, centre.z));
    check('before any dig the field is exactly the geology (no edit store cost, no bricks)', store.isEmpty && store.bricks.size === 0);

    const lot = store.dig(centre.x, centre.y, centre.z, tools[1].radius);
    check('a scoop yields a real lot with mass and volume',
      !!lot && lot.massKg > 0 && lot.solidVolumeM3 > 0, lot ? `${lot.massKg.toFixed(2)} kg, ${(lot.solidVolumeM3 * 1000).toFixed(1)} L` : 'no lot');
    check('a shovel load is a believable size (10-25 L, 15-60 kg)',
      lot.solidVolumeM3 > 0.010 && lot.solidVolumeM3 < 0.025 && lot.massKg > 15 && lot.massKg < 60,
      `${lot.massKg.toFixed(1)} kg / ${(lot.solidVolumeM3 * 1000).toFixed(1)} L`);
    const spade = fresh().dig(centre.x, centre.y, centre.z, tools[0].radius);
    check('a hand spade lifts a few litres (1.5-5 L)', spade.solidVolumeM3 > 0.0015 && spade.solidVolumeM3 < 0.005, `${(spade.solidVolumeM3 * 1000).toFixed(2)} L`);
    FIELD.attachEdits(store);

    const matById = (id) => Object.values(FIELD.MATERIALS).find((m) => m.id === id);
    const partMass = lot.parts.reduce((a, p) => a + p.massKg, 0);
    check('mass is the sum of what each material in the lot weighs (real densities)',
      Math.abs(partMass - lot.massKg) < 1e-9 && lot.massKg / lot.solidVolumeM3 > 1400 && lot.massKg / lot.solidVolumeM3 < 3000,
      `${(lot.massKg / lot.solidVolumeM3).toFixed(0)} kg/m3`);
    check('the dug spot becomes a hole in the ground', !FIELD.isSolid(mars, centre.x, centre.y, centre.z));
    check('the hole lowers the surface every consumer sees (one truth, not a decal)',
      fieldSurfaceHeight(S) < R - 0.03, `surface ${(R - fieldSurfaceHeight(S)).toFixed(3)} m lower`);

    // The bite is a real sphere's worth, within what a 0.1 m lattice can say: dig a buried sphere.
    const deepStore = fresh();
    const deep = deepStore.dig(S.x - up0.x * 1.5, S.y - up0.y * 1.5, S.z - up0.z * 1.5, 0.5);
    const sphere = 4 / 3 * Math.PI * 0.5 ** 3;
    check('a buried sphere of radius 0.5 m comes out at its true volume to within 3%',
      Math.abs(deep.solidVolumeM3 - sphere) / sphere < 0.03, `${deep.solidVolumeM3.toFixed(4)} vs ${sphere.toFixed(4)} m3`);
    FIELD.attachEdits(store);

    // Nothing else moved.
    let disturbed = 0;
    for (const [e, n] of [[5, 0], [-5, 0], [0, 5], [0, -5], [8, 8]]) {
      const p = surfacePoint(e, n);
      const l = len(p);
      const withEdits = FIELD.surfaceRadiusFast(mars, p.x / l, p.y / l, p.z / l, 3, null);
      const geology = FIELD.surfaceRadiusFast(mars, p.x / l, p.y / l, p.z / l, 3, { ignoreEdits: true });
      disturbed += Math.abs(withEdits - geology) > 0.01 ? 1 : 0;
    }
    check('digging does not disturb the ground a few metres away', disturbed === 0 && store.bricks.size <= 8, `${disturbed} spots changed, ${store.bricks.size} bricks`);

    const led1 = store.ledger([lot]);
    check('material in hand is accounted for while carried (litres and kilograms)',
      Math.abs(led1.unaccountedM3) < 1e-12 && Math.abs(led1.unaccountedKg) < 1e-9, `${led1.unaccountedM3} m3, ${led1.unaccountedKg} kg`);
    check('the lattice, re-added from scratch, lost exactly the volume the lot carries',
      Math.abs(store.fieldDeltaM3() + lot.solidVolumeM3) < 1e-8, `${store.fieldDeltaM3()} vs ${-lot.solidVolumeM3}`);

    const drop = surfacePoint(3, 0);
    const dep = store.deposit(lot, drop.x, drop.y, drop.z);
    const led2 = store.ledger([]);
    check('material dumped is accounted for and nothing vanished',
      !!dep && Math.abs(led2.unaccountedM3) < 1e-12 && Math.abs(led2.unaccountedKg) < 1e-9, `${led2.unaccountedM3} m3, ${led2.unaccountedKg} kg`);
    check('the lattice agrees with the books after the drop: net change is zero to 1e-8 m3',
      Math.abs(store.fieldDeltaM3()) < 1e-8, `${store.fieldDeltaM3()}`);
    check('dumping puts solid material back into the world, above where the ground was',
      fieldSurfaceHeight(drop, 4) > len(drop) + 0.05, `heap ${(fieldSurfaceHeight(drop, 4) - len(drop)).toFixed(3)} m high`);

    const deepP = { x: S.x - up0.x * (mars.terrain.crustThickness + 20000), y: S.y - up0.y * (mars.terrain.crustThickness + 20000), z: S.z - up0.z * (mars.terrain.crustThickness + 20000) };
    const before = store.bricks.size;
    check('the mantle boundary cannot be dug, and refusing leaves no trace',
      store.dig(deepP.x, deepP.y, deepP.z, 0.5) === null && store.bricks.size === before && /mantle/i.test(store.lastRefusal), store.lastRefusal);
    check('empty air cannot be dug and leaves no trace',
      store.dig(S.x + up0.x * 5, S.y + up0.y * 5, S.z + up0.z * 5, 0.3) === null && store.bricks.size === before);

    // Determinism: a coordinate is an address, and a dig at it is a repeatable event.
    const s1 = new EditStore(mars), s2 = new EditStore(mars);
    FIELD.attachEdits(s1); const l1 = s1.dig(centre.x, centre.y, centre.z, 0.3);
    FIELD.attachEdits(s2); const l2 = s2.dig(centre.x, centre.y, centre.z, 0.3);
    let same = l1.solidVolumeM3 === l2.solidVolumeM3 && l1.massKg === l2.massKg && s1.bricks.size === s2.bricks.size;
    for (const [k, b] of s1.bricks) { const o = s2.bricks.get(k); if (!o) { same = false; break; } for (let i = 0; i < b.phi.length; i++) if (b.phi[i] !== o.phi[i]) { same = false; break; } }
    check('the same dig at the same place gives the same lot and the same lattice, bit for bit', same);
    FIELD.attachEdits(null);
  }

  // =========================================================================================
  section('7c. The dug ground is DRAWN exactly: from above, from inside, and across seams');
  // =========================================================================================
  {
    const store = fresh();
    // A hole that straddles a brick face on purpose, so the seam is on trial: snap the dig's x to a face.
    let S = surfacePoint(0.2, 0.0);
    const faceX = Math.round(S.x / BRICK_M) * BRICK_M;
    const probe = { x: faceX, y: S.y, z: S.z };
    const pl = len(probe), pu = { x: probe.x / pl, y: probe.y / pl, z: probe.z / pl };
    const pr = FIELD.surfaceRadiusAlong(mars, pu.x, pu.y, pu.z, { minStep: 0.05, startRadius: pl + 12, range: 40 });
    S = { x: pu.x * pr, y: pu.y * pr, z: pu.z * pr };
    const up = unit(S);
    store.dig(S.x - up.x * 0.25, S.y - up.y * 0.25, S.z - up.z * 0.25, 0.5);
    store.dig(S.x - up.x * 0.85, S.y - up.y * 0.85, S.z - up.z * 0.85, 0.5);
    store.dig(S.x + frame0.east.x * 0.7 - up.x * 0.3, S.y + frame0.east.y * 0.7 - up.y * 0.3, S.z + frame0.east.z * 0.7 - up.z * 0.3, 0.4);
    const touchedList = [...store.touched.values()];
    const multiBrick = touchedList.length;
    check('the test hole spans more than one brick (the seam is on trial)', multiBrick >= 2, `${multiBrick} bricks`);

    const meshes = [], t0 = performance.now();
    for (const t of touchedList) { const m = meshBrick(store, t.bx, t.by, t.bz, colourOf, { keepWorld: true }); if (m) meshes.push(m); }
    const msPerBrick = (performance.now() - t0) / Math.max(1, touchedList.length);
    const O = (m) => m.origin;

    // --- (1) face orientation: out of the rock, measured against the field itself -----------
    let outward = 0, inverted = 0, ambiguous = 0, faces = 0, tris = 0;
    const eps = CELL_M * 0.4;
    for (const m of meshes) {
      const pos = m.positions, ind = m.indices, o = O(m);
      for (let t = 0; t < ind.length; t += 3) {
        const a = ind[t] * 3, b = ind[t + 1] * 3, c = ind[t + 2] * 3;
        const ax = pos[a] + o.x, ay = pos[a + 1] + o.y, az = pos[a + 2] + o.z;
        const bx = pos[b] + o.x, by = pos[b + 1] + o.y, bz = pos[b + 2] + o.z;
        const cx = pos[c] + o.x, cy = pos[c + 1] + o.y, cz = pos[c + 2] + o.z;
        let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const L = Math.hypot(nx, ny, nz);
        tris++;
        if (L < 1e-12) { ambiguous++; continue; }
        nx /= L; ny /= L; nz /= L;
        const mx = (ax + bx + cx) / 3, my = (ay + by + cy) / 3, mz = (az + bz + cz) / 3;
        const out = FIELD.density(mars, mx + nx * eps, my + ny * eps, mz + nz * eps);
        const inn = FIELD.density(mars, mx - nx * eps, my - ny * eps, mz - nz * eps);
        if (out > 0 && inn < 0) outward++; else if (out < 0 && inn > 0) inverted++; else ambiguous++;
      }
    }
    // The tolerance is for the PROBE (it misreads where the surface pinches to less than a probe's
    // width), not for the winding: the bug this guards had 518 of 518 faces inverted.
    check('every face of the dug ground points out of the rock, not into it',
      inverted <= tris * 0.005 && outward > tris * 0.93, `outward ${outward}, inverted ${inverted}, ambiguous ${ambiguous} of ${tris}`);

    // --- (2) the mesh IS the field's surface ---------------------------------------------------
    let offSurface = 0, nVert = 0, worstOff = 0;
    for (const m of meshes) for (let v = 0; v < m.worldPositions.length; v += 3) {
      const d = FIELD.density(mars, m.worldPositions[v], m.worldPositions[v + 1], m.worldPositions[v + 2]);
      nVert++; worstOff = Math.max(worstOff, Math.abs(d));
      if (Math.abs(d) > 0.02) offSurface++;
    }
    check('every vertex lies on the field\'s zero surface (to 2 cm): the picture is the truth',
      offSurface <= nVert * 0.01, `${offSurface}/${nVert} off by >2 cm, worst ${worstOff.toFixed(3)} m`);

    // --- (3) seams: bricks are watertight with each other ----------------------------------
    const key = (x, y, z) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
    const vid = new Map(); let vcount = 0;
    const edgeCount = new Map();
    const faceOf = (x, y, z) => ({ x: Math.abs(x / BRICK_M - Math.round(x / BRICK_M)) < 1e-6, y: Math.abs(y / BRICK_M - Math.round(y / BRICK_M)) < 1e-6, z: Math.abs(z / BRICK_M - Math.round(z / BRICK_M)) < 1e-6 });
    const verts = [];
    for (const m of meshes) {
      const map = [];
      for (let v = 0; v < m.worldPositions.length; v += 3) {
        const k = key(m.worldPositions[v], m.worldPositions[v + 1], m.worldPositions[v + 2]);
        let id = vid.get(k); if (id === undefined) { id = vcount++; vid.set(k, id); verts.push([m.worldPositions[v], m.worldPositions[v + 1], m.worldPositions[v + 2]]); }
        map.push(id);
      }
      for (let t = 0; t < m.indices.length; t += 3) {
        const ids = [map[m.indices[t]], map[m.indices[t + 1]], map[m.indices[t + 2]]];
        for (let e = 0; e < 3; e++) {
          const a = ids[e], b = ids[(e + 1) % 3];
          const k = a < b ? `${a}-${b}` : `${b}-${a}`;
          edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
        }
      }
    }
    // The meshed set's outer boundary: edges that sit on a face of the touched cluster, or beyond its
    // lattice. Everything else is interior and must be shared by exactly two triangles.
    const inCluster = (x, y, z) => store.touched.has(store.keyOf(Math.floor(x / BRICK_M), Math.floor(y / BRICK_M), Math.floor(z / BRICK_M)));
    let open = 0, nonManifold = 0, interior = 0, seamBad = 0;
    for (const [k, c] of edgeCount) {
      const [a, b] = k.split('-').map(Number);
      const mid = [(verts[a][0] + verts[b][0]) / 2, (verts[a][1] + verts[b][1]) / 2, (verts[a][2] + verts[b][2]) / 2];
      // an edge is interior when a point just off it, in every direction, is still in a meshed brick
      let inside = true;
      for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]])
        if (!inCluster(mid[0] + d[0] * 0.25, mid[1] + d[1] * 0.25, mid[2] + d[2] * 0.25)) { inside = false; break; }
      if (!inside) continue;
      interior++;
      if (c === 1) open++;
      else if (c > 2) {
        nonManifold++;
        // where two sheets of surface pinch inside one cell the cell has only one vertex: that is the
        // algorithm, and it is not a seam. On a brick face it WOULD be a seam fault.
        const onFace = [0, 1, 2].some((ax) => { const q = mid[ax] / BRICK_M; return Math.abs(q - Math.round(q)) < 0.05; });
        if (onFace) seamBad++;
      }
    }
    check('no crack between bricks: every interior edge of the dug surface is shared by two triangles (open edges 0; pinch points under 0.1%)',
      open === 0 && nonManifold <= interior * 0.001 && interior > 200, `${open} open edges, ${nonManifold} pinched (${seamBad} on a brick face), of ${interior} interior`);

    // --- (4) shading agrees across the seam ------------------------------------------------
    const nrmAt = new Map(); let seamMismatch = 0, seamPairs = 0;
    for (const m of meshes) for (let v = 0; v < m.worldPositions.length; v += 3) {
      const k = key(m.worldPositions[v], m.worldPositions[v + 1], m.worldPositions[v + 2]);
      const n = [m.normals[v], m.normals[v + 1], m.normals[v + 2]];
      const have = nrmAt.get(k);
      if (!have) nrmAt.set(k, n);
      else { seamPairs++; if (n[0] * have[0] + n[1] * have[1] + n[2] * have[2] < 0.9999) seamMismatch++; }
    }
    check('normals agree where two bricks share a vertex (no visible seam in the shading)',
      seamPairs > 20 && seamMismatch === 0, `${seamMismatch} of ${seamPairs} shared vertices disagree`);

    // --- (5) the hole renders what the field says, from above and from inside ------------------
    const tri = [];
    for (const m of meshes) {
      const pos = m.positions, ind = m.indices, o = m.origin;
      for (let t = 0; t < ind.length; t += 3) {
        const a = ind[t] * 3, b = ind[t + 1] * 3, c = ind[t + 2] * 3;
        tri.push([pos[a] + o.x, pos[a + 1] + o.y, pos[a + 2] + o.z, pos[b] + o.x, pos[b + 1] + o.y, pos[b + 2] + o.z, pos[c] + o.x, pos[c + 1] + o.y, pos[c + 2] + o.z]);
      }
    }
    const rayTri = (o, d, T) => {
      const e1 = [T[3] - T[0], T[4] - T[1], T[5] - T[2]], e2 = [T[6] - T[0], T[7] - T[1], T[8] - T[2]];
      const p = [d.y * e2[2] - d.z * e2[1], d.z * e2[0] - d.x * e2[2], d.x * e2[1] - d.y * e2[0]];
      const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
      if (Math.abs(det) < 1e-12) return Infinity;
      const inv = 1 / det, tv = [o.x - T[0], o.y - T[1], o.z - T[2]];
      const u = (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) * inv; if (u < 0 || u > 1) return Infinity;
      const q = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
      const v = (d.x * q[0] + d.y * q[1] + d.z * q[2]) * inv; if (v < 0 || u + v > 1) return Infinity;
      const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
      return t > 1e-6 ? t : Infinity;
    };
    const fieldHit = (o, d, maxT) => { const h = FIELD.raycast(mars, o.x, o.y, o.z, d.x, d.y, d.z, maxT, { firstOnly: true, minStep: 0.03 }).find((q) => q.kind === 'enter'); return h ? h.t : null; };
    const meshHit = (o, d) => { let best = Infinity; for (const T of tri) { const t = rayTri(o, d, T); if (t < best) best = t; } return best; };
    const holeFloor = { x: S.x - up.x * 1.2, y: S.y - up.y * 1.2, z: S.z - up.z * 1.2 };
    const eyesAbove = [], eyesInside = [];
    for (let k = 0; k < 14; k++) {
      const a = k / 14 * Math.PI * 2;
      const side = add(add(S, frame0.east, Math.cos(a) * 2.2), frame0.north, Math.sin(a) * 2.2);
      eyesAbove.push(add(side, up, 1.7));
    }
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; eyesInside.push(add(add(add(S, up, -0.9), frame0.east, Math.cos(a) * 0.2), frame0.north, Math.sin(a) * 0.2)); }
    let rays = 0, mismatch = 0, worstRay = 0, missed = 0;
    const aims = [];
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; aims.push(add(add(add(S, up, -0.5), frame0.east, Math.cos(a) * 0.55), frame0.north, Math.sin(a) * 0.55)); }
    aims.push(holeFloor, add(S, up, -0.3));
    for (const eye of eyesAbove) for (const aim of aims) {
      const dv = unit(sub(aim, eye)); rays++;
      const f = fieldHit(eye, dv, 7);
      if (f === null) continue;
      const hitP = add(eye, dv, f);
      if (!inCluster(hitP.x, hitP.y, hitP.z)) continue;
      const m = meshHit(eye, dv);
      if (!(m < Infinity)) { missed++; continue; }
      worstRay = Math.max(worstRay, Math.abs(m - f));
      if (Math.abs(m - f) > 0.08) mismatch++;
    }
    for (const eye of eyesInside) for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2, el = (k % 3) * 0.7 - 0.3;
      const dv = unit({ x: frame0.east.x * Math.cos(a) * Math.cos(el) + frame0.north.x * Math.sin(a) * Math.cos(el) + up.x * Math.sin(el),
        y: frame0.east.y * Math.cos(a) * Math.cos(el) + frame0.north.y * Math.sin(a) * Math.cos(el) + up.y * Math.sin(el),
        z: frame0.east.z * Math.cos(a) * Math.cos(el) + frame0.north.z * Math.sin(a) * Math.cos(el) + up.z * Math.sin(el) });
      rays++;
      const f = fieldHit(eye, dv, 4);
      if (f === null) continue;
      const hitP = add(eye, dv, f);
      if (!inCluster(hitP.x, hitP.y, hitP.z)) continue;
      const m = meshHit(eye, dv);
      if (!(m < Infinity)) { missed++; continue; }
      worstRay = Math.max(worstRay, Math.abs(m - f));
      if (Math.abs(m - f) > 0.08) mismatch++;
    }
    check('looking at the hole from above and from standing inside it, the drawn surface is where the field says (8 cm)',
      mismatch === 0 && missed === 0 && rays > 250, `${rays} rays, ${mismatch} off by >6 cm, ${missed} saw nothing, worst ${worstRay.toFixed(3)} m`);

    // --- (6) the wall shows the strata the field says it cut through -----------------------------
    const mats = new Set();
    for (const m of meshes) for (let v = 0; v < m.worldPositions.length; v += 3) mats.add(FIELD.materialAt(mars, m.worldPositions[v], m.worldPositions[v + 1], m.worldPositions[v + 2]).id);
    check('a hole through the regolith shows its layers on the wall (at least two materials exposed)', mats.size >= 2, [...mats].join(', '));

    // --- (7) cost -------------------------------------------------------------------------------
    check('a brick meshes in a few milliseconds and the whole hole stays under 40k triangles',
      msPerBrick < 80 && tris < 40000, `${msPerBrick.toFixed(1)} ms per brick (Node), ${tris} triangles`);
    check('the lattice cell resolves a shovel bite to at least 3 cells across', CELL_M * 3 <= tools[1].radius * 2 + 1e-9, `${(tools[1].radius * 2 / CELL_M).toFixed(1)} cells`);

    // --- (8) the heightfield tiers stand aside exactly where bricks are drawn ----------------------
    const grid = new CoverGrid();
    const built = new Map(); for (const t of touchedList) built.set(`${t.bx},${t.by},${t.bz}`, t);
    const focus = { bx: touchedList[0].bx, by: touchedList[0].by, bz: touchedList[0].bz };
    grid.rebuild(focus, built);
    const modified = [];
    for (const b of store.bricks.values()) {
      if (!b.edited) continue;
      for (let k = 0; k < BRICK_N; k++) for (let j = 0; j < BRICK_N; j++) for (let i = 0; i < BRICK_N; i++) {
        const gi = b.bx * BRICK_N + i, gj = b.by * BRICK_N + j, gk = b.bz * BRICK_N + k;
        if (Math.abs(b.phi[(k * BRICK_N + j) * BRICK_N + i] - store.baseLattice(gi, gj, gk)) > 1e-4 && Math.abs(b.phi[(k * BRICK_N + j) * BRICK_N + i]) < 1.0)
          modified.push([gi * CELL_M, gj * CELL_M, gk * CELL_M]);
      }
    }
    let uncovered = 0;
    for (const p of modified) if (!grid.covers(p[0], p[1], p[2])) uncovered++;
    check('every lattice point near the surface that digging changed is under a brick the heightfields discard beneath',
      modified.length > 100 && uncovered === 0, `${uncovered} of ${modified.length} changed points are not covered`);
    // And the heightfield is NOT discarded where nothing was touched (that would be a hole in the world).
    let wrongly = 0, tested = 0;
    for (let n = 0; n < 600; n++) {
      const e = -40 + (n % 30) * 2.7, no = -40 + Math.floor(n / 30) * 4;
      const p = surfacePoint(e, no);
      if (inCluster(p.x, p.y, p.z)) continue;
      tested++;
      if (grid.covers(p.x, p.y, p.z)) wrongly++;
    }
    check('ground nobody touched is never discarded: no hole can open where there is no brick to draw it',
      tested > 400 && wrongly === 0, `${wrongly}/${tested}`);
    // The overlap band: at a face that borders untouched ground the discard stops short of the face.
    const edgeBrick = touchedList.find((t) => !store.touched.has(store.keyOf(t.bx + 1, t.by, t.bz)));
    const ex = (edgeBrick.bx + 1) * BRICK_M, ey = (edgeBrick.by + 0.5) * BRICK_M, ez = (edgeBrick.bz + 0.5) * BRICK_M;
    check('the discard keeps a hand-width overlap with the heightfield at an open face (no crack to the sky)',
      grid.covers(ex - COVER_SHRINK_M * 0.5, ey, ez) === false && grid.covers(ex - COVER_SHRINK_M * 2, ey, ez) === true);
    FIELD.attachEdits(null);
  }

  // =========================================================================================
  section('7d. Spoil: heaps stand at the angle of repose, grow outward, and never spike');
  // =========================================================================================
  {
    const store = fresh();
    const drop = surfacePoint(0, 6);
    const dropUp = unit(drop);
    // A heap's free surface, sampled column by column from the field.
    const heapProfile = (centre, radius, step = 0.1) => {
      const cu = unit(centre);
      const east = frame0.east, north = frame0.north;
      const base = len(centre);
      const grid = new Map(); let top = -Infinity;
      const n = Math.ceil(radius / step);
      for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
        const q = add(add(centre, east, i * step), north, j * step);
        const h = fieldSurfaceHeight(add(q, cu, 0.5), 6, 18);
        grid.set(`${i},${j}`, h); if (h > top) top = h;
      }
      return { grid, n, step, top, base };
    };
    const maxSlopeDeg = (prof, ground0) => {
      let worst = 0;
      for (let j = -prof.n + 1; j < prof.n; j++) for (let i = -prof.n + 1; i < prof.n; i++) {
        const h = prof.grid.get(`${i},${j}`);
        if (h - ground0 < 0.12) continue;                                    // not heap: ground
        const gx = (prof.grid.get(`${i + 1},${j}`) - prof.grid.get(`${i - 1},${j}`)) / (2 * prof.step);
        const gy = (prof.grid.get(`${i},${j + 1}`) - prof.grid.get(`${i},${j - 1}`)) / (2 * prof.step);
        worst = Math.max(worst, Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI);
      }
      return worst;
    };
    const ground0 = len(drop);
    // Make loads to pour: bites from elsewhere.
    const digSpot = surfacePoint(-8, -8), du = unit(digSpot);
    let bitesTaken = 0;
    const loadOf = (r) => {
      const k = bitesTaken++;
      const q = surfacePoint(-8 + 1.3 * k, -8);
      const qu = unit(q);
      return store.dig(q.x - qu.x * (r * 0.5 + 0.05), q.y - qu.y * (r * 0.5 + 0.05), q.z - qu.z * (r * 0.5 + 0.05), r);
    };
    const loadSmall = loadOf(0.17);
    const dep1 = store.deposit(loadSmall, drop.x, drop.y, drop.z, { up: dropUp });
    const heap1 = dep1.pile;
    check('a shovelful poured on the ground makes a low heap, not a spike (height under 0.8 of its radius)',
      (dep1.apexHeightM / Math.max(heap1.radiusM, 1e-3)) < 0.8, `apex ${dep1.apexHeightM.toFixed(2)} m on radius ${heap1.radiusM.toFixed(2)} m`);

    // Pour a stream of bucket loads onto the same spot, as a player would.
    let growth = [heap1.radiusM], heights = [dep1.apexHeightM], onePile = true, lastPile = heap1;
    for (let n = 0; n < 7; n++) {
      const lot = loadOf(0.5);
      const near = store.pileNear(drop.x, drop.y, drop.z, 0.6);
      const res = store.deposit(lot, near ? near.x : drop.x, near ? near.y : drop.y, near ? near.z : drop.z, { up: dropUp, pile: near });
      growth.push(res.pile.radiusM); heights.push(res.apexHeightM); lastPile = res.pile;
      if (store.piles.length !== 1) onePile = false;
    }
    check('repeated loads build ONE heap that spreads outward (radius grows with every load)',
      onePile && growth.every((r, i) => i === 0 || r > growth[i - 1] + 0.02), growth.map((r) => r.toFixed(2)).join(' -> '));
    const prof = heapProfile(drop, lastPile.radiusM + 0.8);
    const slope = maxSlopeDeg(prof, ground0);
    check(`no free side of the heap stands steeper than ${SLOPE_MAX_DEG + 3} degrees (angle of repose ${REPOSE_DEG})`,
      slope <= SLOPE_MAX_DEG + 3, `steepest ${slope.toFixed(1)} deg`);
    const heapH = prof.top - ground0;
    check('after eight loads the heap is a broad mound: height under 0.75 of radius, and over half a metre tall',
      heapH / lastPile.radiusM < 0.75 && heapH > 0.5, `${heapH.toFixed(2)} m tall on ${lastPile.radiusM.toFixed(2)} m radius`);
    // Sits on the ground: a plumb line from just under the crown to below the original ground is solid all the way.
    const apexPt = add(drop, dropUp, heapH - 0.15);
    let hollow = 0;
    for (let d = 0; d <= heapH + 0.3; d += 0.05) { const q = add(apexPt, dropUp, -d); if (FIELD.density(mars, q.x, q.y, q.z) >= 0) hollow++; }
    check('the heap stands on the ground: solid from the crown down into the earth, no air under it', hollow === 0, `${hollow} open samples`);
    const led = store.ledger([]);
    check('every load poured is a load dug: litres and kilograms balance, and the lattice re-added agrees',
      Math.abs(led.unaccountedM3) < 1e-12 && Math.abs(led.unaccountedKg) < 1e-9 && Math.abs(store.fieldDeltaM3() - (led.depositedM3 - led.removedM3)) < 1e-7,
      `${led.unaccountedM3} m3; lattice ${store.fieldDeltaM3()} vs books ${led.depositedM3 - led.removedM3}`);
    FIELD.attachEdits(null);
  }

  {
    // The shift: a person with the bucket digs down from the rim, steps into the hole when it will take him,
    // keeps digging, and clears the spoil clear of the hole each time his bed is full.
    const store = fresh();
    const w = new Walker(mars); w.placeAtGeodetic(LAT, LON + 0.012, 0.3);
    w.collisionActive = (x, y, z) => !store.isEmpty && store.affects(x, y, z, 2.5);
    for (let i = 0; i < 60; i++) w.tick(1 / 60, {});
    const dg = new Digger(mars, store, w); dg.setTool(2);
    const rim0 = { ...w.worldPos }, standUp = unit(rim0), fr = w.updateFrame();
    const aimAt = (p) => {
      const e = w.eyeWorldPos({}), d = unit(sub(p, e)), f = w.updateFrame();
      w.yaw = Math.atan2(dot(d, f.east), dot(d, f.north)); w.pitch = Math.asin(Math.max(-1, Math.min(1, dot(d, f.up))));
    };
    const axis = add(rim0, fr.north, 1.4);                         // the hole goes 1.4 m in front of where he stands
    const axisFloor = () => { const l = len(axis), u = { x: axis.x / l, y: axis.y / l, z: axis.z / l };
      return u.x * FIELD.surfaceRadiusAlong(mars, u.x, u.y, u.z, { minStep: 0.05, startRadius: l + 4, range: 40 }); };
    const depthAtAxis = () => { const l = len(axis), u = { x: axis.x / l, y: axis.y / l, z: axis.z / l };
      return l - FIELD.surfaceRadiusAlong(mars, u.x, u.y, u.z, { minStep: 0.05, startRadius: l + 4, range: 40 }); };
    const floorPoint = () => { const l = len(axis), u = { x: axis.x / l, y: axis.y / l, z: axis.z / l };
      const R = FIELD.surfaceRadiusAlong(mars, u.x, u.y, u.z, { minStep: 0.05, startRadius: l + 4, range: 40 }); return { x: u.x * R, y: u.y * R, z: u.z * R }; };
    let bites = 0, dumps = 0, inHole = false; const depths = [];
    for (let cycle = 0; cycle < 4; cycle++) {
      for (let n = 0; n < 12; n++) {
        aimAt(floorPoint());
        const r = dg.dig();
        if (!r.ok) {
          // blocked by the rim between him and the floor: bite the rim down (what a person does), unless full
          if (/full/i.test(r.msg)) break;
          aimAt(add(floorPoint(), standUp, 0.6)); if (!dg.dig().ok) break;
        }
        bites++;
        if (!inHole && depthAtAxis() > 1.4) {                      // wide and deep enough: step in
          const f = floorPoint(); const fl = len(f);
          w.worldPos = { x: f.x / fl * (fl + 0.05), y: f.y / fl * (fl + 0.05), z: f.z / fl * (fl + 0.05) }; w.velocity = { x: 0, y: 0, z: 0 };
          for (let i = 0; i < 90; i++) w.tick(1 / 60, {});
          inHole = true;
        } else if (inHole) { for (let i = 0; i < 60; i++) w.tick(1 / 60, {}); }
      }
      while (dg.carried.length) { const r = dg.dump(); if (!r.ok) break; dumps++; }
      depths.push(depthAtAxis());
    }
    const deepest = depths[depths.length - 1];
    check('emptying the bucket does not refill the hole: each cycle goes deeper than the last (until it is past 5 m)',
      depths.every((d, i) => i === 0 || d > depths[i - 1] + 0.3 || depths[i - 1] > 5), `depth after each dig/dump cycle: ${depths.map((d) => d.toFixed(2)).join(' -> ')} m`);
    check('four load-cycles get past 3 m down (dumping into the hole used to cap it near 2 m)', deepest > 3.0, `${deepest.toFixed(2)} m, ${bites} bites, ${dumps} loads`);
    // No heap landed on the hole: its floor is still open air, and so is the column above it.
    const fp = floorPoint(), fu = unit(fp);
    check('the spoil stayed clear of the hole: its floor is still open air and the shaft above it is empty',
      [0.1, 0.5, 1.0, 1.8].every((h) => FIELD.density(mars, fp.x + fu.x * h, fp.y + fu.y * h, fp.z + fu.z * h) > 0));
    const led = store.ledger(dg.carried);
    check('and matter is conserved through the whole shift', Math.abs(led.unaccountedM3) < 1e-10 && Math.abs(led.unaccountedKg) < 1e-6, `${led.unaccountedM3} m3 ${led.unaccountedKg} kg`);
    check('every heap the shift made stands low (height under 0.8 of its radius), however many loads it took',
      store.piles.length >= 1 && store.piles.every((p) => (p.apexM - p.centreGroundM) / Math.max(p.radiusM, 0.01) < 0.8),
      store.piles.map((p) => `${(p.apexM - p.centreGroundM).toFixed(2)}/${p.radiusM.toFixed(2)}`).join(' '));
    FIELD.attachEdits(null);
  }

  // =========================================================================================
  section('7e. Standing, turning, tunnelling and climbing out of dug ground');
  // =========================================================================================
  {
    const store = fresh();
    const w = new Walker(mars); w.placeAtGeodetic(LAT, LON + 0.02, 0.3);
    w.collisionActive = (x, y, z) => !store.isEmpty && store.affects(x, y, z, 2.5);
    for (let i = 0; i < 60; i++) w.tick(1 / 60, {});
    const S = { ...w.worldPos }, up = unit(S);
    const east = w.updateFrame().east, north = w.updateFrame().north;
    // A pit the way a person digs one: a column of bucket bites, then the walls widened with a ring of bites
    // at each level so the mouth is wide enough to get out of.
    const pit = { x: S.x + north.x * 1.5, y: S.y + north.y * 1.5, z: S.z + north.z * 1.5 };
    const biteAt = (e, n, depth, r) => store.dig(
      pit.x + east.x * e + north.x * n - up.x * depth, pit.y + east.y * e + north.y * n - up.y * depth, pit.z + east.z * e + north.z * n - up.z * depth, r);
    for (let layer = 0; layer < 3; layer++) biteAt(0, 0, 0.3 + layer * 0.5, 0.55);
    for (const depth of [0.3, 0.8, 1.2]) for (const [e, n] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) biteAt(e, n, depth, 0.5);
    const floorR = fieldSurfaceHeight(pit, 3, 12);
    const pu = unit(pit);
    // Put the player on the floor of the pit and let him settle.
    w.worldPos = { x: pu.x * (floorR + 0.05), y: pu.y * (floorR + 0.05), z: pu.z * (floorR + 0.05) };
    w.velocity = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 90; i++) w.tick(1 / 60, {});
    const depthNow = len(S) - len(w.worldPos);
    check('a person dropped into the pit stands on its floor, grounded, about where the field says', w.grounded && depthNow > 1.0,
      `${depthNow.toFixed(2)} m below the rim, grounded ${w.grounded}`);

    // Turn all the way round: the body (shins to crown, 0.34 m wide) is never inside rock.
    const probeBody = () => {
      const f = w.updateFrame(); let worst = Infinity;
      for (const h of [0.45, 0.9, 1.3, 1.7]) for (let a = 0; a < 12; a++) {
        const c = Math.cos(a * Math.PI / 6) * 0.3, s = Math.sin(a * Math.PI / 6) * 0.3;
        const q = { x: w.worldPos.x + f.up.x * h + f.east.x * c + f.north.x * s, y: w.worldPos.y + f.up.y * h + f.east.y * c + f.north.y * s, z: w.worldPos.z + f.up.z * h + f.east.z * c + f.north.z * s };
        worst = Math.min(worst, FIELD.density(mars, q.x, q.y, q.z));
      }
      return worst;
    };
    let inRock = 0;
    for (let a = 0; a < 24; a++) { w.yaw = a * Math.PI / 12; for (let i = 0; i < 4; i++) w.tick(1 / 60, {}); if (probeBody() < -0.03) inRock++; }
    check('you can stand in the pit and turn through a full circle without any part of you in rock', inRock === 0, `${inRock} of 24 headings`);

    // Walking is not a climb command, including while pressing into a pit wall.
    let out = false;
    w.yaw = Math.PI;                                  // facing south, toward the rim edge nearest the player's original spot
    const rimR = len(S);
    for (let t = 0; t < 360 && !out; t++) {
      w.tick(1 / 60, { moveNorth: 1 });
      if (len(w.worldPos) > rimR - 0.2) out = true;
    }
    check('walking into the wall of a 1.8 m pit does not scramble the body out automatically', !out,
      `${(len(S) - len(w.worldPos)).toFixed(2)} m below the rim after 6 s`);
    check('and nothing about it ends with the body inside rock', probeBody() > -0.05, `${probeBody().toFixed(3)}`);

    // Tunnel: stand in the pit, aim level at the wall, bite, step in, repeat.
    w.worldPos = { x: pu.x * (floorR + 0.05), y: pu.y * (floorR + 0.05), z: pu.z * (floorR + 0.05) };
    w.velocity = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 60; i++) w.tick(1 / 60, {});
    const dg = new Digger(mars, store, w); dg.setTool(2);
    const tunnelDir = { x: east.x, y: east.y, z: east.z };
    const aimAt = (p) => {
      const e = w.eyeWorldPos({}), d = unit(sub(p, e)), f = w.updateFrame();
      w.yaw = Math.atan2(dot(d, f.east), dot(d, f.north)); w.pitch = Math.asin(Math.max(-1, Math.min(1, dot(d, f.up))));
    };
    // Aimed level at the wall of the pit, a bite goes INTO the wall (sideways), not down.
    const f0 = w.updateFrame();
    aimAt(add(add(w.worldPos, tunnelDir, 1.4), f0.up, 0.9));
    const hit0 = dg.digTarget();
    const r0 = dg.dig();
    const into = r0.ok ? dot(sub(r0.centre, hit0.point), tunnelDir) : 0;
    const vert = r0.ok ? Math.abs(dot(sub(r0.centre, hit0.point), f0.up)) : 1;
    check('a bite aimed level at the wall goes into the wall, sideways: its centre lies along the look direction, not below',
      r0.ok && into > 0.1 && vert < 0.25, `${into.toFixed(2)} m in, ${vert.toFixed(2)} m vertical`);
    // A walkable tunnel is two rows of bites: dig it as the bite would (centres a bucket-radius in from the face),
    // then walk it end to end with real input.
    const start = { ...w.worldPos };
    for (let k = 0; k < 8; k++) for (const hgt of [0.6, 1.55]) {
      const c = add(add(start, tunnelDir, 1.6 + k * 0.6), f0.up, hgt);
      store.dig(c.x, c.y, c.z, tools[2].radius);
    }
    w.yaw = Math.PI / 2; w.pitch = 0;
    let longest = 0;
    for (let i = 0; i < 600; i++) { w.tick(1 / 60, { moveNorth: 1 }); longest = Math.max(longest, dot(sub(w.worldPos, start), tunnelDir)); }
    check('a tunnel cut sideways into the wall can be walked: more than 4 m in, on its floor', longest > 4.0 && w.grounded, `${longest.toFixed(2)} m, grounded ${w.grounded}`);
    check('inside the tunnel the body stays out of the rock (head, shoulders, shins)', probeBody() > -0.05, `${probeBody().toFixed(3)}`);
    // Dig up: look at the roof, take a bite, the ceiling goes up.
    const headR = () => { const f = w.updateFrame(); return { x: w.worldPos.x + f.up.x * 2.4, y: w.worldPos.y + f.up.y * 2.4, z: w.worldPos.z + f.up.z * 2.4 }; };
    w.pitch = 1.4;
    const roof0 = dg.digTarget();
    let roofRose = false;
    if (roof0) {
      while (dg.carried.length) dg.dump();
      const dBefore = FIELD.density(mars, roof0.point.x + up.x * 0.3, roof0.point.y + up.y * 0.3, roof0.point.z + up.z * 0.3);
      dg.dig();
      const dAfter = FIELD.density(mars, roof0.point.x + up.x * 0.3, roof0.point.y + up.y * 0.3, roof0.point.z + up.z * 0.3);
      roofRose = dAfter > dBefore + 0.1;
    }
    check('aiming up finds the ceiling and a bite opens it (down, sideways and up all dig)', !!roof0 && roofRose);
    check('the ceiling holds the player in: no walking through a roof that is there (head probe never in rock after 3 s of jumping)',
      (() => { let bad = 0; for (let i = 0; i < 180; i++) { w.tick(1 / 60, { jump: i % 40 === 0 }); if (FIELD.density(mars, headR().x, headR().y, headR().z) < -2) bad++; } return bad === 0; })());
    FIELD.attachEdits(null);
  }

  {
    // A deep shaft is not a staircase: a 3.5 m hole cannot be scrambled out of.
    const store = fresh();
    const w = new Walker(mars); w.placeAtGeodetic(LAT, LON + 0.03, 0.3);
    w.collisionActive = (x, y, z) => !store.isEmpty && store.affects(x, y, z, 2.5);
    for (let i = 0; i < 60; i++) w.tick(1 / 60, {});
    const S = { ...w.worldPos }, up = unit(S);
    for (let k = 0; k < 8; k++) store.dig(S.x - up.x * (0.3 + k * 0.5), S.y - up.y * (0.3 + k * 0.5), S.z - up.z * (0.3 + k * 0.5), 0.55);
    const pu = unit(S), floorR = fieldSurfaceHeight(S, 3, 12) - 0;
    w.worldPos = { x: pu.x * (floorR + 0.05), y: pu.y * (floorR + 0.05), z: pu.z * (floorR + 0.05) };
    w.velocity = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 90; i++) w.tick(1 / 60, {});
    const depthBefore = len(S) - len(w.worldPos);
    for (let i = 0; i < 360; i++) w.tick(1 / 60, { moveNorth: Math.sin(i * 0.1), moveEast: Math.cos(i * 0.07), jump: i % 55 === 0 });
    const rise = len(w.worldPos) - (len(S) - depthBefore);
    check('a shaft deeper than a person can scramble (about 3 m) really is a shaft: six seconds of jumping and pushing does not get out',
      depthBefore > 3.0 && rise < 1.5, `${depthBefore.toFixed(2)} m deep, rose ${rise.toFixed(2)} m`);
    FIELD.attachEdits(null);
  }

  // =========================================================================================
  section('7f. The ground tiers tile the ground: no sky, no paper, no lid on a hole');
  // =========================================================================================
  {
    const store = fresh();
    // Build the two heightfield tiers the way main.js does, around a point in the middle of the dug ground.
    const centre = surfacePoint(0, 0);
    const near = new LocalPatch(mars, { sizeM: 48, res: 81 });
    const mid = new LocalPatch(mars, { sizeM: 880, res: 132 });
    near.rebuild(centre.x, centre.y, centre.z);
    mid.setExcluded([{ centre: { ...near.worldPos }, radius: near.sizeM * 0.40 }]);
    mid.rebuild(centre.x, centre.y, centre.z);

    // (3) What is drawn is where the field is, measured BEFORE anything is dug: the near tier within 20 cm
    // (its 0.6 m triangles cut across the dune creases), the mid tier within 2.5 m (6.7 m triangles).
    let worstNear = 0, worstMid = 0;
    for (let k = 0; k < 600; k++) {
      const a = k * 2.399963, r = 22 * Math.sqrt((k + 0.5) / 600);
      const p = surfacePoint(Math.cos(a) * r, Math.sin(a) * r), l = len(p), d = { x: p.x / l, y: p.y / l, z: p.z / l };
      const sn = near.surfaceRadiusAt(d.x, d.y, d.z); if (sn !== null) worstNear = Math.max(worstNear, Math.abs(sn - l));
    }
    for (let k = 0; k < 600; k++) {
      const a = k * 2.399963, r = 300 * Math.sqrt((k + 0.5) / 600);
      const p = surfacePoint(Math.cos(a) * r, Math.sin(a) * r), l = len(p), d = { x: p.x / l, y: p.y / l, z: p.z / l };
      const sm = mid.surfaceRadiusAt(d.x, d.y, d.z); if (sm !== null) worstMid = Math.max(worstMid, Math.abs(sm - l));
    }
    check('the drawn ground is the fields ground: near tier within 20 cm, mid tier within 2.5 m, nowhere floating or sunk by more',
      worstNear < 0.2 && worstMid < 2.5, `near ${worstNear.toFixed(3)} m, mid ${worstMid.toFixed(3)} m`);

    // (1) The tiers draw the ORIGINAL geology: digging changes neither of them.
    const radiiBefore = Float64Array.from(near._radii);
    const bitesAt = [[0, 0], [0.5, 0.5], [-0.4, 0.6]];
    for (const [e, n] of bitesAt) { const p = surfacePoint(e, n), u = unit(p); store.dig(p.x - u.x * 0.2, p.y - u.y * 0.2, p.z - u.z * 0.2, 0.5); }
    near.rebuild(centre.x, centre.y, centre.z);
    let same = true;
    for (let i = 0; i < radiiBefore.length; i++) if (radiiBefore[i] !== near._radii[i]) { same = false; break; }
    check('the heightfield tiers draw the original geology and never see an edit (no coarse lid on a hole)', same);

    // (2) Every spot of ground within 80 m is drawn by at least one tier (no see-through, no paper).
    const kept = (patch) => {
      const n = patch.res, idx = patch.geo.getIndex().array, set = new Uint8Array((n - 1) * (n - 1));
      for (let q = 0; q < idx.length; q += 6) { const a = idx[q]; set[Math.floor(a / n) * (n - 1) + (a % n)] = 1; }
      return set;
    };
    const keptNear = kept(near), keptMid = kept(mid);
    const cover = (patch, keptSet, p) => {
      const f = patch._frame, n = patch.res, half = patch.sizeM / 2, step = patch.sizeM / (n - 1);
      const v = sub(p, patch.worldPos), east = dot(v, f.east), north = dot(v, f.north);
      const fi = (east + half) / step, fj = (north + half) / step;
      if (fi < 0 || fj < 0 || fi >= n - 1 || fj >= n - 1) return false;
      return keptSet[Math.floor(fj) * (n - 1) + Math.floor(fi)] === 1;
    };
    let gaps = 0, samples = 0;
    for (let k = 0; k < 4000; k++) {
      const a = k * 2.399963, r = 80 * Math.sqrt((k + 0.5) / 4000);
      const p = surfacePoint(Math.cos(a) * r, Math.sin(a) * r);
      samples++;
      if (!cover(near, keptNear, p) && !cover(mid, keptMid, p)) gaps++;
    }
    check('every point of the ground within 80 m is drawn by the near tier or the mid tier (nothing falls between them)', gaps === 0, `${gaps} of ${samples} uncovered`);

    // (4) Ground is solid under the drawn surface: nothing hollow within 2 m beneath the visible ground near the player.
    let hollow = 0;
    for (let k = 0; k < 300; k++) {
      const a = k * 2.399963, r = 60 * Math.sqrt((k + 0.5) / 300);
      const p = surfacePoint(Math.cos(a) * r, Math.sin(a) * r), u = unit(p);
      FIELD.attachEdits(null);
      for (const dpt of [0.3, 1.0, 2.0]) { const q = add(p, u, -dpt); if (FIELD.density(mars, q.x, q.y, q.z) >= 0) hollow++; }
      FIELD.attachEdits(store);
    }
    check('under every spot of visible ground within 60 m there is solid rock for at least 2 m (nothing paper-thin)', hollow === 0, `${hollow} open samples`);
    FIELD.attachEdits(null);
  }
}
