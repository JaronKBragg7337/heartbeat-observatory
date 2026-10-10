// ============================================================================
// missions/lines.js - the lines the jobs speak: each giver says their pitch (the job they offer) in their own voice when you ask for work. A giver with no voice (the
// people of Occator Works have none yet) is text only. tools/gen-voices.mjs reads missionLines() through src/voice/lines.js; test/voice-checks.mjs fails if one has no clip.
// ============================================================================
import { MISSIONS } from './catalog.js';
import { WORKER_CAST } from '../voice/cast.js';
import { castOf } from '../worlds/moon/cast.js';
import { EARTH_CAST } from '../worlds/earth/cast.js';
import { CALISTO_CAST } from '../worlds/callisto/cast.js';

const voiceOf = (id) => (WORKER_CAST[id] && WORKER_CAST[id].voice)
  || [...EARTH_CAST, ...CALISTO_CAST, ...castOf('moon'), ...castOf('moon-shackleton'), ...castOf('moon-daedalus')].find((p) => p.id === id)?.voice || null;

export function missionLines() {
  const out = [];
  for (const m of MISSIONS) { const v = voiceOf(m.giver); if (v) out.push({ voice: v, text: m.pitch }); }
  return out;
}
