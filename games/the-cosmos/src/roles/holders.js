// ============================================================================
// roles/holders.js - F5: reading the role record. Pure functions over `state.roles` (what the server keeps: only the HUMANS who hold a seat,
// reputation, faction membership, vote weights, chosen policies and elections). The server and the browser both call these, so a phone
// shows exactly who holds what and what the numbers are.
// ============================================================================
import { seatById, seatsOn, worldById, factionWorld, topSeat, leaderSeat, OFFICE_KINDS } from './seats.js';
import { npcFor } from './npcs.js';
import { leaderStance, worldStance, npcPolicy, stanceOf } from './book.js';

export const newRoles = () => ({
  v: 1, humans: {}, rep: {}, members: {}, switches: {}, weights: {}, policy: {}, elections: {}, cooldown: {}, log: [],
  cycle: { season: 1, startedAt: 0, nextOpenAt: 0 },
});

/** Who holds a seat: a human (name, since) or the NPC the seat falls back to. Mars always answers with its NPC. */
export function holderOf(roles, seatId) {
  const seat = seatById(seatId); if (!seat) throw Error('Unknown seat: ' + seatId);
  const h = !seat.npcOnly && roles?.humans?.[seatId];
  if (h) return { kind: 'human', playerId: h.playerId, name: h.name, since: h.since, seatId };
  return { kind: 'npc', npc: npcFor(seat), seatId };
}
export const heldBy = (roles, playerId) => Object.entries(roles?.humans || {}).filter(([, h]) => h.playerId === playerId).map(([id]) => id);
export const repOf = (roles, playerId, factionId) => roles?.rep?.[playerId]?.[factionId] || 0;
export const factionOfPlayer = (roles, playerId) => roles?.members?.[playerId] || null;
/** Vote weight: 1, plus what carried over from last season, plus a square-root of this season's progress (so veterans keep standing, nobody runs away). */
export function voteWeight(roles, playerId) {
  const w = roles?.weights?.[playerId];
  return Math.round((1 + (w?.carried || 0) + Math.sqrt(Math.max(0, w?.progress || 0))) * 100) / 100;
}
/** A faction runs on its NPCs until a human wins its leader seat. */
export const factionIsNpcRun = (roles, factionId) => holderOf(roles, `${factionId}/leader`).kind === 'npc';
/** The stance a faction runs at today: a human leader's chosen one, else its philosophy. */
export function factionStance(roles, factionId) {
  const h = roles?.humans?.[`${factionId}/leader`];
  return leaderStance(factionId, h ? roles.policy?.[`${factionId}/leader`]?.stance : undefined);
}
export function stanceOfWorld(roles, worldId) {
  const w = worldById(worldId); if (!w || !w.factions.length) return 0;
  return worldStance(w.factions.map((f) => factionStance(roles, f)));
}
/**
 * The policy a world runs today. A human who holds the seat sets their own number (inside the caps: the server refuses anything else); the rest
 * is what an NPC would set by the book from the world's stance. Mars is neutral and fixed.
 */
export function worldPolicy(roles, worldId) {
  const w = worldById(worldId), stance = stanceOfWorld(roles, worldId), base = npcPolicy(stance), out = { ...base, stance };
  if (w.neutral) return { tax: 0.05, fee: 0.05, margin: 0.08, patrol: 0.4, dock: 'open', stance: 0, neutral: true };
  const own = (seatId, key) => { const h = roles?.humans?.[seatId]; return h && roles.policy?.[seatId] && roles.policy[seatId][key] !== undefined ? roles.policy[seatId][key] : undefined; };
  const set = (key, seatId) => { const v = own(seatId, key); if (v !== undefined) out[key] = v; };
  const top = topSeat(worldId).id;
  if (w.station) set('fee', top); else set('tax', top);
  for (const o of OFFICE_KINDS) set(o.policy, `${worldId}/${o.kind}`);
  return out;
}
/** Who may dock: Mars is open to everyone, always. Elsewhere the port master's policy decides (`faction` = members of the world's factions only). */
export function canDock(roles, worldId, playerId) {
  const w = worldById(worldId); if (!w || w.neutral) return true;
  const p = worldPolicy(roles, worldId).dock;
  if (p === 'open') return true;
  if (p === 'closed') return false;
  const f = factionOfPlayer(roles, playerId); return !!f && w.factions.includes(f);
}
/** Is a player an "own" customer of a world, for prices: a member of one of its factions. */
export const sideFor = (roles, playerId, worldId) => { const f = factionOfPlayer(roles, playerId), w = worldById(worldId); return f && w && w.factions.includes(f) ? 'own' : 'outsider'; };
/** Where is each faction's seat of leadership, for the panel. */
export const leadersOf = (roles, worldId) => (worldById(worldId)?.factions || []).map((f) => ({ faction: f, holder: holderOf(roles, leaderSeat(f).id), stance: factionStance(roles, f), philosophy: stanceOf(f) }));
export const jobSeatsOf = (worldId) => seatsOn(worldId).filter((s) => s.tier === 'job');
/** The share of a world's job seats an NPC holds (the NPC pass leans on this). */
export function npcShare(roles, worldId) {
  const jobs = jobSeatsOf(worldId); if (!jobs.length) return 1;
  return jobs.filter((s) => holderOf(roles, s.id).kind === 'npc').length / jobs.length;
}
export { factionWorld };
