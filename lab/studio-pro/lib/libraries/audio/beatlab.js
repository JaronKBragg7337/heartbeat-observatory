import { AudioGraph } from './graph.js';
import { AudioHistory } from './history.js';
import { DrumKit, Synth } from './instruments.js';
import { seededRandom } from './dsp.js';

export const SCALE = Object.freeze({ dark: [0, 2, 3, 5, 7, 8, 10], bright: [0, 2, 4, 5, 7, 9, 11] });
export const PROGRESSIONS = Object.freeze({
  dark: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [0, 5, 3, 4], [0, 2, 5, 6], [5, 6, 0, 0]],
  bright: [[0, 4, 5, 3], [1, 4, 0, 5], [3, 4, 2, 5], [0, 5, 3, 4], [5, 3, 0, 4], [0, 4, 3, 5]],
});
export const STYLES = Object.freeze({
  trap: { bpm: 140, mood: 'dark', kit: 'hard', bass: '808', keys: 'pad', lead: 'bell', kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  drill: { bpm: 142, mood: 'dark', kit: 'hard', bass: '808', keys: 'pad', lead: 'dark', kick: '......x.......x.', snare: '......x.....x...', hat: 'x.x.x.xxx.x.x.x.' },
  boombap: { bpm: 90, mood: 'dark', kit: 'dusty', bass: 'round', keys: 'keys', lead: 'keys', kick: 'x.....x...x.....', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.xx' },
  lofi: { bpm: 78, mood: 'dark', kit: 'soft', bass: 'round', keys: 'keys', lead: 'keys', kick: 'x.....x...x.....', snare: '....x.........x.', hat: '..x...x...x...x.' },
  rnb: { bpm: 75, mood: 'dark', kit: 'soft', bass: '808', keys: 'pad', lead: 'bell', kick: 'x.........x.....', snare: '....x.........x.', hat: '..x...x...x...x.' },
  afro: { bpm: 108, mood: 'bright', kit: 'hard', bass: 'log', keys: 'pluck', lead: 'pluck', kick: 'x..x..x...x.x...', snare: '....x.......x...', hat: '..x...x...x...x.' },
});

export function compose({ style = 'trap', key = 0, mood, seeds = { chords: 1, drums: 2, melody: 3, bass: 4 } } = {}) {
  const rules = STYLES[style]; if (!rules) throw new RangeError('unknown Beat Lab style ' + style);
  mood = mood || rules.mood; const scale = SCALE[mood], random = seededRandom(seeds.chords), root = 48 + key;
  const progression = PROGRESSIONS[mood][Math.floor(random() * PROGRESSIONS[mood].length)];
  const degree = (d, octave = 0) => root + 12 * (octave + Math.floor(d / 7)) + scale[(d % 7 + 7) % 7];
  const chords = progression.map((d) => ({ degree: d, root: degree(d, -1), tones: [d, d + 2, d + 4].map((n) => degree(n, 1)) }));
  return { style, key, mood, seeds, chords, drums: { kick: rules.kick, snare: rules.snare, hat: rules.hat } };
}

export function roll(recipe = { style: 'trap' }, seed = 1) {
  const random = seededRandom(seed), style = STYLES[recipe.style] || STYLES.trap;
  return { ...recipe, key: Math.floor(random() * 12), bpm: Math.round(style.bpm + (random() - 0.5) * 16), energy: 0.3 + random() * 0.65,
    seeds: { drums: Math.floor(random() * 1e9), bass: Math.floor(random() * 1e9), chords: Math.floor(random() * 1e9), melody: Math.floor(random() * 1e9) }, mood: random() < 0.25 ? (style.mood === 'dark' ? 'bright' : 'dark') : style.mood };
}

export function patternFromRecipe(recipe = {}) {
  const composed = recipe.chords ? recipe : compose(recipe), bars = recipe.bars || 2, tracks = [];
  for (const [name, row] of Object.entries(composed.drums)) tracks.push({ id: name, instrument: name, steps: [...row].flatMap((hit, step) => hit === 'x' ? [{ step, velocity: step % 4 === 0 ? 0.9 : 0.65 }] : []) });
  const notes = [];
  for (let bar = 0; bar < 4; bar++) for (const tone of composed.chords[bar].tones) notes.push({ step: bar * 16, note: tone, duration: 1.5, velocity: 0.7 });
  tracks.push({ id: 'keys', instrument: STYLES[composed.style].keys, notes });
  return { version: 1, bpm: recipe.bpm || STYLES[composed.style].bpm, bars, tracks, seed: composed.seeds.drums };
}

export function beatStepTick(step, bpm, sampleRate) { return Math.round(step * 60 * sampleRate / (4 * bpm)); }

export function renderBeatLab(pattern, { sampleRate = 48000, history, mixer = {}, tail = 2 } = {}) {
  if (!pattern || !Array.isArray(pattern.tracks) || !(pattern.bpm > 0)) throw new TypeError('pattern needs bpm and tracks');
  const ownHistory = !history, audio = history || new AudioHistory({ sampleRate, historyId: 'beat-lab' });
  const graph = new AudioGraph({ sampleRate }); const kit = new DrumKit({ sampleRate, seed: pattern.seed || 1, kit: pattern.kit });
  const tracks = new Map();
  for (const track of pattern.tracks) {
    graph.addTrack({ id: track.id, bus: track.bus || 'master', gain: track.gain ?? 0.7, pan: track.pan || 0, sends: track.sends, effects: track.effects, ...mixer[track.id] });
    tracks.set(track.id, { kit, synth: new Synth({ sampleRate, type: track.instrument, seed: (pattern.seed || 1) + track.id.length }) });
  }
  for (const [id, definition] of Object.entries(mixer.buses || {})) graph.addBus({ id, ...definition });
  const sorted = pattern.tracks.flatMap((track) => (track.steps || track.notes || []).map((note) => ({ ...note, track }))).sort((a, b) => a.step - b.step || a.track.id.localeCompare(b.track.id));
  for (const note of sorted) {
    const tick = beatStepTick(note.step, note.bpm || pattern.bpm, sampleRate), causeId = note.eventId || audio.id('beat-step');
    audio.event('beat.step', tick, { eventId: causeId, subject: note.track.id, origin: 'script', data: { step: note.step, note: note.note ?? null, instrument: note.track.instrument } });
    const voices = tracks.get(note.track.id), isDrum = ['kick', 'snare', 'clap', 'hat', 'openHat', 'shaker', 'rim', 'perc', 'crash'].includes(note.track.instrument);
    const buffer = isDrum ? voices.kit.hit(note.drum || note.track.instrument, { velocity: note.velocity ?? 1, pan: note.pan || 0, seed: (pattern.seed || 1) + tick + note.step }) : voices.synth.note(note.note ?? 60, { duration: note.duration || 0.4, velocity: note.velocity ?? 1, glideFrom: note.glideFrom });
    audio.makeSound(buffer, { at: tick, causeIds: [causeId], soundId: note.soundId, track: note.track.id, data: { instrument: note.track.instrument, step: note.step, note: note.note ?? null } });
    graph.addSource(note.track.id, buffer, { tick, eventId: causeId });
  }
  if (mixer.masterEffects) graph.mixer.configure('master', { effects: mixer.masterEffects });
  const rendered = graph.render({ tail });
  if (ownHistory) audio.event('render.completed', rendered.master.length, { type: 'render.completed', causes: audio.history.events.filter((e) => e.type === 'sound.made').map((e) => e.eventId), data: { frames: rendered.master.length, sampleRate } });
  return { ...rendered, buffer: rendered.master, history: audio, graph };
}
