// Earth: the opening's words for a crash on the Florida scrub a few kilometres from the Skyward Launch Complex at Cape Canaveral. Same keys as every world's file.
// Homeguard has nothing built on Earth yet, so both rides end at Skyward's gate and the Homeguard driver says so.
export default {
  id: 'earth',
  place: 'the scrub flats inland of Cape Canaveral',
  port: 'the Skyward Launch Complex',
  surface: 'Outside air is warm, wet and full of mosquitoes. Gravity is nine point eight two metres per second squared. Everything weighs exactly what you remember.',
  weather: 'That is a thunderstorm below us. Florida, in the afternoon. It does this on purpose.',
  locker: {
    name: 'Rosa Delgado',
    role: 'Steward, Mars Line',
    photo: 'A photo taped inside the door: a woman in a sun hat on a pier, holding up a fish nearly as long as her arm, her small son beside her pretending he caught it.',
    note: 'To whoever finds this: the fish was this big. I do not care what my brother says. If you are on Earth, the pier is at Cocoa Beach, and the coffee there is bad but it is home.',
  },
  crate: 'Survival crate open. One hand tool, one day of air and water, one beacon. Beacon armed. Help is on the way, and for once it is not far.',
  drivers: {
    skyward: { person: 'isaiah', voice: 'isaiah', name: 'Okafor', role: 'Crew chief, flight line', faction: 'skyward',
      greeting: 'Okafor, flight line, Skyward. We saw you on radar. You were not on the schedule.',
      pitch1: 'Skyward runs the launch sites. We take anyone who wants to learn what it costs to leave this planet. It costs a great deal. We keep the receipts.',
      pitch2: 'The Homeguard people will tell you to stay and rebuild. Fine. Someone should. But someone also has to go.',
      offer: 'Climb in. The seat is hot from the sun. It is a short drive to the complex, and we will not stop for alligators.',
      closing: 'That is the Skyward Launch Complex. Range Control is the long building. The tall one is the tower. Do not touch the tower.' },
    homeguard: { person: 'walter', voice: 'walter', name: 'Pruitt', role: 'Organiser, Homeguard', faction: 'homeguard',
      greeting: 'Pruitt, Homeguard. We saw you come down. I would say welcome home, but there is not much home built yet.',
      pitch1: 'Homeguard wants to stay and rebuild. Sea walls, fields, schools, the long slow work. We have the plans and the people. We do not have a roof yet. You could raise the first one.',
      pitch2: 'The rocket people want everyone off the planet. Someone should leave, I suppose. Not everyone.',
      offer: 'Climb in. The only thing standing on this coast is the Skyward complex, so that is where we are going. I borrowed the truck. Do not tell them.',
      closing: 'This is the Skyward complex. Homeguard has nothing built here yet. Not a hall, not a wall. Remember that, for when we do.' },
  },
  // the other side's recruiter, waiting at the complex; keyed by the faction that sent the rover
  counter: {
    skyward: { person: 'walter', voice: 'walter', name: 'Pruitt', faction: 'homeguard',
      line: 'Pruitt, Homeguard. Before you sign with the rocket people: there is a whole planet down here to rebuild, and nobody else is offering to stay.' },
    homeguard: { person: 'isaiah', voice: 'isaiah', name: 'Okafor', faction: 'skyward',
      line: 'Okafor, Skyward. The Homeguard man is lovely and so is his plan. We have a launch pad. It is a very good pad.' },
  },
};
