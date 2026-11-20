// The freight board (part 3): repeating paid work on every world, played on the real authority with real flights.
// Run: node test/freight-checks.mjs
import { mkWorld, load } from './_mission-harness.mjs';
const rows = []; const check = (name, ok, detail = '') => { rows.push(ok); console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : '  ' + detail)); };
const C = await load('src/missions/catalog.js'), T = await load('src/missions/talk.js'), W = await load('src/missions/where.js');
const FR = C.MISSIONS.filter((m) => m.repeat);
check(`${FR.length} freight jobs; every world with people has at least one that is open from the first day`, ['mars', 'moon', 'ceres', 'earth', 'callisto'].every((w) => FR.some((m) => m.world === w && !(m.needs || []).length)), FR.map((m) => m.world).join());
check('the ticket: New hand, Hauler at 3 runs (+10%), Senior hauler at 10 (+20%), Freight master at 25 (+30%)', C.freightRank(0).name === 'New hand' && C.freightRank(3).bonus === 0.1 && C.freightRank(12).name === 'Senior hauler' && C.freightRank(99).bonus === 0.3 && C.freightRank(99).next === null);

const SEATS = await load('src/roles/seats.js');
check('every side of every two-sided world has a run of its own: given by one of its people, open after its oath job, feeding its home', ['earth', 'moon', 'ceres', 'callisto'].every((w) => SEATS.worldById(w).factions.every((f) => FR.some((m) => m.world === w && m.faction === f && m.side === 'home' && m.size === 0.5 && (m.needs || []).some((id) => { const o = C.missionById(id); return o && o.oath && o.faction === f; })))), FR.filter((m) => m.faction).map((m) => m.faction).join());
const H = await mkWorld(), { p, ship } = H.start('mars');
const r = () => H.mine(p) || { done: {}, active: null }, act = (a) => H.act(p, a), cr = () => ship.economy.marks / 4;
const snap = () => ({ missions: { [p.id]: r() } });
const WELL = { port: [407, -626] };
H.stand(p, 'depot-clerk');
let st = T.standing('depot-clerk', snap(), p.id, 'mars');
check('day one at the supply desk: the story job comes first, and the well run is on the freight board', st.kind === 'offer' && st.offers[0].id === 'mars-stores' && st.offers.some((m) => m.id === 'mars-fr-well') && !st.offers.some((m) => m.id === 'mars-fr-phobos'), (st.offers || []).map((m) => m.id).join());
const html = T.view('depot-clerk', 'Supply clerk', 'work', snap(), p.id, 'mars');
check('the Talk panel shows the freight board with the ticket and a button for each run', /The freight board/.test(html) && /New hand/.test(html) && /data-m="mars-fr-well"/.test(html) && /Well samples · 80 credits/.test(html), html.slice(0, 300));
let a = await act({ type: 'mission-accept', id: 'mars-fr-phobos' });
check('freight for Stickney is not offered before the first story run there', a.ok === false);
// the well run, three times: walk out, walk back, paid every time
const c0 = cr(); let ok = true; const d = [];
for (let i = 0; i < 3; i++) {
  H.stand(p, 'depot-clerk'); a = await act({ type: 'mission-accept', id: 'mars-fr-well' }); ok = ok && a.ok !== false; if (a.ok === false) d.push(a.msg);
  H.advance(1); ok = ok && r().active?.step === 0;
  H.stand(p, WELL); H.advance(1); ok = ok && r().active?.step === 1 && /samples/.test(r().active.carry?.label || '');
  H.stand(p, 'depot-clerk'); H.advance(1); ok = ok && !r().active;
}
check('the well run can be taken again and again: three runs, 240 credits, three on the ticket', ok && cr() === c0 + 240 && r().freight.runs === 3 && r().done['mars-fr-well'].n === 3, `${cr() - c0} ${JSON.stringify(r().freight)} ${d.join('|')}`);
check('three runs make a Hauler, the story says so once, and the rank is on the public player record (other players see it on the name tag)', r().log.filter((l) => l.kind === 'rank' && /Hauler/.test(l.text)).length === 1 && p.title === 'Hauler', String(p.title));
check('the place out in the desert resolves on the ground (the arrow has somewhere to point)', (() => { const t = W.toWorldPos(W.resolve(WELL), H.world.site); return t && Number.isFinite(t.x) && Math.abs(Math.hypot(t.x, t.y, t.z) - 3389500) < 30000; })());
H.stand(p, 'depot-clerk'); a = await act({ type: 'mission-accept', id: 'mars-fr-well' }); H.stand(p, WELL); H.advance(1); H.stand(p, 'depot-clerk'); const c1 = cr(); H.advance(1);
check('a Hauler is paid 10% over the board: the fourth well run pays 88', cr() === c1 + 88, `${cr() - c1}`);
// the desert's other two places have a reason to walk to them
{ const { p: q, ship: s4 } = H.start('mars', null, 'Desert QA'); const rq = () => H.mine(q) || { done: {}, active: null }, c4 = () => s4.economy.marks / 4;
  H.stand(q, 'cab-weather'); const early = await H.act(q, { type: 'mission-accept', id: 'mars-fr-mast' });
  H.world.state.missions[q.id] = { active: null, done: { 'mars-notes': { at: 1 }, 'mars-sensor': { at: 1 } }, flags: {}, log: [], n: 0 };       // the weather officer's own story, done
  let x = await H.act(q, { type: 'mission-accept', id: 'mars-fr-mast' }); H.stand(q, { port: [508, -710] }); H.advance(1); const got = /card/.test(rq().active?.carry?.label || '');
  H.stand(q, 'cab-weather'); let m0 = c4(); H.advance(1);
  check('once her sensors are back, the weather desk sends you out to read the far mast: 100 credits for the card', early.ok === false && x.ok !== false && got && !rq().active && c4() === m0 + 100, `${JSON.stringify(x).slice(0, 120)} ${c4() - m0}`);
  H.stand(q, 'reception-clerk'); x = await H.act(q, { type: 'mission-accept', id: 'mars-fr-landing' }); H.stand(q, { port: [458, -1291] }); H.advance(1); const at = rq().active?.step === 1;
  H.stand(q, 'reception-clerk'); m0 = c4(); H.advance(1);
  check('the Crew Hall reception clerk pays 120 for the walk to the first landing and back', x.ok !== false && at && !rq().active && c4() === m0 + 120, `${JSON.stringify(x).slice(0, 120)} ${c4() - m0}`); }
