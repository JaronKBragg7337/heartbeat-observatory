import { History } from '../../src/history/model.js';
import { validateHistory } from '../../src/history/validate.js';
import { contactSound } from './contacts.js';
import { asAudioBuffer } from './buffer.js';

const rational = (r) => r && typeof r.toString === 'function' ? r.toString() : String(r);

export class AudioHistory {
  constructor({ historyId = 'audio', namespace = historyId, sampleRate = 48000, audioClock = 'audio', clocks = [], toolVersion = '1' } = {}) {
    this.sampleRate = sampleRate; this.audioClock = audioClock; this.serial = 0; this.soundSerial = 0; this.sounds = new Map();
    const all = clocks.some((c) => c.id === audioClock) ? clocks : [{ id: audioClock, kind: 'linear', rate: [sampleRate, 1], unit: 'sample' }, ...clocks];
    this.history = new History({ historyId, namespace, clocks: all, tools: [{ name: 'hb-audio', version: toolVersion }] });
  }
  id(prefix) { return `${prefix}-${++this.serial}`; }
  tick(at = 0) {
    if (Number.isInteger(at)) return { tick: at, exact: true, residualTicks: 0 };
    if (typeof at !== 'object' || !at.clock) throw new TypeError('sound time must be an audio sample tick or {clock,tick}');
    if (at.clock === this.audioClock) return { tick: at.tick, exact: true, residualTicks: 0 };
    const converted = this.history.clocks.convert(at.clock, at.tick, this.audioClock, { round: 'nearest' });
    return { ...converted, residualTicks: rational(converted.residualTicks) };
  }
  event(type, at, fields = {}) {
    const time = this.tick(at), eventId = fields.eventId || this.id(type.replace(/\W+/g, '-'));
    const event = { k: 'event', eventId, seq: this.history.events.length, at: { clock: this.audioClock, tick: time.tick }, type, actor: 'tool:hb-audio', basis: 'made', basisOrigin: 'declared', ...fields };
    event.eventId = eventId;
    if (fields.exactTime === false || time.exact === false) { event.at.approx = true; event.data = { ...event.data, sourceTime: at, residualTicks: time.residualTicks }; }
    delete event.exactTime;
    this.history.add(event); return event;
  }
  makeSound(buffer, { at = 0, causeIds = [], eventId, soundId, type = 'sound.made', data = {}, track = 'master', ancestry = [] } = {}) {
    buffer = asAudioBuffer(buffer);
    if (buffer.sampleRate !== this.sampleRate) throw new RangeError('sound sample rate differs from the audio clock');
    soundId = soundId || this.id('sound');
    const entity = { k: 'entity', id: soundId, kind: 'sound', basis: 'made', basisOrigin: 'declared', data: { sampleRate: buffer.sampleRate, frames: buffer.length, channels: buffer.numberOfChannels, ...data } };
    this.history.add(entity);
    const event = this.event(type, at, { eventId, subject: soundId, produces: [soundId], causes: causeIds, ancestry, data: { frames: buffer.length, ...data } });
    this.sounds.set(soundId, { buffer, event, entity, track });
    return this.sounds.get(soundId);
  }
  contact(contact, { track = 'master', registerContact = true, materialOverrides } = {}) {
    const causeId = contact.eventId || this.id('contact');
    if (registerContact && !this.history.eventById.has(causeId)) this.event('contact.begin', contact.at || 0, {
      eventId: causeId, subject: contact.subject, targets: contact.targets, origin: contact.origin || 'script', basis: contact.basis || 'made',
      data: { materialIds: contact.materialIds || contact.materials, impactSpeed: contact.impactSpeed ?? contact.speed, mass: contact.mass, ...contact.data },
    });
    const made = contactSound(contact, { sampleRate: this.sampleRate, materialOverrides });
    return this.makeSound(made.buffer, { at: contact.at || 0, causeIds: [causeId], soundId: contact.soundId, track, data: { contact: made.parameters } });
  }
  tap(tap, { track = 'master', buffer } = {}) {
    const cause = this.event('user.tap', tap.at || 0, { eventId: tap.eventId, subject: tap.subject, origin: 'viewer-input', basis: tap.basis || 'seen', data: tap.data });
    return this.makeSound(buffer, { at: tap.at || 0, causeIds: [cause.eventId], soundId: tap.soundId, track, data: { gesture: tap.data || {} } });
  }
  why(id) { return this.history.why(id); }
  validate() { return validateHistory(this.history); }
  toJSONL() { return this.history.toJSONL(); }
}
