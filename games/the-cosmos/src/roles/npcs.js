// ============================================================================
// roles/npcs.js - F5: who stands in a seat when no human does. An NPC holder is a name, a temperament (some are assholes: Jaron 10/3 10:54,
// "people like comedy"), a voice and a handful of lines. All of it is derived from the seat's id, so there is nothing to store: the server
// keeps only the humans, and every phone and the server agree on who the NPC is. Pure data, no three.js.
//
// Every speaking line here is voiced (node tools/gen-voices.mjs; src/voice/lines.js lists `roleLines()`). Lines carry no free numbers and no
// names, so a clip is made once per (voice, line) and the whole cast costs about a hundred and fifty clips.
// ============================================================================
import { allSeats, seatById } from './seats.js';
import { unit } from './book.js';

/** One voice per temperament (voice ids are src/voice/cast.js VOICES). The voice's gender sets the NPC's name pool. */
export const TEMPERAMENTS = {
  warm:    { voice: 'w-heart',  gender: 'f', weight: 3, asshole: false },
  dry:     { voice: 'w-lewis',  gender: 'm', weight: 3, asshole: false },
  smug:    { voice: 'w-alice',  gender: 'f', weight: 2, asshole: true },
  grumpy:  { voice: 'w-fenrir', gender: 'm', weight: 2, asshole: false },
  rude:    { voice: 'w-puck',   gender: 'm', weight: 2, asshole: true },
  nervous: { voice: 'w-lily',   gender: 'f', weight: 2, asshole: false },
  sour:    { voice: 'w-river',  gender: 'f', weight: 2, asshole: true },
};
const TEMP_IDS = Object.keys(TEMPERAMENTS);

const FIRST = {
  f: ['Maren', 'Odile', 'Tamsin', 'Reyes', 'Ines', 'Kalani', 'Brigid', 'Noor', 'Saskia', 'Perpetua', 'Wren', 'Delphine', 'Yara', 'Marit', 'Oksana', 'Lucinda'],
  m: ['Bram', 'Cormac', 'Tavish', 'Idris', 'Lazlo', 'Gideon', 'Oren', 'Pascal', 'Ruben', 'Silas', 'Tobias', 'Wendell', 'Anselm', 'Dov', 'Emeka', 'Hollis'],
};
const LAST = ['Okafor', 'Vance', 'Brightwater', 'Salt', 'Ng', 'Marchetti', 'Haldane', 'Quill', 'Abara', 'Stroud', 'Petrov', 'Lindqvist', 'Mbeki', 'Cobb', 'Ferreira', 'Dunmore', 'Aoki', 'Greaves', 'Nakamura-Reed', 'Tull'];

/** Faction leaders and world governors have a fixed temperament and their own lines; everyone else is drawn by seat id. */
const LEADER_TEMP = { homeguard: 'smug', skyward: 'warm', fortis: 'rude', technos: 'dry', ironclad: 'grumpy', greenhaven: 'warm', mystara: 'sour', unbound: 'grumpy', wanderhome: 'warm', corsairs: 'rude' };
const TOP_TEMP = { mars: 'dry', earth: 'smug', moon: 'rude', ceres: 'grumpy', callisto: 'sour', wanderhome: 'warm', corsairs: 'rude' };

