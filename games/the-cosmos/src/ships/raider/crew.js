// ============================================================================
// ships/raider/crew.js - who flies a raider. Four people at four stations. They are the Loft's people (homes/people: seven MetaHuman
// models in all, so a raider's crew shares faces with the port's hiring pool, as any seven people would), with raiders' names.
//
// A post is { id, name, personId, title, seat, skill }: id is the role a crew record carries, seat is the seat in spec.js it works from.
// ============================================================================

export const RAIDER_CREW_POSTS = [
  { id: 'pilot', name: 'Pilot', personId: 'jorge', title: 'Pilot', seat: 'pilot', skill: 0.84,
    pitch: 'Flies it low and fast. Keeps the boat off the rocks.' },
  { id: 'captain', name: 'Captain', personId: 'zuri', title: 'Captain', seat: 'captain', skill: 0.82,
    pitch: 'Takes the chair and works the nose guns.' },
  { id: 'gunner_dorsal', name: 'Gunner', personId: 'walter', title: 'Gunner (dorsal)', seat: 'gun_dorsal', skill: 0.78,
    pitch: 'Takes the turret on top.' },
  { id: 'engineer', name: 'Engineer', personId: 'aoi', title: 'Engineer', seat: 'engineer', skill: 0.8,
    pitch: 'Keeps the reactor honest.' },
];

const FIRST = ['Dagny', 'Kell', 'Imre', 'Mags', 'Tove', 'Rafe', 'Sana', 'Oren', 'Lio', 'Bex', 'Nyah', 'Corin'];
const LAST = ['Rook', 'Brandt', 'Soto', 'Okoro', 'Vance', 'Hale', 'Marrow', 'Pike', 'Ng', 'Duarte', 'Kessler', 'Adeyemi'];

/** The crew of the nth raider: four people, named from the tables by the hull's number, so every boat has its own faces and names. */
export function raiderCrew(seq) {
  return RAIDER_CREW_POSTS.map((post, i) => ({
    id: `raider-${seq}-${post.id}`, role: post.id, personId: post.personId,
    name: `${FIRST[(seq * 5 + i * 3) % FIRST.length]} ${LAST[(seq * 7 + i * 5) % LAST.length]}`,
    skill: Math.max(0.7, Math.min(0.88, post.skill + (((seq * 13 + i * 7) % 9) - 4) * 0.01)),
    wageCredits: 0, status: 'aboard', unpaid: false, nextPay: 1e15, hostile: true,
  }));
}
