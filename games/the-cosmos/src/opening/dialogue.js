// ============================================================================
// opening/dialogue.js - every line the new opening speaks, as data. Pure (no three.js): the opening draws captions from it, the voice system
// speaks them, the clip generator (tools/gen-voices.mjs, via src/voice/lines.js) voices exactly this list, and test/opening-checks.mjs fails
// if a line here has no clip. People and their jokes (Jaron, 10/3: give characters humour; some are assholes; keep it spicy).
//
// Three kinds of speaker:
//   * the ship's own voice: intercom (the captain), radio (port control), ship (the computer), no body, heard everywhere;
//   * a person in the scene: a passenger, the guide, the gate agent, the driver: `source` names whose body the sound comes from;
//   * a world's own people: src/opening/worlds/<world>/dialogue.js (the same keys in every file).
// ============================================================================
import MARS from './worlds/mars/dialogue.js';
import CERES from './worlds/ceres/dialogue.js';
import EARTH from './worlds/earth/dialogue.js';
import { CRASH_CAUSES } from './season.js';
import { arrivalNote } from './lifeboat.js';

export const WORLD_DIALOGUE = { mars: MARS, ceres: CERES, earth: EARTH };
/** The keys every world's dialogue file must have (checked by the tests). */
export const WORLD_DIALOGUE_KEYS = ['id', 'place', 'port', 'surface', 'weather', 'locker', 'crate', 'drivers', 'counter'];
export const worldDialogue = (id) => WORLD_DIALOGUE[id] || WORLD_DIALOGUE.mars;

// ---------------------------------------------------------------------------
// Aboard the Ares: the captain on the intercom, on the liner clock (seconds from waking). LINER_SECONDS is the whole of stage 0.
// ---------------------------------------------------------------------------
export const LINER_SECONDS = 205;
export const STEP_OFF = 'Welcome to Mars. Follow the amber lights to the big Arrivals sign. If you reach a fuel tank, you have taken tourism too far.';
/** t0..t1: seconds on the liner clock. voice: intercom (the captain) or radio (port control). */
export const LINER_SCRIPT = [
  { t0: 6, t1: 16, voice: 'intercom', text: 'Good morning, passengers. This is your captain. We are on schedule, on course, and on speaking terms with the weather.' },
  { t0: 24, t1: 41, voice: 'intercom', text: 'Off the port side, the escort cutter Very Sorry About The Paperwork and the liner Tharsis Promise. Off the starboard, the Quick Receipt and the Elysium Overdraft. Yes, those are their real names. No, we did not get a vote on ours.' },
  { t0: 52, t1: 64, voice: 'intercom', text: 'Beyond them, the ore carriers Not A Smuggler and Regolith Dreams. Please do not wave at Not A Smuggler. It makes them nervous.' },
  { t0: 78, t1: 87, voice: 'intercom', text: 'The cafe is open. The coffee is real. The cream is a rumour.' },
  { t0: 104, t1: 116, voice: 'intercom', text: 'We have begun our descent into Marineris. Please take a seat, or at least a firm opinion about one.' },
  { t0: 121, t1: 131, voice: 'intercom', text: 'Entering the atmosphere. You will feel some shaking. This is normal. The coffee will disagree.' },
  { t0: 146, t1: 160, voice: 'radio', text: 'Hellas Dawn, Marineris Port. You are cleared to land on Apron A. Please avoid Pad 01. It has a Meridian on it, and the Meridian has opinions.' },
  { t0: 166, t1: 176, voice: 'intercom', text: 'Landing gear is down. Landing gear confirms it is down. Landing gear would like that on the record.' },
  { t0: 188, t1: 204, voice: 'intercom', text: 'Touchdown at Marineris Port. Welcome to Mars. Local time is whatever the tower clock says. Please use the boarding gangway on the starboard side. Mind the step. It is three metres.' },
];

/**
 * The people aboard who talk when you walk up to them. `at` is ship-local metres on the Ares (x starboard, z aft, floor y 0), `seat` true when
 * they sit (the body is lowered onto the cushion), `yaw` the way they face in degrees (0 = the nose, 90 = the starboard window). `low` marks the
 * ones kept on a phone. Each says its lines in order, one per visit, when you are within `range` metres.
 */
