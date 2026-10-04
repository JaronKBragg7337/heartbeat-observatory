// Moon: the opening's words for a crash in a small crater on the terminator, 4.2 km north of Tranquility Civil Hub. The SAME keys as every world's file
// (src/opening/worlds/<id>/dialogue.js re-exports this: `export { default } from '../../../worlds/moon/dialogue.js'`), plus `gate` (the Kestrel's gate agent's line
// for the Moon) and `crashSite` (src/worlds/moon/crash.js). `drivers` is keyed by the faction that sent the rover; `counter` by the same, naming the OTHER side's
// recruiter who is waiting at the hub (their bodies stand there: src/worlds/moon/cast.js).
// voice = which Kokoro voice says it (src/voice/cast.js); person = which Loft body stands in the rover.
export default {
  id: 'moon',
  place: 'a small crater on the terminator',
  port: 'Tranquility Civil Hub',
  surface: 'Outside there is nothing. Gravity is point one six of Earth, so every step is a small flight. Your suit timer started when the hull opened. Please do not sneeze in the helmet.',
  weather: 'The Moon has no weather. Which is why the pilot picked the terminator: half the ground is blazing and half is black. Guess which half the autopilot chose.',
  locker: {
    name: 'Odile Brightwater',
    role: 'Steward, Moon Line',
    photo: 'A photo taped inside the door: a woman in a spacesuit helmet on a beach, holding a bucket and absolutely refusing to look at the camera.',
    note: 'If found, tell Kaz at Tranquility that I did not forget the bucket. I came to the Moon on purpose. The bucket was an accident. It is a long story and the bucket comes out well.',
  },
  crate: 'Survival crate open. One hand tool, one day of air and water, one beacon. Beacon armed. Help is on the way, in a pressurised rover, at a dignified lunar crawl.',
  gate: 'Kestrel to the Moon. A short hop for a world, a long one for you. Boarding now. Seats are unassigned, and so, to be fair, is the landing site. Please sign here, here, and here. Yes, the long one.',
  crashSite: { frame: 'moon', eastM: 600, northM: 4200, name: 'the bowl north of the hub' },
  drivers: {
    fortis: { person: 'jorge', voice: 'jorge', name: 'Trooper Halloran', role: 'Trooper, Fortis', faction: 'fortis',
      greeting: 'Trooper Halloran, Fortis. We watched you come down. Everyone on the ridge watched you come down. Sector four would like a word, and a form.',
      pitch1: 'Fortis keeps the Moon alive. Walls, power and a schedule. We take anyone who can read a number and hold a line.',
      pitch2: 'The glass people will tell you they are friendly. They also have your photograph. Think about that for a second.',
      offer: 'Climb in. Mind the dust, mind the badge, and mind the red stripe. It is how the rover knows who is in charge.',
      closing: 'That is the hub. Neutral ground, they say. Remember your number.' },
    technos: { person: 'zuri', voice: 'zuri', name: 'Technician Maren', role: 'Technician, Technos Prime', faction: 'technos',
      greeting: 'Technician Maren, Technos Prime. Are you hurt? Please say no. We only have the one blanket.',
      pitch1: 'We run the dishes and the relay. Signal over noise, always. We take anyone who can listen.',
      pitch2: 'The soldiers will say they keep the Moon alive. They have the guns. We have the phone numbers. You decide which you need on a bad day.',
      offer: 'The rover has glass all round, so you can see everything. It is also all recorded, for your safety. Please do not wave.',
      closing: 'That is Tranquility. Please enjoy it. It is the one place on the Moon where nobody is shouting at anybody.' },
  },
  // the other side's recruiter, waiting at the hub; keyed by the faction that sent the rover
  counter: {
    fortis: { person: 'ada', voice: 'w-aoede', name: 'Doctor Pryce', faction: 'technos',
      line: 'Doctor Pryce, Technos Prime. Before you sign anything with the soldiers: we have a brochure, and a quiet room. Come and look at nothing with us.' },
    technos: { person: 'jorge', voice: 'w-fenrir', name: 'Sergeant Holloway', faction: 'fortis',
      line: 'Sergeant Holloway, Fortis. The glass people are very nice, and very, very quiet. Ask yourself why. Then come and get a badge.' },
  },
};
