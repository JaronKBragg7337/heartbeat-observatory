// Film the trailer shot list inside the game.
// Playwright, desktop high tier, 1920x1080, fixed 24 fps step.
//   node docs/trailer/capture.mjs
//   TRAILER_SMOKE=1 node docs/trailer/capture.mjs     one hero frame per shot
//   TRAILER_SHOT=port-dusk node docs/trailer/capture.mjs
// Frames and video go to docs/trailer/takes/ (gitignored). The contact sheet is docs/trailer/contact.jpg.
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../server/index.mjs';
import { FileAdapter } from '../../server/storage.mjs';
import { frameCount } from '../../src/cinema/math.js';

const require = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const { chromium } = require('playwright');

const here = fileURLToPath(new URL('./', import.meta.url));
const takes = join(here, 'takes');
const contactPath = join(here, 'contact.jpg');
const smoke = process.env.TRAILER_SMOKE === '1';
const only = new Set((process.env.TRAILER_SHOT || '').split(',').map((s) => s.trim()).filter(Boolean));
const W = 1920, H = 1080;

const exe = process.env.COSMOS_CHROME || [
  'C:/Users/lilli/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));
if (!exe) throw new Error('No Chromium executable found');

const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
const haveFfmpeg = ffmpeg.status === 0;

const list = JSON.parse(await readFile(join(here, 'shots.json'), 'utf8'));
const shots = (list.shots || list).filter((s) => only.size === 0 || only.has(s.id));
if (!shots.length) throw new Error('no shots to film');

await mkdir(takes, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'cosmos-trailer-'));
const errors = [];
const report = [];
let app, browser;

const t0 = Date.now();
try {
  app = await startServer({ adapter: new FileAdapter(join(temp, 'world.json')), port: 0, tick: false, now: () => Date.now() });
  const port = new URL(app.url.replace('ws:', 'http:')).port;
  browser = await chromium.launch({
    headless: true,
    executablePath: exe,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !/Failed to load resource/.test(text)) errors.push('console: ' + text);
  });
  const url = `http://127.0.0.1:${port}/?solo=1&dev=1&opening=off&tier=high&cinema=1`;
  console.log('loading', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.cosmos && window.cosmos.ship && window.cosmos.ship.ready && window.cosmos.cinema, null, { timeout: 180000 });
  await page.waitForFunction(() => window.cosmos.crew && window.cosmos.crew.members && window.cosmos.crew.members.size > 0, null, { timeout: 60000 }).catch(() => console.log('crew not ready; the bridge shot may be empty'));
  await page.evaluate(({ w, h }) => {
    const e = cosmos.engine;
    e.stop();
    e.dprCap = 1;
    e.renderer.setPixelRatio(1);
    e.renderer.setSize(w, h, false);
    e.camera.aspect = w / h;
    e.camera.updateProjectionMatrix();
    for (const fn of e._resizers) fn(w, h);
  }, { w: W, h: H });

  const heroes = [];
  for (const shot of shots) {
    const shotT = Date.now();
    const dir = join(takes, shot.id);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    try {
      const prep = await page.evaluate(async (s) => {
        const parsed = await cosmos.cinema.prepare(s);
        cosmos.engine.step(0);
        return { id: parsed.id, seated: parsed._crewSeated || 0, playing: cosmos.cinema.playing };
      }, shot);
      const n = frameCount(shot.duration, shot.fps || 24);
      const heroAt = Math.min(n - 1, Math.round((n - 1) * 0.35));
      const last = smoke ? heroAt : n - 1;
      let heroFile = null;
      for (let i = 0; i <= last; i++) {
        if (i > 0) await page.evaluate((dt) => cosmos.engine.step(dt), 1 / (shot.fps || 24));
        const keep = smoke ? i === heroAt : true;
        if (!keep) continue;
        const file = join(dir, 'f' + String(i).padStart(4, '0') + '.jpg');
        await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
        if (i === heroAt) heroFile = file;
      }
      let video = null;
      if (!smoke && haveFfmpeg) {
        video = join(takes, shot.id + '.mp4');
        const enc = spawnSync('ffmpeg', [
          '-y', '-framerate', String(shot.fps || 24),
          '-i', join(dir, 'f%04d.jpg'),
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
          video,
        ], { encoding: 'utf8' });
        if (enc.status !== 0) {
          video = null;
          errors.push(shot.id + ' ffmpeg: ' + (enc.stderr || '').slice(-400));
        }
      }
      const row = { id: shot.id, frames: smoke ? 1 : n, hero: heroFile, video, seated: prep.seated, ms: Date.now() - shotT };
      report.push(row);
      if (heroFile) heroes.push({ id: shot.id, file: heroFile });
      console.log('shot', shot.id, row.frames + ' frames', (row.ms / 1000).toFixed(1) + 's', prep.seated ? prep.seated + ' seated' : '');
    } catch (e) {
      const msg = shot.id + ': ' + (e && e.message ? e.message : e);
      errors.push(msg);
      report.push({ id: shot.id, error: msg });
      console.log('FAILED', msg);
    }
  }

  const filmed = new Map(heroes.map((h) => [h.id, h.file]));
  const sheetHeroes = [];
  for (const s of (list.shots || list)) {
    if (filmed.has(s.id)) sheetHeroes.push({ id: s.id, file: filmed.get(s.id) });
    else {
      const n = frameCount(s.duration, s.fps || 24);
      const heroAt = Math.min(n - 1, Math.round((n - 1) * 0.35));
      const file = join(takes, s.id, 'f' + String(heroAt).padStart(4, '0') + '.jpg');
      if (existsSync(file)) sheetHeroes.push({ id: s.id, file });
    }
  }
  if (sheetHeroes.length) {
    const imgs = [];
    for (const h of sheetHeroes) imgs.push({ id: h.id, b64: (await readFile(h.file)).toString('base64') });
    const cols = Math.min(5, imgs.length);
    const sheet = await browser.newPage({ viewport: { width: cols * 480, height: Math.ceil(imgs.length / cols) * 270 + 28 }, deviceScaleFactor: 1 });
    await sheet.setContent(`<!doctype html><style>
      body{margin:0;background:#0a0705;color:#e8d5c2;font:12px ui-monospace,monospace}
      .g{display:grid;grid-template-columns:repeat(${cols},1fr)}
      figure{margin:0;position:relative}
      img{width:100%;height:auto;display:block}
      figcaption{position:absolute;left:6px;bottom:6px;background:#000a;padding:2px 6px}
    </style><div class="g">${imgs.map((h) => `<figure><img src="data:image/jpeg;base64,${h.b64}"><figcaption>${h.id}</figcaption></figure>`).join('')}</div>`);
    await sheet.screenshot({ path: contactPath, type: 'jpeg', quality: 82 });
    await sheet.close();
    console.log('contact', contactPath);
  }
  await writeFile(join(takes, 'report.json'), JSON.stringify({ smoke, ffmpeg: haveFfmpeg, ms: Date.now() - t0, shots: report, errors }, null, 2));
} finally {
  if (browser) await browser.close();
  if (app) await app.close();
  await rm(temp, { recursive: true, force: true });
}

console.log('done in', ((Date.now() - t0) / 1000).toFixed(1) + 's', errors.length ? errors.length + ' errors' : 'clean');
if (errors.length) {
  console.log(errors.join('\n'));
  process.exitCode = 1;
}
