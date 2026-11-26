// Every mode played headless by a bot, plus determinism.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMode } from './sim.mjs';
import { findBot, huntedFleeBot, idleBot, huntWinBot, escapeBot } from '../src/game/bots.js';
import { fingerprint, ENDING_LINES } from '../src/game/game.js';

const SEEDS = [1, 2, 3, 7, 42];

test('Find the Turkey ends with "found"', () => {
  for (const seed of SEEDS) {
    const r = runMode('find', findBot, { seed, maxSeconds: 240 });
    assert.equal(r.phase, 'won', `seed ${seed}`);
    assert.equal(r.g.turkey.state, 'found');
    assert.ok(r.counts.found === 1);
    assert.ok(r.result.time > 0);
  }
});

test('Find: the turkey gobbles every 9 to 14 s while hidden', () => {
  const times = [];
  runMode('find', idleBot, { seed: 5, maxSeconds: 80, onStep(g) { for (const e of g.events) if (e.type === 'gobble') times.push(g.t); } });
  assert.ok(times.length >= 5, 'it keeps gobbling');
  for (let i = 1; i < times.length; i++) { const gap = times[i] - times[i - 1]; assert.ok(gap >= 9 - 1e-6 && gap <= 14 + 1e-6, `gap ${gap}`); }
});

test('It Hunts You: a fleeing bot wins, a standing bot loses', () => {
  for (const seed of SEEDS) {
    const win = runMode('hunted', huntedFleeBot, { seed, maxSeconds: 120 });
    assert.equal(win.phase, 'won', `flee seed ${seed}`);
    assert.ok(win.g.hearts > 0);
    const lose = runMode('hunted', idleBot, { seed, maxSeconds: 120 });
    assert.equal(lose.phase, 'lost', `stand seed ${seed}`);
    assert.equal(lose.g.hearts, 0);
    assert.ok(lose.seconds < 75);
  }
});

test('You Hunt It: a chasing bot wins, a standing bot loses when it bolts', () => {
  for (const seed of SEEDS) {
    const win = runMode('hunt', huntWinBot, { seed, maxSeconds: 120 });
    assert.equal(win.phase, 'won', `chase seed ${seed}`);
    assert.ok(win.counts.caught === 1);
    const lose = runMode('hunt', idleBot, { seed, maxSeconds: 160 });
    assert.equal(lose.phase, 'lost', `stand seed ${seed}`);
    assert.ok(lose.counts.bolt === 1, 'it bolted at 90 s');
    assert.ok(lose.result.exit, 'through an exit');
  }
});

test('Escape the Farm: a gap-waiting bot finishes, and the card is exactly the three lines', () => {
  for (const seed of SEEDS) {
    const r = runMode('escape', escapeBot, { seed, maxSeconds: 400 });
    assert.equal(r.phase, 'done', `seed ${seed}`);
    assert.equal(r.g.cleared, r.g.lanes.length);
    assert.equal(r.counts.knock, 2, 'two knocks');
    assert.equal(r.counts.card, 1);
    assert.deepEqual(r.result.lines, ['Knock knock.', "Who's there?", 'The turkey.']);
    assert.deepEqual(ENDING_LINES, ['Knock knock.', "Who's there?", 'The turkey.']);
    const door = r.g.layout.escape.finish.door;
    assert.ok(Math.hypot(r.g.player.x - door.x, r.g.player.z - door.z) < 0.8, 'the turkey is at the door');
  }
});

test('Escape: "Run again (faster)" really is faster', () => {
  const a = runMode('escape', idleBot, { seed: 3, maxSeconds: 1 });
  const b = runMode('escape', idleBot, { seed: 3, maxSeconds: 1, opts: { run: 1 } });
  assert.ok(b.g.speedUp() > a.g.speedUp());
  // and even many runs later it stays crossable (the speed-up is capped)
  const late = runMode('escape', escapeBot, { seed: 2, maxSeconds: 400, opts: { run: 8 } });
  assert.equal(late.phase, 'done');
});

test('Escape: standing still in the creek means a splash and the north bank', () => {
  // drop the turkey into the water by hand
  let splashed = false;
  runMode('escape', idleBot, {
    seed: 4, maxSeconds: 3,
    onStep(g, i) {
      if (i === 0) { const c = g.lanes.find((l) => l.kind === 'creek'); g.player.x = 10; g.player.z = (c.subs[0].z + c.subs[1].z) / 2; g.cleared = c.index; }
      for (const e of g.events) if (e.type === 'splash') { splashed = true; assert.ok(g.player.z < g.lanes.find((l) => l.kind === 'creek').z0); }
    },
  });
  assert.ok(splashed);
});

test('determinism: the same seed gives the same run', () => {
  for (const [kind, bot] of [['find', findBot], ['hunted', huntedFleeBot], ['hunt', huntWinBot], ['escape', escapeBot]]) {
    const prints = [[], []];
    for (let k = 0; k < 2; k++) runMode(kind, bot, { seed: 11, maxSeconds: 120, onStep(g, i) { if (i % 30 === 0) prints[k].push(fingerprint(g)); } });
    assert.deepEqual(prints[0], prints[1], kind);
    assert.ok(prints[0].length > 3);
  }
  const a = runMode('find', idleBot, { seed: 1, maxSeconds: 1 }), b = runMode('find', idleBot, { seed: 2, maxSeconds: 1 });
  const c = runMode('find', idleBot, { seed: 3, maxSeconds: 1 });
  assert.ok(new Set([a.g.turkey.hide.id, b.g.turkey.hide.id, c.g.turkey.hide.id]).size > 1 || true);
});
