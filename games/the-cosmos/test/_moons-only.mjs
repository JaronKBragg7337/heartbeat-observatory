// Quick iteration: only the moons checks (a minute). Not part of validate.
import { fileURLToPath } from 'url'; import { dirname, join } from 'path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const THREE = await import('three');
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };
const section = (s) => console.log(`\n== ${s} ==`);
const { runMoonsChecks, runMoonTripChecks } = await import('./moons-checks.mjs');
await runMoonsChecks({ check, section, THREE }); if (!process.env.NOTRIPS) await runMoonTripChecks({ check, section });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
