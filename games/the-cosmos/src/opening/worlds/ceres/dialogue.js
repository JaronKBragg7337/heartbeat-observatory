// Ceres: the opening's words for a crash on the grey-white salt and ice a few kilometres from Occator Works. Same keys as every world's file.
export default {
  id: 'ceres',
  place: 'the salt flats of Occator',
  port: 'Occator Works',
  surface: 'Gravity outside is point two eight metres per second squared. Every step floats. Do not sneeze.',
  weather: 'That is ice fog below us. Thick, white, and exactly where the ground is.',
  locker: {
    name: 'Ines Okonkwo',
    role: 'Steward, Mars Line',
    photo: 'A photo taped inside the door: a woman in a ridiculous hat standing in front of a tomato plant taller than she is, looking furious and delighted.',
    note: 'To whoever finds this: the tomato is not mine. It belongs to a Greenhaven doctor. I was only carrying it. If it is still alive, tell her I said the ship was fine until it was not.',
  },
  crate: 'Survival crate open. One hand tool, one day of air and water, one beacon. Beacon armed. Help is on the way, at the speed of a floating rover.',
  drivers: {
    ironclad: { person: 'jorge', voice: 'jorge', name: 'Hanrahan', role: 'Shift boss, Pit Seven', faction: 'ironclad',
      greeting: 'Hanrahan, shift boss, Pit Seven. We saw your boat come down. We always see them come down.',
      pitch1: 'Ironclad takes anyone who can swing a pick. We pay in shares and sandwiches, and one of those is usually good.',
      pitch2: 'The green people will talk about gardens. Gardens do not build hulls. We build hulls.',
      offer: 'Climb in. Mind the salt. It gets everywhere. I found some in my sandwich last Tuesday.',
      closing: 'Occator Works. Ironclad built every hull you will ever fly in. A thank you note would be nice.' },
    greenhaven: { person: 'zuri', voice: 'zuri', name: 'Doctor Roth', role: 'Field medic, Greenhaven', faction: 'greenhaven',
      greeting: 'Doctor Roth, Greenhaven. Are you hurt? Do not answer, I will check. Climb in.',
      pitch1: 'We grow food under glass in the dark, and we take it very seriously. Fresh tomatoes. On a dwarf planet. Think about that.',
      pitch2: 'The hard hats will say we are soft. We have the only fresh tomato for four hundred million kilometres. Who is soft now?',
      offer: 'There is a blanket behind the seat. It is a nice blanket. It was grown. Well, the wool was.',
      closing: 'That is Occator Works. You will be fine. People usually are, once the shaking stops.' },
  },
  // the other side's recruiter, waiting at the port; keyed by the faction that sent the rover
  counter: {
    ironclad: { person: 'zuri', voice: 'zuri', name: 'Doctor Roth', faction: 'greenhaven',
      line: 'Doctor Roth, Greenhaven. Before you sign anything with the hard hats: we have gardens. Come and look at a tomato.' },
    greenhaven: { person: 'jorge', voice: 'jorge', name: 'Hanrahan', faction: 'ironclad',
      line: 'Hanrahan, Ironclad. The doctor is lovely and so is her lettuce. We have hulls and a pension. Mostly a pension.' },
  },
};
