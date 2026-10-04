// Generates the game's voice clips. Run from games/the-cosmos:   node tools/gen-voices.mjs [--check] [--prune] [--list]
//
//   (no flag)  voice every line that has no clip yet (existing clips are kept: a clip is named by hash(voice + text))
//   --check    list lines with no clip and exit 1 if there are any (test/voice-checks.mjs does the same in validate)
//   --prune    also delete clips no line asks for any more
//   --list     print the lines and which would be generated, generate nothing
//   --manifest write the manifest from the clips on disk, generate nothing
//   --reverse  work from the end of the list (run a second copy at once to halve the time)
//
// The TTS is Kokoro-82M (Apache-2.0 model and voices) via kokoro-js, running locally on CPU: no key, no network once the
// model is cached. KOKORO_DIR points at a folder holding node_modules/kokoro-js (default: the MSI's ~/.claude/voice).
// Output: assets/voices/<hash>.mp3 (mono, 24 kHz, ~40 kbps, silence trimmed, loudness matched), assets/voices/manifest.json
// (what the browser loads), assets/voices/lines.json (human index: hash -> voice + text).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { VOICES, clipKey } from '../src/voice/cast.js';
import { allLines } from '../src/voice/lines.js';
import { scanGroup } from './scan-lines.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'voices');
const args = new Set(process.argv.slice(2));
const { lines, dynamic } = allLines(scanGroup);
mkdirSync(OUT, { recursive: true });

const todo = [], have = {}, index = {};
for (const l of lines) {
  const key = clipKey(l.voice, l.text), file = join(OUT, key + '.mp3');
  index[key] = { voice: l.voice, text: l.text };
  if (existsSync(file)) have[key] = statSync(file).size; else todo.push({ ...l, key, file });
}
console.log(`${lines.length} lines, ${Object.keys(have).length} voiced, ${todo.length} to generate, ${dynamic.length} templates left to the browser voice`);
if (args.has('--list')) { for (const t of todo) console.log('  new', t.voice, '|', t.text); process.exit(0); }
if (args.has('--check')) { for (const t of todo) console.log('  MISSING', t.voice, '|', t.text); process.exit(todo.length ? 1 : 0); }

if (args.has('--manifest')) todo.length = 0;
if (todo.length) {
  const dir = process.env.KOKORO_DIR || join(homedir(), '.claude', 'voice');
  const { KokoroTTS } = await import(pathToFileURL(join(dir, 'node_modules', 'kokoro-js', 'dist', 'kokoro.js')).href);
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
  const tmp = join(tmpdir(), 'cosmos-voices-' + process.pid); mkdirSync(tmp, { recursive: true });
  let n = 0;
  if (args.has('--reverse')) todo.reverse();
  for (const t of todo) {
    if (existsSync(t.file)) continue;           // another copy got there first
    const spec = VOICES[t.voice]; if (!spec) throw Error('No such voice: ' + t.voice);
    const wav = join(tmp, t.key + '.wav');
    const audio = await tts.generate(t.text, { voice: spec.kokoro, speed: spec.speed });
    await audio.save(wav);
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', wav,
      '-af', 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.12,areverse,loudnorm=I=-19:TP=-2:LRA=9,apad=pad_dur=0.08',
      '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', t.file], { encoding: 'utf8' });
    if (r.status !== 0) {
      // fix-r1: an explicit installed Blender path supplies its bundled MP3 encoder on machines without ffmpeg CLI.
      if (r.error?.code !== 'ENOENT' || !process.env.COSMOS_BLENDER) throw Error('ffmpeg failed for ' + t.text + ': ' + (r.error?.message || r.stderr));
      const script = join(tmp, 'encode.py');
      writeFileSync(script, `import bpy, math\ns=bpy.context.scene\ns.render.fps=24\ns.sequence_editor_create()\na=s.sequence_editor.strips.new_sound('voice', ${JSON.stringify(wav)}, channel=1, frame_start=1)\ns.frame_start=1\ns.frame_end=a.frame_final_end\nbpy.ops.sound.mixdown(filepath=${JSON.stringify(t.file)}, check_existing=False, container='MP3', codec='MP3', channels='MONO', mixrate=24000, bitrate=40, format='S16')\n`);
      const fallback=spawnSync(process.env.COSMOS_BLENDER,['--background','--factory-startup','--python',script],{encoding:'utf8'});
      if (fallback.status !== 0 || !existsSync(t.file)) throw Error('Blender MP3 encoding failed: '+fallback.stderr);
    }
    have[t.key] = statSync(t.file).size;
    if (++n % 20 === 0 || n === todo.length) console.log(`  ${n}/${todo.length}`);
  }
  rmSync(tmp, { recursive: true, force: true });
}
if (args.has('--prune')) {
  for (const f of readdirSync(OUT)) if (f.endsWith('.mp3') && !index[f.slice(0, -4)]) { unlinkSync(join(OUT, f)); console.log('  pruned', f); }
}
for (const k of Object.keys(index)) if (existsSync(join(OUT, k + '.mp3'))) have[k] = statSync(join(OUT, k + '.mp3')).size;
const clips = Object.fromEntries(Object.keys(index).sort().filter((k) => have[k]).map((k) => [k, have[k]]));
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ v: 1, model: 'Kokoro-82M (Apache-2.0)', clips }) + '\n');
writeFileSync(join(OUT, 'lines.json'), JSON.stringify(Object.fromEntries(Object.keys(clips).map((k) => [k, index[k]])), null, 1) + '\n');
const bytes = Object.values(clips).reduce((a, b) => a + b, 0);
console.log(`manifest: ${Object.keys(clips).length} clips, ${(bytes / 1024).toFixed(0)} KB`);