const LEADER_LINES = {
  homeguard: { greet: 'Welcome to the wall. It is eleven metres of opinions, and all of them are right.', job: 'We stay. We rebuild. We will not be leaving, and the harbour fees are not negotiable.' },
  skyward: { greet: 'Welcome aboard. Up is a direction, and also, as you will notice, our entire career plan.', job: 'Everything we build is a ladder. We would rather be late and up there than comfortable and down here.' },
  fortis: { greet: 'State your business at the gate. Badges visible. All clear, until it is not.', job: 'We kept this Moon alive when the storms cut it off. Remember that at the checkpoint.' },
  technos: { greet: 'Signal over noise. Your data is safe with us. Legally, that is.', job: 'We build the thing everyone needs and let them come to us. Eventually, they do.' },
  ironclad: { greet: 'Union made. Union broken. Union made again. What do you want?', job: 'We dig, we haul, and we argue about the pay later. In that order. Always.' },
  greenhaven: { greet: 'Welcome to the dome. Please do not feed it.', job: 'We grow what we need and we share what we grew. The seeds are not negotiable. The sharing is.' },
  mystara: { greet: 'The instrument is listening. Please do not touch it.', job: 'We listen first. Everything else is polite noise until we have heard what is out there.' },
  unbound: { greet: 'Nobody needed. Everything yours. Mind the door, it sticks.', job: 'We never needed a partner and we have the receipts. Ask us for help and we will ask you why.' },
  wanderhome: { greet: 'Third door on the left, if it is still there. Come in, the kettle is on.', job: 'We go wherever the lanterns go. Bring a cup, bring a story, bring something that needs fixing.' },
  corsairs: { greet: 'Not pirates. Aggressive recyclers. Do not touch the trophies.', job: 'If it drifts, it is ours. If it is nailed down, it was ours yesterday. We call that a recycling programme.' },
};
const TOP_LINES = {
  mars: { greet: 'Mars serves everyone. Mars also charges everyone. I am the governor, which means I take the complaints.', job: 'Nobody owns anything on Mars, including me. I just hold the clipboard.' },
  earth: { greet: 'I govern the only world with weather, which makes everything my fault. Keep your hands off the sea wall.', job: 'Earth is full. Earth is flooded. Earth is, nevertheless, still the best address in the Solar System.' },
  moon: { greet: 'The Moon is open. Mind the dust. Mind the checkpoint. Mind me.', job: 'Two factions, one sky, and a very long gate queue. I enjoy all three.' },
  ceres: { greet: 'Ceres runs on ore and bad moods. I supply the second one.', job: 'The mine works, the greenhouse works, and the two of them will not speak to each other. Progress.' },
  callisto: { greet: 'Callisto is cold, quiet, and a very long way from help. I find that restful.', job: 'Everything here is far away, including the other faction. I recommend it.' },
  wanderhome: { greet: 'You are on Wanderhome. Nothing matches, everyone knows where everything is, and the third door on the left moves.', job: 'I command a village that is also a fleet. The paperwork is mostly lanterns.' },
  corsairs: { greet: 'You found the Refuge. Nobody told you where it was, so now you owe us for the tour.', job: 'I command a station made of other stations. Do not ask which ones, and do not ask for them back.' },
};

const GENERIC = {
  warm: { greet: ['Hello, friend. Come in, sit down, someone will bring you something hot.', 'Oh good, a new face. I was getting bored of the old ones.'], stepAside: 'Take it, it is yours. I will be around, probably eating.', return: 'Oh, you left. That is fine. I kept the seat warm, and I did not move it an inch.', open: 'Happy to tell you.', close: 'Come back and tell me how it went.' },
  dry: { greet: ['Hello. I would say it is a pleasure, but I would have to file a form.', 'Yes? Go on. I am listening with moderate enthusiasm.'], stepAside: 'It is your seat now. I will go and be unremarkable somewhere else.', return: 'Back already. The seat missed you. I did not, but the seat did.', open: 'Since you asked.', close: 'That is the exciting part, I am afraid.' },
  smug: { greet: ['Oh, you are here to talk to me. Of course you are.', 'I am very good at this job, in case you were wondering. Everyone says so. Mostly me.'], stepAside: 'Fine, you take it. Try not to do it worse than I did. That will be difficult.', return: 'You quit? Oh, what a surprise. No, it is not. Move over.', open: 'Allow me.', close: 'I make it look easy. It is not. I am just good.' },
  grumpy: { greet: ['What.', 'You are standing in my light. Make it quick.'], stepAside: 'Take the chair, then. Do not touch my mug.', return: 'Back. I knew it. Everybody leaves, and then I get the paperwork.', open: 'Fine.', close: 'Now go away.' },
  rude: { greet: ['Look who finally walked up. What do you want, a medal?', 'I did not hear you. I did, actually. I just did not care.'], stepAside: 'Oh, sure, take my job. See how long you last, hero.', return: 'Ha. Quit already. Get out of my chair. Mine. I mean it.', open: 'Pay attention, this is simple.', close: 'Do not make me repeat it, genius.' },
  nervous: { greet: ['Oh! Hello! You startled me. Everything is fine. Is everything fine?', 'I am supposed to say something helpful. Give me one second.'], stepAside: 'Oh, thank goodness. I mean, congratulations. Please be careful with the, well, everything.', return: 'Oh no. You left? Okay. Okay! I can do this. I can absolutely do this.', open: 'Right, okay.', close: 'Please do not ask me anything harder.' },
  sour: { greet: ['Oh, hello. I was having a lovely nothing. It is fine.', 'Sure. Interrupt me. Everyone does.'], stepAside: 'No, no, you take it. I only did it for years. Do not thank me.', return: 'Oh, you gave it back. How generous. I have just been sitting here.', open: 'Oh, you want to know.', close: 'Not that anyone ever says thank you.' },
};
const CORE = {
  pilot: 'I fly people and parcels where they asked to go, usually near the time they asked.',
  trader: 'I buy what you are selling and sell what you did not know you needed.',
  hauler: 'I carry heavy things from where they are to where they are not, and I do it slowly.',
  'gas-worker': 'I sell fuel and I know where the bathroom is. That is the whole job.',
  miner: 'I dig things up. Some of it is valuable. Some of it is dust that cost a great deal of effort.',
  medic: 'I fix people. The part where you were warned is billed separately.',
  patrol: 'I keep the lane safe, or at least quieter than it would be without me.',
  'port-master': 'I run the port. Every dock, every fee, every complaint, in that order.',
  'trade-director': 'I set the margins. If something costs too much, that was me, and I meant it.',
  'security-chief': 'I decide who gets watched and for how long. Mostly it is everyone, a little.',
  'station-commander': 'I command this station. Do not touch the airlock handles unless you are following the law.',
  governor: 'I govern this world, which mostly means I answer for it.',
  'faction-leader': 'I lead this faction, which mostly means I am blamed for it.',
};

