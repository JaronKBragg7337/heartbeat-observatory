// Screenshot harness. usage: node shot.mjs <scriptfile.mjs>   (script exports async (h) => {})
import { createRequire } from 'module';
const require = createRequire('file:///C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const { chromium } = require('playwright');
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));

export async function launch({ w = 750, h = 470, query = '', port = Number(process.env.PORT || 8392) } = {}) {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/lilli/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { const t = m.text(); logs.push(t); if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', t.slice(0, 300)); });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));
  await page.goto(`http://localhost:${port}/${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.cosmos && window.cosmos.engine, null, { timeout: 120000 });
  const shot = async (name) => { await page.screenshot({ path: path.join(here, name + '.jpg'), type: 'jpeg', quality: 82 }); console.log('shot', name); };
  return { browser, page, shot, logs };
}
const script = process.argv[2];
if (script) {
  const mod = await import(pathToFileURL(path.resolve(script)).href);
  await mod.default({ launch });
}