// the story run unlocks the Phobos freight; then it repeats
a = await act({ type: 'mission-accept', id: 'mars-stores' }); let f = H.fly(p, 'phobos'); H.advance(1); H.stand(p, { at: [35, -3], frame: 'phobos' }); H.advance(1);
f = H.fly(p, 'port'); H.advance(1); H.stand(p, 'depot-clerk');
st = T.standing('depot-clerk', snap(), p.id, 'mars');
check('after "Stores for Stickney" the board adds the Stickney freight and the crossing to Ceres', !!r().done['mars-stores'] && st.offers.some((m) => m.id === 'mars-fr-phobos') && st.offers.some((m) => m.id === 'mars-fr-ceres'), (st.offers || []).map((m) => m.id).join());
ok = true;
for (let i = 0; i < 2; i++) { H.stand(p, 'depot-clerk'); a = await act({ type: 'mission-accept', id: 'mars-fr-phobos' }); ok = ok && a.ok !== false; f = H.fly(p, 'phobos'); H.advance(1); H.stand(p, { at: [35, -3], frame: 'phobos' }); const c = cr(); H.advance(1); ok = ok && !r().active && cr() === c + 198; f = H.fly(p, 'port'); H.advance(1); }
check('the Stickney freight flies twice running, 198 credits each (180 and the Hauler\'s 10%)', ok && r().done['mars-fr-phobos'].n === 2, JSON.stringify(r().done['mars-fr-phobos']));
// a crossing: Mars to Ceres, then Ceres's own board sends you back
H.stand(p, 'depot-clerk'); a = await act({ type: 'mission-accept', id: 'mars-fr-ceres' });
f = H.fly(p, 'ceres'); H.advance(1);
check('the crossing to Ceres lands at Occator Works (' + f.simS + ' game seconds)', f.landed && f.frame === 'ceres' && r().active?.step === 1, JSON.stringify(f));
H.stand(p, 'supply'); let c = cr(); H.advance(1);
check('the Works supply desk takes the drum: 440 credits', !r().active && cr() === c + 440, `${cr() - c}`);
H.stand(p, 'lane-clerk'); st = T.standing('lane-clerk', snap(), p.id, 'ceres');
check('the Ceres flight office has its own board: the crossing back', st.kind === 'offer' && st.offers.some((m) => m.id === 'ceres-fr-mars'), JSON.stringify(st).slice(0, 200));
check('a side\'s own run is not offered to a stranger: the foreman has only the oath job until it is done', (() => { const o = T.standing('foreman', snap(), p.id, 'ceres').offers || []; return o.some((m) => m.id === 'ceres-pit') && !o.some((m) => m.id === 'ceres-fr-ore'); })());
{ // Ironclad's own run: after the oath job, ore for the bunker feeds Ironclad's home every time
  const h = () => H.world.state.homes.ceres, sim = H.world.sims.get(ship.id);
  const sell = async (id, kg) => { H.stand(p, 'foreman'); const x = await act({ type: 'mission-accept', id }); ship.hold['ceres-ore'] = (ship.hold['ceres-ore'] || 0) + kg; H.stand(p, 'foreman'); H.advance(1); return x; };
  const x1 = await sell('ceres-pit', 1000);
  const i0 = h().industry, b0 = h().balance, cA = cr();
  const x2 = await sell('ceres-fr-ore', 500), x3 = await sell('ceres-fr-ore', 500);
  check('after Ironclad\'s oath job the foreman buys ore for the bunker again and again, and each run feeds the home of Ironclad (industry up, the two sides a little further apart)', x1.ok !== false && x2.ok !== false && x3.ok !== false && r().done['ceres-fr-ore']?.n === 2 && h().industry > i0 + 2 && h().balance < b0 && cr() > cA + 260,
    `${JSON.stringify([x1, x2, x3]).slice(0, 300)} ${i0}->${h().industry} ${b0}->${h().balance} ${cr() - cA} landed:${sim.flight.landed}`);
  H.stand(p, 'greenhaven-rep'); const x4 = await act({ type: 'mission-accept', id: 'ceres-fr-salt' });
  check('Greenhaven\'s run stays closed to an Ironclad pilot', x4.ok === false, JSON.stringify(x4).slice(0, 160));
}
H.stand(p, 'lane-clerk'); a = await act({ type: 'mission-accept', id: 'ceres-fr-mars' }); f = H.fly(p, 'port'); H.advance(1); H.stand(p, 'depot-clerk'); c = cr(); H.advance(1);
check('and the crossing home pays at the Mars supply desk', f.frame === 'mars' && !r().active && cr() === c + 440, `${JSON.stringify(a).slice(0, 120)} ${JSON.stringify(f)} ${cr() - c}`);
check('story jobs still close when done: "Stores for Stickney" is refused a second time', (await act({ type: 'mission-accept', id: 'mars-stores' })).ok === false);
// the Moon: a hop out and a load back
{ const { p: q, ship: s2 } = H.start('moon'); const rq = () => H.mine(q), c2 = () => s2.economy.marks / 4;
  H.stand(q, 'h-guide'); let x = await H.act(q, { type: 'mission-accept', id: 'moon-fr-shack' }); let g = H.fly(q, 'moon-shackleton'); H.advance(1); H.stand(q, 's-quarter'); let m0 = c2(); H.advance(1);
  check('the Moon: a crate from Tranquility to Shackleton pays 150 at the quartermaster', x.ok !== false && g.landed && !rq().active && c2() === m0 + 150, `${JSON.stringify(x).slice(0, 120)} ${JSON.stringify(g)} ${c2() - m0}`);
  x = await H.act(q, { type: 'mission-accept', id: 'moon-fr-ice' }); g = H.fly(q, 'moon'); H.advance(1); H.stand(q, 'h-water'); m0 = c2(); H.advance(1);
  check('and the quartermaster has a load going back to Tranquility: nobody flies empty', x.ok !== false && g.frame === 'moon' && !rq().active && c2() === m0 + 150, `${JSON.stringify(x).slice(0, 120)} ${JSON.stringify(g)} ${c2() - m0}`); }
