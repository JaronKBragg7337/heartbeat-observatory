// Runs only the free-flight checks. Not part of validate: for quick iteration.
import { fileURLToPath } from 'url'; import { dirname, join } from 'path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const THREE = await import('three');
const { getBody, gravityAtRadius } = await import(`file://${join(ROOT, 'src/world/bodies.js')}`);
const GEO = await import(`file://${join(ROOT, 'src/world/geodesy.js')}`);
const FIELD = await import(`file://${join(ROOT, 'src/world/field.js')}`);
const { Walker } = await import(`file://${join(ROOT, 'src/player/walker.js')}`);
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; failures.push(n); console.log(`  FAIL  ${n} ${d}`); } };
const section = (s) => console.log(`\n== ${s} ==`);
const { runFreeflightChecks } = await import('./freeflight-checks.mjs');
await runFreeflightChecks({ check, section, THREE, mars: getBody("mars") });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); if (fail) console.log(failures.join('\n'));
process.exit(fail ? 1 : 0);
