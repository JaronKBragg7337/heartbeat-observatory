// ============================================================================
// worlds/earth/cast.js - the two people at the Skyward Launch Complex today, where they stand and what they say. Pure data (the server reads who sells the
// lifeboat parts from src/opening/lifeboat.js REPAIR_GIVERS, whose ids and spots match these; the browser draws and speaks them). Outpost-local metres (x east,
// z south, origin the middle of the landing pad). The same shape as the Moon's custom people (worlds/moon/cast.js), and the same Loft bodies as the two drivers of the
// opening (src/opening/worlds/earth/dialogue.js): the man who finds you in the rover is the man you meet again at the complex.
// Homeguard has nothing built on Earth: its organiser stands in Skyward's yard, beside the training hall.
// ============================================================================
export const EARTH_CAST = [
  { id: 'e-okafor', name: 'Okafor', title: 'Skyward crew chief, flight line', faction: 'skyward', role: 'worker', body: 'isaiah', voice: 'isaiah', x: -50, z: 36, face: 'east',
    line: 'Flight line. If you need something fixed, you are in the right place. If you need something launched, that is a longer conversation.',
    question: 'What is this place?',
    answer: 'The Skyward Launch Complex. A pad, a tower, an assembly hall and a tank farm. The Atlantic is that way, about seven hundred metres. Everything here exists to get things off Earth, because Earth does not let go easily.',
    reply: 'Understood.' },
  { id: 'e-pruitt', name: 'Pruitt', title: 'Homeguard organiser', faction: 'homeguard', role: 'worker', body: 'walter', voice: 'walter', x: 48, z: -58, face: 'east',
    line: 'Pruitt, Homeguard. I am all of Homeguard on this coast. Please do not count the chairs.',
    question: 'What does Homeguard want?',
    answer: 'To stay, and to rebuild. Sea walls, fields, schools, and a great deal of patience. We have nothing built yet, so I am standing in someone else\'s yard. They are very polite about it.',
    reply: 'Someone has to start.' },
];

/** Every static line these two say, with the voice that says it (read by src/voice/lines.js for tools/gen-voices.mjs). */
export function earthLines() {
  const out = [];
  for (const p of EARTH_CAST) for (const key of ['line', 'answer']) if (p[key]) out.push({ voice: p.voice, text: p[key] });
  return out;
}
