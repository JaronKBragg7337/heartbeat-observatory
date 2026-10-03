// Finds every sentence a person (or the ship) can say in the game's source: string literals that read like speech, in the
// files that produce crew, trip and job lines. Used by gen-voices.mjs so a new line gets a voice without anyone listing it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SCAN_FILES = {
  crew: ['src/crew/crewSystem.js'],            // said by whoever the order was given to
  flyer: ['src/crew/autopilot.js'],            // said by the pilot or captain
  ship: ['src/space/spaceTrip.js', 'src/space/spaceSystem.js', 'src/space/jobs.js'],   // the trip panel: the flyer, or the ship
};
const RE = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
const SPEECH = /^[A-Z][^]{8,170}[.!?]$/;
const NOT = /^(Not |No such|Unknown|Cannot|Could not|Nothing|You |Pick |Plot |Hire |Say |Clear |Close |Only |Already|The ramp is up\. Lower)/;

/** -> { statics: [text], templates: [source with ${...}] } for the files of one group. */
export function scanGroup(group) {
  const statics = new Set(), templates = new Set();
  for (const f of SCAN_FILES[group]) {
    const s = readFileSync(join(ROOT, f), 'utf8'); let m; RE.lastIndex = 0;
    while ((m = RE.exec(s))) {
      const raw = m[1] ?? m[2] ?? m[3]; if (raw == null) continue;
      const t = raw.replace(/\\'/g, "'").replace(/\\n/g, ' ');
      if (!SPEECH.test(t) || !/ /.test(t) || NOT.test(t)) continue;
      if (m[3] !== undefined && t.includes('${')) templates.add(t); else statics.add(t);
    }
  }
  return { statics: [...statics], templates: [...templates] };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const g of Object.keys(SCAN_FILES)) { const r = scanGroup(g); console.log('##', g); for (const t of r.statics) console.log('S ', t); for (const t of r.templates) console.log('T ', t); }
}
