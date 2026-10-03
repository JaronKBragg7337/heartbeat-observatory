// ============================================================================
// server/roles.mjs - F5 roles and NPC stand-ins, and F4 the balance and home strength. Run by the authority (BIBLE-v3 sections 4.6 and 6;
// DECISIONS 10/3 10:46 AM: "NPCs fill every role until a human takes it"; Mars stays neutral).
//
// WHAT IS KEPT (in the world record, state.roles and state.homes; both small):
//   roles.humans   seatId -> { playerId, name, since, seenAt }      only HUMAN holders. A seat with no entry is held by its NPC (src/roles/npcs.js).
//   roles.rep      playerId -> { faction: n }                        earned by work; opens offices and elections
//   roles.members  playerId -> factionId                             a player may join and leave; switching leaves a mark (roles.switches), F7 reads it
//   roles.weights  playerId -> { carried, progress }                 vote weight for seasons (F6 calls rollSeason())
//   roles.policy   seatId -> { tax | fee | margin | patrol | dock | stance }   only what a human holder chose, inside the hard caps
//   roles.elections seatId -> { status, opensAt, closesAt, candidates, votes, result }
//   homes          worldId -> { balance, wealth, industry, defences, population, treasury, projects, home }   (src/roles/balance.js)
//
// RULES, all checked before anything changes (the authority rolls the whole action back on a refusal, and a retried action id returns its
// first receipt without moving anything twice): a human takes a job by being on that world; an office by reputation; a top seat only by an
// election. Mars seats refuse every human. An NPC steps aside when a human takes the seat and comes back when the human leaves, goes
// offline for ten minutes, or is voted out. Nobody, human or NPC, sets a number outside the hard caps.
//
// COST: nothing here runs per tick. step() adds dt and does work every 30 world-seconds: lapses, elections, and once a minute one tiny
// drift per world (six worlds). Seats are derived, never stored, so an empty world costs a few hundred bytes.
// ============================================================================
import { WORLDS, worldById, worldOfFrame, seatById, seatsOn, seatFactions, topSeat, leaderSeat, allSeats, OFFICE_REP, STAND_REP, LAPSE_S, CAPS, PLAYABLE_FACTIONS } from '../src/roles/seats.js';
import { npcFor, lineFor } from '../src/roles/npcs.js';
import { inCap, npcTally, stanceOf, worldStance } from '../src/roles/book.js';
import { newRoles, holderOf, heldBy, repOf, factionOfPlayer, voteWeight, factionStance, stanceOfWorld, worldPolicy, npcShare, sideFor } from '../src/roles/holders.js';
import * as B from '../src/roles/balance.js';

export const ROLES_CFG = {
  stepS: 30,                       // world seconds between the director's slow passes
  driftS: 60,                      // balance drift, per world
  electionEveryS: 30 * 86400,      // an election cycle inside the 90-day season (DECISIONS 10/3 12:06)
  electionOpenS: 3 * 86400,        // how long the polls stay open
  workCooldownS: 20,               // between two shifts by one player
  peaceStepS: 3600,                // each link of a peace deal must follow the last within an hour
};
const yes = (msg, extra = {}) => ({ ok: true, msg, ...extra });
const round2 = (v) => Math.round(v * 100) / 100;

export class RoleDirector {
  constructor(auth, cfg = {}) { this.auth = auth; this.cfg = { ...ROLES_CFG, ...cfg }; this.acc = 0; this.driftAcc = 0; }
  get roles() { return this.auth.state.roles; }
  get homes() { return this.auth.state.homes; }
  get clock() { return this.auth.state.clock; }
  player(id) { return this.auth.state.players[id]; }

