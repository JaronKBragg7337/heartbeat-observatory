// Runs only the fleet checks (about a minute). Not part of validate: for quick iteration.
import { fileURLToPath } from 'url'; import { dirname, join } from 'path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const THREE = await import('three');
const { getBody } = await import(`file://${join(ROOT, 'src/world/bodies.js')}`);
const FIELD = await import(`file://${join(ROOT, 'src/world/field.js')}`);
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; failures.push(n); console.log(`  FAIL  ${n} ${d}`); } };
const section = (s) => console.log(`\n== ${s} ==`);
const { runFleetChecks } = await import('./fleet-checks.mjs');
await runFleetChecks({ check, section, THREE, mars: getBody('mars'), FIELD });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); if (fail) console.log(failures.join('\n'));
process.exit(fail ? 1 : 0);
