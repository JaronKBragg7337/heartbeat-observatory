import { StudioSession } from '../../../libraries/studio/session.js';
import { encodeMIDI } from '../../../libraries/studio/midi.js';
import { decodeWAV } from '../../../libraries/audio/wav.js';

const id = { type: 'string', minLength: 1 };
const object = { type: 'object' };
const P = (required, properties) => ({ type: 'object', required, additionalProperties: false, properties });
const base = { item: id };
const withTrack = { ...base, track: id };

export const STUDIO_OPERATIONS = Object.freeze(['transport.set', 'section.repeat', 'marker.add', 'bus.add', 'mixer.snapshot', 'picture.lock', 'lyrics.set', 'master.set', 'sampler.set']);

export function applyStudioCommand(session, name, p) {
  if (name === 'studio.track.add') return session.addTrack(p);
  if (name === 'studio.media.import') { const mediaId = session.registerMedia(p.buffer, { id: p.id, name: p.name, basis: 'seen', source: { asset: p.asset } }); return { mediaId, asset: p.asset }; }
  if (name === 'studio.take.record') return session.recordTake(p.track, p.buffer, p);
  if (name === 'studio.clip.add') return session.addClip(p.track, p.media, p);
  if (name === 'studio.pitch.correct') return session.correctPitch(p.track, p.clip, p.options);
  if (name === 'studio.sound.contact') return session.placeContact(p.track, p.contact);
  if (name === 'studio.take.comp') return session.comp(p.track, p.ranges, p);
  if (name === 'studio.clip.edit') return session.editClip(p.track, p.clip, p.operation, p.params);
  if (name === 'studio.midi.set') return session.setNotes(p.track, p.notes, p);
  if (name === 'studio.step.set') return session.setPattern(p.track, p.pattern);
  if (name === 'studio.automation.set') return session.setAutomation(p.track, p.parameter, p.points, p);
  if (name === 'studio.mixer.set') return session.setMixer(p.id, p.values);
  if (name === 'studio.section.add') return session.addSection(p.section);
  if (name === 'studio.edit') {
    if (!STUDIO_OPERATIONS.includes(p.operation)) throw new Error('unsupported Studio operation ' + p.operation);
    const v = p.params;
    if (p.operation === 'transport.set') { Object.assign(session.state.transport, v); return session.emit('transport.edited', 'transport', v); }
    if (p.operation === 'section.repeat') return session.repeatSection(v.section, v.at);
    if (p.operation === 'marker.add') return session.addMarker(v);
    if (p.operation === 'bus.add') return session.addBus(v);
    if (p.operation === 'mixer.snapshot') return session.snapshotMix(v.name);
    if (p.operation === 'picture.lock') return session.lockPicture(v);
    if (p.operation === 'lyrics.set') return session.setLyrics(v.lines);
    if (p.operation === 'master.set') return session.setMaster(v.preset, v.overrides);
    if (p.operation === 'sampler.set') return session.setSampler(v.track, v.sampler);
  }
  throw new Error('unknown Studio command ' + name);
}

function sessionFor(doc, item) {
  const data = doc.items[item]?.data; if (!data?.studio) throw new Error(`item ${item} has no hb-studio/1 data`);
  return new StudioSession({ state: data.studio });
}
function define(reg, name, title, schema) {
  reg.define({ name, title, params: schema, target: (p) => p.item,
    apply(tx, p) { const session = sessionFor(tx.doc, p.item), result = applyStudioCommand(session, name, p); tx.set(['items', p.item, 'data', 'studio'], session.toJSON()); return result?.id || null; },
  });
}