  ensureAll() {
    const st = this.auth.state;
    st.roles = st.roles || newRoles();
    const r = st.roles; for (const k of Object.keys(newRoles())) if (r[k] === undefined) r[k] = newRoles()[k];
    st.homes = st.homes || {};
    for (const w of B.meteredWorlds()) if (!st.homes[w.id]) st.homes[w.id] = B.newHome(w.id);
    if (!r.cycle.startedAt) { r.cycle.startedAt = st.clock || 1; r.cycle.nextOpenAt = (st.clock || 0) + this.cfg.electionEveryS; }
  }
  log(msg) { const l = this.roles.log; l.push({ t: Math.round(this.clock), msg }); if (l.length > 40) l.splice(0, l.length - 40); }

  // ---- lookups and checks ------------------------------------------------------------------------------------------------------------------------
  _seat(id) { const s = seatById(id); if (!s) throw Error('There is no such seat.'); return s; }
  _here(p, seat) {
    const w = worldOfFrame(p.frameId);
    if (!w || w.id !== seat.world) throw Error(`Be on ${worldById(seat.world).name} first. A seat is taken by showing up.`);
  }
  _notMars(seat) { if (seat.npcOnly) throw Error('Mars is neutral: its staff and traders stay NPCs. Nobody owns anything on Mars.'); }
  _myHeld(p, tier) { return heldBy(this.roles, p.id).map(seatById).filter((s) => s.tier === tier); }
  _addRep(pid, faction, n) { const m = (this.roles.rep[pid] ||= {}); m[faction] = Math.max(-50, Math.min(999, round2((m[faction] || 0) + n))); }
  _progress(pid, n) { const w = (this.roles.weights[pid] ||= { carried: 0, progress: 0 }); w.progress = round2(w.progress + n); }
  _speak(seatId, situation) {
    const n = npcFor(seatId), l = lineFor(seatId, situation);
    return { voice: l.voice, text: l.text, name: n.name, seatId };
  }
  seatInfo(seatId) {
    const seat = this._seat(seatId), h = holderOf(this.roles, seatId);
    return { seat, holder: h, line: h.kind === 'npc' ? lineFor(seat, 'greet') : null };
  }
  _vacate(seatId, why) {
    const h = this.roles.humans[seatId]; if (!h) return false;
    delete this.roles.humans[seatId]; delete this.roles.policy[seatId];
    this.log(`${h.name} left ${seatById(seatId).title} (${seatId}): ${why}. ${npcFor(seatId).name} is back.`);
    return true;
  }
  _give(p, seat) {
    this.roles.humans[seat.id] = { playerId: p.id, name: p.name, since: Math.round(this.clock), seenAt: Math.round(this.clock) };
    delete this.roles.policy[seat.id];
  }

  // ---- actions -----------------------------------------------------------------------------------------------------------------------------------
  act(p, a) {
    switch (a.type) {
      case 'faction-join': return this.joinFaction(p, a);
      case 'faction-leave': return this.leaveFaction(p);
      case 'role-talk': return this.talk(p, a);
      case 'role-take': return this.take(p, a);
      case 'role-leave': return this.leave(p, a);
      case 'role-work': return this.work(p, a);
      case 'role-set': return this.setPolicy(p, a);
      case 'role-stand': return this.stand(p, a);
      case 'role-vote': return this.vote(p, a);
      case 'project-deliver': return this.deliver(p, a);
      case 'project-buy-half': return this.buyHalf(p, a);
      case 'peace-step': return this.peaceStep(p, a);
      default: throw Error('Unsupported role action: ' + a.type);
    }
  }
  joinFaction(p, a) {
    if (!PLAYABLE_FACTIONS.includes(a.faction)) throw Error('There is no such faction to join.');
    const cur = this.roles.members[p.id];
    if (cur === a.faction) throw Error('You are already with them.');
    if (cur) this.roles.switches[p.id] = (this.roles.switches[p.id] || 0) + 1;     // a mark: F7 turns it into labels and revoked licenses
    this._dropFactionSeats(p, cur);
    this.roles.members[p.id] = a.faction;
    this.log(`${p.name} ${cur ? `left ${cur} for` : 'joined'} ${a.faction}.`);
    return yes(cur ? `You left ${cur} and joined ${a.faction}. People remember a switch.` : `You joined ${a.faction}. You can leave whenever you like.`);
  }
  leaveFaction(p) {
    const cur = this.roles.members[p.id]; if (!cur) throw Error('You are not with a faction.');
    this._dropFactionSeats(p, cur);
    delete this.roles.members[p.id]; this.log(`${p.name} left ${cur}.`);
    return yes(`You left ${cur}.`);
  }
  _dropFactionSeats(p, f) { if (f && this.roles.humans[`${f}/leader`]?.playerId === p.id) this._vacate(`${f}/leader`, 'left the faction'); }

