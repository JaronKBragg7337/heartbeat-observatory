// F0 checks: the faction style sheet. Every faction, the Unbound, neutral Mars and the alien ship have a complete, valid, distinct look.
//   node test/pkg-factions.mjs   (quick, standalone)  |  part of validate.mjs via the pkg-*.mjs hook
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => import(pathToFileURL(join(ROOT, 'src', p)).href);

export async function run({ check, section }) {
  section('F0 faction style sheet');
  const R = await src('factions/registry.js');
  const K = await src('factions/_kit/style.js');

  const NINE = ['homeguard', 'skyward', 'fortis', 'technos', 'ironclad', 'greenhaven', 'mystara', 'wanderhome', 'corsairs'];
  const ids = R.factionIds();
  for (const id of [...NINE, 'unbound', 'mars', 'alien']) check(`style exists: ${id}`, ids.includes(id));
  check('exactly the 9 named factions, the Unbound, Mars and the alien ship (12)', ids.length === 12, String(ids.length));
  check('ten playable factions (nine plus the Unbound), not Mars or the alien ship', R.playableFactionIds().length === 10 && !R.playableFactionIds().includes('mars') && !R.playableFactionIds().includes('alien'));
  check('every manifest line matches a folder (gen-registry is current)', (() => { const d = readdirSync(join(ROOT, 'src/factions'), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name).sort(); return JSON.stringify(d) === JSON.stringify([...ids].sort()); })());

  // each style is complete and valid (the registry throws at load otherwise; say it per style too)
  for (const s of R.allFactionStyles()) check(`${s.id}: schema valid`, K.validateStyle(s).length === 0, K.validateStyle(s).join('; '));

  // the worlds: factions live where the bible puts them
  const homes = { earth: ['homeguard', 'skyward'], moon: ['fortis', 'technos'], ceres: ['ironclad', 'greenhaven'], callisto: ['mystara', 'unbound'], station: ['wanderhome', 'corsairs'] };
  for (const [h, want] of Object.entries(homes)) check(`${h}: ${want.join(' + ')}`, JSON.stringify(R.factionsOn(h).sort()) === JSON.stringify([...want].sort()), R.factionsOn(h).join(','));

  // distinct: no two looks share a primary or an accent, and each hull is far enough apart to tell at a glance
  const fs = R.allFactionStyles();
  const dist = (a, b) => { const x = K.hexToRgb(a), y = K.hexToRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  let worst = 1e9, pair = '';
  for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
    const a = fs[i], b = fs[j];
    const d = Math.min(dist(a.livery.hull, b.livery.hull) + dist(a.livery.accent, b.livery.accent) * 0.5, 1e9);
    if (d < worst) { worst = d; pair = `${a.id}/${b.id}`; }
  }
  check('every pair of liveries differs in hull + accent (distance over 60)', worst > 60, `${pair} ${worst.toFixed(0)}`);
  check('no two factions share an accent colour', new Set(fs.map((s) => s.palette.accent)).size === fs.length);
  check('no two factions share an emblem shape (except none)', (() => { const sh = fs.map((s) => s.signs.emblem.shape).filter((x) => x !== 'none'); return new Set(sh).size === sh.length; })());
  check('registry prefixes are unique', (() => { const p = fs.map((s) => s.livery.registryPrefix).filter(Boolean); return new Set(p).size === p.length; })());

  // sign contrast (the validator enforces 3.0; also assert the main plate is comfortably readable)
  for (const s of fs) { if (s.kind === 'alien') continue; check(`${s.id}: sign plate contrast >= 4`, K.contrast(s.signs.plate.bg, s.signs.plate.fg) >= 4, K.contrast(s.signs.plate.bg, s.signs.plate.fg).toFixed(2)); }

  // people: looks are deterministic, in personRig's form, and vary
  for (const s of fs) {
    if (!s.uniforms) continue;
    const a = R.factionLook(s.id, 5, 'worker'), b = R.factionLook(s.id, 5, 'worker');
    check(`${s.id}: a look is deterministic`, JSON.stringify(a) === JSON.stringify(b));
    check(`${s.id}: a look is a personRig look (id in the Loft roster, cloth/hair/skin colours)`, R.LOFT_PEOPLE.includes(a.personId) && Number.isInteger(a.cloth) && Number.isInteger(a.hair) && Number.isInteger(a.skin));
    const crowd = new Set(Array.from({ length: 12 }, (_, i) => R.factionLook(s.id, i, 'worker').cloth));
    check(`${s.id}: a crowd is not one colour`, crowd.size >= 6, String(crowd.size));
    for (const [role, u] of Object.entries(s.uniforms)) { const l = R.factionLook(s.id, 1, role); check(`${s.id}/${role}: helmet only where the style gives one`, !!l.helmet === !!u.helmet); }
  }
  check('an unknown role falls back to worker', R.factionLook('fortis', 2, 'zookeeper').role === 'worker');
  check('the alien ship has no people', (() => { try { R.factionLook('alien', 1); return false; } catch (e) { return true; } })());
  check('unknown faction throws', (() => { try { R.factionStyle('atlantis'); return false; } catch (e) { return true; } })());

  // ships
  check('shipMark: FT-0007 and upper-case name for Fortis', R.shipMark('fortis', 7, 'Warden').registry === 'FT-0007' && R.shipMark('fortis', 7, 'Warden').name === 'WARDEN');
  check('shipMark: Technos letters its names in lower case', R.shipMark('technos', 3, 'Packet').name === 'packet');
  check('shipMark: the alien ship has no registry mark', R.shipMark('alien', 1).registry === '');
  check('livery stripe colours are colours', fs.every((s) => s.livery.stripe.colors.every((c) => Number.isInteger(c))));

  // signs
  check('signText cases by faction', R.signText('fortis', 'Gate 7') === 'GATE 7' && R.signText('technos', 'Gate 7') === 'gate 7');
  check('pickLine is deterministic and wraps', R.pickLine('mars', 'slogans', 1) === R.pickLine('mars', 'slogans', 1 + R.factionStyle('mars').signs.slogans.length));
  check('signStyle gives a font stack and colours', (() => { const k = R.signStyle('ironclad', 'warning'); return /sans|serif|monospace|cursive/.test(k.fontStack) && Number.isInteger(k.bg) && Number.isInteger(k.fg) && Array.isArray(k.stripe); })());

  // Mars neutral matches what the port already uses (src/port/portArt.js): teal panel 0x071c24, cyan 0x67c4cf, amber 0xe5ac6c, ochre 0xd3ad63
  const art = readFileSync(join(ROOT, 'src/port/portArt.js'), 'utf8');
  const mars = R.factionStyle('mars');
  check('Mars palette is the port\'s own (teal panel, cyan, amber, ochre all appear in portArt.js)', [mars.palette.dark, mars.palette.accent, mars.palette.extra[0], mars.palette.trim].every((c) => art.toLowerCase().includes(c.toString(16).padStart(6, '0'))));

  // the comedy: every faction has lines with a voice of their own (no two share a slogan)
  const all = fs.filter((s) => s.kind !== 'alien').flatMap((s) => s.signs.slogans);
  check('every slogan is unique across the sheet', new Set(all).size === all.length);
  check('the Unbound have one chair (the joke is in the data)', R.factionStyle('unbound').signs.slogans.some((t) => /ONE CHAIR/.test(t)));

  // the gallery and the dev hook exist and are dev-only
  const main = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
  check('main.js opens the gallery only under devMode', /if \(devMode\) \{ const openStyles/.test(main) && main.includes("import('./factions/gallery.js')"));
}

if (process.argv[1] && process.argv[1].endsWith('pkg-factions.mjs')) {
  let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + '  ' + d); } };
  const section = (s) => console.log('\n== ' + s + ' ==');
  await run({ check, section });
  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
}
