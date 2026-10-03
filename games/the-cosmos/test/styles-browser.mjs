// F0: open the in-game style gallery (?dev=1&styles=1) on the iPhone WebKit profile and photograph every faction's card.
//   node test/styles-browser.mjs [--out docs/qa/2026-10-03/f0]
// Fails if the gallery does not open, a card is missing, a 3D preview stays blank, or the page scrolls sideways.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let webkit;
try { ({ webkit } = createRequire(import.meta.url)('playwright')); }
catch { ({ webkit } = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules')('playwright')); }
const outArg = process.argv.indexOf('--out');
const out = outArg > 0 ? process.argv[outArg + 1] : join(root, 'docs/qa', new Date().toISOString().slice(0, 10), 'f0');
await mkdir(out, { recursive: true });
const port = await new Promise((r) => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/build.json`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }

let fails = 0; const ok = (n, c, d = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n} ${c ? '' : d}`); if (!c) fails++; };
const browser = await webkit.launch();
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&styles=1`, { waitUntil: 'load' });
await page.waitForSelector('#fx-gallery .card', { timeout: 60000 });
const ids = await page.$$eval('#fx-gallery .card', (cs) => cs.map((c) => c.id.replace('fx-', '')));
ok('gallery opens with 12 cards', ids.length === 12, ids.join(','));
ok('no sideways scroll', await page.evaluate(() => { const g = document.getElementById('fx-gallery'); return g.scrollWidth <= g.clientWidth + 1; }));
for (const id of ids) {
  await page.evaluate((i) => document.getElementById('fx-' + i).scrollIntoView({ block: 'start' }), id);
  await page.waitForTimeout(400);
  // wait for the previews: a canvas is "drawn" when it has more than one colour in its pixels
  const drawn = await page.waitForFunction((i) => {
    const cs = [...document.querySelectorAll('#fx-' + i + ' .shot canvas')];
    return cs.length > 0 && cs.every((c) => { const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; const seen = new Set(); for (let k = 0; k < d.length; k += 4 * 997) { seen.add(d[k] >> 4 << 8 | d[k + 1] >> 4 << 4 | d[k + 2] >> 4); if (seen.size > 6) return true; } return false; });
  }, id, { timeout: 45000 }).then(() => true).catch(() => false);
  ok(`${id}: 3D previews drawn`, drawn);
  await page.screenshot({ path: join(out, `${id}-top.png`) });
  // the previews: scroll the people canvas to the top of the screen (people, then ship)
  for (const [k, sel] of [['people', '.shot:nth-of-type(1)'], ['ship', null]]) {
    await page.evaluate(({ i, k }) => { const sh = [...document.querySelectorAll('#fx-' + i + ' .shot')]; const t = k === 'people' && sh.length > 1 ? sh[0] : sh[sh.length - 1]; t.scrollIntoView({ block: 'center' }); }, { i: id, k });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(out, `${id}-${k}.png`) });
  }
}
// one more view: the top of the page with the chips
await page.evaluate(() => { document.getElementById('fx-gallery').scrollTop = 0; });
await page.screenshot({ path: join(out, '_top.png') });
ok('no page errors', errors.filter((e) => !/favicon|ERR_|Failed to load resource/.test(e)).length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.kill();
console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
