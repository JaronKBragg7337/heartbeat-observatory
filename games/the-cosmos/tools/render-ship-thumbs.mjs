// Renders ship pictures with a real browser: the shipyard thumbnails (assets/ships/<type>.webp) and QA views.
//   node tools/render-ship-thumbs.mjs thumbs [type ...]               -> assets/ships/<type>.webp (960x540)
//   node tools/render-ship-thumbs.mjs shot <outfile.png> "<query>" [w h]  -> one render with the page's query (see ship-thumb.html)
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const srv = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(ROOT, p === '/' ? 'index.html' : p);
    if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const b = await readFile(f); res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }).end(b);
  } catch { res.writeHead(404).end('no'); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + srv.address().port;
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROMIUM || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function render(query, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(origin + '/tools/ship-thumb.html?' + query + '&w=' + w + '&h=' + h);
  await page.waitForFunction(() => window.__done === true, null, { timeout: 180000 });
  const r = await page.evaluate(() => ({ png: window.__png, jpg: window.__jpg, webp: window.__webp, error: window.__error, info: window.__info }));
  await page.close();
  if (r.error) throw new Error(r.error + (errs.length ? '\n' + errs.join('\n') : ''));
  return r;
}
const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'thumbs') {
    const { shipTypes } = await import('../src/ships/registry.js');
    const want = rest.length ? rest : shipTypes();
    await mkdir(join(ROOT, 'assets/ships'), { recursive: true });
    const VIEW = { transport: '&yaw=36&pitch=17&zoom=0.52', descender: '&yaw=38&pitch=17&zoom=0.62', bulker: '&yaw=34&pitch=20&zoom=0.62', escort: '&yaw=38&pitch=17&zoom=0.66', lifeboat: '&yaw=40&pitch=16&zoom=0.75', meridian: '&zoom=0.8', hauler: '&zoom=0.8', raider: '&zoom=0.8', courier: '&zoom=0.85' };
    for (const t of want) {
      const extra = { lifeboat: [['', ''], ['-moon', '&world=moon'], ['-ceres', '&world=ceres'], ['-earth', '&world=earth'], ['-callisto', '&world=callisto']] }[t] || [['', '']];
      for (const [suffix, q] of extra) {
        const r = await render('type=' + t + (VIEW[t] || '') + q, 960, 540);
        await writeFile(join(ROOT, 'assets/ships/' + t + suffix + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
        console.log('thumb', t + suffix, Math.round(r.webp.length * 0.75 / 1024), 'KB');
      }
    }
  } else if (cmd === 'shot') {
    const [out, query, w = '1280', h = '720'] = rest;
    const r = await render(query, +w, +h); await mkdir(dirname(out), { recursive: true });
    const useJpg = /\.jpe?g$/i.test(out); await writeFile(out, Buffer.from((useJpg ? r.jpg : r.png).split(',')[1], 'base64')); console.log('wrote', out, JSON.stringify(r.info || {}));
  } else console.log('usage: thumbs [type...] | shot <out.png> "<query>" [w h]');
} finally { await browser.close(); srv.close(); }
