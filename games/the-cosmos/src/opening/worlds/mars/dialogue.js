// Mars: the opening's words for a crash on the desert 2.6 km from Marineris Port. Every world has one of these files with the SAME keys
// (test/opening-checks.mjs checks it). `drivers` is keyed by the faction that sent the rover, or 'none' where the world has no sides.
// voice = which Kokoro voice says it (src/voice/cast.js); person = which Loft body stands in the rover.
export default {
  id: 'mars',
  place: 'the desert off Marineris Port',
  port: 'Marineris Port',
  // the ship's computer, once, when you step out of the cabin (spoken by the 'ship' voice)
  surface: 'Outside air is carbon dioxide and optimism. Gravity is point three eight of Earth. Do not jump near anything you like.',
  // what the transport's weather line is on this world
  weather: 'That is a dust storm below us. A big one, and we are about to meet it.',
  locker: {
    name: 'Mateo Vance',
    role: 'Purser, Mars Line',
    photo: 'A photo taped inside the door: a man in a bad paper crown holding a very large fish, and a small girl holding a smaller fish with great dignity.',
    note: 'If found, please return the jar of pickled peppers to my sister Lucia at Marineris. It is not a weapon. It is a gift. It is also a little bit of a weapon. Do not open it near the vents.',
  },
  crate: 'Survival crate open. One hand tool, one day of air and water, one beacon. Beacon armed. Help is on the way. Probably.',
  drivers: {
    none: { person: 'aoi', voice: 'w-puck', name: 'Dev', role: 'Port crew', faction: null,
      greeting: 'Port crew. We saw you come down. Everybody saw you come down. It was loud.',
      pitch1: 'The port is neutral. Nobody owns anything here, which is why nobody ever fixed this road.',
      pitch2: 'Work is easy to find. Getting paid is a different department.',
      offer: 'Need a lift? Climb in, or follow the lights. They are not very bright. Neither am I, but I know the way.',
      closing: 'That is the port. Welcome to Mars. Mind the dust. It minds you.' },
  },
  counter: {},
};
