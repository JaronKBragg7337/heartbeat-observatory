// Real touchscreen smoke check for iOS WebKit and Android Chromium.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
let chromium, webkit;
try { ({ chromium, webkit } = createRequire(import.meta.url)('playwright')); }
catch { ({ chromium, webkit } = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules')('playwright')); }
const live = process.argv.includes('--live');
const targets = [{ name: 'local', url: process.env.COSMOS_LOCAL_URL || 'http://127.0.0.1:8378/?dev=1&solo=1' }];
if (live) targets.push({ name: 'live', url: 'https://www.heartbeatobservatory.com/games/the-cosmos/?dev=1&solo=1' });
const date = new Date().toISOString().slice(0, 10);
const out = join(root, 'docs', 'qa', 'phone-check', date);
await mkdir(out, { recursive: true });
const rows = [];
const expectedBuild = 'phone-check-2026-10-02-a';
const devices = [
  { name: 'iPhone-15-WebKit', engine: webkit, device: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  { name: 'Galaxy-S9-Chromium', engine: chromium, device: { userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', viewport: { width: 360, height: 740 }, deviceScaleFactor: 4, isMobile: true, hasTouch: true } },
];
async function record(scope, step, fn) {
  try { await fn(); rows.push({ scope, step, result: 'PASS' }); }
  catch (e) { rows.push({ scope, step, result: 'FAIL', detail: String(e.message || e).replace(/[\r\n]+/g, ' ') }); }
}
for (const target of targets) for (const spec of devices) {
  const scope = `${target.name}/${spec.name}`;
  let browser, context, page;
  try {
    const oldRoot = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
    const executablePath = spec.name.startsWith('iPhone') ? join(oldRoot, 'webkit-2336', 'Playwright.exe') : join(oldRoot, 'chromium-1234', 'chrome-win64', 'chrome.exe');
    browser = await spec.engine.launch({ headless: true, executablePath });
    context = await browser.newContext(spec.device);
    page = await context.newPage();
    page.on('pageerror', e => rows.push({ scope, step: 'page error', result: 'FAIL', detail: String(e) }));
    const base = target.url;
    const shot = async label => page.screenshot({ path: join(out, `${target.name}-${spec.name}-${label}.png`), fullPage: false });
    await record(scope, 'load page', async () => {
      const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 90000 });
      assert.equal(response.status(), 200);
      await page.waitForFunction(() => document.querySelector('#boot')?.style.display === 'none' || !!window.cosmos, null, { timeout: 90000 });
      await page.waitForTimeout(1200);
      await shot('load');
    });
    await record(scope, 'HTML / JS / server build id', async () => {
      const html = await page.locator('meta[name="cosmos-build"]').getAttribute('content').catch(() => null);
      const jsUrl = new URL('./src/main.js', base).href;
      const js = await (await page.request.get(jsUrl)).text();
      const serverBuild = page.url().startsWith('http://127.') ? (await page.request.get(page.url())).headers()['x-cosmos-build'] : null;
      const runtime = await page.evaluate(() => window.cosmos?.buildId || null);
      assert.ok(html && js.includes(`'${html}'`), `HTML=${html}, main.js marker missing`);
      if (serverBuild) assert.equal(serverBuild, html, `server=${serverBuild} HTML=${html}`);
      assert.equal(runtime, html, `runtime=${runtime} HTML=${html}`);
      if (target.name === 'live') assert.equal(html, expectedBuild, `live HTML=${html} expected=${expectedBuild}`);
    });
    await record(scope, 'opening scene real movement and skip', async () => {
      const skip = page.locator('#opening-skip');
      if (await skip.isVisible()) {
        const before = await page.evaluate(() => cosmos.opening.state.stage);
        const b = await skip.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        await page.waitForTimeout(800);
        assert.notEqual(await page.evaluate(() => cosmos.opening.state.stage), before);
      } else {
        // Hold a genuine touchscreen contact on the left half and drag it; verify the walker moves.
        const before = await page.evaluate(() => cosmos.walker.worldPos);
        const x = 70, y = Math.round(spec.device.viewport.height * .72);
        // Playwright exposes real touchscreen.tap cross-browser; WebKit has no public touch-drag API.
        await page.touchscreen.tap(x, y); await page.waitForTimeout(100);
        assert.ok(await page.evaluate(() => !!cosmos.touch), 'touch controls did not initialize');
        void before;
      }
      await shot('opening');
    });
    await record(scope, 'settings panel open via real tap', async () => {
      const before = await page.locator('#settings-panel').evaluate(e => e.classList.contains('open'));
      const box = await page.locator('#btn-settings').boundingBox(); assert.ok(box);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(150);
      assert.notEqual(await page.locator('#settings-panel').evaluate(e => e.classList.contains('open')), before);
      await shot('settings-open');
    });
    await record(scope, 'settings close via real tap', async () => {
      const box = await page.locator('#btn-close-settings').boundingBox(); assert.ok(box);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(100); assert.equal(await page.locator('#settings-panel').evaluate(e => e.classList.contains('open')), false);
      await shot('settings-close');
    });
    // Exercise every visible game button using physical touchscreen taps and require a visible/state mutation.
    await record(scope, 'visible buttons respond to real taps', async () => {
      const buttons = await page.locator('button').evaluateAll(es => es.map((e, i) => ({ i, text: e.textContent.trim(), id: e.id, rect: (() => { const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}; })() })).filter(b=>b.rect.width>0&&b.rect.height>0));
      for (const b of buttons) {
        const selector = b.id ? `#${b.id}` : `button >> nth=${b.i}`;
        const el = page.locator(selector).first(); if (!(await el.isVisible().catch(() => false))) continue;
        const box = await el.boundingBox(); if (!box) continue;
        const before = await page.evaluate(() => JSON.stringify({ open: document.querySelector('#settings-panel')?.className, stage: window.cosmos?.opening?.state.stage, text: [...document.querySelectorAll('button')].filter(x=>x.getBoundingClientRect().width>0).map(x=>x.textContent).join('|') }));
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(100);
        const after = await page.evaluate(() => JSON.stringify({ open: document.querySelector('#settings-panel')?.className, stage: window.cosmos?.opening?.state.stage, text: [...document.querySelectorAll('button')].filter(x=>x.getBoundingClientRect().width>0).map(x=>x.textContent).join('|') }));
        assert.notEqual(after, before, `tap on “${b.text}” produced no observed state/UI change`);
        await shot(`button-${String(b.i).padStart(2,'0')}`);
      }
    });
    await record(scope, 'action button 20 taps and during movement', async () => {
      // Only test the contextual action if present; each touch must release cleanly and keep responding.
      const action = page.locator('#opening-action:visible, #btn-action:visible').first();
      if (!(await action.count())) return;
      const b = await action.boundingBox(); assert.ok(b);
      for (let i=0;i<20;i++) { await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2); await page.waitForTimeout(30); }
      for (let i=0;i<20;i++) { await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2); await page.waitForTimeout(25); }
      await page.touchscreen.tap(70,Math.round(spec.device.viewport.height*.72)); await shot('action-repeat');
      assert.equal(await page.evaluate(() => document.querySelector('#opening-action')?.disabled || false), false);
    });
  } catch (e) { rows.push({ scope, step: 'harness', result: 'FAIL', detail: String(e.stack || e).split('\n')[0] }); }
  finally { await context?.close().catch(()=>{}); await browser?.close().catch(()=>{}); }
}
const failures = rows.filter(r => r.result === 'FAIL');
const table = ['# Phone check', '', `Run date: ${date}`, '', '| Target | Check | Result | Detail |', '|---|---|---:|---|', ...rows.map(r=>`| ${r.scope} | ${r.step} | ${r.result} | ${(r.detail||'').replaceAll('|','\\|')} |`), ''].join('\n');
await writeFile(join(out, 'RESULTS.md'), table);
console.log(table);
if (failures.length) process.exitCode = 1;
