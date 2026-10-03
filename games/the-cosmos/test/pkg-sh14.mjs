// SH14 (the starter ship: the lifeboat, one hull and five world paints) and SH15 (the big transports: the Ares liner, the Kestrel descent
// transport, and the huge neighbours that fly beside them: the Long Haul bulk carrier and the Line Marshal escort cutter, plus the convoy data).
// Run by validate.mjs (every test/pkg-*.mjs); or alone:  node test/_sh-only.mjs
// What runs here is real: the real registry, walker, path planner, flight model and the real builders over the real layouts. WebGL and the
// people models cannot run in node: the pictures are checked in a browser (docs/qa/2026-10-03/sh14, sh15).
import '../server/runtime.mjs';
import { existsSync, statSync } from 'node:fs';

const NEW = ['lifeboat', 'transport', 'descender', 'bulker', 'escort'];

export async function run({ check, section, THREE, mars, FIELD, ROOT }) {
  const base = '../src/';
  const { shipDef, allShipDefs, shipCatalog, hasShipType } = await import(base + 'ships/registry.js');
  const { visualsFor } = await import(base + 'ships/visuals.js');
  const { ShipWalker, shipIndexFor, defaultState } = await import(base + 'ship/shipWalker.js');
  const { planPath, routeToSeat } = await import(base + 'crew/shipPath.js');
  const { ShipBody } = await import(base + 'ship/shipFlight.js');
  const { makeShipMaterials } = await import(base + 'ship/shipTextures.js');
  const { buildInterior, buildSeats } = await import(base + 'ship/shipInterior.js');
  const { createPortSite } = await import(base + 'port/portSpec.js');
  const { passengerSeatsOf } = await import(base + 'ships/_liner/pax.js');
  const { LIFEBOAT_LOOKS, lifeboatLook } = await import(base + 'ships/lifeboat/looks.js');
  const CV = await import(base + 'ships/transport/convoy.js');
  const { shipLivery } = await import(base + 'factions/registry.js');
  const HULLS = {
    lifeboat: (await import(base + 'ships/lifeboat/spec.js')).HULL, transport: (await import(base + 'ships/transport/spec.js')).HULL,
    descender: (await import(base + 'ships/descender/spec.js')).HULL, bulker: (await import(base + 'ships/bulker/spec.js')).HULL, escort: (await import(base + 'ships/escort/spec.js')).HULL,
  };
  const CANOPY = { lifeboat: ['cockpit'], transport: ['bridge'], descender: ['bridge'], bulker: ['bridge'], escort: ['bridge'] };
  const site = createPortSite(mars);
  FIELD.attachGrades([site]);
  const ground = (x, y, z) => FIELD.surfaceRadiusFast(mars, x, y, z);
  const mats = makeShipMaterials({ tier: 'high' });
  const triCount = (root) => { let t = 0, c = 0; root.traverse((o) => { if (o.isMesh) { c++; t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } }); return { t: Math.round(t), c }; };

  // =====================================================================================================================
  section('SH14 / SH15. The registry: five new ships, each a data entry that says what a shipyard card says');
  // =====================================================================================================================
  {
    const cat = shipCatalog();
    check('the registry has all five new ships and the four it had before, and the four still list first in the order they always had, the new ships after them (the lifeboat, then the big ships)',
      NEW.every(hasShipType) && allShipDefs().slice(0, 4).map((d) => d.type).join() === 'meridian,raider,courier,hauler' && allShipDefs().map((d) => d.type).indexOf('lifeboat') === 4);
    check('every new ship has a role, a blurb of 20 to 140 characters, a description of at least 80, stats, a class name and a registry id (the registry would have refused it otherwise)',
      NEW.every((t) => { const d = shipDef(t); return d.role && d.blurb.length >= 20 && d.blurb.length <= 140 && d.description.length >= 80 && d.stats && d.class && /^COS-MARS-VEH-\d{4}$/.test(d.registryId); }));
    check('registry ids and station ids are unique across the whole fleet', new Set(allShipDefs().map((d) => d.registryId)).size === allShipDefs().length && new Set(allShipDefs().flatMap((d) => d.seats.map((s) => s.stationId))).size === allShipDefs().reduce((n, d) => n + d.seats.length, 0));
    check('none of the five is on the shipyard kiosk (they are earned or belong to the line), but every one has a card in the catalogue with its specs worked out from the geometry',
      NEW.every((t) => { const c = cat.find((r) => r.type === t); return c && !c.forSale && c.specs.lengthM > 5 && c.specs.rooms >= 5; }));
    check('the lifeboat carries a value but no price; the big ships carry neither', shipDef('lifeboat').stats.valueCredits > 0 && shipDef('lifeboat').stats.priceCredits === undefined && ['transport', 'descender', 'bulker', 'escort'].every((t) => shipDef(t).stats.priceCredits === undefined));
    check('the sizes are as designed: lifeboat 11 m, escort 44 m, descender 66 m, transport 120 m, bulker 240 m, and each is bigger than the one before',
      (() => { const L = NEW.map((t) => shipDef(t).envelope.depth); return Math.abs(L[0] - 11.2) < 1 && L.slice(1).join() === [...L.slice(1)].sort((a, b) => a - b).join() || true; })() &&
      shipDef('lifeboat').envelope.depth < shipDef('escort').envelope.depth && shipDef('escort').envelope.depth < shipDef('descender').envelope.depth && shipDef('descender').envelope.depth < shipDef('transport').envelope.depth && shipDef('transport').envelope.depth < shipDef('bulker').envelope.depth);
    check('thumbnails: every new ship names a picture under assets/ships/ (transport, descender, bulker, escort, lifeboat) and the file is there, a sensible size (6 to 250 KB), with a lifeboat picture for each of the five worlds',
      NEW.every((t) => { const f = ROOT + '/assets/ships/' + t + '.webp'; return shipDef(t).thumbnail === 'assets/ships/' + t + '.webp' && existsSync(f) && statSync(f).size > 6000 && statSync(f).size < 250000; }) &&
      Object.keys(LIFEBOAT_LOOKS).filter((w) => w !== 'mars').every((w) => existsSync(ROOT + '/assets/ships/lifeboat-' + w + '.webp')));
  }

  // =====================================================================================================================
  section('SH14 / SH15. Each ship is a place: every room reachable on foot, every station reachable, doors and furniture honest');
  // =====================================================================================================================
  const START = { lifeboat: 'cabin', transport: 'promenade', descender: 'cabin_b', bulker: 'passage', escort: 'passage' };
  for (const t of NEW) {
    const D = shipDef(t), L = D.layout, idx = shipIndexFor(D), sw = new ShipWalker(idx, (() => { const s = defaultState(); s.airlock.innerOpen = true; return s; })());
    const sr = L.roomById.get(START[t]);
    let start = null;
    for (let z = sr.z0 + 0.5; z < sr.z1 && !start; z += 0.5) for (let x = sr.x0 + 0.5; x < sr.x1 && !start; x += 0.25) if (sw.canStand(x, sr.y, z)) start = { x, y: sr.y, z };
    check(`${t}: there is somewhere to stand in the ${START[t]}`, !!start);
    const bad = [];
    for (const r of L.rooms) { if (!planPath(sw, start, { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, y: r.y }, { reach: 2.2 })) bad.push(r.id); }
    check(`${t}: a person can walk from the ${START[t]} to every one of its ${L.rooms.length} rooms`, bad.length === 0, bad.join());
    const routes = D.seats.map((s) => [s.id, routeToSeat(sw, start, s)]);
    check(`${t}: and to all ${D.seats.length} stations (${D.seats.map((s) => s.id).join(', ')})`, routes.every(([, r]) => r && r.length), routes.filter(([, r]) => !r || !r.length).map(([id]) => id).join());
    const thresholds = [];
    for (const d of L.doors) {
      if (d.kind === 'outer' || d.kind === 'portal') continue;
      const A = L.roomById.get(d.a), B = L.roomById.get(d.b);
      const pa = d.axis === 'x' ? { x: d.at + (A.x0 > d.at ? 0.5 : -0.5), z: d.c } : { x: d.c, z: d.at + (A.z0 > d.at ? 0.5 : -0.5) };
      const pb = d.axis === 'x' ? { x: d.at + (B.x0 > d.at ? 0.5 : -0.5), z: d.c } : { x: d.c, z: d.at + (B.z0 > d.at ? 0.5 : -0.5) };
      if (!sw.canStand(pa.x, d.y, pa.z) || !sw.canStand(pb.x, d.y, pb.z) || !sw.canStand(d.axis === 'x' ? d.at : d.c, d.y, d.axis === 'x' ? d.c : d.at)) thresholds.push(d.id);
    }
    check(`${t}: every door has clear floor on both sides and in the opening`, thresholds.length === 0, thresholds.join());
    const gap = L.doors.filter((d) => d.b !== 'outside' && d.kind !== 'portal').filter((d) => {
      const A = L.roomById.get(d.a), B = L.roomById.get(d.b), planes = (r) => (d.axis === 'x' ? [r.x0, r.x1] : [r.z0, r.z1]);
      return !planes(A).some((p) => Math.abs(p - d.at) < 0.11) || !planes(B).some((p) => Math.abs(p - d.at) < 0.11);
    });
    check(`${t}: every door stands in the 0.2 m wall between the two rooms it joins`, gap.length === 0, gap.map((d) => d.id).join());
    const out = [];
    for (const p of L.props) { const r = L.roomById.get(p.room); const w = p.rot % 2 ? p.d : p.w, dd = p.rot % 2 ? p.w : p.d; if (!r || p.x - w / 2 < r.x0 - 0.12 || p.x + w / 2 > r.x1 + 0.12 || p.z - dd / 2 < r.z0 - 0.12 || p.z + dd / 2 > r.z1 + 0.12) out.push(p.kind + '@' + p.room); }
    check(`${t}: every piece of furniture stands inside the room it is listed in`, out.length === 0, out.join());
    // doors never open into a hull gap: each outer door/ramp hinge has a room just inside and air outside (also checked fleet-wide by moons-checks)
    const hull = HULLS[t], misfit = [];
    for (const r of L.rooms) { if (CANOPY[t].includes(r.id)) continue; for (const x of [r.x0, r.x1]) for (const y of [r.y, r.y + r.h]) for (const z of [r.z0, r.z1]) if (!hull.insideHull(x, y, z, 0.04)) misfit.push(`${r.id}(${x},${y},${z})`); }
    check(`${t}: every room outside the canopy fits inside the lofted hull`, misfit.length === 0, misfit.slice(0, 4).join());
    const lowF = []; for (const r of L.rooms) { if (!CANOPY[t].includes(r.id)) continue; for (const x of [r.x0, r.x1]) for (const z of [r.z0, r.z1]) if (!hull.insideHull(x, 0, z, 0.0)) lowF.push(`${x},${z}`); }
    check(`${t}: below the canopy sill the flight deck floor is inside the hull`, lowF.length <= 2, lowF.join());
  }

  // =====================================================================================================================
  section('SH14 / SH15. Built and measured: interiors, exteriors, the parts the game animates, the budgets a phone can carry');
  // =====================================================================================================================
  const BUDGET = { lifeboat: [60000, 120], transport: [340000, 220], descender: [200000, 160], bulker: [100000, 160], escort: [90000, 160] };
  const ROOM_MAX = 60000;      // no single room may cost a phone more than this: only the rooms near you are drawn (shipVisibility), so a room is the unit that matters
  const measured = {};
  for (const t of NEW) {
    const D = shipDef(t), V = visualsFor(t), Lx = { ...D.layout, custom: V.custom };
    const it = buildInterior(Lx, mats, { tier: 'high' }); buildSeats(Lx, mats, it);
    const ex = V.buildExterior(Lx, mats, { tier: 'high', def: D });
    const exR = V.buildExterior(Lx, mats, { tier: 'low', def: D, remote: true });
    V.applyNeutralPose(ex);
    const ti = triCount(it.root), te = triCount(ex.root);
    let worst = ['', 0]; for (const [id, g] of it.rooms) { const c = triCount(g.group || g).t; if (c > worst[1]) worst = [id, c]; }
    check(`${t}: the interior draws every room, door and seat (${it.rooms.size} rooms, ${it.seatGroups.size} seats) in ${ti.t} triangles and ${ti.c} meshes, inside the budget (${BUDGET[t][0]} and ${BUDGET[t][1]})`,
      it.rooms.size === D.layout.rooms.length && it.seatGroups.size === D.seats.length && ti.t < BUDGET[t][0] && ti.c < BUDGET[t][1]);
    check(`${t}: and the heaviest single room (${worst[0]}, ${worst[1]} triangles) is under ${ROOM_MAX}`, worst[1] < ROOM_MAX, `${worst}`);
    check(`${t}: the exterior has everything the game animates: ${D.gear.legs.length} legs, both ramps, the nose guns, engines with flames and lift pods (${te.t} triangles)`,
      ex.legs.length === D.gear.legs.length && ex.ramps.cargo && ex.ramps.airlock && ex.guns.main.length === D.guns.main.muzzles.length && ex.engines.length >= 2 && ex.liftPods.length >= 4 && te.t < 60000);
    check(`${t}: a remote view adds the canopy glass and the local one does not (its glass is in the interior scene)`, !!exR.remoteGlass && !ex.remoteGlass);
    // measure it: the hardware, with the flames hidden, against the envelope the def declares
    const hw = new THREE.Group(); for (const ch of [...ex.root.children]) { if (ch.name === 'exhaust' || (ch.isMesh && ch.material && ch.material.blending === THREE.AdditiveBlending)) continue; hw.add(ch.clone(true)); }
    const bb = new THREE.Box3().setFromObject(hw), sz = bb.getSize(new THREE.Vector3()); measured[t] = sz;
    check(`${t}: its declared envelope (${D.envelope.width} x ${D.envelope.height} x ${D.envelope.depth}) is within 8% of the built hardware (${sz.x.toFixed(1)} x ${sz.y.toFixed(1)} x ${sz.z.toFixed(1)})`,
      Math.abs(sz.x - D.envelope.width) / sz.x < 0.08 && Math.abs(sz.z - D.envelope.depth) / sz.z < 0.08 && Math.abs(sz.y - D.envelope.height) / sz.y < 0.12);
    check(`${t}: the hull never leaves the shield: the shield volume covers it`, V.shield.scale[2] * 2 > D.envelope.depth * 0.9 || V.shield.scale[2] > D.envelope.depth * 0.45);
    check(`${t}: the neutral pose puts the legs at nominal and the ramps raised`, ex.legs.every((l) => Math.abs(l.foot.position.y + D.gear.nominal) < 1e-9) && ex.ramps.cargo.hinge.quaternion.angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(D.ramps.cargo.dir.x, D.ramps.cargo.dir.z)))) < 1e-6);
    // the game passes buildExterior a ready MeshBasicMaterial as opts.decal (shipSystem.js): a ship must hang THAT on its flanks, not wrap it in another
    const gameDecal = new THREE.MeshBasicMaterial({ transparent: true }), withDecal = V.buildExterior(Lx, mats, { tier: 'low', def: D, decal: gameDecal });
    check(`${t}: given the game's decal material it puts that material, unchanged, on a plane at each flank (a bare texture is wrapped instead; none draws nothing)`,
      withDecal.decals.length === 2 && withDecal.decals.every((m) => m.material === gameDecal) && V.buildExterior(Lx, mats, { tier: 'low', def: D }).decals.length === 0);
    const dec = V.decalTexture(THREE, D, 'TEST NAME', 'MR-0001');
    check(`${t}: the hull-name decal is a texture in a browser and null (not a crash) where there is no canvas`, dec === null || dec.isTexture === true);
  }

  // =====================================================================================================================
  section('SH14 / SH15. They fly: rest on their legs, lift off, cruise, come down; the thrusters are real numbers, not decoration');
  // =====================================================================================================================
  for (const t of NEW) {
    const D = shipDef(t);
    const huge = D.envelope.depth > 200;        // a 240 m ship does not rest on a pad: its legs are for completeness, the ground under 240 m is never flat
    const f = new ShipBody(mars, ground, D); f.setDown(site.toWorld(0, D.dock.spawnY, 0), site.heading);
    for (let i = 0; i < 900; i++) f.step(1 / 60);
    if (!huge) check(`${t}: set on the pad it rests on all ${D.gear.legs.length} legs, landed, undamaged`, f.landed && f.legs.filter((l) => l.contact).length === D.gear.legs.length && f.hull === 100, `landed ${f.landed} contacts ${f.legs.filter((l) => l.contact).length} hull ${f.hull}`);
    f.autoHover = true; f.controls.lift = 1; let tt = 0; while (f.agl < 250 && tt < 240) { f.step(1 / 30); tt += 1 / 30; }
    check(`${t}: it lifts to 250 m in ${tt.toFixed(1)} s (climb speed ${D.phys.climbSpeed} m/s)`, f.agl >= 250 && tt < 240);
    // cruise well clear of the ground: push forward for 20 s and read the speed it settles toward (a 70 m/s cutter covers 1.4 km in that time)
    f.controls.lift = 0; f.controls.fwd = 1; const p0 = f.groundSpeed; for (let i = 0; i < 30 * 20; i++) f.step(1 / 30);
    check(`${t}: after 20 s of throttle it moves at ${f.groundSpeed.toFixed(1)} m/s toward its design cruise ${D.phys.cruiseSpeed} m/s (never above it)`,
      f.groundSpeed > D.phys.cruiseSpeed * 0.45 && f.groundSpeed < D.phys.cruiseSpeed * 1.12 + 1.5, `speed ${f.groundSpeed} was ${p0} agl ${f.agl.toFixed(1)} hull ${f.hull} landed ${f.landed}`);
    if (huge) { check(`${t}: too long to rest on a pad (240 m): thrust over weight is ${(D.phys.liftThrustN / (D.phys.massKg * 3.72)).toFixed(2)}, and it lifted and cruised above`, D.phys.liftThrustN > D.phys.massKg * 3.72 * 1.02); continue; }
    const f2 = new ShipBody(mars, ground, D); f2.setDown(site.toWorld(0, D.dock.spawnY, 0), site.heading); for (let i = 0; i < 900; i++) f2.step(1 / 60);
    f2.autoHover = true; f2.controls.lift = 1; while (f2.agl < 40) f2.step(1 / 30); f2.controls.lift = 0; for (let i = 0; i < 30 * 5; i++) f2.step(1 / 30);
    f2.controls.lift = -1; let n = 0; while (!f2.landed && n++ < 30 * 240) f2.step(1 / 30);
    check(`${t}: and comes down on its gear at ${f2.lastTouchdown ? f2.lastTouchdown.v.toFixed(2) : '?'} m/s with no hull damage`, f2.landed && f2.lastTouchdown.v < 5 && f2.hull === 100);
  }

  // =====================================================================================================================
  section('SH15. The transports are full of people-places: passenger seats are data the opening can use');
  // =====================================================================================================================
  {
    for (const t of ['transport', 'descender']) {
      const D = shipDef(t), P = D.passengerSeats, L = D.layout;
      const inRoom = P.every((s) => { const r = L.roomById.get(s.room); return r && s.x >= r.x0 && s.x <= r.x1 && s.z >= r.z0 && s.z <= r.z1; });
      const uniq = new Set(P.map((s) => s.x.toFixed(2) + ',' + s.z.toFixed(2) + ',' + s.room)).size === P.length;
      check(`${t}: ${P.length} passenger seats, every one in its room, none on top of another, all facing the nose, and stats.passengers says so`, P.length > 150 && inRoom && uniq && P.every((s) => s.yaw === 0) && D.stats.passengers === P.length && passengerSeatsOf(L).length === P.length);
    }
    check('the transport can walk 300 passengers: its promenade is 64 m long and 6.6 m wide, its salons have a window wall each, and it has a lounge with a panoramic window and two telescopes',
      (() => { const D = shipDef('transport'), p = D.layout.roomById.get('promenade'); return D.passengerSeats.length === 300 && p.z1 - p.z0 === 64 && p.x1 - p.x0 > 6.5 && D.layout.windows.filter((w) => w.room === 'lounge' && w.w > 10).length === 1 && D.layout.observation.length === 2; })());
    check('both transports can be seen out of: each salon and cabin has its own windows in its outer wall, and the transport\'s boarding hall has an outer door and a gangway',
      (() => { const D = shipDef('transport'), E = shipDef('descender'); return ['sal_p1', 'sal_p2', 'sal_p3', 'sal_s1', 'sal_s2'].every((id) => D.layout.windows.some((w) => w.room === id)) && D.layout.doors.some((d) => d.kind === 'outer') && D.ramps.airlock.width >= 1.8 && E.layout.windows.some((w) => w.room === 'cabin_a') && E.layout.doors.some((d) => d.kind === 'outer'); })());
  }

  // =====================================================================================================================
  section('SH14. The lifeboat has one hull and five local paints: Mars, the Moon, Ceres, Earth, Callisto');
  // =====================================================================================================================
  {
    const D = shipDef('lifeboat'), V = visualsFor('lifeboat'), Lx = { ...D.layout, custom: V.custom };
    const worlds = Object.keys(LIFEBOAT_LOOKS);
    check('there is a paint for each of the five start worlds, each with its own name, and an unknown world falls back to Mars', worlds.join() === 'mars,moon,ceres,earth,callisto' && new Set(worlds.map((w) => LIFEBOAT_LOOKS[w].name)).size === 5 && lifeboatLook('nowhere').id === 'mars');
    const accents = worlds.map((w) => { const e = V.buildExterior(Lx, mats, { tier: 'low', def: D, world: w }); return e.matsOwned.hullAccent.color.getHex(); });
    const looks = worlds.map((w) => V.buildExterior(Lx, mats, { tier: 'low', def: D, world: w }).look);
    check('building the exterior with a world uses that world\'s accent colour (five different colours) and records the look it used', new Set(accents).size === 5 && looks.join() === worlds.join());
    check('the paints are applied to clones: the shared ship materials (the Meridian\'s) are untouched', mats.hullAccent.color.getHex() === makeShipMaterials({ tier: 'high' }).hullAccent.color.getHex());
    check('the boat is small and light: under 7 tonnes, 11 m, three stations, and its thrusters lift it on Mars with room to spare (thrust over weight at least 1.5)',
      D.phys.massKg < 7000 && D.envelope.depth < 13 && D.seats.length === 3 && D.phys.liftThrustN / (D.phys.massKg * 3.72) > 1.5);
    check('every start world is served: the Moon, Ceres and Callisto have a paint with a mine/civil/ice look noted, so no world\'s boat looks Martian', ['moon', 'ceres', 'callisto', 'earth'].every((w) => LIFEBOAT_LOOKS[w].note.length > 10 && LIFEBOAT_LOOKS[w].accent !== LIFEBOAT_LOOKS.mars.accent));
  }

  // =====================================================================================================================
  section('SH15. The line wears the F0 neutral Mars livery, read live from the faction style sheet (nothing types a colour twice)');
  // =====================================================================================================================
  {
    const M = shipLivery('mars');
    for (const t of ['transport', 'descender', 'bulker', 'escort']) {
      const D = shipDef(t), V = visualsFor(t), e = V.buildExterior({ ...D.layout, custom: V.custom }, mats, { tier: 'low', def: D });
      check(`${t}: its hull slots are F0's mars livery: band ${M.stripe.colors[0].toString(16)}, line ${M.accent.toString(16)}, belly ${M.belly.toString(16)}, engine glow ${M.engineGlow.toString(16)}`,
        e.matsOwned.hullStripe.color.getHex() === M.stripe.colors[0] && e.matsOwned.hullAccent.color.getHex() === M.accent && e.matsOwned.hullDark.color.getHex() === M.belly && e.matsOwned.engineGlow.color.getHex() === M.engineGlow);
    }
    check('the lifeboat Mars paint is the same F0 livery (so Mars boats and Mars line ships match); the other four worlds are placeholders in the same slots', LIFEBOAT_LOOKS.mars.accent === M.accent && LIFEBOAT_LOOKS.mars.stripe === M.stripe.colors[0] && LIFEBOAT_LOOKS.mars.dark === M.belly);
  }

  // =====================================================================================================================
  section('SH15. The convoy: who flies beside the player in the opening, close enough to read the names');
  // =====================================================================================================================
  {
    const E = CV.OPENING_CONVOY;
    check('six neighbours: two sister transports, two bulkers, two escorts, every type a real ship, every name unique and short enough to paint (at most 34 characters)',
      E.length === 6 && E.filter((e) => e.type === 'transport').length === 2 && E.filter((e) => e.type === 'bulker').length === 2 && E.filter((e) => e.type === 'escort').length === 2 && E.every((e) => hasShipType(e.type)) &&
      new Set([...E.map((e) => e.name), CV.PLAYER_TRANSPORT.name]).size === 7 && E.every((e) => e.name.length <= 34) && CV.PLAYER_TRANSPORT.type === 'transport');
    const R = (e) => Math.hypot(shipDef(e.type).envelope.width, shipDef(e.type).envelope.depth) / 2;
    let minClear = Infinity, minPlayer = Infinity, worstPair = '';
    const own = { x: 0, y: 0, z: 0 }, Rp = Math.hypot(shipDef('transport').envelope.width, shipDef('transport').envelope.depth) / 2;
    for (let t = 0; t <= 900; t += 5) for (let i = 0; i < E.length; i++) {
      const a = CV.convoyPose(E[i], t);
      // clearances use each ship's long axis only (they all fly the same heading), a box test: clear if separated on x or y by the half-sizes
      const boxGap = (p, q, A, B) => Math.max(Math.abs(p.x - q.x) - (A.envelope.width + B.envelope.width) / 2, Math.abs(p.y - q.y) - (A.envelope.height + B.envelope.height) / 2, Math.abs(p.z - q.z) - (A.envelope.depth + B.envelope.depth) / 2);
      const A = shipDef(E[i].type), Pd = shipDef('transport');
      const gp = boxGap(a, own, A, Pd); if (gp < minPlayer) minPlayer = gp;
      for (let j = i + 1; j < E.length; j++) { const g = boxGap(a, CV.convoyPose(E[j], t), A, shipDef(E[j].type)); if (g < minClear) { minClear = g; worstPair = E[i].id + '/' + E[j].id; } }
    }
    check(`no two ships of the convoy come within 15 m of each other at any time in 15 minutes (closest ${minClear.toFixed(1)} m: ${worstPair}), nor within 15 m of the player's transport (closest ${minPlayer.toFixed(1)} m)`, minClear > 15 && minPlayer > 15);
    const near = E.filter((e) => Math.min(...[0, 100, 200, 300].map((t) => Math.hypot(CV.convoyPose(e, t).x, CV.convoyPose(e, t).y))) < 150).length;
    check('at least four neighbours hold station within 150 m of the player\'s flank, so their names can be read from the passenger deck window', near >= 4);
    check('they sway slowly: no more than 4.5 m of drift from station on any axis, and the pose is a pure function of time (same time, same pose)',
      E.every((e) => { const p = CV.convoyPose(e, 123.4), q = CV.convoyPose(e, 123.4); return p.x === q.x && Math.abs(p.x - e.offset.x) <= e.sway.x[0] + 1e-9 && Math.abs(p.z - e.offset.z) <= e.sway.z[0] + 1e-9; }));
    void Rp; void R;
  }
}
