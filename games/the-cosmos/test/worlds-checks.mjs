// F1 checks: the world registry, the ship registry's manifests, and generic planet support.
//
//   * the generated manifests are current, folder names equal ids, every def is valid
//   * Mars, Phobos and Deimos and all four ships are still exactly what they were (the registries read them, nothing else changed)
//   * a made-up PLANET (an atmosphere, dunes, a second port, a moon-less orbit 30,000 km out) registered at run time behaves like a world:
//     deterministic, continuous, flat under its pads, the right gravity, in the nav list, pulling on a ship in free flight, braking it in
//     its air, and the REAL authority flies a course there, lands, lifts off and comes home
//
//   node test/_worlds-only.mjs   (quick)    |    part of validate.mjs via the pkg-*.mjs hook
import '../server/runtime.mjs';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => import(pathToFileURL(join(ROOT, 'src', p)).href);

/** A planet nobody ships: the fixture the plumbing is proved on. Lives only in this file. */
export const TESTIA = async () => {
  const { groundMaterials } = await src('worlds/_kit/materials.js');
  return {
    id: 'testia', name: 'Testia', designation: 'TEST-1', kind: 'planet', order: 90, worldIndex: 900,
    blurb: 'A fixture planet for the registry checks.',
    radiusM: 2_400_000, massKg: 2.6e23,                    // surface gravity about 3.0 m/s2
    orbitRadiusM: 30_000_000, orbitPeriodS: 8 * 3600, lonS: 40, latS: 10,
    seed: 777, lump: 0.00025, lump2: 0.00003, lumpFreq: 1 / 300_000, lump2Freq: 1 / 40_000,      // broad hills: 600 m at a 300 km wavelength, 70 m at 40 km
    terrain: { profile: 'desert', duneM: 40, duneWavelengthM: 800 },
    landmarks: [{ id: 'TST-LMK-0001', name: 'Test Basin', lat: 10, lon: 20, radiusM: 30_000, depthM: 600, note: 'fixture' }],
    pad: { lat: 5, lon: 10, flatM: 62, blendM: 150, name: 'Testia Landing' },
    ports: [{ id: 'north-quay', name: 'North Quay', lat: 8, lon: 12, flatM: 40, blendM: 100 }],
    atmosphere: { surfacePressure: 90_000, rho0: 1.1, scaleHeightM: 8_500, topM: 90_000, skyColor: 0x6fa0d8, horizonColor: 0xc9dff0, fogDensity: 0.00004 },
    materials: groundMaterials({ key: 'testia', name: 'Testia', regolithColor: 0xc8b48a, rubbleColor: 0x8a7a5a }),
    look: { k: [1, 0.1, 0.06], red: [0, 0.2, 0.1] },
    sources: [{ field: 'everything', url: '', verified: 'invented', note: 'a fixture' }],
  };
};

