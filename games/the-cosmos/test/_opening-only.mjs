// Runs only the headless opening checks (fast iteration; not part of validate).
const THREE = await import('three');
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; failures.push(n); console.log(`  FAIL  ${n} ${d}`); } };
const section = (s) => console.log(`\n== ${s} ==`);
const { runOpeningChecks } = await import('./opening-checks.mjs');
await runOpeningChecks({ check, section, THREE });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); if (fail) console.log(failures.join('\n'));
process.exit(fail ? 1 : 0);
