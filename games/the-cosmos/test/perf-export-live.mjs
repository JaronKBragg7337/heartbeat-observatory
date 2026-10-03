// Copies the LIVE world (read-only cosmos_load RPC) into a local file for perf tests. Never writes the live database.
// usage: node test/perf-export-live.mjs <out.json>   (reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from keys.env; never prints them)
import { readFileSync, writeFileSync } from 'node:fs';
import { stringify, parse } from '../src/world-state/wire.js';
const out = process.argv[2]; if (!out) throw Error('out path');
for (const line of readFileSync('C:/Users/lilli/.secrets/keys.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*?)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
}
const url = process.env.SUPABASE_URL.replace(/\/$/, ''), key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const r = await fetch(url + '/rest/v1/rpc/cosmos_load', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ wid: process.env.COSMOS_WORLD_ID || 'marineris' }) });
if (!r.ok) throw Error('load failed ' + r.status);
const s = parse(await r.text());
writeFileSync(out, stringify(s));
const rec = s.record; console.log('exported revision', rec.revision, 'ships', Object.keys(rec.ships || {}).length, 'players', Object.keys(rec.players || {}).length, 'bricks', s.bricks.length, 'bytes', Buffer.byteLength(stringify(s)));
