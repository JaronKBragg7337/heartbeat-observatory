// ============================================================================
// server.js — static file server for local development only.
//
// This serves the client so a browser can load ES modules over http:// (they
// do not load from file://). It is not, and will never be, the authoritative
// game server — it has no state, no validation, and no idea what the game is.
//
// Run: node server.js   ->  http://localhost:8378/
// ============================================================================

import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname, normalize } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 8378;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary',
};

createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';

    // Never serve outside the project directory.
    const full = normalize(join(ROOT, rel));
    if (!full.startsWith(normalize(ROOT))) {
      res.writeHead(403).end('forbidden');
      return;
    }

    const info = await stat(full).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }

    const buf = await readFile(full);
    res.writeHead(200, {
      'content-type': TYPES[extname(full).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    }).end(buf);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err));
  }
}).listen(PORT, () => {
  console.log(`The Cosmos — dev server on http://localhost:${PORT}/`);
});