  talk(p, a) {
    const seat = this._seat(a.seat), h = holderOf(this.roles, seat.id);
    if (h.kind === 'human') return yes(`${h.name} holds ${seat.title}.`, { holder: h });
    const say = this._speak(seat.id, a.job ? 'job' : 'greet');
    return yes(`${say.name}: "${say.text}"`, { say, holder: { kind: 'npc', name: say.name } });
  }

  take(p, a) {
    const seat = this._seat(a.seat);
    this._notMars(seat);
    if (seat.tier === 'top') throw Error(seat.kind === 'faction-leader' ? 'A faction leader is voted in. Stand in the election when it opens.' : 'A world\'s top seat is voted in. Stand in the election when it opens.');
    this._here(p, seat);
    const cur = this.roles.humans[seat.id]; if (cur) throw Error(cur.playerId === p.id ? 'You already hold that seat.' : `${cur.name} already holds it.`);
    if (this._myHeld(p, seat.tier).length) throw Error(seat.tier === 'job' ? 'You already have a job here. Leave it first.' : 'You already hold an office. Leave it first.');
    if (seat.tier === 'office') {
      const best = Math.max(0, ...seatFactions(seat).map((f) => repOf(this.roles, p.id, f)));
      if (best < OFFICE_REP) throw Error(`An office is earned: ${OFFICE_REP} reputation with one of this world's factions (you have ${Math.round(best)}). Work jobs for them.`);
    }
    const npc = npcFor(seat.id), say = this._speak(seat.id, 'stepAside');
    this._give(p, seat);
    this.log(`${p.name} took ${seat.title} at ${worldById(seat.world).name}. ${npc.name} stepped aside.`);
    return yes(`${npc.name}: "${say.text}" You are now ${seat.title.toLowerCase()} (${worldById(seat.world).name}).`, { say });
  }
  leave(p, a) {
    const seat = this._seat(a.seat), cur = this.roles.humans[seat.id];
    if (!cur || cur.playerId !== p.id) throw Error('You do not hold that seat.');
    this._vacate(seat.id, 'stood down');
    const say = this._speak(seat.id, 'return');
    return yes(`${say.name}: "${say.text}"`, { say });
  }

  /** One shift at a job seat. The board's side decides what it does to the world. */
  work(p, a) {
    const seat = this._seat(a.seat); this._notMars(seat);
    const cur = this.roles.humans[seat.id]; if (!cur || cur.playerId !== p.id) throw Error('You do not hold that seat.');
    if (seat.tier !== 'job') throw Error('Offices set policy (role-set); the work is the jobs.');
    this._here(p, seat);
    if (this.clock < (this.roles.cooldown[p.id] || 0)) throw Error('Catch your breath: the next shift is a moment away.');
    const side = a.side || 'home', w = worldById(seat.world), h = this.homes[seat.world], ship = this.auth.state.ships[p.shipId];
    if (!B.JOB_SIDES[side]) throw Error('Pick a faction job, a joint job, or sabotage.');
    const mine = factionOfPlayer(this.roles, p.id), theirs = mine && w.factions.includes(mine);
    if (side !== 'joint' && !theirs) throw Error(`Faction work is for ${w.factions.join(' and ')} people. Join one first, or take a joint job.`);
    if (side !== 'joint' && !B.isTwoSided(seat.world) && side === 'sabotage') throw Error('There is no other side here to sabotage.');
    const board = B.jobBoard(stanceOfWorld(this.roles, seat.world));
    const pay = Math.max(1, Math.round(seat.pay * board[side]));
    if (h.treasury < pay) throw Error('The treasury cannot pay a shift today.');
    B.applyJob(h, side, seat.trade);
    h.treasury -= pay; ship.economy.marks += pay;
    if (side === 'home') this._addRep(p.id, mine, 2);
    else if (side === 'joint') for (const f of w.factions) this._addRep(p.id, f, 1);
    else { this._addRep(p.id, mine, 1); for (const f of w.factions) if (f !== mine) this._addRep(p.id, f, -3); }
    this._progress(p.id, 1);
    this.roles.cooldown[p.id] = this.clock + this.cfg.workCooldownS;
    cur.seenAt = Math.round(this.clock);
    return yes(`Shift done: ${pay} marks. ${B.JOB_SIDES[side].label} for ${w.name}.`, { pay, side });
  }

