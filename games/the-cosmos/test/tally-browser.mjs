// A tally run on a phone (part 4, "give the yards a reason"): an iPhone-profile WebKit page at 375 px, in a shared world on Earth, asks the range dispatcher for
// work with real taps, takes "Count the canisters", stands at Skyward's rack, reads the count off the yard THE PAGE DREW, sets it on the count card with real taps
// and signs it: the server (which never saw the page's yard) pays. Then the Homeguard's blocks: a wrong count first ("look again"), then the right one.
// Also: the count the page draws and the count the yard book gives agree at several moments of the timetable.
// Pictures go to $TALLY_SHOTS (default: a temp folder).
//   node test/tally-browser.mjs
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../server/index.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
import { resolve as place } from '../src/missions/where.js';
import { outpostToFrame } from '../src/worlds/moon/place.js';
import { makeMoon } from '../src/space/moonField.js';
import { missionById } from '../src/missions/catalog.js';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright'); }
const out = process.env.TALLY_SHOTS || join(tmpdir(), 'cosmos-tally'); await mkdir(out, { recursive: true });
const WEBKIT = process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe');
const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const errors = []; let app, webkit, bad = 0;
const ok = (name, pass, detail = '') => { if (!pass) bad++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + detail)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  app = await startServer({ adapter: new MemoryAdapter(), port: 0, tick: true });
  const W = app.world;
  const url = app.url.replace('ws:', 'http:') + '/?ws=' + app.url + '&dev=1&opening=off&tier=low';
  webkit = await pw.webkit.launch({ headless: true, executablePath: WEBKIT });
  const ctx = await webkit.newContext(IPHONE), page = await ctx.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 300)); });
  await page.goto(url); await page.waitForFunction(() => window.cosmos?.world?.snapshot && cosmos.engine.frameCount >= 5, null, { timeout: 240000 });
  const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
  const pid = await page.evaluate(() => cosmos.world.playerId), P = () => W.state.players[pid], mine = () => W.state.missions[pid] || { done: {}, active: null, log: [] };
  const credits = () => W.state.ships[P().shipId].economy.marks / 4;

  // ---- to Earth: the server puts the ship on the pad and the pilot on foot beside the dispatcher; the page follows the frame
  const pi = makeMoon('earth').padInfo, sim = W.sims.get(P().shipId);
  const first = outpostToFrame(pi, -9 + 1.5, 0.6, -64 - 0.4);
  W.enqueue(async () => { sim.placeOnWorld('earth'); const q = P(); q.aboardShipId = null; q.pose.aboard = false; q.pose.seat = null; q.frameId = 'earth'; q.pose.worldPos = first; q.pose.velocity = { x: 0, y: 0, z: 0 }; await W.commit(); }); await W.queue;
  await page.evaluate(() => { cosmos.multiplayer.forcePlayer = true; });
  try { await page.waitForFunction(() => cosmos.space.frameId === 'earth', null, { timeout: 120000 }); } catch { console.log('FRAME', await page.evaluate(() => cosmos.space.frameId)); }
  await page.waitForFunction(() => { const w = cosmos.space.worlds.get('earth'); return w && w.client && w.client.yard; }, null, { timeout: 180000 });
  const YARD = `cosmos.space.worlds.get('earth').client.yard`;
  /** Stand the player at an outpost spot (x east, z south), on the real ground there: the page first, then the server, until both hold. */
  const goTo = async (x, z) => {
    const gy = await page.evaluate(`${YARD}.groundY(${x}, ${z})`), pos = outpostToFrame(pi, x, gy + 0.08, z);
    const put = async () => {
      await page.evaluate((q) => { const w = cosmos.walker; Object.assign(w.worldPos, q); Object.assign(w.velocity, { x: 0, y: 0, z: 0 }); w.grounded = true; w.updateFrame(); cosmos.multiplayer.forcePlayer = true; }, pos);
      W.enqueue(async () => { const q = P(); q.aboardShipId = null; q.pose.aboard = false; q.pose.seat = null; q.frameId = 'earth'; q.pose.worldPos = pos; q.pose.velocity = { x: 0, y: 0, z: 0 }; await W.commit(); });
      await W.queue; await page.evaluate(() => { cosmos.multiplayer.forcePlayer = true; }); await sleep(1800);
    };
    const off = async () => { const c = await page.evaluate((q) => { const w = cosmos.walker.worldPos; return Math.hypot(w.x - q.x, w.y - q.y, w.z - q.z); }, pos), q = P().pose.worldPos; return Math.max(c, Math.hypot(q.x - pos.x, q.y - pos.y, q.z - pos.z)); };
    for (let i = 0; i < 10; i++) { await put(); if (await off() < 2.5) { await sleep(1200); if (await off() < 2.5) break; } }
  };
  const talkTo = async (needle) => {
    try { await page.waitForFunction((n) => { const b = document.querySelector('#crew-talk'); return b && b.style.display !== 'none' && b.innerText.includes(n); }, needle, { timeout: 40000 }); }
    catch (e) { console.log('TALK', await page.evaluate(() => { const b = document.querySelector('#crew-talk'); return [b && b.style.display, b && b.innerText, cosmos.space.frameId].join(' | '); })); await shot('talk-fail'); throw e; }
    await page.locator('#crew-talk').tap(); await page.waitForSelector('#crew-panel', { state: 'visible' }); await sleep(400);
  };
  const panelText = () => page.evaluate(() => document.querySelector('#crew-panel').innerText);
  const tapBtn = async (sel) => { const b = page.locator('#crew-panel ' + sel).first(); await b.scrollIntoViewIfNeeded(); await b.tap(); await sleep(900); };
  const closePanel = async () => { await page.evaluate(() => { const c = document.querySelector('#crew-panel [data-a="close"]'); if (c) c.click(); }); await sleep(1200); };
  const card = () => page.evaluate(() => { const c = document.querySelector('#tally-card'); if (!c || getComputedStyle(c).display === 'none') return null; const r = c.getBoundingClientRect();
    return { text: c.innerText, num: c.querySelector('.num').innerText, msg: c.querySelector('.msg').innerText, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), vw: innerWidth, vh: innerHeight,
      hudBottom: Math.round(document.getElementById('hud').getBoundingClientRect().bottom),
      buttons: [...c.querySelectorAll('button')].map((b) => { const q = b.getBoundingClientRect(); return { t: b.innerText.slice(0, 20), w: Math.round(q.width), h: Math.round(q.height), l: Math.round(q.left), r: Math.round(q.right) }; }) }; });
  const setCard = async (n) => {       // real taps on minus and plus until the card reads n
    for (let i = 0; i < 40; i++) {
      const cur = await page.evaluate(() => cosmos.tallyUI.status().n); if (cur === n) return true;
      await page.locator(`#tally-card [data-a="${cur < n ? 'more' : 'less'}"]`).tap(); await sleep(160);
    }
    return false;
  };
  const drawn = (i) => page.evaluate(`(() => { for (let k = 0; k < 3; k++) cosmos.step(1 / 30); return ${YARD}.status().stocks[${i}]; })()`);

  // ---- the board
  await goTo(-9 + 1.5, -64 - 0.4);
  await talkTo('Marisol');
  ok('the range dispatcher has work', /paid work/i.test(await panelText()), (await panelText()).slice(0, 200));
  await tapBtn('[data-a="mission-ask"]');
  const t1 = await panelText(); await shot('01-board');
  ok('her first line names both yards, and the board lists a tally for each with its pay', /Payload Stand 2/.test(t1) && /Sea Wall Depot 1/.test(t1) && /Count the canisters · 70 credits/.test(t1) && /Count the wall blocks · 70 credits/.test(t1), t1.slice(0, 500));
  await tapBtn('[data-m="earth-fr-tally-skyward"]');
  ok('tapping "Count the canisters" takes the job', mine().active?.id === 'earth-fr-tally-skyward', JSON.stringify(mine().active));
  await closePanel(); await shot('02-taken');
  const hint = await page.evaluate(() => document.getElementById('hud').innerText);
  ok('the status card says where to walk and what to do there', /Payload Stand 2/.test(hint) && /sign the tally/i.test(hint), hint.slice(0, 300));
  const fold = await page.evaluate(() => { const e = document.querySelector('#hud .next-goal'), m = document.querySelector('#hud .next-more'), lh = parseFloat(getComputedStyle(e).lineHeight); return { lines: Math.round(e.clientHeight / lh), more: m ? m.innerText : '', h: Math.round(document.getElementById('hud').getBoundingClientRect().height) }; });
  ok('the step is folded to three lines with "Tap to read all of it" under it', fold.lines === 3 && /read all of it/i.test(fold.more), JSON.stringify(fold));
  await page.locator('#hud .next-more').tap(); await sleep(500);
  const open = await page.evaluate(() => { const e = document.querySelector('#hud .next-goal'), m = document.querySelector('#hud .next-more'), lh = parseFloat(getComputedStyle(e).lineHeight); return { lines: Math.round(e.clientHeight / lh), more: m ? m.innerText : '' }; });
  ok('a tap unfolds it (all the lines, "Tap to fold it"), and a second tap folds it again', open.lines > 3 && /fold it/i.test(open.more), JSON.stringify(open));
  await page.locator('#hud .next-goal').tap(); await sleep(500);
  ok('folded again', await page.evaluate(() => { const e = document.querySelector('#hud .next-goal'); return Math.round(e.clientHeight / parseFloat(getComputedStyle(e).lineHeight)) === 3; }));
  ok('no count card while the player is still at the desk', (await card()) === null);

  // ---- Skyward's rack: count what the page drew, set it with taps, sign
  const T = missionById('earth-fr-tally-skyward').steps[0];
  await goTo(T.to.at[0] + 5, T.to.at[1] + 7); await sleep(1500);
  let c = await card(); await shot('03-card');
  ok('standing at the rack, the count card is up: what to count, a minus, a plus, "Sign the tally", and where the ship is', !!c && /TALLY · Payload Stand 2/.test(c.text) && /How many payload canisters/.test(c.text) && /Sign the tally/.test(c.text) && /Upbound Two/.test(c.text) && c.buttons.length === 3, JSON.stringify(c).slice(0, 400));
  ok('while the card is up the NEXT text steps aside (the card says what to do, the screen is for counting)', await page.evaluate(() => !document.querySelector('#hud .next-goal')) && !!c && c.b < c.vh * 0.6, JSON.stringify(c && [c.t, c.b, c.vh]));
  ok('the card fits the phone: inside the screen, under the status card, every button 44 px or more', !!c && c.l >= 0 && c.r <= c.vw && c.t >= c.hudBottom && c.b <= c.vh && c.buttons.every((b) => b.h >= 44 && b.w >= 44 && b.l >= 0 && b.r <= c.vw), JSON.stringify(c).slice(0, 500));
  ok('no sideways scroll with the card up', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  ok('the sheet starts empty', c && /^0 canisters$/.test(c.num.trim()), c && c.num);
  const seen = await drawn(0), c0 = credits();
  ok(`the page drew ${seen} canisters in the rack (between 1 and 8: a weak home stacks low)`, Number.isInteger(seen) && seen >= 1 && seen <= 8, String(seen));
  ok('minus and plus set the number by taps', await setCard(seen) && new RegExp(`^${seen} canisters?$`).test((await card()).num.trim()), JSON.stringify(await card()).slice(0, 200));
  await shot('04-set');
  await page.locator('#tally-card [data-a="sign"]').tap(); await sleep(2500); await shot('05-signed');
  const beat = mine().log.filter((l) => l.kind === 'beat').at(-1)?.text || '';
  ok('signing what the page drew is taken by the server: 70 credits, the job done, the hand says the number', !mine().active && credits() === c0 + 70 && mine().freight?.runs === 1 && /Stand marshal: \d canisters? in the rack/.test(beat), `${credits() - c0} ${JSON.stringify(mine().freight)} ${beat}`);
  ok('the card goes away with the job', (await card()) === null);
  await sleep(1500);
  const after = await page.evaluate(() => document.querySelector('#hud .next-goal')?.textContent || '');
  ok('the status card says the run was paid and points back at the board', /Paid 70 credits: Count the canisters/.test(after) && /Marisol Quintero/.test(after) && /freight board/.test(after), after.slice(0, 300));

  // ---- Keep walking: after two seconds of the stick in its run zone a button appears; tap it and the walker runs on with no thumb on the stick
  const kw = () => page.evaluate(() => cosmos.keepWalking.status());
  const wpos = () => page.evaluate(() => ({ ...cosmos.walker.worldPos }));
  ok('no Keep walking button while standing still', (await kw()).shown === false);
  await page.evaluate(() => { const t = cosmos.keepWalking.touch; t.active = true; t.moveEast = 0; t.moveNorth = 1; t.run = true; });       // a thumb holding the stick hard forward
  await sleep(2600);
  const k1 = await kw(), box = await page.evaluate(() => { const r = document.getElementById('btn-keepwalk').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom), vw: innerWidth, vh: innerHeight }; });
  await shot('05b-keep-walking');
  ok('after two seconds of running the button is there: "Keep walking", thumb-sized, on the left, inside the screen', k1.shown && k1.label === 'Keep walking' && !k1.on && box.h >= 44 && box.w >= 88 && box.l >= 0 && box.r <= box.vw / 2 + 20 && box.b <= box.vh, JSON.stringify([k1, box]));
  await page.locator('#btn-keepwalk').tap(); await sleep(300);
  await page.evaluate(() => { const t = cosmos.keepWalking.touch; t.active = false; t.moveEast = 0; t.moveNorth = 0; t.run = false; });       // the thumb lets go
  const p0 = await wpos(); await sleep(3000); const p1 = await wpos(), k2 = await kw(), run1 = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
  ok(`tapped: it reads "Stop", and the walker runs on by itself (${run1.toFixed(1)} m in 3 s with no thumb on the stick)`, k2.on && k2.label === 'Stop' && run1 > 6, JSON.stringify([k2, run1]));
  await page.locator('#btn-keepwalk').tap(); await sleep(600);
  const p2 = await wpos(); await sleep(1500); const p3 = await wpos(), k3 = await kw(), run2 = Math.hypot(p3.x - p2.x, p3.y - p2.y, p3.z - p2.z);
  ok(`tapped again: it stops (${run2.toFixed(2)} m in the next second and a half)`, !k3.on && run2 < 1.2, JSON.stringify([k3, run2]));
  await page.evaluate(() => { const t = cosmos.keepWalking.touch; t.active = true; t.moveNorth = 1; t.run = true; }); await sleep(2400);
  await page.locator('#btn-keepwalk').tap(); await sleep(200);
  await page.evaluate(() => { const t = cosmos.keepWalking.touch; t.active = false; t.moveNorth = 0; t.run = false; }); await sleep(700);
  const k4 = await kw();
  await page.evaluate(() => { const t = cosmos.keepWalking.touch; t.active = true; t.moveNorth = -1; }); await sleep(500);       // the thumb comes back to the stick
  const k5 = await kw();
  await page.evaluate(() => { const t = cosmos.keepWalking.touch; t.active = false; t.moveNorth = 0; t.run = false; }); await sleep(300);
  ok('a thumb back on the stick takes the walker back at once', k4.on === true && k5.on === false, JSON.stringify([k4, k5]));

  // ---- the Homeguard's blocks: a wrong count is not paid; the right one is
  await goTo(-9 + 1.5, -64 - 0.4);
  await talkTo('Marisol'); await tapBtn('[data-a="mission-ask"]');
  const t2 = await panelText();
  ok('back at the desk the board is there again and the ticket counts one run', /Count the canisters · 70 credits/.test(t2) && /1 run\b/.test(t2), t2.slice(0, 400));
  await tapBtn('[data-m="earth-fr-tally-homeguard"]'); await closePanel();
  const T2 = missionById('earth-fr-tally-homeguard').steps[0];
  await goTo(T2.to.at[0] - 5, T2.to.at[1] + 7); await sleep(1500);
  const blocks = await drawn(1), wrong = blocks >= 6 ? blocks - 5 : blocks + 5, c1 = credits();
  c = await card();
  ok('at the depot the card asks about wall blocks', !!c && /TALLY · Sea Wall Depot 1/.test(c.text) && /How many wall blocks/.test(c.text) && /Tide Table/.test(c.text), JSON.stringify(c).slice(0, 300));
  await setCard(wrong); await page.locator('#tally-card [data-a="sign"]').tap(); await sleep(2200);
  c = await card(); await shot('06-wrong');
  ok(`a wrong count (${wrong}, where the page drew ${blocks}) is not paid, the job stays on, and the card says to look again`, mine().active?.id === 'earth-fr-tally-homeguard' && credits() === c1 && !!c && /Look again/.test(c.msg), `${credits() - c1} ${JSON.stringify(c).slice(0, 300)}`);
  await sleep(15500);
  const blocks2 = await drawn(1);
  await setCard(blocks2); await page.locator('#tally-card [data-a="sign"]').tap(); await sleep(2500); await shot('07-right');
  ok(`after a moment the right count (${blocks2}) is taken: 70 credits`, !mine().active && credits() === c1 + 70 && mine().freight?.runs === 2, `${credits() - c1} ${JSON.stringify(mine().freight)} ${JSON.stringify(await card()).slice(0, 200)}`);

  // ---- the count the page draws and the count the book gives agree across the timetable (this shared world's own home strength)
  const agree = await page.evaluate(async () => {
    const YB = await import('/src/worlds/yardBook.js'), B = await import('/src/roles/balance.js');
    const y = cosmos.space.worlds.get('earth').client.yard, h = cosmos.world.snapshot.homes && cosmos.world.snapshot.homes.earth, share = YB.stackShare(h && Number.isFinite(h.balance) ? B.strengthOf(h) : null);
    const rows = []; let okAll = true; const s0 = y.shiftS;
    for (let k = 0; k < 24; k++) {
      y.shift(61); for (let i = 0; i < 3; i++) cosmos.step(1 / 30);
      const st = y.status(), now = st.time, a = [st.stocks[0], st.stocks[1]], b = [Math.round(YB.tallyTruth('skyward', now, share)), Math.round(YB.tallyTruth('homeguard', now, share))];
      rows.push(a.join('/') + '=' + b.join('/')); if (a[0] !== b[0] || a[1] !== b[1]) okAll = false;
    }
    y.shiftS = s0; return { okAll, share, rows };
  });
  ok(`what the page draws and what the yard book says agree at 24 moments of the timetable (home share ${agree.share})`, agree.okAll, agree.rows.join(' '));
  ok('no page errors', errors.length === 0, errors.join(' | ').slice(0, 400));
  await ctx.close();
} catch (e) { bad++; console.log('FAIL the run finished  ' + String(e && e.stack || e).slice(0, 600)); }
finally { try { await webkit?.close(); } catch {} try { await app?.close(); } catch {} }
console.log(bad ? `tally run: ${bad} failed` : 'tally run: all passed'); process.exit(bad ? 1 : 0);
