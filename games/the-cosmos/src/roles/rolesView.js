// ============================================================================
// roles/rolesView.js - F5/F4 in the "World / crew" sheet: who holds the seats where you are, what the world's two meters say in words,
// and the buttons to take a seat, work a shift, join a faction or vote. No new screen: it adds lines and buttons to the sheet that is
// already there, and everything is words (the balance is never a slider).
// ============================================================================
import { worldOfFrame, worldById, seatsOn, PLAYABLE_FACTIONS, OFFICE_REP } from './seats.js';
import { holderOf, factionOfPlayer, repOf, voteWeight, worldPolicy, leadersOf } from './holders.js';
import * as B from './balance.js';

/** text(t) adds a paragraph, btn(label, action) adds a button. `s` is the world snapshot, `p` the local player. */
export function rolesPanel(s, p, text, btn) {
  const roles = s.roles, homes = s.homes;
  if (!roles || !homes) return;
  const w = worldOfFrame(p.frameId), mine = factionOfPlayer(roles, p.id);
  text(`Roles. ${mine ? `You are with ${mine}.` : 'You are with no faction.'} Vote weight ${voteWeight(roles, p.id)}.`);
  if (mine) btn(`Leave ${mine}`, { type: 'faction-leave' });
  else for (const f of PLAYABLE_FACTIONS) btn(`Join ${f}`, { type: 'faction-join', faction: f });
  if (!w) { text('You are in open space. Seats are taken by showing up on a world.'); return; }
  if (w.neutral) { text('Mars is neutral. Its staff and traders stay NPCs, and nobody owns anything here. Pick a world and a side, then fly there.'); return; }
  const h = homes[w.id], pol = worldPolicy(roles, w.id), d = B.describe(h);
  text(`${w.name}. ${d.balance} ${d.strength}`);
  text(`Prices and patrols follow it: tax ${Math.round(pol.tax * 100)}% (cap 15), docking ${pol.dock}, hull class ${B.hullClass(h)}.`);
  for (const l of leadersOf(roles, w.id)) text(`${l.faction} leader: ${l.holder.kind === 'human' ? l.holder.name + ' (a player)' : l.holder.npc.name + (l.holder.npc.asshole ? ' (an asshole)' : '')}. Stance ${l.stance.toFixed(2)}.`);
  const open = Object.entries(roles.elections).filter(([id, e]) => e.status === 'open' && id.startsWith(w.id + '/') || e.status === 'open' && w.factions.some((f) => id === f + '/leader'));
  for (const [id, e] of open) {
    text(`Polls are open for ${id}.`);
    for (const c of Object.values(e.candidates)) btn(`Vote ${c.name}`, { type: 'role-vote', seat: id, candidate: c.id });
    btn('Stand for it (cooperate)', { type: 'role-stand', seat: id, stance: 0.6 });
    btn('Stand for it (compete)', { type: 'role-stand', seat: id, stance: -0.6 });
  }
  const hasJob = seatsOn(w.id).some((q) => q.tier === 'job' && holderOf(roles, q.id).playerId === p.id);
  for (const seat of seatsOn(w.id)) {
    const hold = holderOf(roles, seat.id);
    if (hold.kind === 'human' && hold.playerId === p.id) {
      text(`You are ${seat.title}.`);
      if (seat.tier === 'job') { btn('Work a faction shift', { type: 'role-work', seat: seat.id, side: 'home' }); btn('Work a joint shift', { type: 'role-work', seat: seat.id, side: 'joint' }); }
      btn(`Stand down (${seat.title})`, { type: 'role-leave', seat: seat.id });
    } else if (seat.tier === 'top' && hold.kind === 'npc') btn(`Hear the ${seat.title.toLowerCase()}${seat.faction ? ' of ' + seat.faction : ''}`, { type: 'role-talk', seat: seat.id });
    else if (seat.tier === 'job' && hold.kind === 'npc' && !hasJob) btn(`Take the ${seat.title.toLowerCase()} post (${hold.npc.name} steps aside)`, { type: 'role-take', seat: seat.id });
    else if (seat.tier === 'office' && hold.kind === 'npc' && repOf(roles, p.id, w.factions[0]) + repOf(roles, p.id, w.factions[1] || w.factions[0]) >= OFFICE_REP) btn(`Take ${seat.title}`, { type: 'role-take', seat: seat.id });
  }
}
