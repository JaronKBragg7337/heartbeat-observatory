import { AudioHistory } from '../audio/history.js';
import { allocate, asAudioBuffer, resampleLinear } from '../audio/buffer.js';
import { timeStretch } from '../audio/effects.js';
import { History } from '../../src/history/model.js';
import { validateHistory } from '../../src/history/validate.js';
import { studioClocks, StudioTime, frameClock } from './time.js';
import { correctVocal, detectPitch, pitchPlan } from './pitch.js';

const clone = (v) => structuredClone(v);
const sorted = (values) => [...values].sort((a, b) => a.startTick - b.startTick || a.id.localeCompare(b.id));
const SCALES = new Set(['chromatic', 'major', 'minor']);

export const STUDIO_FORMAT = 'hb-studio/1';
export const MASTER_PRESETS = Object.freeze({
  streaming: { targetLUFS: -14, ceilingDb: -1 },
  podcast: { targetLUFS: -16, ceilingDb: -1 },
  club: { targetLUFS: -8, ceilingDb: -0.8 },
  reference: { targetLUFS: -23, ceilingDb: -2 },
});

export function emptyStudio({ sampleRate = 48000, bpm = 120, ppq = 960, name = 'Untitled session' } = {}) {
  return { format: STUDIO_FORMAT, name, sampleRate, clocks: studioClocks({ sampleRate, bpm, ppq }), tracks: {}, trackOrder: [], buses: { master: { id: 'master', name: 'Master', gain: 1, pan: 0, inserts: [], sends: [] } }, media: {}, sections: [], markers: [], lyrics: { lines: [] }, picture: null, master: { preset: 'streaming', ...MASTER_PRESETS.streaming, chain: [] }, transport: { playhead: 0, loop: null, snap: 'sample', countInBars: 1, metronome: true }, settings: { latencySamples: 0, inputGain: 1, monitoring: 'off', cueGain: 0.8 }, groups: {}, mixSnapshots: {}, release: { credits: [], rights: [] } };
}

export class StudioSession {
  constructor({ state, media, historyId = 'studio', namespace = 'studio' } = {}) {
    this.state = state ? clone(state) : emptyStudio();
    if (this.state.format !== STUDIO_FORMAT) throw new Error('expected hb-studio/1');
    this.media = media || new Map();
    for (const [id, entry] of Object.entries(this.state.media)) if (!this.media.has(id) && entry.buffer) this.media.set(id, asAudioBuffer(entry.buffer));
    const clocks = this.state.clocks;
    this.time = new StudioTime(clocks);
    if (this.state.history) this.history = new AudioHistory({ historyId, namespace, sampleRate: this.state.sampleRate, clocks });
    else this.history = new AudioHistory({ historyId, namespace, sampleRate: this.state.sampleRate, clocks });
    if (this.state.history) {
      const saved = History.fromJSONL(this.state.history);
      this.history.history = saved;
      this.history.serial = saved.events.length;
      this.history.sampleRate = this.state.sampleRate;
    }
    this.lastCause = this.history.history.events.at(-1)?.eventId || null;
    this.emit('session.open', 'session', { format: STUDIO_FORMAT });
  }

  id(prefix) { let n = Object.keys(this.state.media).length + this.history.history.events.length + 1, id; do { id = `${prefix}-${n++}`; } while (this.state.tracks[id] || this.state.media[id] || this.history.history.eventById.has(id)); return id; }
  tick(at) { return this.time.tick(at); }
  entity(id, kind, basis = 'made') {
    if (!this.history.history.entityOf(id)) this.history.history.add({ k: 'entity', id, kind, label: id, basis, basisOrigin: 'declared' });
  }
  emit(type, subject, data = {}, { causes, basis = 'made', origin = 'tool' } = {}) {
    this.entity(subject, type.split('.')[0], basis);
    const ev = this.history.event(type, 0, { subject, causes: causes || (this.lastCause ? [this.lastCause] : []), origin, basis, basisOrigin: 'declared', data });
    this.lastCause = ev.eventId; this.state.history = this.history.toJSONL(); return ev;
  }
  track(id) { const t = this.state.tracks[id]; if (!t) throw new Error('unknown track ' + id); return t; }
  clip(trackId, clipId) { const c = this.track(trackId).clips[clipId]; if (!c) throw new Error(`unknown clip ${clipId} on ${trackId}`); return c; }
  mediaBuffer(id) { const b = this.media.get(id); if (!b) throw new Error('missing media ' + id); return b; }

