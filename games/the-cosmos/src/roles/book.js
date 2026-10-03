// ============================================================================
// roles/book.js - F5: "by the book". What an NPC holder does when nobody human holds the seat. Plain and predictable on purpose:
// a faction's philosophy (its name and ethos, BIBLE-v3 section 4) fixes a stance, and every NPC decision is a function of that stance and
// the world's two meters (src/roles/balance.js). A human candidate has to out-argue this; a human holder can set anything inside the caps.
//
// stance: -1 = compete at home (hoard, build, fortify) ... +1 = cooperate early (spend the home on reach). DECISIONS 10/3 12:06: the names
// describe each faction's philosophy, not a forced role: players choose and may leave; NPC behaviour follows the name.
// ============================================================================
import { CAPS } from './seats.js';

export const PHILOSOPHY = {
  homeguard: { stance: -0.7, note: 'We stay, rebuild and fortify. Walls first.' },
  skyward: { stance: 0.8, note: 'Up is a direction. Spend the home on the ladder.' },
  fortis: { stance: -0.55, note: 'Hard schedule, hard gate. Keep the Moon alive, then talk.' },
  technos: { stance: 0.45, note: 'Signal over noise. Build the thing everyone needs.' },
  ironclad: { stance: -0.45, note: 'Dig, haul, argue about the pay later.' },
  greenhaven: { stance: 0.6, note: 'Grow what we need, share what we grew.' },
  mystara: { stance: 0.1, note: 'Listen first. Act when we have heard.' },
  unbound: { stance: -0.2, note: 'Nobody needed. Nobody owed. Own receipts.' },
  wanderhome: { stance: 0.9, note: 'Go where the lanterns go.' },
  corsairs: { stance: -0.4, note: 'If it drifts it is ours. Recycling, not piracy.' },
};
export const stanceOf = (factionId) => (PHILOSOPHY[factionId] ? PHILOSOPHY[factionId].stance : 0);
const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));
export const clampCap = (key, v) => clamp(v, CAPS[key]);
export const inCap = (key, v) => Number.isFinite(v) && v >= CAPS[key][0] && v <= CAPS[key][1];

/** A deterministic 0..1 from a string and an integer. */
export function unit(str, n = 0) {
  let h = 2166136261 ^ n;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The stance a faction actually runs at: its leader's. A human leader's chosen stance wins; an NPC leader follows the philosophy. */
export function leaderStance(factionId, humanStance) {
  return Number.isFinite(humanStance) ? clamp(humanStance, CAPS.stance) : stanceOf(factionId);
}
/** The stance a world runs at: the mean of its factions' stances (the governor of a two-sided world answers to both). */
export const worldStance = (stances) => (stances.length ? stances.reduce((a, b) => a + b, 0) / stances.length : 0);

/** What an NPC governor / commander / officer sets, from the world's stance (-1..1). Always inside CAPS. */
export function npcPolicy(stance) {
  const comp = (1 - stance) / 2;                          // 0 cooperative .. 1 competitive
  return {
    tax: clampCap('tax', 0.02 + 0.09 * comp),             // a competing world taxes outsiders harder
    fee: clampCap('fee', 0.03 + 0.12 * comp),
    margin: clampCap('margin', 0.04 + 0.1 * comp),
    patrol: clampCap('patrol', 0.25 + 0.55 * comp),
    dock: stance < -0.5 ? 'faction' : 'open',             // only a hard competitor asks who is landing; Mars never does (it is neutral)
  };
}

/**
 * The NPC electorate for a seat: `count` voters per faction, each with a stance spread around the faction's philosophy.
 * Returns an array of stances. Deterministic (the same on every restart), so a close vote is not a coin flip.
 */
export function npcElectorate(seatId, factions, count = 120) {
  const out = [];
  for (const f of factions) for (let i = 0; i < count; i++) out.push(clamp(stanceOf(f) + (unit(seatId + '|' + f, i) - 0.5) * 1.0, CAPS.stance));
  return out;
}
/**
 * How one NPC voter picks. Candidates: [{ id, stance, rep, human, incumbent }]. Score = closeness of stance + persuasion (a candidate with
 * standing in the faction is believed) + a small incumbency edge. The best score wins the voter. A human with no standing and a stance
 * across the room loses to the NPC incumbent every time: they have to win people over.
 */
export function npcVote(voterStance, candidates) {
  let best = null, bestScore = -1e9;
  for (const c of candidates) {
    const score = -Math.abs(c.stance - voterStance) + Math.min(0.5, (c.rep || 0) / 120) + (c.incumbent ? 0.08 : 0);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best;
}
/** The whole NPC tally for a seat. Returns { [candidateId]: votes }. */
export function npcTally(seatId, factions, candidates, count = 120) {
  const tally = Object.fromEntries(candidates.map((c) => [c.id, 0]));
  for (const s of npcElectorate(seatId, factions, count)) { const c = npcVote(s, candidates); if (c) tally[c.id]++; }
  return tally;
}
