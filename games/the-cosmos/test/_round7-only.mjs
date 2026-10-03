import '../server/runtime.mjs';
let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n} ${d}`); } };
const section = (s) => console.log(`\n== ${s} ==`);
const { runRound7Checks } = await import('./round7-checks.mjs');
await runRound7Checks({ check, section });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