  addTrack({ id, name, kind = 'audio', channels = 2, instrument = null } = {}) {
    id = id || this.id('track'); if (this.state.tracks[id]) throw new Error('track exists ' + id);
    const track = { id, name: name || id, kind, channels, color: '#d5a75b', order: this.state.trackOrder.length, gain: 1, pan: 0, mute: false, solo: false, polarity: 1, inputGain: 1, armed: false, monitor: 'off', inserts: [], sends: [], automation: {}, clips: {}, takes: {}, notes: [], patterns: [], instrument, group: null };
    this.state.tracks[id] = track; this.state.trackOrder.push(id); this.emit('track.created', id, { name: track.name, kind, channels }); return track;
  }

  registerMedia(buffer, { id, name = 'audio', basis = 'seen', source = {}, rights = {} } = {}) {
    buffer = asAudioBuffer(buffer); if (buffer.sampleRate !== this.state.sampleRate) buffer = resampleLinear(buffer, this.state.sampleRate);
    id = id || this.id('media'); this.media.set(id, buffer);
    this.state.media[id] = { id, name, frames: buffer.length, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, basis, source, rights };
    this.emit('media.registered', id, { name, frames: buffer.length, channels: buffer.numberOfChannels, source }, { basis }); return id;
  }

  recordTake(trackId, buffer, { id, start = 0, channels, device = 'local', punch = null, latencySamples = 0 } = {}) {
    const track = this.track(trackId); if (!['audio', 'event'].includes(track.kind)) throw new Error('takes need an audio track');
    const startTick = Math.max(0, this.tick(start) - latencySamples), mediaId = this.registerMedia(buffer, { name: `${track.name} original`, basis: 'seen', source: { device, recorded: true, channels: channels || buffer.numberOfChannels } });
    id = id || this.id('take'); track.takes[id] = { id, mediaId, startTick, punch, channels: channels || buffer.numberOfChannels, channelMap: Array.from({ length: channels || buffer.numberOfChannels }, (_, i) => i), comped: false };
    this.emit('take.created', id, { track: trackId, mediaId, startTick, punch, latencySamples }, { basis: 'seen', origin: 'viewer-input' }); return track.takes[id];
  }

  comp(trackId, ranges, { id, name = 'Comp', fadeTicks = 128 } = {}) {
    const track = this.track(trackId); const segments = ranges.map((r) => {
      const take = track.takes[r.take]; if (!take) throw new Error('unknown take ' + r.take);
      const fromTick = this.tick(r.from), toTick = this.tick(r.to); if (toTick <= fromTick) throw new Error('comp range must be positive');
      const sourceStartTick = r.sourceStart === undefined ? take.startTick + fromTick - this.tick(r.from) : this.tick(r.sourceStart);
      return { take: r.take, fromTick, toTick, sourceStartTick: r.sourceStart === undefined ? fromTick - take.startTick : sourceStartTick };
    });
    id = id || this.id('clip'); track.clips[id] = { id, name, startTick: Math.min(...segments.map((s) => s.fromTick)), durationTicks: Math.max(...segments.map((s) => s.toTick)) - Math.min(...segments.map((s) => s.fromTick)), segments, fadeInTicks: fadeTicks, fadeOutTicks: fadeTicks, gain: 1, basis: 'patched', causes: ranges.map((r) => track.takes[r.take].mediaId) };
    for (const s of segments) track.takes[s.take].comped = true;
    this.emit('take.comped', id, { track: trackId, segments }, { basis: 'patched' }); return track.clips[id];
  }

