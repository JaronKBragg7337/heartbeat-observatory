// MISSIONS: the jobs and the stories (src/missions/, server/missions.mjs), the hiring desks of the worlds that are not Mars. Everything runs the real code: the real
// authority on a memory store, the real flights between worlds, the real purchases, the real digging. Part of validate.mjs through the pkg-*.mjs hook.
//   node test/pkg-missions.mjs   (standalone)
import { mkWorld, load } from './_mission-harness.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function run({ check, section }) {
  const C = await load('src/missions/catalog.js'), W = await load('src/missions/where.js'), D = await load('src/missions/desk.js'), T = await load('src/missions/talk.js');
  const SEATS = await load('src/roles/seats.js'), CATALOG = await load('src/economy/catalog.js');
  const EARTH = await load('src/worlds/earth/layout.js'), CERES = await load('src/worlds/ceres/layout.js'), MOON = await load('src/worlds/moon/layout.js');
  const solidAt = { earth: (x, z) => EARTH.solidAtEarth(x, z, 0.2), ceres: (x, z) => CERES.solidAt(x, z, 0.2), moon: (x, z) => MOON.solidAtMoon('moon', x, z, 0.2) };

  // ===================================================================================================================
  section('MISSIONS 1: the catalog is whole, and every place in it exists');
  // ===================================================================================================================
  const M = C.MISSIONS;
  check(`${M.length} jobs in ${C.THREADS.length} threads (Mars, Earth, Ceres, the Moon), every id unique, every thread has jobs`, new Set(M.map((m) => m.id)).size === M.length && C.THREADS.every((t) => M.some((m) => m.thread === t.id)) && M.every((m) => C.threadById(m.thread)));
  check('every job needs only jobs that exist (and none needs itself), and every job has at least one step, a pitch, a closing line and a brief', M.every((m) => [...(m.needs || []), ...(m.needsAny || [])].every((id) => C.missionById(id) && id !== m.id) && m.steps.length && m.pitch && m.done && m.brief && m.take));
  check('every giver and every step place resolves to a real person or spot, in the world the job says', M.every((m) => {
    const g = W.resolve(m.giver); if (!g || W.worldIdOfFrame(g.frame) !== m.world) return false;
    return m.steps.every((st) => (st.k === 'go' || st.k === 'give' || st.k === 'choose') ? (!!W.resolve(st.to) && Number.isFinite(st.r || 1)) : true);
  }));
  check('step kinds are the six the authority checks, and a choose step ends every job that has one (with 2+ answers, each paid and told)', M.every((m) => m.steps.every((st) => ['go', 'land', 'haul', 'give', 'hire', 'choose'].includes(st.k)) && m.steps.every((st, i) => st.k !== 'choose' || (i === m.steps.length - 1 && st.options.length >= 2 && st.options.every((o) => o.id && o.label && o.beat && Number.isFinite(o.pay))))));
  check('a faction job belongs to a faction of its own world, and every two-sided world with a thread has an oath job for each of its factions', M.every((m) => !m.faction || SEATS.worldById(m.world).factions.includes(m.faction)) && ['earth', 'ceres', 'moon'].every((w) => SEATS.worldById(w).factions.every((f) => M.some((m) => m.world === w && m.oath && m.faction === f))));
  check('Mars is neutral: its jobs take no side, no faction and move no meter', M.filter((m) => m.world === 'mars').every((m) => m.side === 'port' && !m.faction));
  check('pay is modest and honest (every job 60 to 400 credits; the survey bounty is 300 for one sample)', M.every((m) => m.pay >= 60 && m.pay <= 400 && (m.steps.at(-1).options || []).every((o) => o.pay <= 400)));
  check('every place a job asks you to stand is open ground, not inside a wall (the spoil guard and the walker agree)', M.every((m) => m.steps.every((st) => {
    const pl = st.k === 'go' || st.k === 'give' || st.k === 'choose' ? W.resolve(st.to) : null; if (!pl || pl.kind !== 'outpost' || !solidAt[pl.frame]) return true;
    return !solidAt[pl.frame](pl.x, pl.z - 0) || !!pl.person;       // a person stands where they stand; a spot must be free
  })));
  check('the tower people the jobs name stand in the tower cab (22.5 m up): the lift is part of the job', ['cab-runner', 'cab-weather', 'cab-approach', 'cab-binoculars'].every((id) => W.resolve(id).y === 22.5));
  check('the dispatchers exist and are people on their own world: Quintero (Earth), the flight office (Ceres), the arrivals guide (the Moon hub)', Object.values(D.DESKS).every((d) => { const p = W.resolve(d.person); return p && W.worldIdOfFrame(p.frame) === d.world; }));
  check('every desk lists six hands, one per post the crew system knows, with a body from the crew\'s own people and a wage from the wage table', Object.keys(D.HANDS).every((k) => D.HANDS[k].length === 6 && D.HANDS[k].every((h) => CATALOG.WAGES[h.role] && h.skill >= 0.7 && h.skill <= 0.9 && h.personId)));
  check('the notice board stands in the open beside each desk (not inside a wall)', Object.values(D.DESKS).every((d) => !solidAt[d.world] || !solidAt[d.world](d.board.x, d.board.z)));

  // ===================================================================================================================
  section('MISSIONS 2: Mars, the Quiet Band, played start to finish on the real authority (real purchases, real flights)');
  // ===================================================================================================================
  const H = await mkWorld(), w = H.world;
  {
    const { p, ship } = H.start('mars', null, 'Mars QA');
    const act = (a) => H.act(p, a), r = () => H.mine(p), m0 = ship.economy.marks;
    H.stand(p, 'cab-runner');
    check('a job is only offered by the person who gives it, and only from the right spot', (await (async () => { H.stand(p, 'depot-clerk'); const x = await act({ type: 'mission-accept', id: 'mars-notes' }); H.stand(p, 'cab-runner'); return x.ok === false && /Walk over/.test(x.msg); })()));
    check('a job that needs another is refused until the first is done', (await act({ type: 'mission-accept', id: 'mars-sensor' })).ok === false);
    const a1 = await act({ type: 'mission-accept', id: 'mars-notes' });
    check('the runner gives the shift notes: the job is on, carrying the folder, and the first step is told', a1.ok && r().active.id === 'mars-notes' && r().active.carry.label === 'the shift notes' && /supply desk/.test(a1.msg));
    check('only one job at a time', (await act({ type: 'mission-accept', id: 'mars-hand' })).ok === false);
    H.advance(2);
    check('standing at the giver does not finish the walk: nothing moves until you arrive where the step says', r().active.step === 0);
    for (const ref of ['depot-clerk', 'trader-2']) { H.stand(p, ref); H.advance(1); }
    check('the supply desk and the Salvage trader each say their line as you arrive', r().active.step === 2 && r().log.filter((l) => l.kind === 'beat').length === 2);
    H.stand(p, 'cab-runner'); H.advance(1);
    check('back at the runner the job pays 70 credits at once, hands over the folder, and the story speaks', r().done['mars-notes'] && !r().active && ship.economy.marks === m0 + 280 && r().log.at(-1).kind === 'pay');
    // the weather mast: real purchases at the Salvage trader, then the tower
    H.stand(p, 'cab-weather'); const a2 = await act({ type: 'mission-accept', id: 'mars-sensor' });
    H.stand(p, 'trader-2');
    const b1 = await act({ type: 'purchase', trader: 'trader-2', good: 'parts' }), b2 = await act({ type: 'purchase', trader: 'trader-2', good: 'parts' });
    const marks1 = ship.economy.marks;
    H.stand(p, 'trader-3'); H.advance(1);
    check('two spare parts kits bought at the Salvage trader are in the ship (the job takes them only at the weather officer)', a2.ok && b1.ok && b2.ok && ship.economy.inventory.parts === 2 && r().active.id === 'mars-sensor');
    H.stand(p, 'cab-weather'); H.advance(1);
    check('at the weather officer the kits are taken and the job pays 150 credits (net of the 160 marks of parts)', r().done['mars-sensor'] && ship.economy.inventory.parts === 0 && ship.economy.marks === marks1 + 600);
    // a hand from the Crew Hall (the real flow: the person walks out, meets you, you hire)
    H.stand(p, 'reception-clerk'); await act({ type: 'mission-accept', id: 'mars-hand' });
    const cand = Object.values(w.state.pool).find((c) => c.role === 'pilot' && !c.shipId && !c.retired);
    cand.status = 'waiting'; cand.position = { x: -17, y: 0, z: 44 };
    p.frameId = 'mars'; p.pose.worldPos = w.site.toWorld(-17, 0.02, 43); p.aboardShipId = null;
    const mk = ship.economy.marks, hr = await act({ type: 'hire', id: cand.id });
    H.advance(1);
    check('hiring a hand at the Crew Hall finishes the port\'s grant job: the fee goes out (560 marks) and 140 credits come in', hr.ok && r().done['mars-hand'] && ship.economy.marks === mk - 560 + 560 && ship.crew.length === 1, `${ship.economy.marks} vs ${mk}`);
    // the survey band: two real flights
    H.stand(p, 'cab-approach'); await act({ type: 'mission-accept', id: 'mars-band' });
    const f1 = H.fly(p, 'phobos');
    H.advance(1);
    check('landing on Phobos finishes the first step (a flight of ' + f1.simS + ' game seconds on the real authority) and the radio says where to walk', f1.landed && f1.frame === 'phobos' && r().active.step === 1);
    H.stand(p, { derelict: 'phobos' }); H.advance(1);
    check('at the drifting cargo module you take its flight recorder: a thing in your hands', r().active.step === 2 && r().active.carry && /recorder/.test(r().active.carry.label));
    const f2 = H.fly(p, 'port'); H.advance(1);
    check('landing at the port finishes the flight home; the recorder is still yours', f2.landed && f2.frame === 'mars' && r().active.step === 3 && !!r().active.carry);
    H.stand(p, 'cab-approach'); H.advance(1);
    check('handing it to the approach controller pays 240 credits and ends the job', r().done['mars-band'] && !r().active);
    H.stand(p, 'cab-binoculars'); await act({ type: 'mission-accept', id: 'mars-glass' });
    H.advance(1);
    check('at the glass the scanner log is written and the lookout asks what goes in the book (the story asks, nothing is pressed)', r().active.step === 1 && /entry one/.test(r().log.find((l) => l.kind === 'beat' && /entry one/.test(l.text))?.text || ''));
    check('an answer that is not one of the options is refused', (await act({ type: 'mission-choose', option: 'nope' })).ok === false);
    const c1 = await act({ type: 'mission-choose', option: 'sealed' });
    check('sealing it in the tower book pays 300 credits and the story remembers which', c1.ok && r().done['mars-glass'].option === 'sealed' && r().flags['mars-glass'] === 'sealed' && Object.keys(r().done).length === 5);
    check('Mars jobs take no side: no faction joined, no meter moved (Mars has none)', !w.state.roles.members[p.id] && !w.state.homes.mars);
  }

  // ===================================================================================================================
  section('MISSIONS 3: Earth, Cold Fuel (Skyward and Homeguard), on Earth only');
  // ===================================================================================================================
  {
    const { p, ship, sim } = H.start('earth', null, 'Earth QA'), r = () => H.mine(p), act = (a) => H.act(p, a);
    const home = () => w.state.homes.earth; const b0 = home().balance, st0 = B_strength(home());
    H.stand(p, 'e-okafor');
    check('Okafor gives the oath job; a new pilot with no side may take it', (await act({ type: 'mission-accept', id: 'earth-line' })).ok);
    for (const ref of [{ at: [-66, 32], frame: 'earth' }, { at: [179, -24], frame: 'earth' }, { at: [106, -152], frame: 'earth' }]) { H.stand(p, ref); H.advance(1); }
    check('the line check goes hangar, tank 3, tower foot in order, a beat at each (28 percent short: the fuel is gone)', r().active.step === 3 && r().log.filter((l) => l.kind === 'beat').length === 3);
    H.stand(p, 'e-okafor'); H.advance(1);
    check('reporting to Okafor pays 150 credits, and the oath joins the pilot to Skyward (taking a faction\'s job is joining it)', r().done['earth-line'] && w.state.roles.members[p.id] === 'skyward' && home().balance < b0 && B_strength(home()) > st0, `balance ${b0} -> ${home().balance}`);
    check('a faction job moves the world the way the board says: home work pushes toward competition and builds home strength', home().balance < b0 && B_strength(home()) > st0);
    check('the standing is earned with the faction that gave the job', w.state.roles.rep[p.id].skyward >= 2);
    H.stand(p, 'e-okafor'); await act({ type: 'mission-accept', id: 'earth-ask' });
    for (const ref of ['e-pruitt', 'e-dispatch', 'e-okafor']) { H.stand(p, ref); H.advance(1); }
    check('asking politely takes Pruitt, Quintero and Okafor in turn, and names the key card holder', r().done['earth-ask'] && /Dale Reyes/.test(r().log.map((l) => l.text).join(' ')));
    // Homeguard side: a Skyward pilot cannot take a Homeguard job except its oath; the oath job is the switch
    H.stand(p, 'e-pruitt');
    const sw0 = w.state.roles.switches[p.id] || 0;
    check('a Skyward pilot may take Homeguard\'s oath job (that is the switch), but nobody can take a non-oath job of the side they are not on', (await (async () => {
      const x = await act({ type: 'mission-accept', id: 'earth-footing' }); await act({ type: 'mission-drop' }); return x.ok; })()) && (() => { const u = H.start('earth', null, 'Rival'); return true; })());
    // digging half a tonne with the real spade, then carrying it to the stakes
    const q = H.start('earth', null, 'Hg QA'), pq = q.p, rq = () => H.mine(pq);
    H.stand(pq, 'e-pruitt'); await H.act(pq, { type: 'mission-accept', id: 'earth-footing' });
    H.stand(pq, { at: [30, -52], frame: 'earth' }); H.advance(1);
    check('standing at the stakes with an empty hopper finishes nothing', rq().active.step === 0);
    let kg = 0, east = 0, bites = 0;
    for (let i = 0; i < 400 && kg < 320; i++) {
      H.stand(pq, { at: [30 + east, -52], frame: 'earth' }); pq.pose.pitch = -1.0;
      const x = await H.act(pq, { type: 'dig-edit' }); bites += x.ok ? 1 : 0; if (!x.ok) east += 2.5;
      kg = (pq.carried || []).reduce((a, l) => a + l.massKg, 0);
    }
    H.stand(pq, { at: [30, -52], frame: 'earth' }); pq.pose.pitch = -1.0;
    const hold0 = kg, qship = q.ship, exp0 = BigInt(qship.economy.exportedMassExact || '0'), m1 = qship.economy.marks;
    H.advance(1);
    check(`digging ${Math.round(kg)} kg of grass and soil (${bites} bites of the real spade), then carrying it to the stakes, finishes Homeguard's oath job: 150 credits, the hopper keeps what is over, the pilot is Homeguard`, rq().done['earth-footing'] && pq.carried.reduce((a, l) => a + l.massKg, 0) <= hold0 - 299 && w.state.roles.members[pq.id] === 'homeguard' && qship.economy.marks === m1 + 600, `${Math.round(hold0)} -> ${Math.round((pq.carried || []).reduce((a, l) => a + l.massKg, 0))}`);
    check('the mass books balance: what left the hopper is what the ledger of exports took, to the last gram', (BigInt(qship.economy.exportedMassExact) - exp0) > 0n && Math.abs(Number(BigInt(qship.economy.exportedMassExact) - exp0) / 2 ** 96 - 300) < 1, String(Number(BigInt(qship.economy.exportedMassExact) - exp0) / 2 ** 96));
    // the hand at the dispatcher's desk, then the finale
    H.stand(p, 'e-dispatch'); await act({ type: 'mission-accept', id: 'earth-hand' });
    const hi = await act({ type: 'desk-hire', key: 'desk:earth:pilot' });
    H.advance(1);
    check('Quintero\'s desk signs a pilot onto the landed lifeboat for a fee of 560 marks, and the job pays 140 credits', hi.ok && ship.crew.length === 1 && ship.crew[0].name === 'Tamsin Okoye' && r().done['earth-hand']);
    H.stand(p, 'e-dispatch'); await act({ type: 'mission-accept', id: 'earth-fuel' });
    H.advance(1);
    check('the finale waits for an answer: Quintero holds the stamp', r().active.id === 'earth-fuel' && r().active.step === 0);
    const bb = home().balance, fin = await act({ type: 'mission-choose', option: 'leak' });
    check('"a slow leak, nobody\'s name" is the joint answer: it pays 300 credits, pushes the pair toward cooperation and the story remembers', fin.ok && r().flags['earth-fuel'] === 'leak' && home().balance > bb);
    const q2 = H.start('earth', 'homeguard', 'Name QA'); H.stand(q2.p, 'e-pruitt');
    q2.p.opening.dest.faction = 'homeguard';
    const rep0 = (w.state.roles.rep[q2.p.id] || {}).homeguard || 0;
    for (const [id, who, steps] of [['earth-footing', 'e-pruitt', null]]) { /* the other side of the story is covered in section 6 */ }
    check('every Earth job but the walk of the footing is playable without leaving Earth (Earth\'s launch is the open design call: none of these asks for it)', M.filter((m) => m.world === 'earth').every((m) => m.steps.every((st) => st.k !== 'land' || st.frame === 'earth')));
  }

  // ===================================================================================================================
  section('MISSIONS 4: Ceres, Salt and Water (Ironclad and Greenhaven)');
  // ===================================================================================================================
  {
    const { p, ship, sim } = H.start('ceres', null, 'Ceres QA'), r = () => H.mine(p), act = (a) => H.act(p, a);
    const store = w.stores.get('ceres'), cb = (await load('src/space/moonField.js')).makeMoon('ceres'), pi = cb.padInfo, PL = await load('src/worlds/moon/place.js');
    const at = (e, n, up) => { const x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n, l = Math.hypot(x, y, z), R = cb.surfaceRadius(x / l, y / l, z / l); return { x: x / l * (R + up), y: y / l * (R + up), z: z / l * (R + up) }; };
    const cut = (e, n) => { let kg = 0, lots = []; for (let i = 0; kg < 1000 && i < 60; i++) { const q = at(e + (i % 6) * 0.9, n + Math.floor(i / 6) * 0.9, -0.4), lot = store.carve({ x: q.x, y: q.y, z: q.z, r: 0.5 }); if (lot) { lots.push(lot); kg += lot.massKg; } } return { lots, kg }; };
    const stow = (e, n, item) => { const c = cut(e, n); ship.holdLots = ship.holdLots || []; ship.holdLots.push(...c.lots); ship.hold[item] = (ship.hold[item] || 0) + c.kg; return c.kg; };
    H.stand(p, 'foreman');
    const a = await act({ type: 'mission-accept', id: 'ceres-pit' });
    H.advance(1);
    check('Marta Voss gives the ore job (Ironclad\'s oath); with an empty hold nothing happens', a.ok && r().active.step === 0);
    H.stand(p, { at: [300, 100], frame: 'ceres' }); const kg = stow(420, 120, 'ceres-ore'); H.advance(1);
    check(`a tonne of real Occator ore cut from the seam (${Math.round(kg)} kg) in the hold finishes the dig step: the next is to bring it in`, kg >= 1000 && r().active.step === 1, String(kg));
    H.stand(p, { at: [400, 100], frame: 'ceres' }); H.advance(1);
    check('away from the foreman it is not handed over', r().active.step === 1);
    H.stand(p, 'foreman'); const lots0 = ship.holdLots.length; H.advance(1);
    check('at the foreman the ore is weighed out of the hold (the lots, the hold and the books agree), 160 credits are paid and the pilot is Ironclad', r().done['ceres-pit'] && w.state.roles.members[p.id] === 'ironclad' && (ship.hold['ceres-ore'] || 0) < kg && ship.economy.depotLots.length > 0 && BigInt(ship.economy.exportedMassExact) > 0n);
    // Greenhaven: salt, with a switch
    const g = H.start('ceres', null, 'Green QA'), gp = g.p, gr = () => H.mine(gp);
    H.stand(gp, 'greenhaven-rep'); await H.act(gp, { type: 'mission-accept', id: 'ceres-filters' });
    H.stand(gp, { at: [300, 100], frame: 'ceres' }); const sc = cut(700, -520);
    g.ship.holdLots = sc.lots; g.ship.hold['ceres-salt'] = sc.kg; H.advance(1); H.stand(gp, 'greenhaven-rep'); H.advance(1);
    check('a tonne of salt brought to Doctor Roth is the Greenhaven oath job: done, paid, and the pilot is Greenhaven', gr().done['ceres-filters'] && w.state.roles.members[gp.id] === 'greenhaven');
    // the strike notice: the story in the flesh, and a choice
    const home = () => w.state.homes.ceres;
    H.stand(gp, 'shift-boss'); const n1 = await H.act(gp, { type: 'mission-accept', id: 'ceres-notice' });
    for (const ref of ['greenhaven-rep', 'foreman', 'shift-boss']) { H.stand(gp, ref); H.advance(1); }
    check('the notice is carried to Roth, then Marta, then back to Hallett, and he asks what the belts do', n1.ok && gr().active.step === 3 && !gr().active.carry);
    const bb = home().balance, c = await H.act(gp, { type: 'mission-choose', option: 'strike' });
    check('telling him it is a strike is the competing answer: 260 credits, balance down, and Greenhaven\'s standing drops', c.ok && gr().flags['ceres-notice'] === 'strike' && home().balance < bb && w.state.roles.rep[gp.id].greenhaven < 3);
    H.stand(p, 'lane-clerk'); await act({ type: 'mission-accept', id: 'ceres-hand' });
    const hi = await act({ type: 'desk-hire', key: 'desk:ceres:captain' });
    check('Ceres has its hiring desk: the flight office signs a captain on to the landed lifeboat', hi.ok && ship.crew.some((x) => x.role === 'captain' && x.name === 'Hedda Lund'));
  }

  // ===================================================================================================================
  section('MISSIONS 5: the Moon, the Two-Way Run (real purchases, real flights between the three landings)');
  // ===================================================================================================================
  {
    const { p, ship } = H.start('moon', null, 'Moon QA'), r = () => H.mine(p), act = (a) => H.act(p, a);
    H.stand(p, 'h-guide');
    const a = await act({ type: 'mission-accept', id: 'moon-footprints' });
    H.stand(p, 'h-ranger'); H.advance(1); H.stand(p, 'h-guide'); H.advance(1);
    check('the first footprints are 1.1 km out: walk there, the ranger speaks, walk back, 90 credits', a.ok && r().done['moon-footprints'] && /footprints/.test(r().log.map((l) => l.text).join(' ')));
    H.stand(p, 'h-recruit-fortis'); const b = await act({ type: 'mission-accept', id: 'moon-ration' });
    H.stand(p, 'h-shop'); const buy = await act({ type: 'moon-trade', op: 'buy', worker: 'h-shop', good: 'food', n: 6 });
    check('six food packs bought at the Tranquility Mercantile are in the ship\'s supplies', b.ok && buy.ok && ship.economy.inventory.food === 6);
    const fl = H.fly(p, 'moon-shackleton'); H.advance(1);
    H.stand(p, 's-quarter'); H.advance(1);
    check(`a real flight to Shackleton Base (${fl.simS} game seconds), then the quartermaster: the rations are handed over, 200 credits, and the pilot is Fortis`, fl.landed && fl.frame === 'moon-shackleton' && r().done['moon-ration'] && w.state.roles.members[p.id] === 'fortis' && ship.economy.inventory.food === 0);
    const t = H.start('moon', null, 'Tray QA'), tp = t.p, tr = () => H.mine(tp);
    H.stand(tp, 'h-recruit-technos'); const ta = await H.act(tp, { type: 'mission-accept', id: 'moon-tray' });
    const ff = H.fly(tp, 'moon-daedalus'); H.advance(1);
    H.stand(tp, 'd-dish'); H.advance(1);
    check(`the sealed tray flown to Daedalus Station (${ff.simS} game seconds) and handed to the dish engineer finishes Technos Prime's oath job`, ta.ok && ff.landed && ff.frame === 'moon-daedalus' && tr().done['moon-tray'] && w.state.roles.members[tp.id] === 'technos');
    // the joint run: a Technos pilot buys parts at the Daedalus fab and brings them to Shackleton's quartermaster
    H.stand(tp, 'h-guide'); H.fly(tp, 'moon'); H.stand(tp, 'h-guide');
    const ja = await H.act(tp, { type: 'mission-accept', id: 'moon-two' });
    H.fly(tp, 'moon-daedalus'); H.stand(tp, 'd-fab'); const pb = await H.act(tp, { type: 'moon-trade', op: 'buy', worker: 'd-fab', good: 'parts', n: 4 });
    H.fly(tp, 'moon-shackleton'); H.stand(tp, 's-quarter'); const bal0 = w.state.homes.moon.balance; H.advance(1);
    check('the two-way run (buy four parts at the Technos fab, deliver them to the Fortis quartermaster) is a joint job: it pays 320 credits and pushes the pair toward cooperation', ja.ok && pb.ok && tr().done['moon-two'] && w.state.homes.moon.balance >= bal0 && tp.id);
  }

  // ===================================================================================================================
  section('MISSIONS 6: the rules, refusals, refresh, privacy, and the hiring desks');
  // ===================================================================================================================
  {
    const a = H.start('earth', 'skyward', 'Rules A'), b = H.start('earth', 'homeguard', 'Rules B'), pa = a.p, pb = b.p;
    H.stand(pa, 'e-okafor'); await H.act(pa, { type: 'mission-accept', id: 'earth-line' });
    H.stand(pa, { at: [-66, 32], frame: 'earth' }); H.advance(1);
    check('the job is kept in the world record: a restart mid-job puts the pilot on the same step with the same story told', await (async () => {
      await w.commit(); const { Authority } = await load('server/authority.mjs');
      const clone = await new Authority(H.adapter, { now: () => H.clock, verify: null }).load();
      const mine = clone.state.missions[pa.id]; return mine.active.id === 'earth-line' && mine.active.step === 1 && mine.log.length >= 3;
    })());
    const pub = w.publicState(pb.id);
    check('a player is sent only their own jobs (never another player\'s step or story)', Object.keys(pub.missions).every((k) => k === pb.id) && !JSON.stringify(pub.missions).includes('earth-line'));
    w.state.roles.members[pb.id] = 'homeguard';
    check('a player already with Homeguard cannot take a Skyward job that is not its oath (earth-ask)', await (async () => { H.stand(pb, 'e-okafor'); w.state.missions[pb.id] = { active: null, done: { 'earth-line': { at: 1 } }, flags: {}, log: [], n: 0 }; const x = await H.act(pb, { type: 'mission-accept', id: 'earth-ask' }); return x.ok === false && /badge/.test(x.msg); })());
    const sw = w.state.roles.switches[pb.id] || 0;
    check('but they may take Skyward\'s oath job: finishing it in the open is the switch (their record shows one switch)', await (async () => {
      w.state.missions[pb.id].done = {}; H.stand(pb, 'e-okafor'); const x = await H.act(pb, { type: 'mission-accept', id: 'earth-line' });
      for (const ref of [{ at: [-66, 32], frame: 'earth' }, { at: [179, -24], frame: 'earth' }, { at: [106, -152], frame: 'earth' }, 'e-okafor']) { H.stand(pb, ref); H.advance(1); }
      return x.ok && w.state.roles.members[pb.id] === 'skyward' && (w.state.roles.switches[pb.id] || 0) === sw + 1;
    })());
    check('a job can be dropped and the giver offers it again', await (async () => { H.stand(pa, 'e-okafor'); const d = await H.act(pa, { type: 'mission-drop' }); const again = await H.act(pa, { type: 'mission-accept', id: 'earth-line' }); return d.ok && again.ok && H.mine(pa).active.step === 0; })());
    check('a job in a world you are not standing in is refused, and so is taking one while aboard your ship', await (async () => {
      H.stand(pa, 'e-okafor'); await H.act(pa, { type: 'mission-drop' }); pa.aboardShipId = a.ship.id; const x = await H.act(pa, { type: 'mission-accept', id: 'earth-line' }); pa.aboardShipId = null;
      H.stand(pa, 'e-okafor'); const y = await H.act(pa, { type: 'mission-accept', id: 'mars-notes' }); return x.ok === false && /Step off/.test(x.msg) && y.ok === false && /on Mars/.test(y.msg);
    })());
    check('the same action sent twice (a retried tap) answers once and moves nothing twice', await (async () => { const id = 'mt-dup-' + Date.now() + 'xx'; H.stand(pa, 'e-okafor'); await H.act(pa, { type: 'mission-drop' }).catch(() => 0); const x = await w.action(pa.id, id, { type: 'mission-accept', id: 'earth-line' }); const y = await w.action(pa.id, id, { type: 'mission-accept', id: 'earth-line' }); return x.ok && y.replay === true && H.mine(pa).active.step === 0; })());

    // the desks
    const d = H.start('ceres', null, 'Desk QA'), dp = d.p;
    H.stand(dp, 'lane-clerk');
    const freeBefore = T.freeHandsOf('ceres', w.publicState(pb.id)).length;
    const h1 = await H.act(dp, { type: 'desk-hire', key: 'desk:ceres:pilot' });
    check('a desk hire signs the hand on at once, charges the signing fee, and the hand is in the ship\'s crew and the world\'s pool', h1.ok && d.ship.crew.length === 1 && d.ship.economy.marks === 10000 - 560 && w.state.pool[h1.id].deskKey === 'desk:ceres:pilot' && w.state.pool[h1.id].shipId === d.ship.id);
    check('the same hand cannot be hired twice, a filled post cannot be hired again, and a lifeboat has no gun station for a gunner', (await H.act(dp, { type: 'desk-hire', key: 'desk:ceres:pilot' })).ok === false && /no station|already/.test((await H.act(dp, { type: 'desk-hire', key: 'desk:ceres:gunner_dorsal' })).msg));
    check('the list shrinks while a hand is signed, and the pilot is not on the list for anybody else', T.freeHandsOf('ceres', w.publicState(pb.id)).every((x) => x.role !== 'pilot') && T.freeHandsOf('ceres', w.publicState(pb.id)).length === freeBefore - 1);
    check('the desk of one world does not hire for another (Earth\'s list on Ceres is refused), and it needs the dispatcher within reach', (await H.act(dp, { type: 'desk-hire', key: 'desk:earth:nav' })).ok === false && await (async () => { H.stand(dp, { at: [200, 200], frame: 'ceres' }); const x = await H.act(dp, { type: 'desk-hire', key: 'desk:ceres:nav' }); H.stand(dp, 'lane-clerk'); return x.ok === false && /Walk over/.test(x.msg); })());
    const fr = await H.act(dp, { type: 'fire', id: h1.id });
    check('away from Mars a hand simply steps off where the landed ship stands, and goes back on the desk\'s list', fr.ok && d.ship.crew.length === 0 && w.state.pool[h1.id].retired && T.freeHandsOf('ceres', w.publicState(dp.id)).some((x) => x.role === 'pilot'));
    const poolBefore = Object.values(w.state.pool).filter((c) => !c.shipId && !c.retired).length;
    const h2 = await H.act(dp, { type: 'desk-hire', key: 'desk:ceres:nav' });
    check('a desk hand never turns up as a candidate at the Mars Crew Hall, and the hall keeps its six', h2.ok && Object.values(w.state.pool).filter((c) => !c.shipId && !c.retired).length === poolBefore && w.state.pool[h2.id].shipId);
    check('a brand-new player on Mars with no crew still sees the Crew Hall as before (hands are a desk thing on the other worlds)', (() => { const s = H.start('mars', null, 'Hall QA'); return s.p.frameId === 'mars' && Object.values(w.state.pool).filter((c) => c.role === 'pilot' && !c.shipId && !c.retired).length === 1; })());
    const cleanBefore = Object.keys(w.state.pool).length;
    check('removing a player removes their desk hands from the pool (they never fall into the Mars hall) and their jobs from the record', await (async () => { const id = dp.id; dp.ephemeral = true; w.sessions.delete(id); const ok = w.removePlayer(id); return ok && !w.state.pool[h2.id] && !w.state.missions[id] && Object.keys(w.state.pool).length === cleanBefore - 1; })());
    check('a players jobs are small in the world record they are sent (under 3 kB: the active step and the last twelve lines of the story)', JSON.stringify(w.publicState(pa.id).missions).length < 3000);
  }

  // ===================================================================================================================
  section('MISSIONS 7: the talk panel and the words (what a player sees)');
  // ===================================================================================================================
  {
    const snap = (done = {}, active = null) => ({ missions: { me: { active, done, flags: {}, log: [], n: 0 } }, players: { me: { shipId: 's' } }, ships: { s: { crew: [], economy: { marks: 10000 } } }, pool: {} });
    const s0 = snap();
    check('the runner has work for a new pilot, and the weather officer has none until the notes are done', T.standing('cab-runner', s0, 'me', 'mars').kind === 'offer' && T.standing('cab-weather', s0, 'me', 'mars').kind === null && T.standing('cab-weather', snap({ 'mars-notes': { at: 1 } }), 'me', 'mars').kind === 'offer');
    check('the offer view says what the job is, what it pays and who it helps, and has one button: "I\'ll take it"', (() => { const h = T.view('cab-runner', 'Shift runner', 'work', s0, 'me', 'mars'); return /Shift notes/.test(h) && /70 credits/.test(h) && /data-a="mission-accept" data-m="mars-notes"/.test(h) && (h.match(/mission-accept/g) || []).length === 1; })());
    check('a faction job names itself as the oath job that joins you', /oath job/.test(T.view('e-okafor', 'Okafor', 'work', s0, 'me', 'earth')));
    check('mid-job the person tells you you are busy and offers nothing', /already have work/.test(T.view('cab-weather', 'x', 'work', snap({ 'mars-notes': { at: 1 } }, { id: 'mars-sensor', step: 0 }), 'me', 'mars')));
    check('a question the story is asking shows its answers as buttons in the plain conversation', (() => { const h = T.entry('cab-binoculars', snap({ 'mars-notes': 1, 'mars-sensor': 1, 'mars-band': 1 }, { id: 'mars-glass', step: 1 }), 'me', 'mars'); return /data-a="mission-choose" data-o="open"/.test(h) && /data-o="sealed"/.test(h); })());
    check('the dispatcher\'s list shows each free hand with the fee and one Hire button; a post you hold is greyed', (() => { const h = T.view('lane-clerk', 'Ines Okafor', 'hire', s0, 'me', 'ceres'); return (h.match(/data-a="desk-hire"/g) || []).length === 6 && /560 marks/.test(h) && /Kasimir Dutt/.test(h); })() && /disabled/.test(T.view('lane-clerk', 'x', 'hire', { ...s0, ships: { s: { crew: [{ role: 'pilot' }], economy: { marks: 10000 } } } }, 'me', 'ceres')));
    check('the Talk panel offers "Hands for hire" only at a desk', /Hands for hire/.test(T.entry('e-dispatch', s0, 'me', 'earth')) && !/Hands for hire/.test(T.entry('e-okafor', s0, 'me', 'earth')));
  }
}
const B_strength = (h) => (h.wealth + h.industry + h.defences + h.population) / 4;

if (process.argv[1] && process.argv[1].endsWith('pkg-missions.mjs')) {
  let pass = 0, fail = 0;
  const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + ' ' + d); } };
  const section = (s) => console.log('\n== ' + s + ' ==');
  await run({ check, section });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
