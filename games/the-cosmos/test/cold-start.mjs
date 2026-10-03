// Cold start after a long downtime: a copy of the live world whose last save is `days` old (default 3) is started as a real process;
// the time from spawn to a healthy /health is the number that matters (target < 60 s). Never touches Supabase.
//   node test/cold-start.mjs <live-world.json> [days]
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, renameSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { stringify, parse } from '../src/world-state/wire.js';
const root = resolve(fileURLToPath(new URL('../', import.meta.url))), data = resolve(root, 'server/.data'), file = resolve(data, 'world.json');
const days = Number(process.argv[3] || 3), s = parse(readFileSync(process.argv[2], 'utf8'));
s.record.savedAt = Date.now() - days * 86400e3;
mkdirSync(data, { recursive: true }); const keep = existsSync(file) ? file + '.keep' : null; if (keep) renameSync(file, keep);
writeFileSync(file, stringify(s));
const port = 8397, env = { ...process.env, COSMOS_LOCAL_STORE: '1', COSMOS_PORT: String(port) }; delete env.SUPABASE_URL; delete env.SUPABASE_SERVICE_ROLE_KEY;
const t0 = performance.now(); const child = spawn(process.execPath, [resolve(root, 'server/index.mjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; child.stdout.on('data', (b) => log += b); child.stderr.on('data', (b) => log += b);
let seen = '', firstAnswer = null, ok = null;
while (performance.now() - t0 < 180000) {
  try { const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) }); const j = await r.json();
    if (firstAnswer === null) firstAnswer = performance.now() - t0; if (j.ok) { ok = performance.now() - t0; seen = JSON.stringify(j); break; } } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
// a few seconds under tick, health latency
const lat = []; for (let i = 0; i < 20; i++) { const a = performance.now(); try { await (await fetch(`http://127.0.0.1:${port}/health`)).json(); } catch {} lat.push(performance.now() - a); await new Promise((r) => setTimeout(r, 200)); }
child.kill(); rmSync(file, { force: true }); if (keep) renameSync(keep, file);
console.log(`world last saved ${days} days ago; port answered (starting) after ${firstAnswer?.toFixed(0)} ms; healthy after ${ok?.toFixed(0)} ms`);
console.log('health body:', seen); lat.sort((a, b) => a - b); console.log(`health latency under tick: p50 ${lat[10].toFixed(1)} ms max ${lat.at(-1).toFixed(1)} ms`);
console.log(ok !== null && ok < 60000 ? 'PASS cold start under 60 s' : 'FAIL cold start too slow'); process.exit(ok !== null && ok < 60000 ? 0 : 1);
