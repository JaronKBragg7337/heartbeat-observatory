import { StudioSession, emptyStudio } from './lib/libraries/studio/index.js';
import { allocate } from './lib/libraries/audio/buffer.js';

export function makeDemo() {
  const sampleRate = 12000, session = new StudioSession({ state: emptyStudio({ sampleRate, name: 'Small hours' }), historyId: 'studio-pro-demo' });
  const beatTicks = (n) => Math.round(n * sampleRate / 2);
  const tone = (seconds, hz, gain = 0.11) => { const b = allocate(seconds * sampleRate, sampleRate, 2); for (let i = 0; i < b.length; i++) b.channels[0][i] = b.channels[1][i] = Math.sin(2 * Math.PI * hz * i / sampleRate) * gain; return b; };
  const run = (name, params) => import('./lib/core/commands/definitions/studio.js').then(({ applyStudioCommand }) => applyStudioCommand(session, name, params));
  session.addTrack({ id: 'beat', name: 'Beat', kind: 'instrument', color: '#d89462', instrument: { type: 'drums', seed: 12 } });
  session.addTrack({ id: 'bass', name: 'Bass MIDI', kind: 'midi', color: '#b69bd4', instrument: { type: 'round' } });
  session.addTrack({ id: 'recorded', name: 'Comped take', kind: 'audio', color: '#83b9a5' });
  session.addTrack({ id: 'vocal', name: 'Lead vocal', kind: 'audio', color: '#d3b76d' });
  session.setPattern('beat', { id: 'pulse', rows: [{ instrument: 'kick', steps: [0, 4, 8, 12].map((step) => ({ step })) }, { instrument: 'hat', steps: Array.from({ length: 16 }, (_, step) => ({ step, velocity: 0.22 })) }] });
  session.setNotes('bass', [36, 36, 43, 43].map((midi, i) => ({ midi, tick: i * 960, duration: 900, velocity: 0.65 })));
  session.recordTake('recorded', tone(1, 220), { id: 'take-a', start: 0 });
  session.recordTake('recorded', tone(1, 330), { id: 'take-b', start: beatTicks(2) });
  session.comp('recorded', [{ take: 'take-a', from: 0, to: beatTicks(2) }, { take: 'take-b', from: beatTicks(2), to: beatTicks(4) }], { id: 'comp' });
  session.addClip('vocal', session.registerMedia(tone(2, 447), { id: 'voice-original', basis: 'seen', source: { recorded: true } }), { id: 'lead', basis: 'seen' });
  session.correctPitch('vocal', 'lead', { key: 'A', scale: 'minor', window: 512, hop: 512, minHz: 100, maxHz: 700 });
  session.editClip('vocal', 'lead', 'fade', { fadeIn: 64, fadeOut: 128 });
  session.addSection({ id: 'verse', name: 'Verse', start: 0, duration: beatTicks(2) });
  session.addSection({ id: 'hook', name: 'Hook', start: beatTicks(2), duration: beatTicks(2) });
  session.addMarker({ id: 'hit', name: 'Contact', at: beatTicks(2) });
  session.setAutomation('bass', 'gain', [{ tick: 0, value: 0.45 }, { tick: beatTicks(4), value: 0.85, curve: 'smooth' }]);
  session.setLyrics([{ id: 'line-1', text: 'We make the room sing', start: 0, end: beatTicks(2), words: [{ text: 'We', start: 0, end: beatTicks(0.5) }, { text: 'make', start: beatTicks(0.5), end: beatTicks(1) }] }, { id: 'line-2', text: 'Every contact has a cause', start: beatTicks(2), end: beatTicks(4) }]);
  session.lockPicture({ clockId: 'shot', fps: 30, shotId: 'demo-shot' });
  session.placeContact('beat', { eventId: 'engine-contact-demo', event: { k: 'event', eventId: 'engine-contact-demo', seq: 0, at: { clock: 'shot', tick: 30 }, type: 'contact.begin', subject: 'engine:ball', targets: ['engine:floor'], origin: 'physics', basis: 'made', basisOrigin: 'record', causes: [] }, at: { clock: 'shot', tick: 30 }, materialIds: ['wood', 'concrete'], impactSpeed: 2.8, mass: 1.2 });
  return session;
}
