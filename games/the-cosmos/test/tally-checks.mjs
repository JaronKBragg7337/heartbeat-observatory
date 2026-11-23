// The tally runs (part 4, "give the yards a reason"): a job that ends AT a side's yard, where the player counts what really stands on the stand and signs the
// number, checked by the real authority against the world clock the yard is drawn from (worlds/yardBook.js, server/missions.mjs count()).
// Run: node test/tally-checks.mjs
import { mkWorld, load } from './_mission-harness.mjs';
const rows = []; const check = (name, ok, detail = '') => { rows.push(ok); console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : '  ' + detail)); };
const C = await load('src/missions/catalog.js'), T = await load('src/missions/talk.js'), W = await load('src/missions/where.js');
const YB = await load('src/worlds/yardBook.js'), CL = await load('src/space/clock.js'), B = await load('src/roles/balance.js'), SEATS = await load('src/roles/seats.js');
const YC = await load('src/worlds/_kit/yardClock.js'), CT = await load('src/worlds/ceres/timetable.js');

// ---- the book ---------------------------------------------------------------------------------------------------------------------------------------
const TJ = C.MISSIONS.filter((m) => m.steps.some((st) => st.k === 'count'));
const sides = ['earth', 'moon', 'ceres', 'callisto'].flatMap((w) => SEATS.worldById(w).factions);
check(`${TJ.length} tally runs: one for each of the eight home sides, each a freight run that takes no side and ends at the yard`, TJ.length === 8 && sides.length === 8 && sides.every((f) => TJ.some((m) => m.steps[0].tally === f)) && TJ.every((m) => m.repeat && m.side === 'port' && !m.faction && m.steps.length === 1), TJ.map((m) => m.id).join());
check('every tally place is in the world the job says, and its giver stands on the same ground, a short walk away (under 200 m)', TJ.every((m) => { const t = YB.tallyOf(m.steps[0].tally), g = W.resolve(m.giver), p = W.resolve(m.steps[0].to); return t && t.world === m.world && g.frame === p.frame && p.frame === t.frame && Math.hypot(g.x - p.x, g.z - p.z) < 200; }));
check('the cheapest run on each board is a tally, so the first thing its keeper says names the yards', ['s-quarter', 'd-supply', 'e-dispatch', 'c-dispatcher', 'lane-clerk'].every((g) => { const w = W.worldIdOfFrame(W.resolve(g).frame), f = C.offeredBy(g, w, {}).filter((m) => m.repeat)[0]; return f && f.steps[0].k === 'count'; }));
check('the keepers who stand between two yards name both of them in that first line', /Payload Stand 2/.test(C.missionById('earth-fr-tally-skyward').pitch) && /Sea Wall Depot 1/.test(C.missionById('earth-fr-tally-skyward').pitch) && /bunker/.test(C.missionById('ceres-fr-tally-greenhaven').pitch) && /tanks/.test(C.missionById('ceres-fr-tally-greenhaven').pitch) && /Relay Stand/.test(C.missionById('callisto-fr-tally-mystara').pitch) && /Prospectors/.test(C.missionById('callisto-fr-tally-mystara').pitch));
{
  // the kit yards: the book's count is the timetable's stock, piece for piece, over two hours of clock
  let ok = true, seen = 0; const t0 = CL.worldTimeAt(Date.now());
  for (const [key, t] of Object.entries(YB.TALLIES)) {
    if (t.ceres) continue;
    const cfg = YB.YARD_TT[t.yard], tt = YC.makeTimetable(cfg), S = cfg.sides[t.i].stock;
    for (let s = 0; s < 7200; s += 11) { const a = YB.tallyTruth(key, t0 + s), b = Math.round(tt.stockAt(t.i, t0 + s, S.mode, NaN, S.low) * S.max); if (a !== b || a < 0 || a > t.max) ok = false; seen++; }
  }
  check(`the book and the yard's own timetable agree at every moment tried (${seen} moments, six kit yards)`, ok);
  let okC = true;
  for (let s = 0; s < 7200; s += 7) { if (YB.tallyTruth('ironclad', t0 + s) !== Math.ceil(CT.oreLevelAt(t0 + s) / 2) || Math.abs(YB.tallyTruth('greenhaven', t0 + s) - CT.waterLevelAt(t0 + s) * 4) > 1e-9) okC = false; }
  check('Occator Works: bays with ore in them and the tank gauge in quarters come from the Works\' own timetable', okC);
  let all = true, full = true;
  for (const key of Object.keys(YB.TALLIES)) { const vals = new Set(); for (let s = 0; s < 7200; s += 5) { const n = Math.round(YB.tallyTruth(key, t0 + s)); vals.add(n); if (!YB.tallyCheck(key, n, t0 + s).ok) all = false; } if (vals.size < 3) full = false; }
  check('what really stands there is always taken, and every stock really moves (three or more different counts in two hours)', all && full);
  check('a weak home stacks lower than a strong one, and the count follows (strength 0: half; strength 100: full)', YB.stackShare(0) === 0.5 && YB.stackShare(100) === 1 && YB.stackShare(null) === 1 && [0, 100].every((s) => { let ok2 = true; for (let q = 0; q < 3600; q += 13) { const n = Math.round(YB.tallyTruth('fortis', t0 + q, YB.stackShare(s))); if (!YB.tallyCheck('fortis', n, t0 + q, s).ok || n > Math.round(12 * YB.stackShare(s))) ok2 = false; } return ok2; }));
  check('a count is in plain words: "9 crates", "1 bay", "half full"', YB.tallyWords('fortis', 9) === '9 crates' && YB.tallyWords('ironclad', 1) === '1 bay' && YB.tallyWords('greenhaven', 2) === 'half full' && YB.tallyWords('technos', 1) === '1 sealed case');
  // the ship: down while she stands on the stand, otherwise a time until she is
  let shipOk = true; for (const key of Object.keys(YB.TALLIES)) { let down = 0, due = 0; for (let s = 0; s < 3600; s += 9) { const y = YB.yardShipAt(key, t0 + s); if (!y || !y.name) shipOk = false; else if (y.down) down++; else if (y.dueS > 0 && y.dueS < 3000) due++; } if (!down || !due) shipOk = false; }
  check('each side\'s ship is named, is down on her stand part of every hour, and is given a time when she is not', shipOk && /is down on the stand|is due in about|on her way in/.test(YB.yardShipWords('fortis', t0)));
}