const pick = (seatId, n, mod) => Math.floor(unit(seatId, n) * mod) % mod;
function temperamentOf(seat) {
  if (seat.kind === 'faction-leader') return LEADER_TEMP[seat.faction] || 'dry';
  if (seat.kind === 'governor' || seat.kind === 'station-commander') return TOP_TEMP[seat.world] || 'dry';
  const total = TEMP_IDS.reduce((a, t) => a + TEMPERAMENTS[t].weight, 0);
  let r = unit(seat.id, 1) * total;
  for (const t of TEMP_IDS) { r -= TEMPERAMENTS[t].weight; if (r < 0) return t; }
  return 'dry';
}
/** The NPC who holds a seat: { seatId, name, temperament, voice, asshole, gender }. The same on the server and on every phone. */
export function npcFor(seatId) {
  const seat = typeof seatId === 'string' ? seatById(seatId) : seatId;
  if (!seat) throw Error('Unknown seat: ' + seatId);
  const temperament = temperamentOf(seat), T = TEMPERAMENTS[temperament];
  const first = FIRST[T.gender][pick(seat.id, 2, FIRST[T.gender].length)], last = LAST[pick(seat.id, 3, LAST.length)];
  return { seatId: seat.id, name: `${first} ${last}`, temperament, voice: T.voice, gender: T.gender, asshole: T.asshole };
}
export const SITUATIONS = ['greet', 'job', 'stepAside', 'return'];
/** A line an NPC says: { voice, text }. Situations: greet (you walk up), job (what I do), stepAside (a human took my seat), return (the human left). */
export function lineFor(seatId, situation) {
  const seat = typeof seatId === 'string' ? seatById(seatId) : seatId, n = npcFor(seat), G = GENERIC[n.temperament];
  const special = seat.kind === 'faction-leader' ? LEADER_LINES[seat.faction] : (seat.kind === 'governor' || seat.kind === 'station-commander') ? TOP_LINES[seat.world] : null;
  let text;
  if (situation === 'greet') text = special ? special.greet : G.greet[pick(seat.id, 4, G.greet.length)];
  else if (situation === 'job') text = special ? special.job : `${G.open} ${CORE[seat.kind]} ${G.close}`;
  else if (situation === 'stepAside') text = G.stepAside;
  else if (situation === 'return') text = G.return;
  else throw Error('Unknown situation: ' + situation);
  return { voice: n.voice, text };
}
/** Every line any NPC in any seat can say (for the voice generator and the checks): deduplicated { voice, text }. */
export function roleLines() {
  const seen = new Set(), out = [];
  for (const s of allSeats()) for (const sit of SITUATIONS) {
    const l = lineFor(s, sit), k = l.voice + '|' + l.text;
    if (!seen.has(k)) { seen.add(k); out.push(l); }
  }
  return out;
}
