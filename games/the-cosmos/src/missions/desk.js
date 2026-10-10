// ============================================================================
// missions/desk.js - the hiring desks of the worlds that are not Mars (BIBLE-v3 8.5: "People to hire wait in the crew hall"). Mars keeps its Crew Hall
// (server/authority.mjs CREW_HALL: people walk out to meet you). Every other settlement has a DISPATCHER: a person at a desk beside a notice board that lists
// the jobs and the hands for hire. Pure data (no three.js, no DOM): the authority reads it to check a hire, the browser reads it to draw the list.
//
// A hand hired at a desk signs on at once and comes aboard the landed ship (the same path a prize crew takes): same wages and signing fee as the Crew Hall
// (src/economy/catalog.js WAGES), same posts (src/crew/crewSpec.js), and only for a post the ship has a station for. A hand stays at the desk's list until
// someone hires them; a dismissed hand goes back on it.
// ============================================================================
import { CREW_POSTS } from '../crew/crewSpec.js';

/** The dispatcher of each settlement: who sits at the desk, where the notice board stands (outpost metres), and the frames the desk serves. */
export const DESKS = {
  earth: { id: 'earth', person: 'e-dispatch', frames: ['earth'], name: 'Range Control dispatch', board: { x: -4, z: -62, face: 'south' }, world: 'earth' },
  ceres: { id: 'ceres', person: 'lane-clerk', frames: ['ceres'], name: 'the flight office', board: { x: 67, z: 29, face: 'west' }, world: 'ceres' },
  moon: { id: 'moon', person: 'h-guide', frames: ['moon'], name: 'the hub terminal desk', board: { x: -12, z: -57, face: 'south' }, world: 'moon' },
  callisto: { id: 'callisto', person: 'c-dispatcher', frames: ['callisto'], name: 'the camp desk', board: { x: -8, z: -70, face: 'south' }, world: 'callisto' },
};
export const deskOfPerson = (personId) => Object.values(DESKS).find((d) => d.person === personId) || null;
export const deskOfFrame = (frameId) => Object.values(DESKS).find((d) => d.frames.includes(frameId)) || null;

const H = (role, name, skill, pitch) => ({ role, name, skill, pitch, personId: CREW_POSTS.find((c) => c.id === role).personId });
/** The hands on each list: one per post. */
export const HANDS = {
  earth: [
    H('pilot', 'Tamsin Okoye', 0.83, 'Flew supply barges up the Gulf until the storms closed the lanes. Will fly anything that is not on fire, and some things that are.'),
    H('captain', 'Raul Beckett', 0.84, 'Ran a tug crew at Kennedy. Says the sea is just a very flat sky. Takes the chair and keeps his voice level.'),
    H('nav', 'Priya Venkat', 0.8, 'Reads a scanner like a menu. Has been right more often than the last two forecasters combined.'),
    H('comms', 'Ysolde Marsh', 0.79, 'Kept the beach relays alive by hand. Will listen to anything for as long as you like and report only the useful half.'),
    H('gunner_dorsal', 'Bo Tran', 0.76, 'Ex harbour patrol. Calm, patient, and fires only when it counts. Hates being thanked.'),
    H('gunner_ventral', 'Ned Alvarez', 0.73, 'Slow to find a target and then never lets go of it. Brings his own flask.'),
  ],
  ceres: [
    H('pilot', 'Kasimir Dutt', 0.82, 'Ore barge pilot from the Cut. Parks a forty tonne hull in a space the size of an apology.'),
    H('captain', 'Hedda Lund', 0.86, 'Shift captain at the pans for nine years. Does not raise her voice, because nobody has ever needed her to.'),
    H('nav', 'Anneke Ruiz', 0.78, 'Charts the rubble belt for fun. Knows where the rocks are, and holds it against them.'),
    H('comms', 'Obi Thorne', 0.8, 'Runs the Works\' radio shack on the night shift. Calls the shift boss "sir" with great feeling.'),
    H('gunner_dorsal', 'Wick Samarin', 0.75, 'Rig crew, steady hands. Aims like he is welding.'),
    H('gunner_ventral', 'Lale Odum', 0.72, 'Greenhaven medic who learned to shoot after one bad winter. Reliable, apologetic.'),
  ],
  moon: [
    H('pilot', 'Odessa Whitlock', 0.84, 'Hub shuttle pilot. Lands like she is putting a child to bed. Never spills the coffee.'),
    H('captain', 'Matthias Ng', 0.83, 'Fortis reservist between postings. Dry as a rille and twice as straight.'),
    H('nav', 'Bashir Eze', 0.81, 'Technos route desk. Plots a course in his head and then does it again on paper to be polite.'),
    H('comms', 'Linnea Hart', 0.8, 'Far-side relay operator. Hears things. Knows which ones to forget.'),
    H('gunner_dorsal', 'Ptolemy Kane', 0.76, 'Gate guard at Checkpoint Rille until it closed. Likes a clear field and a short briefing.'),
    H('gunner_ventral', 'Rue Calder', 0.73, 'Drifter and a good shot. Tells long stories about the one that got away.'),
  ],
  callisto: [
    H('pilot', 'Sylvie Okafor', 0.82, 'Flew ice tugs for the prospectors until the drills got louder than the engines. Will fly anything with a window in it.'),
    H('captain', 'Dmitri Roan', 0.85, 'Twenty years on the Mars run. Keeps the ship warm, the log honest, and the crew out of the Director\'s bad books.'),
    H('nav', 'Imogen Voss', 0.79, 'Mystara\'s own chart keeper. Knows the safe lanes round Jupiter the way other people know their own street.'),
    H('comms', 'Elias Thorne', 0.8, 'Listened to static for a living and swears it answers, occasionally, in a friendly way.'),
    H('gunner_dorsal', 'Marta Bekele', 0.75, 'Prospector who learned to shoot after one very quiet winter. Patient, exact, unbothered.'),
    H('gunner_ventral', 'Anouk Ferreira', 0.72, 'Ex relay tech. Aims the way she tunes an antenna: slowly, then all at once.'),
  ],
};
/** The hand at a desk with this post, as the authority tracks them: a stable id per (desk, post). */
export const deskKey = (deskId, role) => `desk:${deskId}:${role}`;
export const handsOf = (deskId) => (HANDS[deskId] || []).map((h) => ({ ...h, key: deskKey(deskId, h.role) }));
export const handByKey = (key) => { const [, d, r] = String(key).split(':'); const h = (HANDS[d] || []).find((x) => x.role === r); return h ? { ...h, key, desk: d } : null; };
