// Quick iteration: only the F3 long-range drive checks. Not part of validate (pkg-longrange.mjs is).
const THREE = await import('three');
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };
const section = (s) => console.log(`\n== ${s} ==`);
const m = await import('./pkg-longrange.mjs');
await m.run({ check, section, THREE });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
