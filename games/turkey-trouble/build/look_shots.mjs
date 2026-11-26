// Turkey Trouble: look pictures with no browser window. WebKit opens look.html once per camera and saves a JPEG.
//   node build/look_shots.mjs [cameras] [extra query]
// cameras: comma separated; a name from look.html (yard, barn, highway, ...) or  name=ex/ey/ez>ax/ay/az  for any eye and target.
// extra query: for example  q=high&turkey=1&truck=1
import { createRequire } from 'node:module';
import { join } from 'node:path';
import fs from 'node:fs';

const cams = (process.argv[2] || 'yard,highway,creek').split(',');
const extra = process.argv[3] || 'q=high&turkey=1';
const base = process.env.TT_BASE || 'http://localhost:8766/games/turkey-trouble/';
const OUT = process.env.TT_SHOTS_DIR || 'C:/Users/lilli/Projects/turkey-work/shots';
const W = +(process.env.TT_W || 1280), H = +(process.env.TT_H || 720);
fs.mkdirSync(OUT, { recursive: true });

let pw = null;
for (const root of [import.meta.url, 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/', 'C:/Users/lilli/AI-Shared/tools/site-reel/node_modules/']) {
  for (const name of ['playwright', 'playwright-core']) {
    try { pw = createRequire(root)(name); break; } catch { /* next */ }
  }
  if (pw) break;
}
if (!pw) { console.log('NOT RUN: Playwright was not found on this machine'); process.exit(2); }
const browsers = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
const kits = fs.existsSync(browsers) ? fs.readdirSync(browsers).filter((d) => /^webkit-\d+$/.test(d)).sort() : [];
let browser = null;
for (const kit of [null, ...kits.slice().reverse()]) {
  try { browser = await pw.webkit.launch(kit ? { headless: true, executablePath: join(browsers, kit, 'Playwright.exe') } : { headless: true }); break; } catch { /* next */ }
}
if (!browser) { console.log('NOT RUN: no WebKit build started'); process.exit(2); }
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
let bad = 0;
for (const cam of cams) {
  const [name, spec] = cam.split('=');
  let q = 'cam=' + name;
  if (spec) { const [e, a] = spec.split('>'); q = 'eye=' + e.replaceAll('/', ',') + '&at=' + a.replaceAll('/', ','); }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 400)));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 1200)); });
  try {
    await page.goto(`${base}look.html?${q}&${extra}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__look, null, { timeout: 120000 });
    await page.waitForTimeout(+(process.env.TT_SETTLE || 2500));
    await page.screenshot({ path: join(OUT, `look_${name}.jpg`), type: 'jpeg', quality: 84 });
  } catch (e) { errors.push('shot: ' + String(e).split('\n')[0].slice(0, 300)); }
  if (errors.length) bad += 1;
  console.log(name, errors.length ? 'ERRORS ' + JSON.stringify(errors) : 'ok');
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
