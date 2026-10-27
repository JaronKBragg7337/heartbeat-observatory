import { allocate, mixInto } from '../audio/buffer.js';
import { DrumKit, Synth, Sampler } from '../audio/instruments.js';
import { processChain, masterAudio } from '../audio/mastering.js';
import { encodeWAV } from '../audio/wav.js';
import { lane } from '../audio/automation.js';
import { meter } from '../audio/meter.js';

const panGains = (pan) => [Math.cos((pan + 1) * Math.PI / 4), Math.sin((pan + 1) * Math.PI / 4)];
function gainAt(track, parameter, tick) { const a = track.automation[parameter]; return a ? lane(a).valueAt(tick) : track[parameter]; }
function envelopeAt(points, tick) { return points.length ? lane(1, points).valueAt(tick) : 1; }
function fadeGain(clip, i) {
  let gain = 1;
  if (clip.fadeInTicks && i < clip.fadeInTicks) gain *= clip.fadeCurve === 'linear' ? i / clip.fadeInTicks : Math.sin(i / clip.fadeInTicks * Math.PI / 2);
  const remaining = clip.durationTicks - 1 - i;
  if (clip.fadeOutTicks && remaining < clip.fadeOutTicks) gain *= clip.fadeCurve === 'linear' ? remaining / clip.fadeOutTicks : Math.sin(remaining / clip.fadeOutTicks * Math.PI / 2);
  return gain;
}
function addScaled(out, source, offset, gain = 1, pan = 0) {
  const gains = panGains(pan);
  for (let c = 0; c < out.numberOfChannels; c++) { const input = source.channels[Math.min(c, source.numberOfChannels - 1)]; for (let i = 0; i < input.length; i++) if (offset + i >= 0 && offset + i < out.length) out.channels[c][offset + i] += input[i] * gain * gains[c]; }
}

function renderClip(session, track, clip) {
  const sr = session.state.sampleRate;
  if (clip.segments) {
    const out = allocate(clip.durationTicks, sr, 2);
    for (const segment of clip.segments) {
      const take = track.takes[segment.take], source = session.mediaBuffer(take.mediaId), from = Math.max(0, segment.sourceStartTick), length = segment.toTick - segment.fromTick;
      for (let i = 0; i < length; i++) for (let c = 0; c < 2; c++) { const input = source.channels[Math.min(c, source.numberOfChannels - 1)]; out.channels[c][segment.fromTick - clip.startTick + i] += input[from + i] || 0; }
    }
    return out;
  }
  const source = session.mediaBuffer(clip.mediaId), out = allocate(clip.durationTicks, sr, 2), offset = clip.sourceOffsetTick || 0;
  for (let i = 0; i < out.length; i++) for (let c = 0; c < 2; c++) out.channels[c][i] = (source.channels[Math.min(c, source.numberOfChannels - 1)][offset + i] || 0) * (clip.gain ?? 1) * fadeGain(clip, i) * envelopeAt(clip.envelope || [], i);
  return out;
}

function renderNotes(session, track, length) {
  const out = allocate(length, session.state.sampleRate, 2), sr = session.state.sampleRate;
  const sampler = track.instrument?.type === 'sampler' ? new Sampler({ sampleRate: sr, samples: (track.instrument.samples || []).map((s) => ({ ...s, buffer: session.mediaBuffer(s.media) })), zones: track.instrument.zones || [] }) : null;
  for (const note of track.notes) {
    const at = session.time.tick({ clock: 'music', tick: note.tick }), duration = session.time.seconds(note.duration, 'music');
    const source = sampler ? sampler.note(note.midi, { velocity: note.velocity, duration }) : new Synth({ sampleRate: sr, type: track.instrument?.type || 'round', seed: track.instrument?.seed || 1 }).note(note.midi, { velocity: note.velocity, duration, glideFrom: note.glideFrom });
    addScaled(out, source, at, 1, note.pan || 0);
  }
  return out;
}

function renderPatterns(session, track, length) {
  const out = allocate(length, session.state.sampleRate, 2), kit = new DrumKit({ sampleRate: session.state.sampleRate, seed: track.instrument?.seed || 1, kit: track.instrument?.kit || 'hard' });
  for (const pattern of track.patterns) for (const row of pattern.rows) for (const step of row.steps) {
    if (!step.on && step.on !== undefined) continue;
    const probability = step.probability ?? 1; if (probability <= 0) continue;
    const musicTick = pattern.startTick + Math.round(step.step * session.time.clocks.get('music').ppq / pattern.stepsPerBeat), at = session.time.tick({ clock: 'music', tick: musicTick });
    for (let r = 0; r < (step.ratchet || 1); r++) addScaled(out, kit.hit(row.instrument, { velocity: step.velocity ?? row.velocity ?? 0.8, pan: step.pan || 0, seed: step.step + r }), at + Math.round(r * session.state.sampleRate * 0.25 / (step.ratchet || 1)), 1, 0);
  }
  return out;
}