  /** A human holder sets a number, inside the hard caps. An NPC never needs this: it follows the book. */
  setPolicy(p, a) {
    const seat = this._seat(a.seat), cur = this.roles.humans[seat.id];
    if (!cur || cur.playerId !== p.id) throw Error('You do not hold that seat.');
    if (seat.tier === 'job') throw Error('A job has no policy to set.');
    const key = seat.policy, v = key === 'dock' ? a.value : Number(a.value);
    if (a.key && a.key !== key) throw Error(`That seat sets ${key}.`);
    if (key === 'dock') { if (!['open', 'faction', 'closed'].includes(v)) throw Error('Docking is open, faction or closed.'); }
    else if (!inCap(key, v)) {
      const [lo, hi] = CAPS[key]; throw Error(`${key} is held between ${lo} and ${hi}: those caps are hard.`);
    }
    (this.roles.policy[seat.id] ||= {})[key] = v;
    return yes(`${seat.title}: ${key} is now ${v}.`);
  }

  // ---- elections ----------------------------------------------------------------------------------------------------------------------------------
  _electionOpen(seatId) { const e = this.roles.elections[seatId]; return !!e && e.status === 'open' && this.clock >= e.opensAt && this.clock < e.closesAt; }
  _incumbent(seat) {
    const h = holderOf(this.roles, seat.id), f0 = seatFactions(seat)[0];
    if (h.kind === 'human') return { id: h.playerId, name: h.name, stance: seat.kind === 'faction-leader' ? factionStance(this.roles, seat.faction) : (this.roles.policy[seat.id]?.stance ?? stanceOfWorld(this.roles, seat.world)), faction: f0, incumbent: true, human: true };
    const stance = seat.kind === 'faction-leader' ? stanceOf(seat.faction) : worldStance(seatFactions(seat).map(stanceOf));
    return { id: 'npc', name: h.npc.name, stance, faction: f0, incumbent: true, human: false };
  }
  openElection(seatId, opensAt = this.clock) {
    const seat = this._seat(seatId); this._notMars(seat);
    if (seat.tier !== 'top') throw Error('Only the top seats are voted.');
    const inc = this._incumbent(seat);
    this.roles.elections[seatId] = { status: 'open', opensAt, closesAt: opensAt + this.cfg.electionOpenS, candidates: { [inc.id]: inc }, votes: {}, result: null };
    this.log(`Polls open for ${seat.title}${seat.faction ? ' of ' + seat.faction : ' of ' + worldById(seat.world).name}.`);
  }
  stand(p, a) {
    const seat = this._seat(a.seat); this._notMars(seat);
    if (seat.tier !== 'top') throw Error('Jobs are taken by showing up and offices by reputation. Only the top seats are voted.');
    if (!this._electionOpen(seat.id)) throw Error('There is no election open for that seat. They come on a schedule.');
    const e = this.roles.elections[seat.id], stance = Number(a.stance);
    if (!inCap('stance', stance)) throw Error('Say where you stand: a number from -1 (compete at home) to 1 (cooperate early).');
    const fs = seatFactions(seat), mine = factionOfPlayer(this.roles, p.id);
    if (!mine || !fs.includes(mine)) throw Error(`Only ${fs.join(' or ')} people can stand for this.`);
    if (repOf(this.roles, p.id, mine) < STAND_REP) throw Error(`You need ${STAND_REP} reputation with ${mine} to stand (you have ${Math.round(repOf(this.roles, p.id, mine))}).`);
    if (e.candidates[p.id] && !e.candidates[p.id].incumbent) { e.candidates[p.id].stance = stance; return yes('Your stand is updated.'); }
    if (e.candidates[p.id]) { e.candidates[p.id].stance = stance; return yes('You are standing again.'); }
    e.candidates[p.id] = { id: p.id, name: p.name, stance, faction: mine, incumbent: false, human: true };
    this.log(`${p.name} stands for ${seat.title} (${stance >= 0 ? 'cooperate' : 'compete'} ${stance}).`);
    return yes(`You are standing. Win the room: the voters follow where they stand and who they believe.`);
  }
  vote(p, a) {
    const seat = this._seat(a.seat); this._notMars(seat);
    if (!this._electionOpen(seat.id)) throw Error('There is no election open for that seat.');
    const e = this.roles.elections[seat.id], mine = factionOfPlayer(this.roles, p.id);
    if (!mine || !seatFactions(seat).includes(mine)) throw Error('You vote with your own faction.');
    if (!e.candidates[a.candidate]) throw Error('That is not a candidate.');
    e.votes[p.id] = { candidate: a.candidate, weight: voteWeight(this.roles, p.id) };
    return yes(`Vote cast, weight ${e.votes[p.id].weight}.`);
  }
  /** Close an election: NPC voters vote by the book, humans by weight. The best total wins; a tie goes to whoever holds the seat. */
  resolve(seatId) {
    const seat = this._seat(seatId), e = this.roles.elections[seatId]; if (!e || e.status !== 'open') return null;
    const cands = Object.values(e.candidates).map((c) => ({ ...c, rep: c.human ? Math.max(0, ...seatFactions(seat).map((f) => repOf(this.roles, c.id, f))) : 0 }));
    const npcVotes = npcTally(seatId, seatFactions(seat), cands);
    const totals = { ...npcVotes };
    for (const v of Object.values(e.votes)) totals[v.candidate] = (totals[v.candidate] || 0) + v.weight;
    let win = cands.find((c) => c.incumbent), best = totals[win.id] || 0;
    for (const c of cands) if ((totals[c.id] || 0) > best) { win = c; best = totals[c.id]; }
    const before = holderOf(this.roles, seatId);
    e.status = 'closed'; e.result = { winner: win.id, name: win.name, totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round2(v)])), at: Math.round(this.clock) };
    if (win.human && !(before.kind === 'human' && before.playerId === win.id)) {
      // a human wins: any human who held it before loses it
      if (before.kind === 'human') this._vacate(seatId, 'voted out');
      this.roles.humans[seatId] = { playerId: win.id, name: win.name, since: Math.round(this.clock), seenAt: Math.round(this.clock) };
      if (seat.policy === 'stance') this.roles.policy[seatId] = { stance: win.stance }; else delete this.roles.policy[seatId];
      this.log(`${win.name} won ${seat.title}. ${npcFor(seatId).name} stepped aside.`);
    } else if (!win.human && before.kind === 'human') {
      this._vacate(seatId, 'voted out');
      this.log(`${before.name} was voted out of ${seat.title}.`);
    } else this.log(`${win.name} keeps ${seat.title}.`);
    return e.result;
  }

  // ---- projects and peace --------------------------------------------------------------------------------------------------------------------------
  _home(worldId) { const h = this.homes[worldId]; if (!h) throw Error('That world has no balance (Mars is neutral).'); return h; }
  deliver(p, a) {
    const w = worldById(a.world); if (!w || w.neutral) throw Error('Nothing is built on Mars: it is neutral.');
    if (worldOfFrame(p.frameId)?.id !== w.id) throw Error(`Be on ${w.name} first.`);
    const h = this._home(w.id), n = a.n === undefined ? 10 : a.n, ship = this.auth.state.ships[p.shipId];
    if (!Number.isSafeInteger(n) || n < 1 || n > 100) throw Error('Deliver a whole number of parts, 1 to 100.');
    const have = ship.economy.inventory.parts || 0; if (have < n) throw Error(`Your ship has ${have} parts.`);
    const mine = factionOfPlayer(this.roles, p.id), theirs = mine && w.factions.includes(mine);
    let took;
    if (a.home) {
      if (!theirs) throw Error('Home projects are built by the faction whose home it is.');
      took = B.deliverHome(h, a.project, n);
    } else {
      const i = w.factions.indexOf(mine); if (i < 0) throw Error('Join one of the two factions: each delivers its own half.');
      took = B.deliverJoint(h, a.project, i === 0 ? 'a' : 'b', n);
      this._addRep(p.id, mine, took / 20);
    }
    ship.economy.inventory.parts -= took; this._progress(p.id, took / 20);
    return yes(`${took} parts delivered.`, { took });
  }
  buyHalf(p, a) {
    const w = worldById(a.world); if (!w || w.neutral) throw Error('Mars is neutral.');
    const top = topSeat(w.id), cur = this.roles.humans[top.id];
    if (!cur || cur.playerId !== p.id) throw Error('Only the governor can buy a half outright (an NPC governor does it by the book).');
    const r = B.buyMissingHalf(this._home(w.id), a.project);
    return yes(`The missing half is bought: ${r.cost.toFixed(0)} wealth.`, r);
  }
  /** A peace deal is a job chain, not a vote: envoy ride, hostage swap, treaty on the shared pad. Any player can start it; it is always available. */
  peaceStep(p, a) {
    const w = worldById(a.world); if (!w || w.neutral || w.factions.length !== 2) throw Error('Peace is made between two factions of a world.');
    if (worldOfFrame(p.frameId)?.id !== w.id) throw Error(`Be on ${w.name} first.`);
    const h = this._home(w.id), STEPS = ['envoy ride', 'hostage swap', 'treaty signed on the shared pad'];
    const pe = h.peace || (h.peace = { step: 0, by: p.id, at: this.clock });
    if (pe.step > 0 && this.clock - pe.at > this.cfg.peaceStepS) { pe.step = 0; pe.by = p.id; }
    const k = Number.isInteger(a.step) ? a.step : pe.step;
    if (k !== pe.step) throw Error(`The next step is the ${STEPS[pe.step]}.`);
    pe.step++; pe.at = this.clock; this._progress(p.id, 2); for (const f of w.factions) this._addRep(p.id, f, 1);
    if (pe.step >= STEPS.length) { delete h.peace; B.applyPeace(h); this.log(`${p.name} signed a peace on ${w.name}.`); return yes(`The ${STEPS[2]}. Peace on ${w.name}: the balance jumps and the treasury pays for it.`); }
    return yes(`Done: the ${STEPS[pe.step - 1]}. Next: the ${STEPS[pe.step]}.`);
  }

  // ---- reads used by the rest of the world (F4) ---------------------------------------------------------------------------------------------------
  /** Price multiplier and tax for a player trading at a world (the Occator desk and foundry call this). Mars is neutral: 1 and 0.05. */
  tradeMult(playerId, worldId, direction) {
    const w = worldById(worldId), h = this.homes[worldId];
    if (!w || !h) return { mult: 1, tax: 0.05, side: 'outsider' };
    const side = sideFor(this.roles, playerId, worldId), pol = worldPolicy(this.roles, worldId);
    return { mult: B.priceFactor(h, side, direction), tax: w.station ? pol.fee : pol.tax, side };
  }
  addIntake(worldId, marks) { const h = this.homes[worldId]; if (h && marks > 0) { h.treasury += Math.round(marks); h.intake += Math.round(marks); } }
  /** The pressure on the lanes right now: the fleet director divides its respawn time by this. */
  lanePressure() { return B.lanePressure(this.homes); }
  /** F6 calls this at the end of a season: vote weight carries, off-world seats are given back to their NPCs, the election clock restarts. */
  rollSeason() {
    for (const w of Object.values(this.roles.weights)) { w.carried = round2(Math.sqrt(Math.max(0, w.progress)) + 0.5 * (w.carried || 0)); w.progress = 0; }
    for (const id of Object.keys(this.roles.humans)) this._vacate(id, 'the season turned');
    this.roles.elections = {}; this.roles.cycle.season++; this.roles.cycle.startedAt = this.clock; this.roles.cycle.nextOpenAt = this.clock + this.cfg.electionEveryS;
    return this.roles.cycle.season;
  }
  removePlayer(id) {
    for (const s of heldBy(this.roles, id)) this._vacate(s, 'left the world');
    delete this.roles.rep[id]; delete this.roles.members[id]; delete this.roles.weights[id]; delete this.roles.cooldown[id]; delete this.roles.switches[id];
    for (const e of Object.values(this.roles.elections)) { delete e.votes[id]; if (e.candidates[id] && !e.candidates[id].incumbent) delete e.candidates[id]; }
  }

  // ---- time -----------------------------------------------------------------------------------------------------------------------------------------
  step(dt, { catchUp = false } = {}) {
    if (catchUp) return;
    this.acc += dt; this.driftAcc += dt;
    if (this.acc < this.cfg.stepS) return;
    const span = this.acc; this.acc = 0;
    const now = this.auth.now();
    // a holder who is gone for ten minutes gives the seat back to its NPC
    for (const [seatId, h] of Object.entries(this.roles.humans)) {
      const p = this.player(h.playerId);
      if (!p) { this._vacate(seatId, 'left the world'); continue; }
      if (this.auth.sessions.has(p.id)) { h.seenAt = Math.round(this.clock); continue; }
      if (p.offlineAt && now - p.offlineAt > LAPSE_S * 1000) this._vacate(seatId, 'away too long');
    }
    // elections open on the schedule and close when their window ends
    if (this.clock >= this.roles.cycle.nextOpenAt) {
      for (const s of allSeats()) if (s.tier === 'top' && !s.npcOnly) this.openElection(s.id);
      while (this.roles.cycle.nextOpenAt <= this.clock) this.roles.cycle.nextOpenAt += this.cfg.electionEveryS;
    }
    for (const [id, e] of Object.entries(this.roles.elections)) if (e.status === 'open' && this.clock >= e.closesAt) this.resolve(id);
    // the slow drift: NPCs take the jobs nobody takes; an empty world turns inward
    if (this.driftAcc >= this.cfg.driftS) {
      const mins = Math.min(5, this.driftAcc / this.cfg.driftS); this.driftAcc = 0;
      const here = new Set(Object.values(this.auth.state.players).filter((q) => this.auth.sessions.has(q.id)).map((q) => worldOfFrame(q.frameId)?.id));
      for (const w of B.meteredWorlds()) for (let i = 0; i < Math.max(1, Math.round(mins)); i++) B.drift(this.homes[w.id], stanceOfWorld(this.roles, w.id), npcShare(this.roles, w.id), here.has(w.id));
      this._npcPeace();
    }
  }
  /** By the book, an NPC governor with a fat treasury and a pivoted world buys the missing half of a project it has half of. */
  _npcPeace() {
    for (const w of B.meteredWorlds()) {
      if (!B.isTwoSided(w.id) || this.roles.humans[topSeat(w.id).id]) continue;
      const h = this.homes[w.id]; if (h.balance < 50 || h.wealth < 25) continue;
      for (const def of B.JOINT_PROJECTS) { const st = h.projects[def.id]; if (st && !st.done && (st.a >= def.parts || st.b >= def.parts)) { try { B.buyMissingHalf(h, def.id); this.log(`${npcFor(topSeat(w.id).id).name} bought the missing half of the ${def.name.toLowerCase()} on ${w.name}.`); } catch { /* not yet */ } } }
    }
  }
}
