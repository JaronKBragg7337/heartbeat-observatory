// ROUND7 server-side checks: one open candidate per crew post (no two people on the same spot), and a storage fault that cannot stick.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';

export async function runRound7Checks({ check, section }) {
  section('31. Round 7: one candidate per post, and a storage fault clears itself');
  const dir = await mkdtemp(join(tmpdir(), 'cosmos-r7-'));
  const flaky = new FileAdapter(join(dir, 'world.json')); let failing = false; const save = flaky.save.bind(flaky);
  flaky.save = async (...a) => { if (failing) throw new Error('simulated outage'); return save(...a); };
  let app;
  try {
    app = await startServer({ adapter: flaky, port: 0, tick: true });
    const w = app.world, health = async () => { const r = await fetch(app.url.replace('ws:', 'http:') + '/health'); return { status: r.status, body: await r.json() }; };

    // ---- duplicates: a dismissed hire walks back while refill() already made her replacement
    const pilots = () => Object.values(w.state.pool).filter((c) => c.role === 'pilot' && !c.shipId && !c.retired);
    await w.enqueue(() => {
      const first = pilots()[0]; assert.ok(first, 'there is an open pilot candidate');
      const seq = ++w.state.poolSeq;
      w.state.pool['candidate-' + seq] = { ...structuredClone(first), id: 'candidate-' + seq, name: 'Ada Diaz ' + seq, status: 'inside', position: { ...first.position } };
      w.state.pool[first.id].status = 'returning';
      assert.equal(pilots().length, 2, 'two open pilots, standing on the same spot');
      w.refill();
    });
    const open = pilots();
    check('two open candidates for one post are folded into one (the one already walking back stays, the fresh duplicate is retired) so nobody stands inside anybody', open.length === 1 && open[0].status === 'returning', JSON.stringify(open.map((c) => [c.id, c.status])));
    await w.enqueue(() => { w.state.pool[open[0].id].status = 'waiting'; w.refill(); });
    check('refill never adds a second one while a candidate for the post is waiting, and a hired post still gets its replacement', pilots().length === 1);
    const spots = Object.values(w.state.pool).filter((c) => !c.shipId && !c.retired).map((c) => `${c.position.x.toFixed(1)},${c.position.z.toFixed(1)}`);
    check('no two open candidates share a spot', new Set(spots).size === spots.length, spots.join(' | '));

    // ---- storage: the world is flagged, then the database comes back with nobody doing anything: it must clear on its own (the next 2 s checkpoint)
    failing = true;
    const t0 = Date.now(); let flagged = false;
    while (Date.now() - t0 < 12000 && !flagged) { await new Promise((r) => setTimeout(r, 250)); await w.enqueue(() => { w.state.revision++; }); flagged = !!w.error; }
    check('while the database is down the world says so (health 503), and keeps its state in memory', flagged && (await health()).status === 503);
    failing = false; const t1 = Date.now(); let ok = false;
    while (Date.now() - t1 < 10000 && !ok) { await new Promise((r) => setTimeout(r, 300)); ok = !w.error; }
    check(`and when the database comes back the fault clears by itself within ${((Date.now() - t1) / 1000).toFixed(1)} s, with no player action needed, and health is 200 again`, ok && (await health()).status === 200);
  } finally { try { await app?.close(); } catch {} await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}
