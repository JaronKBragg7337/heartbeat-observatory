// F1 checks, part 2: orbits and rotation as data (the real Solar System), stations as places, the drive's range and jump lanes, and
// ships rich enough for a shipyard card. Called from worlds-checks.mjs (`run`), so validate.mjs needs no edit.
import '../server/runtime.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => import(pathToFileURL(join(ROOT, 'src', p)).href);

/** W4: orbits, rotation, the real Solar System, and the switch that keeps it all still for now. */
export async function runEphemerisChecks({ check, section, TESTIA }) {
  section('W4. Orbits and rotation as data: Kepler, the real planets, the Sun at the root, and the switch that holds everything still');
  const reg = await src('worlds/registry.js');
  const E = await src('worlds/_kit/ephemeris.js');
  const { SOLAR } = await src('worlds/_kit/solar.js');
  const AU = E.AU, lookup = reg.worldDef;
  const dist = (v) => Math.hypot(v.x, v.y, v.z);
  const groundMaterialsOf = (T, key) => ({ regolith: { ...T.materials.regolith, id: `MAT-${key.toUpperCase()}-REGOLITH` }, rubble: { ...T.materials.rubble, id: `MAT-${key.toUpperCase()}-RUBBLE` } });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

  check('Kepler\'s equation is solved to 1e-12 for every eccentricity from a circle to 0.9', (() => { let worst = 0; for (const e of [0, 0.01, 0.1, 0.5, 0.9]) for (let k = -12; k <= 12; k++) { const M = k * 0.5, Ea = E.solveKepler(M, e), wrapM = Math.atan2(Math.sin(M), Math.cos(M)); worst = Math.max(worst, Math.abs(Ea - e * Math.sin(Ea) - wrapM)); } return worst < 1e-12; })());
  check('the switches are ON (F2): worlds orbit and Mars turns; the Sun is in the registry as the root of every orbit', E.DYNAMICS.orbits === true && E.DYNAMICS.rotation === true && reg.worldDef('sun').kind === 'star' && reg.worldDef('mars').orbit.parent === 'sun');
  const periodD = (id) => E.periodOf(lookup(id).orbit, E.MU_SUN) / 86400;
  check(`periods come from the Sun's mass and the semi-major axis: Mars ${periodD('mars').toFixed(1)} d (real 686.98), Earth ${periodD('earth').toFixed(2)} d (365.26), Jupiter ${(periodD('jupiter') / 365.25).toFixed(2)} y (11.86)`, Math.abs(periodD('mars') - 686.98) < 0.5 && Math.abs(periodD('earth') - 365.26) < 0.2 && Math.abs(periodD('jupiter') / 365.25 - 11.86) < 0.02);

  try {
    const mars = lookup('mars');
    let lo = 1e30, hi = 0; const T = E.periodOf(mars.orbit, E.MU_SUN);
    for (let k = 0; k < 720; k++) { const r = Math.hypot(...E.orbitPosition(mars.orbit, E.MU_SUN, k / 720 * T)) / AU; lo = Math.min(lo, r); hi = Math.max(hi, r); }
    check(`Mars goes round the Sun between ${lo.toFixed(3)} and ${hi.toFixed(3)} AU (perihelion 1.381, aphelion 1.666)`, Math.abs(lo - 1.381) < 0.004 && Math.abs(hi - 1.666) < 0.004);
    // Earth-Mars distance on dates anyone can look up (JD 2459128.5 = 6 Oct 2020, 2459526.5 = 8 Nov 2021, 2459921.5 = 8 Dec 2022)
    const sep = (jd) => dist(reg.worldCentre('earth', (jd - E.START_JD) * 86400)) / AU;
    const a = sep(2459128.5), b = sep(2459526.5), c = sep(2459921.5);
    check(`from Mars, Earth is ${a.toFixed(3)} AU away at the closest approach of 6 October 2020 (real 0.415), ${b.toFixed(2)} AU at the solar conjunction of 8 November 2021 (about 2.6), ${c.toFixed(3)} AU at the opposition of 8 December 2022 (about 0.54)`, a > 0.405 && a < 0.43 && b > 2.4 && b < 2.75 && c > 0.52 && c < 0.57, [a, b, c].join());
    const moonAt = (jd) => { const t = (jd - E.START_JD) * 86400; return dist(sub(reg.worldCentre('moon', t), reg.worldCentre('earth', t))); };
    let mlo = 1e30, mhi = 0; for (let d = 0; d < 28; d += 0.25) { const r = moonAt(2461316.5 + d); mlo = Math.min(mlo, r); mhi = Math.max(mhi, r); }
    check(`the Moon, a moon of a planet (a nested orbit, parent earth), stays between ${(mlo / 1e6).toFixed(0)} and ${(mhi / 1e6).toFixed(0)} thousand km of the Earth (real 356 to 407)`, mlo > 3.45e8 && mhi < 4.15e8);
    const ph = lookup('phobos'), P = E.periodOf(ph.orbit, 6.6743e-11 * 6.417e23), c0 = reg.worldCentreInertial('phobos', 0), c1 = reg.worldCentreInertial('phobos', P), c2 = reg.worldCentreInertial('phobos', P / 2);
    check(`with the switch on Phobos is back where it started after one period (${(P / 3600).toFixed(2)} h) and on the far side after half`, dist(sub(c0, c1)) < 5 && dist({ x: c0.x + c2.x, y: c0.y + c2.y, z: c0.z + c2.z }) < 5);
    const day = 360 / E.ROOT_POLE.rotationDegPerDay * 86400;           // Mars's sidereal day, from the IAU rate
    const q = (E.rootSpin(day / 4) - E.rootSpin(0) + 4 * Math.PI) % (2 * Math.PI), full = Math.abs(((E.rootSpin(day) - E.rootSpin(0) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    check('with rotation on, Mars turns a quarter turn in a quarter of its sidereal day (88,642.66 s, the IAU rate) and a whole turn in a day', Math.abs(q - Math.PI / 2) < 1e-9 && full < 1e-9, `${q} ${full}`);
  } finally { /* the switches stay on */ }
  // the static checks below want the sky still: the switches off for a moment (and put back)
  E.DYNAMICS.orbits = false; E.DYNAMICS.rotation = false;
  const e0 = reg.worldCentre('earth', 0), e1 = reg.worldCentre('earth', 1e9);
  check('with the switch off a world sits still: asked a thousand million seconds later, Earth is in the same place, 0.4 to 2.7 AU from Mars', dist(sub(e0, e1)) === 0 && dist(e0) / AU > 0.4 && dist(e0) / AU < 2.7);
  check('Phobos, parked, is bit-for-bit where the old equatorial() put it (no 2e11 m minus 2e11 m)', (() => { const p = reg.worldCentre('phobos'), lon = -109 * (Math.PI / 180), r = 9_376_000; return p.x === r * Math.cos(lon) && p.y === 0 && p.z === -r * Math.sin(lon); })());
  check('the ecliptic-to-game rotation keeps lengths and handedness (a rotation, not a reflection)', (() => { const u = E.eclipticToGame([1, 0, 0]), v = E.eclipticToGame([0, 1, 0]), w = E.eclipticToGame([0, 0, 1]); const cross = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x }; return Math.abs(dist(u) - 1) < 1e-12 && Math.abs(dist(v) - 1) < 1e-12 && Math.abs(cross.x - w.x) + Math.abs(cross.y - w.y) + Math.abs(cross.z - w.z) < 1e-12; })());
  check('the real planets are in the registry as placeholders with their real orbits (Mercury to Neptune, Earth, the Moon), kept out of the nav list until built', ['mercury', 'venus', 'earth', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon'].every((i) => reg.worldDef(i).placeholder && reg.worldDef(i).orbit && reg.worldDef(i).nav === false));
  check('the Sun has the real mass: GM from it matches the standard 1.327e20 m3/s2 to a part in a thousand', Math.abs(6.6743e-11 * SOLAR.sun.massKg / E.MU_SUN - 1) < 1e-3);
  check('a world with a full orbit (not the parked shorthand) gets its place from the orbit, and its body axes follow: a circular equatorial orbit at 40 degrees sits where the shorthand puts 40 degrees', (() => {
    const base = { id: 'orbtest', name: 'Orbtest', kind: 'planet', placeholder: true, blurb: 'fixture', orbit: { parent: 'mars', frame: 'equator', a: 2e7, e: 0, i: 0, node: 0, peri: 0, M0: 40, periodS: 5e4 } };
    reg.registerWorldLate(base);
    try { const c = reg.worldCentre('orbtest'), lon = 40 * Math.PI / 180; return Math.abs(c.x - 2e7 * Math.cos(lon)) < 1e-6 && Math.abs(c.z + 2e7 * Math.sin(lon)) < 1e-6 && Math.abs(c.y) < 1e-6 && Math.abs(reg.worldPlacement('orbtest').lonS - 40) < 1e-9; }
    finally { reg.unregisterWorld('orbtest'); }
  })());
  check('an orbit whose parent chain never reaches the Sun is refused when asked for a place, with the broken link named', (() => { reg.registerWorldLate({ id: 'orphan', name: 'Orphan', kind: 'planet', placeholder: true, blurb: 'fixture', orbit: { parent: 'nowhere', a: 1e9, e: 0, i: 0, node: 0, peri: 0, M0: 0 } }); try { reg.worldCentre('orphan'); return false; } catch (e) { return /nowhere|unknown world/.test(e.message); } finally { reg.unregisterWorld('orphan'); } })());

  check('a ground world written with a full `orbit` is the same world as one written with the parked shorthand: same body axes, same ground at 200 directions, same centre', await (async () => {
    const T = await TESTIA(), { makeMoon } = await src('space/moonField.js');
    const legacy = { ...T, id: 'eqlegacy', name: 'Eqlegacy', worldIndex: 910, latS: 0, materials: groundMaterialsOf(T, 'eqlegacy') };
    const full = { ...T, id: 'eqorbit', name: 'Eqorbit', worldIndex: 911, materials: groundMaterialsOf(T, 'eqorbit') };
    for (const d of [legacy, full]) { delete d.latS; }
    delete full.orbitRadiusM; delete full.lonS; delete full.orbitPeriodS;
    full.orbit = { parent: 'mars', frame: 'equator', a: T.orbitRadiusM, e: 0, i: 0, node: 0, peri: 0, M0: T.lonS, periodS: T.orbitPeriodS };
    reg.registerWorldLate(legacy); reg.registerWorldLate(full);
    try {
      const a = makeMoon('eqlegacy'), b = makeMoon('eqorbit');
      let same = 0, n = 0; for (let k = 0; k < 200; k++) { const u = Math.sin(k * 12.9898) * 43758.5453, v = Math.sin(k * 78.233) * 12345.6789, w = Math.sin(k * 3.17) * 999.1; const l = Math.hypot(u % 1 - 0.5, v % 1 - 0.5, w % 1 - 0.5) || 1, x = (u % 1 - 0.5) / l, y = (v % 1 - 0.5) / l, z = (w % 1 - 0.5) / l; n++; if (Math.abs(a.surfaceRadius(x, y, z) - b.surfaceRadius(x, y, z)) < 1e-6) same++; }
      const ca = a.centre, cb = b.centre;
      return same === n && Math.abs(ca.x - cb.x) < 1e-3 && Math.abs(ca.z - cb.z) < 1e-3 && Math.abs(reg.worldPlacement('eqorbit').lonS - T.lonS) < 1e-9;
    } finally { reg.unregisterWorld('eqlegacy'); reg.unregisterWorld('eqorbit'); }
  })());

  // ---- stations, range, jump -----------------------------------------------------------------------------------------------
  E.DYNAMICS.orbits = true; E.DYNAMICS.rotation = true;            // the station flight below is flown in the live sky
  section('W5. Stations as places, the drive\'s range, and a jump lane: the registry lists them honestly and the real authority flies to a station');
  const spec = await src('space/spaceSpec.js');
  const { validateWorldDef } = await src('worlds/_kit/schema.js');
  const { groundMaterials } = await src('worlds/_kit/materials.js');
  const station = { id: 'teststation', name: 'Test Station', kind: 'station', order: 91, blurb: 'A fixture station.', radiusM: 600, docks: [{ id: 'd1', name: 'Dock 1', pos: { x: 0, y: 0, z: 650 }, dir: { x: 0, y: 0, z: 1 }, sizeClass: 'M' }],
    gravity: 'spin', orbit: { parent: 'mars', offset: { x: 12_000_000, y: 800_000, z: -2_000_000 } } };
  const far = { id: 'testfar', name: 'Testfar', kind: 'planet', placeholder: false, order: 92, blurb: 'beyond range', ...(await TESTIA()), worldIndex: 902, orbitRadiusM: 4e9, materials: groundMaterials({ key: 'testfar', name: 'Testfar', regolithColor: 0x777777 }) };
  far.id = 'testfar'; far.name = 'Testfar'; far.order = 92;
  const jumpy = { ...far, id: 'testjump', name: 'Testjump', order: 93, worldIndex: 903, jump: true, materials: groundMaterials({ key: 'testjump', name: 'Testjump', regolithColor: 0x555555 }) };
  const probs = validateWorldDef({ id: 'x', name: 'X', kind: 'station', radiusM: 10 });
  check('a half-written station fails with docks, gravity and orbit named', probs.some((m) => /^docks/.test(m)) && probs.some((m) => /^gravity/.test(m)) && probs.some((m) => /^orbit/.test(m)), probs.join(' | '));
  reg.registerWorldLate(station); reg.registerWorldLate(far); reg.registerWorldLate(jumpy);
  try {
    const row = spec.DESTINATIONS.find((d) => d.id === 'teststation');
    check('a station is a destination of its own kind, with its own id (it is not a moon and has no frame)', row && row.kind === 'station' && row.station === 'teststation' && !spec.MOONS.teststation && spec.STATION_IDS.includes('teststation'), JSON.stringify(row));
    check('a station\'s centre is where its orbit puts it: hung beside Mars at the stated offset', (() => { const c = reg.worldCentre('teststation'); return c.x === 12_000_000 && c.y === 800_000 && c.z === -2_000_000; })());
    const f = spec.DESTINATIONS.find((d) => d.id === 'testfar'), j = spec.DESTINATIONS.find((d) => d.id === 'testjump');
    check('a world beyond the drive\'s range (4 million km here) is listed far with the distance said; one with a jump lane is a destination marked jump', f && f.kind === 'far' && /AU away/.test(f.blurb) && j && j.kind === 'moon' && j.jump === true, JSON.stringify([f, j]));
    const ff = await src('space/freeflight.js');
    check('free flight can target a station (bearing and distance) but it never pulls and is never a ground', ff.BODIES.teststation && ff.BODIES.teststation.station && ff.TARGETS.includes('teststation') && !ff.PHYS_LIST.some((b) => b.id === 'teststation') && !ff.MOON_LIST.some((b) => b.id === 'teststation'));
    const { estimateTrip } = await src('space/transit.js');
    const t0 = Date.now(), long = estimateTrip({ pos: { x: 0, y: 3_500_000, z: 0 }, vel: { x: 0, y: 0, z: 0 }, nose: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 }, goal: { x: 1e10, y: 0, z: 0 }, aMax: 13, vMax: spec.DRIVE.vMaxMs, turnRate: 0.12 });
    check(`the nav computer estimates a trip of 10 million km (${(long.seconds / 86400).toFixed(1)} days) at once, not by flying a million steps (${Date.now() - t0} ms)`, Date.now() - t0 < 200 && long.seconds > 3 * 86400 && long.closedForm === true);

    const { Authority } = await import(pathToFileURL(join(ROOT, 'server/authority.mjs')).href);
    const { FileAdapter } = await import(pathToFileURL(join(ROOT, 'server/storage.mjs')).href);
    const dir = await mkdtemp(join(tmpdir(), 'cosmos-station-'));
    let clock = Date.now(); const now = () => clock;
    const world = await new Authority(new FileAdapter(join(dir, 'world.json')), { now, verify: null }).load();
    const p = world.createPlayer('f'.repeat(48), 'Station QA', 'isaiah', 0, { ephemeral: true });
    const sim = world.sims.get(p.shipId), ship = world.state.ships[p.shipId];
    p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.frameId = sim.frameId; const s2 = sim.def.seats.find((q) => q.id === 'pilot'); p.pose.seat = 'pilot'; Object.assign(p.pose.sw, { x: s2.x, y: s2.y, z: s2.z });
    let err = null; try { world.reduce(p, { type: 'engage', destination: 'teststation' }); world.reduce(p, { type: 'trip-warp', warp: 60 }); } catch (e) { err = e.message; }
    const t1 = world.state.clock;
    while (!err && sim.trip && sim.trip.active && world.state.clock - t1 < 6000) { if (sim.trip.warp !== 60) sim.trip.setWarp(60); world.advance(1 / 30); clock += 33; }
    for (let i = 0; i < 300 && sim.trip; i++) { world.advance(1 / 30); clock += 33; }
    const c = reg.worldCentre('teststation'), pos = sim._shipS(), off = Math.hypot(pos.x - c.x, pos.y - c.y, pos.z - c.z);
    check(`the real authority flies a course to the station and holds ${Math.round(off)} m off it (3 radii and a margin = 2300 m), in Mars's frame, not landed, the trip ended`, !err && !sim.trip && sim.frameId === 'mars' && Math.abs(off - 2300) < 80 && !sim.flight.landed, `${err || ''} off ${off} frame ${sim.frameId} trip ${!!sim.trip}`);
  } finally { reg.unregisterWorld('teststation'); reg.unregisterWorld('testfar'); reg.unregisterWorld('testjump'); }
  check('the fixtures are gone again: no stations, no extra frame worlds in the registry\'s tables', !spec.STATION_IDS.length && !spec.MOONS.testjump && !spec.MOONS.testfar);
}

/** W6: ships carry what a shop prints. */
export async function runShipCatalogChecks({ check, section }) {
  section('W6. Ships: every entry is rich enough for a shipyard card (name, class, role, blurb, description, picture, price, stats)');
  const { shipCatalog, allShipDefs } = await src('ships/registry.js');
  const { shopCards } = await src('ships/shipyard.js');
  const { validateShipDef } = await src('ships/_kit/schema.js');
  const cards = shipCatalog();
  check('every ship has a name, class, role, a short blurb, a real description, stats, specs and a registry id', cards.every((c) => c.name && c.class && c.role && c.blurb.length >= 20 && c.description.length >= 80 && c.stats.crewMax > 0 && c.stats.cargoKg > 0 && c.specs.lengthM > 5 && c.specs.massKg > 1000 && c.registryId), cards.map((c) => c.type).join());
  check('the shipyard shows the ships that have a price, in order (the starter Wayfarer is not for sale), each with the price the server charges', shopCards().slice(0, 3).map((c) => c.type).join() === 'meridian,raider,hauler' && shopCards().every((c) => c.priceCredits > 0));
  check('a ship with no description, no stats and a bad role is refused at load with the missing parts named', (() => { const d = { ...allShipDefs()[0], description: 'short', stats: {}, role: 'nope' }; const bad = validateShipDef(d); return bad.length >= 3 && bad.some((m) => /^description/.test(m)) && bad.some((m) => /^role/.test(m)) && bad.some((m) => /^stats/.test(m)); })());
  check('a thumbnail is optional but, if named, must live under assets/ (the shipyard draws the ship from its visuals when there is none)', validateShipDef({ ...allShipDefs()[0], thumbnail: '/etc/passwd' }).some((m) => /^thumbnail/.test(m)) && validateShipDef({ ...allShipDefs()[0], thumbnail: 'assets/ships/x.webp' }).length === 0);
}
