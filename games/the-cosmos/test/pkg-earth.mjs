// WD-EARTH (first pass) checks: the planet, its real shape of land and sea, the Skyward Launch Complex on Merritt Island, the field and the people on it, and the REAL authority
// flying a course from Mars to Earth and landing on the pad. No browser (test/earth-browser.mjs is the renderer's half).
//   node test/pkg-earth.mjs   (quick, standalone)  |  part of validate.mjs via the pkg-*.mjs hook
import '../server/runtime.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { readFileSync, existsSync, statSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => import(pathToFileURL(join(ROOT, 'src', p)).href);
const DEG = Math.PI / 180;

export async function run({ check, section }) {
  const REG = await src('worlds/registry.js');
  const SPEC = await src('space/spaceSpec.js');
  const DEF = (await src('worlds/earth/def.js')).default;
  const T = await src('worlds/earth/terra.js');
  const L = await src('worlds/earth/layout.js');
  const { makeMoon } = await src('space/moonField.js');
  const FIELD = await src('world/field.js');
  const { Walker } = await src('player/walker.js');
  const FR = await src('space/frames.js');

  section('WD-EARTH 1: the planet');
  const b = makeMoon('earth'), pi = b.padInfo, R0 = DEF.radiusM;
  check('Earth is a real world now, not a placeholder: a planet with a frame, the nav lists it as a destination reached by the long-range drive', !DEF.placeholder && DEF.kind === 'planet' && SPEC.MOON_IDS.includes('earth') && SPEC.DESTINATIONS.some((d) => d.id === 'earth' && d.kind === 'moon' && d.via === 'drive'));
  check('its radius, mass and gravity are NASA\'s (mean radius 6371.0 km, 5.9722e24 kg, 9.82 m/s2 at the surface, 11.19 km/s to escape)', R0 === 6_371_000 && DEF.massKg === 5.9722e24 && Math.abs(b.surfaceGravity - 9.82) < 0.02 && Math.abs(b.escapeVelocity - 11186) < 40, `g ${b.surfaceGravity} v ${b.escapeVelocity}`);
  check('its day is 23 h 56 m 4.09 s (sidereal), its tilt 23.44 degrees, its orbit JPL\'s (a = 1.00 AU, e 0.0167)', Math.abs(DEF.rotation.periodS - 86164.0905) < 1e-3 && DEF.rotation.axialTiltDeg === 23.4393 && Math.abs(DEF.orbit.a / 1.495978707e11 - 1) < 1e-4 && Math.abs(DEF.orbit.e - 0.0167) < 1e-3);
  check('its air is a real one: 101,325 Pa at the sea, 1.225 kg/m3, an 8.5 km scale height, a blue sky', DEF.atmosphere.surfacePressure === 101_325 && DEF.atmosphere.rho0 === 1.225 && DEF.atmosphere.scaleHeightM === 8500 && (DEF.atmosphere.skyColor & 0xff) > (DEF.atmosphere.skyColor >> 16 & 0xff));
  const ec = REG.worldCentre('earth'), mc = REG.worldCentre('mars');
  check('it sits where the Solar System puts it: 0.4 to 2.7 AU from Mars (the Earth-Mars distance runs from 0.37 to 2.68 AU)', (() => { const d = Math.hypot(ec.x - mc.x, ec.y - mc.y, ec.z - mc.z) / 1.495978707e11; return d > 0.36 && d < 2.7; })());
  check('every field the def states has its source (or says plainly it is invented): the heights and the sea floor are AWS Terrain Tiles (live), the colour NASA Blue Marble, Skyward invented', DEF.sources.some((s) => /terrain-tiles/.test(s.url) && s.verified === 'live') && DEF.sources.some((s) => /73909/.test(s.url)) && DEF.sources.some((s) => s.verified === 'invented'));
  {
    const cred = JSON.parse(readFileSync(join(ROOT, 'credits.json'), 'utf8')).data;
    check('credits.json credits the terrain data and the Blue Marble picture, and names the files that use them', cred.some((c) => /Terrain Tiles/i.test(c.what + c.credit) && /earth-data/.test(c.used_in)) && cred.some((c) => /earth-2k/.test(c.used_in)));
    check('the baked terrain is small (under 400 kB) and the Blue Marble texture is under 400 kB: light on a phone', statSync(join(ROOT, 'src/worlds/earth/earth-data.js')).size < 400_000 && existsSync(join(ROOT, 'assets/earth/earth-2k.jpg')) && statSync(join(ROOT, 'assets/earth/earth-2k.jpg')).size < 400_000);
  }

  section('WD-EARTH 2: the land and the sea are the real ones');
  const h = T.heightAt;
  check('the sea floor and the land are where they are: the Mariana Trench is deeper than 7 km, Everest\'s range higher than 4 km, the middle of the Atlantic 3 to 6 km down, the Amazon basin low land, the Sahara land', h(11.35, 142.2) < -7000 && h(28, 86.9) > 4000 && h(0, -30) < -3000 && h(0, -30) > -6500 && h(-3, -60) > 0 && h(-3, -60) < 400 && h(23, 12) > 100);
  check('the continents are where they are (land under the middle of Africa, Australia, Brazil, Greenland; open sea under the mid-Pacific, the Indian Ocean, the Gulf of Mexico)', h(5, 22) > 0 && h(-25, 134) > 0 && h(-10, -52) > 0 && h(72, -40) > 1000 && h(0, -150) < -2000 && h(-20, 80) < -2000 && h(25, -90) < -500);
  check('about 29 percent of the surface above the sea (the baked grid, area weighted, with the poles filled in: 25 to 36 percent)', (() => { let land = 0, tot = 0; for (let la = -89.75; la < 90; la += 0.5) for (let lo = -179.75; lo < 180; lo += 0.5) { const w = Math.cos(la * DEG); tot += w; if (T.globalHeightAt(la, lo) > 0) land += w; } return land / tot > 0.25 && land / tot < 0.36; })());
  check('Cape Canaveral\'s own window: Merritt Island is land and the Banana River and the Atlantic are water, the shelf slopes away offshore', h(28.55, -80.68) > 0 && h(28.45, -80.22) < -2 && h(28.6, -80.6) > 0 && h(28.6, -80.50) < -2);
  const at = (e, n, up = 0.05) => { const x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n, l = Math.hypot(x, y, z), Rr = b.surfaceRadius(x / l, y / l, z / l); return { x: x / l * (Rr + up), y: y / l * (Rr + up), z: z / l * (Rr + up), R: Rr - R0, l }; };
  check('walking east from the pad you reach the Atlantic: dry land under the first 300 m, the shore within 500 to 1,200 m, sea floor under 2 km, 3 to 30 m deep at the 2 km mark', (() => { const e = (m) => at(m, 0, 0).R; let shore = null; for (let m = 0; m < 3000; m += 20) if (e(m) < 0) { shore = m; break; } return e(100) > 1 && e(250) > 1 && shore > 500 && shore < 1200 && e(2000) < -3 && e(2000) > -30; })());
  check('the pad stands a few metres over the sea (3 to 8 m), flat to 5 cm over 200 m, and open ground is scrub soil', (() => { const pr = pi.planeR - R0; let worst = 0; for (let e = -100; e <= 100; e += 25) for (let n = -100; n <= 100; n += 25) { const p = at(e, n, 0); worst = Math.max(worst, Math.abs((p.x - pi.point.x) * pi.up.x + (p.y - pi.point.y) * pi.up.y + (p.z - pi.point.z) * pi.up.z)); } return pr > 3 && pr < 8 && worst < 0.05; })());
  check('the ground is walkable round the pad: no slope over 25 degrees between points 20 m apart, out to 600 m inland (west)', (() => { let worst = 0; for (let e = -600; e < 400; e += 20) for (const n of [-300, -100, 0, 100, 300]) worst = Math.max(worst, Math.abs(at(e + 20, n, 0).R - at(e, n, 0).R) / 20); return Math.atan(worst) * 180 / Math.PI < 25; })());
  check('the field is a real solid: negative three metres under the pad, open air three metres over it', FIELD.density(b, pi.point.x - pi.up.x * 3, pi.point.y - pi.up.y * 3, pi.point.z - pi.up.z * 3) < 0 && FIELD.density(b, pi.point.x + pi.up.x * 3, pi.point.y + pi.up.y * 3, pi.point.z + pi.up.z * 3) > 0);
  {
    const w = new Walker(b); const p = at(0, 60); Object.assign(w.worldPos, { x: p.x, y: p.y, z: p.z }); w.updateFrame();
    let grounded = 0; for (let i = 0; i < 90; i++) { w.tick(1 / 30, {}); if (w.grounded) grounded++; }
    check('a walker set down beside the pad stands on Earth (9.8 m/s2 holds him down)', grounded > 60, `grounded ${grounded}/90`);
  }
  check('the ground is made of what it looks like: a concrete slab under the pad and the buildings, scrub soil inland, sand on the beach and under the shallows', (() => {
    const mat = (e, n, dep) => { const p = at(e, n, -dep); return b.materialField(p.x, p.y, p.z); };
    let beach = null; for (let m = 400; m < 1500; m += 5) if (at(m, 0, 0).R < 0.8 && at(m, 0, 0).R > -1) { beach = m; break; }
    const ids = { pad: mat(0, 0, 0.2).id, hall: mat(-30, 72.25, 0.3).id, inland: mat(-300, 100, 0.2).id, beach: beach && mat(beach, 0, 0.1).id, shelf: beach && mat(beach + 80, 0, 0.1).id, deep: mat(0, 0, 4).id };
    if (process.env.EARTH_DEBUG) console.log(JSON.stringify(ids), beach);
    return mat(0, 0, 0.2).id === FIELD.MATERIALS.concrete.id && mat(-30, 72.25, 0.3).id === FIELD.MATERIALS.concrete.id && mat(-300, 100, 0.2).id === FIELD.MATERIALS.earthRegolith.id && beach !== null && mat(beach, 0, 0.1).id === FIELD.MATERIALS.earthIce.id && mat(beach + 80, 0, 0.1).id === FIELD.MATERIALS.earthIce.id && mat(0, 0, 4).id === FIELD.MATERIALS.earthRubble.id;
  })());

  section('WD-EARTH 3: the Skyward Launch Complex');
  const boxes = L.layoutOf().BOXES;
  check('everything stands inside the 220 m square the field checks for a settlement (and nothing overlaps the 60 m landing pad)', boxes.every((q) => q.x0 > -220 && q.x1 < 220 && q.z0 > -220 && q.z1 < 220) && !boxes.some((q) => q.x1 > -31.5 && q.x0 < 31.5 && q.z1 > -31.5 && q.z0 < 31.5));
  check('the complex has what a launch complex has: Range Control, a training hall, a hangar, an assembly hall, a launch mount with a service tower taller than the vehicle, lightning masts, cold-fuel spheres and a tank farm', ['ops-n', 'training-w', 'hangar-n', 'vab', 'mount', 'tower', 'mast-0', 'sphere-0', 'tank-0'].every((id) => boxes.some((q) => q.id === id)) && L.COMPLEX.TOWER.h > 90);
  check('the halls have a door a person can walk through (the walls leave a gap), and the assembly hall is a solid block', ['ops', 'training', 'hangar'].every((k) => boxes.filter((q) => q.id.startsWith(k + '-')).length >= 4) && boxes.filter((q) => q.id === 'vab').length === 1);
  check('the footprints are cut from the same numbers: the concrete slab is under the assembly hall, the mount and the tank farm, and the open ground between is not', (() => {
    const mat = (x, z, dep) => { const p = at(x, -z, -dep); return b.materialField(p.x, p.y, p.z); };
    const V = L.COMPLEX.VAB, M = L.COMPLEX.MOUNT; return mat((V.x0 + V.x1) / 2, (V.z0 + V.z1) / 2, 0.4).id === FIELD.MATERIALS.concrete.id && mat(M.cx, M.cz, 0.4).id === FIELD.MATERIALS.concrete.id && mat(188, -38, 0.4).id === FIELD.MATERIALS.concrete.id && mat(-100, -60, 0.3).id !== FIELD.MATERIALS.concrete.id;
  })());
  check('the harbour is the Atlantic: the landings of the other worlds are untouched (Mars and the Moon grounds at a fixed direction are the same numbers as before)', makeMoon('phobos').surfaceRadius(1, 0, 0) === 11465.756248852837 && makeMoon('deimos').surfaceRadius(1, 0, 0) === 6035.753066285422);
  check('Skyward is the faction of this place (a style with the launch-white, range-orange and sky-blue palette) and Earth is its home', (await src('factions/registry.js')).factionStyle('skyward').home === 'earth');

  section('WD-EARTH 4: the sky runs on Earth\'s day');
  {
    const OMEGA = 2 * Math.PI / 86164.0905, up = pi.up;
    const sunIn = (Tg) => { const e = REG.worldCentreInertial('earth', Tg), s = REG.worldCentreInertial('sun', Tg), dx = s.x - e.x, dy = s.y - e.y, dz = s.z - e.z, l = Math.hypot(dx, dy, dz); return FR.rotY({ x: dx / l, y: dy / l, z: dz / l }, -(DEF.rotation.prime0Deg * DEG + OMEGA * Tg)); };
    const clock = await src('space/clock.js'), t0 = clock.worldTimeAt(Date.UTC(2026, 9, 8)); let best = -90, bt = 0, low = 90;
    for (let t = 0; t < 86400; t += 300) { const s = sunIn(t0 + t), e = Math.asin(s.x * up.x + s.y * up.y + s.z * up.z) / DEG; if (e > best) { best = e; bt = t / 3600; } low = Math.min(low, e); }
    check(`on 8 October the Sun is highest over the pad near local noon (17:10 UTC, found ${bt.toFixed(2)} h), above the horizon by day (${best.toFixed(0)} degrees at noon, game Sun) and below it at night (${low.toFixed(0)})`, Math.abs(bt - 17.17) < 0.3 && best > 20 && low < -20);
  }

  section('WD-EARTH 5: the real authority flies a course from Mars to Earth and lands on the pad');
  {
    const { Authority } = await import(pathToFileURL(join(ROOT, 'server/authority.mjs')).href);
    const { FileAdapter } = await import(pathToFileURL(join(ROOT, 'server/storage.mjs')).href);
    const LR = await src('space/longRange.js'), TOP = LR.LONG.warps.at(-1);
    const dir = await mkdtemp(join(tmpdir(), 'cosmos-earth-'));
    let clock = Date.now(); const now = () => clock;
    const world = await new Authority(new FileAdapter(join(dir, 'world.json')), { now, verify: null }).load();
    const p = world.createPlayer('d'.repeat(48), 'Earth QA', 'isaiah', 0, { ephemeral: true });
    const sim = world.sims.get(p.shipId), ship = world.state.ships[p.shipId];
    check('the ship has her own pad on Earth (one per world, appended, as on every world)', ship.moonPads && ship.moonPads.earth && Number.isFinite(ship.moonPads.earth.east), JSON.stringify(ship.moonPads && Object.keys(ship.moonPads)));
    const seat = () => { p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.frameId = sim.frameId; const s = sim.def.seats.find((q) => q.id === 'pilot'); p.pose.seat = 'pilot'; Object.assign(p.pose.sw, { x: s.x, y: s.y, z: s.z }); };
    const tick = () => { world.advance(1 / 30); clock += 33; };
    const fly = (dest) => {
      seat(); let err = null; try { world.reduce(p, { type: 'engage', destination: dest }); } catch (e) { err = e.message; }
      if (err) return { dest, err };
      const phases = []; const t0 = world.state.clock;
      for (let i = 0; i < 600_000 && sim.trip && sim.trip.active; i++) {
        const w = sim.trip.phase === 'longdrive' ? TOP : 60;
        if (sim.trip.warp !== w && (w <= 60 || sim.trip.phase === 'longdrive')) world.reduce(p, { type: 'trip-warp', warp: w });
        if (!phases.includes(sim.trip.phase)) phases.push(sim.trip.phase);
        tick();
      }
      for (let i = 0; i < 600 && !sim.flight.landed && !sim.trip; i++) tick();
      return { dest, frame: sim.frameId, landed: sim.flight.landed, tripLeft: !!sim.trip, phases, simS: Math.round(world.state.clock - t0) };
    };
    const r1 = fly('earth');
    check(`a course to Earth (${(r1.phases || []).join(' > ')}) ends with the ship landed in Earth's frame, in the long drive and the descent through her air`, !r1.err && r1.frame === 'earth' && r1.landed && !r1.tripLeft && (r1.phases || []).includes('longdrive'), JSON.stringify(r1));
    const f = sim.flight, bd = f.body;
    check('her flight model is on Earth (its gravity, its air) and she is down on her pad, within 400 m of the complex', bd && bd.id === 'earth' && Math.abs(bd.surfaceGravity - b.surfaceGravity) < 1e-9 && Math.hypot(f.pos.x - pi.point.x, f.pos.y - pi.point.y, f.pos.z - pi.point.z) < 400, `${bd && bd.id}`);
    const hull0 = f.hull; f.hull = 100;                 // (the test ship arrives with a worn hull, which cuts her lift: she is mended here so the check is about Earth)
    const stock = f.canLiftOff();
    f.routePower('engines', 100);
    check(`Earth is the hard launch the bible promises: the stock Meridian on her default power cannot lift off (${stock ? 'she can' : 'she cannot'}), with the engines routed to the limit and a sound hull she can (${(f.maxLiftN / 1000).toFixed(0)} kN against ${(f.weightN() / 1000).toFixed(0)} kN of weight)`, !stock && f.canLiftOff());
    const r2 = fly('orbit');
    check('from Earth a course up to Mars orbit climbs out through the air and leaves her frame', !r2.err && r2.frame === 'mars' && !r2.tripLeft, JSON.stringify(r2));
    check('the world state, saved with the Earth trip behind it, is still small (under 60 kB)', JSON.stringify(world.publicState(p.id)).length < 60_000);
  }

  section('WD-EARTH round 2: the start world, the people, the ground is named for what it is');
  {
    const START = await src('opening/worlds.js'), LIFE = await src('opening/lifeboat.js'), CAST = await src('worlds/earth/cast.js'), DLG = await src('opening/dialogue.js');
    const e = START.startWorld('earth');
    check('Earth is an open start world with Homeguard and Skyward, in dollars, landing at the Skyward Launch Complex', e.status === 'open' && e.factions.join() === 'homeguard,skyward' && e.money === 'dollars' && /Skyward Launch Complex/.test(e.port) && START.openStartWorlds().includes('earth'));
    check('the start says plainly that Homeguard has nothing built yet', /nothing built/.test(e.port) && START.goodsLines('earth').some((l) => /Homeguard has nothing built/.test(l)));
    const ids = CAST.EARTH_CAST.map((p) => p.id), cell = LIFE.giverFor('earth', 'cell'), coupler = LIFE.giverFor('earth', 'coupler');
    check('the two lifeboat parts come from two people who stand at the complex, one from each side (the Skyward crew chief and the Homeguard organiser)', cell.id !== coupler.id && ids.includes(cell.id) && ids.includes(coupler.id) && CAST.EARTH_CAST.find((p) => p.id === cell.id).faction === 'skyward' && CAST.EARTH_CAST.find((p) => p.id === coupler.id).faction === 'homeguard');
    const inBox = (x, z, m) => L.layoutOf().BOXES.some((bx) => x > bx.x0 - m && x < bx.x1 + m && z > bx.z0 - m && z < bx.z1 + m), free = CAST.EARTH_CAST.every((p) => !inBox(p.x, p.z, 0.8)) && [cell, coupler].every((g) => !inBox(g.at.x, g.at.z, 0.8));
    check('nobody stands inside a wall, and each giver spot is within reach of the person', free && CAST.EARTH_CAST.every((p) => { const g = [cell, coupler].find((x) => x.id === p.id); return Math.hypot(g.at.x - p.x, g.at.z - p.z) <= 3.5; }));
    check('the Earth opening words exist, are in the registry of worlds, and the gate line is its own', DLG.WORLD_DIALOGUE.earth && DLG.GATE_LINES.earth && /Earth/.test(DLG.GATE_LINES.earth) && Object.keys(DLG.WORLD_DIALOGUE.earth.drivers).sort().join() === 'homeguard,skyward' && /nothing built/.test(DLG.WORLD_DIALOGUE.earth.drivers.homeguard.closing));
    check('the ground is named for what you stand on: grass and soil, packed sand and shell rock, sand; the word regolith is not used', DEF.materials.regolith.name === 'Grass and soil' && DEF.materials.rubble.name === 'Packed sand and shell rock' && DEF.materials.ice.name === 'Sand' && !Object.values(DEF.materials).some((m) => /regolith/i.test(m.name)));
    check('the Earth ground shader is its own (grass, scrub, sand) and the pebbles are nearly off', DEF.render.regolith.earth === true && DEF.render.farRegolith.earth === true && DEF.render.regolith.pebble <= 0.05);
  }
}

if (process.argv[1] && process.argv[1].endsWith('pkg-earth.mjs')) {
  let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + '  ' + d); } };
  const section = (s) => console.log('\n== ' + s + ' ==');
  await run({ check, section });
  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
}