export const LINER_TALKERS = [
  { id: 'walter', person: 'walter', voice: 'walter', name: 'Walter', at: [6.0, 5.2], yaw: 90, seat: true, low: true, range: 3.4,
    lines: ['Forty-one trips on this line, son, and the coffee has never once improved.', 'Take the window. I have seen Mars. It is red. That is the whole review.'] },
  { id: 'sunita', person: 'sunita', voice: 'sunita', name: 'Steward', at: [4.5, 10.6], yaw: 0, seat: false, low: true, range: 4.2,
    lines: ['Welcome aboard the Hellas Dawn. Tea, coffee, or a stern talking to?', 'If you have lost your luggage, it is in the hold. If you never had any, you are travelling light, and I respect that.'] },
  { id: 'ada', person: 'ada', voice: 'ada', name: 'Passenger', at: [11.5, -12.3], yaw: 90, seat: true, low: true, range: 3.6, bank: ['sal_s2', 0, 1],
    lines: ['Is it normal for the ship to hum like that? Please tell me it is normal.', 'The captain sounds so calm. That is not reassuring. Calm people scare me.'] },
  { id: 'jorge', person: 'jorge', voice: 'jorge', name: 'Passenger', at: [11.5, -26.7], yaw: 90, seat: true, low: false, range: 3.6, bank: ['sal_s1', 0, 2],
    lines: ['I paid for the window seat in advance. In advance! And there is a man in it.', 'Do not sit there. That is my cousin\'s seat. He is not here. He is also not dead. It is complicated.'] },
  { id: 'zuri', person: 'zuri', voice: 'zuri', name: 'Passenger', at: [-9.75, 17.6], yaw: 90, seat: true, low: false, range: 3.6,
    lines: ['I am writing a piece about this line. Working title: Eight Months Of Beige.', 'Off the record, the food is the best part. On the record, I have no comment on the food.'] },
  { id: 'aoi', person: 'aoi', voice: 'aoi', name: 'Passenger', at: [-10.95, 14.4], yaw: -90, seat: true, low: true, range: 3.6,
    lines: ['Pre-owned Mars real estate, friend. Great views, slight dust, no neighbours. That is a feature.', 'Okay, one neighbour. But he is very quiet. Mostly because he is a rock.'] },
  { id: 'isaiah', person: 'isaiah', voice: 'isaiah', name: 'Medic', at: [8.2, 18.6], yaw: -90, seat: false, low: false, range: 3.8,
    lines: ['Medbay. We are fully stocked on bandages and sarcasm.', 'Motion sick? Look at the horizon. There is no horizon. Look at the other horizon.'] },
];

/** Passengers with nothing to say, seated for company (room, bank, seat from the ship's own passenger seat list). */
export const LINER_EXTRAS = [
  ['sal_s2', 0, 0], ['sal_s2', 1, 3], ['sal_s2', 2, 1], ['sal_s1', 1, 4], ['sal_s1', 2, 0], ['sal_p3', 0, 2], ['sal_p3', 1, 3], ['sal_p2', 0, 1],
];
export const EXTRA_PEOPLE = ['isaiah', 'sunita', 'walter', 'ada', 'zuri', 'aoi', 'jorge'];

// ---------------------------------------------------------------------------
// At the port
// ---------------------------------------------------------------------------
export const GUIDE = { person: 'isaiah', voice: 'w-adam', name: 'Arrival guide' };
export const GUIDE_LINES = {
  welcome: 'Welcome to Marineris. Everything here is neutral: the dust, the coffee, the staff. Especially the staff.',
  board: 'The board shows every world and who runs it. Read it, pick a world, pick a side or pick none, then walk to Pad 01. The Kestrel is waiting.',
  picked: 'Good choice. Or a choice. They are all choices. The gate is Pad 01. Do not stand under anything.',
  stay: 'Staying on Mars? Bold. Nobody owns it, so nobody will rescue it. Walk out the front door, ride the lift up the control tower, and ask the watch supervisor for a paid job. Mind the dust.',
  back: 'Changed your mind? The board does not mind. The board has no feelings. I have a few.',
};
export const GATE = { person: 'ada', voice: 'w-bella', name: 'Gate agent' };
export const GATE_LINES = {
  mars: 'Kestrel to the Marineris desert. A scenic route. Mostly dust. Boarding now. Seats are unassigned and so are the safety briefings. Please sign here, here, and here. Yes, the long one.',
  ceres: 'Kestrel to Ceres. Boarding now. Seats are unassigned and so are the safety briefings. Please sign here, here, and here. Yes, the long one.',
  earth: 'Kestrel to Earth. Boarding now. Seats are unassigned, the safety briefings are the same, and yes, the planet really is that heavy. Please sign here, here, and here.',
};
export const NOT_YET = 'The Kestrel does not fly there yet. Pick a world that is open, and I will point at the gate.';

