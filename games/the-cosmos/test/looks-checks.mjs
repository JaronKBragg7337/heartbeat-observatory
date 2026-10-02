// Looks: the Phobos salvage props, the ground you stand on, and the Shrike's own paint.
// Run from test/validate.mjs. No WebGL: screenshots live in docs/qa/2026-10-02/looks/.

export async function runLooksChecks({ check, section, THREE }) {
  const base = '../src/';
  section('27. Looks: salvage hardware, Phobos ground, the Shrike\'s paint');

  const { buildSampleBeacon, buildCargoModule, hardwareTriangles } = await import(base + 'space/hardware.js');
  const { makeMoon } = await import(base + 'space/moonField.js');
  const { shipDef } = await import(base + 'ships/registry.js');
  const { visualsFor } = await import(base + 'ships/visuals.js');
  const { makeShipMaterials } = await import(base + 'ship/shipTextures.js');
  const { buildExterior } = await import(base + 'ship/shipExterior.js');
  const { buildLayout } = await import(base + 'ship/shipSpec.js');

  const beaconParts = ['foot', 'mast', 'collar', 'head', 'port', 'latch', 'antenna', 'solar', 'lamp', 'decal'];
  const cargoParts = ['panel', 'door', 'latch', 'stripe', 'skid', 'vent', 'scorch', 'damage', 'antenna', 'lamp', 'decal', 'lug'];
  const shells = (obj) => { let n = 0; obj.traverse((o) => { if (o.name === 'hardware-shell') n++; }); return n; };
  const named = (obj, name) => { let hit = null; obj.traverse((o) => { if (o.name === name) hit = o; }); return hit; };

  const a = buildSampleBeacon({ low: true, id: 'S1' });
  const b = buildSampleBeacon({ low: true, id: 'S2' });
  const cargo = buildCargoModule({ low: true });
  const aTris = hardwareTriangles(a.group), cTris = hardwareTriangles(cargo.group);
  check('a sample beacon is hardware (stakes, mast, head, port, latch, lamp, decal), not one pole', beaconParts.every((p) => a.group.userData.parts.includes(p)) && shells(a.group) >= 3 && aTris > 80, `shells ${shells(a.group)} tris ${aTris}`);
  check('two beacons keep their own lamp materials, so one can go green when its sample is taken', a.lamp.material !== b.lamp.material && a.lamp.material && a.lamp.material.color);
  check('the beacon halo and the stencil plate are their own meshes (the plate is a flat colour in Node, where there is no canvas)', !!named(a.group, 'beacon-halo') && !!named(a.group, 'hardware-decal'));
  check(`a phone-tier beacon stays under 2000 triangles (${aTris})`, aTris < 2000);
  check('the cargo module is plated hardware (door, latches, broken stripe, scorch, skids, lamp), not one box', cargoParts.every((p) => cargo.group.userData.parts.includes(p)) && shells(cargo.group) >= 4 && cTris > 200, `shells ${shells(cargo.group)} tris ${cTris}`);
  check('the distress lamp is its own material, not the beacon\'s', cargo.lamp.material && cargo.lamp.material !== a.lamp.material);
  check(`a phone-tier cargo module stays under 4000 triangles (${cTris})`, cTris < 4000);

  const ph = makeMoon('phobos'), dm = makeMoon('deimos');
  const dirOf = (body, eastM, northM) => {
    const pi = body.padInfo, p = pi.point, e = pi.east, n = pi.north;
    const x = p.x + e.x * eastM + n.x * northM, y = p.y + e.y * eastM + n.y * northM, z = p.z + e.z * eastM + n.z * northM;
    const l = Math.hypot(x, y, z);
    return { x: x / l, y: y / l, z: z / l };
  };
  let bestRock = { rock: -1 };
  for (let e = 90; e <= 400; e += 4) {
    for (let n = -100; n <= 200; n += 4) {
      const d = dirOf(ph, e, n);
      const rock = ph.rockRelief(d.x, d.y, d.z);
      if (rock > bestRock.rock) bestRock = { ...d, rock };
    }
  }
  const padRock = ph.rockRelief(dirOf(ph, 20, -12).x, dirOf(ph, 20, -12).y, dirOf(ph, 20, -12).z);
  let deimosRock = 0;
  for (let d = 40; d <= 400; d += 30) {
    const a = dirOf(dm, d, 8), b = dirOf(dm, -10, d);
    deimosRock = Math.max(deimosRock, dm.rockRelief(a.x, a.y, a.z), dm.rockRelief(b.x, b.y, b.z));
  }
  const againD = dirOf(ph, 140, 36);
  const again = ph.rockRelief(againD.x, againD.y, againD.z);
  const againR = ph.surfaceRadius(againD.x, againD.y, againD.z);
  check('Phobos rock is deterministic: the same place gives the same radius and the same rock twice', again === ph.rockRelief(againD.x, againD.y, againD.z) && againR === ph.surfaceRadius(againD.x, againD.y, againD.z));
  check('the landing pad carries no loose rock (the graded plane stays flat)', padRock === 0, `rock ${padRock}`);
  check(`boulders stand off the pad: somewhere between 90 m and 400 m a stone adds at least 0.25 m (measured ${bestRock.rock.toFixed(2)} m)`, bestRock.rock >= 0.25);
  check(`Deimos has none of that loose rock (measured ${deimosRock.toFixed(3)} m)`, deimosRock === 0);
  {
    const crest = bestRock;
    const R = ph.surfaceRadius(crest.x, crest.y, crest.z);
    const inside = ph.baseField(crest.x * (R - 0.08), crest.y * (R - 0.08), crest.z * (R - 0.08));
    const air = ph.baseField(crest.x * (R + 0.2), crest.y * (R + 0.2), crest.z * (R + 0.2));
    check('a point inside a boulder is rock and the air above its crest is air (the stone is the density field)', crest.rock >= 0.25 && inside < 0 && air > 0, `rock ${crest.rock.toFixed(2)} inside ${inside.toFixed(3)} air ${air.toFixed(3)}`);
  }
  {
    const pi = ph.padInfo;
    const onPad = ph.cavityShade(pi.point.x, pi.point.y, pi.point.z);
    const nearD = dirOf(ph, 30, -10);
    const nearR = ph.surfaceRadius(nearD.x, nearD.y, nearD.z);
    const nearS = ph.cavityShade(nearD.x * nearR, nearD.y * nearR, nearD.z * nearR);
    let minS = 1, maxS = 0;
    for (let lat = -75; lat <= 75; lat += 15) {
      for (let lon = -180; lon < 180; lon += 24) {
        const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
        const u = Math.cos(la) * Math.cos(lo), v = Math.cos(la) * Math.sin(lo), w = Math.sin(la);
        const p = ph.surfacePoint(u, v, w);
        const s = ph.cavityShade(p.x, p.y, p.z);
        if (s < minS) minS = s;
        if (s > maxS) maxS = s;
      }
    }
    check('the graded pad is not stained by crater shadow', onPad > 0.99 && nearS > 0.98, `pad ${onPad.toFixed(3)} near ${nearS.toFixed(3)}`);
    check(`crater floors and groove troughs are darker than the rims (shade ${minS.toFixed(2)} to ${maxS.toFixed(2)})`, minS < 0.9 && maxS - minS > 0.08);
  }

  const RD = shipDef('raider');
  const V = visualsFor('raider');
  const mats = makeShipMaterials({ tier: 'low' });
  const hullHex = mats.hull.color.getHex(), hullMap = mats.hull.map || null;
  const ex = V.buildExterior({ ...RD.layout, custom: V.custom }, mats, { tier: 'low', def: RD });
  V.applyNeutralPose(ex);
  const statsOf = (root) => {
    let mesh = null;
    root.traverse((o) => { if (o.isMesh && o.name === 'hull' && o.geometry && o.geometry.attributes.color) mesh = o; });
    const col = mesh.geometry.attributes.color;
    let red = 0, black = 0, lum = 0;
    for (let i = 0; i < col.count; i++) {
      const r = col.getX(i), g = col.getY(i), b = col.getZ(i), L = 0.299 * r + 0.587 * g + 0.114 * b;
      lum += L;
      if (r > 0.45 && r > 2 * g && r > 2 * b) red++;
      if (L < 0.12) black++;
    }
    return { n: col.count, red: red / col.count, black: black / col.count, mean: lum / col.count, mat: mesh.material };
  };
  const st = statsOf(ex.root);
  check(`the Shrike\'s hull reads scorched: mean luminance ${st.mean.toFixed(2)}, red primer ${(100 * st.red).toFixed(0)}%, black ${(100 * st.black).toFixed(0)}%`, st.mean < 0.45 && st.red >= 0.08 && st.black >= 0.06);
  check('the scars are on the ship: sawtooth spine, mismatched plates, a chin, one wing fence', !!ex.root.getObjectByName('raider-scars') && ex.paint === 'shrike-scorched');
  check('building a Shrike does not repaint the shared hull material (the Meridian is built from it afterwards)', mats.hull.color.getHex() === hullHex && (mats.hull.map || null) === hullMap && st.mat !== mats.hull);
  check('the phone tier still builds the raider exterior', ex.tier === 'low' && ex.legs.length === 4 && ex.engines.length === 2);
  {
    const hardware = new THREE.Group();
    for (const ch of [...ex.root.children]) {
      if (ch.name === 'exhaust' || (ch.isMesh && ch.material && ch.material.blending === THREE.AdditiveBlending)) continue;
      hardware.add(ch);
    }
    hardware.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(hardware).getSize(new THREE.Vector3());
    const env = RD.envelope;
    const drift = Math.max(Math.abs(size.x - env.width), Math.abs(size.y - env.height), Math.abs(size.z - env.depth));
    check(`the raider still measures within 5 cm of its envelope (drift ${(drift * 100).toFixed(1)} cm, size ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)})`, drift < 0.05);
  }
  const meridian = buildExterior(buildLayout(), mats, { tier: 'low' });
  let mHull = null;
  meridian.root.traverse((o) => { if (o.isMesh && o.name === 'hull') mHull = o; });
  check('the Meridian\'s hull still uses the shared pale material', !!mHull && mHull.material === mats.hull && mats.hull.color.getHex() === hullHex);

  const matsInt = makeShipMaterials({ tier: 'low' });
  const before = matsInt.hazard.color.getHex();
  V.interiorPalette(matsInt);
  const wall = Object.keys(matsInt).find((k) => k.startsWith('wall:'));
  check('the raider interior palette is dusk walls, a dark deck and blood-red hazard tape',
    matsInt[wall].color.getHex() === 0x6a5348 && matsInt.ceil.color.getHex() === 0x3e3a38 && matsInt['floor:deck'].color.getHex() === 0x4a403c && matsInt.hazard.color.getHex() === 0x8e1e18 && before !== 0x8e1e18);
}
