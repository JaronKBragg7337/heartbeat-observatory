// ============================================================================
// lines.js - every line the game can speak, assembled from the game's own dialogue data (no copy kept here). The clip
// generator (tools/gen-cosmos-voices.mjs) voices exactly this list, and test/voice-checks.mjs fails when a line has no clip,
// so adding a line to the game and running the generator is all it takes to give it a voice.
//
// Structured sources (traders, port workers, hire pitches, the opening) are read directly. Crew, trip and job sentences
// live inline in the systems that say them; tools/scan-lines.mjs finds those, and the templates with a changing part
// (a place name, a hull percentage) are expanded below. Sentences with free numbers ("Contact at 412 metres") cannot be
// pre-recorded: they are spoken by the browser's own voice instead (see voice.js).
// ============================================================================
import { TRADERS, QUESTS } from '../economy/catalog.js';
import { CREW_POSTS, LINES as CREW_LINES, PLACES } from '../crew/crewSpec.js';
import { WORKER_LINES, WORKER_FALLBACK } from '../port/workerLines.js';
import { WORKER_CAST, CREW_VOICE, spokenText } from './cast.js';
import { openingLines } from '../opening/dialogue.js';
import { roleLines } from '../roles/npcs.js';
import { moonLines } from '../worlds/moon/cast.js';       // WD-MOON
import { earthLines } from '../worlds/earth/cast.js';
import { callistoLines } from '../worlds/callisto/cast.js';
import { missionLines } from '../missions/lines.js';       // MISSIONS: each giver's pitch
import { DESTINATIONS } from '../space/spaceSpec.js';
import { BODIES } from '../world/bodies.js';
import { frameWorlds } from '../worlds/registry.js';
import { HUNT_ALT_M } from '../crew/autopilot.js';
import { BOUNTY_CREDITS } from '../space/spaceSpec.js';

/** Which voices say the lines of each scanned group. */
export const GROUP_VOICES = {
  crew: ['ada', 'zuri'],            // a flyer's acceptances and replies
  flyer: ['ada', 'zuri'],
  ship: ['ship', 'ada', 'zuri'],    // the trip panel: the ship itself, or the pilot who flies it (trip.by)
};
const CREW_IDS = Object.values(CREW_VOICE).filter((v) => v !== 'isaiah');

const placeNames = () => [...PLACES.map((p) => p.name), ...BODIES.filter((b) => b.id === 'mars').flatMap((b) => (b.landmarks || []).map((l) => l.name))];
const destNames = () => DESTINATIONS.filter((d) => d.kind !== 'far').map((d) => d.name);
const landNames = () => DESTINATIONS.filter((d) => d.kind !== 'far' && d.kind !== 'deep').map((d) => d.name);       // F3: a held-off world (kind 'deep') is never arrived over or landed on
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Template source (as written in the code) -> every text it can be. Anything not listed is spoken by the browser voice. */
export const TEMPLATES = {
  'Course set for ${pl.name}.': () => placeNames().map((n) => `Course set for ${n}.`),
  'Down at ${st.name}.': () => placeNames().map((n) => `Down at ${n}.`),
  'On station over ${st.name}.': () => placeNames().map((n) => `On station over ${n}.`),
  'Mars airspace is neutral: nothing here to shoot. Climbing to ${Math.round(HUNT_ALT_M)} metres to find the raiders.': () =>
    [`Mars airspace is neutral: nothing here to shoot. Climbing to ${Math.round(HUNT_ALT_M)} metres to find the raiders.`],
  "Hull's at ${Math.round(f.hull)} percent. Breaking off, going down to neutral airspace.": () =>
    range(26, 34).map((n) => `Hull's at ${n} percent. Breaking off, going down to neutral airspace.`),
  'Course set for ${this.dest.name}.': () => destNames().map((n) => `Course set for ${n}.`),
  'Course set for ${dest.name}.': () => destNames().map((n) => `Course set for ${n}.`),
  'Arrived over ${d.name}. Easing level.': () => landNames().map((n) => `Arrived over ${n}. Easing level.`),
  'Down at ${this.dest.name}.': () => landNames().map((n) => `Down at ${n}.`),
  'We are at ${w.body.name} already.': () => ['Mars', ...frameWorlds().map((w) => w.name)].map((n) => `We are at ${n} already.`),
  'Raider down. Bounty ${BOUNTY_CREDITS} credits.': () => [`Raider down. Bounty ${BOUNTY_CREDITS} credits.`],
};

/** Lines taken straight from structured data. */
export function structuredLines() {
  const out = [...openingLines()];
  for (const [id, line] of Object.entries(WORKER_LINES)) out.push({ voice: WORKER_CAST[id].voice, text: line });
  for (const [id, cast] of Object.entries(WORKER_CAST)) {
    const t = TRADERS[id], q = QUESTS.find((x) => x.giver === id);
    if (t?.greeting) out.push({ voice: cast.voice, text: t.greeting });
    out.push({ voice: cast.voice, text: t?.answer || (q ? q.offer : WORKER_FALLBACK.answer) });
    if (q) out.push({ voice: cast.voice, text: q.offer });
  }
  out.push(...roleLines());          // F5: every NPC seat-holder's lines (src/roles/npcs.js)
  out.push(...moonLines());          // WD-MOON: the Moon's people (src/worlds/moon/cast.js)
  out.push(...earthLines());         // Earth: the people at the Skyward complex
  out.push(...callistoLines());      // WD-CALLISTO: the people of the Valhalla Camp
  out.push(...missionLines());       // MISSIONS: the pitch of every job whose giver has a voice
  for (const p of CREW_POSTS) {
    out.push({ voice: p.personId, text: p.pitch });
    for (const k of ['hired', 'noRamp', 'settle', 'needYou']) out.push({ voice: p.personId, text: CREW_LINES[k](p.name) });
  }
  return out;
}

/** Everything: structured lines plus the scanned sentences (pass in scanGroup from tools/scan-lines.mjs; the browser never needs it). */
export function allLines(scanGroup) {
  const out = structuredLines();
  const dynamic = [];
  for (const group of Object.keys(GROUP_VOICES)) {
    const { statics, templates } = scanGroup(group);
    const texts = [...statics];
    for (const t of templates) { const f = TEMPLATES[t]; if (f) texts.push(...f()); else dynamic.push(t); }
    for (const voice of GROUP_VOICES[group]) for (const text of texts) out.push({ voice, text });
  }
  // crew-system sentences that any hired person can say (hire, board, wait)
  for (const voice of CREW_IDS) for (const text of ['Thanks, boss. I will be at the board.', 'All yours, boss.', 'I cannot find a way to my station. I will wait here.'])
    out.push({ voice, text });
  const seen = new Set(), unique = [];
  for (const l of out) { const text = spokenText(l.text), k = l.voice + '|' + text; if (!seen.has(k)) { seen.add(k); unique.push({ voice: l.voice, text }); } }
  return { lines: unique, dynamic };
}