// ---------------------------------------------------------------------------
// Aboard the Kestrel: the pilot, then the cause. t is seconds on the descent clock; KESTREL_SECONDS is the whole of stage 2 (the crash is at
// KESTREL_CRASH, then black, then the wreck). `weather` is taken from the world's own dialogue file.
// ---------------------------------------------------------------------------
export const KESTREL_SECONDS = 70;
export const KESTREL_CRASH = 60;
export const KESTREL_PILOT = { voice: 'w-lewis' };
export const KESTREL_COMMON = [
  { t0: 3, t1: 12, voice: 'w-lewis', text: 'Welcome aboard the Kestrel. Flight time is about a minute. We have never needed more.' },
  { t0: 14, t1: 24, voice: 'w-lewis', text: 'We are climbing out of the port now. Please keep your hands inside the ship and your regrets inside yourselves.' },
];
/** The cause's lines (a `weather` cause adds the world's own line). Each is voiced by the pilot unless it names another voice. */
export const KESTREL_CAUSE = {
  storm: [
    { t0: 28, t1: 38, voice: 'w-lewis', text: 'Control says a solar storm is building. The Sun has not apologised.' },
    { t0: 44, t1: 54, voice: 'w-lewis', text: 'Comms just died. So did guidance. Everything is down, and so soon we will be. Brace for impact.' },
  ],
  meteor: [
    { t0: 28, t1: 38, voice: 'w-lewis', text: 'Radar shows a rock the size of a bus. It is heading for us, and it has not seen us.' },
    { t0: 44, t1: 54, voice: 'w-lewis', text: 'Strike! Hull breach, we are venting. Hold on to something. Preferably something bolted down.' },
  ],
  pirates: [
    { t0: 28, t1: 37, voice: 'w-lewis', text: 'Unidentified ships closing fast. They are not answering the radio. That is rude.' },
    { t0: 39, t1: 48, voice: 'w-fenrir', text: 'Evening, passengers. This is a Corsair boarding. Nobody move, nobody gets hurt, and nobody tells the insurer.' },
    { t0: 49.5, t1: 55.8, voice: 'w-lewis', text: 'They have taken the cargo, and now they are shooting at us. That feels like an overreaction. Brace!' },
  ],
  failure: [
    { t0: 28, t1: 38, voice: 'w-lewis', text: 'Pilot here. The left drive just made a noise it is not supposed to make.' },
    { t0: 44, t1: 54, voice: 'w-lewis', text: 'I am going to call this a controlled crash. Heads down, folks. It will be very controlled.' },
  ],
  weather: [
    { t0: 28, t1: 38, voice: 'w-lewis', text: '@weather' },
    { t0: 44, t1: 54, voice: 'w-lewis', text: 'We cannot see the pad. We cannot see anything. Brace.' },
  ],
};
export const KESTREL_BRACE = { t0: 56, t1: 60, voice: 'w-lewis', text: 'Brace! Brace! Brace!' };

// ---------------------------------------------------------------------------
// The wreck
// ---------------------------------------------------------------------------
export const WRECK_WAKE = 'Emergency power engaged. Please remain calm. Calm is an option.';
export const WRECK_CAUSE = {
  storm: 'Comms are down. The storm is still up. The storm does not care about either fact.',
  meteor: 'Hull breach confirmed. There is a hole you can look out of. Looking is free.',
  pirates: 'Corsair markings on the hull. They took the cargo and left the passengers. Rude, but efficient.',
  failure: 'Drive fault logged. The crew regrets the inconvenience. The line will pay more in settlement.',
  weather: 'Visibility is poor. The weather won this round.',
};
export const LOCKER_PROMPT = 'Open the crew locker (E)';

// ---------------------------------------------------------------------------
// Lines the old opening spoke, kept for the ride (radio and flight deck lines moved above).
// ---------------------------------------------------------------------------
export const RIDE_HINT = 'Follow the lit way to the port';
export const NEUTRAL_SETTLEMENT = 'The passenger line has a settlement waiting for you.';
/** The note on arrival (what the lifeboat needs and who has it): per world, from lifeboat.js. */
export const arrivalNoteFor = (worldId) => arrivalNote(worldId);

