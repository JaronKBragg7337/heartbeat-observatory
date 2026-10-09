// The jobs on an iPhone-profile WebKit, played through the real screens against a real local server (real clock): Earth (Okafor asks, you answer, the line check is walked,
// the story speaks, the pay arrives), the Moon's hub desk (a hand signed on at the arrivals desk), Mars (the tower: a choice the story puts to you). Screenshots go to $MISSION_SHOTS.
//   node test/missions-browser.mjs
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
import { resolve as place } from '../src/missions/where.js';
import { outpostToFrame } from '../src/worlds/moon/place.js';
import { makeMoon } from '../src/space/moonField.js';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright'); }
const out = process.env.MISSION_SHOTS || fileURLToPath(new URL('../docs/qa/missions/', import.meta.url)); await mkdir(out, { recursive: true });
const WEBKIT = process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe');
const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const errors = []; let app, webkit, bad = 0;
const ok = (name, pass, detail = '') => { if (!pass) bad++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + detail)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  app = await startServer({ adapter: new MemoryAdapter(), port: 0, tick: true });
  const W = app.world;
  webkit = await pw.webkit.launch({ headless: true, executablePath: WEBKIT });
  const url = (q) => app.url.replace('ws:', 'http:') + '/?ws=' + app.url + '&dev=1&opening=off&tier=low&' + q;
  const ctx = await webkit.newContext(IPHONE), page = await ctx.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', String(e).slice(0, 300)); });
  const ready = async () => { await page.goto(url('')); await page.waitForFunction(() => window.cosmos?.world?.snapshot && cosmos.engine.frameCount >= 5, null, { timeout: 240000 }); };
  const shot = async (name) => page.screenshot({ path: join(out, name + '.png') });
  await ready();
  const pid = await page.evaluate(() => cosmos.world.playerId), P = () => W.state.players[pid], SHIP = () => W.state.ships[P().shipId];
  const mine = () => W.state.missions[pid];
  // put the player (on foot) at a place on this world's frame, server side, then tell the browser to take the server's word for where it stands
  const goTo = async (ref) => {
    const pl = place(ref), p = P();
    if (pl.frame !== 'mars' && !(pl.frame in (SHIP().moonPads || {}))) throw Error('no pad on ' + pl.frame);
    const sim = W.sims.get(SHIP().id);
    // the server puts the ship on that world's pad first if the pilot is going somewhere new (the browser follows the frame when it hears)
    if (pl.frame !== 'mars' && sim.frameId !== pl.frame && !pl.frame.startsWith('moon-')) { W.enqueue(async () => { sim.placeOnWorld(pl.frame); await W.commit(); }); await W.queue; }
    const pos = pl.kind === 'port' ? W.site.toWorld(pl.x, pl.y + 0.02, pl.z) : outpostToFrame(makeMoon(pl.frame).padInfo, pl.x + 1.4, 0.02, pl.z);
    // the browser first (so the next pose it reports is already there), then the server, which is the one that decides
    if (await page.evaluate((f) => cosmos.space.frameId === f, pl.frame)) await page.evaluate((q) => { const w = cosmos.walker; Object.assign(w.worldPos, q); Object.assign(w.velocity, { x: 0, y: 0, z: 0 }); w.grounded = true; w.updateFrame(); cosmos.multiplayer.forcePlayer = true; }, pos);
    W.enqueue(async () => {
      p.aboardShipId = null; p.pose.aboard = false; p.pose.seat = null; p.frameId = pl.frame; p.pose.worldPos = pos; p.pose.velocity = { x: 0, y: 0, z: 0 }; await W.commit();
    });
    await W.queue; await page.evaluate(() => { cosmos.multiplayer.forcePlayer = true; });
    await sleep(1800);
  };
  const talkTo = async (needle) => {
    if (await page.evaluate(() => getComputedStyle(document.querySelector('#crew-panel')).display !== 'none' && document.querySelector('#crew-panel').innerText.length > 5)) { await sleep(500); return; }
    await page.waitForFunction((n) => { const b = document.querySelector('#crew-talk'); return b && b.style.display !== 'none' && b.innerText.includes(n); }, needle, { timeout: 60000 });
    await page.locator('#crew-talk').tap(); await page.waitForSelector('#crew-panel', { state: 'visible' }); await sleep(300);
  };
  const panelText = () => page.evaluate(() => document.querySelector('#crew-panel').innerText);
  const tapBtn = async (sel) => { await page.locator('#crew-panel ' + sel).first().tap(); await sleep(900); };

  // ---------------------------------------------------------------- Mars: the tower, and a choice the story puts to you
  W.enqueue(async () => { W.state.missions[pid] = { active: null, done: { 'mars-notes': { at: 1 }, 'mars-sensor': { at: 1 }, 'mars-band': { at: 1 } }, flags: {}, log: [], n: 0 }; await W.commit(); });
  await W.queue; await sleep(800);
  await goTo('cab-binoculars'); await sleep(1500);
  await talkTo('Lookout');
  await tapBtn('[data-a="mission-ask"]'); await shot('mars-1-offer');
  ok('the lookout offer reads as a persons request', /second witness|log every light/i.test(await panelText()), await panelText());
  await tapBtn('[data-a="mission-accept"]');
  await sleep(2500);
  await shot('mars-2-glass');
  ok('standing at the glass writes the scanner log and the story asks what goes in the book', mine()?.active?.id === 'mars-glass' && mine().active.step === 1, JSON.stringify(mine()?.active));
  await talkTo('Lookout'); const ask = await panelText();
  ok('the question is in the conversation with two answers as buttons, not a menu somewhere', /What goes in the book/.test(ask) && (await page.locator('#crew-panel [data-a="mission-choose"]').count()) === 2, ask);
  await shot('mars-3-choice');
  await tapBtn('[data-a="mission-choose"][data-o="open"]'); await sleep(1500);
  ok('the answer ends the job: 300 credits and the story remembers what was said', !!mine()?.done?.['mars-glass'] && mine().flags['mars-glass'] === 'open');
  await shot('mars-4-done'); await page.locator('#crew-panel [data-a="close"]').first().tap().catch(() => {});

  // ---------------------------------------------------------------- Earth: the Skyward line check
  await goTo('e-okafor');
  await page.waitForFunction(() => cosmos.space.frameId === 'earth', null, { timeout: 120000 });
  ok('the browser follows the server to Earth and stands beside Okafor', await page.evaluate(() => cosmos.space.frameId) === 'earth');
  await page.waitForFunction(() => /Okafor|Quintero|Pruitt|job/i.test(document.querySelector('.next-goal')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
  const hud = await page.evaluate(() => document.querySelector('.next-goal')?.innerText || '');
  ok('the status card (NEXT) points at the person with work on Earth, not at Ceres', /Okafor|Quintero|Pruitt|job/i.test(hud) && !/Ceres/.test(hud), hud);
  await shot('earth-1-next'); await talkTo('Okafor'); await shot('earth-2-talk');
  ok('Talk shows Okafor\'s ordinary words and one new button: "Is there paid work for me?"', /Is there paid work for me/.test(await panelText()), await panelText());
  await tapBtn('[data-a="mission-ask"]'); await shot('earth-3-offer');
  const offer = await panelText();
  ok('the offer says what the job is, who it helps, what it pays and that it is the oath job', /Walk the line/.test(offer) && /150 credits/.test(offer) && /oath job/.test(offer) && /I'll take it/.test(offer), offer);
  const box = await page.locator('#crew-panel').boundingBox();
  ok('the panel fits the phone (inside 393 x 852, no sideways scroll)', box.x >= 0 && box.x + box.width <= 393.5 && box.y >= 0 && box.y + box.height <= 852.5, JSON.stringify(box));
  await tapBtn('[data-a="mission-accept"]');
  ok('"I\'ll take it" puts the job on the pilot, on the server', mine()?.active?.id === 'earth-line', JSON.stringify(mine()));
  await page.waitForFunction(() => /Walk the line/.test(document.querySelector('.next-goal')?.innerText || ''), null, { timeout: 30000 });
  await shot('earth-4-job-on'); await page.locator('#crew-panel [data-a="close"]').first().tap().catch(() => {});
  const nextText = await page.evaluate(() => document.querySelector('.next-goal')?.innerText || '');
  ok('NEXT now names the job and the first step', /Walk the line: Check the hangar door/.test(nextText), nextText);
  // walk the line (the server checks each place)
  for (const [ref, label] of [[{ at: [-66, 32], frame: 'earth' }, 'hangar'], [{ at: [179, -24], frame: 'earth' }, 'tank'], [{ at: [106, -152], frame: 'earth' }, 'tower']]) {
    await goTo(ref); await sleep(1200);
  }
  await page.waitForFunction(() => /Report to Okafor/.test(document.querySelector('.next-goal')?.innerText || ''), null, { timeout: 60000 });
  const log = await page.evaluate(() => (cosmos.ship.stations.log || []).map((l) => l.msg).join('\n'));
  ok('the story spoke as each place was reached (the ship log has the three beats)', /door seals clean/.test(log) && /62 percent/.test(log) && /tyre tracks/.test(log), log.slice(-600));
  await shot('earth-5-report');
  await goTo('e-okafor'); await sleep(1500);
  ok('reporting to Okafor pays: the job is done, 150 credits are in the purse, the pilot is with Skyward', !!mine()?.done?.['earth-line'] && W.state.roles.members[pid] === 'skyward' && SHIP().economy.marks === 10000 + 1200 + 600, `${SHIP().economy.marks} ${JSON.stringify(mine()?.done)}`);
  const sheet = async () => { await page.evaluate(() => document.querySelector('#multiplayer-button').click()); await sleep(600); const t = await page.evaluate(() => document.querySelector('#multiplayer-panel').innerText); return t; };
  let sh = await sheet(); await shot('earth-6-sheet');
  ok('the World / crew sheet says no job right now, how many are done, and names Quintero\'s desk (not the Mars Crew Hall)', /Jobs done: [1-9]/.test(sh) && /Quintero/.test(sh) && /hands for hire/.test(sh) && !/walk to the crew hall door, north of the main pad/.test(sh), sh.slice(-900));
  await page.evaluate(() => document.querySelector('#multiplayer-panel .world-close').click()); await sleep(300);

  // ---------------------------------------------------------------- Earth: a hand at the dispatcher's desk
  await goTo('e-dispatch'); await talkTo('Quintero');
  ok('Quintero offers "Hands for hire" and work', /Hands for hire/.test(await panelText()), await panelText());
  await tapBtn('[data-a="mission-hires"]'); await shot('earth-7-hands');
  const hands = await panelText();
  ok('the list shows six hands with the signing fee and a button each', /Tamsin Okoye/.test(hands) && /Ned Alvarez/.test(hands) && (await page.locator('#crew-panel [data-a="desk-hire"]').count()) === 6, hands.slice(0, 500));
  const marksBefore = SHIP().economy.marks;
  await tapBtn('[data-a="desk-hire"][data-k="desk:earth:pilot"]');
  await sleep(1500);
  ok('tapping Hire signs the pilot on the landed ship (server crew), and the purse goes down by the fee', SHIP().crew.some((c) => c.name === 'Tamsin Okoye') && SHIP().economy.marks === marksBefore - 560, JSON.stringify(SHIP().crew.map((c) => c.name)));
  await shot('earth-8-hired');

  ok('no page errors through the whole run', errors.length === 0, errors.join('\n').slice(0, 400));
} catch (e) { bad++; console.log('FAIL (threw)', e.stack || e); }
finally { await webkit?.close().catch(() => {}); await app?.close().catch(() => {}); }
console.log(bad ? `${bad} FAILED` : 'ALL PASS'); process.exit(bad ? 1 : 0);
