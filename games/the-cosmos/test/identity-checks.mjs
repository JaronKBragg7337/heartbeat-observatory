// Identity: guests, accounts, saved characters, start fresh, and the cleanup of throwaway players. Protocol level, isolated FileAdapter worlds.
import '../server/runtime.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { tokenVerifier, GUEST_IDLE_MS, EPHEMERAL_IDLE_MS } from '../server/identity.mjs';
import { TestClient } from './multiplayer-checks.mjs';

const JARON = { userId: '11111111-1111-4111-8111-111111111111', email: 'jaron@example.test', admin: true };
const LILITH = { userId: '22222222-2222-4222-8222-222222222222', email: 'lilith@example.test', admin: false };
const TOKENS = { 'token-jaron-admin-aaaaaaaaaaaaaa': JARON, 'token-lilith-user-bbbbbbbbbbbbbb': LILITH };
const verify = async (t) => TOKENS[t] || null;
const key = (c) => c.repeat(48);

export async function runIdentityChecks({ check, section }) {
  section('18b. Identity: accounts, saved characters, start fresh, cleanup');
  const dir = await mkdtemp(join(tmpdir(), 'cosmos-identity-'));
  let clock = Date.parse('2026-10-02T12:00:00Z'), app, open = [];
  const connect = async (k, name, extra = {}) => { const c = new TestClient(app.url, key(k), name, 0, extra); open.push(c); await c.connect(); return c; };
  const closeAll = async () => { for (const c of open) c.close(); open = []; await new Promise((r) => setTimeout(r, 40)); await app.world.enqueue(() => {}); };
  try {
    const adapter = new FileAdapter(join(dir, 'world.json'));
    app = await startServer({ adapter, port: 0, tick: false, now: () => clock, verify });
    const w = app.world, S = () => w.state;

    // --- a guest is their device ---------------------------------------------------------------------------------------------------
    let g1 = await connect('a', 'Visitor 101');
    const guestId = g1.id, guestShip = S().players[guestId].shipId;
    check('a guest welcome says guest', g1.messages.find((m) => m.type === 'welcome').identity.guest === true);
    await closeAll(); g1 = await connect('a', 'Visitor 101');
    check('the same device key is the same guest player and ship', g1.id === guestId && S().players[guestId].shipId === guestShip && Object.keys(S().players).length === 1);
    S().ships[guestShip].economy.marks = 12345; S().ships[guestShip].hold.ore = 40;

    // --- sign in: the guest ship on this device moves onto the account ----------------------------------------------------------------------
    await closeAll();
    let j1 = await connect('a', 'Jaron', { token: 'token-jaron-admin-aaaaaaaaaaaaaa' });
    const welcome = j1.messages.find((m) => m.type === 'welcome');
    check('first sign-in adopts the guest player on that device (same ship, same money)', j1.id === guestId && S().players[guestId].userId === JARON.userId && S().ships[guestShip].economy.marks === 12345);
    check('the welcome says signed in, admin, adopted', welcome.identity.signedIn && welcome.identity.admin && welcome.identity.note === 'adopted' && welcome.identity.slots.length === 1);
    check('the account record holds main -> player', S().users[JARON.userId].slots.main.playerId === guestId);
    const jPad = S().ships[guestShip].pad.number;

    // --- the same account from another device and a "private tab" --------------------------------------------------------------------------
    await closeAll();
    const phone = await connect('p', 'Phone', { token: 'token-jaron-admin-aaaaaaaaaaaaaa' });
    check('another device with the same login gets the same player, ship, pad and money', phone.id === guestId && S().players[phone.id].shipId === guestShip && S().ships[guestShip].pad.number === jPad && Object.keys(S().players).length === 1);
    const ownState = phone.messages.find((m) => m.type === 'welcome').state;
    check('own marks arrive on the other device', ownState.ships[guestShip].economy.marks === 12345);
    await closeAll();
    check('a device key that never saw the account adds no extra player', Object.keys(S().players).length === 1);

    // --- never trust an id the browser sends -----------------------------------------------------------------------------------------------
    await closeAll();
    const forged = await connect('f', 'Forger', { token: 'token-not-real-zzzzzzzzzzzzzzzz', userId: JARON.userId, slot: 'main' });
    const fw = forged.messages.find((m) => m.type === 'welcome');
    check('a bad token or a claimed userId gives a plain guest, never the account', fw.identity.guest && forged.id !== guestId && !S().players[forged.id].userId);
    const guestOfF = forged.id;

    // --- the account already has a ship: a guest ship on a new device stays a guest ---------------------------------------------------------------
    await closeAll();
    const gOnNew = await connect('n', 'Visitor 202');          // a guest on yet another device
    const gNewId = gOnNew.id; S().ships[S().players[gNewId].shipId].economy.marks = 777;
    await closeAll();
    const l1 = await connect('n', 'Lilith', { token: 'token-lilith-user-bbbbbbbbbbbbbb' });   // Lilith signs in first time on a device with a guest ship
    check('first sign-in on a guest device adopts it', l1.id === gNewId && S().players[gNewId].userId === LILITH.userId);
    await closeAll();
    const gOld = await connect('o', 'Visitor 303'); const gOldId = gOld.id; await closeAll();
    const l2 = await connect('o', 'Lilith', { token: 'token-lilith-user-bbbbbbbbbbbbbb' });
    const lw = l2.messages.find((m) => m.type === 'welcome');
    check('an account that already has a ship keeps it; the other guest ship is left alone and told', l2.id === gNewId && lw.identity.note === 'kept-account' && S().players[gOldId] && !S().players[gOldId].userId);
    await closeAll();

    // --- saved characters are for site admins only ---------------------------------------------------------------------------------------------
    const j2 = await connect('a', 'Jaron', { token: 'token-jaron-admin-aaaaaaaaaaaaaa', slot: 't1' });
    const testPlayer = S().players[j2.id];
    check('an admin can start another saved character (new player, new ship, new pad)', j2.id !== guestId && testPlayer.userId === JARON.userId && testPlayer.slot === 't1' && S().ships[testPlayer.shipId].pad.number !== jPad);
    check('the admin welcome lists both characters', j2.messages.find((m) => m.type === 'welcome').identity.slots.length === 2);
    check('the main character is untouched', S().ships[guestShip].economy.marks === 12345);
    await closeAll();
    const j3 = await connect('a', 'Jaron', { token: 'token-jaron-admin-aaaaaaaaaaaaaa' });
    check('with no slot chosen the admin returns to main', j3.id === guestId);
    await closeAll();
    const l3 = await connect('o', 'Lilith', { token: 'token-lilith-user-bbbbbbbbbbbbbb', slot: 't9' });
    check('a non-admin who asks for another slot still gets the single character', l3.id === gNewId && Object.keys(S().users[LILITH.userId].slots).length === 1);
    await closeAll();

    // --- public state never carries accounts ------------------------------------------------------------------------------------------------------
    const pub = JSON.stringify(w.publicState(guestId));
    check('public snapshots omit account ids, slots and the account table', !pub.includes(JARON.userId) && !pub.includes('"users"') && !pub.includes('"slot"'));

    // --- start fresh: the character leaves, the pad is reused -------------------------------------------------------------------------------------------
    const padsBefore = S().pads.length, ship = S().ships[S().players[gOldId].shipId], oldPadNo = ship.pad.number;
    S().pool['candidate-1'].shipId = ship.id; ship.crew.push({ id: 'candidate-1', role: S().pool['candidate-1'].role, status: 'aboard' });
    const fresh = await connect('o', 'Visitor 303');
    check('the guest on key o is the old guest player', fresh.id === gOldId);
    fresh.send({ type: 'identity', op: 'discard' });
    const done = await fresh.wait((m) => m.type === 'identity-done');
    check('discard removes the player, their ship and rover, and releases hired crew', done.ok && !S().players[gOldId] && !S().ships[ship.id] && !Object.values(S().vehicles).some((v) => v.owner === gOldId) && S().pool['candidate-1'].shipId === null);
    check('their pad is free (not deleted) so no later pad is renumbered', S().pads.length === padsBefore && S().pads.find((p) => p.number === oldPadNo).shipId === null);
    await closeAll();
    const again = await connect('o', 'Visitor 303');
    check('starting again makes a new player on the freed pad', again.id !== gOldId && S().ships[S().players[again.id].shipId].pad.number === oldPadNo && S().pads.length === padsBefore);
    const padNumbers = Object.values(S().ships).filter((s) => !s.npc).map((s) => s.pad?.number);
    check('no two ships share a pad', new Set(padNumbers).size === padNumbers.length);
    check('every ship has its own Phobos and Deimos pad slot', (() => { const ids = Object.values(S().ships).filter((s) => !s.npc).flatMap((s) => ['phobos', 'deimos'].map((b) => s.moonPads?.[b]?.id)); return new Set(ids).size === ids.length; })());
    await closeAll();
    // a ship with a player aboard cannot be deleted from under them
    const guestA = await connect('a', 'Jaron', { token: 'token-jaron-admin-aaaaaaaaaaaaaa' });
    const hostId = guestA.id; S().players[forged.id].aboardShipId = S().players[hostId].shipId; S().players[forged.id].currentShipId = S().players[hostId].shipId;
    check('a ship someone else is aboard is never deleted', w.removePlayer(hostId) === false && S().players[hostId]);
    S().players[forged.id].aboardShipId = null; S().players[forged.id].currentShipId = S().players[forged.id].shipId;
    await closeAll();

    // --- test clients flag themselves and do not stay ----------------------------------------------------------------------------------------------
    const t1 = await connect('t', 'Visitor 404', { test: true }); const tid = t1.id;
    check('a client that flags itself as a test is marked ephemeral', S().players[tid].ephemeral === true);
    await closeAll();
    let r = await w.enqueue(() => w.sweep());
    check('a test client is kept for a short while after it disconnects (a reload must not lose it)', !!S().players[tid] && !r.removed.length);
    clock += EPHEMERAL_IDLE_MS + 1000; r = await w.enqueue(() => w.sweep());
    check('then it is removed with its ship and pad', !S().players[tid] && r.removed.some((x) => x.why === 'test client'));
    const padsNow = S().pads.filter((p) => p.shipId).length, shipsNow = Object.values(S().ships).filter((s) => !s.npc).length;
    check('pads in use match ships that exist', padsNow === shipsNow, padsNow + ' vs ' + shipsNow);

    // --- guests idle a day ----------------------------------------------------------------------------------------------------------------------------
    const throwaway = await connect('x', 'Visitor 505'), idleProg = await connect('y', 'Visitor 606'), human = await connect('z', 'Visitor 707');
    const xid = throwaway.id, yid = idleProg.id, zid = human.id;
    S().ships[S().players[yid].shipId].economy.marks = 9000;              // spent some: progress
    S().players[zid].personId = 'aoi'; S().players[zid].name = 'Acid_Ith';  // a person chose these
    await closeAll();
    clock += GUEST_IDLE_MS - 60 * 1000; r = await w.enqueue(() => w.sweep());
    check('a guest idle less than a day is left alone', !!S().players[xid] && !!S().players[yid] && !!S().players[zid] && !S().ships[S().players[yid].shipId].parked);
    clock += 120 * 1000; r = await w.enqueue(() => w.sweep());
    check('a plainly throwaway guest idle a day is deleted', !S().players[xid] && r.removed.some((q) => q.id === xid.slice(0, 8)));
    check('a guest with progress is parked, not deleted', !!S().players[yid] && S().ships[S().players[yid].shipId].parked === true && S().ships[S().players[yid].shipId].pad === null && !w.sims.has(S().players[yid].shipId));
    check('a guest a person made (look or typed name) is kept when unsure', !!S().players[zid] && !S().ships[S().players[zid].shipId].parked && r.kept.some((q) => q.id === zid.slice(0, 8)));
    check('the account players are never swept', !!S().players[guestId] && S().players[guestId].userId === JARON.userId && !!S().players[gNewId]);
    check('a parked ship is not in anyone\'s snapshot and its pad is free', !w.publicState(guestId).ships[S().players[yid].shipId] && S().pads.every((p) => p.shipId !== S().players[yid].shipId));
    // the parked player returns
    const back = await connect('y', 'Visitor 606');
    const ys = S().ships[S().players[yid].shipId];
    check('the parked guest returns on a pad with everything they had', back.id === yid && !ys.parked && !!ys.pad && ys.economy.marks === 9000 && w.sims.has(ys.id) && back.messages.find((m) => m.type === 'welcome').state.ships[ys.id].pad.number === ys.pad.number);
    check('after that no two ships share a pad', (() => { const n = Object.values(S().ships).filter((s) => !s.npc).map((s) => s.pad?.number); return new Set(n).size === n.length; })());
    await closeAll();

    // --- everything survives a restart ----------------------------------------------------------------------------------------------------------------
    await app.close();
    app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: false, now: () => clock, verify });
    const w2 = app.world;
    check('accounts, slots and characters survive a restart', w2.state.users[JARON.userId].slots.main.playerId === guestId && w2.state.users[JARON.userId].slots.t1 && w2.state.players[guestId].userId === JARON.userId);
    const jAgain = await connect('a', 'Jaron', { token: 'token-jaron-admin-aaaaaaaaaaaaaa' });
    check('and the account resumes the same player after the restart', jAgain.id === guestId);
    await closeAll();
  } finally {
    for (const c of open) c.close();
    await app?.close().catch(() => {}); await rm(dir, { recursive: true, force: true });
  }

  // --- the token check itself -----------------------------------------------------------------------------------------------------------------------
  const calls = []; let now = 1000;
  const fetchFn = async (url, init) => { calls.push(url); const auth = init.headers.Authorization;
    if (url.endsWith('/auth/v1/user')) return auth === 'Bearer good-token-0123456789abcdef' ? { ok: true, json: async () => ({ id: JARON.userId, email: 'j@x.test' }) } : { ok: false, json: async () => ({}) };
    if (url.endsWith('/rest/v1/rpc/is_admin')) return { ok: true, json: async () => true };
    return { ok: false, json: async () => ({}) }; };
  const v = tokenVerifier({ url: 'https://example.supabase.co/', key: 'service', fetchFn, now: () => now });
  const ok = await v('good-token-0123456789abcdef');
  check('a token is checked with Supabase Auth and the site is_admin() rule', ok?.userId === JARON.userId && ok.admin === true && calls.some((c) => c.endsWith('/auth/v1/user')) && calls.some((c) => c.endsWith('/rest/v1/rpc/is_admin')));
  const n0 = calls.length; await v('good-token-0123456789abcdef');
  check('the answer is cached for a few minutes', calls.length === n0);
  check('a rejected token and a malformed one are guests', (await v('bad-token-0123456789abcdefgh')) === null && (await v('x')) === null && (await v(123)) === null);
  check('without Supabase credentials there is no verifier (local tests are guests)', tokenVerifier({ url: '', key: '' }) === null);
}
