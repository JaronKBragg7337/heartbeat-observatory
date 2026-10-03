// Shared rendering/collision policy: keep owned landed vessels in the world,
// hide disconnected flying vessels and ships reserved for unfinished openings.
export function shipPresence(ship,snapshot) {
  if(ship.npc)return 'npc';
  const owner=snapshot.players[ship.owner];
  if(!owner||owner.opening&&!owner.opening.complete)return null;
  if(owner.online||Object.values(snapshot.players).some(p=>p.online&&p.aboardShipId===ship.id))return 'connected';
  return ship.pose.landed?'parked':null;
}
