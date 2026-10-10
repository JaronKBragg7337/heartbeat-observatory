// ============================================================================
// worlds/callisto/cast.js - the people of the Valhalla Camp and the prospectors' camp: who they are, where they stand, what they say.
// Pure data (the server reads who sells the lifeboat parts from src/opening/lifeboat.js REPAIR_GIVERS, whose ids and spots match these;
// the browser draws and speaks them; src/missions/where.js maps their ids to places). Outpost-local metres (x east, z south, origin
// the middle of the landing pad). The prospector stands at the prospectors' camp, 1.2 km north of the pad (a port of the world def):
// his coordinates are pad-frame, so the mission arrow and the authority can find him; camp.js draws him at his own camp's frame.
// ============================================================================
export const CALISTO_CAST = [
  { id: 'c-director', name: 'Director Ila Sorn', title: 'Director of Mystara', faction: 'mystara', role: 'leader', body: 'zuri', voice: 'zuri', x: -8, z: -76, face: 'south', site: 'pad',
    line: 'I am the Director. Everything you see that is standing, we measure with; everything that is sealed, we do not open. You are welcome at the camp if you can be useful.',
    question: 'What is Mystara listening to?',
    answer: 'Europa, mostly. The ocean under the ice sings on the long bands, and lately it answers the short ones too. The storms took our relays, so we listen from here, and we do not look away. That is all I will say about it in the cold.',
    reply: 'Then I will be useful.' },
  { id: 'c-archivist', name: 'Tomas Grey', title: 'Quartermaster of the Archive', faction: 'mystara', role: 'trader', body: 'aoi', voice: 'aoi', x: 30, z: 56, face: 'west', site: 'pad',
    line: 'Quartermaster. Water, rations, cable, hand warmers, and one power cell I have been saving for a boat that deserves it. Ask if you need something; everything is written down twice.',
    question: 'Why is everything written down twice?',
    answer: 'Because the first record is for us, and the second is for whoever digs this camp out of the ice in a thousand years. The Director says the instrument is the point. I say the notebook is. We agree to disagree.',
    reply: 'Twice it is.' },
  { id: 'c-array', name: 'Odette Marsh', title: 'Keeper of the Standing Array', faction: 'mystara', role: 'worker', body: 'ada', voice: 'ada', x: -46, z: 30, face: 'east', site: 'pad',
    line: 'Mind the array stones. Nine of them, one for each band we listen on, and the middle one for the band we do not name. If a glyph is lit, something is being measured. Most of them are lit.',
    question: 'What does the middle stone measure?',
    answer: 'The band we do not name. It has been lit since the year of the storms, and it pulses harder when a ship comes down hard, and I do not know why, and the Director has stopped pretending she does not see it. Walk the relay line for me if you want to be useful.',
    reply: 'I will walk the line.' },
  { id: 'c-dispatcher', name: 'Farah Adeyemi', title: 'Camp dispatcher', faction: 'mars', role: 'officer', body: 'sunita', voice: 'sunita', x: -2, z: -64, face: 'south', site: 'pad',
    line: 'Camp dispatch. I log every pad, every boot print and every job. The board beside me lists them; the desk signs hands for any ship that flies out of here. The road to Mars is long and the company is good.',
    question: 'What jobs are there?',
    answer: 'Whatever keeps the camp standing. Ice for the melt, parts for the dishes, a relay that stopped answering, a core sample someone drilled where they should not have. Ask the board, or ask the people. Everyone here is a little desperate and very polite.',
    reply: 'The board it is.' },
  // the open seat: an NPC prospector holds it loosely at the prospectors' camp until a faction's players raise a building (bible v3 4.4)
  { id: 'c-prospector', name: 'Bram Okonkwo', title: 'Prospector, spokesman of the camp', faction: 'unbound', role: 'worker', body: 'jorge', voice: 'jorge', x: 6, z: -1200, face: 'south', site: 'port',
    line: 'Bram, of the prospectors. Twenty-three of us, six drills, and not one deed to our name, which is exactly how we like it. The seat is open, friend. Raise a building and it is yours. Until then, we hold it.',
    question: 'What are you drilling for?',
    answer: 'Whatever the ice is hiding. Clean ice for the melt, metal in the dark craters, and last month my number four drill went clang on something that is not in any map. The Director went very quiet when I showed her the core. You want a coupler for a boat? I have three. I have a use for hands like yours, too.',
    reply: 'Show me the core sometime.' },
];

/** Every static line these people say, with the voice that says it (read by src/voice/lines.js for tools/gen-voices.mjs). */
export function callistoLines() {
  const out = [];
  for (const p of CALISTO_CAST) for (const key of ['line', 'answer']) if (p[key]) out.push({ voice: p.voice, text: p[key] });
  return out;
}
