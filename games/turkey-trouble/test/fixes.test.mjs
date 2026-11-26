// The playtest fixes: a fair start in each mode, a fair highway, and an ending that follows any finish path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMode, loadLayout } from './sim.mjs';
import { escapeBot, idleBot, findBot, huntedFleeBot } from '../src/game/bots.js';
import { createGame } from '../src/game/game.js';
import { worldFor } from '../src/game/world.js';
import { TURKEY_PLAYER as TP } from '../src/game/tuning.js';

test('Escape opens with the camera out from under the barn roof', () => {
  const L = loadLayout(), g = createGame('escape', L, { seed: 1 }), w = worldFor(L);
  const P = g.player, back = 8.8 * Math.cos(0.66);
  assert.ok(w.raycastRoofs(P.x, P.z, P.x, P.z - back) > 0.7, `camera ray hits a roof at ${w.raycastRoofs(P.x, P.z, P.x, P.z - back).toFixed(2)}`);
  assert.ok(!w.blocked(P.x, P.z, TP.r));
  assert.ok(P.z < 0, 'still in the yard');
});

test('Story: It Hunts You starts with the turkey at least 8 m away, and it can still be survived', () => {
  for (const seed of [1, 2, 3, 7, 42]) {
    const f = runMode('find', findBot, { seed, maxSeconds: 240 });
    assert.equal(f.phase, 'won');
    const carry = f.g.carryOut();
    const g = createGame('hunted', loadLayout(), { seed, carry });
    const d = Math.hypot(g.turkey.x - g.player.x, g.turkey.z - g.player.z);
    assert.ok(d >= 7.9, `seed ${seed}: turkey ${d.toFixed(1)} m away`);
    const win = runMode('hunted', huntedFleeBot, { seed, maxSeconds: 120, opts: { carry } });
    assert.equal(win.phase, 'won', `flee seed ${seed}`);
  }
});

test('the highway has a median between every pair of rows', () => {
  const g = createGame('escape', loadLayout(), { seed: 1 });
  const hw = g.lanes.find((l) => l.id === 'highway');
  const subs = hw.subs.slice().sort((a, b) => a.z - b.z);
  for (let i = 1; i < subs.length; i++) {
    const gap = (subs[i].z - subs[i].w / 2) - (subs[i - 1].z + subs[i - 1].w / 2);
    assert.ok(gap >= 2 * TP.r + 0.6, `median ${i}: ${gap.toFixed(2)} m`);
  }
  for (const s of subs) { assert.ok(s.z - s.w / 2 >= hw.z0 - 0.01 && s.z + s.w / 2 <= hw.z1 + 0.01, 'rows stay on the road'); }
});

test('the ending walks a finish path of any length, off the middle, through a gap in a windbreak', () => {
  const L = loadLayout();
  const last = L.escape.lanes[L.escape.lanes.length - 1];
  const zr = last.z1 + 4;                    // a row of trees south of the last road with a gap at x = -9
  L.colliders = L.colliders.filter((c) => !/^(windbreak|spruce)/.test(c.id || ''));   // our own trees, not the look's
  L.colliders.push({ id: 'windbreak_w', type: 'box', x: -24, z: zr, w: 26, d: 1.6, rotY: 0, h: 8 });
  L.colliders.push({ id: 'windbreak_e', type: 'box', x: 8, z: zr, w: 30, d: 1.6, rotY: 0, h: 8 });
  const door = L.escape.finish.door;
  L.escape.finish.path = [{ x: -9, z: last.z1 + 1 }, { x: -9, z: zr + 4 }, { x: door.x, z: door.z }];
  for (const seed of [1, 2, 3]) {
    let throughTree = 0;
    const w = worldFor(L);
    const r = runMode('escape', escapeBot, {
      seed, layout: L, maxSeconds: 400,
      onStep(g) { if (g.phase === 'ending' && w.blocked(g.player.x, g.player.z, 0.2)) throughTree++; },
    });
    assert.equal(r.phase, 'done', `seed ${seed}`);
    assert.equal(r.counts.knock, 2);
    assert.deepEqual(r.result.lines, ['Knock knock.', "Who's there?", 'The turkey.']);
    assert.ok(Math.hypot(r.g.player.x - door.x, r.g.player.z - door.z) < 0.8, 'at the door');
    assert.equal(throughTree, 0, 'never walks through the trees');
  }
  // one point only (just the door) still works
  const L1 = loadLayout(); L1.escape.finish.path = [{ x: L1.escape.finish.door.x, z: L1.escape.finish.door.z }];
  const r1 = runMode('escape', escapeBot, { seed: 5, layout: L1, maxSeconds: 400 });
  assert.equal(r1.phase, 'done');
});

test('Run again: says top speed once it cannot get faster', () => {
  let prev = 0, sawTop = false;
  for (let run = 0; run < 10; run++) {
    const g = createGame('escape', loadLayout(), { seed: 1, run });
    if (!g.topSpeed) assert.ok(createGame('escape', loadLayout(), { seed: 1, run: run + 1 }).speedUp() > g.speedUp() + 1e-9, `run ${run} -> faster`);
    else sawTop = true;
    assert.ok(g.speedUp() >= prev); prev = g.speedUp();
  }
  assert.ok(sawTop);
  void idleBot;
});

test('the real layout: the ending walk never goes inside a collider, and the turkey reaches the door', () => {
  const L = loadLayout(), w = worldFor(L), door = L.escape.finish.door;
  for (const seed of [1, 2, 3, 7, 42]) {
    let inside = 0, where = null;
    const r = runMode('escape', escapeBot, {
      seed, layout: L, maxSeconds: 400,
      onStep(g) {
        const P = g.player;
        if (g.phase !== 'ending' || Math.hypot(P.x - door.x, P.z - door.z) < 1.2) return;   // the doorstep backs off on its own
        if (w.blocked(P.x, P.z, 0.22)) { inside++; where = where || [P.x.toFixed(2), P.z.toFixed(2), g.ending.path.i]; }
      },
    });
    assert.equal(r.phase, 'done', `seed ${seed}`);
    assert.equal(inside, 0, `seed ${seed}: inside a collider at ${where}`);
    assert.ok(Math.hypot(r.g.player.x - door.x, r.g.player.z - door.z) < 0.8);
  }
});