/** The text a '@weather' placeholder becomes for a world. */
export const resolveLine = (line, worldId) => (line.text === '@weather' ? { ...line, text: worldDialogue(worldId).weather } : line);
export const kestrelScript = (cause, worldId) => [...KESTREL_COMMON, ...(KESTREL_CAUSE[cause] || KESTREL_CAUSE.storm).map((l) => resolveLine(l, worldId)), KESTREL_BRACE];

/** The driver of a world for a faction ('none' where the world has no sides). */
export function driverFor(worldId, faction) {
  const w = worldDialogue(worldId), key = faction && w.drivers[faction] ? faction : (w.drivers.none ? 'none' : Object.keys(w.drivers)[0]);
  return { key, ...w.drivers[key] };
}
/** The recruiter of the other side, waiting at the port (null on a world with no sides). */
export function counterFor(worldId, driverFaction) {
  const c = worldDialogue(worldId).counter[driverFaction];
  return c ? { ...c } : null;
}

/**
 * Every line the opening can speak: { voice, text }. The clip generator voices this list; the validator fails if any has no clip.
 * Text with a speaker lead ("Name: ") is not used here: the captions are plain sentences and the speaker is shown by the scene.
 */
export function openingLines() {
  const out = [];
  const add = (voice, text) => { if (voice && text) out.push({ voice, text }); };
  for (const l of LINER_SCRIPT) add(l.voice, l.text);
  add('sunita', STEP_OFF);
  for (const t of LINER_TALKERS) for (const text of t.lines) add(t.voice, text);
  for (const text of Object.values(GUIDE_LINES)) add(GUIDE.voice, text);
  for (const text of Object.values(GATE_LINES)) add(GATE.voice, text);
  add(GUIDE.voice, NOT_YET);
  for (const cause of CRASH_CAUSES) for (const wid of Object.keys(WORLD_DIALOGUE)) for (const l of kestrelScript(cause, wid)) add(l.voice, l.text);
  add('ship', WRECK_WAKE);
  for (const text of Object.values(WRECK_CAUSE)) add('ship', text);
  for (const w of Object.values(WORLD_DIALOGUE)) {
    add('ship', w.surface); add('ship', w.crate);
    for (const d of Object.values(w.drivers)) for (const k of ['greeting', 'pitch1', 'pitch2', 'offer', 'closing']) add(d.voice, d[k]);
    for (const c of Object.values(w.counter)) add(c.voice, c.line);
  }
  add('intercom', NEUTRAL_SETTLEMENT);
  for (const wid of Object.keys(WORLD_DIALOGUE)) add('ship', arrivalNote(wid));
  return out;
}

/**
 * Who says a caption: { voice, source } where source names the body the sound comes from ('driver', 'guide', 'gate', 'counter',
 * 'talker:<id>', or null for the ship's own voice and the radio). Looks the text up in the same tables the lines come from.
 */
export function speakerOf(text, ctx = {}) {
  if (text === STEP_OFF) return { voice: 'sunita', source: null };
  for (const l of LINER_SCRIPT) if (l.text === text) return { voice: l.voice, source: null };
  for (const t of LINER_TALKERS) if (t.lines.includes(text)) return { voice: t.voice, source: 'talker:' + t.id };
  if (Object.values(GUIDE_LINES).includes(text) || text === NOT_YET) return { voice: GUIDE.voice, source: 'guide' };
  if (Object.values(GATE_LINES).includes(text)) return { voice: GATE.voice, source: 'gate' };
  for (const cause of CRASH_CAUSES) for (const wid of Object.keys(WORLD_DIALOGUE)) for (const l of kestrelScript(cause, wid)) if (l.text === text) return { voice: l.voice, source: null };
  if (text === WRECK_WAKE || Object.values(WRECK_CAUSE).includes(text)) return { voice: 'ship', source: null };
  for (const w of Object.values(WORLD_DIALOGUE)) {
    if (text === w.surface || text === w.crate) return { voice: 'ship', source: null };
    for (const d of Object.values(w.drivers)) for (const k of ['greeting', 'pitch1', 'pitch2', 'offer', 'closing']) if (d[k] === text) return { voice: d.voice, source: 'driver' };
    for (const c of Object.values(w.counter)) if (c.line === text) return { voice: c.voice, source: 'counter' };
  }
  if (text === NEUTRAL_SETTLEMENT) return { voice: 'intercom', source: null };
  for (const wid of Object.keys(WORLD_DIALOGUE)) if (text === arrivalNote(wid)) return { voice: 'ship', source: null };
  void ctx;
  return null;
}
