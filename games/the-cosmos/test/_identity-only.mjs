// Runs only the identity checks. Not part of validate: for quick iteration.
import '../server/runtime.mjs';
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; failures.push(n); console.log(`  FAIL  ${n} ${d}`); } };
const section = (s) => console.log(`\n== ${s} ==`);
const { runIdentityChecks } = await import('./identity-checks.mjs');
await runIdentityChecks({ check, section });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); if (fail) console.log(failures.join('\n'));
process.exit(fail ? 1 : 0);
