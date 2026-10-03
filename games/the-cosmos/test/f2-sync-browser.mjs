// F2: time of day is the server's. Two browsers join a shared world with real clocks that disagree (one is 3 minutes fast, one 40 minutes slow);
// both must read the same game time and the same Sun after the handshake. Isolated FileAdapter authority (never the live world).
//   node test/f2-sync-browser.mjs
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
const { chromium } = createRequire(import.meta.url)(join(homedir(), '.codex/runtime/unfinished-island/node_modules/') + 'playwright');
const out = fileURLToPath(new URL('../docs/qa/2026-10-03/f2/', import.meta.url)); await mkdir(out, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'cosmos-f2sync-')); let app, browser; const result = { errors: [] };
try {
  app = await startServer({ adapter: new FileAdapter(join(temp, 'world.json')), port: 0, tick: true, clientErrorLog: join(temp, 'client-errors.log') });
  const origin = app.url.replace('ws:', 'http:'), url = `${origin}/?dev=1&opening=off&ws=${app.url}&tier=low&sky=live`;
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-gl=swiftshader', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  async function make(name, skewMs) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
    await ctx.addInitScript(([name, skewMs]) => {
      localStorage.setItem('cosmos-device-v2', JSON.stringify({ key: name.repeat(48).slice(0, 48), name }));
      const real = Date.now.bind(Date); Date.now = () => real() + skewMs;                 // this browser's wall clock is wrong by skewMs
    }, [name, skewMs]);
    const page = await ctx.newPage(); page.on('pageerror', (e) => result.errors.push(String(e).slice(0, 200)));
    await page.goto(url);
    await page.waitForFunction(() => window.cosmos?.multiplayer && cosmos.engine.frameCount >= 2, null, { timeout: 180000 });
    await page.evaluate(() => cosmos.engine.stop());
    return page;
  }
  const a = await make('Alpha', 180_000), b = await make('Beta', -40 * 60_000);
  await a.waitForTimeout(1500);
  // read both at the same instant of the server's clock
  const read = async (p) => p.evaluate(() => ({ T: cosmos.worldTimeS(), sun: { ...cosmos.space.sunLocal }, offsetMs: 0 }));
  const [ra, rb] = await Promise.all([read(a), read(b)]);
  const serverT = (Date.now() - Date.UTC(2026, 9, 3)) / 1000;
  result.alphaT = ra.T; result.betaT = rb.T; result.serverT = serverT; result.alphaMinusServerS = +(ra.T - serverT).toFixed(2); result.betaMinusServerS = +(rb.T - serverT).toFixed(2); result.alphaMinusBetaS = +(ra.T - rb.T).toFixed(2);
  result.sunAgree = Math.hypot(ra.sun.x - rb.sun.x, ra.sun.y - rb.sun.y, ra.sun.z - rb.sun.z);
  result.ok = Math.abs(ra.T - serverT) < 1.5 && Math.abs(rb.T - serverT) < 1.5 && result.sunAgree < 1e-3;
  await a.screenshot({ path: join(out, '30-sync-alpha.png') }); await b.screenshot({ path: join(out, '31-sync-beta.png') });
} catch (e) { result.errors.push('SCRIPT: ' + (e.stack || e.message)); }
finally { await writeFile(join(out, 'sync-results.json'), JSON.stringify(result, null, 1)); await browser?.close(); await app?.close(); await rm(temp, { recursive: true, force: true }); }
console.log(JSON.stringify(result, null, 1));
process.exit(result.ok && !result.errors.length ? 0 : 1);