  addClip(trackId, mediaId, { id, start = 0, duration, sourceOffset = 0, name = 'Clip', causes = [], basis } = {}) {
    const media = this.mediaBuffer(mediaId); start = this.tick(start); sourceOffset = this.tick(sourceOffset);
    id = id || this.id('clip'); const clip = { id, name, mediaId, startTick: start, durationTicks: duration === undefined ? media.length - sourceOffset : this.tick(duration), sourceOffsetTick: sourceOffset, gain: 1, envelope: [], fadeInTicks: 0, fadeOutTicks: 0, stretch: 1, basis: basis || this.state.media[mediaId].basis, causes };
    if (clip.durationTicks <= 0) throw new RangeError('clip duration must be positive'); this.track(trackId).clips[id] = clip;
    this.emit('clip.created', id, { track: trackId, mediaId, startTick: start, durationTicks: clip.durationTicks }, { basis: clip.basis }); return clip;
  }

  editClip(trackId, clipId, operation, params = {}) {
    const clip = this.clip(trackId, clipId), clips = this.track(trackId).clips;
    if (operation === 'split') {
      const at = this.tick(params.at); if (at <= clip.startTick || at >= clip.startTick + clip.durationTicks) throw new RangeError('split outside clip');
      const right = clone(clip); right.id = params.newId || this.id('clip'); right.startTick = at; right.durationTicks = clip.startTick + clip.durationTicks - at; right.sourceOffsetTick = (clip.sourceOffsetTick || 0) + at - clip.startTick; clip.durationTicks = at - clip.startTick; clips[right.id] = right;
    } else if (operation === 'trim') {
      const oldStart = clip.startTick, oldEnd = oldStart + clip.durationTicks, start = params.start === undefined ? oldStart : this.tick(params.start), end = params.end === undefined ? oldEnd : this.tick(params.end);
      if (start < 0 || end <= start) throw new RangeError('invalid trim'); clip.sourceOffsetTick = Math.max(0, (clip.sourceOffsetTick || 0) + start - oldStart); clip.startTick = start; clip.durationTicks = end - start;
    } else if (operation === 'move') { clip.startTick = this.tick(params.start); if (clip.startTick < 0) throw new RangeError('negative clip start'); }
    else if (operation === 'fade') { clip.fadeInTicks = params.fadeIn === undefined ? clip.fadeInTicks : this.tick(params.fadeIn); clip.fadeOutTicks = params.fadeOut === undefined ? clip.fadeOutTicks : this.tick(params.fadeOut); clip.fadeCurve = params.curve || clip.fadeCurve || 'equal-power'; }
    else if (operation === 'gain') clip.gain = params.gain;
    else if (operation === 'envelope') clip.envelope = clone(params.points || []);
    else if (operation === 'reverse') { const source = this.mediaBuffer(clip.mediaId), out = allocate(source.length, source.sampleRate, source.numberOfChannels); for (let c = 0; c < source.numberOfChannels; c++) for (let i = 0; i < source.length; i++) out.channels[c][i] = source.channels[c][source.length - 1 - i]; clip.mediaId = this.registerMedia(out, { name: clip.name + ' reverse', basis: 'patched', source: { from: clip.mediaId } }); }
    else if (operation === 'stretch') { const factor = params.factor; if (!(factor > 0)) throw new RangeError('factor must be positive'); const source = this.mediaBuffer(clip.mediaId); clip.mediaId = this.registerMedia(timeStretch(source, factor), { name: clip.name + ' stretch', basis: 'patched', source: { from: clip.mediaId, factor } }); clip.durationTicks = Math.round(clip.durationTicks * factor); clip.stretch = factor; }
    else if (operation === 'crossfade') { this.editClip(trackId, clipId, 'fade', { fadeOut: params.duration, curve: params.curve }); const other = this.clip(trackId, params.other); other.fadeInTicks = this.tick(params.duration); other.fadeCurve = params.curve || 'equal-power'; }
    else if (operation === 'duplicate') { const copy = clone(clip); copy.id = params.newId || this.id('clip'); copy.startTick = this.tick(params.start ?? clip.startTick + clip.durationTicks); clips[copy.id] = copy; }
    else if (operation === 'remove') delete clips[clipId];
    else throw new Error('unknown clip operation ' + operation);
    this.emit(`clip.${operation}`, clipId, { track: trackId, ...params }); return clip;
  }

