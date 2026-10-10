// WD-CALLISTO checks: the moon (real numbers, real orbit round Jupiter, the real Valhalla basin), the ground and the camp on it,
// Jupiter in the sky, the start-world wiring (the board, the opening words, the lifeboat parts), the jobs, and the authority
// giving a new ship her own pad on Callisto. No browser (test/callisto-browser.mjs is the renderer's half).
//   node test/pkg-callisto.mjs   (quick, standalone)  |  part of validate.mjs via the pkg-*.mjs hook
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
  const DEF = (await src('worlds/callisto/def.js')).default;
  const L = await src('worlds/callisto/layout.js');
  const CAST = await src('worlds/callisto/cast.js');
  const JS = await src('worlds/callisto/jupiterSky.js');
  const { makeMoon } = await src('space/moonField.js');
  const FIELD = await src('world/field.js');
  const { Walker } = await src('player/walker.js');

  section('WD-CALLISTO 1: the moon, its orbit, and Jupiter');
  const b = makeMoon('callisto'), pi = b.padInfo, R0 = DEF.radiusM;
  check('Callisto is a real world now, not a placeholder: a moon with a frame, the nav lists it as a destination reached by the long-range drive', !DEF.placeholder && DEF.kind === 'moon' && SPEC.MOON_IDS.includes('callisto') && SPEC.DESTINATIONS.some((d) => d.id === 'callisto' && d.kind === 'moon' && d.via === 'drive'));
  check('its radius, mass and gravity are the fact sheet\'s (mean radius 2410.3 km, 1.0759e23 kg, 1.236 m/s2, 2.44 km/s to escape)', R0 === 2_410_300 && DEF.massKg === 1.0759e23 && Math.abs(b.surfaceGravity - 1.236) < 0.002 && Math.abs(b.escapeVelocity - 2440) < 30, `g ${b.surfaceGravity} v ${b.escapeVelocity}`);
  check('it turns once per orbit (16.689018 days, locked to Jupiter), the same face kept to the planet', DEF.rotation.lockedTo === 'parent' && Math.abs(DEF.rotation.periodS / 86400 - 16.6890184) < 1e-6 && Math.abs(DEF.orbit.periodS / 86400 - 16.6890184) < 1e-6);
  check('its orbit is Jupiter\'s own equatorial plane (IAU pole: i 64.495, node 178.06 in ecliptic elements) with JPL\'s a and e, and the phase says plainly it is fitted', (() => { const o = DEF.orbit; return o.parent === 'jupiter' && o.a === 1_882_700_000 && o.e === 0.0074 && Math.abs(o.i - 64.495) < 1e-6 && Math.abs(o.node - 178.06) < 1e-2 && DEF.sources.some((s) => s.verified === 'invented' && /FIT/i.test(s.note)); })());
  const cal = REG.worldCentre('callisto'), jup = REG.worldCentre('jupiter'), mars = REG.worldCentre('mars');
  const dj = Math.hypot(cal.x - jup.x, cal.y - jup.y, cal.z - jup.z), dm = Math.hypot(cal.x - mars.x, cal.y - mars.y, cal.z - mars.z) / 1.495978707e11;
  check(`it goes round Jupiter at the real 1,882,700 km (now ${(dj / 1e6).toFixed(1)} thousand km) and sits ${dm.toFixed(1)} AU from Mars (3.4 to 6.9 across the cycle)`, Math.abs(dj - 1.8827e9) < 0.02 * 1.8827e9 && dm > 3.4 && dm < 6.9);
  check('Jupiter is 4.3 to 4.4 degrees wide from the surface: nine Moons (2 atan(71,492 km / 1,882,700 km))', (() => { const w = 2 * Math.atan(71_492_000 / dj) / DEG; return w > 4.2 && w < 4.5; })());
  check('the def states its sources: the fact sheet, the USGS basins, and plainly which numbers are fiction', DEF.sources.some((s) => /joviansatfact/.test(s.url)) && DEF.sources.some((s) => /Valhalla/.test(s.field) && s.verified === 'table') && DEF.sources.filter((s) => s.verified === 'invented').length >= 2);
  {
    const cred = JSON.parse(readFileSync(join(ROOT, 'credits.json'), 'utf8')).data;
    check('credits.json credits the USGS Callisto mosaic and the Jupiter picture, and names the files that use them', cred.some((c) => /USGS/i.test(c.credit) && /callisto-1k/.test(c.used_in)) && cred.some((c) => /Solar System Scope/i.test(c.credit) && /jupiter-1k/.test(c.used_in)));
    check('the globe and sky pictures are small (each under 400 kB): light on a phone', existsSync(join(ROOT, 'assets/callisto/callisto-1k.jpg')) && statSync(join(ROOT, 'assets/callisto/callisto-1k.jpg')).size < 400_000 && existsSync(join(ROOT, 'assets/callisto/jupiter-1k.jpg')) && statSync(join(ROOT, 'assets/callisto/jupiter-1k.jpg')).size < 400_000);
  }

  section('WD-CALLISTO 2: the ground is Valhalla\'s floor, a solid, walkable ice world');
  check('the camp stands on the bright floor of the real Valhalla (16 N, 57 W = 303 E): the first landmark, 360 km across; Asgard 1,600 km across at 30 N 139 W', (() => {
    const v = DEF.landmarks.find((l) => l.name === 'Valhalla'), a = DEF.landmarks.find((l) => l.name === 'Asgard');
    return v.lat === 16.0 && v.lon === 303.0 && v.radiusM === 180_000 && Math.abs(DEF.pad.lat - v.lat) < 1e-9 && Math.abs(DEF.pad.lon - v.lon) < 1e-9
      && a.lat === 30.0 && a.lon === 221.0 && Math.abs(a.radiusM * 2 / 1000 - 1600) < 100;
  })());
  check('the field is a real solid: negative three metres under the pad, open air three metres over it', FIELD.density(b, pi.point.x - pi.up.x * 3, pi.point.y - pi.up.y * 3, pi.point.z - pi.up.z * 3) < 0 && FIELD.density(b, pi.point.x + pi.up.x * 3, pi.point.y + pi.up.y * 3, pi.point.z + pi.up.z * 3) > 0);
  const at = (e, n, up = 0.05) => { const x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n, l = Math.hypot(x, y, z), Rr = b.surfaceRadius(x / l, y / l, z / l); return { x: x / l * (Rr + up), y: y / l * (Rr + up), z: z / l * (Rr + up), R: Rr - R0, l }; };
  check('the pad is flat to 5 cm over its graded 130 m disc (a Meridian and the camp sit level on it)', (() => { let worst = 0; for (let e = -120; e <= 120; e += 15) for (let n = -120; n <= 120; n += 15) { if (Math.hypot(e, n) > 125) continue; const p = at(e, n, 0); worst = Math.max(worst, Math.abs((p.x - pi.point.x) * pi.up.x + (p.y - pi.point.y) * pi.up.y + (p.z - pi.point.z) * pi.up.z)); } return worst < 0.05; })());
  {
    const w = new Walker(b); const p = at(0, 60); Object.assign(w.worldPos, { x: p.x, y: p.y, z: p.z }); w.updateFrame();
    let grounded = 0; for (let i = 0; i < 90; i++) { w.tick(1 / 30, {}); if (w.grounded) grounded++; }
    check('a walker set down beside the pad stands on Callisto (1.236 m/s2 holds him down)', grounded > 60, `grounded ${grounded}/90`);
  }
  check('the ground is what it looks like: a concrete slab under the pad, clean bright basin ice just under the dust of Valhalla\'s floor, dark stained gravel 250 km off the basin and broken rock below', (() => {
    const mat = (e, n, dep) => { const p = at(e, n, -dep); return b.materialField(p.x, p.y, p.z); };
    return mat(0, 0, 0.2).id === FIELD.MATERIALS.concrete.id && mat(0, -140, 0.3).id === FIELD.MATERIALS.callistoIce.id
      && mat(0, -140, 4).id === FIELD.MATERIALS.callistoRegolith.id
      && mat(0, 250_000, 0.3).id === FIELD.MATERIALS.callistoRegolith.id && mat(0, 250_000, 12).id === FIELD.MATERIALS.callistoRubble.id;
  })());
  check('the bright basin ice is what you dig on the floor: the material field reads clean ice a metre down on Valhalla\'s floor', (() => {
    const p = at(0, -140, -0.9);
    return b.materialField(p.x, p.y, p.z).id === FIELD.MATERIALS.callistoIce.id;
  })());
  check('no worker stands inside a wall, and the camp\'s buildings lie inside the graded ground (130 m), with the door and the shed\'s mouth open', (() => {
    const inBox = (w, bx, m = 0.3) => w.x > bx.x0 - m && w.x < bx.x1 + m && w.z > bx.z0 - m && w.z < bx.z1 + m;
    return CAST.CALISTO_CAST.every((w) => !L.BOXES.some((bx) => inBox(w, bx)))
      && L.BOXES.filter((bx) => Math.abs(bx.x0) < 200 && Math.abs(bx.x1) < 200 && Math.abs(bx.z0) < 200 && Math.abs(bx.z1) < 200).every((bx) => Math.hypot(Math.max(Math.abs(bx.x0), Math.abs(bx.x1)), Math.max(Math.abs(bx.z0), Math.abs(bx.z1))) < 135)
      && !L.solidAt(-8, -79, 0) && !L.solidAt(25.4, 56, 0.3) && !L.solidAt(-8, -68, 0.3);
  })());
  check('the prospectors\' camp is a world port 1.2 km north, with its own graded ground and four solid camp buildings', (() => {
    const port = b.ports.find((q) => q.id === 'prospectors');
    if (!port) return false;
    const po = L.frameToOutpost(pi, port.point);
    const d = Math.hypot(po.x, po.z);
    return d > 1100 && d < 1300 && Math.abs(po.x) < 60 && L.PORT_BOXES.length === 4;
  })());

  section('WD-CALLISTO 3: Jupiter in the sky, and the nav row');
  check('the Jupiter-sky module names Callisto\'s frame and reads the real Jupiter-Callisto line', JS && typeof JS.acquireJupiter === 'function' && readFileSync(join(ROOT, 'src/worlds/callisto/jupiterSky.js'), 'utf8').includes("worldCentre('callisto'") && readFileSync(join(ROOT, 'src/worlds/callisto/jupiterSky.js'), 'utf8').includes('71_492_000'));
  check('the Sun is drawn 0.10 degrees across at 5.2 AU, and the sky says there is no air', Math.abs(DEF.sky.star.diskDeg - 0.533 / 5.2) < 0.01 && !DEF.atmosphere);

  section('WD-CALLISTO 4: the start world, the opening words, the lifeboat chain');
  const START = await src('opening/worlds.js'), LIFE = await src('opening/lifeboat.js'), DLG = await src('opening/dialogue.js');
  {
    const e = START.startWorld('callisto');
    check('Callisto is an open start world with Mystara and the Unbound, in credits, landing at the Valhalla Camp', e.status === 'open' && e.factions.join() === 'mystara,unbound' && e.money === 'credits' && /Valhalla Camp/.test(e.port) && START.openStartWorlds().includes('callisto'));
    check('the board\'s numbers now come from the registry (radius 2410.3 km, gravity 1.236, day 400.5 h)', (() => { const f = START.worldFacts('callisto'); return f.source === 'registry' && Math.abs(f.radiusKm - 2410.3) < 0.1 && Math.abs(f.gravity - 1.236) < 0.01 && Math.abs(f.dayH - 16.6890184 * 24) < 0.1; })());
    const ids = CAST.CALISTO_CAST.map((p) => p.id), cell = LIFE.giverFor('callisto', 'cell'), coupler = LIFE.giverFor('callisto', 'coupler');
    check('the two lifeboat parts come from two people who stand where cast.js puts them, one from each side (Mystara\'s quartermaster, the prospectors\' spokesman)', cell.id !== coupler.id && ids.includes(cell.id) && ids.includes(coupler.id)
      && CAST.CALISTO_CAST.find((p) => p.id === cell.id).faction === 'mystara' && CAST.CALISTO_CAST.find((p) => p.id === coupler.id).faction === 'unbound');
    const inBox = (x, z, m) => L.BOXES.some((bx) => x > bx.x0 - m && x < bx.x1 + m && z > bx.z0 - m && z < bx.z1 + m);
    const free = CAST.CALISTO_CAST.every((p) => !inBox(p.x, p.z, 0.8)) && [cell, coupler].every((g) => !inBox(g.at.x, g.at.z, 0.8));
    check('nobody stands inside a wall, and each giver spot is within reach of the person', free && CAST.CALISTO_CAST.filter((p) => [cell, coupler].some((x) => x.id === p.id)).every((p) => { const g = [cell, coupler].find((x) => x.id === p.id); return Math.hypot(g.at.x - p.x, g.at.z - p.z) <= 3.5; }));
    const d = DLG.WORLD_DIALOGUE.callisto;
    check('the Callisto opening words exist with the same keys as every world, both drivers and both counters, and a gate line of its own', d && DLG.GATE_LINES.callisto && /Callisto/.test(DLG.GATE_LINES.callisto)
      && ['place', 'port', 'surface', 'weather', 'locker', 'crate', 'drivers', 'counter'].every((k) => d[k])
      && Object.keys(d.drivers).sort().join() === 'mystara,unbound' && Object.keys(d.counter).sort().join() === 'mystara,unbound');
    check('the opening\'s crash site knows Callisto is airless (a black sky, not Mars\'s dusk)', readFileSync(join(ROOT, 'src/opening/look.js'), 'utf8').includes("this.world === 'callisto') ? 0"));
  }

  section('WD-CALLISTO 5: the jobs (The Quiet Road)');
  const C = await src('missions/catalog.js'), W = await src('missions/where.js'), D = await src('missions/desk.js');
  {
    const ms = C.MISSIONS.filter((m) => m.world === 'callisto');
    check('five jobs in the one thread: an oath job for each side (Mystara\'s ice, the prospectors\' claim), a port relay walk, the joint seal, and a desk hire', ms.length === 5 && C.threadById('callisto-quiet-road') && ms.filter((m) => m.oath).map((m) => m.faction).sort().join() === 'mystara,unbound' && ms.filter((m) => m.side === 'joint').length === 1);
    check('every giver and every place resolves on Callisto, and no spot stands inside a wall', ms.every((m) => {
      const g = W.resolve(m.giver); if (!g || g.frame !== 'callisto') return false;
      return m.steps.every((st) => {
        const pl = (st.k === 'go' || st.k === 'give' || st.k === 'choose') ? W.resolve(st.to) : null;
        if (pl && !pl.person) { if (pl.kind !== 'outpost' || pl.frame !== 'callisto') return false; if (L.solidAt(pl.x, pl.z, 0.2)) return false; }
        return true;
      });
    }));
    check('dug Callisto ground counts for the ice job (the hopper give reads the world\'s ground materials)', (C.GROUND_MATS.callisto || []).join() === 'MAT-CALLISTO-REGOLITH,MAT-CALLISTO-RUBBLE,MAT-CALLISTO-ICE');
    check('the camp desk exists with its board in the open, and six hands are on the list', (() => { const d = D.DESKS.callisto; const p = W.resolve(d.person); return d && p && p.frame === 'callisto' && !L.solidAt(d.board.x, d.board.z, 0.2) && D.HANDS.callisto.length === 6; })());
  }

  section('WD-CALLISTO 6: the real authority keeps a pad for her on Callisto');
  {
    const { Authority } = await import(pathToFileURL(join(ROOT, 'server/authority.mjs')).href);
    const { FileAdapter } = await import(pathToFileURL(join(ROOT, 'server/storage.mjs')).href);
    const dir = await mkdtemp(join(tmpdir(), 'cosmos-callisto-'));
    let clock = Date.now(); const now = () => clock;
    const world = await new Authority(new FileAdapter(join(dir, 'world.json')), { now, verify: null }).load();
    const p = world.createPlayer('c'.repeat(48), 'Callisto QA', 'aoi', 0, { ephemeral: true });
    const ship = world.state.ships[p.shipId];
    check('a new ship has her own pad on Callisto (one per world, appended, as on every world)', ship.moonPads && ship.moonPads.callisto && Number.isFinite(ship.moonPads.callisto.east), JSON.stringify(ship.moonPads && Object.keys(ship.moonPads)));
  }
}

if (process.argv[1] && process.argv[1].endsWith('pkg-callisto.mjs')) {
  let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + '  ' + d); } };
  const section = (s) => console.log('\n== ' + s + ' ==');
  await run({ check, section });
  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
}