export function register(reg) {
  define(reg, 'studio.track.add', 'Add a Studio track', P(['item'], { ...base, id, name: { type: 'string' }, kind: { enum: ['audio', 'midi', 'instrument', 'event', 'lyrics', 'picture'] }, channels: { type: 'integer', minimum: 1, maximum: 64 }, instrument: object }));
  reg.define({ name: 'studio.media.import', title: 'Import WAV media', params: P(['item', 'name'], { ...base, id, name: { type: 'string' }, base64: { type: 'string', minLength: 1 } }), target: (p) => p.item,
    prepare(project, p) { return { bytes: Uint8Array.from(atob(p.base64), (c) => c.charCodeAt(0)) }; },
    apply(tx, p, { prepared }) { const asset = tx.addAsset(prepared.bytes, { name: p.name, mediaType: 'audio/wav', role: 'original' }), session = sessionFor(tx.doc, p.item); applyStudioCommand(session, 'studio.media.import', { ...p, asset, buffer: decodeWAV(prepared.bytes) }); session.state.mediaAssets = { ...(session.state.mediaAssets || {}), [p.id]: asset }; tx.set(['items', p.item, 'data', 'studio'], session.toJSON()); },
  });
  reg.define({ name: 'studio.take.record', title: 'Record a retained take from a WAV asset', params: P(['item', 'track', 'asset'], { ...withTrack, asset: id, id, start: { type: ['integer', 'object'] }, latencySamples: { type: 'integer', minimum: 0 } }), target: (p) => p.item,
    async prepare(project, p) { return { buffer: decodeWAV(await project.readAsset(p.asset)) }; },
    apply(tx, p, { prepared }) { const session = sessionFor(tx.doc, p.item), result = applyStudioCommand(session, 'studio.take.record', { ...p, buffer: prepared.buffer }); tx.set(['items', p.item, 'data', 'studio'], session.toJSON()); return result.id; },
  });
  define(reg, 'studio.clip.add', 'Place a clip', P(['item', 'track', 'media'], { ...withTrack, media: id, id, name: { type: 'string' }, start: { type: ['integer', 'object'] }, duration: { type: ['integer', 'object'] }, sourceOffset: { type: ['integer', 'object'] } }));
  define(reg, 'studio.pitch.correct', 'Correct vocal pitch', P(['item', 'track', 'clip'], { ...withTrack, clip: id, options: { type: 'object', default: {} } }));
  define(reg, 'studio.sound.contact', 'Place a contact sound to picture', P(['item', 'track', 'contact'], { ...withTrack, contact: object }));
  define(reg, 'studio.take.comp', 'Comp retained recording takes', P(['item', 'track', 'ranges'], { ...withTrack, ranges: { type: 'array', minItems: 1, items: object }, id, name: { type: 'string' }, fadeTicks: { type: 'integer', minimum: 0 } }));
  define(reg, 'studio.clip.edit', 'Edit a Studio clip', P(['item', 'track', 'clip', 'operation', 'params'], { ...withTrack, clip: id, operation: { enum: ['split', 'trim', 'move', 'fade', 'crossfade', 'gain', 'envelope', 'reverse', 'stretch', 'duplicate', 'remove'] }, params: object }));
  define(reg, 'studio.midi.set', 'Edit piano-roll MIDI and expression', P(['item', 'track', 'notes'], { ...withTrack, notes: { type: 'array', items: object }, append: { type: 'boolean', default: false } }));
  define(reg, 'studio.step.set', 'Edit a step-sequencer pattern', P(['item', 'track', 'pattern'], { ...withTrack, pattern: object }));
  define(reg, 'studio.automation.set', 'Edit an automation lane', P(['item', 'track', 'parameter', 'points'], { ...withTrack, parameter: id, points: { type: 'array', items: object }, initial: { type: 'number' }, mode: { enum: ['read', 'touch', 'latch', 'write'] } }));
  define(reg, 'studio.mixer.set', 'Edit a channel or bus', P(['item', 'id', 'values'], { ...base, id, values: object }));
  define(reg, 'studio.section.add', 'Add an arrangement section', P(['item', 'section'], { ...base, section: object }));
  define(reg, 'studio.edit', 'Edit Studio arrangement, picture, lyrics or master', P(['item', 'operation', 'params'], { ...base, operation: { enum: STUDIO_OPERATIONS }, params: object }));
}

export function studioMIDI(session, trackId) { const track = session.track(trackId); return encodeMIDI([{ name: track.name, notes: track.notes }], { ppq: session.time.clocks.get('music').ppq }); }