  analyzePitch(mediaId, options = {}) { const frames = detectPitch(this.mediaBuffer(mediaId), options); this.emit('pitch.analyzed', mediaId, { frames: frames.length, options }); return frames; }
  correctPitch(clipIdTrack, clipId, options = {}) {
    if (!SCALES.has(options.scale || 'chromatic')) throw new RangeError('unknown scale');
    const clip = this.clip(clipIdTrack, clipId), source = this.mediaBuffer(clip.mediaId), result = correctVocal(source, options);
    clip.mediaId = this.registerMedia(result.buffer, { name: clip.name + ' pitch corrected', basis: 'patched', source: { from: clip.mediaId, correction: result.analysis } });
    clip.pitch = result.analysis; this.emit('pitch.corrected', clipId, { track: clipIdTrack, source: clip.mediaId, key: result.analysis.key, scale: result.analysis.scale, averageCorrectionCents: result.analysis.averageCorrectionCents }, { basis: 'patched' }); return result.analysis;
  }

  setNotes(trackId, notes, { append = false } = {}) {
    const track = this.track(trackId); if (!['midi', 'instrument'].includes(track.kind)) throw new Error('notes need a MIDI or instrument track');
    const clean = notes.map((n) => ({ velocity: 0.8, channel: 0, ...clone(n), tick: this.tick(n.tick), duration: this.tick(n.duration) }));
    track.notes = append ? [...track.notes, ...clean] : clean; this.emit('midi.edited', trackId, { count: clean.length, append }); return track.notes;
  }
  setPattern(trackId, pattern) { const p = { id: pattern.id || this.id('pattern'), length: 16, startTick: 0, stepsPerBeat: 4, ...clone(pattern) }, patterns = this.track(trackId).patterns, at = patterns.findIndex((x) => x.id === p.id); if (at >= 0) patterns[at] = p; else patterns.push(p); this.emit('step.edited', trackId, { pattern: p }); return p; }
  setSampler(trackId, sampler) { this.track(trackId).instrument = { type: 'sampler', ...clone(sampler) }; this.emit('sampler.edited', trackId, sampler); }

  addSection(section) { const s = { id: section.id || this.id('section'), name: section.name || 'Section', startTick: this.tick(section.start), durationTicks: this.tick(section.duration), color: section.color || '#b97b5d' }; this.state.sections.push(s); this.state.sections.sort((a, b) => a.startTick - b.startTick); this.emit('section.edited', s.id, s); return s; }
  addMarker(marker) { const m = { id: marker.id || this.id('marker'), name: marker.name || 'Marker', tick: this.tick(marker.at), kind: marker.kind || 'cue' }; this.state.markers.push(m); this.state.markers.sort((a, b) => a.tick - b.tick); this.emit('marker.edited', m.id, m); return m; }
  repeatSection(sectionId, at) { const section = this.state.sections.find((s) => s.id === sectionId); if (!section) throw new Error('unknown section'); const target = this.tick(at); for (const track of Object.values(this.state.tracks)) for (const clip of Object.values(track.clips)) if (clip.startTick >= section.startTick && clip.startTick < section.startTick + section.durationTicks) { const copy = clone(clip); copy.id = this.id('clip'); copy.startTick = target + clip.startTick - section.startTick; track.clips[copy.id] = copy; } this.emit('section.repeated', sectionId, { at: target }); }

  setAutomation(trackId, parameter, points, { initial, mode = 'read' } = {}) { this.track(trackId).automation[parameter] = { initial: initial ?? this.track(trackId)[parameter] ?? 0, points: clone(points).map((p) => ({ ...p, tick: this.tick(p.tick) })), mode }; this.emit('automation.edited', trackId, { parameter, points: points.length, mode }); }
  setMixer(id, values) { const target = id === 'master' ? this.state.buses.master : this.track(id); Object.assign(target, clone(values)); this.emit('mixer.edited', id, values); }
  addBus({ id, name, inserts = [], sends = [] }) { id = id || this.id('bus'); if (this.state.buses[id]) throw new Error('bus exists'); this.state.buses[id] = { id, name: name || id, gain: 1, pan: 0, inserts, sends }; this.emit('bus.created', id, { name, inserts, sends }); return this.state.buses[id]; }
  snapshotMix(name) { this.state.mixSnapshots[name] = clone({ tracks: this.state.tracks, buses: this.state.buses }); this.emit('mixer.snapshot', 'session', { name }); }

