// Quick iteration: only the SH14 / SH15 ship checks (a minute or two). Not part of validate (pkg-sh14.mjs is).
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path'; import { fileURLToPath } from 'url'; import { pathToFileURL } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shim = join(ROOT, 'node_modules', 'three');
if (!existsSync(join(shim, 'package.json'))) { mkdirSync(shim, { recursive: true }); writeFileSync(join(shim, 'package.json'), JSON.stringify({ name: 'three', version: '0.160.0-vendored', type: 'module', main: './index.js' })); writeFileSync(join(shim, 'index.js'), `export * from '../../lib/three.module.js';\n`); }
const THREE = await import('three');
const { getBody } = await import(pathToFileURL(join(ROOT, 'src/world/bodies.js')).href);
const FIELD = await import(pathToFileURL(join(ROOT, 'src/world/field.js')).href);
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };
const section = (s) => console.log(`\n== ${s} ==`);
const m = await import('./pkg-sh14.mjs');
await m.run({ check, section, THREE, mars: getBody('mars'), FIELD, ROOT });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
