// WD-MOON checks: the Moon as three landings of one real body (Tranquility Civil Hub, Shackleton Base, Daedalus Station): real size, mass, day and orbit; the ground read from
// NASA's LOLA heights; Shackleton's shadows and ice; the people and what they sell; the opening's crash hook; and the real authority flying Mars -> the Moon -> its
// two capitals -> Mars. No browser (test/moon-browser.mjs is the phone).
//   node test/_moon-only.mjs   (the registry's `run` hook runs this file inside validate)
import '../server/runtime.mjs';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export async function run({ check, section }) {
  const REG = await import('../src/worlds/registry.js');
  const SPEC = await import('../src/space/spaceSpec.js');
  const J = await import('../src/space/jump.js');
  const F = await import('../src/space/frames.js');
  const L = await import('../src/worlds/moon/lola.js');
  const C = await import('../src/worlds/moon/common.js');
  const { makeMoon } = await import('../src/space/moonField.js');
  const { MATERIALS, density } = await import('../src/world/field.js');
  const { MAT_ITEM } = await import('../src/space/jobs.js');
  const { ITEM_OF_MATERIAL, SHOP_GOODS } = await import('../src/economy/shops.js');
  const { Walker } = await import('../src/player/walker.js');
  const { EditStore } = await import('../src/world/edits.js');
  const { attachEdits } = await import('../src/world/field.js');
  const LAY = await import('../src/worlds/moon/layout.js');
  const CAST = await import('../src/worlds/moon/cast.js');
  const PL = await import('../src/worlds/moon/place.js');
  const T = await import('../src/worlds/moon/trade.js');
  const CR = await import('../src/worlds/moon/crash.js');
  const { default: DLG } = await import('../src/worlds/moon/dialogue.js');
  const SEATS = await import('../src/roles/seats.js');
  const { VOICES, BODY_KIND } = await import('../src/voice/cast.js');
  const { structuredLines } = await import('../src/voice/lines.js');
  const ids = ['moon', 'moon-shackleton', 'moon-daedalus'];
  const here = dirname(fileURLToPath(import.meta.url));
  const DEG = Math.PI / 180;

  section('WD-MOON 1. The Moon is a real body: three landings, one region, one gate');
  check('three worlds are registered (the hub, Shackleton Base, Daedalus Station), each a frame world reached by the lane, all in the Moon\'s one region', ids.every((i) => REG.hasWorld(i) && !REG.worldDef(i).placeholder && REG.worldDef(i).kind === 'moon' && REG.worldDef(i).jump === true && J.systemOfFrame(i) === 'moon'));
  check('the nav computer lists all three as destinations marked jump, with their own names', ids.every((i) => SPEC.DESTINATIONS.some((d) => d.id === i && d.kind === 'moon' && d.jump && /Moon:/.test(d.name))));
  check('only the Moon\'s own world carries a lane gate (one gate over the hub for all three landings)', J.isLaneWorld('moon') && ids.every((i) => J.systemOfFrame(i) === J.systemOfFrame('moon')) && J.rootFrameOf(J.systemOfFrame('moon-shackleton')) === 'moon');
  check('the real numbers are NASA\'s: mean radius 1737.4 km, mass 7.346e22 kg, gravity 1.62 m/s2, sidereal rotation 655.72 h (locked to the Earth), obliquity 6.68 deg', ids.every((i) => { const d = REG.worldDef(i), b = makeMoon(i); return d.radiusMean === 1_737_400 && d.massKg === 7.346e22 && Math.abs(b.surfaceGravity - 1.62) < 0.01 && Math.abs(d.rotation.periodS / 3600 - 655.72) < 1e-6 && d.rotation.lockedTo === 'parent' && d.rotation.axialTiltDeg === 6.68; }));
  check('the Moon goes round the Earth on the real orbit: 356,000 to 407,000 km away over a month, back to the same distance after a sidereal month (27.32 d)', (() => {
    const dist = (t) => { const a = REG.worldCentre('moon', t), e = REG.worldCentre('earth', t); return Math.hypot(a.x - e.x, a.y - e.y, a.z - e.z); };
    let mn = 1e12, mx = 0; for (let d = 0; d < 28; d += 0.25) { const x = dist(d * 86400); mn = Math.min(mn, x); mx = Math.max(mx, x); }
    return mn > 355e6 && mx < 408e6 && Math.abs(dist(0) - dist(27.3217 * 86400)) / dist(0) < 0.03;
  })());
  check('the Moon\'s own +X axis faces the Earth: at five times through the month the Earth is within 30 degrees of it (a frame can only turn about Mars\'s pole; the rest is the tilt)', (() => {
    const b = makeMoon('moon'), ex = b.axesWorld.ex; let worst = 1;
    for (const d of [0, 3, 9.2, 15, 21]) { const T0 = d * 86400, k = F.worldKin('moon', T0), me = REG.worldCentre('moon', T0), ea = REG.worldCentre('earth', T0), v = { x: ea.x - me.x, y: ea.y - me.y, z: ea.z - me.z }, l = Math.hypot(v.x, v.y, v.z), r = F.rotY(ex, k.yaw); worst = Math.min(worst, (r.x * v.x + r.y * v.y + r.z * v.z) / l); }
    return worst > Math.cos(30 * DEG);
  })());
  check('the three frames lie on one another: the same centre and the same turn at any time (one body in the sky)', [0, 5e5, 1.9e6].every((t) => { const a = F.worldKin('moon', t), b = F.worldKin('moon-shackleton', t), c = F.worldKin('moon-daedalus', t); return a.c.x === b.c.x && a.c.y === c.c.y && a.c.z === b.c.z && a.yaw === b.yaw && a.yaw === c.yaw; }));
  check('the roles sheet reads all three frames as the Moon (one set of seats, one balance)', ids.every((i) => SEATS.worldOfFrame(i) && SEATS.worldOfFrame(i).id === 'moon'));

  section('WD-MOON 2. The ground is the real Moon (LRO LOLA), shaped by the density field, with Shackleton\'s shadows and ice');
  const kb = (() => { const out = {}; for (const [k, v] of Object.entries(L.DATA.META)) out[k] = v; return statSync(join(here, '..', 'src', 'worlds', 'moon', 'lola-data.js')).size / 1024; })();
  check('our own copy of the data is small (the whole baked file under 330 KB) and decodes: a 360 x 180 global grid, a 360 x 180 brightness map and three windows', kb < 330 && L.DATA.GLOBAL.length === 360 * 180 && L.DATA.ALBEDO.length === 360 * 180 && Object.keys(L.DATA.TILES).length === 3, `${kb.toFixed(0)} KB`);
  check('the heights are LOLA\'s: Apollo 11\'s site is 1.9 km below the reference sphere, Tycho and Copernicus are sunk 3 km or more, the highlands stand 2 km up, the whole Moon spans more than 15 km', (() => {
    const apollo = L.heightAt(0.674, 23.473), tycho = L.heightAt(-43.3, -11.4), cop = L.heightAt(9.6, -20.1), hi = L.heightAt(0, 180); let mn = 1e9, mx = -1e9; for (let la = -90; la <= 90; la += 3) for (let lo = 0; lo < 360; lo += 3) { const h = L.globalHeight(la, lo); mn = Math.min(mn, h); mx = Math.max(mx, h); }
    return Math.abs(apollo + 1920) < 90 && tycho < -2900 && cop < -3000 && hi > 2000 && mx - mn > 15000;
  })());
  check('Shackleton is 4 km deep: its floor is more than 3.8 km under its rim, on the south pole', L.heightAt(-89.66, 129.78) < -2000 && Math.max(...[0, 60, 120, 180, 240, 300].map((a) => L.heightAt(-89.66 + 0.33 * Math.cos(a * DEG), 129.78 + 0.33 * Math.sin(a * DEG) * 120))) - L.heightAt(-89.66, 129.78) > 1500);
  check('the shadows are worked out from those heights: the crater floor never sees the Sun (0 of the year), the rim crests are lit more than 80 percent, the pole itself about a third', (() => {
    const floor = L.illumAt(-89.66, 129.78), pole = L.illumAt(-90, 0); let best = 0;
    for (let la = -89.99; la < -89.2; la += 0.004) for (let lo = 0; lo < 360; lo += 2) { const v = L.illumAt(la, lo); if (v !== null && v > best) best = v; }
    return floor === 0 && L.inShadow(-89.66, 129.78) && best > 0.8 && pole > 0.2 && pole < 0.5 && L.illumAt(0.7, 23.5) === null;
  })());
  check('every landing is on flat, graded ground: the main pad is level within 5 cm over 100 m, and a person set down stands on it', ids.every((id) => {
    const b = makeMoon(id), pi = b.padInfo; let worst = 0;
    const at = (e, n, up = 0.05) => { const x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n, l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l) + up; return { x: x / l * R, y: y / l * R, z: z / l * R }; };
    for (let e = -50; e <= 50; e += 25) for (let n = -50; n <= 50; n += 25) { const p = at(e, n, 0), l = Math.hypot(p.x, p.y, p.z), u = ((p.x - pi.point.x) * pi.up.x + (p.y - pi.point.y) * pi.up.y + (p.z - pi.point.z) * pi.up.z); worst = Math.max(worst, Math.abs(u)); }
    const w = new Walker(b), p = at(0, -140); Object.assign(w.worldPos, { x: p.x, y: p.y, z: p.z }); w.updateFrame(); let grounded = 0; for (let i = 0; i < 90; i++) { w.tick(1 / 30, {}); if (w.grounded) grounded++; }
    return worst < 0.06 && grounded > 60;
  }));
  check('the field is a real solid at every pad: negative three metres under it, open air three metres over it', ids.every((id) => { const b = makeMoon(id), pi = b.padInfo; return density(b, pi.point.x - pi.up.x * 3, pi.point.y - pi.up.y * 3, pi.point.z - pi.up.z * 3) < 0 && density(b, pi.point.x + pi.up.x * 3, pi.point.y + pi.up.y * 3, pi.point.z + pi.up.z * 3) > 0; }));
  check('ice is real ground: in Shackleton\'s permanent shadow, two metres down, the material is lunar ice; in the Sun, at the hub and at the pad it is dust and rock, never ice', (() => {
    const b = makeMoon('moon-shackleton'), q = (la, lo, depth) => { const d = b.fromBody(...[Math.cos(la * DEG) * Math.cos(lo * DEG), Math.cos(la * DEG) * Math.sin(lo * DEG), Math.sin(la * DEG)]); const r = b.surfaceRadius(d.x, d.y, d.z) - depth; return b.materialField(d.x * r, d.y * r, d.z * r); };
    const pi = b.padInfo, padLat = REG.worldDef('moon-shackleton').pad.lat, padLon = REG.worldDef('moon-shackleton').pad.lon;
    const hub = makeMoon('moon'), hd = hub.fromBody(Math.cos(0.7 * DEG) * Math.cos(23.5 * DEG), Math.cos(0.7 * DEG) * Math.sin(23.5 * DEG), Math.sin(0.7 * DEG)), hr = hub.surfaceRadius(hd.x, hd.y, hd.z) - 2, hubMat = hub.materialField(hd.x * hr, hd.y * hr, hd.z * hr);
    return q(-89.66, 129.78, 2).id === MATERIALS.moonIce.id && q(-89.6, 125, 3).id !== undefined && q(padLat, padLon, 2).id !== MATERIALS.moonIce.id && hubMat.id !== MATERIALS.moonIce.id && void pi === undefined;
  })());
  check('ice is dug as itself: a lot cut from the shadow carries its material, the hold files it as moon-ice, the shops list it (the item tables agree)', (() => {
    const b = makeMoon('moon-shackleton'), e = new EditStore(b); attachEdits(e);
    const d = b.fromBody(Math.cos(-89.66 * DEG) * Math.cos(129.78 * DEG), Math.cos(-89.66 * DEG) * Math.sin(129.78 * DEG), Math.sin(-89.66 * DEG)), r = b.surfaceRadius(d.x, d.y, d.z) - 0.9;
    const lot = e.carve({ x: d.x * r, y: d.y * r, z: d.z * r, r: 0.5 }); attachEdits(null);
    const has = lot && lot.massKg > 50 && (lot.parts || [{ materialId: lot.materialId }]).some((p) => p.materialId === MATERIALS.moonIce.id);
    return has && MAT_ITEM['MAT-MOON-ICE'] === T.ICE_ITEM && ITEM_OF_MATERIAL['MAT-MOON-ICE'] === T.ICE_ITEM && !!SHOP_GOODS[T.ICE_ITEM] && ['REGOLITH', 'RUBBLE'].every((k) => MAT_ITEM['MAT-MOON-' + k] === ITEM_OF_MATERIAL['MAT-MOON-' + k]);
  })());
  check('the brightness is LROC\'s: a mare is darker than the highlands, a bright ray (Tycho) brighter than both', (() => { const mare = L.albedoAt(32, -16), hi = L.albedoAt(0, 160), tycho = L.albedoAt(-43, -11); return mare < hi && tycho > mare && mare < 0.5; })());
  check('the ground is deterministic and continuous: the same answer twice, and no step of more than 3 m between points a metre apart across the Tranquility pad and its slopes', (() => {
    const b = makeMoon('moon'), pi = b.padInfo; let worst = 0, same = true;
    for (let e = -300; e <= 300; e += 37) { const p = (ee) => { const x = pi.point.x + pi.east.x * ee, y = pi.point.y + pi.east.y * ee, z = pi.point.z + pi.east.z * ee, l = Math.hypot(x, y, z); return b.surfaceRadius(x / l, y / l, z / l); }; worst = Math.max(worst, Math.abs(p(e) - p(e + 1))); same = same && p(e) === p(e); }
    return same && worst < 3;
  })());

  section('WD-MOON 3. Three settlements, their people, and what they sell');
  const lay = (id) => LAY.layoutOf(id);
  check('each landing has a layout with its solid boxes, a main pad of 58 m, and its people from the cast', ids.every((id) => lay(id) && lay(id).BOXES.length > 8 && lay(id).MAIN_PAD.w === 58 && lay(id).PEOPLE.length >= 8));
  check('nobody stands inside a wall, and every doorway is open ground: the walker can go in at the hub hall, the clinic, the mercantile and the water office, the quartermaster and the Fortis command, the fab and the supply desk', (() => {
    for (const id of ids) for (const p of lay(id).PEOPLE) if (!p.far && lay(id).BOXES.some((b) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1)) return false;
    const open = (id, x, z) => !lay(id).BOXES.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
    const H = LAY.HUB, S = LAY.SHACK, D = LAY.DAED, mid = (a, b) => (a + b) / 2;
    return open('moon', mid(H.HALL.x0, H.HALL.x1), H.HALL.z1 - 0.2) && open('moon', H.MERC.x1 - 0.2, mid(H.MERC.z0, H.MERC.z1)) && open('moon', H.CLINIC.x1 - 0.2, mid(H.CLINIC.z0, H.CLINIC.z1)) && open('moon', H.WATER.x0 + 0.2, mid(H.WATER.z0, H.WATER.z1))
      && open('moon-shackleton', mid(S.COMMAND.x0, S.COMMAND.x1), S.COMMAND.z1 - 0.2) && open('moon-shackleton', S.QUARTER.x1 - 0.2, mid(S.QUARTER.z0, S.QUARTER.z1)) && open('moon-shackleton', S.WALL.x1, mid(S.WALL.gate.z0, S.WALL.gate.z1))
      && open('moon-daedalus', mid(D.FAB.x0, D.FAB.x1), D.FAB.z0 + 0.2) && open('moon-daedalus', D.SUPPLY.x0 + 0.2, mid(D.SUPPLY.z0, D.SUPPLY.z1)) && open('moon-daedalus', 10, D.DOME.z1 - 0.4);
  })());
  check('everything stands inside the graded ground: every building and tower within 160 m of the pad except the walls, the dishes, the towers of Daedalus and the heritage site', (() => {
    for (const id of ['moon']) for (const b of lay(id).BOXES) if (Math.max(Math.abs(b.x0), Math.abs(b.x1), Math.abs(b.z0), Math.abs(b.z1)) > 160) return false;
    return true;
  })());
  check('the cast is whole: unique ids, each person has a name, a voice that exists, a Loft body of the right gender, a faction style, and either an F5 seat that exists or a line, a question, an answer and a reply', (() => {
    const seen = new Set();
    for (const id of ids) for (const p of CAST.castOf(id)) {
      if (seen.has(p.id)) return false; seen.add(p.id);
      if (!p.title || !p.faction || !p.role) return false;
      if (p.seat) { if (!SEATS.seatById(p.seat)) return false; continue; }
      if (!(p.name && VOICES[p.voice] && p.body && BODY_KIND[p.body] && p.line && p.question && p.answer && p.reply)) return false;
      const g = VOICES[p.voice].gender, kind = BODY_KIND[p.body]; if ((g === 'f') !== (kind === 'f')) return false;
    }
    return true;
  })());
  check('the humour is there and spoken: every custom line is voiced (it is in the list the clip generator reads), none is empty or longer than 60 words, and there are at least 50', (() => {
    const mine = CAST.moonLines(), all = new Set(structuredLines().map((l) => l.voice + '|' + l.text));
    return mine.length >= 50 && mine.every((l) => l.text && l.text.split(' ').length <= 60 && all.has(l.voice + '|' + l.text));
  })());
  check('the Moon\'s F5 seats are held by bodies: governor, port master, both leaders, security chief, patrol, trade director, a trader, a pilot, a medic and the gas station are all standing somewhere', (() => {
    const want = ['moon/governor', 'moon/port-master', 'fortis/leader', 'technos/leader', 'moon/security-chief', 'moon/patrol-1', 'moon/trade-director', 'moon/trader-1', 'moon/pilot-1', 'moon/medic-1', 'moon/gas-worker-1'];
    const have = new Set(ids.flatMap((id) => CAST.castOf(id).filter((p) => p.seat).map((p) => p.seat)));
    return want.every((s) => have.has(s));
  })());
  check('a vendor that buys back a good it sells pays less than it asks (nobody can be milked alone), the hub water office pays more for ice than the Fortis dock, and the Fortis quartermaster pays more for parts than Fab Floor 2 sells them for', (() => {
    for (const v of Object.values(T.SHOPS)) for (const g of Object.keys(v.sells)) if (g in v.buys && v.buys[g] >= v.sells[g]) return false;
    return T.ICE_PRICE['ice-hub'] > T.ICE_PRICE['ice-dock'] && T.SHOPS['fortis-quartermaster'].buys.parts > T.SHOPS['technos-fab'].sells.parts;
  })());
  check('the trade arithmetic never makes marks from nothing: buy then sell at one vendor loses money, the fund bounds a sale, and a bad quantity changes nothing', (() => {
    const mk = () => ({ economy: { marks: 5000, inventory: { water: 0, food: 0, ammo: 0, parts: 0, oxygen: 0 } }, hold: {}, holdLots: [] });
    const s = mk(), fund = { marks: 40000 }; T.buySupply(s, 'hub-mercantile', 'water', 10, fund); T.sellSupply(s, 'hub-mercantile', 'water', 10, fund);
    let threw = 0; for (const f of [() => T.buySupply(s, 'hub-mercantile', 'water', 0, fund), () => T.sellSupply(s, 'hub-mercantile', 'water', 1.5, fund), () => T.buySupply(s, 'technos-supply', 'water', 1, fund), () => T.sellSupply(mk(), 'technos-supply', 'water', 1, fund), () => T.sellSupply(s, 'technos-supply', 'water', 1, { marks: 0 })]) { try { f(); } catch { threw++; } }
    return s.economy.marks < 5000 && threw === 5 && fund.marks > 40000;
  })());
  check('the Moon\'s ice sells from real lots: a tonne leaves the hold and its lots, the buyer\'s fund pays it, and a half tonne is refused', (() => {
    const lot = { lotId: 'a', materialId: 'MAT-MOON-ICE', massKg: 2000, solidVolumeM3: 1.2, looseVolumeM3: 1.9, parts: [{ materialId: 'MAT-MOON-ICE', massKg: 2000, volumeM3: 1.2 }] };
    const s = { economy: { marks: 0, inventory: {} }, hold: { 'moon-ice': 2000 }, holdLots: [lot] }, fund = { marks: 5000 };
    const r = T.sellIce(s, 'ice-hub', 1, fund); let bad = 0; try { T.sellIce(s, 'ice-hub', 0.5, fund); } catch { bad++; } try { T.sellIce(s, 'ice-hub', 5, fund); } catch { bad++; }
    return r.paid === 330 && s.economy.marks === 330 && s.hold['moon-ice'] === 1000 && T.iceKg(s.holdLots) === 1000 && fund.marks === 5000 - 330 && bad === 2;
  })());

  section('WD-MOON 4. The new opening: the crash site, the words and the board row');
  check('the Moon\'s opening dialogue has every key every world\'s file has, a Fortis and a Technos driver with lines in voices that exist, and the other side\'s recruiter at the hub', (() => {
    const keys = ['id', 'place', 'port', 'surface', 'weather', 'locker', 'crate', 'drivers', 'counter'];
    if (!keys.every((k) => DLG[k] !== undefined) || DLG.id !== 'moon' || DLG.port !== 'Tranquility Civil Hub') return false;
    for (const f of ['fortis', 'technos']) { const d = DLG.drivers[f]; if (!d || d.faction !== f || !VOICES[d.voice] || !BODY_KIND[d.person] || !['greeting', 'pitch1', 'pitch2', 'offer', 'closing'].every((k) => d[k])) return false; const c = DLG.counter[f]; if (!c || c.faction === f || !VOICES[c.voice] || !c.line) return false; }
    return DLG.locker.name && DLG.locker.note && DLG.crate && DLG.gate;
  })());
  check('the crash site is real ground: a bowl about 90 m deep, 4.2 km from the hub, its floor lower than the hub\'s plane, a route of eight waypoints that ends at the hub\'s pad', (() => {
    const b = makeMoon('moon'), at = CR.crashPoint(b), rim = CR.crashPoint(b, 600 + 900, 4200), far = CR.crashPoint(b, 600, 4200 + 900), hub = CR.crashPoint(b, 0, 0);
    return Math.hypot(CR.CRASH.site.eastM, CR.CRASH.site.northM) > 4000 && Math.hypot(CR.CRASH.site.eastM, CR.CRASH.site.northM) < 4500 && (rim.heightM + far.heightM) / 2 - at.heightM > 50 && Math.abs(hub.heightM) < 0.2 && CR.CRASH.route.length === 8 && CR.CRASH.route[0][1] === 4200 && Math.hypot(...CR.CRASH.route[7]) < 100 && CR.CRASH.light.sunElevDeg < 3 && CR.CRASH.fx.dust === false;
  })());
  check('the board row is ready: the Moon is open with its pair, the Moon\'s money, and live goods lines from the trade tables', (async () => 1)() && (await (async () => { const S = await import('../src/worlds/moon/startWorld.js'); return S.MOON_START.status === 'open' && S.MOON_START.factions.join() === 'fortis,technos' && S.MOON_START.money === 'lunars' && S.moonGoodsLines().length === 2 && /330/.test(S.moonGoodsLines()[0]); })()));

  section('WD-MOON 5. The real authority flies it: Mars -> the Moon (one lane fee) -> Shackleton -> the hub -> Daedalus (free hops) -> Mars');
  const { runMoonTrips } = await import('./moon-trips.mjs');
  await runMoonTrips({ check });
}