  setLyrics(lines) { this.state.lyrics.lines = lines.map((line, i) => ({ id: line.id || `line-${i + 1}`, text: line.text, startTick: this.tick(line.start), endTick: this.tick(line.end), words: (line.words || []).map((w) => ({ ...w, startTick: this.tick(w.start), endTick: this.tick(w.end), pronunciation: w.pronunciation || null })) })); this.emit('lyrics.edited', 'lyrics', { lines: lines.length }); }
  lyricAt(tick) { tick = this.tick(tick); return this.state.lyrics.lines.find((l) => tick >= l.startTick && tick < l.endTick) || null; }
  timedLyrics() { return this.state.lyrics.lines.map((l) => `[${String(Math.floor(this.time.seconds(l.startTick) / 60)).padStart(2, '0')}:${(this.time.seconds(l.startTick) % 60).toFixed(2).padStart(5, '0')}]${l.text}`).join('\n') + '\n'; }

  lockPicture({ videoAsset = null, clockId = 'shot', fps = 30, fpsDen = 1, offset = '0', shotId = null } = {}) {
    this.state.clocks = this.state.clocks.filter((c) => c.id !== clockId); const clock = frameClock(clockId, fps, fpsDen, offset); this.state.clocks.push(clock); this.time = new StudioTime(this.state.clocks);
    this.history.history.addClock(clock); this.state.picture = { videoAsset, shotId, clockId, fps, fpsDen, offset, lock: true }; this.emit('picture.locked', shotId || 'picture', this.state.picture); return this.state.picture;
  }

  placeContact(trackId, contact) {
    if (!this.state.picture) throw new Error('lock a picture before placing picture sound');
    const clockId = contact.at?.clock || this.state.picture.clockId;
    if (!this.history.history.clocks.has(clockId)) this.history.history.addClock(this.state.clocks.find((c) => c.id === clockId));
    const causeId = contact.eventId || contact.event?.eventId || this.id('contact');
    if (contact.event && !this.history.history.eventById.has(contact.event.eventId)) {
      const event = clone(contact.event); event.eventId = causeId; event.seq = this.history.history.events.length; this.history.history.add(event);
    }
    const made = this.history.contact({ ...contact, eventId: causeId, at: contact.at || { clock: clockId, tick: contact.frame || 0 } }, { track: trackId, registerContact: !contact.event });
    const tick = this.history.tick(contact.at || { clock: clockId, tick: contact.frame || 0 }).tick;
    const clip = this.addClip(trackId, this.registerMedia(made.buffer, { name: 'Contact sound', basis: 'made', source: { contactEvent: causeId } }), { start: tick, name: contact.name || 'Contact', causes: [made.event.eventId], basis: 'made' });
    clip.soundId = made.entity.id; clip.contactEvent = causeId; this.state.history = this.history.toJSONL(); return { clip, sound: made, why: () => this.why(made.entity.id) };
  }

  setMaster(preset, overrides = {}) { if (!MASTER_PRESETS[preset]) throw new RangeError('unknown mastering preset'); this.state.master = { preset, ...MASTER_PRESETS[preset], chain: [], ...clone(overrides) }; this.emit('master.edited', 'master', this.state.master); }
  why(id) { return this.history.why(id); }
  validate() { return validateHistory(this.history.history); }
  toJSON() { this.state.history = this.history.toJSONL(); const out = clone(this.state); for (const m of Object.values(out.media)) delete m.buffer; return out; }
  tracks() { return this.state.trackOrder.map((id) => this.state.tracks[id]); }
  clips(track) { return sorted(Object.values(track.clips)); }
}
