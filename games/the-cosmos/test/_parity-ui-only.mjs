// Runs only the browser UI parity checks (about a minute). Not part of validate: for quick iteration.
import '../server/runtime.mjs';
let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n} ${d}`); } };
const section = (s) => console.log(`\n== ${s} ==`);
const { runParityUIChecks } = await import('./parity-ui-checks.mjs');
await runParityUIChecks({ check, section });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
