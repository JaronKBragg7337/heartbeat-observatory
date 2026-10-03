// ADMIN: reset the world to a fresh Mars (everyone starts over). Use while the game is still being built.
//   node server/reset-world.mjs --live [--env <keys.env>]            print what it WOULD remove (nothing is changed)
//   node server/reset-world.mjs --live [--env <keys.env>] --apply    do it
//   node server/reset-world.mjs --file <world.json> [--apply]        a local FileAdapter world
//   --keep-terrain   keep terrain edits (by default they go too: a fresh Mars)
// Removes: players, player-owned ships, pads, crew contracts, accounts (sign-in links), quests, receipts, damage, rovers, terrain edits.
// Keeps: the market, the world clock, NPC raiders (the fleet director refills them).
// The authority must NOT be running (one process per world): stop node on port 8390 first, then run this, then let the watchdog start it again.
// Players who come back start a new opening. Never prints keys. Documented in docs/RUN-SERVER.md.
import './runtime.mjs';
import { readFileSync } from 'node:fs';
const args = process.argv.slice(2), flag = n => args.includes(n), val = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const { Authority } = await import('./authority.mjs');
const { FileAdapter, SupabaseAdapter } = await import('./storage.mjs');
let adapter;
if (flag('--file')) adapter = new FileAdapter(val('--file'));
else if (flag('--live')) {
  const env = { ...process.env };
  if (flag('--env')) for (const l of readFileSync(val('--env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Supabase credentials missing.');
  adapter = new SupabaseAdapter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.COSMOS_WORLD_ID || 'marineris');
} else throw Error('Say --file <path> or --live.');
const apply = flag('--apply'), terrain = !flag('--keep-terrain');
const world = await new Authority(adapter, { verify: null }).load();
const counts = world.resetWorld({ terrain });
console.log(JSON.stringify({ applied: apply, terrainWiped: terrain, removed: counts }, null, 1));
if (apply) {
  await adapter.wipeProjections({ terrain });
  await world.commit();
  console.log('committed revision', world.state.revision, '| players', Object.keys(world.state.players).length, '| ships kept (raiders)', Object.keys(world.state.ships).length);
} else console.log('Dry run: nothing was written. Add --apply (with the authority stopped).');
