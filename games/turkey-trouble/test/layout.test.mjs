// Layout sanity: the map the look and the game share must make sense to the rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLayout } from './sim.mjs';
import { makeWorld, arenaNav, makePath } from '../src/game/world.js';
import { FIND } from '../src/game/tuning.js';

const L = loadLayout();
const W = makeWorld(L);
const A = L.arena;
const inArena = (p, m = 0) => p.x >= A.minX + m && p.x <= A.maxX - m && p.z >= A.minZ + m && p.z <= A.maxZ - m;

test('every hide and its peek spot is inside the arena', () => {
  for (const h of L.hides) {
    assert.ok(inArena(h, 0.3), `hide ${h.id} outside the arena`);
    assert.ok(inArena(h.peek, 0.3), `peek of ${h.id} outside the arena`);
  }
});

test('every hide is clear of colliders once the game nudges it (and the raw layout is reported)', () => {
  const raw = [];
  for (const h of L.hides) {
    const b = W.blocked(h.x, h.z, FIND.hideR); if (b) raw.push(`${h.id} is inside ${b}`);
    const p = W.freeSpot(h.x, h.z, FIND.hideR);
    assert.equal(W.blocked(p.x, p.z, FIND.hideR), null, `hide ${h.id} could not be freed`);
    assert.ok(Math.hypot(p.x - h.x, p.z - h.z) < 1.6, `hide ${h.id} had to move ${Math.hypot(p.x - h.x, p.z - h.z).toFixed(2)} m`);
    assert.equal(W.blocked(h.peek.x, h.peek.z, 0.3), null, `peek spot of ${h.id} is inside a collider`);
  }
  if (raw.length) console.log('  note for the look: raw hides inside colliders: ' + raw.join('; '));
});

test('every spawn is outside every collider, and the mode 1-3 spawns are in the arena', () => {
  for (const [k, s] of Object.entries(L.spawns)) assert.equal(W.blocked(s.x, s.z, 0.3), null, `spawn ${k} inside a collider`);
  assert.ok(inArena(L.spawns.player, 0.3));
  assert.ok(inArena(L.spawns.turkeyHunted, 0.3));
  assert.ok(inArena(L.spawns.escapeStart, 0.3));
});

test('every hide can be reached on foot from the player spawn', () => {
  const nav = arenaNav(W), path = makePath(), sp = L.spawns.player;
  for (const h of L.hides) {
    assert.ok(nav.findPath(sp.x, sp.z, h.x, h.z, path), `no path to ${h.id}`);
    const end = path.pts[path.n - 1];
    assert.ok(Math.hypot(end.x - h.x, end.z - h.z) < FIND.foundDist - 0.3, `can only get ${Math.hypot(end.x - h.x, end.z - h.z).toFixed(2)} m from ${h.id}`);
  }
});

test('lanes are in order, do not overlap, and sit inside the bounds', () => {
  const lanes = L.escape.lanes, B = L.bounds;
  for (let i = 0; i < lanes.length; i++) {
    const l = lanes[i];
    assert.ok(l.z0 < l.z1, `${l.id} z0 < z1`);
    assert.ok(l.z0 >= B.minZ && l.z1 <= B.maxZ, `${l.id} inside bounds`);
    if (i) assert.ok(l.z0 >= lanes[i - 1].z1, `${l.id} starts after ${lanes[i - 1].id}`);
    for (const s of l.sublanes || []) {
      assert.ok(s.z > l.z0 && s.z < l.z1, `${l.id} sublane z ${s.z} inside the lane`);
      assert.ok(s.dir === 1 || s.dir === -1, 'dir is 1 or -1');
      assert.ok(s.gapMin > 0 && s.gapMax >= s.gapMin, 'gaps make sense');
      assert.ok(L.sizes[s.vehicle], `size for ${s.vehicle}`);
    }
  }
  const last = lanes[lanes.length - 1], fin = L.escape.finish;
  assert.ok(fin.path[0].z > last.z1, 'the finish path starts past the last road');
  assert.ok(L.escape.spawnX > L.escape.corridor.maxX, 'vehicles spawn outside the corridor');
});

test('every exit lies on a fence gap', () => {
  for (const e of L.exits) {
    // on the arena edge
    const onEdge = Math.abs(e.x - A.minX) < 0.5 || Math.abs(e.x - A.maxX) < 0.5 || Math.abs(e.z - A.minZ) < 0.5 || Math.abs(e.z - A.maxZ) < 0.5;
    assert.ok(onEdge, `exit ${e.id} is on the arena edge`);
    // and no fence passes through it
    for (const f of L.fences) {
      const dx = f.x2 - f.x1, dz = f.z2 - f.z1, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((e.x - f.x1) * dx + (e.z - f.z1) * dz) / L2));
      const d = Math.hypot(e.x - (f.x1 + dx * t), e.z - (f.z1 + dz * t));
      assert.ok(d > 0.8, `fence ${f.id} runs through exit ${e.id} (${d.toFixed(2)} m)`);
    }
  }
});

test('the ford stones are inside the creek and the corridor', () => {
  const creek = L.escape.lanes.find((l) => l.kind === 'creek');
  for (const s of creek.stones) {
    assert.ok(s.z > creek.z0 && s.z < creek.z1);
    assert.ok(s.x > L.escape.corridor.minX && s.x < L.escape.corridor.maxX);
  }
});
