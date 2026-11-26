// Run a mode headless with a bot until it ends. Shared by the tests.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createGame, makeInput } from '../src/game/game.js';

const here = dirname(fileURLToPath(import.meta.url));
export function loadLayout() { return JSON.parse(readFileSync(join(here, '..', 'layout.json'), 'utf8')); }

export function runMode(kind, makeBot, { seed = 1, layout = loadLayout(), maxSeconds = 300, opts = {}, onStep } = {}) {
  const g = createGame(kind, layout, { seed, ...opts });
  const bot = makeBot(g);
  const input = makeInput();
  const counts = {};
  const max = Math.round(maxSeconds * 60);
  for (let i = 0; i < max; i++) {
    bot.think(input);
    g.events.length = 0;
    g.step(input);
    for (const e of g.events) counts[e.type] = (counts[e.type] || 0) + 1;
    if (onStep) onStep(g, i);
    if (g.phase !== 'play' && g.phase !== 'ending') break;
  }
  return { g, counts, phase: g.phase, result: g.result, seconds: g.steps / 60 };
}
