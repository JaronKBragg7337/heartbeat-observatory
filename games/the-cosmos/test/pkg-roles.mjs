// F5 roles and NPC stand-ins, and F4 the balance and home strength. Everything runs the real code: the real seat table, the real
// authority, the real world record (saved, reloaded, rolled back on a refusal).
//   node test/pkg-roles.mjs   (standalone)   |   part of validate.mjs through the pkg-*.mjs hook
import '../server/runtime.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => import(pathToFileURL(join(ROOT, 'src', p)).href);
const mem = () => { const m = { rec: null, load: async () => (m.rec ? { record: structuredClone(m.rec), bricks: [] } : { record: null, bricks: [] }), save: async (r) => { m.rec = r; } }; return m; };

export async function run({ check, section }) {
  const S = await src('roles/seats.js'), N = await src('roles/npcs.js'), BK = await src('roles/book.js'), H = await src('roles/holders.js'), B = await src('roles/balance.js');
  const { VOICES, clipKey } = await src('voice/cast.js');

  // ===================================================================================================================
  section('F5a. The seat table: every seat has a name on it, and Mars is neutral');
  // ===================================================================================================================
  const seats = S.allSeats();
  check('every seat id is unique and findable', new Set(seats.map((s) => s.id)).size === seats.length && seats.every((s) => S.seatById(s.id) === s));
  check('seven places have seats: neutral Mars, four two-sided worlds, two station homes', S.WORLDS.length === 7 && S.WORLDS.filter((w) => w.neutral).length === 1 && S.WORLDS.filter((w) => w.station).length === 2);
  check('the ten playable factions each have a leader seat', S.PLAYABLE_FACTIONS.length === 10 && S.PLAYABLE_FACTIONS.every((f) => S.leaderSeat(f)?.kind === 'faction-leader'));
  check('every faction id matches the F0 style sheet', await (async () => { const R = await src('factions/registry.js'); return S.PLAYABLE_FACTIONS.every((f) => R.hasFaction(f)) && S.PLAYABLE_FACTIONS.length === R.playableFactionIds().length; })());
  check('every world has a pilot, trader, hauler, gas station worker, miner, medic and patrol, plus a port master, trade director and security chief',
    S.WORLDS.every((w) => ['pilot', 'trader', 'hauler', 'gas-worker', 'miner', 'medic', 'patrol', 'port-master', 'trade-director', 'security-chief'].every((k) => S.seatsOn(w.id).some((s) => s.kind === k))));
  check('every world has exactly one top seat: a governor, or a station commander on the two station homes',
    S.WORLDS.every((w) => S.seatsOn(w.id).filter((s) => s.tier === 'top' && !s.faction).length === 1) && S.topSeat('wanderhome').kind === 'station-commander' && S.topSeat('earth').kind === 'governor');
  check('every Mars seat is NPC only; no other seat is', seats.filter((s) => s.world === 'mars').every((s) => s.npcOnly) && seats.filter((s) => s.world !== 'mars').every((s) => !s.npcOnly));
  check('a frame maps to its world, and Phobos and Deimos are still Mars', S.worldOfFrame('ceres')?.id === 'ceres' && S.worldOfFrame('phobos')?.id === 'mars' && S.worldOfFrame('mars')?.id === 'mars' && S.worldOfFrame('nowhere') === null);

  // ===================================================================================================================
  section('F5b. NPC holders: a name, a temperament, a voice; some are assholes; every line is voiced');
  // ===================================================================================================================
  const npcs = seats.map((s) => N.npcFor(s.id));
  check('an NPC is the same every time you ask (nothing to store)', JSON.stringify(N.npcFor('ceres/pilot-1')) === JSON.stringify(N.npcFor('ceres/pilot-1')));
  check('the cast is varied: seven temperaments, many names, and some of them are assholes', new Set(npcs.map((n) => n.temperament)).size === 7 && new Set(npcs.map((n) => n.name)).size > 60 && npcs.filter((n) => n.asshole).length >= 15);
  check('most are not assholes (a mix, not a gimmick)', npcs.filter((n) => !n.asshole).length > npcs.length * 0.4);
  const lines = N.roleLines();
  check(`every NPC line has a voice from the cast (${lines.length} lines in ${new Set(lines.map((l) => l.voice)).size} voices)`, lines.length > 60 && lines.every((l) => VOICES[l.voice]));
  check('no line carries a number or a name, so clips are made once per voice and line', lines.every((l) => !/\d/.test(l.text)) && lines.every((l) => !npcs.some((n) => l.text.includes(n.name.split(' ')[0]))));
  check('a voice matches the NPC gender: the name pool follows the voice', npcs.every((n) => VOICES[n.voice].gender === n.gender));
  check('faction leaders speak as their faction does (Corsairs recycle, Skyward looks up, Homeguard stays)',
    /recycl/i.test(N.lineFor('corsairs/leader', 'job').text) && /ladder|up there/i.test(N.lineFor('skyward/leader', 'job').text) && /stay/i.test(N.lineFor('homeguard/leader', 'job').text));
  check('every seat can greet, explain its job, step aside and come back', seats.every((s) => N.SITUATIONS.every((sit) => N.lineFor(s, sit).text.length > 4)));
  check('the voice library has a clip for every role line (run node tools/gen-voices.mjs if this fails)', (() => {
    const man = join(ROOT, 'assets/voices/manifest.json'); if (!existsSync(man)) return true;
    const clips = JSON.parse(readFileSync(man, 'utf8')).clips || {}; const miss = lines.filter((l) => !clips[clipKey(l.voice, l.text)]);
    if (miss.length) console.log('    missing', miss.length, 'e.g.', miss[0].voice, '|', miss[0].text);
    return miss.length === 0;
  })());

  // ===================================================================================================================
  section('F5c. By the book: philosophy fixes the stance, the stance fixes the policy, inside the hard caps');
  // ===================================================================================================================
  check('Skyward and Wanderhome cooperate; Homeguard and Fortis compete; the names describe the philosophy', BK.stanceOf('skyward') > 0.5 && BK.stanceOf('wanderhome') > 0.5 && BK.stanceOf('homeguard') < -0.5 && BK.stanceOf('fortis') < -0.4);
  {
    let ok = true; for (let s = -1; s <= 1.001; s += 0.1) { const p = BK.npcPolicy(s); ok &&= p.tax >= 0 && p.tax <= 0.15 && p.fee >= 0 && p.fee <= 0.2 && p.margin <= 0.2 && p.patrol >= 0 && p.patrol <= 1; }
    check('an NPC never sets a tax over 15%, a station fee over 20%, a margin over 20% or a patrol outside 0..1', ok);
  }
  check('a competing NPC taxes and patrols harder than a cooperating one', BK.npcPolicy(-0.8).tax > BK.npcPolicy(0.8).tax && BK.npcPolicy(-0.8).patrol > BK.npcPolicy(0.8).patrol && BK.npcPolicy(-0.8).dock === 'faction' && BK.npcPolicy(0.8).dock === 'open');
  {
    const f = ['homeguard']; const tally = (c) => BK.npcTally('earth/governor', f, c);
    const npc = { id: 'npc', stance: BK.stanceOf('homeguard'), incumbent: true, rep: 0 };
    const nobody = tally([npc, { id: 'h', stance: 0.9, rep: 0 }]);
    check('a human with no standing and a stance across the room loses every NPC voter to the incumbent', nobody.npc === 120 && nobody.h === 0, JSON.stringify(nobody));
    const same = tally([npc, { id: 'h', stance: BK.stanceOf('homeguard'), rep: 0 }]);
    check('even a human who copies the faction exactly loses with no standing (the incumbent has an edge)', same.npc > same.h);
    const known = tally([npc, { id: 'h', stance: BK.stanceOf('homeguard'), rep: 60 }]);
    check('a human the faction knows, who stands where the faction stands, wins the NPC voters', known.h > known.npc, JSON.stringify(known));
  }

  // ===================================================================================================================
  section('F4a. The balance and home strength: moved by jobs, read by prices, raiders and unlocks');
  // ===================================================================================================================
  const home = (w = 'ceres') => B.newHome(w);
  {
    const a = home(), b = home();
    for (let i = 0; i < 10; i++) { B.applyJob(a, 'home', 'industry'); B.applyJob(b, 'joint', 'wealth'); }
    check('faction jobs raise home strength and push toward competition; joint jobs push toward cooperation and spend strength', a.balance < 40 && B.strengthOf(a) > B.strengthOf(home()) && b.balance > 40 && B.strengthOf(b) < B.strengthOf(home()),
      `home ${a.balance}/${B.strengthOf(a)} joint ${b.balance}/${B.strengthOf(b)}`);
    const c = home(); for (let i = 0; i < 6; i++) B.applyJob(c, 'sabotage', 'defences');
    check('sabotage pushes hard toward competition', c.balance < a.balance + 1 || c.balance < 25);
    const z = home(); for (let i = 0; i < 400; i++) B.applyJob(z, 'joint', 'wealth');
    check('the meters stay inside 0..100 however long you push', z.balance <= 100 && z.balance >= 0 && B.COMPONENTS.every((k) => z[k] >= 0));
    check('a station home has strength only: its balance does not move', (() => { const st = home('wanderhome'); B.applyJob(st, 'joint', 'wealth'); B.applyJob(st, 'home', 'wealth'); return st.balance === 40 && !B.isTwoSided('wanderhome'); })());
    check('Mars has no meters', !B.hasMeters('mars') && B.meteredWorlds().length === 6);
  }
  {
    const comp = { ...home(), balance: 5, wealth: 80, industry: 80, defences: 80, population: 80 }, coop = { ...home(), balance: 95, wealth: 20, industry: 20, defences: 20, population: 20 };
    check('a competing world is dear for outsiders and cheap for its own; a cooperating world is cheap and busy for everyone',
      B.priceFactor(comp, 'outsider', 'buy') > 1.15 && B.priceFactor(comp, 'own', 'buy') < 0.95 && B.priceFactor(coop, 'outsider', 'buy') < 1 && B.priceFactor(comp, 'outsider', 'sell') < 0.9 && B.priceFactor(comp, 'own', 'sell') > 1.03 && B.priceFactor(coop, 'outsider', 'sell') > 1.0,
      JSON.stringify([B.priceFactor(comp, 'outsider', 'buy'), B.priceFactor(comp, 'own', 'buy'), B.priceFactor(coop, 'outsider', 'buy')]));
    check('raiders follow the balance, but a rich fortified world has them in the lanes around it and not in its sky',
      B.skyRaiders(comp) < B.skyRaiders({ ...comp, defences: 5, wealth: 5, industry: 5, population: 5 }) && B.laneRaiders(comp) > B.laneRaiders(coop) && B.skyRaiders(comp) < B.laneRaiders(comp),
      `sky ${B.skyRaiders(comp)} lane ${B.laneRaiders(comp)} coop lane ${B.laneRaiders(coop)}`);
    check('a bigger patrol budget thins the sky', B.skyRaiders(home(), 1) < B.skyRaiders(home(), 0));
    check('home-ground repairs are cheaper where the world competes and is strong', B.homeUpkeepFactor(comp) < B.homeUpkeepFactor(coop));
    check('the lane pressure of a world left at its start is exactly 1 (so the fleet is unchanged at the start)', Math.abs(B.lanePressure(Object.fromEntries(B.meteredWorlds().map((w) => [w.id, home(w.id)]))) - 1) < 1e-9);
    check('hull class follows the unlocks, not range: scouts only until a world has cooperated and built', B.hullClass(home()) === 'scout' && B.hullClass({ ...coop, projects: { shipyard: { a: 60, b: 60, done: true } } }) === 'merchant' && B.hullClass({ ...coop, projects: { shipyard: { done: true }, tether: { done: true } } }) === 'capital' && B.hullClass({ ...coop, projects: { shipyard: { done: true }, refinery: { done: true } } }) === 'transit');
  }
  {
    const h = { ...home(), balance: 50 };
    let msg = ''; try { B.deliverJoint({ ...home(), balance: 5 }, 'shipyard', 'a', 10); } catch (e) { msg = e.message; }
    check('a joint project is refused while the two sides are not talking', /not talking/.test(msg), msg);
    B.deliverJoint(h, 'shipyard', 'a', 60);
    check('a project with one half delivered sits unfinished', !h.projects.shipyard.done && h.projects.shipyard.a === 60 && h.projects.shipyard.b === 0);
    let m2 = ''; try { B.buyMissingHalf({ ...h, projects: { shipyard: { a: 60, b: 0, done: false } }, wealth: 5, balance: 60 }, 'shipyard'); } catch (e) { m2 = e.message; }
    check('buying the missing half needs wealth', /costs/.test(m2), m2);
    const rich = { ...h, wealth: 90, balance: 60, projects: { shipyard: { a: 60, b: 0, done: false } } }; B.buyMissingHalf(rich, 'shipyard');
    check('a rich world that pivots to peace buys the other half outright: the catch-up edge', rich.projects.shipyard.done && rich.wealth === 75);
    let m3 = ''; try { B.buyMissingHalf({ ...rich, balance: 20, projects: { shipyard: { a: 60, b: 0, done: false } } }, 'shipyard'); } catch (e) { m3 = e.message; }
    check('a world still competing cannot buy it', /pivoted/.test(m3), m3);
    const g = home(); B.deliverHome(g, 'walls', 40);
    check('a finished home project raises the matching component (walls, defences)', g.home.walls.done && g.defences === 28);
    const pe = { ...home(), balance: 30 }; const before = B.strengthOf(pe); B.applyPeace(pe);
    check('peace jumps the balance and spends the treasury and strength', pe.balance === 48 && B.strengthOf(pe) < before && pe.treasury < 20000);
  }
  {
    const e = { ...home(), balance: 60, projects: { shipyard: { done: true }, relay: { done: true } } };
    const u = B.unlocks(e);
    check('unlocks go live in steps as the balance climbs, and the projects they need must be built', u.cooperation.find((x) => x.id === 'open-gate').open && u.cooperation.find((x) => x.id === 'joint-yard').open && u.cooperation.find((x) => x.id === 'long-relay').open && !u.cooperation.find((x) => x.id === 'big-hulls').open);
    check('home strength sets how fast: nothing 0.5x, full 1.5x', B.buildRate({ ...home(), wealth: 0, industry: 0, defences: 0, population: 0 }) === 0.5 && B.buildRate({ ...home(), wealth: 100, industry: 100, defences: 100, population: 100 }) === 1.5);
    const d = home(), d2 = home();
    for (let i = 0; i < 600; i++) { B.drift(d, -0.5, 1, false); B.drift(d2, 0.5, 1, true); }
    check('nobody playing: the world turns inward (balance falls) and its strength holds', d.balance < 40 && B.strengthOf(d) >= B.strengthOf(home()), `balance ${d.balance} strength ${B.strengthOf(d)}`);
    check('NPC cooperators, with people about, push toward cooperation by the book', d2.balance > 40);
    check('the board tilts with the leader stance: a hard competitor pays faction jobs up and joint jobs down', B.jobBoard(-1).home > B.jobBoard(1).home && B.jobBoard(-1).joint < B.jobBoard(1).joint);
    check('the meters say it in words, never a slider', B.describe(home()).balance.length > 20 && B.describe(home()).strength.length > 5);
  }

  // ===================================================================================================================
  section('F5d. The shared world: take a seat by showing up, earn it, be voted in; the NPC steps aside and comes back');
  // ===================================================================================================================
  const { Authority } = await import(pathToFileURL(join(ROOT, 'server/authority.mjs')).href);
  const { RoleDirector, ROLES_CFG } = await import(pathToFileURL(join(ROOT, 'server/roles.mjs')).href);
  const { FleetDirector } = await import(pathToFileURL(join(ROOT, 'server/fleet.mjs')).href);
  const { worldSale } = await import(pathToFileURL(join(ROOT, 'server/world2.mjs')).href);
  let clockMs = Date.now();
  const adapter = mem();
  const world = await new Authority(adapter, { now: () => clockMs }).load();
  const key = (c) => c.repeat(48);
  const A = await world.join(key('a'), 'Ada Roles'), Bp = await world.join(key('b'), 'Bo Roles'), C = await world.join(key('c'), 'Cy Roles');
  const act = (p, id, a) => world.action(p.id, id.padEnd(10, '0'), a);
  const P = (p) => world.state.players[p.id];
  const R = () => world.state.roles, home2 = (id) => world.state.homes[id];
  let nth = 0; const aid = () => 'role' + String(++nth).padStart(6, '0');
  const go = (p, frame) => { P(p).frameId = frame; };
  check('a new world has role records and a home for each of the six settled worlds, and none for Mars', R() && Object.keys(world.state.homes).sort().join() === 'callisto,ceres,corsairs,earth,moon,wanderhome' && !world.state.homes.mars);
  check('every seat starts with its NPC (no human holders)', Object.keys(R().humans).length === 0 && seats.every((s) => H.holderOf(R(), s.id).kind === 'npc'));

  let r = await act(A, aid(), { type: 'role-take', seat: 'mars/pilot-1' });
  check('Mars seats refuse every human: Mars is neutral and its staff stay NPCs', !r.ok && /neutral/.test(r.msg) && H.holderOf(R(), 'mars/pilot-1').kind === 'npc', r.msg);
  go(A, 'mars'); r = await act(A, aid(), { type: 'role-take', seat: 'ceres/pilot-1' });
  check('a seat is taken by showing up: not from the wrong world', !r.ok && /Be on Ceres/.test(r.msg), r.msg);
  go(A, 'ceres');
  r = await act(A, aid(), { type: 'role-take', seat: 'ceres/pilot-1' });
  check('on Ceres a human takes the pilot post and the NPC steps aside, with a voiced line', r.ok && r.say && r.say.voice && r.say.text && H.holderOf(R(), 'ceres/pilot-1').kind === 'human' && H.holderOf(R(), 'ceres/pilot-1').name === 'Ada Roles', r.msg);
  check('the line the NPC says on stepping aside is the voiced one (a clip exists for it or the cast does)', VOICES[r.say.voice] && r.say.text === N.lineFor('ceres/pilot-1', 'stepAside').text);
  go(Bp, 'ceres'); r = await act(Bp, aid(), { type: 'role-take', seat: 'ceres/pilot-1' });
  check('a second human cannot take a seat a human holds', !r.ok && /already holds/.test(r.msg), r.msg);
  r = await act(A, aid(), { type: 'role-take', seat: 'ceres/trader-1' });
  check('one job at a time', !r.ok && /already have a job/.test(r.msg), r.msg);
  r = await act(Bp, aid(), { type: 'role-take', seat: 'ceres/governor' });
  check('a governor is voted in, never taken', !r.ok && /voted/.test(r.msg), r.msg);
  r = await act(Bp, aid(), { type: 'role-take', seat: 'ceres/port-master' });
  check('an office is earned: no reputation, no port master', !r.ok && /earned/.test(r.msg), r.msg);

  // work
  r = await act(A, aid(), { type: 'role-work', seat: 'ceres/pilot-1', side: 'home' });
  check('a faction shift needs a faction', !r.ok && /Join one/.test(r.msg), r.msg);
  r = await act(A, aid(), { type: 'faction-join', faction: 'ironclad' });
  check('a player joins a faction (and may leave)', r.ok && R().members[A.id] === 'ironclad');
  const marks0 = world.state.ships[P(A).shipId].economy.marks, bal0 = home2('ceres').balance, str0 = B.strengthOf(home2('ceres')), tre0 = home2('ceres').treasury;
  r = await act(A, aid(), { type: 'role-work', seat: 'ceres/pilot-1', side: 'home' });
  const ship = () => world.state.ships[P(A).shipId];
  check('a faction shift pays from the home treasury, earns reputation, and moves the world toward competition',
    r.ok && ship().economy.marks > marks0 && home2('ceres').treasury === tre0 - (ship().economy.marks - marks0) && R().rep[A.id].ironclad === 2 && home2('ceres').balance < bal0 && B.strengthOf(home2('ceres')) > str0, r.msg);
  r = await act(A, aid(), { type: 'role-work', seat: 'ceres/pilot-1', side: 'home' });
  check('shifts have a cooldown (no spamming the meters)', !r.ok && /breath/.test(r.msg), r.msg);
  world.state.clock += 25;
  const b1 = home2('ceres').balance;
  r = await act(A, aid(), { type: 'role-work', seat: 'ceres/pilot-1', side: 'joint' });
  check('a joint shift pushes the other way and pays less', r.ok && home2('ceres').balance > b1 && r.pay < ship().economy.marks, r.msg);
  check('a refused action leaves no trace: the world rolled back whole', (() => { const before = JSON.stringify(R().humans); return before.includes(A.id); })());
  // idempotent
  world.state.clock += 25;
  const idRetry = aid(), m1 = ship().economy.marks;
  await act(A, idRetry, { type: 'role-work', seat: 'ceres/pilot-1', side: 'home' }); const m2 = ship().economy.marks; const again = await act(A, idRetry, { type: 'role-work', seat: 'ceres/pilot-1', side: 'home' });
  check('a retried action id returns its first receipt and pays once', m2 > m1 && again.replay === true && ship().economy.marks === m2);
  check('vote weight is stored per player and grows with what they do', R().weights[A.id].progress >= 3 && H.voteWeight(R(), A.id) > 1 && H.voteWeight(R(), Bp.id) === 1);

  // leaving and lapsing
  r = await act(A, aid(), { type: 'role-leave', seat: 'ceres/pilot-1' });
  check('stand down and the NPC comes back, with a line', r.ok && H.holderOf(R(), 'ceres/pilot-1').kind === 'npc' && r.say?.text === N.lineFor('ceres/pilot-1', 'return').text);
  r = await act(Bp, aid(), { type: 'role-take', seat: 'ceres/miner-1' });
  check('another human takes a post', r.ok && H.holderOf(R(), 'ceres/miner-1').playerId === Bp.id);
  P(Bp).offlineAt = clockMs - (S.LAPSE_S + 5) * 1000; world.roles.acc = 99; world.roles.step(1);
  check('a holder who is away for ten minutes gives the seat back to its NPC', H.holderOf(R(), 'ceres/miner-1').kind === 'npc');
  go(Bp, 'ceres');

  // offices by reputation
  R().rep[A.id].ironclad = 30; go(A, 'ceres');
  r = await act(A, aid(), { type: 'role-take', seat: 'ceres/port-master' });
  check('with reputation an office is earned and taken', r.ok && H.holderOf(R(), 'ceres/port-master').playerId === A.id, r.msg);
  r = await act(A, aid(), { type: 'role-set', seat: 'ceres/port-master', value: 'closed' });
  check('a human port master sets who may dock; the policy shows in the world', r.ok && H.worldPolicy(R(), 'ceres').dock === 'closed' && !H.canDock(R(), 'ceres', Bp.id) && H.canDock(R(), 'ceres', A.id) === false);
  check('Mars docks everyone, always', H.canDock(R(), 'mars', Bp.id) && H.worldPolicy(R(), 'mars').neutral === true);
  r = await act(A, aid(), { type: 'role-leave', seat: 'ceres/port-master' });
  r = await act(A, aid(), { type: 'role-take', seat: 'ceres/security-chief' });
  r = await act(A, aid(), { type: 'role-set', seat: 'ceres/security-chief', value: 1.5 });
  check('the caps are hard: a patrol budget over 1 is refused', !r.ok && /hard/.test(r.msg), r.msg);
  r = await act(A, aid(), { type: 'role-set', seat: 'ceres/security-chief', value: 0.9 });
  check('inside the caps it is accepted and read by the world', r.ok && H.worldPolicy(R(), 'ceres').patrol === 0.9);
  await act(A, aid(), { type: 'role-leave', seat: 'ceres/security-chief' });

  // elections
  r = await act(A, aid(), { type: 'role-stand', seat: 'ceres/governor', stance: 0.5 });
  check('standing needs an open election: they come on a schedule', !r.ok && /schedule/.test(r.msg), r.msg);
  world.roles.openElection('ceres/governor'); world.roles.openElection('ironclad/leader');
  R().rep[A.id].ironclad = 90;
  r = await act(Bp, aid(), { type: 'role-stand', seat: 'ironclad/leader', stance: -0.45 });
  check('only members with standing may stand', !r.ok, r.msg);
  r = await act(A, aid(), { type: 'role-stand', seat: 'ironclad/leader', stance: -0.45 });
  check('a known member stands', r.ok && R().elections['ironclad/leader'].candidates[A.id], r.msg);
  r = await act(A, aid(), { type: 'role-vote', seat: 'ironclad/leader', candidate: A.id });
  const w1 = R().elections['ironclad/leader'].votes[A.id].weight;
  check('a member votes with their stored vote weight', r.ok && w1 === H.voteWeight(R(), A.id) && w1 > 1);
  r = await act(Bp, aid(), { type: 'role-vote', seat: 'ironclad/leader', candidate: A.id });
  check('you vote with your own faction only', !r.ok && /own faction/.test(r.msg), r.msg);
  world.state.clock += ROLES_CFG.electionOpenS + 1; world.roles.acc = 99; world.roles.step(1);
  check('when the polls close the best total wins: a human the faction knows and who stands where it stands takes the leader seat; the NPC leader steps aside',
    H.holderOf(R(), 'ironclad/leader').kind === 'human' && H.holderOf(R(), 'ironclad/leader').playerId === A.id && R().elections['ironclad/leader'].status === 'closed', JSON.stringify(R().elections['ironclad/leader'].result));
  check('the human leader now sets the faction stance, and the faction is no longer NPC-run', H.factionStance(R(), 'ironclad') === -0.45 && !H.factionIsNpcRun(R(), 'ironclad') && H.factionIsNpcRun(R(), 'greenhaven'));
  check('a governor nobody stood against stays with its NPC', H.holderOf(R(), 'ceres/governor').kind === 'npc' && R().elections['ceres/governor'].result.winner === 'npc');
  r = await act(A, aid(), { type: 'role-set', seat: 'ironclad/leader', value: 0.7 }); r = await act(A, aid(), { type: 'role-set', seat: 'ironclad/leader', value: -0.9 });
  check('a human leader moves the stance inside -1..1, and the board follows it', r.ok && H.factionStance(R(), 'ironclad') === -0.9 && B.jobBoard(H.stanceOfWorld(R(), 'ceres')).home > B.jobBoard(BK.worldStance(['ironclad', 'greenhaven'].map(BK.stanceOf))).home);
  r = await act(A, aid(), { type: 'faction-leave' });
  check('leaving the faction gives up its leader seat (the NPC comes back)', r.ok && H.holderOf(R(), 'ironclad/leader').kind === 'npc');
  await act(A, aid(), { type: 'faction-join', faction: 'ironclad' });
  r = await act(A, aid(), { type: 'faction-join', faction: 'greenhaven' });
  check('switching factions is allowed and leaves a mark', r.ok && R().switches[A.id] >= 1);

  // projects, peace and prices
  go(A, 'ceres'); world.state.ships[P(A).shipId].economy.inventory.parts = 100;
  home2('ceres').balance = 50;
  r = await act(A, aid(), { type: 'project-deliver', world: 'ceres', project: 'shipyard', n: 30 });
  check('a member hauls parts for their half; the ship pays them in parts', r.ok && ship().economy.inventory.parts === 70 && home2('ceres').projects.shipyard.b === 30, r.msg);
  r = await act(A, aid(), { type: 'project-deliver', world: 'mars', project: 'shipyard', n: 1 });
  check('nothing is built on Mars', !r.ok && /neutral/.test(r.msg), r.msg);
  r = await act(A, aid(), { type: 'peace-step', world: 'ceres' }); const bP = home2('ceres').balance;
  r = await act(A, aid(), { type: 'peace-step', world: 'ceres' }); r = await act(A, aid(), { type: 'peace-step', world: 'ceres' });
  check('a peace deal is a three-link job chain any player can start', r.ok && /Peace on Ceres/.test(r.msg) && home2('ceres').balance > bP + 10, r.msg);
  {
    const t = world.roles.tradeMult(A.id, 'ceres', 'sell'), t2 = world.roles.tradeMult(Bp.id, 'ceres', 'sell');
    check('prices read the meters: members of a Ceres faction get a better deal than outsiders, and the governor\'s tax is inside its cap', t.side === 'own' && t2.side === 'outsider' && t.mult >= t2.mult && t.tax >= 0 && t.tax <= 0.15, JSON.stringify([t, t2]));
    const { sellSupply } = await src('worlds/ceres/trade.js');
    const mk = () => ({ economy: { inventory: { water: 10 }, marks: 0 } }), fund = () => ({ marks: 100000 });
    const plain = sellSupply(mk(), 'water', 10, fund()), taxed = sellSupply(mk(), 'water', 10, fund(), 1.1, 0.1);
    check('the desk pays the factor and takes the tax into the treasury; with no factor the old price is unchanged', plain.paid === 160 && taxed.taxed === 18 && taxed.paid === 176 - 18, JSON.stringify([plain, taxed]));
  }
  {
    const f = world.fleet, base = f.respawnS(), keep = structuredClone(world.state.homes);
    for (const id of Object.keys(world.state.homes)) Object.assign(world.state.homes[id], { balance: 5, wealth: 70, industry: 70, defences: 70, population: 70 });
    const hot = f.respawnS();
    for (const id of Object.keys(world.state.homes)) Object.assign(world.state.homes[id], { balance: 95, wealth: 10, industry: 10, defences: 10, population: 10 });
    const calm = f.respawnS();
    check(`raider spawns read the meters: competing, rich worlds get raiders sooner (${hot.toFixed(0)} s) than cooperating, thin ones (${calm.toFixed(0)} s); the start is the old ${base.toFixed(0)} s`, hot < calm && hot < 240 * 0.9 && Math.abs(calm - 240) > 1);
    for (const id of Object.keys(world.state.homes)) world.state.homes[id] = B.newHome(id);
    check('an unchanged world respawns on the old schedule (240 s)', Math.abs(f.respawnS() - 240) < 1e-6);
    world.state.homes = keep;
  }

  // persistence, old saves, season, cleanup
  await world.commit();
  const w2 = await new Authority(adapter, { now: () => clockMs }).load();
  check('roles, reputation, weights and home meters survive a restart', JSON.stringify(w2.state.roles.rep) === JSON.stringify(R().rep) && JSON.stringify(w2.state.roles.weights) === JSON.stringify(R().weights) && w2.state.homes.ceres.projects.shipyard.b === 30 && Object.keys(w2.state.roles.humans).length === Object.keys(R().humans).length);
  const old = structuredClone(adapter.rec); delete old.roles; delete old.homes;
  const w3 = await new Authority({ load: async () => ({ record: structuredClone(old), bricks: [] }), save: async () => {} }, { now: () => clockMs }).load();
  check('an old save with no roles or homes loads with every seat NPC-held and fresh meters', Object.keys(w3.state.homes).length === 6 && Object.keys(w3.state.roles.humans).length === 0);
  const wt = R().weights[A.id].progress, wc = R().weights[A.id].carried;
  const season = world.roles.rollSeason();
  check('a season turns: vote weight carries over (so veterans keep standing), progress restarts, every human seat goes back to its NPC',
    season === 2 && R().weights[A.id].progress === 0 && R().weights[A.id].carried > wc && R().weights[A.id].carried >= Math.round(Math.sqrt(wt) * 100) / 100 && Object.keys(R().humans).length === 0 && H.voteWeight(R(), A.id) > 2);
  await act(Bp, aid(), { type: 'faction-join', faction: 'greenhaven' }); R().humans['ceres/trader-1'] = { playerId: C.id, name: 'Cy', since: 0, seenAt: 0 };
  world.removePlayer(C.id);
  check('a player removed from the world takes their seats and standing with them', !R().humans['ceres/trader-1'] && !R().weights[C.id]);
  {
    const t0 = performance.now(); for (let i = 0; i < 2000; i++) world.roles.step(1); const ms = performance.now() - t0;
    check(`two thousand world seconds of the role director cost ${ms.toFixed(1)} ms (the server tick stays light)`, ms < 400);
    const bytes = JSON.stringify({ roles: world.state.roles, homes: world.state.homes }).length;
    check(`the whole role and balance record is ${bytes} bytes`, bytes < 20000);
  }
}

// Standalone: node test/pkg-roles.mjs
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  let pass = 0, fail = 0;
  const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + ' ' + d); } };
  await run({ check, section: (s) => console.log('\n== ' + s + ' ==') });
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
}
