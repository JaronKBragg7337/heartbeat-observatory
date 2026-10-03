// World 2 (Ceres, with Occator Works on it) checks: the body, the jump, the trade, the layout. No browser: the real field, the real authority.
//   node test/_world2-only.mjs        (the registry's `run` hook runs this file inside validate)
import '../server/runtime.mjs';

export async function run({ check, section }) {
  const SPEC = await import('../src/space/spaceSpec.js');
  const REG = await import('../src/worlds/registry.js');
  const DEF = (await import('../src/worlds/ceres/def.js')).default;
  const { makeMoon } = await import('../src/space/moonField.js');
  const { MATERIALS, density, attachEdits } = await import('../src/world/field.js');
  const J = await import('../src/space/jump.js');
  const L = await import('../src/worlds/ceres/layout.js');
  const T = await import('../src/worlds/ceres/trade.js');
  const { MAT_ITEM } = await import('../src/space/jobs.js');
  const { ITEM_OF_MATERIAL, SHOP_GOODS } = await import('../src/economy/shops.js');
  const { initialEconomy } = await import('../src/economy/economy.js');
  const { Walker } = await import('../src/player/walker.js');
  const { EditStore } = await import('../src/world/edits.js');

  section('World 2: Ceres is a real body, with Occator Works on it, a jump from Mars');
  const b = makeMoon('ceres'), pi = b.padInfo, R0 = DEF.radiusMean, AU = 1.495978707e11;
  const g = 6.6743e-11 * 9.38392e20 / (R0 * R0);
  check('Ceres\'s radius, mass and gravity are Dawn\'s (mean radius 469.7 km, 9.38392e20 kg, 0.284 m/s2) and the three axes are 966.2 x 962.0 x 891.8 km', R0 === 469_700 && DEF.massKg === 9.38392e20 && Math.abs(b.surfaceGravity - 0.284) < 0.002 && Math.abs(g - b.surfaceGravity) < 1e-9
    && Math.abs(2 * DEF.axes.a / 1000 - 966.2) < 0.1 && Math.abs(2 * DEF.axes.b / 1000 - 962.0) < 0.1 && Math.abs(2 * DEF.axes.c / 1000 - 891.8) < 0.1, `g ${b.surfaceGravity}`);
  check('its day is 9.07417 hours with a tilt of about 4 degrees, and the Sun is drawn 0.19 degrees across (0.533 deg / 2.77 AU)', Math.abs(DEF.rotation.periodS / 3600 - 9.07417) < 1e-6 && DEF.rotation.axialTiltDeg === 4 && Math.abs(DEF.sky.star.diskDeg - 0.533 / 2.77) < 0.01);
  check('its orbit is JPL\'s (e 0.0797, i 10.6, node 80.2, peri 73.3, a 2.77 AU) and it sits where the Solar System puts it on the game\'s start date: 1 to 4.5 AU from Mars', (() => { const o = DEF.orbit, c = REG.worldCentre('ceres'), d = Math.hypot(c.x, c.y, c.z) / AU; return o.e === 0.0797 && o.i === 10.6 && o.node === 80.2 && o.peri === 73.3 && Math.abs(o.a / AU - 2.77) < 0.01 && d > 1 && d < 4.5; })());
  check('Occator is placed from Dawn (19.86 N, 238.85 E, 92 km, 3 km deep, a 340 m dome in it); Kerwan and Ahuna Mons from the real map; the station stands on Occator\'s floor 11 km from the dome', (() => {
    const L0 = DEF.landmarks, o = L0.find((l) => l.name === 'Occator'), dome = L0.find((l) => l.name === 'Cerealia Tholus'), k = L0.find((l) => l.name === 'Kerwan'), a = L0.find((l) => l.name === 'Ahuna Mons');
    const DEG = Math.PI / 180, dir = (la, lo) => [Math.cos(la * DEG) * Math.cos(lo * DEG), Math.cos(la * DEG) * Math.sin(lo * DEG), Math.sin(la * DEG)];
    const p = dir(DEF.pad.lat, DEF.pad.lon), q = dir(o.lat, o.lon), d = R0 * Math.acos(p[0] * q[0] + p[1] * q[1] + p[2] * q[2]);
    return o.lat === 19.86 && o.lon === 238.85 && o.radiusM === 46_000 && o.depthM === 3000 && dome.depthM === -340 && k.lat === -11.47 && k.lon === 122.58 && Math.abs(k.radiusM * 2 / 1000 - 283.88) < 0.1 && a.lat === -10.46 && a.lon === 315.8 && d > 9_000 && d < 13_000 && d < o.radiusM * 0.3;
  })());
  check('Ceres is registered as a world beyond the drive (a frame, a pad per ship) reached by a jump lane: the nav computer lists it as a destination', SPEC.MOON_IDS.includes('ceres') && SPEC.DESTINATIONS.some((d) => d.id === 'ceres' && d.kind === 'moon' && d.jump) && J.isLaneWorld('ceres') && !J.isLaneWorld('phobos') && J.systemOfFrame('deimos') === 'mars');
  check('the field is a real solid: negative three metres under the pad, open air three metres over it', density(b, pi.point.x - pi.up.x * 3, pi.point.y - pi.up.y * 3, pi.point.z - pi.up.z * 3) < 0 && density(b, pi.point.x + pi.up.x * 3, pi.point.y + pi.up.y * 3, pi.point.z + pi.up.z * 3) > 0);
  const at = (e, n, up = 0.05) => { const x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n, l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l); return { x: x / l * (R + up), y: y / l * (R + up), z: z / l * (R + up), R, l }; };
  {
    const w = new Walker(b); const p = at(0, -140); Object.assign(w.worldPos, { x: p.x, y: p.y, z: p.z }); w.updateFrame();
    let grounded = 0; for (let i = 0; i < 90; i++) { w.tick(1 / 30, {}); if (w.grounded) grounded++; }
    check('a walker set down on Ceres stands on it (0.284 m/s2 holds him down)', grounded > 60, `grounded ${grounded}/90`);
  }
  check('the main pad is flat (within 5 cm over 200 m) so the Meridian and the buildings sit level', (() => { let worst = 0; for (let e = -100; e <= 100; e += 25) for (let n = -100; n <= 100; n += 25) { const p = at(e, n, 0); const h = (p.x - pi.point.x) * pi.up.x + (p.y - pi.point.y) * pi.up.y + (p.z - pi.point.z) * pi.up.z; worst = Math.max(worst, Math.abs(h)); } return worst < 0.05; })());
  check('under the buildings and the pad the ground is a slab nothing digs through; the open ground is dust; the outcrop is ore; the pans and the dome are white salt', (() => {
    const mat = (e, n, dep) => { const p = at(e, n, -dep); return b.materialField(p.x, p.y, p.z); };
    return mat(0, 0, 0.2).id === MATERIALS.concrete.id && mat(-6, 100, 0.3).id === MATERIALS.concrete.id && mat(0, -120, 0.5).id === MATERIALS.ceresRegolith.id
      && mat(420, 120, 0).id === MATERIALS.ceresOre.id && mat(700, -520, 0).id === MATERIALS.ceresSalt.id && mat(11_000, 0, 0).id === MATERIALS.ceresSalt.id;
  })());
  check('The Cut is a terraced pit about 640 m deep with ramps a person can walk (no slope steeper than 35 degrees over 100 m)', (() => {
    const f = (e, n) => { const d = { x: pi.up.x + (pi.east.x * e + pi.north.x * n) / R0, y: pi.up.y + (pi.east.y * e + pi.north.y * n) / R0, z: pi.up.z + (pi.east.z * e + pi.north.z * n) / R0 }; const l = Math.hypot(d.x, d.y, d.z); return b.surfaceRadius(d.x / l, d.y / l, d.z / l); };
    const cx = -3300, cn = 3000; let steepest = 0, deepest = 0; const top = f(cx - 2800, cn);
    for (let a = 0; a < 6.28; a += 0.4) for (let r = 100; r < 2600; r += 20) { const e = cx + Math.cos(a) * r, n = cn + Math.sin(a) * r, e2 = cx + Math.cos(a) * (r + 100), n2 = cn + Math.sin(a) * (r + 100); steepest = Math.max(steepest, Math.abs(f(e, n) - f(e2, n2)) / 100); deepest = Math.max(deepest, top - f(e, n)); }
    return deepest > 480 && deepest < 1000 && Math.atan(steepest) * 180 / Math.PI < 35;
  })());
  check('ore and salt are dug as themselves: lots cut there carry their material, the hold files them as ceres-ore / ceres-salt, and the shops can list them', (() => {
    const e = new EditStore(b); attachEdits(e);
    const cut = (en, nn) => { const p = at(en, nn, -0.4); return e.carve({ x: p.x, y: p.y, z: p.z, r: 0.5 }); };
    const ore = cut(420, 120), salt = cut(700, -520);
    const has = (lot, id) => lot && lot.massKg > 50 && (lot.parts || [{ materialId: lot.materialId }]).some((q) => q.materialId === id);
    const ok = has(ore, MATERIALS.ceresOre.id) && has(salt, MATERIALS.ceresSalt.id);
    attachEdits(null);
    return ok && MAT_ITEM[MATERIALS.ceresOre.id] === T.ORE_ITEM && MAT_ITEM[MATERIALS.ceresSalt.id] === T.SALT_ITEM && ITEM_OF_MATERIAL[MATERIALS.ceresOre.id] === T.ORE_ITEM && ITEM_OF_MATERIAL[MATERIALS.ceresSalt.id] === T.SALT_ITEM && !!SHOP_GOODS[T.ORE_ITEM] && !!SHOP_GOODS[T.SALT_ITEM];
  })());

  section('World 2: the jump and the trade');
  const pm = J.mouthPoint('mars'), km = J.mouthPoint('ceres', b);
  check('each region has one lane mouth straight up from its home pad (Mars 60,000 km out, a far world 50,000 km)', Math.abs(Math.hypot(pm.x, pm.y, pm.z) - 6.0e7) < 1 && Math.abs(Math.hypot(km.x, km.y, km.z) - 5.0e7) < 1 && (km.x * pi.up.x + km.y * pi.up.y + km.z * pi.up.z) / 5.0e7 > 0.999999);
  check('the jump is 20 cabin seconds and 120 credits: the constants the authority and the browser both read', J.JUMP.spoolS === 20 && J.JUMP.feeCredits === 120);
  check('the drive stops inside the safety sphere and above the floor of the destination (the standoff over the pad is outside the sphere)', (() => { const tb = J.transitBody('ceres', b), s = pi.up, standoff = pi.planeR + 1800; return tb.safeR < standoff && tb.floorR < tb.safeR && tb.safeR > R0 - 0.05 * R0; })());
  const ship = () => { const e = initialEconomy(); e.inventory.water = 40; e.inventory.parts = 6; const lot = (id, kg) => ({ lotId: id, materialId: id === 'o' ? 'MAT-CERES-ORE' : 'MAT-CERES-SALT', materialName: id, massKg: kg, solidVolumeM3: kg / 4000, looseVolumeM3: kg / 3000, parts: [{ materialId: id === 'o' ? 'MAT-CERES-ORE' : 'MAT-CERES-SALT', massKg: kg, volumeM3: kg / 4000 }] });
    return { hold: { 'ceres-ore': 3000, 'ceres-salt': 2000 }, holdLots: [lot('o', 3000), lot('s', 2000)], economy: e }; };
  {
    const s = ship(), fund = { marks: 60000 }, m0 = s.economy.marks;
    const r = T.sellMatter(s, 'ceres-ore', 'works', 2, fund);
    check('2 t of ore at the Occator foundry pays 260 marks, leaves 1 t of it in the hold and in the lots (the salt untouched), and the matter goes to the dealer\'s ledger', r.paid === 260 && s.economy.marks === m0 + 260 && Math.abs(s.hold['ceres-ore'] - 1000) < 1e-6 && Math.abs(T.matterKg(s.holdLots, 'ceres-ore') - 1000) < 1e-6 && Math.abs(T.matterKg(s.holdLots, 'ceres-salt') - 2000) < 1e-6 && s.economy.depotLots.length === 1 && fund.marks === 60000 - 260);
    const r2 = T.sellMatter(ship(), 'ceres-ore', 'marineris', 3, { marks: 1e6 }), r3 = T.sellMatter(ship(), 'ceres-salt', 'marineris', 2, { marks: 1e6 });
    check('3 t of ore at the Marineris depot pays 600 marks and 2 t of salt 140: the longer haul pays more a tonne than the foundry', r2.paid === 600 && r3.paid === 140 && T.MATTER['ceres-ore'].marineris > T.MATTER['ceres-ore'].works && T.MATTER['ceres-salt'].marineris > T.MATTER['ceres-salt'].works);
    let refused = 0; for (const f of [() => T.sellMatter(ship(), 'ceres-ore', 'works', 4, { marks: 1e6 }), () => T.sellMatter(ship(), 'ceres-ore', 'works', 0, { marks: 1e6 }), () => T.sellMatter(ship(), 'ceres-ore', 'works', 1, { marks: 5 }), () => T.sellMatter(ship(), 'ceres-ore', 'nowhere', 1, { marks: 1e6 }), () => T.sellMatter(ship(), 'regolith', 'works', 1, { marks: 1e6 })]) { try { f(); } catch { refused++; } }
    check('more than the hold has, none, to a dealer with no money, where nobody buys, or something nobody buys: all refused', refused === 5);
    const s3 = ship(), m3 = s3.economy.marks, q = T.sellSupply(s3, 'parts', 6, { marks: 1e6 });
    check('the supply desk pays about twice the Mars shelf price (6 spare-parts kits: 900 marks against Mars\'s 480)', q.paid === 900 && s3.economy.marks === m3 + 900 && s3.economy.inventory.parts === 0 && T.SUPPLY_PAY.water > 1.8 * 8);
  }
  check('no worker stands inside a solid; the foundry door (10 m) and the pad\'s edges are open', L.WORKERS.every((w) => !L.BOXES.some((bx) => w.x > bx.x0 - 0.3 && w.x < bx.x1 + 0.3 && w.z > bx.z0 - 0.3 && w.z < bx.z1 + 0.3)) && !L.solidAt(-4, -88.4, 0) && !L.solidAt(-4, -80, 0.3));
  check('everything of the Works lies inside the graded ground (under 160 m of the pad)', L.BOXES.every((bx) => Math.hypot(Math.max(Math.abs(bx.x0), Math.abs(bx.x1)), Math.max(Math.abs(bx.z0), Math.abs(bx.z1))) < 160));

  section('World 2: the real authority flies Mars -> Ceres -> Mars across the Ore Lane, and the foreman buys ore');
  const { runWorld2Trips } = await import('./world2-trips.mjs');
  await runWorld2Trips({ check });
}
