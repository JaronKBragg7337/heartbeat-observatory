// Checks that index.html points at its files and every module import between the game files resolves.
// Run: node games/rocket/test/files.test.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
let bad = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) bad++; };
for (const m of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) ok(fs.existsSync(path.join(dir, m[1])), `index.html -> ${m[1]}`);
ok(/<script type="module" src="\.\/game\.js">/.test(html), 'index.html loads game.js as a module');
ok(/"three": "https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\//.test(html), 'three.js pinned to 0.160.0 in the import map');
const seen = new Set(), todo = ['game.js'];
while (todo.length) {
  const f = todo.pop(); if (seen.has(f)) continue; seen.add(f);
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const m of src.matchAll(/from '\.\/([^']+)'/g)) { ok(fs.existsSync(path.join(dir, m[1])), `${f} imports ./${m[1]}`); todo.push(m[1]); }
}
// every id the game looks up exists in index.html
const game = fs.readFileSync(path.join(dir, 'game.js'), 'utf8');
const ids = [...game.matchAll(/\$\('([A-Za-z0-9]+)'\)/g)].map(m => m[1]);
const missing = [...new Set(ids)].filter(id => !html.includes(`id="${id}"`));
ok(missing.length === 0, `every element the game uses exists in index.html${missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''}`);
process.exitCode = bad ? 1 : 0;
