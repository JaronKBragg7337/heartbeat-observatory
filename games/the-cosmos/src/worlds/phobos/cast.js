// ============================================================================
// worlds/phobos/cast.js - the people of Mars's two moons who can be talked to: who they are and where they stand. PURE DATA (no three.js, no DOM): the browser
// reads it to put a name and a conversation on the suited figures the outposts already draw (phobos/client.js, deimos/client.js, by `id`), and the authority
// reads it (missions/where.js) so a job can start with them or end with them.
//
// Positions are outpost metres (x east, z south), the same numbers the outposts' own figures stand at. `body` is the Loft person the figure uses.
// `line` is what they say first, `question` what you can ask, `answer` what they tell you, `reply` the button that ends it.
// ============================================================================
export const MOON_CAST = {
  phobos: [
    { id: 'ph-yard', body: 'ada', name: 'Nadia Ferro', title: 'Yard hand, Stickney East', x: 14.8, z: -42.4,
      line: 'Cargo yard. Everything here is lashed down twice, and so should you be.',
      question: 'What is it like up here?',
      answer: 'Nine people, three tanks, and a rock that would let you jump clean off it. You weigh about what a bag of sugar weighs on Mars. Clip to the line when you walk, and never throw anything you want back.',
      reply: 'I will keep my feet down.' },
    { id: 'ph-pump', body: 'jorge', name: 'Tomas Reyes', title: 'Propellant tech, Stickney East', x: 38.5, z: 21.4,
      line: 'Pump panel. If a needle is in the red, tell me before you tell anyone else.',
      question: 'What does the station make?',
      answer: 'Propellant, slowly. We cook it out of the rock and fill the three tanks, and ships that do not want to haul fuel up from Mars buy it here. The survey people on Deimos think we are a petrol station. They are not wrong.',
      reply: 'Good to know where the fuel is.' },
  ],
  deimos: [
    { id: 'de-driller', body: 'zuri', name: 'Zuri Achebe', title: 'Driller, line D-3', x: 32.2, z: 11.9,
      line: 'Rig is live. Stand where I can see you.',
      question: 'What are you drilling for?',
      answer: 'Ice, and how old it is. Twelve cores a rack, top to bottom. There is a dark band at the end of every one, and the tower on Mars wants every centimetre of it. Nobody tells the driller why.',
      reply: 'I will stay out of the way.' },
    { id: 'de-geo', body: 'aoi', name: 'Aoi Tanabe', title: 'Survey geologist, Deimos camp', x: 39.1, z: 15.6,
      line: 'Survey tent. Mind the sample trays, they are in order.',
      question: 'How long have you been out here?',
      answer: 'A month this time. Four of us and a drill. Phobos sends propellant, Mars sends food, and both forget. If you fly this way often you will be the most popular person on this rock.',
      reply: 'I will come back.' },
  ],
};
/** Every talkable person of the two moons, each with its frame. */
export const MOON_PEOPLE = Object.entries(MOON_CAST).flatMap(([frame, list]) => list.map((w) => ({ ...w, frame })));
export const moonCastById = (frame, id) => (MOON_CAST[frame] || []).find((w) => w.id === id) || null;