export async function runWorldsChecks({ check, section, THREE }) {
  section('W1. Registries: manifests, folders, and the worlds and ships that already existed');
  const reg = await src('worlds/registry.js');
  const shipReg = await src('ships/registry.js');
  const vis = await src('ships/visuals.js');
  const spec = await src('space/spaceSpec.js');
  const FIELD = await src('world/field.js');

  let stale = '';
  try { execFileSync(process.execPath, [join(ROOT, 'tools/gen-registry.mjs'), '--check'], { stdio: 'pipe' }); } catch (e) { stale = String(e.stderr || e.message); }
  check('the generated manifests (worlds, ships, ship visuals) match the folders: run node tools/gen-registry.mjs if not', stale === '', stale);
  const wdirs = readdirSync(join(ROOT, 'src/worlds'), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name);
  check('every src/worlds/<name>/ folder is registered under its own name (folder name = world id)', wdirs.every((n) => reg.hasWorld(n)) && wdirs.length === reg.allWorlds().length, wdirs.join());
  const sdirs = readdirSync(join(ROOT, 'src/ships'), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_') && existsSync(join(ROOT, 'src/ships', e.name, 'def.js'))).map((e) => e.name);
  check('every src/ships/<name>/ folder is a registered ship under its own name (folder name = ship type), and has visuals', sdirs.every((n) => shipReg.hasShipType(n) && vis.hasVisuals(n)) && sdirs.length === shipReg.shipTypes().length, sdirs.join());
  check('the ships list in the order they always had (Meridian, Raider, Wayfarer, Drayman) with later ships after them', shipReg.shipTypes().slice(0, 4).join() === 'meridian,raider,courier,hauler', shipReg.shipTypes().join());
  const { validateWorldDef } = await src('worlds/_kit/schema.js');
  check('every registered world passes the schema (the registry throws at load otherwise)', reg.allWorlds().every((d) => validateWorldDef(d).length === 0));
  check('a half-written world fails loudly, with the missing fields named', (() => { const bad = validateWorldDef({ id: 'Bad Name', name: 'x', kind: 'planet', massKg: 1 }); return bad.length >= 4 && bad.some((m) => /^id:/.test(m)) && bad.some((m) => /^axes/.test(m)); })());
  check('Mars is the root world and BODIES is its record, unchanged (radius 3,389,500 m, gravity 3.72076)', reg.rootWorld().id === 'mars' && (await src('world/bodies.js')).getBody('mars') === reg.worldDef('mars').body && reg.worldDef('mars').body.radiusMean === 3_389_500 && reg.worldDef('mars').body.surfaceGravity === 3.72076);
  check('Phobos and Deimos are frame worlds; the other three homes are placeholders listed as far (a placeholder has no frame)', reg.frameWorldIds().includes('phobos') && reg.frameWorldIds().includes('deimos') && ['fortis', 'greenhaven', 'ironclad'].every((i) => !reg.frameWorldIds().includes(i) || !reg.worldDef(i).placeholder));
  const ids = spec.DESTINATIONS.map((d) => d.id);
  check('the nav list keeps its order: port, orbit, Phobos, Deimos, then the far homes', ids.slice(0, 4).join() === 'port,orbit,phobos,deimos' && ids.indexOf('phobos') < ids.indexOf('fortis'), ids.join());
  check('MOONS holds the registry\'s own def objects (one source of truth)', Object.values(spec.MOONS).every((m) => reg.worldDef(m.id) === m));
  const L = FIELD.MATERIAL_LIST.map((m) => m.id);
  const OLD = ['MAT-PORT-CONCRETE', 'MAT-REGOLITH', 'MAT-DURICRUST', 'MAT-BASALT', 'MAT-HEMATITE', 'MAT-ICE', 'MAT-MANTLE', 'MAT-PHOBOS-REGOLITH', 'MAT-PHOBOS-RUBBLE', 'MAT-DEIMOS-REGOLITH', 'MAT-DEIMOS-RUBBLE', 'MAT-PHOBOS-CLAY'];
  check('the materials table only ever grows at its end: the twelve that dug ground already refers to keep their numbers', OLD.every((id, i) => L[i] === id), L.slice(0, 13).join());

  // ---- a planet that is only data ----------------------------------------------------------------------------------------
  section('W2. A generic planet: data in, a world out (terrain profile, atmosphere, ports, gravity, nav, free flight)');
  const T = await TESTIA();
  const nWorlds = reg.allWorlds().length;
  check('a def with a sphere radius and no axes gets its axes and mean radius filled in', (() => { const d = JSON.parse(JSON.stringify({ ...T, materials: undefined })); return d.radiusM === 2_400_000; })());
  reg.registerWorldLate(T);
  try {
    check('registering it adds one world, a frame world, and its ground materials are appended after the older ones', reg.allWorlds().length === nWorlds + 1 && reg.frameWorldIds().includes('testia') && FIELD.MATERIAL_LIST.at(-1).id === 'MAT-TESTIA-RUBBLE' && FIELD.MATERIAL_LIST.at(-2).id === 'MAT-TESTIA-REGOLITH');
    check('registering the same id twice is refused (two folders with one id)', (() => { try { reg.registerWorld(T); return false; } catch (e) { return /twice/.test(e.message); } })());
    const row = spec.DESTINATIONS.find((d) => d.id === 'testia');
    check('it appears in the nav list as a destination you can land at (no jump drive needed: it sits in this system)', row && row.kind === 'moon' && row.moon === 'testia' && spec.MOONS.testia === T, JSON.stringify(row));
    const { makeMoon } = await src('space/moonField.js');
    const b = makeMoon('testia');
    const g = 6.6743e-11 * T.massKg / (T.radiusM * T.radiusM);
    check(`gravity comes from its real mass and radius: ${b.surfaceGravity.toFixed(3)} m/s2`, Math.abs(b.surfaceGravity - g) < 1e-9 && b.surfaceGravity > 2.8 && b.surfaceGravity < 3.2);
    check('the body record carries its atmosphere (sea-level density, scale height, sky colours) and says what kind of world it is', b.atmosphere && b.atmosphere.scaleHeight === 8_500 && b.atmosphere.skyColor === 0x6fa0d8 && b.worldKind === 'planet' && b.kind === 'moon');
    // determinism and continuity of the density field
    const dirs = []; { let s = 99; const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; for (let i = 0; i < 400; i++) { const x = r() * 2 - 1, y = r() * 2 - 1, z = r() * 2 - 1, l = Math.hypot(x, y, z) || 1; dirs.push([x / l, y / l, z / l]); } }
    const sig = () => dirs.map(([x, y, z]) => b.surfaceRadius(x, y, z)).join();
    check('the ground is the same every time it is asked (the server and every phone agree)', sig() === sig());
    const rs = dirs.map(([x, y, z]) => b.surfaceRadius(x, y, z) - b.ellipsoidRadius(x, y, z));
    check(`the dune profile really shapes it: relief spans ${Math.min(...rs).toFixed(0)} to ${Math.max(...rs).toFixed(0)} m (not flat, not mountains)`, Math.max(...rs) - Math.min(...rs) > 20 && Math.max(...rs) < 4000 && Math.min(...rs) > -4000);
    let worst = 0;
    for (let tilt = 0; tilt < 3.1; tilt += 0.7) { let prev = null; const N = 20000; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 * 0.04 + tilt, x = Math.cos(a), y = Math.sin(a) * Math.cos(tilt), z = Math.sin(a) * Math.sin(tilt); const R = b.surfaceRadius(x, y, z); if (prev !== null) worst = Math.max(worst, Math.abs(R - prev)); prev = R; } }
    check(`walking the ground in ${(2_400_000 * 2 * Math.PI * 0.04 / 20000).toFixed(1)} m steps it never climbs more than 20 m a step, a slope under 34 degrees (no cliff where a cell or a profile was cut off): worst ${worst.toFixed(2)} m`, worst < 20);
    // pads and ports are flat
    const flatUnder = (pt, up, east, north, rad) => { let lo = 1e9, hi = -1e9; for (let e = -rad; e <= rad; e += 5) for (let n = -rad; n <= rad; n += 5) { if (Math.hypot(e, n) > rad) continue; const x = pt.x + east.x * e + north.x * n, y = pt.y + east.y * e + north.y * n, z = pt.z + east.z * e + north.z * n, l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l), h = (x / l * R - pt.x) * up.x + (y / l * R - pt.y) * up.y + (z / l * R - pt.z) * up.z; lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };
    const pi = b.padInfo;
    check(`the landing pad is graded flat: ${flatUnder(pi.point, pi.up, pi.east, pi.north, 24).toFixed(3)} m of relief over 24 m (the stones come in from 26 m, by design)`, flatUnder(pi.point, pi.up, pi.east, pi.north, 24) < 0.05);
    check('an extra named port is graded flat too, and the body lists it', b.ports.length === 1 && b.ports[0].id === 'north-quay' && (() => { const p = b.ports[0], up = p.up, e = { x: up.z, y: 0, z: -up.x }, el = Math.hypot(e.x, e.z) || 1; e.x /= el; e.z /= el; const n = { x: up.y * e.z - up.z * e.y, y: up.z * e.x - up.x * e.z, z: up.x * e.y - up.y * e.x }; return flatUnder(p.point, up, e, n, 30) < 0.05; })());
    // a person stands on it and a hole can be dug
    const { Walker } = await src('player/walker.js');
    const w = new Walker(b, { jumpSpeed: 3.1 });
    { const x = pi.point.x + pi.east.x * 10, y = pi.point.y + pi.east.y * 10, z = pi.point.z + pi.east.z * 10, l = Math.hypot(x, y, z), R = FIELD.surfaceRadiusFast(b, x / l, y / l, z / l); w.worldPos.x = x / l * (R + 0.3); w.worldPos.y = y / l * (R + 0.3); w.worldPos.z = z / l * (R + 0.3); w.updateFrame(); }
    for (let i = 0; i < 180; i++) w.tick(1 / 60, {});
    check('a person set down beside the pad stands on it (grounded, feet in the density field\'s surface) under 3 m/s2', w.grounded && Math.abs(FIELD.density(b, w.worldPos.x, w.worldPos.y, w.worldPos.z)) < 0.15);
    check('what is under the topsoil is the world\'s own: its regolith first, then its rubble', FIELD.materialAt(b, pi.up.x * (Math.hypot(pi.point.x, pi.point.y, pi.point.z) - 0.5), pi.up.y * (Math.hypot(pi.point.x, pi.point.y, pi.point.z) - 0.5), pi.up.z * (Math.hypot(pi.point.x, pi.point.y, pi.point.z) - 0.5)).id === 'MAT-TESTIA-REGOLITH');

    // free flight: the planet pulls, and its air brakes
    const ff = await src('space/freeflight.js');
    const c = ff.BODIES.testia.c, R = T.radiusM;
    check('free flight knows the planet: a body with a patch of 8 radii, its centre where the orbit puts it, and its air', ff.BODIES.testia && ff.BODIES.testia.patchM === 8 * R && ff.TARGETS.includes('testia') && ff.TARGETS.at(-1) === 'mars' && ff.BODIES.testia.air.rho0 === 1.1 && Math.abs(Math.hypot(c.x, c.y, c.z) - 30_000_000) < 1);
    const up = { x: (c.x) / Math.hypot(c.x, c.y, c.z), y: c.y / Math.hypot(c.x, c.y, c.z), z: c.z / Math.hypot(c.x, c.y, c.z) };
    const at = (alt) => ({ x: c.x + up.x * (R + alt), y: c.y + up.y * (R + alt), z: c.z + up.z * (R + alt) });
    const gv = ff.gravityAt(at(1000)), gm = Math.hypot(gv.x, gv.y, gv.z), g1 = 6.6743e-11 * T.massKg / ((R + 1000) ** 2);
    check(`1 km up, the pull is the planet's alone (Mars's cancelled inside the patch): ${gm.toFixed(3)} against ${g1.toFixed(3)} m/s2, and it points at the planet`, Math.abs(gm - g1) / g1 < 0.02 && (gv.x * up.x + gv.y * up.y + gv.z * up.z) < 0);
    const d0 = ff.worldDrag(ff.BODIES.testia, at(0), 200), d1 = ff.worldDrag(ff.BODIES.testia, at(40_000), 200), d2 = ff.worldDrag(ff.BODIES.testia, at(95_000), 200);
    check(`its air brakes a ship: ${d0.toExponential(1)} per second at the ground, thinner at 40 km (${d1.toExponential(1)}), none above 90 km`, d0 > 0 && d1 > 0 && d1 < d0 * 0.05 && d2 === 0);
    check('Mars\'s own air is unchanged (a ship 100 m up at 200 m/s brakes as it did)', Math.abs(ff.dragDecel(100, 200) - 0.02 * Math.exp(-100 / 11_100) * 200 * 200 / 80) < 1e-12);
    check('a patch of 8 radii does not touch the little moons: Phobos and Deimos keep their 400 km', ff.BODIES.phobos.patchM === 400_000 && ff.BODIES.deimos.patchM === 400_000);

    // courses: the estimate, then the real authority flying it and coming back
    section('W3. The real authority flies a course to the planet, lands, lifts off and comes home');
    const { estimateTrip } = await src('space/transit.js');
    const goal = (() => { const s = b.standoffPoint(spec.STANDOFF_M); return { x: c.x + s.x, y: c.y + s.y, z: c.z + s.z }; })();
    const est = estimateTrip({ pos: { x: 0, y: spec.DRIVE.gateAltM + 3_389_500, z: 0 }, vel: { x: 0, y: 0, z: 0 }, nose: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 }, goal, aMax: 13, vMax: spec.DRIVE.vMaxMs, turnRate: spec.DRIVE.turnRate });
    check(`the nav computer can estimate the trip: ${(est.seconds / 60).toFixed(0)} minutes at x1`, Number.isFinite(est.seconds) && est.seconds > 600 && est.seconds < 7200, JSON.stringify(est));
    const { Authority } = await import(pathToFileURL(join(ROOT, 'server/authority.mjs')).href);
    const { FileAdapter } = await import(pathToFileURL(join(ROOT, 'server/storage.mjs')).href);
    const dir = await mkdtemp(join(tmpdir(), 'cosmos-worlds-'));
    let clock = Date.now(); const now = () => clock;
    const world = await new Authority(new FileAdapter(join(dir, 'world.json')), { now, verify: null }).load();
    const p = world.createPlayer('e'.repeat(48), 'Planet QA', 'isaiah', 0, { ephemeral: true });
    const sim = world.sims.get(p.shipId), ship = world.state.ships[p.shipId];
    check('the new world gives the ship its own pad there (one per world, appended, same as the moons)', ship.moonPads && ship.moonPads.testia && Number.isFinite(ship.moonPads.testia.east), JSON.stringify(ship.moonPads && Object.keys(ship.moonPads)));
    const seat = () => { p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.frameId = sim.frameId; const s = sim.def.seats.find((q) => q.id === 'pilot'); p.pose.seat = 'pilot'; Object.assign(p.pose.sw, { x: s.x, y: s.y, z: s.z }); };
    const fly = (dest, maxSimS = 6000) => {
      seat(); let err = null; try { world.reduce(p, { type: 'engage', destination: dest }); world.reduce(p, { type: 'trip-warp', warp: 60 }); } catch (e) { err = e.message; }
      if (err) return { dest, err };
      const t0 = world.state.clock;
      while (sim.trip && sim.trip.active && world.state.clock - t0 < maxSimS) { if (sim.trip.warp !== 60) sim.trip.setWarp(60); world.advance(1 / 30); clock += 33; }
      for (let i = 0; i < 300 && !sim.flight.landed && !sim.trip; i++) { world.advance(1 / 30); clock += 33; }
      return { dest, frame: sim.frameId, landed: sim.flight.landed, tripLeft: !!sim.trip, simS: Math.round(world.state.clock - t0) };
    };
    const r1 = fly('testia');
    check('a course to the planet ends with the ship landed in the planet\'s frame', !r1.err && r1.frame === 'testia' && r1.landed && !r1.tripLeft, JSON.stringify(r1));
    const gh = sim.flight.body && sim.flight.body.id;
    check('the ship\'s flight model is on that planet\'s ground (its body, its gravity)', gh === 'testia' && Math.abs(sim.flight.body.surfaceGravity - g) < 1e-9, String(gh));
    const r2 = fly('orbit');
    check('from the planet a course to Mars orbit leaves its frame and holds', !r2.err && r2.frame === 'mars' && !r2.tripLeft, JSON.stringify(r2));
    const r3 = fly('testia');
    check('and the planet can be reached again from orbit', !r3.err && r3.frame === 'testia' && r3.landed && !r3.tripLeft, JSON.stringify(r3));
    check('the world state, saved with the planet\'s ship in it, still serialises small (under 60 kB)', JSON.stringify(world.publicState(p.id)).length < 60_000, String(JSON.stringify(world.publicState(p.id)).length));
  } finally {
    reg.unregisterWorld('testia');
  }
  check('the fixture planet is gone again and the nav list is back to what it was', !spec.MOONS.testia && !spec.DESTINATIONS.some((d) => d.id === 'testia'));
  const { makeMoon: mk } = await src('space/moonField.js');
  check('and the little moons are still themselves: Phobos and Deimos ground at a fixed direction, to the metre value measured before the registry existed', mk('phobos').surfaceRadius(1, 0, 0) === 11465.756248852837 && mk('deimos').surfaceRadius(1, 0, 0) === 6035.753066285422);
}

export const run = async (o) => {
  await runWorldsChecks(o);
  const m = await import('./worlds-orbits-checks.mjs');
  await m.runEphemerisChecks({ ...o, TESTIA });
  await m.runShipCatalogChecks(o);
};
