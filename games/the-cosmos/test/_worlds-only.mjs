// Quick iteration: only the registry / generic-planet checks. Not part of validate (validate runs them through the pkg-*.mjs hook).
import { fileURLToPath } from 'url'; import { dirname, join } from 'path';
const THREE = await import('three');
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + '  ' + d); } };
const section = (s) => console.log('\n== ' + s + ' ==');
const { run } = await import('./worlds-checks.mjs');
await run({ check, section, THREE });
console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
