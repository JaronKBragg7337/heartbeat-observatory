// Review screenshots for voices that need no second player: the opening's captions with the "tap for sound" hint, a trader's
// talk panel with the line spoken, and the voice log behind both. Writes docs/qa/2026-10-03/voices/*.png and voice-log.json.
// Run from games/the-cosmos:  node test/voice-shots.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(join(homedir(), '.codex/runtime/unfinished-island/node_modules/') + 'playwright');
const out = fileURLToPath(new URL('../docs/qa/2026-10-03/voices/', import.meta.url)); await mkdir(out, { recursive: true });
const port = 8397, srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore', cwd: fileURLToPath(new URL('../', import.meta.url)) });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-gl=swiftshader', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const logs = {};
try {
  // 1. the opening: caption + hint, then after a tap the same caption is spoken
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&tier=low`);
  await p.waitForFunction(() => window.cosmos?.opening && cosmos.engine.frameCount >= 2, null, { timeout: 90000 });
  await p.evaluate(async () => { cosmos.engine.stop(); await cosmos.opening.ready; cosmos.step(0); });
  const step = (sec) => p.evaluate((sec) => { const r = cosmos.engine.renderer, render = r.render; r.render = () => {}; for (let t = 0; t < sec; t += 1 / 30) cosmos.step(1 / 30); r.render = render; cosmos.step(0); }, sec);
  await step(9.5);
  await p.screenshot({ path: join(out, '09-opening-caption-and-sound-hint.png') });
  await p.touchscreen.tap(200, 500);                     // the first tap turns the sound on
  await step(4);                                          // the cabin crew line (t 15-23) comes next
  await step(6);
  await p.evaluate(() => cosmos.step(0)); await p.waitForTimeout(500);
  await p.screenshot({ path: join(out, '10-opening-cabin-crew.png') });
  logs.opening = await p.evaluate(() => ({ unlocked: cosmos.voice.unlocked, log: cosmos.voice.log }));
  await ctx.close();

  // 2. a trader's talk panel
  const ctx2 = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const q = await ctx2.newPage();
  await q.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&tier=low`);
  await q.waitForFunction(() => window.cosmos?.crewUI && cosmos.portPeople?.members?.length && cosmos.engine.frameCount >= 2, null, { timeout: 120000 });
  await q.keyboard.press('ShiftLeft');
  const r = await q.evaluate(async () => {
    const c = cosmos, v = c.voice; c.engine.stop();
    const m = c.portPeople.members.find((x) => x.id === 'trader-2');
    const w = c.port.site.toWorld(m.x, 0.02, m.z + 1.4); Object.assign(c.walker.worldPos, w); c.walker.yaw = c.port.site.heading + Math.PI; c.walker.updateFrame();
    for (let i = 0; i < 12; i++) c.step(1 / 30);
    c.crewUI.openFor(m); c.crewUI._draw(); c.step(1 / 30);
    await new Promise((r) => setTimeout(r, 1500));
    return { member: m.name, personId: m.personId, log: v.log.slice(-4) };
  });
  logs.trader = r;
  await q.evaluate(() => cosmos.step(0)); await q.waitForTimeout(600);
  await q.screenshot({ path: join(out, '11-trader-talk-panel.png') });
  await ctx2.close();
} finally {
  await writeFile(join(out, 'voice-log.json'), JSON.stringify(logs, null, 1));
  await browser.close(); srv.kill();
}
console.log(JSON.stringify(logs).slice(0, 1500));
process.exit(0);
