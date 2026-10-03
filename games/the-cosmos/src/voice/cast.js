// ============================================================================
// cast.js - who has which voice. Pure data and two tiny pure functions, so the browser, the clip generator
// (tools/gen-cosmos-voices.mjs) and the validator all agree on exactly which voice says a line.
//
// VOICES are Kokoro-82M voices (Apache-2.0 model and voice packs). Each person is cast to fit their Loft model:
// gender and age read off homes/people/*.jpg (isaiah: man, 40s. ada: young woman. jorge: heavy man, 50s. sunita: young
// woman. zuri: woman. walter: old man, grey hair. aoi: man, 30s). A clip is stored under hash(voice + text), so the
// same sentence in two voices is two clips, and an edited sentence is simply a new clip.
// ============================================================================

/** voice id -> { kokoro: the Kokoro voice name, speed, gender, fallback: pitch/rate for browser speechSynthesis }. */
export const VOICES = {
  ada:      { kokoro: 'af_nova',     speed: 1.03, gender: 'f', pitch: 1.1,  rate: 1.0 },
  zuri:     { kokoro: 'af_kore',     speed: 0.98, gender: 'f', pitch: 0.9,  rate: 0.98 },
  sunita:   { kokoro: 'bf_isabella', speed: 1.0,  gender: 'f', pitch: 1.05, rate: 1.0 },
  jorge:    { kokoro: 'am_michael',  speed: 0.96, gender: 'm', pitch: 0.85, rate: 0.96 },
  walter:   { kokoro: 'bm_george',   speed: 0.92, gender: 'm', pitch: 0.75, rate: 0.9 },
  aoi:      { kokoro: 'am_eric',     speed: 1.0,  gender: 'm', pitch: 1.0,  rate: 1.0 },
  isaiah:   { kokoro: 'am_onyx',     speed: 0.97, gender: 'm', pitch: 0.8,  rate: 0.96 },
  // the port's own people (their voices are fixed by who they are, and the port picks a body of the same gender)
  'w-heart':  { kokoro: 'af_heart',  speed: 1.0,  gender: 'f', pitch: 1.1,  rate: 1.0 },
  'w-river':  { kokoro: 'af_river',  speed: 1.0,  gender: 'f', pitch: 1.0,  rate: 1.0 },
  'w-alice':  { kokoro: 'bf_alice',  speed: 1.0,  gender: 'f', pitch: 1.05, rate: 1.0 },
  'w-aoede':  { kokoro: 'af_aoede',  speed: 1.0,  gender: 'f', pitch: 1.15, rate: 1.0 },
  'w-jessica':{ kokoro: 'af_jessica',speed: 1.0,  gender: 'f', pitch: 1.0,  rate: 1.0 },
  'w-bella':  { kokoro: 'af_bella',  speed: 1.0,  gender: 'f', pitch: 1.1,  rate: 1.0 },
  'w-sky':    { kokoro: 'af_sky',    speed: 1.0,  gender: 'f', pitch: 1.05, rate: 1.0 },
  'w-lily':   { kokoro: 'bf_lily',   speed: 1.0,  gender: 'f', pitch: 1.2,  rate: 1.0 },
  'w-liam':   { kokoro: 'am_liam',   speed: 1.0,  gender: 'm', pitch: 0.95, rate: 1.0 },
  'w-lewis':  { kokoro: 'bm_lewis',  speed: 0.97, gender: 'm', pitch: 0.9,  rate: 0.97 },
  'w-fable':  { kokoro: 'bm_fable',  speed: 0.93, gender: 'm', pitch: 0.8,  rate: 0.92 },
  'w-puck':   { kokoro: 'am_puck',   speed: 1.04, gender: 'm', pitch: 1.1,  rate: 1.04 },
  'w-adam':   { kokoro: 'am_adam',   speed: 0.98, gender: 'm', pitch: 0.9,  rate: 0.98 },
  'w-fenrir': { kokoro: 'am_fenrir', speed: 0.93, gender: 'm', pitch: 0.75, rate: 0.93 },
  'w-echo':   { kokoro: 'am_echo',   speed: 1.0,  gender: 'm', pitch: 1.0,  rate: 1.0 },
  // voices that are not a body in the scene: the ship's computer and port control on the radio
  ship:     { kokoro: 'af_sky',      speed: 1.0,  gender: 'f', pitch: 1.0,  rate: 1.0 },
  radio:    { kokoro: 'af_alloy',    speed: 1.04, gender: 'f', pitch: 1.0,  rate: 1.05 },
  intercom: { kokoro: 'bm_daniel',   speed: 1.0,  gender: 'm', pitch: 0.9,  rate: 1.0 },
};

/** Port workers: id -> { voice, body: which Loft bodies suit them }. body 'f' | 'm' | 'old' (older man). */
export const WORKER_CAST = {
  'cab-pad-1':      { voice: 'w-heart',   body: 'f' },
  'cab-pad-2':      { voice: 'w-liam',    body: 'm' },
  'cab-ground':     { voice: 'w-river',   body: 'f' },
  'cab-approach':   { voice: 'w-lewis',   body: 'm' },
  'cab-weather':    { voice: 'w-alice',   body: 'f' },
  'cab-supervisor': { voice: 'w-fable',   body: 'old' },
  'cab-runner':     { voice: 'w-puck',    body: 'm' },
  'cab-binoculars': { voice: 'w-aoede',   body: 'f' },
  'depot-clerk':    { voice: 'w-jessica', body: 'f' },
  'arrival-guide':  { voice: 'w-adam',    body: 'm' },
  'reception-clerk':{ voice: 'w-bella',   body: 'f' },
  'trader-1':       { voice: 'w-sky',     body: 'f' },
  'trader-2':       { voice: 'w-fenrir',  body: 'old' },
  'trader-3':       { voice: 'w-lily',    body: 'f' },
  'trader-4':       { voice: 'w-echo',    body: 'm' },
};

/** Loft bodies by what they look like. */
export const BODY_KIND = { ada: 'f', zuri: 'f', sunita: 'f', isaiah: 'm', jorge: 'm', aoi: 'm', walter: 'old' };

/** Crew are voiced by who they are: crew member name (lower case) -> voice id. */
export const CREW_VOICE = { ada: 'ada', zuri: 'zuri', jorge: 'jorge', aoi: 'aoi', sunita: 'sunita', walter: 'walter', isaiah: 'isaiah' };

export function voiceForName(name) {
  const k = String(name || '').trim().toLowerCase();
  return CREW_VOICE[k] || null;
}

/** cyrb53: a small, fast 53-bit string hash that comes out the same in every JS engine. */
export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

const LEAD = /^(?:Ada|Zuri|Jorge|Aoi|Sunita|Walter|Isaiah|Nav|Pilot|Comms|Port control|Cabin crew|Flight deck):\s+/;

/** What is actually spoken: the subtitle without any "Name: " lead, trimmed, one space between words. */
export function spokenText(text) {
  return String(text || '').replace(LEAD, '').replace(/\s+/g, ' ').trim();
}

/** The clip key for a voice saying a line. */
export function clipKey(voiceId, text) { return hash53(voiceId + '|' + spokenText(text)); }
