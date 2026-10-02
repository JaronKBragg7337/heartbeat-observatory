// ============================================================================
// ships/raider/crew.js - who flies a raider. Four people at four stations.
//
// The bodies are the Loft's seven MetaHumans (homes/people). Which four a hull uses is rotated by the hull's
// number (src/ships/raider/looks.js), and each of them wears a duty look: cloth, hair and skin tints, and a
// helmet with a visor. A raider's four therefore never read as Ada, Zuri, Jorge or the other hall faces.
// The names are the raiders' own. The hire pool's posts and names are not changed here.
//
// A post is { id, name, personId, title, seat, skill }: id is the role a crew record carries, seat is the
// seat in spec.js it works from. The post's personId is only the station's old label. The crew record's
// personId comes from the look, and that is what gets drawn.
// ============================================================================

import { raiderLook } from './looks.js';

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

/** The crew of the nth raider: four people, named from the tables by the hull's number, each with their own look. */
export function raiderCrew(seq) {
  return RAIDER_CREW_POSTS.map((post, i) => {
    const look = raiderLook(seq, i);
    return {
      id: `raider-${seq}-${post.id}`, role: post.id, personId: look.personId, look,
      name: `${FIRST[(seq * 5 + i * 3) % FIRST.length]} ${LAST[(seq * 7 + i * 5) % LAST.length]}`,
      skill: Math.max(0.7, Math.min(0.88, post.skill + (((seq * 13 + i * 7) % 9) - 4) * 0.01)),
      wageCredits: 0, status: 'aboard', unpaid: false, nextPay: 1e15, hostile: true,
    };
  });
}