// ---- played on the real authority -------------------------------------------------------------------------------------------------------------------
const H = await mkWorld(), world = H.world;
const truth = (m) => { const h = world.roles.homes[m.world]; return Math.round(YB.tallyTruth(m.steps[0].tally, CL.worldTimeAt(H.clock), YB.stackShare(h && Number.isFinite(h.balance) ? B.strengthOf(h) : null))); };
const players = {};
const who = (w) => (players[w] ||= H.start(w, null, 'Tally ' + w));
for (const m of TJ) {
  const { p, ship } = who(m.world), t = YB.tallyOf(m.steps[0].tally), rec = () => H.mine(p) || { done: {}, active: null, log: [] }, act = (a) => H.act(p, a), cr = () => ship.economy.marks / 4;
  const label = `${m.title} (${t.side})`;
  H.stand(p, m.giver);
  const snap = { missions: { [p.id]: rec() } }, frame = W.resolve(m.giver).frame;
  const html = T.view(m.giver, 'x', 'work', snap, p.id, frame);
  let a = await act({ type: 'mission-accept', id: m.id });
  check(`${label}: on the board with its pay, taken at its keeper; the first step says where to walk and what to count`, new RegExp(`data-m="${m.id}"`).test(html) && html.includes(`${m.title} · ${m.pay} credits`) && a.ok !== false && rec().active?.id === m.id && /sign the tally/i.test(a.msg), `${a.msg}`);
  H.advance(2);
  let x = await act({ type: 'mission-count', n: truth(m) });
  check(`${label}: it cannot be counted from the keeper's desk (the true number is refused from there)`, x.ok === false && /Walk over/.test(x.msg) && rec().active?.step === 0, JSON.stringify(x).slice(0, 160));
  H.stand(p, m.steps[0].to); H.advance(1);
  check(`${label}: standing at the stock does not finish it: a number has to be signed`, rec().active?.step === 0);
  const n0 = truth(m), strength0 = (() => { const h = world.roles.homes[m.world]; return h && Number.isFinite(h.balance) ? B.strengthOf(h) : null; })();
  const bad = [...Array(t.max + 1).keys()].reverse().find((v) => !YB.tallyCheck(t.side, v, CL.worldTimeAt(H.clock), strength0).ok), c0 = cr();
  x = await act({ type: 'mission-count', n: bad });
  check(`${label}: a wrong count (${bad}, where ${n0} stands) is not taken and not paid; the hand says to look again`, x.ok !== false && x.wrong === true && /Look again/.test(x.hand) && !x.msg && rec().active?.id === m.id && cr() === c0, JSON.stringify(x).slice(0, 200));
  x = await act({ type: 'mission-count', n: truth(m) });
  check(`${label}: nobody gets paid by trying every number: straight after a wrong count even the right one waits`, x.ok !== false && x.wrong === true && x.waitS > 0 && rec().active?.id === m.id && cr() === c0, JSON.stringify(x).slice(0, 200));
  H.advance(16);
  const n1 = truth(m);
  x = await act({ type: 'mission-count', n: n1 });
  const beat = rec().log.filter((l) => l.kind === 'beat').at(-1)?.text || '';
  check(`${label}: the true count (${YB.tallyWords(t.side, n1)}) is taken: ${m.pay} credits at once, the hand says the number and where the ship is`, x.ok !== false && !x.wrong && !rec().active && cr() === c0 + m.pay && beat.includes(YB.tallyWords(t.side, n1)) && /is down on the stand|is due in about|on her way in/.test(beat) && rec().log.at(-1).kind === 'pay', `${JSON.stringify(x).slice(0, 120)} | ${beat} | ${cr() - c0}`);
  H.stand(p, m.giver);
  a = await act({ type: 'mission-accept', id: m.id });
  check(`${label}: it counts on the freight ticket and is offered again`, a.ok !== false && rec().freight.runs >= 1 && rec().done[m.id].n === 1);
  await act({ type: 'mission-drop' });
}
{
  // near enough: one out is signed (a stack moves while a ship is down), and the hand says what he made it
  const m = C.missionById('moon-fr-tally-technos'), { p, ship } = who('moon'), rec = () => H.mine(p), act = (a) => H.act(p, a);
  H.stand(p, m.giver); await act({ type: 'mission-accept', id: m.id }); H.stand(p, m.steps[0].to); H.advance(1);
  const n = truth(m), off = n >= 10 ? n - 1 : n + 1, c0 = ship.economy.marks / 4;
  const x = await act({ type: 'mission-count', n: off }), beat = rec().log.filter((l) => l.kind === 'beat').at(-1)?.text || '';
  check('one out is near enough to sign, and the hand says so', x.ok !== false && !x.wrong && x.exact === false && !rec().active && ship.economy.marks / 4 > c0 && /near enough to sign/.test(beat), `${n} ${off} ${JSON.stringify(x)} ${beat}`);
  // two runs before made a Hauler of nobody yet; the third freight run does (this player has run two tallies on the Moon and now a third)
  check('tally runs count toward the freight ticket like any freight (three runs: Hauler)', rec().freight.runs === 3 && C.freightRank(rec().freight.runs).name === 'Hauler' && p.title === 'Hauler', `${rec().freight.runs} ${p.title}`);
  const y = await act({ type: 'mission-count', n: 3 });
  check('with no tally run on, a count is refused in plain words', y.ok === false && /no job|Nothing here wants counting/.test(y.msg), y.msg);
  H.stand(p, 'h-guide'); await act({ type: 'mission-accept', id: 'moon-fr-shack' });
  const z = await act({ type: 'mission-count', n: 3 });
  check('and on a job that is not a tally, too', z.ok === false && /Nothing here wants counting/.test(z.msg), z.msg);
}
{
  // "full" is not a free answer. The one case where a full plinth is right while the book says nearly empty: somebody's ship is parked on the stand, so the
  // courier was waved off and carried nothing away. The authority can see a parked ship, and only then takes that count.
  const key = 'technos', t = YB.tallyOf(key), t0 = CL.worldTimeAt(H.clock);
  let s = 0; while (s < 6000 && Math.round(YB.tallyTruth(key, t0 + s)) > 2) s += 5;
  check('"full" is not a free answer: with the stand clear, a full count is refused while the plinth is nearly empty; with a ship parked on the stand it is taken', s < 6000 && !YB.tallyCheck(key, 10, t0 + s).ok && YB.tallyCheck(key, 10, t0 + s, null, true).ok && YB.tallyCheck(key, Math.round(YB.tallyTruth(key, t0 + s)), t0 + s, null, true).ok);
  const PL = await load('src/worlds/moon/place.js'), MF = await load('src/space/moonField.js');
  const { sim } = who('moon'), dir = world.missions;
  const clear = dir.standBlocked(t);
  const keep = { frameId: sim.frameId, pos: { ...sim.flight.pos }, landed: sim.flight.landed };
  sim.frameId = t.frame; Object.assign(sim.flight.pos, PL.outpostToFrame(MF.makeMoon(t.frame).padInfo, t.stand[0] + 4, 0, t.stand[1] - 3)); sim.flight.landed = true;
  const parked = dir.standBlocked(t);
  Object.assign(sim.flight.pos, PL.outpostToFrame(MF.makeMoon(t.frame).padInfo, t.stand[0] + 60, 0, t.stand[1]));
  const beside = dir.standBlocked(t);
  sim.frameId = keep.frameId; Object.assign(sim.flight.pos, keep.pos); sim.flight.landed = keep.landed;
  check('the authority sees a ship parked on a side\'s stand (and not one parked 60 m beside it)', clear === false && parked === true && beside === false, `${clear} ${parked} ${beside}`);
}
const failed = rows.filter((x) => !x).length; console.log(`\n${rows.length - failed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
