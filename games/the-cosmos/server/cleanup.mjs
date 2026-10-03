// One-off / manual cleanup of throwaway players, through the authority (so its rules, the world record and the database projections agree).
//   node server/cleanup.mjs --file <world.json> [--idle-hours 24] [--apply]     a FileAdapter world (a copy, or a local test world)
//   node server/cleanup.mjs --live [--idle-hours 24] [--apply]                  the real world, credentials from the process environment
//                                                                               (or --env <file> with SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY lines)
// Without --apply it only prints what it would do. STOP the running authority first when using --live (one process per world);
// the watchdog starts it again afterwards. Never prints keys.
import './runtime.mjs';
import { readFileSync } from 'node:fs';
const args = process.argv.slice(2), flag = (n) => args.includes(n), val = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
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
const apply = flag('--apply'), idleMs = Number(val('--idle-hours', '24')) * 3600 * 1000;
// load() already runs the ordinary 24 h sweep; keep that out of this report by reading what it did separately.
const world = await new Authority(adapter, { verify: null }).load();
const before = Object.keys(world.state.players).length;
const plan = world.sweep({ idleMs, dryRun: !apply });
console.log(JSON.stringify({ players: before, idleHours: idleMs / 3600000, applied: apply, loadSweep: world.lastSweep, removed: plan.removed, parked: plan.parked, kept: plan.kept }, null, 1));
if (apply) { await world.commit(); console.log('committed revision', world.state.revision, 'players now', Object.keys(world.state.players).length, 'pads in use', world.state.pads.filter((p) => p.shipId).length); }
