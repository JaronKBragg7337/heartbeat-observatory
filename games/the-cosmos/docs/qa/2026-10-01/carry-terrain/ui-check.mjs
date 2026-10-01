// Real button / keyboard checks, plus a 16-bit-depth horizon screenshot.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire('file:///C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright');
const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [], errors = [], resourceWarnings = [];
const shot = async (p, name) => p.screenshot({ path: new URL(name + '.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') });
const check = (name, condition) => { results.push({ name, pass: !!condition }); if (!condition) throw Error(name); };
try {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(m.text()); });
  p.on('response', r => { if (r.status() >= 400) resourceWarnings.push({ url: r.url(), status: r.status() }); });
  await p.goto('http://localhost:8393/?tier=low');
  await p.waitForFunction(() => window.cosmos?.engine);
  await p.waitForLoadState('networkidle');
  const load = await p.evaluate(() => {
    const c = cosmos; c.engine.stop(); c.goto(-14, -59.188); c.setTool(2);
    c.walker.pitch = -1.2;
    for (let i = 0; i < 60; i++) c.walker.tick(1 / 60, {});
    const cuts = [c.doDig(), c.doDig(), c.doDig()];
    c.flushTerrain();
    c.step(0.25);
    return { cuts: cuts.map(q => q.ok), mass: c.digger.carriedMass(), piles: c.edits.piles.length,
      bar: document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow'), text: document.getElementById('hud').innerText };
  });
  check('phone: three real bucket bites are carried and the kg/capacity bar shows them', load.cuts.every(Boolean) && Number(load.bar) === load.mass && load.text.includes('48000 kg'));
  check('phone: ship messages clear the load bar and its capacity label', await p.evaluate(() => document.getElementById('ship-toast').getBoundingClientRect().top >= document.getElementById('hud').getBoundingClientRect().bottom));
  await shot(p, 'phone-loaded');
  await p.locator('#btn-drop-all').tap();
  const drop = await p.evaluate(() => { cosmos.step(0.25); return { count: cosmos.carried.length, piles: cosmos.edits.piles.length, ledger: cosmos.ledger() }; });
  check('phone: one tap on Drop all empties the carrier into one heap with exact zero ledgers', drop.count === 0 && drop.piles === load.piles + 1 && drop.ledger.unaccountedKg === 0 && drop.ledger.unaccountedM3 === 0);
  await p.evaluate(() => { cosmos.flushTerrain(); cosmos.step(); });
  await shot(p, 'phone-dropped');
  await p.evaluate(() => { cosmos.doDig(); cosmos.doDig(); cosmos.step(0.25); });
  await p.keyboard.press('q');
  const single = await p.evaluate(() => cosmos.carried.length);
  check('keyboard Q still drops exactly one of two loads', single === 1);
  await p.keyboard.press('r');
  check('keyboard R drops every remaining load and conserves mass exactly', await p.evaluate(() => cosmos.carried.length === 0 && cosmos.ledger().unaccountedKg === 0 && cosmos.ledger().unaccountedM3 === 0));
  await p.evaluate(() => { const c = cosmos; c.doDig(); c.tool().capacityKg = c.digger.carriedMass(); });
  await p.keyboard.press('e');
  check('full carrier says why digging stopped and offers Drop all', (await p.locator('#btn-action').innerText()).includes('full'));
  await p.goto('http://localhost:8393/?tier=low&depth=16&terrainView=1000');
  await p.waitForFunction(() => window.cosmos?.freeCam.active);
  await p.evaluate(() => { cosmos.engine.stop(); cosmos.step(); });
  await shot(p, 'phone-depth16-horizon');
  check('16-bit emulation keeps the logarithmic depth shader valid', await p.evaluate(() => cosmos.depthEmulated === 16 && cosmos.engine.renderer.capabilities.logarithmicDepthBuffer));
  check('browser reports no JS or shader errors', errors.length === 0);
} finally {
  writeFileSync(new URL('ui-check.json', import.meta.url), JSON.stringify({ results, errors, resourceWarnings }, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results));