// freight that starts on Mars's moons: their people talk, and nobody flies home empty
{ const { p: q, ship: s3 } = H.start('mars', null, 'Moons QA'); const rq = () => H.mine(q) || { done: {}, active: null }, c3 = () => s3.economy.marks / 4, go = (a) => H.act(q, a);
  const sn = () => ({ missions: { [q.id]: rq() } });
  let g = H.fly(q, 'phobos'); H.advance(1); H.stand(q, 'ph-yard');
  const o1 = T.standing('ph-yard', sn(), q.id, 'phobos');
  check('on Phobos the yard hand at Stickney East has freight for the port, on a first visit', g.landed && o1.kind === 'offer' && o1.offers[0].id === 'mars-fr-empties', JSON.stringify(o1).slice(0, 200));
  let x = await go({ type: 'mission-accept', id: 'mars-fr-fuel' });
  check('a job is still only given by its own person: the propellant tech is across the pad', x.ok === false);
  x = await go({ type: 'mission-accept', id: 'mars-fr-empties' }); g = H.fly(q, 'port'); H.advance(1); H.stand(q, 'depot-clerk'); let m0 = c3(); H.advance(1);
  check('the empties come down to the supply desk: 180 credits', x.ok !== false && !rq().active && c3() === m0 + 180, `${JSON.stringify(x).slice(0, 120)} ${c3() - m0}`);
  g = H.fly(q, 'phobos'); H.advance(1); H.stand(q, 'ph-pump'); x = await go({ type: 'mission-accept', id: 'mars-fr-fuel' }); g = H.fly(q, 'deimos'); H.advance(1); H.stand(q, 'de-geo'); m0 = c3(); H.advance(1);
  check('Phobos to Deimos: a flask of propellant to the geologist pays 200', x.ok !== false && g.frame === 'deimos' && !rq().active && c3() === m0 + 200, `${JSON.stringify(x).slice(0, 120)} ${JSON.stringify(g)} ${c3() - m0}`);
  x = await go({ type: 'mission-accept', id: 'mars-fr-plates' }); g = H.fly(q, 'phobos'); H.advance(1); H.stand(q, 'ph-pump'); m0 = c3(); H.advance(1);
  check('and the geologist has plates going back to Phobos: 200', x.ok !== false && g.frame === 'phobos' && !rq().active && c3() === m0 + 200, `${JSON.stringify(x).slice(0, 120)} ${JSON.stringify(g)} ${c3() - m0}`);
  g = H.fly(q, 'deimos'); H.advance(1); H.stand(q, 'de-driller'); x = await go({ type: 'mission-accept', id: 'mars-fr-rack' }); g = H.fly(q, 'port'); H.advance(1); H.stand(q, 'cab-weather'); m0 = c3(); H.advance(1);
  check('the driller sends a rack of cores down to the tower: 264 (three runs made a Hauler)', x.ok !== false && g.frame === 'mars' && !rq().active && c3() === m0 + 264, `${JSON.stringify(x).slice(0, 120)} ${JSON.stringify(g)} ${c3() - m0}`); }
const failed = rows.filter((x) => !x).length; console.log(`\n${rows.length - failed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