export function renderTrack(session, trackId, length) {
  const track = session.track(trackId), out = allocate(length, session.state.sampleRate, 2);
  for (const clip of session.clips(track)) { const source = renderClip(session, track, clip); for (let i = 0; i < source.length; i++) for (let c = 0; c < 2; c++) { const at = clip.startTick + i; if (at < length) out.channels[c][at] += source.channels[c][i]; } }
  if (track.notes.length) mixInto(out, renderNotes(session, track, length));
  if (track.patterns.length) mixInto(out, renderPatterns(session, track, length));
  let wet = track.inserts.length ? processChain(out, track.inserts) : out;
  for (let i = 0; i < length; i++) {
    const gain = gainAt(track, 'gain', i) * (track.inputGain ?? 1) * (track.polarity ?? 1), pan = gainAt(track, 'pan', i), gains = panGains(pan);
    for (let c = 0; c < 2; c++) wet.channels[c][i] *= gain * gains[c];
  }
  return wet;
}

export function sessionLength(session) {
  let length = session.state.sampleRate * 4;
  for (const track of session.tracks()) { for (const clip of Object.values(track.clips)) length = Math.max(length, clip.startTick + clip.durationTicks); for (const note of track.notes) length = Math.max(length, session.time.tick({ clock: 'music', tick: note.tick + note.duration }) + session.state.sampleRate); }
  for (const line of session.state.lyrics.lines) length = Math.max(length, line.endTick);
  return Math.ceil(length + session.state.sampleRate * 0.25);
}

export function renderSession(session, { from = 0, to, master = false, tracks } = {}) {
  from = session.tick(from); const length = (to === undefined ? sessionLength(session) : session.tick(to)) - from;
  if (length <= 0) throw new RangeError('empty render range');
  const selected = tracks || session.state.trackOrder, audible = selected.filter((id) => !session.track(id).mute), anySolo = selected.some((id) => session.track(id).solo);
  const stems = new Map(), masterOut = allocate(length, session.state.sampleRate, 2), busOut = new Map(Object.keys(session.state.buses).map((id) => [id, allocate(length, session.state.sampleRate, 2)]));
  for (const id of audible) {
    if (anySolo && !session.track(id).solo) continue;
    const rendered = renderTrack(session, id, length), shifted = allocate(length, session.state.sampleRate, 2); mixInto(shifted, rendered, -from); stems.set(id, shifted); mixInto(masterOut, shifted);
    for (const send of session.track(id).sends) if (busOut.has(send.bus)) mixInto(busOut.get(send.bus), shifted, 0, send.gain ?? 1);
  }
  for (const [id, bus] of Object.entries(session.state.buses)) if (id !== 'master') { let out = busOut.get(id); if (bus.inserts.length) out = processChain(out, bus.inserts); stems.set(id, out); mixInto(masterOut, out, 0, bus.gain ?? 1); }
  const preMaster = masterOut, mastered = master ? masterAudio(preMaster, session.state.master) : null;
  return { buffer: mastered ? mastered.buffer : preMaster, preMaster, stems, master: mastered, meters: meter(mastered ? mastered.buffer : preMaster), from, length };
}

export function exportWAV(session, options = {}) {
  const rendered = renderSession(session, { ...options, master: options.master ?? true });
  const bytes = encodeWAV(rendered.buffer, { bitDepth: options.bitDepth || 24, dither: (options.bitDepth || 24) < 32, seed: options.seed || 1 });
  session.emit('render.completed', 'session', { kind: 'master', bytes: bytes.length, sampleRate: session.state.sampleRate, bitDepth: options.bitDepth || 24, loudness: rendered.master?.loudness, truePeak: rendered.master?.truePeak });
  return { bytes, rendered };
}

export function exportStems(session, options = {}) {
  const rendered = renderSession(session, options), files = [];
  for (const [id, buffer] of rendered.stems) files.push({ id, name: `${session.state.name.replace(/[^a-z0-9]+/gi, '-')}-${id}.wav`, bytes: encodeWAV(buffer, { bitDepth: options.bitDepth || 24 }), frames: buffer.length, sampleRate: buffer.sampleRate });
  const sum = allocate(rendered.preMaster.length, session.state.sampleRate, 2); for (const [, buffer] of rendered.stems) mixInto(sum, buffer);
  let error = 0; for (let c = 0; c < 2; c++) for (let i = 0; i < sum.length; i++) error = Math.max(error, Math.abs(sum.channels[c][i] - rendered.preMaster.channels[c][i]));
  const manifest = { format: 'hb-stems/1', origin: '0', frames: rendered.length, sampleRate: session.state.sampleRate, policy: 'pre-master, common origin and gain; no per-stem mastering', tracks: files.map(({ id, name, frames }) => ({ id, name, frames })), recombinationMaxError: error };
  session.emit('render.completed', 'session', { kind: 'stems', files: files.map((f) => f.name), recombinationMaxError: error });
  return { files, manifest, recombinationMaxError: error };
}
